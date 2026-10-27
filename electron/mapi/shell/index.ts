import { spawn } from 'node:child_process';
import path from 'node:path';
import * as fs from 'fs';
import { shell } from 'electron';
import { AppEnv, waitAppEnvReady } from '../env';
import { Log } from '../log';
import { getFFmpegExecutablePath, getFFprobeExecutablePath, getPythonExecutablePath, resourceExists, isDevelopment } from '../../lib/resource-path';
import { normalizePath, normalizeOutputPath } from '../../lib/path-util';
import { getMacOSPythonPath } from '../../lib/python-setup';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Python路径缓存，避免重复验证
let cachedPythonPath: string | null = null;

/**
 * 动态检测 Python 可执行文件路径
 * 优先级：系统 PATH 中的 python > py > python3
 * @returns Promise<string> Python 可执行文件路径
 */
export const getPythonPath = async (): Promise<string> => {
    // 如果已经缓存了有效路径，直接返回
    if (cachedPythonPath) {
        Log.debug('getPythonPath: 使用缓存路径', { path: cachedPythonPath });
        return cachedPythonPath;
    }

    Log.info('getPythonPath: 开始检测 Python 路径');

    if (!isWin) {
        const standalonePython = getMacOSPythonPath();
        if (standalonePython) {
            Log.info('getPythonPath: ✅ 使用独立 Python', { path: standalonePython });
            cachedPythonPath = standalonePython;
            return standalonePython;
        }
        throw new Error('macOS Python 环境尚未初始化，请等待应用完成初始化');
    }

    const bundledPython = getPythonExecutablePath();
    if (resourceExists(bundledPython) && await verifyPythonExecutable(bundledPython)) {
        cachedPythonPath = bundledPython;
        return bundledPython;
    }

    const pythonCommands = [];
    pythonCommands.push('py', 'python', 'python3');

    // 逐个测试 Python 命令是否可用
    for (const command of pythonCommands) {
        try {
            Log.info('getPythonPath: 尝试命令', { command });

            const isAvailable = await verifyPythonExecutable(command);
            if (isAvailable) {
                Log.info('getPythonPath: ✅ 找到可用的 Python', { command });
                cachedPythonPath = command;
                return command;
            }
        } catch (error) {
            Log.warn('getPythonPath: 命令不可用', { command, error: (error as Error).message });
        }
    }

    // 所有尝试都失败
    const errorMsg = `❌ 无法找到可用的 Python：\n` +
                     `尝试的命令: ${pythonCommands.join(', ')}\n` +
                     `请安装 Python 或确保其在系统 PATH 中。`;
    Log.error('getPythonPath', errorMsg);
    throw new Error(errorMsg);
};

/**
 * 验证 Python 命令是否可执行
 * @param pythonCommand Python 命令（python, py, python3 等）
 * @returns Promise<boolean> 是否可执行
 */
const verifyPythonExecutable = async (pythonCommand: string): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            Log.info('verifyPythonExecutable: 开始验证', { pythonCommand });

            const child = spawn(pythonCommand, ['--version'], {
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let hasOutput = false;
            let isResolved = false;

            const cleanup = () => {
                if (!isResolved) {
                    isResolved = true;
                    try {
                        child.kill('SIGTERM');
                    } catch (e) {}
                }
            };

            const timeout = setTimeout(() => {
                Log.warn('verifyPythonExecutable: 超时', { pythonCommand });
                cleanup();
                resolve(false);
            }, 3000); // 3秒超时

            child.stdout?.on('data', () => {
                hasOutput = true;
                Log.debug('verifyPythonExecutable: 获得输出', { pythonCommand });
            });

            child.stderr?.on('data', () => {
                hasOutput = true;
                Log.debug('verifyPythonExecutable: 获得错误输出', { pythonCommand });
            });

            child.on('close', (code) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    const success = code === 0 && hasOutput;
                    Log.info('verifyPythonExecutable: 完成', { pythonCommand, code, hasOutput, success });
                    resolve(success);
                }
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                if (!isResolved) {
                    isResolved = true;
                    Log.warn('verifyPythonExecutable: 错误', { pythonCommand, error: error.message });
                    cleanup();
                    resolve(false);
                }
            });
        } catch (error: any) {
            Log.error('verifyPythonExecutable: 异常', { pythonCommand, error: error.message });
            resolve(false);
        }
    });
};

