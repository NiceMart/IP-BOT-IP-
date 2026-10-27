/**
 * 资源路径工具模块
 * 统一管理开发环境和生产环境的资源路径
 * ⚠️ 确保所有依赖都能在不同环境下正确识别
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppEnv } from '../mapi/env';

/**
 * 判断是否为开发环境
 */
export function isDevelopment(): boolean {
    const appRoot = process.env.APP_ROOT || process.env.ELECTRON_RESOURCES_PATH || process.cwd();
    // 修复：dist-release目录不是开发环境
    if (appRoot.includes('dist-release') || appRoot.includes('dist-electron')) {
        return false;
    }
    // 🔧 修复：不硬编码项目文件夹名，改用检查开发目录结构是否存在
    // 开发环境特征：项目根目录有 electron/resources/extra 目录
    const devResourcePath = path.join(appRoot, 'electron', 'resources', 'extra');
    if (fs.existsSync(devResourcePath)) {
        return true;
    }
    // 回退：检查旧的文件夹名（兼容）
    return appRoot.includes('aigcpanel-main');
}

/**
 * 获取资源根目录
 */
export function getResourceRoot(): string {
    const isDev = isDevelopment();

    if (isDev) {
        // 开发环境：项目根目录/electron/resources/extra
        const appRoot = process.env.APP_ROOT || process.cwd();
        return path.join(appRoot, 'electron', 'resources', 'extra');
    } else {
        // 生产环境：使用 process.resourcesPath 获取 resources 目录
        // process.resourcesPath 指向 E:\xxx\resources
        // 资源文件在 E:\xxx\resources\extra
        // 关键修复：直接使用 process.resourcesPath 而不是 APP_ROOT
        // 因为 APP_ROOT 被设置为 resources 的父目录，会导致路径错误
        const resourcesPath = process.resourcesPath || process.env.ELECTRON_RESOURCES_PATH;
        if (resourcesPath) {
            return path.join(resourcesPath, 'extra');
        }
        // 回退：使用 APP_ROOT + resources/extra（仅当 process.resourcesPath 不可用时）
        const appRoot = process.env.APP_ROOT || process.cwd();
        return path.join(appRoot, 'resources', 'extra');
    }
}

/**
 * 获取通用资源路径（common 目录下的资源）
 * @param subPath 子路径（相对于 extra/common）
 */
export function getCommonResourcePath(subPath: string): string {
    const resourceRoot = getResourceRoot();
    return path.join(resourceRoot, 'common', subPath);
}

export function getRuntimeRoot(...segments: string[]): string {
    const baseRoot = AppEnv.installRoot || process.env.APP_ROOT || process.cwd();
    return path.join(baseRoot, ...segments);
}

export function getRuntimeDataPath(...segments: string[]): string {
    const dataRoot = AppEnv.dataRoot || getRuntimeRoot('data');
    return path.join(dataRoot, ...segments);
}

export function getRuntimeBundleRoot(): string {
    return AppEnv.resourceBundleRoot || getRuntimeRoot('resources-bundles');
}

export function getRuntimeBundlePath(bundleName: string, ...segments: string[]): string {
    return path.join(getRuntimeBundleRoot(), bundleName, ...segments);
}

export function getResourceStatePath(...segments: string[]): string {
    const root = AppEnv.resourceStateRoot || getRuntimeDataPath('resource-state');
    return path.join(root, ...segments);
}

/**
 * 获取平台特定资源路径
 * @param subPath 子路径（相对于 extra/{platform}）
 */
export function getPlatformResourcePath(subPath: string): string {
    const resourceRoot = getResourceRoot();
    const platform = getPlatformDir();
    return path.join(resourceRoot, platform, subPath);
}

/**
 * 获取平台目录名
 */
export function getPlatformDir(): string {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    if (isWin) return 'win-x86';
    if (isMac) return 'osx';
    return 'linux';
}

/**
 * 检查资源文件是否存在
 * @param resourcePath 资源路径
 * @returns 文件是否存在
 */
