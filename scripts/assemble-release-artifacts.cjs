const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'dist-release-final');
const bundleDir = path.join(buildDir, 'resource-bundles');
const releaseDir = path.join(buildDir, 'release-assets');
const legacyPrefixes = ['尚创IP智能体V8'];
const currentPrefix = 'SC-IP-Agent';

fs.mkdirSync(releaseDir, { recursive: true });

const waitForFile = (filePath, maxWait = 10000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    try {
      const fd = fs.openSync(filePath, 'r+');
      fs.closeSync(fd);
      return true;
    } catch {
      if (Date.now() - startTime < maxWait) {
        const sleepMs = 200;
        const sleepUntil = Date.now() + sleepMs;
        while (Date.now() < sleepUntil) {
        }
      }
    }
  }
  console.warn(`[assemble] Warning: ${filePath} still locked after ${maxWait}ms, attempting copy anyway...`);
  return false;
};

const copyIfNeeded = (sourcePath, destPath) => {
  if (fs.existsSync(destPath)) {
    const srcBuffer = fs.readFileSync(sourcePath);
    const destBuffer = fs.readFileSync(destPath);
    if (srcBuffer.length === destBuffer.length && srcBuffer.equals(destBuffer)) {
      return false;
    }
  }

  waitForFile(sourcePath);
  fs.copyFileSync(sourcePath, destPath);
  return true;
};

const compatAliasesFor = (name) => {
  for (const legacyPrefix of legacyPrefixes) {
    const prefix = `${legacyPrefix}-`;
    if (name.startsWith(prefix)) {
      return [`${currentPrefix}-${name.slice(prefix.length)}`];
    }
  }
  return [];
};

for (const name of fs.readdirSync(buildDir)) {
  const full = path.join(buildDir, name);
  if (!fs.statSync(full).isFile()) continue;
  if (name.endsWith('.exe') || name.endsWith('.blockmap') || name.endsWith('.yml')) {
    const dest = path.join(releaseDir, name);
    try {
      copyIfNeeded(full, dest);
    } catch (err) {
      if (err.code === 'EBUSY') {
        console.warn(`[assemble] ${name} is locked, skipping (likely being scanned by antivirus)`);
      } else {
        throw err;
      }
    }
  }
}

for (const name of fs.readdirSync(releaseDir)) {
  const full = path.join(releaseDir, name);
  if (!fs.statSync(full).isFile()) continue;
  for (const alias of compatAliasesFor(name)) {
    const aliasPath = path.join(releaseDir, alias);
    if (aliasPath === full || fs.existsSync(aliasPath)) continue;
    fs.copyFileSync(full, aliasPath);
    console.log(`[assemble] Created compatibility alias: ${alias}`);
  }
}

const manifestPath = path.join(buildDir, 'resource-manifest.json');
if (fs.existsSync(manifestPath)) {
  fs.copyFileSync(manifestPath, path.join(releaseDir, 'resource-manifest.json'));
}

if (fs.existsSync(bundleDir)) {
  for (const name of fs.readdirSync(bundleDir)) {
    const full = path.join(bundleDir, name);
    if (fs.statSync(full).isFile() && (name.endsWith('.zip') || name.endsWith('.json'))) {
      fs.copyFileSync(full, path.join(releaseDir, name));
    }
  }
}

console.log('[release-assemble] output:', releaseDir);
