/* Modified for IP Bot: portable startup isolation and missing-runtime guidance. */
import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell, protocol, globalShortcut, dialog } from "electron";
import { optimizer } from "@electron-toolkit/utils";
import path from "node:path"
import fs from "node:fs";
import { execSync, exec as execCallback } from "child_process";
import os from "node:os";
import { promisify } from "node:util";

/** process.js 必须位于非依赖项的顶部 */
import { isDummy } from "../lib/process";
import { AppEnv, AppRuntime } from "../mapi/env";
import { MAPI } from "../mapi/main";
import { initSystemTemplates } from "../mapi/db/initSystemTemplates";
import { initBuiltinAvatars } from "../mapi/db/initBuiltinAvatars";
import { initAppConfig, initVoicePreCache } from "../mapi/config/initAppConfig";
import { ConfigMain } from "../mapi/config/main";
import { setUpdaterWindow, default as updaterIndex } from "../mapi/updater/index";

import { WindowConfig } from "../config/window";
import { AppConfig } from "../../src/config";
import Log from "../mapi/log/main";
import { ConfigMenu } from "../config/menu";
import { ConfigLang, t } from "../config/lang";
import { ConfigContextMenu } from "../config/contextMenu";
import { preloadDefault, rendererLoadPath } from "../lib/env-main";
import { Page } from "../page";
import { ConfigTray } from "../config/tray";
import { icnsLogoPath, icoLogoPath, logoPath } from "../config/icon";
import { isDev, isMac, isPackaged, shouldEnableDevTools } from "../lib/env";
import { executeHooks } from "../lib/hooks";
import { DevToolsManager } from "../lib/devtools";
import { AppsMain } from "../mapi/app/main";
import { ServerMain } from "../mapi/server/main";
import CryptoManager from "../lib/crypto";
import AntiDebugManager from "../lib/antiDebug";
import { getCommonResourcePath, getModelPath } from "../lib/resource-path";
import { ensurePythonSetup, getMacOSPythonPath } from "../lib/python-setup";
import Store from "../lib/store";
import { checkResourceBundles } from "../mapi/resourceManager";
import { fetchElectronSystemConfig } from "../mapi/systemConfig";

// 窗口状态保存路径
const windowStateFile = () => path.join(app.getPath("userData"), "window-state.json");