export function resourceExists(resourcePath: string): boolean {
    return fs.existsSync(resourcePath);
}

/**
 * 获取并验证资源路径
 * @param resourcePath 资源路径
 * @param errorMessage 文件不存在时的错误消息
 * @returns 验证后的资源路径
 * @throws 如果资源不存在则抛出错误
 */
export function getAndVerifyResource(resourcePath: string, errorMessage?: string): string {
    if (!fs.existsSync(resourcePath)) {
        const error = errorMessage || `资源文件不存在: ${resourcePath}`;
        throw new Error(error);
    }
    return resourcePath;
}

/**
 * 快捷方法：获取 Python 可执行文件路径
 */
export function getPythonExecutablePath(): string {
    const isWin = process.platform === 'win32';
    const pythonFileName = isWin ? 'python.exe' : 'python3';
    const runtimePath = getRuntimeBundlePath('python-runtime', pythonFileName);
    if (fs.existsSync(runtimePath)) {
        return runtimePath;
    }
    return getCommonResourcePath(path.join('python', pythonFileName));
}

/**
 * 快捷方法：获取 FFmpeg 可执行文件路径
 */
export function getFFmpegExecutablePath(): string {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    let ffmpegFileName = 'ffmpeg';
    if (isWin) ffmpegFileName = 'ffmpeg.exe';

    return getPlatformResourcePath(ffmpegFileName);
}

/**
 * 快捷方法：获取 FFprobe 可执行文件路径
 */
export function getFFprobeExecutablePath(): string {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    let ffprobeFileName = 'ffprobe';
    if (isWin) ffprobeFileName = 'ffprobe.exe';

    return getPlatformResourcePath(ffprobeFileName);
}

/**
 * 快捷方法：获取模型文件路径
 * @param modelFileName 模型文件名（如 'u2net.onnx'）
 */
export function getModelPath(modelFileName: string): string {
    const runtimePath = getRuntimeBundlePath('models', modelFileName);
    if (fs.existsSync(runtimePath)) {
        return runtimePath;
    }
    return getCommonResourcePath(path.join('models', modelFileName));
}

/**
 * 快捷方法：获取 Python 脚本路径
 * @param scriptFileName Python 脚本文件名
 */
export function getPythonScriptPath(scriptFileName: string): string {
    const runtimePath = getRuntimeBundlePath('python-runtime', scriptFileName);
    if (fs.existsSync(runtimePath)) {
        return runtimePath;
    }

    const appRoot = process.env.APP_ROOT || process.env.ELECTRON_RESOURCES_PATH || process.cwd();
    const isDev = isDevelopment();

    if (isDev) {
        return path.join(appRoot, 'python', scriptFileName);
    } else {
        const asarUnpackedPath = path.join(appRoot, 'app.asar.unpacked', 'python', scriptFileName);
        if (fs.existsSync(asarUnpackedPath)) {
            return asarUnpackedPath;
        }
        return path.join(appRoot, 'python', scriptFileName);
    }
}

/**
 * 诊断信息：打印所有资源路径
 */
export function printResourceDiagnostics(): void {
    const isDev = isDevelopment();
    const resourceRoot = getResourceRoot();

    console.log('\n========== 资源路径诊断 ==========');
    console.log('环境模式:', isDev ? '开发环境' : '生产环境');
    console.log('App Root:', process.env.APP_ROOT || process.cwd());
    console.log('资源根目录:', resourceRoot);
    console.log('\n关键资源路径:');
    console.log('  Python:', getPythonExecutablePath(), '存在:', resourceExists(getPythonExecutablePath()));
    console.log('  FFmpeg:', getFFmpegExecutablePath(), '存在:', resourceExists(getFFmpegExecutablePath()));
    console.log('  FFprobe:', getFFprobeExecutablePath(), '存在:', resourceExists(getFFprobeExecutablePath()));
    console.log('  U2Net模型:', getModelPath('u2net.onnx'), '存在:', resourceExists(getModelPath('u2net.onnx')));
    console.log('=====================================\n');
}
