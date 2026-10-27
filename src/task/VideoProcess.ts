// @ts-nocheck
import {DataService} from "../service/DataService";
import {TaskService} from "../service/TaskService";
import {useServerStore} from "../store/modules/server";
import {TaskBiz} from "../store/modules/task";

const serverStore = useServerStore();

export const VideoProcess: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoProcessModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        
        if (!videoFile) {
            throw new Error("VideoFileEmpty");
        }
        
        // Create output path
        const videoName = window.$mapi.file.pathToName(videoFile, true);
        const outputFileName = `processed_${videoName}`;
        const outputPath = await window.$mapi.file.temp(outputFileName);
        
        // Prepare processing parameters
        const param = modelConfig.param;
        
        // 根据处理模式选择不同的算法
        let processingMethod: string;
        let processingParams: string[];
        
        if (param.processingMode === "jumpcutter") {
            // 使用JumpCutter算法
            processingMethod = "jumpcutter";
            processingParams = [
                "--input", videoFile,
                "--output", outputPath,
                "--magnitude-threshold-ratio", param.magnitudeThresholdRatio.toString(),
                "--duration-threshold", param.durationThreshold.toString(),
                "--failure-tolerance-ratio", param.failureToleranceRatio.toString(),
                "--space-on-edges", param.spaceOnEdges.toString(),
                "--cut", param.cut
            ];
        } else {
            // 使用FFmpeg一键剪气口算法（推荐）
            processingMethod = "ffmpeg_silence_detect";
            processingParams = [
                "-i", videoFile,
                "-af", "silencedetect=noise=-30dB:d=0.5",
                "-f", "null", "-"
            ];
        }
        
        // Add optional parameters (only for jumpcutter mode)
        if (processingMethod === "jumpcutter") {
            if (param.silencePartSpeed) {
                processingParams.push("--silence-part-speed", param.silencePartSpeed.toString());
            }
            
            if (param.minLoudPartDuration > -1) {
                processingParams.push("--min-loud-part-duration", param.minLoudPartDuration.toString());
            }
            
            if (param.codec) {
                processingParams.push("--codec", param.codec);
            }
            
            if (param.bitrate) {
                processingParams.push("--bitrate", param.bitrate);
            }
        }
        
        try {
            if (processingMethod === "jumpcutter") {
                // Execute JumpCutter using Python script
                const jumpcutterScriptPath = await getJumpcutterScriptPath();
                
                // Execute Python script with parameters
                const pythonCommand = [
                    jumpcutterScriptPath,
                    ...processingParams
                ];
                
                await window.$mapi.app.shell(pythonCommand.join(" "), {
                    cwd: await window.$mapi.file.tempDir()
                });
            } else {
                // 使用FFmpeg一键剪气口算法
                await executeSilenceDetection(videoFile, outputPath);
            }
            
            // Get video duration statistics
            const originalStats = await getVideoStats(videoFile);
            const processedStats = await getVideoStats(outputPath);
            
            return {
                type: "success",
                data: {
                    originalVideo: videoFile,
                    processedVideo: outputPath,
                    stats: {
                        originalDuration: originalStats.duration,
                        processedDuration: processedStats.duration,
                        silenceRemoved: originalStats.duration - processedStats.duration
                    }
                }
            };
        } catch (error: any) {
            throw new Error(`VideoProcess failed: ${error.message}`);
        }
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        
        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: record.jobResult.data
        });
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

// Get the path to the JumpCutter Python script
const getJumpcutterScriptPath = async (): Promise<string> => {
    const scriptName = "jumpcutter_wrapper.py";
    const scriptDir = window.$mapi.path.join(await window.$mapi.app.appEnv(), "scripts");
    return window.$mapi.path.join(scriptDir, scriptName);
};

