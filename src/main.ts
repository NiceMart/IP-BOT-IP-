import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import ArcoVue, { Message } from "@arco-design/web-vue";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";
import "@arco-design/web-vue/dist/arco.css";

import { enUS, zhCN } from "date-fns/locale";
import timeago from "vue-timeago3";

import { i18n, t } from "./lang";

import "./style.less";
import "./assets/styles/studio-system.css";
import "./assets/styles/apple-system.css";
import { Dialog } from "./lib/dialog";

import { CommonComponents } from "./components/common";
import { useSettingStore } from "./store/modules/setting";
import { useTaskStore } from "./store/modules/task";

import { TaskManager } from "./task";

// 🔧 性能优化：预加载关键资源
const preloadResources = () => {
    // 预加载 logo 图片
    const logoImg = new Image();
    logoImg.src = '/logo.svg';

    // 预加载关键字体
    if (document.fonts) {
        document.fonts.ready.then(() => {
            console.log('[Performance] 字体加载完成');
        });
    }
};

// 🔧 性能优化：启动时预加载
if (document.readyState === 'complete') {
    preloadResources();
} else {
    window.addEventListener('load', preloadResources, { once: true });
}

const MAIN_VERBOSE_LOGS = false;
const DEV_NOISY_CONSOLE_PREFIXES = [
    "[main.ts]",
    "[TaskManager.init]",
    "[TaskStore]",
    "[TaskStore.init]",
    "[ipcSubtitleListener]",
    "[ipAgent:performSubtitleGeneration]",
    "[useDevMode]",
    "[serverCloud.init]",
    "[VideoIPAgent setup]",
    "[saveWorkData]",
    "[loadWorkData]",
    "[initializeKeywordGroups]",
    "[initializeKeywordGroupsAsync]",
    "[getGroupKeywords]",
    "[keywordGroupsForSVG]",
    "[onMounted]",
    "[onMounted.background]",
    "[resumeTaskPolling]",
    "[setupSubtitleGenerationListener]",
    "[setupAsrRecognizeListener]",
    "[CRITICAL]",
    "[ServerSelector]",
    "[keywordGroup:getAllKeywordGroups]",
    "[数据迁移]",
    "💡 提示：",
    "💡 或者直接输入:",
    "恢复上次生成的语音:",
    "恢复上次的文案:",
];

if (import.meta.env.DEV && !MAIN_VERBOSE_LOGS) {
    const originalLog = console.log.bind(console);
    const originalWarn = console.warn.bind(console);
    const shouldSilence = (args: any[]) => {
        const first = args[0];
        return typeof first === "string" && DEV_NOISY_CONSOLE_PREFIXES.some(prefix => first.startsWith(prefix));
    };

    console.log = (...args: any[]) => {
        if (shouldSilence(args)) return;
        originalLog(...args);
    };

    console.warn = (...args: any[]) => {
        if (shouldSilence(args)) return;
        originalWarn(...args);
    };
}

function writeDevRendererSnapshot(stage: string) {
    if (!import.meta.env.DEV) {
        return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
        return;
    }
    if (!(window as any).require) {
        return;
    }

    try {
        const fs = (window as any).require("fs");
        const path = (window as any).require("path");
        const tempDir = process.env.TEMP || "C:\\Windows\\Temp";
        const selectors = [
            "body",
            "#app",
            ".window-container",
            ".window-header",
            ".window-body",
            ".page-container",
            ".video-page-container",
            ".video-ip-agent-shell",
        ];
        const readElement = (selector: string) => {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) {
                return null;
            }
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
                selector,
                className: el.className || "",
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                position: style.position,
                zIndex: style.zIndex,
                overflow: style.overflow,
                color: style.color,
                background: style.background,
                transform: style.transform,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                textSample: (el.textContent || "").trim().slice(0, 120),
            };
        };
        const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) as HTMLElement | null;
        const centerStyle = centerEl ? window.getComputedStyle(centerEl) : null;
        const payload = {
            stage,
            href: location.href,
            theme: document.body.getAttribute("data-theme"),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
            selectors: selectors.map(readElement),
            centerElement: centerEl ? {
                tag: centerEl.tagName,
                className: centerEl.className || "",
                textSample: (centerEl.textContent || "").trim().slice(0, 120),
                color: centerStyle?.color || "",
                background: centerStyle?.background || "",
                display: centerStyle?.display || "",
                visibility: centerStyle?.visibility || "",
                opacity: centerStyle?.opacity || "",
                position: centerStyle?.position || "",
                zIndex: centerStyle?.zIndex || "",
            } : null,
        };
        const snapshotPath = path.join(tempDir, "aigcpanel-renderer-live-snapshot.json");
        fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
        console.log("[main.ts] renderer snapshot written:", snapshotPath, stage);
    } catch (error) {
        console.warn("[main.ts] renderer snapshot failed:", error);
    }
}

// 🔧 日志管理：生产环境自动禁用console日志，防止性能问题
// 开发时可在控制台执行 __enableLog() 临时开启日志
if (import.meta.env.MODE === 'production') {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    // 保留 warn 和 error 用于问题排查
    console.warn = console.warn || noop;
    console.error = console.error || noop;

    // 提供恢复函数（用于调试）
    (window as any).__enableConsole = () => {
        console.log = console.info = console.debug = (...args: any[]) => {
            (window as any).__originalConsole.log(...args);
        };
    };
}

