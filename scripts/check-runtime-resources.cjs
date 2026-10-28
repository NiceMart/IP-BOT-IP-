const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function checkRuntimeResources(root = path.resolve(__dirname, '..')) {
  const checks = [];
  const add = (name, pass, details) => checks.push({ name, pass: !!pass, ...details });
  const base = path.join(root, 'electron', 'resources', 'extra');
  const platform = process.platform === 'win32' ? 'win-x86' : process.platform === 'darwin' ? 'osx' : 'linux';
  for (const name of ['ffmpeg', 'ffprobe']) {
    const executable = path.join(base, platform, name + (process.platform === 'win32' ? '.exe' : ''));
    const probe = fs.existsSync(executable) ? spawnSync(executable, ['-version'], { encoding: 'utf8', timeout: 15000, windowsHide: true }) : null;
    add(name, probe?.status === 0, { path: path.relative(root, executable), version: probe?.stdout?.split(/\r?\n/)[0] || '', error: probe?.error?.message || (probe?.status === 0 ? undefined : 'Missing executable or dependent DLLs') });
  }
  const python = path.join(base, 'common', 'python', process.platform === 'win32' ? 'python.exe' : 'python3');
  const probe = fs.existsSync(python) ? spawnSync(python, ['-c', 'import sys,numpy,PIL,cv2,onnxruntime; print(sys.version.split()[0])'], { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true }) : null;
  add('Python + numpy/Pillow/OpenCV/ONNX', probe?.status === 0, { path: path.relative(root, python), version: probe?.stdout?.trim() || '', error: probe?.status === 0 ? undefined : 'Bundled Python or required packages unavailable' });
  add('u2net model', fs.existsSync(path.join(base, 'common', 'models', 'u2net.onnx')));
  const browserBase = path.join(base, 'common', 'playwright');
  const browserRelative = process.platform === 'win32' ? ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'] : process.platform === 'darwin' ? ['chrome-mac/Chromium.app/Contents/MacOS/Chromium'] : ['chrome-linux/chrome'];
  const browserCandidates = fs.existsSync(browserBase) ? fs.readdirSync(browserBase).filter(n => n.startsWith('chromium-')).flatMap(n => browserRelative.map(p => path.join(browserBase, n, p))) : [];
  if (process.platform === 'win32') for (const base of [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA].filter(Boolean)) {
    browserCandidates.push(path.join(base, 'Microsoft/Edge/Application/msedge.exe'), path.join(base, 'Google/Chrome/Application/chrome.exe'));
  }
  const browser = browserCandidates.find(p => fs.existsSync(p));
  add('Browser', !!browser, { path: browser && (browser.startsWith(root + path.sep) ? path.relative(root, browser) : 'installed system browser') });
  const localModelPaths = [path.join(root, 'modes', 'aigcpanel-server-heygem-v2-win-x86-1.0.0')];
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(root, 'data/storage/server.json'), 'utf8'));
    for (const record of settings.records || []) if (record.type === 'localDir' && typeof record.localPath === 'string') localModelPaths.push(record.localPath);
  } catch {}
  return { ready: checks.every(c => c.pass), checks, localModelPresent: localModelPaths.some(p => fs.existsSync(path.join(p, 'config.json'))) };
}
function ensureRuntimeResources(root) {
  const report = checkRuntimeResources(root);
  for (const check of report.checks) console.log(`[runtime-assets] ${check.pass ? 'OK' : 'MISSING'} ${check.name}${check.version ? ': ' + check.version : ''}`);
  if (!report.ready) throw new Error('运行资源不完整。请解压配套运行资源包，或执行 node scripts/import-runtime-resources.cjs <原项目目录> 后重试。详情：npm run check:runtime');
  return report;
}
module.exports = { checkRuntimeResources, ensureRuntimeResources };
if (require.main === module) {
  const report = checkRuntimeResources();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 2;
}
