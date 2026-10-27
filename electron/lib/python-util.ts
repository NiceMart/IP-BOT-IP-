/**
 * Python工具模块
 * 提供Python可执行文件路径查找和验证
 */

import * as fs from 'fs';
import * as path from 'path';
import {spawn} from 'child_process';
import { getPythonExecutablePath, resourceExists, isDevelopment } from './resource-path';

/**
 * 获取Python可执行文件路径
 * ⚠️ 只使用程序自带的 Python，不依赖系统环境
 * 如果找不到自带的 Python，会抛出错误
 */
export function getPythonPath(): string {
    const bundledPythonPath = getPythonExecutablePath();
    const isDev = isDevelopment();

    console.log('[getPythonPath]', {
        isDev,
        bundledPythonPath,
        exists: resourceExists(bundledPythonPath)
    });

    if (resourceExists(bundledPythonPath)) {
        console.log('[getPythonPath] ✅ 找到程序自带的 Python:', bundledPythonPath);
        return bundledPythonPath;
    }

    // ❌ 找不到自带的 Python - 这是严重错误，应该报错
    const errorMsg = `❌ 程序自带的 Python 不存在: ${bundledPythonPath}\n` +
                     `环境: ${isDev ? '开发环境' : '生产环境'}\n` +
                     `请确认程序是否正确安装，或重新安装程序。`;
    console.error('[getPythonPath]', errorMsg);
    throw new Error(errorMsg);
}

/**
 * 验证Python是否可用
 * @returns Promise<boolean>
 */
export async function verifyPython(): Promise<boolean> {
    return new Promise((resolve) => {
        const pythonPath = getPythonPath();
        const process = spawn(pythonPath, ['--version']);

        process.on('close', (code) => {
            resolve(code === 0);
        });

        process.on('error', () => {
            resolve(false);
        });
    });
}

/**
 * 获取Python版本信息
 * @returns Promise<string | null>
 */
export async function getPythonVersion(): Promise<string | null> {
    return new Promise((resolve) => {
        const pythonPath = getPythonPath();
        const process = spawn(pythonPath, ['--version']);

        let output = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            output += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0 && output) {
                resolve(output.trim());
            } else {
                resolve(null);
            }
        });

        process.on('error', () => {
            resolve(null);
        });
    });
}