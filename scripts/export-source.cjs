const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const archiver = require('archiver');
const JSZip = require('jszip');
const ignore = require('ignore');
async function exportSource(target) {
  const root = path.resolve(__dirname, '..');
  const archivePath = target ? path.resolve(target) : path.resolve(root, '..', 'ip-bot-github-source.zip');
  if (archivePath.startsWith(root + path.sep)) throw new Error('Choose an archive path outside the project root.');
  const rules = ignore().add(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'));
  const files = [];
  function walk(dir, relative = '') {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(relative, item.name).replace(/\\/g, '/');
      if (item.isSymbolicLink() || item.name === '.git' || rules.ignores(rel + (item.isDirectory() ? '/' : ''))) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full, rel); else files.push({ rel, full });
    }
  }
  walk(root);
  const required = ['README.md', 'LICENSE', '.gitattributes', 'package-lock.json', 'user-server/package-lock.json', 'sensitive.config.example.json', 'scripts/import-runtime-resources.cjs', 'scripts/check-runtime-resources.cjs'];
  for (const rel of required) if (!files.some(f => f.rel === rel)) throw new Error('Required public source file missing: ' + rel);
  const privateFile = rel => rel === 'sensitive.config.json' || /(?:^|\/)(?:node_modules|data|modes|logs|resources-bundles)(?:\/|$)/.test(rel) || /\.db(?:[.-]|$)/.test(rel) || /^electron\/resources\/extra\/(?:win-|common\/(?:python|playwright|models))/.test(rel);
  if (files.some(f => privateFile(f.rel))) throw new Error('A private or runtime file was selected.');
  const configFile = path.join(root, 'sensitive.config.json');
  const secrets = [];
  const visit = (object) => { for (const [key, value] of Object.entries(object || {})) { if (value && typeof value === 'object') visit(value); else if (typeof value === 'string' && /key|secret|token|password/i.test(key) && value.length >= 12) secrets.push(value); } };
  if (fs.existsSync(configFile)) visit(JSON.parse(fs.readFileSync(configFile, 'utf8')));
  for (const file of files.filter(f => /\.(?:json|ts|js|cjs|vue|md|py|yml|yaml|ps1|bat|sh)$/.test(f.rel))) {
    const text = fs.readFileSync(file.full, 'utf8');
    if (secrets.some(secret => text.includes(secret))) throw new Error('Local credential found in source: ' + file.rel);
  }
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  const stream = fs.createWriteStream(archivePath), zip = archiver('zip', { zlib: { level: 9 } });
  const closed = new Promise((resolve, reject) => { stream.on('close', resolve); stream.on('error', reject); zip.on('error', reject); });
  zip.pipe(stream);
  for (const file of files) zip.file(file.full, { name: 'ip-bot/' + file.rel });
  await zip.finalize(); await closed;
  const bytes = fs.readFileSync(archivePath), verified = await JSZip.loadAsync(bytes, { checkCRC32: true });
  if (Object.keys(verified.files).filter(name => !verified.files[name].dir).length !== files.length) throw new Error('Archive verification failed.');
  return { path: archivePath, files: files.length, MB: +(bytes.length / 1048576).toFixed(2), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), crc: 'passed', privateConfigAndRuntime: 'excluded' };
}
module.exports = { exportSource };
if (require.main === module) exportSource(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