// FFmpeg路径缓存，避免重复验证
let cachedFFmpegPath: string | null = null;
const invalidFFmpegPaths = new Set<string>();
const invalidFFprobePaths = new Set<string>();
const ILLEGAL_INSTRUCTION_EXIT_CODES = new Set([3221225501]);
const FFMPEG_RUNTIME_VERIFY_ARGS = [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'color=size=16x16:rate=1:color=black',
    '-frames:v', '1',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-f', 'null',
    '-'
];

const getBundledExecutableCandidates = (primaryPath: string): string[] => {
    const candidates = [primaryPath];

    if (isWin) {
        const parentDir = path.dirname(primaryPath);
        const backupDir = `${parentDir}-backup`;
        const backupPath = path.join(backupDir, path.basename(primaryPath));
        candidates.push(backupPath);
    }

    return Array.from(new Set(candidates.filter(Boolean)));
};

const markExecutableAsInvalid = (
    invalidSet: Set<string>,
    executablePath: string,
    tag: 'FFmpeg' | 'FFprobe',
    reason: string
) => {
    if (!executablePath || invalidSet.has(executablePath)) {
        return;
    }

    invalidSet.add(executablePath);
    Log.warn(`${tag}: invalid executable path`, {
        executablePath,
        reason,
    });
};

const verifyRuntimeExecutable = async (
    executablePath: string,
    args: string[],
    tag: 'FFmpeg' | 'FFprobe',
    options: {
        requireOutput?: boolean;
    } = {}
): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const child = spawn(executablePath, args, {
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let hasOutput = false;
            let settled = false;
            const requireOutput = options.requireOutput ?? true;

            const finish = (result: boolean) => {
                if (!settled) {
                    settled = true;
                    resolve(result);
                }
            };

            const timer = setTimeout(() => {
                try {
                    child.kill('SIGTERM');
                } catch (e) {}
                Log.warn(`verify${tag}Executable: timeout`, { executablePath, args });
                finish(false);
            }, 4000);

            child.stdout?.on('data', () => {
                hasOutput = true;
            });

            child.stderr?.on('data', () => {
                hasOutput = true;
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                const success = code === 0 && (!requireOutput || hasOutput);
                Log.info(`verify${tag}Executable: complete`, {
                    executablePath,
                    args,
                    code,
                    hasOutput,
                    requireOutput,
                    success,
                });
                finish(success);
            });

            child.on('error', (error) => {
                clearTimeout(timer);
                Log.warn(`verify${tag}Executable: error`, { executablePath, args, error: error.message });
                finish(false);
            });
        } catch (error: any) {
            Log.error(`verify${tag}Executable: exception`, { executablePath, args, error: error.message });
            resolve(false);
        }
    });
};

const verifyBundledFFmpegCandidate = async (ffmpegPath: string): Promise<boolean> => {
    return verifyRuntimeExecutable(ffmpegPath, FFMPEG_RUNTIME_VERIFY_ARGS, 'FFmpeg', {
        requireOutput: false,
    });
};

const verifyBundledFFprobeCandidate = async (ffprobePath: string): Promise<boolean> => {
    return verifyRuntimeExecutable(ffprobePath, ['-version'], 'FFprobe');
};

const findFallbackFFmpegPath = async (excludePaths: string[]): Promise<string | null> => {
    const excluded = new Set(excludePaths);
    const bundledCandidates = getBundledExecutableCandidates(getFFmpegExecutablePath());

    for (const candidate of bundledCandidates) {
        if (!candidate || excluded.has(candidate) || invalidFFmpegPaths.has(candidate) || !resourceExists(candidate)) {
            continue;
        }

        if (await verifyBundledFFmpegCandidate(candidate)) {
            return candidate;
        }

        markExecutableAsInvalid(invalidFFmpegPaths, candidate, 'FFmpeg', 'fallback verification failed');
    }

    if (isDevelopment()) {
        const systemFFmpegPath = isWin ? 'ffmpeg.exe' : 'ffmpeg';
        if (!excluded.has(systemFFmpegPath) && !invalidFFmpegPaths.has(systemFFmpegPath)) {
            if (await verifyFFmpegExecutable(systemFFmpegPath)) {
                return systemFFmpegPath;
            }
            markExecutableAsInvalid(invalidFFmpegPaths, systemFFmpegPath, 'FFmpeg', 'dev system fallback verification failed');
        }
    }

    return null;
};
// FFprobe路径缓存，避免重复验证
let cachedFFprobePath: string | null = null;

