const path = require('path');

const root = path.join(__dirname, '..');

module.exports = {
  releaseBaseUrlEnv: 'RESOURCE_BASE_URL',
  releaseBaseUrl: 'https://xiazaigengxin-1417293730.cos.ap-guangzhou.myqcloud.com/updates',
  outputDir: path.join(root, 'dist-release-final', 'resource-bundles'),
  releaseManifestPath: path.join(root, 'dist-release-final', 'resource-manifest.json'),
  embeddedManifestPath: path.join(root, 'electron', 'resources', 'extra', 'common', 'resource-manifest.json'),
  buildStatePath: path.join(root, 'build', 'resource-build-state.json'),
  bundles: [
    {
      name: 'playwright',
      source: path.join(root, 'electron', 'resources', 'extra', 'common', 'playwright'),
      required: true,
      extractTo: 'resources-bundles/playwright',
    },
    {
      name: 'python-runtime',
      source: path.join(root, 'electron', 'resources', 'extra', 'common', 'python'),
      required: true,
      extractTo: 'resources-bundles/python-runtime',
    },
    {
      name: 'models',
      source: path.join(root, 'electron', 'resources', 'extra', 'common', 'models'),
      required: true,
      extractTo: 'resources-bundles/models',
    },
    {
      name: 'fonts',
      source: path.join(root, 'electron', 'resources', 'extra', 'common', 'fonts'),
      required: false,
      extractTo: 'resources-bundles/fonts',
    },
    {
      name: 'ziti',
      source: path.join(root, 'ziti'),
      required: false,
      extractTo: 'resources-bundles/ziti',
    },
    {
      name: 'bgm',
      source: path.join(root, 'bgm'),
      required: false,
      extractTo: 'resources-bundles/bgm',
    },
  ],
};
