import { ipcMain } from "electron";
import shellApi from "./index";
import { Log } from "../log";
import { normalizePath } from "../../lib/path-util";
import { ProcessCleanupManager } from "../../lib/process-cleanup";

console.log("[shell/main.ts] Module loaded, registering IPC handlers...");

// 注册 showItemInFolder handler
ipcMain.handle("shell:showItemInFolder", async (event, filePath: string) => {
    return shellApi.showItemInFolder(filePath);
});

// 注册 exec handler (用于执行系统命令如 python、nvidia-smi、taskkill 等)
ipcMain.handle("shell:exec", async (event, command: string) => {
    console.log("[shell:exec] Handler called, command:", command.substring(0, 100) + (command.length > 100 ? '...' : ''));
    Log.info("shell:exec.start", { command: command.substring(0, 200) + '...' });

    try {
        const { spawn } = await import('child_process');
        const { AppEnv, waitAppEnvReady } = await import('../env');

        // 等待AppEnv初始化完成
        await waitAppEnvReady();

        // 获取工作目录
        const cwd = AppEnv.appRoot || process.cwd();

        return new Promise((resolve, reject) => {
            console.log('[shell.exec] 执行命令:', command);

            const child = spawn(command, [], {
                cwd,
                shell: true,
                env: process.env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // 注册子进程到清理管理器
            if (child.pid) {
                ProcessCleanupManager.registerChildProcess(child.pid);
            }

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                // 进程结束时注销
                if (child.pid) {
                    ProcessCleanupManager.unregisterChildProcess(child.pid);
                }
                console.log('[shell.exec] 命令完成，退出码:', code);
                if (code === 0) {
                    resolve(stdout);
                } else {
                    console.warn('[shell.exec] 命令执行失败，退出码:', code, 'stderr:', stderr);
                    resolve(stdout); // 返回stdout而不是抛出错误，保持与旧版本兼容
                }
            });

            child.on('error', (error) => {
                // 进程错误时注销
                if (child.pid) {
                    ProcessCleanupManager.unregisterChildProcess(child.pid);
                }
                console.error('[shell.exec] 进程错误:', error);
                reject(error);
            });
        });
    } catch (error: any) {
        Log.error("shell:exec.error", {
            error: error?.message || String(error),
            command: command.substring(0, 200) + '...'
        });
        throw error;
    }
});

// 注册 getPythonPath handler
ipcMain.handle("shell:getPythonPath", async (event) => {
    console.log("[shell:getPythonPath] Handler called");
    Log.info("shell:getPythonPath.start");

    try {
        return await shellApi.getPythonPath();
    } catch (error: any) {
        Log.error("shell:getPythonPath.error", {
            error: error?.message || String(error)
        });
        throw error;
    }
});

