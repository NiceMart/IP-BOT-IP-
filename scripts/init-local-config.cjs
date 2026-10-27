const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), target = path.join(root, 'sensitive.config.json');
if (fs.existsSync(target)) { console.log('Local config already exists; kept unchanged.'); process.exit(0); }
const config = JSON.parse(fs.readFileSync(path.join(root, 'sensitive.config.example.json'), 'utf8'));
config.JWT_SECRET = crypto.randomBytes(32).toString('hex');
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
console.log('Created local config with a random JWT secret. Configure your own model credentials in the backend.');