// Execute silence detection and removal using FFmpeg
const executeSilenceDetection = async (inputVideo: string, outputVideo: string): Promise<void> => {
    console.log('[executeSilenceDetection] 开始执行FFmpeg静音检测...');

    // 步骤1: 检测静音片段
    const silenceDetectOutput = await window.$mapi.shell.execFFmpegCommand([
        "-i", inputVideo,
        "-af", "silencedetect=noise=-30dB:d=0.5",
        "-f", "null",
        "-"
    ]);

    console.log('[executeSilenceDetection] 静音检测完成');

    // 步骤2: 解析静音片段的时间戳
    const silenceRegex = /silence_start: ([\d.]+).*?silence_end: ([\d.]+)/g;
    const silenceSegments: Array<{start: number, end: number}> = [];
    let match;

    while ((match = silenceRegex.exec(silenceDetectOutput)) !== null) {
        silenceSegments.push({
            start: parseFloat(match[1]),
            end: parseFloat(match[2])
        });
    }

    console.log(`[executeSilenceDetection] 检测到 ${silenceSegments.length} 个静音片段`);

    if (silenceSegments.length === 0) {
        // 没有检测到静音，直接复制原视频
        console.log('[executeSilenceDetection] 未检测到静音片段，复制原视频');
        await window.$mapi.file.copy(inputVideo, outputVideo);
        return;
    }

    // 步骤3: 构建保留片段（非静音部分）
    const keepSegments: Array<{start: number, end: number}> = [];
    let lastEnd = 0;

    // 获取视频总时长
    const videoStats = await getVideoStats(inputVideo);
    const totalDuration = videoStats.duration;

    for (const silence of silenceSegments) {
        if (lastEnd < silence.start) {
            keepSegments.push({
                start: lastEnd,
                end: silence.start
            });
        }
        lastEnd = silence.end;
    }

    // 添加最后一个片段
    if (lastEnd < totalDuration) {
        keepSegments.push({
            start: lastEnd,
            end: totalDuration
        });
    }

    console.log(`[executeSilenceDetection] 保留 ${keepSegments.length} 个片段`);

    // 步骤4: 分割并合并保留的片段
    const tempSegments: string[] = [];
    const tempListFile = await window.$mapi.file.temp("txt", "segment-list");

    for (let i = 0; i < keepSegments.length; i++) {
        const segment = keepSegments[i];
        const segmentFile = await window.$mapi.file.temp("mp4", `segment-${i}`);

        // 提取片段
        await window.$mapi.shell.execFFmpegCommand([
            "-i", inputVideo,
            "-ss", segment.start.toString(),
            "-to", segment.end.toString(),
            "-c", "copy",
            "-y",
            segmentFile
        ]);

        tempSegments.push(segmentFile);
    }

    // 步骤5: 创建合并列表
    const listContent = tempSegments.map(f => `file '${f}'`).join('\n');
    await window.$mapi.file.write(tempListFile, listContent);

    // 步骤6: 合并所有片段
    await window.$mapi.shell.execFFmpegCommand([
        "-f", "concat",
        "-safe", "0",
        "-i", tempListFile,
        "-c", "copy",
        "-y",
        outputVideo
    ]);

    console.log('[executeSilenceDetection] FFmpeg剪气口处理完成');

    // 清理临时文件
    for (const tempFile of tempSegments) {
        try {
            await window.$mapi.file.delete(tempFile);
        } catch (e) {
            console.warn(`清理临时文件失败: ${tempFile}`, e);
        }
    }
    try {
        await window.$mapi.file.delete(tempListFile);
    } catch (e) {
        console.warn(`清理列表文件失败: ${tempListFile}`, e);
    }
};

// Get video statistics using FFprobe (更可靠)
const getVideoStats = async (videoPath: string): Promise<{duration: number}> => {
    try {
        // 使用 ffprobe 获取视频时长（JSON格式）
        const result = await window.$mapi.shell.execCommand(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:nokey=0 "${videoPath}"`,
            {timeout: 30000}
        );

        const durationStr = result.trim();
        const duration = parseFloat(durationStr);

        if (!isNaN(duration) && duration > 0) {
            console.log(`[getVideoStats] 获取视频时长: ${duration.toFixed(2)}s`);
            return { duration };
        }

        // fallback: 使用 ffmpeg 方法
        console.warn(`[getVideoStats] ffprobe 解析失败，尝试 ffmpeg 方法`);
        return getVideoStatsFallback(videoPath);
    } catch (e) {
        console.warn(`[getVideoStats] 获取视频统计信息失败: ${e}`);
        return getVideoStatsFallback(videoPath);
    }
};

// Fallback 方法: 使用 ffmpeg -i 获取时长
const getVideoStatsFallback = async (videoPath: string): Promise<{duration: number}> => {
    try {
        const result = await window.$mapi.shell.execCommand(
            `ffmpeg -i "${videoPath}" 2>&1 | findstr "Duration"`,
            {timeout: 30000}
        );

        // 解析 "Duration: HH:MM:SS.ms" 格式
        const match = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(result);
        if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const seconds = parseFloat(match[3]);
            const duration = hours * 3600 + minutes * 60 + seconds;

            console.log(`[getVideoStats] Fallback 获取视频时长: ${duration.toFixed(2)}s`);
            return { duration };
        }

        return { duration: 0 };
    } catch (e) {
        console.error(`[getVideoStats] 所有方法都失败了`, e);
        return { duration: 0 };
    }
};
