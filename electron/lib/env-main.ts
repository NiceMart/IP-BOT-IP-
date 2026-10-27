import url, {fileURLToPath} from "node:url";
import {BrowserView, BrowserWindow} from "electron";
import {isPackaged} from "./env";
import path, {join} from "node:path";
import {Log} from "../mapi/log/main";
import {existsSync} from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🔧 计算应用根目录 - 使用多重降级方案确保兼容 ASAR 打包
function getAppRoot(): string {
  try {
    // 开发环境：从当前文件目录往上两级
    if (!isPackaged) {
      const root = path.join(__dirname, "../..");
      if (root && typeof root === 'string') {
        return root;
      }
    }
  } catch (error) {
    console.error('[getAppRoot] 开发环境路径计算失败:', error);
  }

  // 生产环境或计算失败：尝试使用 process.resourcesPath（最可靠）
  try {
    if (process.resourcesPath && typeof process.resourcesPath === 'string') {
      return process.resourcesPath;
    }
  } catch (error) {
    console.error('[getAppRoot] process.resourcesPath 获取失败:', error);
  }

  // 最后的降级方案：使用可执行文件目录
  try {
    const execPath = process.execPath;
    if (execPath && typeof execPath === 'string') {
      return path.dirname(execPath);
    }
  } catch (error) {
    console.error('[getAppRoot] process.execPath 获取失败:', error);
  }

  // 如果都失败，返回当前目录（最后防线）
  return __dirname;
}

const appRoot = getAppRoot();
process.env.APP_ROOT = appRoot;

console.log('[env-main] APP_ROOT 已设置:', process.env.APP_ROOT);

// 🔧 处理 ASAR 打包：当使用 asar 打包时，应用代码在 app.asar 内
// 根据是否为 asar 打包来调整路径
let MAIN_DIST: string;
if (isPackaged && appRoot === process.resourcesPath) {
    // 生产环境且使用了 asar 打包
    // preload 和主进程代码在 app.asar 内，但资源在 app.asar.unpacked 或 resources 根目录
    try {
        const appAsarPath = path.join(appRoot, 'app.asar');
        if (existsSync(appAsarPath)) {
            MAIN_DIST = path.join(appAsarPath, "dist-electron");
        } else {
            MAIN_DIST = path.join(appRoot, "dist-electron");
        }
    } catch (e) {
        MAIN_DIST = path.join(appRoot, "dist-electron");
    }
} else {
    // 开发环境或非 asar 打包
    MAIN_DIST = path.join(appRoot, "dist-electron");
}

// 🔧 渲染进程文件也在 app.asar 内
let RENDERER_DIST: string;
if (isPackaged && appRoot === process.resourcesPath) {
    try {
        const appAsarPath = path.join(appRoot, 'app.asar');
        if (existsSync(appAsarPath)) {
            RENDERER_DIST = path.join(appAsarPath, "dist");
        } else {
            RENDERER_DIST = path.join(appRoot, "dist");
        }
    } catch (e) {
        RENDERER_DIST = path.join(appRoot, "dist");
    }
} else {
    RENDERER_DIST = path.join(appRoot, "dist");
}

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(appRoot, "public") : RENDERER_DIST;

console.log('[env-main] MAIN_DIST:', MAIN_DIST);
console.log('[env-main] RENDERER_DIST:', RENDERER_DIST);

export { MAIN_DIST, RENDERER_DIST };
export const preloadDefault = path.join(MAIN_DIST, "preload/index.js");

console.log('[env-main] preloadDefault:', preloadDefault);

export const rendererLoadPath = (window: BrowserWindow | BrowserView, fileName: string) => {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        const x = new url.URL(rendererDistPath(fileName));
        if (window instanceof BrowserView) {
            window.webContents.loadURL(x.toString());
        } else {
            window.loadURL(x.toString());
        }
    } else {
        if (window instanceof BrowserView) {
            window.webContents.loadFile(rendererDistPath(fileName));
        } else {
            window.loadFile(rendererDistPath(fileName));
        }
    }
};

export const rendererDistPath = (fileName: string) => {
    if (!isPackaged && process.env.VITE_DEV_SERVER_URL) {
        return `${process.env.VITE_DEV_SERVER_URL.replace(/\/+$/, "")}/${fileName}`;
    }
    return join(RENDERER_DIST, fileName);
};

export const rendererIsUrl = (url: string) => {
    return url.startsWith("http://") || url.startsWith("https://");
};

export const getGpuInfo = async () => {
    const list = [] as {
        id: string;
        name: string;
        size: number;
    }[];
    try {
        // @ts-ignore
        const si = await import("systeminformation");
        const graphics = await si.graphics();
        graphics.controllers.forEach((controller, index) => {
            const size = Math.ceil(controller.vram / 1024);
            let id = index + "";
            const name = controller.model;
            list.push({id, name, size});
        });
    } catch (e) {
        Log.error("getGpuInfo", e);
    }
    return list;
};
