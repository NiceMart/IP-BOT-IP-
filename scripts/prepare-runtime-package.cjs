const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('./check-runtime-resources.cjs').ensureRuntimeResources(root);
const python = path.join(root, 'electron/resources/extra/common/python', process.platform === 'win32' ? 'python.exe' : 'python3');
for (const [exe, args] of [[python, ['scripts/export-runtime-system-templates.py']], [process.execPath, ['scripts/prepare-package.cjs']]]) {
  const result = spawnSync(exe, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) { console.error(result.error?.message || 'Package preparation failed.'); process.exit(result.status || 1); }
}
