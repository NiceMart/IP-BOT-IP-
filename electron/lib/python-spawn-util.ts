/**
 * Python 进程启动工具
 * 统一处理中文路径问题
 */

import { spawn, SpawnOptions } from 'child_process';
import { normalizePath } from './path-util';
import * as path from 'path';
import * as os from 'os';
import logger from '../mapi/log/main';

export interface PythonSpawnOptions extends SpawnOptions {
    /**
     * 是否转换所有路径参数（默认 true）
     */
    normalizePaths?: boolean;
}

/**
 * 启动 Python 进程，自动处理中文路径
 * @param pythonPath Python 可执行文件路径
 * @param args Python 脚本和参数
 * @param options spawn 选项
 * @returns ChildProcess
 */
export function spawnPython(
    pythonPath: string,
    args: string[],
    options?: PythonSpawnOptions
) {
    const platform = os.platform();
    const shouldNormalize = options?.normalizePaths !== false && platform === 'win32';

    // Windows 平台：转换所有路径
    if (shouldNormalize) {
        // 转换 Python 可执行文件路径
        const normalizedPythonPath = normalizePath(pythonPath);

        // 转换参数中的路径
        const normalizedArgs = args.map((arg, index) => {
            // 检查是否是文件路径（包含路径分隔符或扩展名）
            if (arg.includes('/') || arg.includes('\\') ||
                (arg.includes('.') && !arg.startsWith('-'))) {
                const normalized = normalizePath(arg);

                if (normalized !== arg) {
                    logger.info('[PythonSpawn] 路径转换', {
                        index,
                        original: arg.substring(0, 100),
                        normalized: normalized.substring(0, 100)
                    });
                }

                return normalized;
            }
            return arg;
        });

        logger.info('[PythonSpawn] 启动 Python 进程', {
            pythonPath: normalizedPythonPath.substring(0, 100),
            argsCount: normalizedArgs.length,
            cwd: options?.cwd
        });

        return spawn(normalizedPythonPath, normalizedArgs, options);
    }

    // macOS/Linux：直接启动
    return spawn(pythonPath, args, options);
}

/**
 * 执行 Python 脚本并返回 Promise
 * @param pythonPath Python 可执行文件路径
 * @param args Python 脚本和参数
 * @param options spawn 选项
 * @returns Promise<{stdout: string, stderr: string, exitCode: number}>
 */
export function execPython(
    pythonPath: string,
    args: string[],
    options?: PythonSpawnOptions
): Promise<{stdout: string, stderr: string, exitCode: number}> {
    return new Promise((resolve, reject) => {
        const child = spawnPython(pythonPath, args, options);

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (exitCode) => {
            resolve({
                stdout,
                stderr,
                exitCode: exitCode || 0
            });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * 创建临时配置文件（确保在纯英文路径）
 * @param config 配置对象
 * @param prefix 文件名前缀
 * @returns 配置文件路径
 */
export function createTempConfig(config: any, prefix: string = 'config'): string {
    const fs = require('fs');

    // 使用系统临时目录（通常是纯英文路径）
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const configPath = path.join(tempDir, `${prefix}_${timestamp}_${random}.json`);

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    logger.info('[PythonSpawn] 创建临时配置文件', {
        path: configPath,
        size: JSON.stringify(config).length
    });

    return configPath;
}

/**
 * 清理临时配置文件
 * @param configPath 配置文件路径
 */
export function cleanupTempConfig(configPath: string): void {
    try {
        const fs = require('fs');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            logger.info('[PythonSpawn] 清理临时配置文件', { path: configPath });
        }
    } catch (error) {
        logger.warn('[PythonSpawn] 清理临时配置文件失败', {
            path: configPath,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
