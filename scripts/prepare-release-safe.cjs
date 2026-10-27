const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'dist-release-final');
const releaseAssetsDir = path.join(buildDir, 'release-assets');
const packageJson = require(path.join(root, 'package.json'));

const currentVersion = packageJson.version;
const currentInstallerName = `SC-IP-Agent-${currentVersion}-win-setup-x64.exe`;
const currentBlockmapName = `${currentInstallerName}.blockmap`;

function ensurePathExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required path: ${filePath}`);
  }
}

function validateReleaseArtifacts() {
  console.log(`[prepare-release] Current version: ${currentVersion}`);

  ensurePathExists(buildDir);
  ensurePathExists(releaseAssetsDir);
  ensurePathExists(path.join(buildDir, currentInstallerName));
  ensurePathExists(path.join(buildDir, currentBlockmapName));
  ensurePathExists(path.join(buildDir, 'latest.yml'));
  ensurePathExists(path.join(buildDir, 'resource-manifest.json'));
  ensurePathExists(path.join(releaseAssetsDir, currentInstallerName));
  ensurePathExists(path.join(releaseAssetsDir, currentBlockmapName));

  const latestYmlContent = fs.readFileSync(path.join(buildDir, 'latest.yml'), 'utf8');
  if (!latestYmlContent.includes(`version: ${currentVersion}`)) {
    throw new Error(`latest.yml version mismatch, expected ${currentVersion}`);
  }

  console.log('[prepare-release] Required artifacts are present');
}

function listDifferentialArtifacts() {
  return fs.readdirSync(releaseAssetsDir)
    .filter(name => {
      return /^SC-IP-Agent-\d+\.\d+\.\d+-win-setup-x64\.exe(\.blockmap)?$/.test(name) || name === 'latest.yml';
    })
    .sort();
}

function listHistoricalBlockmaps() {
  return fs.readdirSync(releaseAssetsDir)
    .filter(name => /^SC-IP-Agent-\d+\.\d+\.\d+-win-setup-x64\.exe\.blockmap$/.test(name))
    .sort();
}

function listResourceArtifacts() {
  return fs.readdirSync(releaseAssetsDir)
    .filter(name => name.endsWith('.zip') || name === 'resource-manifest.json' || name === 'changed-bundles.json')
    .sort();
}

function printSummary() {
  const installerPath = path.join(buildDir, currentInstallerName);
  const installerSizeMb = (fs.statSync(installerPath).size / 1024 / 1024).toFixed(2);
  const differentialArtifacts = listDifferentialArtifacts();
  const historicalBlockmaps = listHistoricalBlockmaps();
  const resourceArtifacts = listResourceArtifacts();

  if (differentialArtifacts.length === 0) {
    throw new Error('No SC-IP-Agent differential artifacts found in release-assets');
  }

  console.log('\n[prepare-release] ========== RELEASE SUMMARY ==========');
  console.log(`Version: ${currentVersion}`);
  console.log(`Installer: ${currentInstallerName}`);
  console.log(`Installer size: ${installerSizeMb} MB`);

  console.log('\nUpload to COS updates/ for this release:');
  console.log(`  - ${currentInstallerName}`);
  console.log(`  - ${currentBlockmapName}`);
  console.log('  - latest.yml');

  console.log('\nKeep on COS for differential installer updates:');
  historicalBlockmaps.forEach(name => console.log(`  - ${name}`));

  console.log('\nUpload resource delta files when changed:');
  resourceArtifacts.forEach(name => console.log(`  - ${name}`));

  console.log('\nStorage policy:');
  console.log('  - Historical SC-IP-Agent *.exe files can be deleted from COS if you do not offer old installers for manual download.');
  console.log('  - Historical SC-IP-Agent *.exe.blockmap files should be kept for the versions you still want to support differential updates from.');
  console.log('  - If a client is too old and its blockmap was removed, that client will fall back to a full installer download once.');
  console.log('[prepare-release] ====================================\n');
}

try {
  validateReleaseArtifacts();
  printSummary();
  console.log('[prepare-release] Release preparation complete');
} catch (error) {
  console.error('[prepare-release] ERROR:', error.message);
  process.exit(1);
}