// 加载窗口状态
function loadWindowState() {
    try {
        if (fs.existsSync(windowStateFile())) {
            const data = fs.readFileSync(windowStateFile(), "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        Log.error("加载窗口状态失败:", error);
    }
    return null;
}

// 保存窗口状态
function saveWindowState(window: BrowserWindow) {
    try {
        const bounds = window.getBounds();
        const state = {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            isMaximized: window.isMaximized(),
        };
        fs.writeFileSync(windowStateFile(), JSON.stringify(state, null, 2));
    } catch (error) {
        Log.error("保存窗口状态失败:", error);
    }
}

const isDummyNew = isDummy;

// 临时屏蔽防破解，用于调试
// if (process.env["ELECTRON_ENV_PROD"]) {
//     DevToolsManager.setEnable(false);
// }

process.on("uncaughtException", reason => {
    let error: any = reason;
    if (error instanceof Error) {
        error = [error.message, error.stack].join("\n");
    }
    Log.error("UncaughtException", error);
});

process.on("unhandledRejection", reason => {
    Log.error("UnhandledRejection", reason);
    let error: any = reason;
    if (error instanceof Error) {
        error = [error.message, error.stack].join("\n");
    }
    Log.error("UnhandledRejection", error);
});

app.disableHardwareAcceleration();

// 注册自定义协议为特权协议（必须在 app.whenReady() 之前）
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'font',
        privileges: {
            bypassCSP: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

// 🔧 便携版（绿色版）检测和配置
// 便携版应该把数据存储在应用本地目录，而不是 AppData
const isPortable = (() => {
    // 🟢 默认启用便携模式：所有数据存储在安装目录
    console.log('[Portable Detection] 便携模式已默认启用');
    return true;

    /*
    // 原检测逻辑（已禁用）
    try {
        // 方法1: electron-builder 的便携版会设置这个环境变量
        if (process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE) {
            return true;
        }

        // 方法2: 检查可执行文件名是否包含 portable
        if (process.execPath && process.execPath.toLowerCase().includes('portable')) {
            return true;
        }

        // 方法3: 检查应用根目录是否存在 portable.txt 标记文件
        if (process.env.APP_ROOT) {
            const portableMarker = path.join(process.env.APP_ROOT, 'portable.txt');
            if (fs.existsSync(portableMarker)) {
                return true;
            }
        }
    } catch (error) {
        console.error('[Portable Detection] 检测失败:', error);
    }

    return false;
    */
})();

const resolveInstallRoot = () => {
    if (isDev) {
        return process.cwd();
    }
    return path.dirname(process.execPath);
};

const resolveResourceBundleRoot = (installRoot: string) => {
    if (!isDev) {
        const packagedBundleRoot = path.join(process.resourcesPath, 'resources-bundles');
        if (fs.existsSync(packagedBundleRoot)) {
            return packagedBundleRoot;
        }
    }
    return path.join(installRoot, 'resources-bundles');
};

const configurePortablePaths = () => {
    const installRoot = resolveInstallRoot();
    const dataRoot = path.join(installRoot, 'data');
    const userDataRoot = path.join(dataRoot, 'userData');
    const sessionDataRoot = path.join(dataRoot, 'session');
    const cacheRoot = path.join(dataRoot, 'cache');
    const tempRoot = path.join(dataRoot, 'temp');
    const resourceStateRoot = path.join(dataRoot, 'resource-state');
    const resourceBundleRoot = resolveResourceBundleRoot(installRoot);

    for (const dir of [dataRoot, userDataRoot, sessionDataRoot, cacheRoot, tempRoot, resourceStateRoot, resourceBundleRoot]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    AppEnv.installRoot = installRoot;
    AppEnv.dataRoot = dataRoot;
    AppEnv.userData = userDataRoot;
    AppEnv.sessionData = sessionDataRoot;
    AppEnv.cacheRoot = cacheRoot;
    AppEnv.tempRoot = tempRoot;
    AppEnv.resourceStateRoot = resourceStateRoot;
    AppEnv.resourceBundleRoot = resourceBundleRoot;

    app.setPath('userData', userDataRoot);
    app.setPath('sessionData', sessionDataRoot);

    try {
        app.setPath('temp', tempRoot);
    } catch (error) {
        console.warn('[Portable Mode] temp 路径设置失败:', error);
    }

    try {
        app.setPath('cache', cacheRoot);
    } catch (error) {
        console.warn('[Portable Mode] cache 路径设置失败:', error);
    }

    process.env.TMPDIR = tempRoot;
    process.env.TEMP = tempRoot;
    process.env.TMP = tempRoot;
    process.env.PLAYWRIGHT_BROWSERS_PATH = resourceBundleRoot;

    console.log('[Portable Mode] 🟢 便携版模式已启用');
    console.log('[Portable Mode] 安装目录:', installRoot);
    console.log('[Portable Mode] 用户数据目录:', userDataRoot);
    console.log('[Portable Mode] 资源目录:', resourceBundleRoot);
};

if (isPortable) {
    try {
        configurePortablePaths();
    } catch (error) {
        console.error('[Portable Mode] 设置失败:', error);
    }
}

// Scope the instance lock to this portable installation's userData directory.
// Independently extracted copies must not exit because another installation is open.
if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

const hasSplashWindow = false;

// 🔧 初始化 AppEnv - 确保所有路径都有效（支持中文路径）
try {
    // 多重降级方案确保 appRoot 总是有效
    let appRoot = process.env.APP_ROOT;

    if (!appRoot || typeof appRoot !== 'string') {
        // 🔧 修复：process.resourcesPath 是 resources 目录本身
        // 如果 AppEnv.appRoot 意为应用根目录（包含 resources 的目录），则需要取父目录
        appRoot = path.dirname(process.resourcesPath);
        console.log('[AppEnv] 使用 resourcesPath 的父目录:', appRoot);
    }

    if (!appRoot || typeof appRoot !== 'string') {
        appRoot = app.getAppPath();
        console.log('[AppEnv] 使用 getAppPath:', appRoot);
    }

    if (!appRoot || typeof appRoot !== 'string') {
        // 最终降级：使用可执行文件目录
        appRoot = path.dirname(process.execPath);
        console.log('[AppEnv] 使用 execPath dirname:', appRoot);
    }

    AppEnv.appRoot = appRoot;
    console.log('[AppEnv] ✅ appRoot 已设置:', AppEnv.appRoot);

} catch (error) {
    console.error('[AppEnv] 设置 appRoot 失败:', error);
    AppEnv.appRoot = path.dirname(process.execPath);
}

try {
    AppEnv.appData = app.getPath("appData");
    AppEnv.userData = AppEnv.userData || app.getPath("userData");
    AppEnv.sessionData = AppEnv.sessionData || app.getPath("sessionData");

    console.log('[AppEnv] ✅ userData 已设置:', AppEnv.userData);

    if (!AppEnv.installRoot) {
        AppEnv.installRoot = resolveInstallRoot();
    }

    if (!AppEnv.dataRoot) {
        if (AppEnv.userData && typeof AppEnv.userData === 'string') {
            if (AppEnv.userData.endsWith('/userData') || AppEnv.userData.endsWith('\\userData')) {
                AppEnv.dataRoot = path.dirname(AppEnv.userData);
            } else if (AppEnv.userData.endsWith('/data') || AppEnv.userData.endsWith('\\data')) {
                AppEnv.dataRoot = AppEnv.userData;
            } else {
                AppEnv.dataRoot = path.join(AppEnv.userData, "data");
            }
        } else {
            AppEnv.dataRoot = path.join(app.getPath("temp"), "zhenqianba-data");
            console.warn('[AppEnv] userData 不可用，使用临时目录:', AppEnv.dataRoot);
        }
    }

    AppEnv.cacheRoot = AppEnv.cacheRoot || path.join(AppEnv.dataRoot, 'cache');
    AppEnv.tempRoot = AppEnv.tempRoot || path.join(AppEnv.dataRoot, 'temp');
    AppEnv.resourceStateRoot = AppEnv.resourceStateRoot || path.join(AppEnv.dataRoot, 'resource-state');
    AppEnv.resourceBundleRoot = AppEnv.resourceBundleRoot || resolveResourceBundleRoot(AppEnv.installRoot);

    console.log('[AppEnv] ✅ dataRoot 已设置:', AppEnv.dataRoot);

} catch (error) {
    console.error('[AppEnv] 设置路径失败:', error);
    throw error;
}

for (const dir of [
    AppEnv.dataRoot,
    path.join(AppEnv.dataRoot, "logs"),
    path.join(AppEnv.dataRoot, "storage"),
    AppEnv.cacheRoot,
    AppEnv.tempRoot,
    AppEnv.resourceStateRoot,
    AppEnv.resourceBundleRoot,
    AppEnv.sessionData,
]) {
    if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

if (isPackaged) {
    checkResourceBundles({ installMissing: true }).then((result) => {
        if (result.pending.length > 0) {
            Log.warn('[ResourceManager] bundles pending', result.pending);
        }
        if (result.installed.length > 0) {
            Log.info('[ResourceManager] bundles installed', result.installed);
        }
        if (result.missingRequired.length > 0) {
            Log.warn('[ResourceManager] required bundles missing', result.missingRequired);
        }
    }).catch((error) => {
        Log.warn('[ResourceManager] initial check failed', error);
    });
}

AppEnv.isInit = true;

// 🔧 设置 U2NET_HOME 环境变量，指向打包的模型目录
// ⚠️ 只使用程序自带的 U2-Net 模型，不依赖用户目录下载
const modelsPath = getModelPath('u2net.onnx');
process.env.U2NET_HOME = path.dirname(modelsPath);
Log.info("U2NET_HOME 设置完成", { U2NET_HOME: process.env.U2NET_HOME });

ConfigContextMenu.init();

Log.info("Starting");
Log.info("LaunchInfo", {
    isPackaged,
    userData: AppEnv.userData,
    dataRoot: AppEnv.dataRoot,
});

async function createWindow() {
    let icon = logoPath;
    if (process.platform === "win32") {
        icon = icoLogoPath;
    } else if (process.platform === "darwin") {
        icon = icnsLogoPath;
    }
    if (hasSplashWindow) {
        AppRuntime.splashWindow = new BrowserWindow({
            title: AppConfig.title,
            width: 600,
            height: 350,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            hasShadow: true,
            skipTaskbar: true,
        });
        rendererLoadPath(AppRuntime.splashWindow, "splash.html");
    }

    // 加载保存的窗口状态
    const savedState = loadWindowState();
    const windowOptions: any = {
        show: !hasSplashWindow,
        title: AppConfig.title,
        ...(!isPackaged ? { icon } : {}),
        frame: false,
        transparent: false,
        hasShadow: true,
        center: !savedState, // 如果有保存的状态，不居中
        minWidth: WindowConfig.minWidth,
        minHeight: WindowConfig.minHeight,
        width: savedState?.width || WindowConfig.initWidth,
        height: savedState?.height || WindowConfig.initHeight,
        backgroundColor: await AppsMain.defaultDarkModeBackgroundColor(),
        titleBarStyle: "hidden",
        trafficLightPosition: { x: 10, y: 11 },
        webPreferences: {
            preload: preloadDefault,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            contextIsolation: false,
            // sandbox: false,
        },
    };

    // 如果有保存的位置，设置窗口位置
    if (savedState?.x !== undefined && savedState?.y !== undefined) {
        windowOptions.x = savedState.x;
        windowOptions.y = savedState.y;
    }

    AppRuntime.mainWindow = new BrowserWindow(windowOptions);
    setUpdaterWindow(AppRuntime.mainWindow);

    // 如果之前是最大化状态，恢复最大化
    if (savedState?.isMaximized) {
        AppRuntime.mainWindow.maximize();
    }

    // 监听窗口大小和位置变化，保存状态
    let saveTimeout: NodeJS.Timeout | null = null;
    const scheduleSave = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            if (AppRuntime.mainWindow && !AppRuntime.mainWindow.isDestroyed()) {
                saveWindowState(AppRuntime.mainWindow);
            }
        }, 500); // 延迟500ms保存，避免频繁写入
    };

    AppRuntime.mainWindow.on("resize", scheduleSave);
    AppRuntime.mainWindow.on("move", scheduleSave);
    AppRuntime.mainWindow.on("maximize", scheduleSave);
    AppRuntime.mainWindow.on("unmaximize", scheduleSave);

    AppRuntime.mainWindow.on("closed", () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        AppRuntime.mainWindow = null;
    });
    AppRuntime.mainWindow.on("show", async () => {
        await executeHooks(AppRuntime.mainWindow, "Show");
    });
    AppRuntime.mainWindow.on("hide", async () => {
        await executeHooks(AppRuntime.mainWindow, "Hide");
    });

    if (isMac) {
        AppRuntime.mainWindow.on("close", event => {
            // @ts-ignore
            if (!app.quitForce && !isDev) {
                executeHooks(AppRuntime.mainWindow, "ShowQuitConfirmDialog");
                event.preventDefault();
            }
        });
    }
    AppRuntime.mainWindow.on("enter-full-screen", () => {
        executeHooks(AppRuntime.mainWindow, "EnterFullScreen");
    });
    AppRuntime.mainWindow.on("leave-full-screen", () => {
        executeHooks(AppRuntime.mainWindow, "LeaveFullScreen");
    });

    rendererLoadPath(AppRuntime.mainWindow, "index.html");
    DevToolsManager.register("Main", AppRuntime.mainWindow);

    // Source downloads can open the workspace before optional media runtimes are installed.
    if (process.env.IPBOT_MISSING_RUNTIME) {
        let missing: string[] = [];
        try { missing = JSON.parse(process.env.IPBOT_MISSING_RUNTIME); } catch {}
        delete process.env.IPBOT_MISSING_RUNTIME;
        if (Array.isArray(missing) && missing.length) {
            AppRuntime.mainWindow.webContents.once('did-finish-load', () => {
                void dialog.showMessageBox(AppRuntime.mainWindow!, {
                    type: 'warning',
                    title: '运行资源尚未准备完整',
                    message: '桌面界面可以使用，部分媒体生成功能暂不可用。',
                    detail: `缺少：${missing.join('、')}。\n\n源码包不包含完整媒体运行环境或数字人模型。请按安装教程准备资源，再重启桌面端。`,
                    buttons: ['继续使用界面', '查看安装教程'],
                    defaultId: 0,
                    cancelId: 0,
                }).then(result => {
                    if (result.response === 1) void shell.openExternal('https://github.com/pyqdcyy123-byte/ip-bot/blob/main/docs/INSTALL.md');
                });
            });
        }
    }

    AppRuntime.mainWindow.webContents.on("did-finish-load", async () => {
        try {
            const mapiCheck = await AppRuntime.mainWindow!.webContents.executeJavaScript(
                `JSON.stringify({ hasMapi: !!window['$mapi'], hasIpcRenderer: !!window['ipcRenderer'], hasPage: !!window['__page'], windowDollarKeys: Object.keys(window).filter(k => k.startsWith('$')) })`
            );
            console.log('[Main:did-finish-load] preload检查:', mapiCheck);
        } catch(e: any) {
            console.error('[Main:did-finish-load] preload检查失败:', e.message);
        }
        if (hasSplashWindow) {
            AppRuntime.mainWindow?.show();
            setTimeout(() => {
                try {
                    AppRuntime.splashWindow?.close();
                    AppRuntime.splashWindow = null;
                    // AppRuntime.mainWindow.webContents.openDevTools({
                    //     mode: 'detach',
                    // })
                } catch (e) { }
            }, 1000);
        }
        // 🔧 延迟调用 Page.ready，直到 MAPI 初始化完成
        // 等待 MAPI.init() 完成再通知前端
        console.log('[Main:did-finish-load] 页面加载完成，等待 MAPI 初始化...');

        // 给 MAPI 初始化一个机会完成
        // 如果 MAPI 已经初始化，这会立即执行
        // 否则等待最多 5 秒钟
        let mapiInitCheck = 0;
        const mapiCheckInterval = setInterval(() => {
            mapiInitCheck++;
            if (AppRuntime.mapiInitialized || mapiInitCheck > 50) { // 5 秒超时
                clearInterval(mapiCheckInterval);
                if (!AppRuntime.mapiInitialized) {
                    console.warn('[Main:did-finish-load] ⚠️ MAPI 初始化超时，但继续启动页面');
                }
                console.log('[Main:did-finish-load] 调用 Page.ready("main")');
                Page.ready("main");
                DevToolsManager.autoShow(AppRuntime.mainWindow);

                if (isPackaged) {
                    setTimeout(async () => {
                        try {
                            const checkAtLaunch = ConfigMain.get("updaterCheckAtLaunch", "yes");
                            console.log('[Main] auto check update, setting:', checkAtLaunch);
                            if (checkAtLaunch !== "no") {
                                await updaterIndex.checkForUpdate();
                            }
                        } catch (e: any) {
                            console.error('[Main] auto check update failed:', e.message);
                        }
                    }, 8000);
                }
            }
        }, 100);

        // 🔐 启用防破解保护（生产环境且非调试模式时强制启用）
        if (!shouldEnableDevTools || process.env.ELECTRON_ENABLE_ANTI_DEBUG === 'true') {
            console.log('[Main] 启用防破解保护...');
            AntiDebugManager.enableFullProtection(AppRuntime.mainWindow, {
                disableDevTools: true,
                disableShortcuts: true,
                disableContextMenu: true,
                disableMenuBar: false, // 调试模式保留菜单栏
                interceptHotkeys: true
            });
        } else {
            console.log('[Main] 调试模式：防破解保护已禁用');
            console.log('[Main] 提示：生产环境中设置环境变量 ELECTRON_DEBUG_MODE=true 可启用DevTools');
        }

        // 🆕 隐藏调试快捷键 Ctrl+Shift+Alt+D（即使在生产环境也能启用DevTools）
        globalShortcut.register('Ctrl+Shift+Alt+D', () => {
            console.log('[Main] 隐藏调试快捷键触发');
            if (AppRuntime.mainWindow && !AppRuntime.mainWindow.webContents.isDevToolsOpened()) {
                // 使用 AntiDebugManager 的 restoreDevTools 方法，绕过防护
                AntiDebugManager.restoreDevTools(AppRuntime.mainWindow);
                console.log('[Main] ✅ DevTools 已通过隐藏快捷键打开');
            } else {
                AppRuntime.mainWindow?.webContents.closeDevTools();
                console.log('[Main] DevTools 已关闭');
            }
        });
    });
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady()
    .then(() => {
        // 注册自定义 font:// 协议
        protocol.registerFileProtocol('font', (request, callback) => {
            try {
                // 从 URL 中提取文件路径
                // font://path/to/font.ttf -> path/to/font.ttf
                const url = request.url.substring(7); // 移除 'font://'
                const fontPath = decodeURIComponent(url);

                Log.info('[FontProtocol] Loading font:', fontPath);

                // 验证文件存在
                if (!fs.existsSync(fontPath)) {
                    Log.error('[FontProtocol] Font file not found:', fontPath);
                    callback({ error: -6 }); // FILE_NOT_FOUND
                    return;
                }

                // 返回文件路径
                callback({ path: fontPath });
            } catch (error) {
                Log.error('[FontProtocol] Error loading font:', error);
                callback({ error: -2 }); // FAILED
            }
        });

        session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
            desktopCapturer.getSources({ types: ["screen"] }).then(sources => {
                // Grant access to the first screen found.
                callback({ video: sources[0], audio: "loopback" });
            });
        });
    })
    .then(ConfigLang.readyAsync)
    .then(async () => {
        // 初始化加密管理器
        try {
            console.log("[Main:init] 初始化加密管理器...");
            await CryptoManager.initializeKeys();
            console.log("[Main:init] ✅ 加密管理器初始化完成");
        } catch (error) {
            console.error("[Main:init] 加密管理器初始化失败:", error);
            Log.error("加密管理器初始化失败:", error);
        }

        // 在创建窗口前先初始化MAPI（包括数据库）
        try {
            console.log("[Main:init] Starting MAPI initialization");
            console.log("[Main:init] AppEnv.isInit =", AppEnv.isInit);
            console.log("[Main:init] AppEnv.dataRoot =", AppEnv.dataRoot);
            console.log("[Main:init] AppEnv.userData =", AppEnv.userData);

            await MAPI.init();

            console.log("[Main:init] MAPI initialized successfully");
            Log.info("MAPI initialized successfully");

            // 🔧 标记 MAPI 已初始化，前端可以开始使用 API
            AppRuntime.mapiInitialized = true;
            console.log('[Main:init] 设置 AppRuntime.mapiInitialized = true');

            // 初始化系统默认模板
            console.log("[Main:init] Initializing system templates...");
            await initSystemTemplates();
            console.log("[Main:init] System templates initialized");

            console.log("[Main:init] Initializing builtin avatars...");
            await initBuiltinAvatars();
            console.log("[Main:init] Builtin avatars initialized");

            // 初始化应用配置（字幕模板等）
            console.log("[Main:init] Initializing app config...");
            await initAppConfig();
            console.log("[Main:init] App config initialized");

            console.log("[Main:init] Pre-fetching system config...");
            try {
                await fetchElectronSystemConfig();
                console.log("[Main:init] System config fetched");
            } catch(e: any) {
                console.warn("[Main:init] System config fetch failed:", e.message);
            }

            console.log("[Main:init] Initializing voice preview cache...");
            await initVoicePreCache();
            console.log("[Main:init] Voice preview cache initialized");

            if (process.platform !== 'win32') {
                console.log("[Main:init] Starting macOS/Linux Python setup (background)...");
                ensurePythonSetup().then((pythonPath) => {
                    if (pythonPath) {
                        console.log("[Main:init] ✅ Python setup complete:", pythonPath);
                    } else {
                        console.warn("[Main:init] Python setup returned null");
                    }
                }).catch((err) => {
                    console.warn("[Main:init] Python setup failed (non-fatal):", err.message);
                });
            }
        } catch (error) {
            console.error("[Main:init] MAPI initialization error:", error);
            Log.error("MAPI initialization failed:", error);
            // 🔧 即使失败也标记为已尝试初始化，允许前端继续（为了诊断）
            AppRuntime.mapiInitialized = true;
            // 不抛出错误，允许应用继续（为了诊断）
        }
    })
    .then(() => {
        MAPI.ready();
        ConfigMenu.ready();
        ConfigTray.ready();

        // 🔐 加密相关 IPC 处理器
        ipcMain.handle("Crypto:getPublicKey", () => {
            try {
                return { success: true, publicKey: CryptoManager.getPublicKey() };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:encryptRSA", (event, data: string) => {
            try {
                return { success: true, encrypted: CryptoManager.encryptRSA(data) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:decryptRSA", (event, encryptedData: string) => {
            try {
                return { success: true, decrypted: CryptoManager.decryptRSA(encryptedData) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:encryptAES", (event, data: string, key: string) => {
            try {
                return { success: true, encrypted: CryptoManager.encryptAES(data, key) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:decryptAES", (event, encryptedData: string, key: string) => {
            try {
                return { success: true, decrypted: CryptoManager.decryptAES(encryptedData, key) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:sha256", (event, data: string) => {
            try {
                return { success: true, hash: CryptoManager.sha256(data) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:generateRandomKey", (event, length: number = 32) => {
            try {
                return { success: true, key: CryptoManager.generateRandomKey(length) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:sign", (event, data: string) => {
            try {
                return { success: true, signature: CryptoManager.sign(data) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle("Crypto:verify", (event, data: string, signature: string) => {
            try {
                return { success: true, valid: CryptoManager.verify(data, signature) };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        });

        // 🔧 System 相关 IPC 处理器 - 获取硬件信息用于设备指纹
        const execAsync = promisify(execCallback);

        ipcMain.handle("System:getSystemInfo", async () => {
            try {
                console.log('[System:getSystemInfo] IPC 被调用');

                // 获取磁盘序列号（Windows）
                let diskSerial = 'unknown';
                try {
                    if (process.platform === 'win32') {
                        console.log('[System:getSystemInfo] 执行 wmic diskdrive 命令...');
                        const { stdout } = await execAsync('wmic diskdrive get SerialNumber');
                        console.log('[System:getSystemInfo] wmic 输出:', stdout);
                        const lines = stdout.trim().split('\n');
                        if (lines.length > 1) {
                            diskSerial = lines[1].trim();
                            console.log('[System:getSystemInfo] 获得的 diskSerial:', diskSerial);
                        }
                    } else if (process.platform === 'darwin') {
                        const { stdout } = await execAsync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformSerialNumber');
                        const match = stdout.match(/"IOPlatformSerialNumber"\s*=\s*"([^"]+)"/);
                        if (match) {
                            diskSerial = match[1];
                        }
                    }
                } catch (e) {
                    console.warn('[System:getSystemInfo] 获取磁盘序列号失败:', e);
                    Log.warn('[System:getSystemInfo] 获取磁盘序列号失败:', e);
                }

                const systemInfo = {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    arch: os.arch(),
                    cpuModel: os.cpus()[0]?.model || 'unknown',
                    diskSerial
                };

                console.log('[System:getSystemInfo] 返回系统信息:', systemInfo);
                return systemInfo;
            } catch (error: any) {
                console.error("[System:getSystemInfo] 失败:", error);
                Log.error("[System:getSystemInfo] 失败:", error);
                return null;
            }
        });

        ipcMain.handle("System:getHardwareSerial", async () => {
            try {
                console.log('[System:getHardwareSerial] IPC 被调用');

                const hardwareSerial: any = {
                    motherboard: 'unknown',
                    bios: 'unknown'
                };

                if (process.platform === 'win32') {
                    // 获取主板序列号
                    try {
                        console.log('[System:getHardwareSerial] 执行 wmic baseboard 命令...');
                        const { stdout: mbStdout } = await execAsync('wmic baseboard get SerialNumber');
                        console.log('[System:getHardwareSerial] baseboard 输出:', mbStdout);
                        const mbLines = mbStdout.trim().split('\n');
                        if (mbLines.length > 1) {
                            hardwareSerial.motherboard = mbLines[1].trim();
                        }
                    } catch (e) {
                        console.warn('[System:getHardwareSerial] 获取主板序列号失败:', e);
                        Log.warn('[System:getHardwareSerial] 获取主板序列号失败:', e);
                    }

                    // 获取BIOS序列号
                    try {
                        console.log('[System:getHardwareSerial] 执行 wmic bios 命令...');
                        const { stdout: biosStdout } = await execAsync('wmic bios get SerialNumber');
                        console.log('[System:getHardwareSerial] bios 输出:', biosStdout);
                        const biosLines = biosStdout.trim().split('\n');
                        if (biosLines.length > 1) {
                            hardwareSerial.bios = biosLines[1].trim();
                        }
                    } catch (e) {
                        console.warn('[System:getHardwareSerial] 获取BIOS序列号失败:', e);
                        Log.warn('[System:getHardwareSerial] 获取BIOS序列号失败:', e);
                    }
                } else if (process.platform === 'darwin') {
                    try {
                        const { stdout } = await execAsync('ioreg -rd1 -c IOPlatformExpertDevice');
                        const serialMatch = stdout.match(/"IOPlatformSerialNumber"\s*=\s*"([^"]+)"/);
                        if (serialMatch) {
                            hardwareSerial.motherboard = serialMatch[1];
                            hardwareSerial.bios = serialMatch[1];
                        }
                    } catch (e) {
                        console.warn('[System:getHardwareSerial] macOS 获取序列号失败:', e);
                    }
                }

                console.log('[System:getHardwareSerial] 返回硬件序列号:', hardwareSerial);
                return hardwareSerial;
            } catch (error: any) {
                console.error("[System:getHardwareSerial] 失败:", error);
                Log.error("[System:getHardwareSerial] 失败:", error);
                return null;
            }
        });


        // 🔧 IPC处理器：杀死模型进程
        ipcMain.handle("killAllModelProcesses", async (event, data: any) => {
            try {
                let enableGpuCleanup = false;
                try {
                    const raw = ConfigMain.getSync('ipAgentSettings');
                    if (raw) {
                        const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
                        enableGpuCleanup = !!s.enableGpuCleanup;
                    }
                } catch {}
                if (!enableGpuCleanup) {
                    Log.info("[IPC] 本地模型进程优化未开启，跳过进程清理");
                    return { success: true, message: "未开启，跳过" };
                }

                const isWin = process.platform === 'win32';
                const defaultProcs = isWin
                    ? ["launcher.exe", "python.exe", "ffmpeg.exe", "ffprobe.exe"]
                    : ["python3", "ffmpeg", "ffprobe"];
                const processes = data?.processes || defaultProcs;
                const protectedCommands = ['api_server.py', 'LstmSync'];

                Log.info(`[IPC] 开始杀死进程: ${processes.join(", ")}`);

                for (const proc of processes) {
                    try {
                        if (isWin) {
                            if (proc === 'python.exe') {
                                const output = execSync(`powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = '${proc}'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`, {
                                    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore']
                                });
                                let procs = [];
                                try { procs = JSON.parse(output); if (!Array.isArray(procs)) procs = [procs]; } catch { procs = []; }
                                for (const p of procs) {
                                    if (!p || !p.ProcessId) continue;
                                    const cmd = (p.CommandLine || '').toLowerCase();
                                    if (protectedCommands.some(kw => cmd.includes(kw.toLowerCase()))) {
                                        Log.info(`[IPC] 🛡️ 跳过保护进程 PID ${p.ProcessId}: ${cmd.substring(0, 100)}`);
                                        continue;
                                    }
                                    try {
                                        execSync(`taskkill /f /pid ${p.ProcessId} /t`, { stdio: 'ignore', shell: 'cmd.exe' });
                                        Log.info(`[IPC] ✓ 已杀死: ${proc} PID ${p.ProcessId}`);
                                    } catch {}
                                }
                            } else {
                                execSync(`taskkill /f /im ${proc} /t`, { stdio: 'ignore', shell: 'cmd.exe' });
                                Log.info(`[IPC] ✓ 已杀死: ${proc}`);
                            }
                        } else {
                            execSync(`pkill -f "${proc}" 2>/dev/null || true`, { stdio: 'ignore', shell: '/bin/bash' });
                            Log.info(`[IPC] ✓ 已杀死: ${proc}`);
                        }
                    } catch (err: any) {
                        Log.debug(`[IPC] ${proc} 不存在或已关闭`);
                    }
                }

                Log.info("[IPC] ✓ 进程清理完成");
                return { success: true, message: "进程已杀死" };
            } catch (error: any) {
                Log.error("[IPC] 杀死进程失败:", error.message);
                return { success: false, error: error.message };
            }
        });

        // 🔧 IPC处理器：手动触发GPU清理（用于测试）
        ipcMain.handle("testGPUCleanup", async (event) => {
            try {
                console.log("[TestGPUCleanup] ========== 手动触发GPU清理 ==========");

                // 检查 GPU 进程
                let gpuProcs = '';
                try {
                    gpuProcs = execSync(`nvidia-smi --query-compute-apps=pid --format=csv,noheader`, {
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'ignore']
                    }).trim();
                    console.log(`[TestGPUCleanup] GPU 进程: ${gpuProcs}`);
                } catch (e) {
                    console.log(`[TestGPUCleanup] 没有GPU进程或nvidia-smi失败`);
                }

                if (gpuProcs) {
                    const pidLines = gpuProcs.split('\n');
                    const pids = pidLines.map(p => p.trim()).filter(p => p && !isNaN(Number(p)));

                    console.log(`[TestGPUCleanup] 找到 ${pids.length} 个GPU进程`);

                    const targetServers = ['indextts', 'heygem'];
                    const targetPids: string[] = [];

                    for (const pid of pids) {
                        try {
                            const cmdline = execSync(
                                `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object -ExpandProperty CommandLine"`,
                                { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
                            ).toLowerCase();

                            if (targetServers.some(server => cmdline.includes(server))) {
                                console.log(`[TestGPUCleanup] 🎯 发现目标进程 PID ${pid}`);
                                targetPids.push(pid);
                            }
                        } catch (e) {
                            console.log(`[TestGPUCleanup] 检查PID ${pid} 失败`);
                        }
                    }

                    if (targetPids.length > 0) {
                        const pidList = targetPids.join(',');
                        console.log(`[TestGPUCleanup] 🔨 清理 ${targetPids.length} 个进程: ${pidList}`);

                        execSync(
                            `powershell -Command "Stop-Process -Id ${pidList} -Force -ErrorAction SilentlyContinue"`,
                            { stdio: 'ignore' }
                        );

                        console.log(`[TestGPUCleanup] ✓ 已清理 ${targetPids.length} 个进程`);
                    }
                }

                // 调用清理脚本
                try {
                    const appRoot = process.env.APP_ROOT;
                    if (appRoot) {
                        const cleanupScript = path.join(appRoot, 'scripts', 'cleanup_gpu.py');
                        if (fs.existsSync(cleanupScript)) {
                            const pythonExe = process.platform === 'win32' ? 'python.exe' : 'python3';
                            const pythonPath = path.join(getCommonResourcePath('python'), pythonExe);
                            if (fs.existsSync(pythonPath)) {
                                const result = execSync(`"${pythonPath}" "${cleanupScript}"`, {
                                    encoding: 'utf-8',
                                    timeout: 10000,
                                    stdio: ['pipe', 'pipe', 'ignore']
                                });
                                console.log(`[TestGPUCleanup] ✓ GPU显存清理完成`);
                                if (result) {
                                    console.log(`[cleanup_gpu.py] ${result}`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[TestGPUCleanup] GPU清理脚本失败: ${e}`);
                }

                console.log("[TestGPUCleanup] ========== GPU清理完成 ==========");
                return { success: true, message: "GPU清理完成，请查看控制台输出" };
            } catch (error: any) {
                console.error("[TestGPUCleanup] 错误:", error);
                return { success: false, error: error.message };
            }
        });

        // 添加智能体登录窗口打开处理器
        ipcMain.handle("Agent.OpenLoginWindow", async (event, options) => {
            try {
                const region = options.region || '07';

                await Page.open("agentLogin", {
                    region: region,
                    onGetQRCode: async (region: string) => {
                        // 这里调用智能体登录二维码生成
                        const result = await MAPI.invoke("Agent.Login", "getQRCode", { region });
                        return result;
                    },
                    onCheckStatus: async (region: string) => {
                        // 这里检查登录状态
                        const result = await MAPI.invoke("Agent.Login", "checkStatus", { region });
                        return result;
                    },
                    onClose: () => {
                        console.log("智能体登录窗口已关闭");
                    }
                });

                return { success: true };
            } catch (error) {
                Log.error("打开智能体登录窗口失败:", error);
                return { success: false, error: error.message };
            }
        });

        app.on("browser-window-created", (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });
        createWindow().then();
    });

// 标记应用是否正在退出
let isQuitting = false;

app.on("before-quit", async (event) => {
    // 更新时立即退出，不执行清理（清理已在 quitAndInstall 中完成）
    if ((global as any).__isUpdating) {
        console.log("[AppShutdown] 更新模式，跳过清理，立即退出");
        Log.info("[AppShutdown] 更新模式，跳过清理，立即退出");
        return;
    }

    // 防止多次触发
    if (!isQuitting) {
        event.preventDefault();
        isQuitting = true;

        console.log("[AppShutdown] 应用关闭，开始清理资源...");
        Log.info("[AppShutdown] 应用关闭，开始清理资源...");

        // 设置清理超时（最多8秒，给安装程序留缓冲时间）
        const cleanupTimeout = setTimeout(() => {
            console.log("[AppShutdown] ⚠️ 清理超时，强制退出");
            Log.info("[AppShutdown] 清理超时，强制退出");
            process.exit(0);
        }, 8000);

        try {
            // 1. 停止所有运行中的服务器（最多3秒）
            console.log("[AppShutdown] 停止所有服务器...");
            await Promise.race([
                ServerMain.stopAllServers(),
                new Promise(resolve => setTimeout(resolve, 3000))
            ]);
            console.log("[AppShutdown] ✓ 服务器已停止");

            // 2. 杀死残留的模型进程（Windows）- 总是清理，确保更新/卸载时干净
            if (process.platform === "win32") {
                const processesToKill = ["launcher.exe", "python.exe", "ffmpeg.exe", "ffprobe.exe"];
                const protectedCommands = ['api_server.py', 'LstmSync'];
                console.log("[AppShutdown] 清理残留进程...");

                for (const proc of processesToKill) {
                    try {
                        if (proc === 'python.exe') {
                            // 使用超时保护，避免 PowerShell 查询卡住
                            const output = execSync(`powershell -Command "$ErrorActionPreference='SilentlyContinue'; Get-CimInstance Win32_Process -Filter \\"Name = '${proc}'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`, {
                                encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000
                            });
                            let procs = [];
                            try { procs = JSON.parse(output); if (!Array.isArray(procs)) procs = [procs]; } catch { procs = []; }
                            for (const p of procs) {
                                if (!p || !p.ProcessId) continue;
                                const cmd = (p.CommandLine || '').toLowerCase();
                                if (protectedCommands.some(kw => cmd.includes(kw.toLowerCase()))) {
                                    console.log(`[AppShutdown] 🛡️ 跳过保护进程 PID ${p.ProcessId}`);
                                    continue;
                                }
                                try {
                                    execSync(`taskkill /f /pid ${p.ProcessId} /t`, { stdio: 'ignore', shell: 'cmd.exe', timeout: 1000 });
                                    console.log(`[AppShutdown] ✓ 已杀死: ${proc} PID ${p.ProcessId}`);
                                } catch {}
                            }
                        } else {
                            execSync(`taskkill /f /im ${proc} /t`, { stdio: 'ignore', shell: 'cmd.exe', timeout: 1000 });
                            console.log(`[AppShutdown] ✓ 已杀死: ${proc}`);
                        }
                    } catch (err: any) {
                    }
                }
                console.log("[AppShutdown] ✓ 残留进程清理完成");
            }
        } catch (error) {
            console.error("[AppShutdown] 清理过程出错:", error);
            Log.error("[AppShutdown] 清理过程出错:", error);
        } finally {
            clearTimeout(cleanupTimeout);
        }

        console.log("[AppShutdown] ✓ 资源清理完成，退出应用");
        Log.info("[AppShutdown] ✓ 资源清理完成，退出应用");

        // 退出应用
        app.quit();
    }
});

app.on("will-quit", () => {
    // 应用即将退出，不执行清理操作
    // 操作系统会自动回收所有资源
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
    if (AppRuntime.mainWindow) {
        if (AppRuntime.mainWindow.isMinimized()) {
            AppRuntime.mainWindow.restore();
        }
        AppRuntime.mainWindow.show();
        AppRuntime.mainWindow.focus();
    }
});

app.on("activate", () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        if (!AppRuntime.mainWindow.isVisible()) {
            AppRuntime.mainWindow.show();
        }
        AppRuntime.mainWindow.focus();
    } else {
        createWindow().then();
    }
});
