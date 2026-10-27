/**
 * Electron 环境检测工具
 * 用于判断应用是否运行在 Electron 环境中
 */

/**
 * 检测是否在 Electron 环境中运行
 * @returns true if running in Electron, false if running in browser
 */
export function isElectronEnv(): boolean {
    // 🔧 修复:使用 process.versions.electron 是最可靠的检测方法
    // contextIsolation: false 时,process 会被暴露到渲染进程
    return typeof process !== 'undefined' &&
        typeof process.versions !== 'undefined' &&
        typeof process.versions.electron !== 'undefined';
}

/**
 * 检测 Preload 脚本是否已初始化
 * @returns true if Preload has initialized (Electron only)
 */
export function hasPreloadInitialized(): boolean {
    return typeof (window as any).__page !== 'undefined' &&
        typeof (window as any).$mapi !== 'undefined';
}
