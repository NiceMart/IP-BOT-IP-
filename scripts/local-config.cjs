const fs = require('node:fs');
const path = require('node:path');
function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}
function loadLocalConfig(root = path.resolve(__dirname, '..')) {
  const file = path.join(root, 'sensitive.config.json');
  const json = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : {};
  const envFile = path.join(root, '.env');
  const values = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
  const result = { ...json };
  for (const [key, value] of Object.entries(values)) if (value !== '') result[key] = value;
  for (const key of new Set([...Object.keys(result), 'HOST', 'PORT', 'DATABASE_PATH', 'CORS_ORIGINS', 'NODE_ENV'])) if (process.env[key] !== undefined && process.env[key] !== '') result[key] = process.env[key];
  return result;
}
function applyLocalEnvironment(root) {
  const config = loadLocalConfig(root);
  for (const [key, value] of Object.entries(config)) if (typeof value === 'string' && process.env[key] === undefined) process.env[key] = value;
  return config;
}
module.exports = { parseEnv, loadLocalConfig, applyLocalEnvironment };