/**
 * Execute FFmpeg command with the given parameters
 * @param params Array of FFmpeg command parameters
 * @param options Optional execution options
 * @returns Promise that resolves when the command completes
 */
export const execFFmpegCommand = async (
    params: string[],
    options?: {
        cwd?: string;
        outputEncoding?: string;
        onProgress?: (progress: any) => void;
        env?: Record<string, string>;
    }
): Promise<string> => {
    console.log('[execFFmpegCommand] ========== START ==========');
    console.log('[execFFmpegCommand] Called with params count:', params.length);

    const ffmpegPath = await getFFmpegPath();

    let cwd: string;
    if (options?.cwd && typeof options.cwd === 'string') {
        cwd = options.cwd;
    } else {
        await waitAppEnvReady();
        cwd = AppEnv.appRoot || process.cwd();
    }

    const outputEncoding = options?.outputEncoding || 'utf8';

    if (!Array.isArray(params)) {
        const error = new Error('params must be an array');
        Log.error('execFFmpegCommand: Invalid params type', { params, type: typeof params });
        throw error;
    }

    for (let i = 0; i < params.length; i++) {
        if (typeof params[i] !== 'string') {
            const error = new Error(`params[${i}] must be a string, got ${typeof params[i]}: ${params[i]}`);
            Log.error('execFFmpegCommand: Invalid param type', { index: i, value: params[i], type: typeof params[i] });
            throw error;
        }
    }

    const pathParamFlags = ['-i'];
    const normalizedParams = params.map((param, index) => {
        if (index > 0 && pathParamFlags.includes(params[index - 1])) {
            const normalized = normalizePath(param);
            if (normalized !== param) {
                Log.info('execFFmpegCommand: normalized input path', {
                    original: param.substring(0, 100),
                    normalized: normalized.substring(0, 100)
                });
            }
            return normalized;
        }

        if (index === params.length - 1) {
            const looksLikeOutputPath = param.includes('\\') || param.includes('/') || (
                param.includes('.') && param.length > 3 && !param.startsWith('-')
            );
            if (looksLikeOutputPath) {
                const outputDir = path.dirname(param);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                const normalized = normalizeOutputPath(param);
                if (normalized !== param) {
                    Log.info('execFFmpegCommand: normalized output path', {
                        original: param.substring(0, 100),
                        normalized: normalized.substring(0, 100)
                    });
                }
                return normalized;
            }
        }

        return param;
    });

    if (typeof cwd !== 'string') {
        const error = new Error(`cwd must be a string, got ${typeof cwd}`);
        Log.error('execFFmpegCommand: Invalid cwd type', { cwd, type: typeof cwd });
        throw error;
    }

    if (typeof ffmpegPath !== 'string') {
        const error = new Error(`ffmpegPath must be a string, got ${typeof ffmpegPath}`);
        Log.error('execFFmpegCommand: Invalid ffmpegPath type', { ffmpegPath, type: typeof ffmpegPath });
        throw error;
    }

    Log.info('execFFmpegCommand', { ffmpegPath, params: normalizedParams, cwd, outputEncoding });

    const env = {
        ...process.env,
        FONTCONFIG_FILE: '',
        FONTCONFIG_PATH: '',
        ...(options?.env || {})
    };

    const runProcess = (executablePath: string) => {
        return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
            try {
                const child = spawn(executablePath, normalizedParams, {
                    cwd,
                    shell: false,
                    env,
                });

                let stdout = '';
                let stderr = '';

                child.stdout?.on('data', (data) => {
                    const output = data.toString(outputEncoding as BufferEncoding);
                    stdout += output;

                    if (options?.onProgress) {
                        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
                        if (timeMatch) {
                            const [, hours, minutes, seconds] = timeMatch;
                            const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
                            options.onProgress({ currentTime: totalSeconds });
                        }
                    }
                });

                child.stderr?.on('data', (data) => {
                    const output = data.toString(outputEncoding as BufferEncoding);
                    stderr += output;
                    console.log('[FFmpeg stderr]', output.substring(0, 500));
                });

                child.on('close', (code) => {
                    Log.info('FFmpeg process completed', {
                        executablePath,
                        code,
                        stderrLength: stderr.length
                    });
                    console.log('[FFmpeg] exited with code:', code);
                    if (stderr.length > 0) {
                        console.log('[FFmpeg] stderr:\n', stderr.substring(0, 2000));
                    }
                    resolve({ stdout, stderr, code });
                });

                child.on('error', (error) => {
                    Log.error('FFmpeg process error', { executablePath, error });
                    reject(error);
                });
            } catch (error) {
                Log.error('execFFmpegCommand: spawn error', { executablePath, error });
                reject(error);
            }
        });
    };

    let activeFFmpegPath = ffmpegPath;
    let result = await runProcess(activeFFmpegPath);

    if (result.code !== 0 && result.code !== null && ILLEGAL_INSTRUCTION_EXIT_CODES.has(result.code)) {
        markExecutableAsInvalid(invalidFFmpegPaths, activeFFmpegPath, 'FFmpeg', `runtime exit code ${result.code}`);
        if (cachedFFmpegPath === activeFFmpegPath) {
            cachedFFmpegPath = null;
        }

        const fallbackPath = await findFallbackFFmpegPath([activeFFmpegPath]);
        if (fallbackPath) {
            Log.warn('execFFmpegCommand: retrying with fallback bundled FFmpeg', {
                failedPath: activeFFmpegPath,
                fallbackPath,
                code: result.code
            });
            cachedFFmpegPath = fallbackPath;
            activeFFmpegPath = fallbackPath;
            result = await runProcess(activeFFmpegPath);
        }
    }

    if (result.code === 0) {
        return result.stdout;
    }

    Log.error(`FFmpeg process exited with code ${result.code}`, result.stderr);
    throw new Error(`FFmpeg process exited with code ${result.code}: ${result.stderr}`);
};
/**
 * Extract audio from video file using FFmpeg
 * @param inputPath Path to the input video file
 * @param outputPath Path to save the extracted audio
 * @param options Audio extraction options
 * @returns Promise that resolves when audio extraction completes
 */
