const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const config = require('./resource-bundles.config.cjs');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  };
  walk(dir);
  files.sort();
  return files;
}

function hashDirectory(dir) {
  const hash = crypto.createHash('sha256');
  for (const file of listFiles(dir)) {
    const rel = path.relative(dir, file).replace(/\\/g, '/');
    const stat = fs.statSync(file);
    hash.update(rel);
    hash.update(String(stat.size));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function hashFile(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function zipDirectory(sourceDir, outFile) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outFile));
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  ensureDir(config.outputDir);
  ensureDir(path.dirname(config.releaseManifestPath));
  ensureDir(path.dirname(config.embeddedManifestPath));
  ensureDir(path.dirname(config.buildStatePath));

  const previousState = readJson(config.buildStatePath, { bundles: {} });
  const nextState = { generatedAt: new Date().toISOString(), bundles: {} };
  const manifest = {
    manifestVersion: 1,
    generatedAt: new Date().toISOString(),
    appVersion: process.env.npm_package_version || '',
    bundles: {},
  };

  const changedBundles = [];

  for (const bundle of config.bundles) {
    if (!fs.existsSync(bundle.source)) continue;

    const version = hashDirectory(bundle.source).slice(0, 16);
    const archive = `${bundle.name}-${version}.zip`;
    const archivePath = path.join(config.outputDir, archive);
    const previous = previousState.bundles?.[bundle.name];

    if (!previous || previous.version !== version || !fs.existsSync(archivePath)) {
      await zipDirectory(bundle.source, archivePath);
      changedBundles.push(bundle.name);
    }

    const size = fs.existsSync(archivePath) ? fs.statSync(archivePath).size : 0;
    const sha256 = fs.existsSync(archivePath) ? hashFile(archivePath) : '';
    const archiveUrl = process.env[config.releaseBaseUrlEnv] || config.releaseBaseUrl
      ? `${(process.env[config.releaseBaseUrlEnv] || config.releaseBaseUrl).replace(/\/$/, '')}/${archive}`
      : archive;

    manifest.bundles[bundle.name] = {
      version,
      archive,
      url: archiveUrl,
      sha256,
      size,
      required: !!bundle.required,
      extractTo: bundle.extractTo,
      source: path.relative(path.join(__dirname, '..'), bundle.source).replace(/\\/g, '/'),
    };

    nextState.bundles[bundle.name] = { version, archive, sha256, size };
  }

  fs.writeFileSync(config.releaseManifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(config.embeddedManifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(config.buildStatePath, JSON.stringify(nextState, null, 2));

  const summaryPath = path.join(config.outputDir, 'changed-bundles.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ changedBundles, manifest: path.basename(config.releaseManifestPath) }, null, 2));

  console.log('[resource-build] changed bundles:', changedBundles.join(', ') || 'none');
}

main().catch((error) => {
  console.error('[resource-build] failed:', error);
  process.exit(1);
});
