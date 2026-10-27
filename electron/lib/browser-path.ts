/**
 * 浏览器路径工具
 * 统一管理所有模块的浏览器可执行文件路径
 * 支持自定义安装路径和离线使用
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppEnv } from '../mapi/env';
import { getRuntimeBundlePath } from './resource-path';

/**
 * 获取Playwright Chromium浏览器可执行文件路径
 * 优先使用打包的浏览器，支持自定义安装路径
 */
function getPlatformChromePaths(): string[] {
    if (process.platform === 'win32') {
        return ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'];
    } else if (process.platform === 'darwin') {
        return [
            'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
            'chrome-mac/chrome',
        ];
    } else {
        return ['chrome-linux/chrome'];
    }
}

function getPlatformCacheBase(): string[] {
    const runtimeCandidates = [
        getRuntimeBundlePath('playwright'),
        AppEnv.resourceBundleRoot ? path.join(AppEnv.resourceBundleRoot, 'playwright') : '',
        AppEnv.dataRoot ? path.join(AppEnv.dataRoot, 'playwright') : '',
    ].filter(Boolean);

    if (process.platform === 'win32') {
        return [
            ...runtimeCandidates,
            path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
            path.join(process.env.APPDATA || '', 'ms-playwright'),
        ];
    } else if (process.platform === 'darwin') {
        return [
            ...runtimeCandidates,
            path.join(process.env.HOME || '', 'Library/Caches/ms-playwright'),
        ];
    } else {
        return [
            ...runtimeCandidates,
            path.join(process.env.HOME || '', '.cache/ms-playwright'),
        ];
    }
}

export function getPlaywrightChromiumPath(): string | undefined {
  const runtimePath = getRuntimeBundlePath('playwright');
  const basePaths = [
    runtimePath,
    path.join(process.resourcesPath || app.getAppPath(), 'extra/common/playwright'),
    path.join(app.getAppPath(), 'resources/extra/common/playwright'),
    path.join(app.getAppPath(), 'electron/resources/extra/common/playwright'),
  ].filter(Boolean);

  const chromiumVersions = ['chromium-1200'];
  const chromePaths = getPlatformChromePaths();

  for (const basePath of basePaths) {
    for (const version of chromiumVersions) {
      for (const chromePath of chromePaths) {
        const browserPath = path.join(basePath, version, chromePath);
        if (fs.existsSync(browserPath)) {
          console.log('✅ [Browser] 使用打包的浏览器:', browserPath);
          return browserPath;
        }
      }
    }
  }

  const playwrightCacheBase = getPlatformCacheBase();

  // 也尝试查找任何可用的 chromium 版本（仅用于开发环境回退）
  for (const cacheBase of playwrightCacheBase) {
    if (fs.existsSync(cacheBase)) {
      const allDirs = fs.readdirSync(cacheBase);
      const chromiumDirs = allDirs.filter(d => d.startsWith('chromium-')).sort().reverse();
      for (const version of chromiumDirs) {
        for (const chromePath of chromePaths) {
          const browserPath = path.join(cacheBase, version, chromePath);
          if (fs.existsSync(browserPath)) {
            console.log('⚠️  [Browser] 使用系统缓存的浏览器:', browserPath);
            return browserPath;
          }
        }
      }
    }
  }

  // Source installs may not include Playwright's downloaded Chromium. Use an
  // installed browser with a dedicated automation profile, never the user's profile.
  const systemPaths = process.platform === 'win32'
    ? [
        ...[process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA]
          .filter(Boolean).map(base => path.join(base as string, 'Microsoft/Edge/Application/msedge.exe')),
        ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
          .filter(Boolean).map(base => path.join(base as string, 'Google/Chrome/Application/chrome.exe')),
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const browserPath of systemPaths) {
    if (fs.existsSync(browserPath)) {
      console.log('[Browser] 使用已安装的系统浏览器:', browserPath);
      return browserPath;
    }
  }

  console.log('⚠️  [Browser] 警告：未找到Playwright浏览器');
  return undefined;
}

/**
 * 获取用户数据目录（用于持久化浏览器数据）
 */