export const extractAudioFromVideo = async (
    inputPath: string,
    outputPath: string,
    options?: {
        audioCodec?: string;
        sampleRate?: number;
        channels?: number;
        bitrate?: string;
        onProgress?: (progress: any) => void;
    }
): Promise<string> => {
    const {
        audioCodec = 'mp3',
        sampleRate = 16000,
        channels = 1,
        bitrate = '128k',
        onProgress
    } = options || {};

    // 🔧 路径已经在 execFFmpegCommand 中自动转换，这里直接传递即可
    const params = [
        '-i', inputPath,
        '-vn', // No video
        '-acodec', audioCodec,
        '-ar', sampleRate.toString(),
        '-ac', channels.toString(),
        '-ab', bitrate,
        '-y', // Overwrite output
        outputPath
    ];

    return execFFmpegCommand(params, { onProgress });
};

/**
 * 验证FFmpeg是否可执行
 * @param ffmpegPath FFmpeg路径
 * @returns Promise<boolean> 是否可执行
 */
const verifyFFmpegExecutable = async (ffmpegPath: string): Promise<boolean> => {
    return verifyRuntimeExecutable(ffmpegPath, ['-version'], 'FFmpeg');
};
/**
 * Get the path to the FFmpeg executable
 * ⚠️ 优先使用程序自带的 FFmpeg，如果无法执行则回退到系统 FFmpeg
 * @returns Promise that resolves to the FFmpeg path
 */
