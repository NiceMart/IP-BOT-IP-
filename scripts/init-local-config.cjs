const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function ensureLocalConfig(root = path.resolve(__dirname, '..')) {
  const target = path.join(root, 'sensitive.config.json');
  if (fs.existsSync(target)) return { created: false, path: target };
  const config = JSON.parse(fs.readFileSync(path.join(root, 'sensitive.config.example.json'), 'utf8').replace(/^\uFEFF/, ''));
  config.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
    return { created: true, path: target };
  } catch (error) {
    // Both launchers may be double-clicked together. Keep whichever config won.
    if (error.code === 'EEXIST') return { created: false, path: target };
    throw error;
  }
}
module.exports = { ensureLocalConfig };
if (require.main === module) {
  const result = ensureLocalConfig();
  console.log(result.created ? 'Created local config with a random JWT secret. Configure your own model credentials in the backend.' : 'Local config already exists; kept unchanged.');
}
