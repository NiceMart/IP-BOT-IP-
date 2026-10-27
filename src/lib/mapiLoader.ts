// @ts-nocheck
/**
 * MAPI 加载器 - 条件性加载 MAPI
 * 在 Electron 环境中加载真实的 MAPI
 * 在网页环境中返回空对象，避免加载 electron 模块
 */

import { isElectronEnv } from "./electronEnv";

let MAPI: any = null;

export async function initMAPI() {
    if (!isElectronEnv()) {
        console.log('[mapiLoader] 检测到网页环境，使用空 MAPI');
        return;
    }

    try {
        // 仅在 Electron 环境中动态导入 MAPI
        const mapiModule = await import("../../electron/mapi/render");
        MAPI = mapiModule.MAPI;
        console.log('[mapiLoader] 检测到 Electron 环境，初始化前端 MAPI...');
        MAPI.init();
        console.log('[mapiLoader] 前端 MAPI 初始化完成，window.$mapi 已暴露');
    } catch (err) {
        console.error('[mapiLoader] MAPI 初始化失败:', err);
    }
}

export function getMAP(): any {
    return MAPI;
}