export function getBrowserUserDataDir(contextName: string): string {
  return path.join(app.getPath('userData'), 'browser-data', contextName);
}

/**
 * 通用的浏览器启动参数
 * 参考 aigc-human 项目的反爬和性能优化配置
 */
export const COMMON_BROWSER_ARGS = [
  // === 核心反爬与沙箱配置 ===
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-infobars',

  // === 启动速度优化 ===
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-breakpad',             // 禁用崩溃报告
  '--disable-component-update',     // 禁用组件自动更新
  '--disable-sync',                 // 禁用同步
  '--disable-default-apps',
  '--disable-popup-blocking',

  // === 后台性能优化 (防止页面被浏览器通过节流策略降速) ===
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',

  // === 媒体与渲染优化 (针对视频发布场景) ===
  '--enable-gpu',
  '--enable-webgl',
  '--ignore-gpu-blacklist',
  '--enable-accelerated-video-decode',
  '--enable-gpu-rasterization',
  '--enable-proprietary-codecs',    // 启用H.264等编解码器

  // === 自动播放策略 ===
  '--autoplay-policy=no-user-gesture-required',

  // === 安全 ===
  '--disable-features=IsolateOrigins,site-per-process',
];

/**
 * 应该忽略的默认启动参数
 * 移除 Chromium 的自动化标识，避免被平台检测
 */
export const BROWSER_IGNORE_DEFAULT_ARGS = [
  '--enable-automation',
];

/**
 * 反检测注入脚本
 * 在每个页面加载前执行，隐藏 Playwright/webdriver 痕迹
 */
export const STEALTH_INIT_SCRIPT = `
  // 隐藏 webdriver 标识
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  // 伪造 chrome.runtime（完善方法）
  window.chrome = {
    runtime: {
      PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
      PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
      PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
      RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
      OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
      OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      connect: function() { return { onDisconnect: { addListener: function() {} }, onMessage: { addListener: function() {} }, postMessage: function() {}, disconnect: function() {} }; },
      sendMessage: function() {},
      id: undefined
    },
    loadTimes: function() { return { firstPaintTime: 0, startLoadTime: 0, commitLoadTime: 0, finishDocumentLoadTime: 0, finishLoadTime: 0, firstPaintAfterLoadTime: 0, navigationType: 'Other', requestTime: Date.now() / 1000 }; },
    csi: function() { return { startE: Date.now(), onloadT: Date.now(), pageT: Math.random() * 1000 + 500, tran: 15 }; },
    app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } },
  };

  // 伪造 navigator.plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      return [{
        name: 'Chrome PDF Plugin',
        description: 'Portable Document Format',
        filename: 'internal-pdf-viewer',
        length: 1,
      }, {
        name: 'Chrome PDF Viewer',
        description: '',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        length: 1,
      }, {
        name: 'Native Client',
        description: '',
        filename: 'internal-nacl-plugin',
        length: 2,
      }];
    },
    configurable: true
  });

  // 伪造 navigator.languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en'],
    configurable: true
  });

  // 伪造 navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => 8,
    configurable: true
  });

  // 伪造 navigator.connection
  if (!navigator.connection) {
    Object.defineProperty(navigator, 'connection', {
      get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }),
      configurable: true
    });
  }

  // 伪造 navigator.getBattery
  if (!navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    });
  }

  // 清理 Playwright 特征
  delete window.__playwright;
  delete window.__pw_manual;

  // 清理自动化工具特征
  delete window._REACT_DEVTOOLS_GLOBAL_HOOK__;
  delete window.__selenium_unwrapped;
  delete window.__webdriver_evaluate;
  delete window.__selenium_evaluate;
  delete window.__fxdriver_evaluate;
  delete window.__driver_unwrapped;
  delete window.__driver_evaluate;
  delete window.__phantomas;
  delete window.__nightmare;
  delete window.callSelenium;
  delete window._phantom;
  delete window.callPhantom;
  delete window.Buffer;
  delete window.emit;
  delete window.spawn;
  delete window.webdriver;
`;
