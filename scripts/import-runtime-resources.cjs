const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = process.argv[2] && path.resolve(process.argv[2]);
if (!source || !fs.existsSync(path.join(source, 'electron', 'resources', 'extra'))) throw new Error('Usage: node scripts/import-runtime-resources.cjs <original-project-or-runtime-folder> [--with-local-models]');
if (source === root || source.startsWith(root + path.sep) || root.startsWith(source + path.sep)) throw new Error('Source and destination must be separate directories.');
const groups = ['electron/resources/extra/win-x86', 'electron/resources/extra/win-x86-backup', 'electron/resources/extra/common', 'electron/resources/extra/stickers', 'fonts', 'ziti', 'bgm', 'python'];
if (process.argv.includes('--with-local-models')) groups.push('modes');
let copied = 0;
function copy(dir, rel) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.join(rel, item.name);
    if (item.isSymbolicLink() || ['__pycache__', '.git', 'node_modules'].includes(item.name) || relative.startsWith(path.join('electron/resources/extra/common/tray'))) continue;
    if (rel.startsWith('modes') && ['result', 'tmp', 'flagged', '_cache', '_launcher_logs', '_temp', 'aigcpanel-queue', 'data'].includes(item.name)) continue;
    const from = path.join(dir, item.name), to = path.join(root, relative);
    if (item.isDirectory()) { fs.mkdirSync(to, { recursive: true }); copy(from, relative); }
    else if (!fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); copied++; }
  }
}
for (const rel of groups) { copy(path.join(source, rel), rel); console.log('[runtime-import] ' + rel); }
const defaults = path.join(root, 'electron/config/default-config.json');
if (fs.existsSync(defaults)) fs.copyFileSync(defaults, path.join(root, 'electron/resources/extra/common/default-config.json'));
console.log('[runtime-import] Copied ' + copied + ' missing files; existing config and data preserved.');
require('./check-runtime-resources.cjs').ensureRuntimeResources(root);
