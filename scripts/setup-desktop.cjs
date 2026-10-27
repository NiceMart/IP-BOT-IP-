const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function runProbe(binary) {
  return spawnSync(binary, [path.join(__dirname, 'check-desktop-runtime.cjs')], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
}

async function ensureDesktopRuntime() {
  // npm can leave the Electron package installed without its executable after
  // an interrupted first install. Repair that package without reinstalling all.
  let binary;
  try { binary = require('electron'); } catch {}
  if (!binary || !fs.existsSync(binary)) {
    console.log('[setup] Completing the Electron runtime download...');
    const install = spawnSync(process.execPath, [require.resolve('electron/install.js')], {
      cwd: root, env: process.env, stdio: 'inherit', windowsHide: true,
    });
    if (install.error || install.status !== 0) throw new Error('Electron download failed. Check the network connection, then start again.');
    delete require.cache[require.resolve('electron')];
    binary = require('electron');
  }

  let result = runProbe(binary);
  if (result.status !== 0) {
    // better-sqlite3 depends on the Electron ABI; Sharp and the optional ws
    // accelerators ship Node-API binaries and do not need V8 recompilation.
    console.log('[setup] Preparing SQLite for the installed Electron version...');
    const { rebuild } = require('@electron/rebuild');
    await rebuild({
      buildPath: root,
      electronVersion: require('electron/package.json').version,
      arch: process.arch,
      onlyModules: ['better-sqlite3'],
      buildFromSource: false,
    });
    result = runProbe(binary);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.error || result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error('Electron runtime validation failed. See the module error above.');
  }
  console.log('[setup] Desktop runtime verified.');
}

module.exports = { ensureDesktopRuntime };
if (require.main === module) {
  ensureDesktopRuntime().catch(error => { console.error('[setup]', error.message); process.exitCode = 1; });
}