// 环境检测 - 必须在早期进行
// 🔧 修复:使用 process.versions.electron 是最可靠的检测方法
const isElectronEnv = () => typeof process !== 'undefined' &&
    typeof process.versions !== 'undefined' &&
    typeof process.versions.electron !== 'undefined';

// 仅在 Electron 环境中导入 Electron 依赖
async function initializeElectronDependencies() {
    if (!isElectronEnv()) {
        console.log('[main.ts] 检测到网页环境，跳过 Electron 依赖初始化');
        return;
    }

    try {
        console.log('[main.ts] 检测到 Electron 环境，开始初始化...');

        // 🔧 关键修复: 移除 MAPI 的动态导入
        // 原因: 
        // 1. MAPI 已在 preload 脚本中初始化,暴露为 window.$mapi
        // 2. 在渲染进程中动态导入包含 electron 依赖的模块会导致打包后找不到模块
        // 3. 开发环境能工作是因为 Vite 开发服务器有完整的模块解析系统
        // 4. 打包后 electron 模块引用无法正确解析,导致初始化失败

        // 检查 $mapi 是否已由 preload 初始化
        if (window.$mapi) {
            console.log('[main.ts] ✅ window.$mapi 已由 preload 初始化');
        } else {
            console.warn('[main.ts] ⚠️ window.$mapi 未找到,preload 可能未正确执行');
        }

        // 🔧 TaskManager 必须初始化,不依赖 MAPI 的动态导入
        TaskManager.init();
        console.log('[main.ts] TaskManager 初始化完成');

        const { setupGlobalSubtitleListener } = await import("./service/ipcSubtitleListener");
        setupGlobalSubtitleListener();
        console.log('[main.ts] 全局字幕监听器已设置');

        const { TaskLogService } = await import("./service/TaskLogService");
        await TaskLogService.initTable();
        console.log('[main.ts] 任务日志表已初始化');

    } catch (err) {
        console.error('[main.ts] Electron 依赖初始化失败:', err);
    }
}

// 初始化模型存储（非 Electron 依赖）
async function initializeModel() {
    try {
        console.log('[main.ts] 初始化模型存储...');
        const { model } = await import("./module/Model/store/model");
        await model.init();
        console.log('[main.ts] 模型存储初始化完成');
    } catch (err) {
        console.error('[main.ts] 模型存储初始化失败:', err);
    }
}

const settingStore = useSettingStore();

const app = createApp(App);
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(timeago, {
    converterOptions: {
        includeSeconds: false,
    },
    locale: zhCN,
});
app.use(CommonComponents);
app.use(i18n);
app.use(store);
app.use(router);
Message._context = app._context;

// 设置全局属性：仅在 Electron 环境中设置 $mapi
if (isElectronEnv() && (window as any).$mapi) {
    app.config.globalProperties.$mapi = (window as any).$mapi;
}
app.config.globalProperties.$dialog = Dialog;
app.config.globalProperties.$t = t as any;

// 等待 $mapi 初始化（最多等待 5 秒）
const waitForMapi = () => {
    return new Promise((resolve) => {
        if (window.$mapi) {
            console.log('[main.ts] ✅ $mapi 已就绪');
            resolve(true);
            return;
        }

        let attempts = 0;
        const maxAttempts = 50; // 5 秒 (50 * 100ms)

        const checkInterval = setInterval(() => {
            attempts++;
            if (window.$mapi) {
                clearInterval(checkInterval);
                console.log(`[main.ts] ✅ $mapi 在 ${attempts * 100}ms 后就绪`);
                resolve(true);
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('⚠️ $mapi 初始化超时，继续挂载应用');
                resolve(false);
            }
        }, 100);
    });
};

// 等待 $mapi 初始化后再挂载
(async () => {
    if (isElectronEnv()) {
        await waitForMapi();
    }

    const appInstance = app.mount("#app");

    appInstance.$nextTick(async () => {
        postMessage({ payload: "removeLoading" }, "*");
        writeDevRendererSnapshot("mounted-nextTick");
        setTimeout(() => writeDevRendererSnapshot("mounted-1500ms"), 1500);
        setTimeout(() => writeDevRendererSnapshot("mounted-4000ms"), 4000);

        // 初始化 Electron 相关功能和模型存储
        await initializeElectronDependencies();
        const { fetchSystemConfig } = await import("./service/systemConfig");
        await fetchSystemConfig().catch(e => console.warn('[main.ts] 获取系统配置失败:', e));
        await initializeModel();

    // 在应用挂载后,设置 IPC 监听器处理应用退出清理
    if (isElectronEnv() && (window as any).__page?.ipcInvoke) {
        (window as any).__page.ipcSend("app:cleanup-tasks-listener", "register");
        // 使用 __page 的 IPC 通信机制
        (window as any).__page.onBroadcast("app:cleanup-tasks", async () => {
            console.log("[Main] 收到应用清理任务信号");
            try {
                const taskStore = useTaskStore();
                await taskStore.clearRunningTasks();
                console.log("[Main] 任务已清除");
            } catch (e) {
                console.error("[Main] 清理任务时出错:", e);
            }
        });
    }
});
})();