// 注册 executeFFmpeg handler
ipcMain.handle("shell:executeFFmpeg", async (event, commandOrJson: string) => {
    console.log("[shell:executeFFmpeg] Handler called, command length:", commandOrJson.length);
    Log.info("shell:executeFFmpeg.start", { commandLength: commandOrJson.length });

    try {
        // 检查是否是JSON数组格式（args数组模式，避免路径拼接问题）
        if (commandOrJson.startsWith('[')) {
            const argsArray = JSON.parse(commandOrJson);
            if (Array.isArray(argsArray)) {
                Log.info("shell:executeFFmpeg.arrayMode", {
                    argsCount: argsArray.length
                });
                return await shellApi.execFFmpegCommand(argsArray);
            }
        }

        // 检查是否是JSON格式（长过滤器模式）
        if (commandOrJson.startsWith('{')) {
            const data = JSON.parse(commandOrJson);

            if (data.type === 'ffmpeg_long_filter') {
                Log.info("shell:executeFFmpeg.longFilter", {
                    inputVideo: data.inputVideo,
                    outputVideo: data.outputVideo,
                    filterLength: data.filterComplex.length,
                    hasAudioMix: !!data.audioMixConfig  // 🆕 记录是否有音效混音
                });

                // 🔧 转换输入输出路径
                const normalizedInputVideo = normalizePath(data.inputVideo);
                const normalizedOutputVideo = normalizePath(data.outputVideo);

                Log.info("shell:executeFFmpeg.pathNormalized", {
                    originalInput: data.inputVideo.substring(0, 100),
                    normalizedInput: normalizedInputVideo.substring(0, 100),
                    originalOutput: data.outputVideo.substring(0, 100),
                    normalizedOutput: normalizedOutputVideo.substring(0, 100)
                });

                // 【修复】如果filter_complex过长，写入文件使用新语法 -/filter_complex
                // 避免Windows命令行长度限制（某些情况下单个参数>32KB会失败）
                // 注意：FFmpeg N-122209 已弃用 -filter_complex_script，改用 -/filter_complex
                const { promises: fs } = await import('fs');
                const path = await import('path');
                const os = await import('os');

                // 🆕 处理音效混音配置
                const audioMixConfig = data.audioMixConfig;
                let finalFilterContent = data.filterComplex;
                let audioInputArgs: string[] = [];
                let useAudioMix = false;

                if (audioMixConfig && audioMixConfig.inputFiles && audioMixConfig.inputFiles.length > 0) {
                    console.log(`[shell:executeFFmpeg] 🔊 检测到音效混音配置:`, {
                        inputFilesCount: audioMixConfig.inputFiles.length,
                        mixFilter: audioMixConfig.mixFilter
                    });

                    // 🔧 转换音效文件路径并添加为额外输入
                    for (const soundFile of audioMixConfig.inputFiles) {
                        const normalizedSoundFile = normalizePath(soundFile);
                        audioInputArgs.push('-i', normalizedSoundFile);
                        Log.info("shell:executeFFmpeg.soundFileNormalized", {
                            original: soundFile.substring(0, 100),
                            normalized: normalizedSoundFile.substring(0, 100)
                        });
                    }

                    // 🔧 关键修复：修改视频滤镜链的末尾，添加 [vout] 输出标签
                    // 原始滤镜链末尾没有输出标签，例如：[outN]drawtext=...
                    // 需要改为：[outN]drawtext=...[vout]
                    // 然后添加音频混音滤镜

                    let modifiedVideoFilter = data.filterComplex;

                    // 检查最后一个滤镜是否已有输出标签
                    // 如果没有，添加 [vout]
                    if (!modifiedVideoFilter.endsWith(']')) {
                        // 最后一个滤镜没有输出标签，添加 [vout]
                        modifiedVideoFilter = modifiedVideoFilter + '[vout]';
                        console.log(`[shell:executeFFmpeg] 🔊 添加视频输出标签 [vout]`);
                    } else {
                        // 最后一个滤镜已有输出标签（可能是 [out0]、[out1] 等）
                        // 需要提取这个标签名称，然后添加一个 null 滤镜连接到 [vout]
                        // 从滤镜链末尾提取最后一个输出标签，例如 [out5]
                        const lastLabelMatch = modifiedVideoFilter.match(/\[([^\[\]]+)\]$/);
                        if (lastLabelMatch) {
                            const lastLabel = lastLabelMatch[1];
                            modifiedVideoFilter = modifiedVideoFilter + `;[${lastLabel}]null[vout]`;
                            console.log(`[shell:executeFFmpeg] 🔊 通过 null 滤镜连接 [${lastLabel}] -> [vout]`);
                        } else {
                            // 无法提取标签，尝试直接添加 [vout]
                            modifiedVideoFilter = modifiedVideoFilter + '[vout]';
                            console.log(`[shell:executeFFmpeg] 🔊 无法提取最后标签，直接添加 [vout]`);
                        }
                    }

                    // 将音频混音滤镜添加到末尾
                    finalFilterContent = modifiedVideoFilter + ';' + audioMixConfig.mixFilter;
                    useAudioMix = true;

                    console.log(`[shell:executeFFmpeg] 🔊 组合滤镜长度: ${finalFilterContent.length}`);
                }

                const tempDir = os.tmpdir();
                const filterScriptPath = path.join(tempDir, `ffmpeg_filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`);

                console.log(`[shell:executeFFmpeg] 将filter_complex写入文件: ${filterScriptPath}`);
                await fs.writeFile(filterScriptPath, finalFilterContent, 'utf-8');

                // 🆕 根据是否有音效混音，构建不同的参数
                let args: string[];
                if (useAudioMix) {
                    // 有音效时：添加音效输入，映射视频和音频输出
                    // 使用新语法 -/filter_complex 而不是已弃用的 -filter_complex_script
                    args = [
                        '-y',
                        '-i', normalizedInputVideo,  // 🔧 使用转换后的路径
                        ...(data.stickerInputs || []), // 🆕 添加贴纸输入
                        ...audioInputArgs,  // 音效文件输入（已转换）
                        '-/filter_complex', filterScriptPath,
                        '-map', '[vout]',
                        '-map', '[aout]',
                        '-c:v', 'libx264',
                        '-preset', 'medium',
                        '-crf', '18',
                        '-c:a', 'aac',  // 需要重新编码音频
                        '-b:a', '192k',
                        normalizedOutputVideo  // 🔧 使用转换后的路径
                    ];
                    console.log(`[shell:executeFFmpeg] 🔊 使用音效混音模式执行 FFmpeg`);
                } else {
                    // 无音效时：原始逻辑
                    // 注意：新版 FFmpeg 使用 -/filter_complex 参数从文件读取
                    args = [
                        '-y',
                        '-i', normalizedInputVideo,  // 🔧 使用转换后的路径
                        ...(data.stickerInputs || []), // 🆕 添加贴纸输入
                        '-/filter_complex', filterScriptPath,
                        '-c:v', 'libx264',
                        '-preset', 'medium',
                        '-crf', '18',
                        '-c:a', 'copy',
                        normalizedOutputVideo  // 🔧 使用转换后的路径
                    ];
                }

                try {
                    const result = await shellApi.execFFmpegCommand(args);
                    try { await fs.unlink(filterScriptPath); } catch (e) {}
                    return result;
                } catch (error: any) {
                    const exitCode = error?.message ? parseInt(error.message.match(/code\s+(\d+)/)?.[1] || '0') : 0;
                    if (exitCode !== 0) {
                        Log.warn("shell:executeFFmpeg.filterFileMode.failed", {
                            exitCode,
                            trying: "filter_complex_script fallback"
                        });
                        try {
                            const fallbackArgs = args.map(a => a === '-/filter_complex' ? '-filter_complex_script' : a);
                            const result2 = await shellApi.execFFmpegCommand(fallbackArgs);
                            try { await fs.unlink(filterScriptPath); } catch (e) {}
                            return result2;
                        } catch (error2: any) {
                            Log.warn("shell:executeFFmpeg.filter_complex_script.failed", {
                                error: error2?.message?.substring(0, 200),
                                trying: "inline filter_complex fallback"
                            });
                            try {
                                const inlineArgs = args
                                    .filter(a => a !== '-/filter_complex' && a !== '-filter_complex_script' && a !== filterScriptPath)
                                ;
                                const inlineIdx = inlineArgs.indexOf('-y') >= 0 ? 1 : 0;
                                inlineArgs.splice(inlineIdx, 0, '-filter_complex', finalFilterContent);
                                const result3 = await shellApi.execFFmpegCommand(inlineArgs);
                                try { await fs.unlink(filterScriptPath); } catch (e) {}
                                return result3;
                            } catch (error3) {
                                try { await fs.unlink(filterScriptPath); } catch (e) {}
                                throw error3;
                            }
                        }
                    }
                    try { await fs.unlink(filterScriptPath); } catch (e) {}
                    throw error;
                }
            }
        }

        // 普通命令模式：解析命令字符串为参数数组
        const args = parseFFmpegCommand(commandOrJson);

        Log.info("shell:executeFFmpeg.normalCommand", {
            argsCount: args.length,
            command: commandOrJson.substring(0, 200) + '...'
        });

        return await shellApi.execFFmpegCommand(args);

    } catch (error: any) {
        Log.error("shell:executeFFmpeg.error", {
            error: error?.message || String(error),
            command: commandOrJson.substring(0, 200) + '...'
        });
        throw error;
    }
});

console.log("[shell/main.ts] IPC handlers registered!");

/**
 * 解析FFmpeg命令字符串为参数数组
 */
function parseFFmpegCommand(command: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    const cmdStr = command.startsWith('ffmpeg ') ? command.substring(7) : command;

    for (let i = 0; i < cmdStr.length; i++) {
        const char = cmdStr[i];

        if ((char === '"' || char === "'") && !inQuote) {
            inQuote = true;
            quoteChar = char;
        } else if (char === quoteChar && inQuote) {
            inQuote = false;
            quoteChar = '';
        } else if (char === ' ' && !inQuote) {
            if (current.length > 0) {
                args.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        args.push(current);
    }

    return args;
}

export const shell = {
    execFFmpegCommand: shellApi.execFFmpegCommand,
    extractAudioFromVideo: shellApi.extractAudioFromVideo,
    getPythonPath: shellApi.getPythonPath,
    showItemInFolder: shellApi.showItemInFolder,
};

export default shell;
