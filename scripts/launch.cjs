/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
require('./local-config.cjs').applyLocalEnvironment(root);
const mode = process.argv[2];
const checkOnly = process.env.IPBOT_LAUNCH_CHECK === '1';
const logDir = path.join(root, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logDir, `startup-${mode || 'unknown'}-${stamp}.log`);
const log = text => { process.stdout.write(text + '\n'); fs.appendFileSync(logFile, text + '\n'); };

function npmCliPath() {
  const options = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return options.find(file => fs.existsSync(file));
}

function runNpm(args, cwd) {
  const cli = npmCliPath();
  if (!cli) throw new Error('npm-cli.js was not found. Install Node.js with npm and restart this launcher.');
  log(`\n> npm ${args.join(' ')}\nWorking directory: ${cwd}`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd, env: process.env, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true,
    });
    const forward = (stream, output) => stream.on('data', data => {
      output.write(data); fs.appendFileSync(logFile, data);
    });
    forward(child.stdout, process.stdout); forward(child.stderr, process.stderr);
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} exited with ${code ?? signal}. See the log above.`)));
  });
}

const requirements = {
  desktop: ['node_modules/vite/bin/vite.js', 'node_modules/concurrently/package.json', 'node_modules/electron/index.js', `node_modules/electron/dist/${process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'}`],
  server: ['node_modules/express/package.json', 'node_modules/sqlite3/package.json', 'node_modules/bcryptjs/package.json', 'node_modules/jsonwebtoken/package.json'],
};

function missingDependencies(target) {
  const cwd = target === 'server' ? path.join(root, 'user-server') : root;
  return requirements[target].filter(file => !fs.existsSync(path.join(cwd, file)));
}

async function ensureDependencies(target, force = false) {
  const cwd = target === 'server' ? path.join(root, 'user-server') : root;
  const missing = missingDependencies(target);
  if (!force && missing.length === 0) return;
  log(`${target}: ${missing.length ? 'dependencies are missing' : 'install requested'}.`);
  missing.forEach(file => log(`  Missing: ${file}`));
  if (checkOnly) { process.exitCode = 2; return; }
  log('Installing dependencies for this source package. The first run needs network access and may take several minutes.');
  await runNpm(['ci', '--prefer-offline', '--no-audit', '--no-fund'], cwd);
  const remaining = missingDependencies(target);
  if (remaining.length) throw new Error(`Installation did not produce all required files: ${remaining.join(', ')}`);
}

async function main() {
  log('IP Bot source launcher');
  log(`Node.js: ${process.version}\nNode path: ${process.execPath}\nProject: ${root}\nLog: ${logFile}`);
  if (!['desktop', 'server', 'install'].includes(mode)) throw new Error('Usage: node scripts/launch.cjs desktop|server|install');
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js is too old. Install Node.js 22 LTS or a supported newer LTS version.');
  if (!fs.existsSync(path.join(root, 'sensitive.config.json'))) throw new Error('sensitive.config.json is missing. Restore your local configuration before starting.');
  if (mode === 'install') {
    await ensureDependencies('server', true); await ensureDependencies('desktop', true);
    if (!process.exitCode) log('Dependency installation completed. Start the backend, then start the desktop app.');
    return;
  }
  await ensureDependencies(mode);
  if (checkOnly) { log('Check-only mode: no installation or application launch was performed.'); return; }
  if (mode === 'desktop') {
    log('Verifying Electron and its native database/image modules...');
    await require('./setup-desktop.cjs').ensureDesktopRuntime();
    require('./check-runtime-resources.cjs').ensureRuntimeResources(root);
  }
  if (mode === 'server') {
    log('Starting backend. Default address: http://127.0.0.1:3002/admin');
    await runNpm(['start'], path.join(root, 'user-server'));
  } else {
    log('Starting the Electron desktop app. Start the backend separately if you use local account services.');
    log('Runtime resources verified. All executable paths resolve from this project.');
    await runNpm(['run', 'dev:electron'], root);
  }
}

main().catch(error => { log(`\nERROR: ${error.message}\nDiagnostic log: ${logFile}`); process.exitCode = 1; });