export const getFFmpegPath = async (): Promise<string> => {
    if (cachedFFmpegPath && !invalidFFmpegPaths.has(cachedFFmpegPath)) {
        Log.debug('getFFmpegPath: using cached bundled path', { path: cachedFFmpegPath });
        return cachedFFmpegPath;
    }

    await waitAppEnvReady();
    cachedFFmpegPath = null;

    const bundledCandidates = getBundledExecutableCandidates(getFFmpegExecutablePath());
    Log.info('getFFmpegPath: checking bundled candidates', { bundledCandidates });

    for (const candidate of bundledCandidates) {
        if (!candidate || invalidFFmpegPaths.has(candidate) || !resourceExists(candidate)) {
            continue;
        }

        Log.info('getFFmpegPath: verifying bundled candidate', { candidate });
        if (await verifyBundledFFmpegCandidate(candidate)) {
            cachedFFmpegPath = candidate;
            Log.info('getFFmpegPath: using bundled candidate', { candidate });
            return candidate;
        }

        markExecutableAsInvalid(invalidFFmpegPaths, candidate, 'FFmpeg', 'startup verification failed');
    }

    if (isDevelopment()) {
        const systemFFmpegPath = isWin ? 'ffmpeg.exe' : 'ffmpeg';
        Log.warn('getFFmpegPath: bundled FFmpeg unavailable in dev, trying system FFmpeg', {
            systemFFmpegPath,
        });
        if (!invalidFFmpegPaths.has(systemFFmpegPath) && await verifyFFmpegExecutable(systemFFmpegPath)) {
            cachedFFmpegPath = systemFFmpegPath;
            Log.info('getFFmpegPath: using system FFmpeg in dev mode', { systemFFmpegPath });
            return systemFFmpegPath;
        }
        markExecutableAsInvalid(invalidFFmpegPaths, systemFFmpegPath, 'FFmpeg', 'dev system fallback verification failed');
    }

    const errorMsg = `无法找到可用的 FFmpeg: ${bundledCandidates.join(', ')}`;
    Log.error('getFFmpegPath', errorMsg);
    throw new Error(errorMsg);
};
/**
 * Get FFprobe path with fallback support
 * 1. Try bundled ffprobe
 * 2. Fallback to system ffprobe
 */
export const getFFprobePath = async (): Promise<string> => {
    if (cachedFFprobePath && !invalidFFprobePaths.has(cachedFFprobePath)) {
        Log.debug('getFFprobePath: using cached bundled path', { path: cachedFFprobePath });
        return cachedFFprobePath;
    }

    await waitAppEnvReady();
    cachedFFprobePath = null;

    const bundledCandidates = getBundledExecutableCandidates(getFFprobeExecutablePath());
    Log.info('getFFprobePath: checking bundled candidates', { bundledCandidates });

    for (const candidate of bundledCandidates) {
        if (!candidate || invalidFFprobePaths.has(candidate) || !resourceExists(candidate)) {
            continue;
        }

        Log.info('getFFprobePath: verifying bundled candidate', { candidate });
        if (await verifyBundledFFprobeCandidate(candidate)) {
            cachedFFprobePath = candidate;
            Log.info('getFFprobePath: using bundled candidate', { candidate });
            return candidate;
        }

        markExecutableAsInvalid(invalidFFprobePaths, candidate, 'FFprobe', 'startup verification failed');
    }

    if (isDevelopment()) {
        const systemFFprobePath = isWin ? 'ffprobe.exe' : 'ffprobe';
        Log.warn('getFFprobePath: bundled FFprobe unavailable in dev, trying system FFprobe', {
            systemFFprobePath,
        });
        if (!invalidFFprobePaths.has(systemFFprobePath) && await verifyRuntimeExecutable(systemFFprobePath, ['-version'], 'FFprobe')) {
            cachedFFprobePath = systemFFprobePath;
            Log.info('getFFprobePath: using system FFprobe in dev mode', { systemFFprobePath });
            return systemFFprobePath;
        }
        markExecutableAsInvalid(invalidFFprobePaths, systemFFprobePath, 'FFprobe', 'dev system fallback verification failed');
    }

    const errorMsg = `无法找到可用的 FFprobe: ${bundledCandidates.join(', ')}`;
    Log.error('getFFprobePath', errorMsg);
    throw new Error(errorMsg);
};
/**
 * Show item in folder using the system's file manager
 * @param filePath Path to the file to show
 * @returns boolean indicating success
 */
export const showItemInFolder = async (filePath: string): Promise<boolean> => {
    try {
        Log.info('showItemInFolder', { filePath });
        shell.showItemInFolder(filePath);
        return true;
    } catch (error) {
        Log.error('showItemInFolder error', error);
        return false;
    }
};

export default {
    execFFmpegCommand,
    extractAudioFromVideo,
    getFFmpegPath,
    getPythonPath,
    showItemInFolder,
};
