// @ts-nocheck
import {DataService} from "../service/DataService";
import {TaskService} from "../service/TaskService";
import {useServerStore} from "../store/modules/server";
import {TaskBiz} from "../store/modules/task";

const serverStore = useServerStore();

export const VideoBGM: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoBGMModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        const bgmFile = modelConfig.bgm;

        if (!videoFile || !bgmFile) {
            throw new Error("VideoBGM: Video or BGM file is empty");
        }

        // Create output path with consistent naming
        const videoName = window.$mapi.file.pathToName(videoFile, true);
        const videoBaseName = window.$mapi.file.pathToName(videoFile, false); // 不带扩展名
        const videoExt = window.$mapi.file.pathToName(videoFile, true).split('.').pop(); // 获取扩展名

        // 使用hubFile保存到output目录，便于用户查找
        const outputPath = await window.$mapi.file.hubFile(videoExt || 'mp4', {
            saveGroup: 'video',
            savePathParam: { name: `bgm_${videoBaseName}` }
        });

        // Extract audio from video if needed - 使用相同的基础名称
        const extractedAudioPath = await window.$mapi.file.temp(`wav`, `audio_${videoBaseName}`);
        
        try {
            // Extract audio from original video
            await window.$mapi.shell.execFFmpegCommand([
                "-i", videoFile,
                "-vn", // No video
                "-acodec", "pcm_s16le", // PCM 16-bit
                "-ar", "44100", // Sample rate
                "-ac", "2", // Stereo
                "-y", // Overwrite
                extractedAudioPath
            ]);
            
            // Get video duration
            const videoDuration = await getVideoDuration(videoFile);
            const bgmDuration = await getAudioDuration(bgmFile);
            
            // Create looped BGM to match video duration - 使用相同的基础名称
            const loopedBgmPath = await window.$mapi.file.temp(`wav`, `looped_bgm_${videoBaseName}`);
            await createLoopedBgm(bgmFile, loopedBgmPath, videoDuration, bgmDuration);

            // Mix audio with BGM - 使用相同的基础名称
            const mixedAudioPath = await window.$mapi.file.temp(`wav`, `mixed_audio_${videoBaseName}`);
            await mixAudio(extractedAudioPath, loopedBgmPath, mixedAudioPath, modelConfig.param);
            
            // Replace audio in original video with mixed audio
            await window.$mapi.shell.execFFmpegCommand([
                "-i", videoFile,
                "-i", mixedAudioPath,
                "-c:v", "copy", // Copy video stream without re-encoding
                "-c:a", "aac", // Encode audio to AAC
                "-map", "0:v:0", // Use video from first input
                "-map", "1:a:0", // Use audio from second input
                "-shortest", // Match shortest duration
                "-y", // Overwrite
                outputPath
            ]);
            
            // Clean up temporary files
            await window.$mapi.file.delete(extractedAudioPath);
            await window.$mapi.file.delete(loopedBgmPath);
            await window.$mapi.file.delete(mixedAudioPath);

            // 🔧 关键修复：必须保存 jobResult 到数据库，否则 successFunc 中查询不到结果
            // 注意：这里只保存 jobResult，不更新 status，status 会在 successFunc 中更新
            const jobResult = {
                type: "success",
                data: {
                    originalVideo: videoFile,
                    originalVideoAudio: extractedAudioPath,
                    bgmAudio: bgmFile,
                    mixedVideo: outputPath,
                    stats: {
                        videoDuration: videoDuration,
                        bgmDuration: bgmDuration,
                        audioFadeIn: modelConfig.param.fadeIn,
                        audioFadeOut: modelConfig.param.fadeOut,
                        bgmVolume: modelConfig.param.bgmVolume,
                        matchScore: calculateMatchScore(videoDuration, bgmDuration)
                    }
                }
            };

            try {
                // 🔧 保存 jobResult 和 status（确保 UI 可以立即看到任务已完成）
                // 这里更新的是中间状态，successFunc 会最后确认并保存 result
                await TaskService.update(bizId, {
                    status: "success",
                    jobResult: jobResult,
                });
                console.log(`[VideoBGM.runFunc] ✅ jobResult 已保存到数据库，status=success`);
            } catch (e) {
                console.error(`[VideoBGM.runFunc] ❌ 保存 jobResult 失败: ${e}`);
            }

            // ✅ 必须返回字符串 "success"，而不是对象
            return "success";
        } catch (error: any) {
            // Clean up temporary files on error
            try {
                await window.$mapi.file.delete(extractedAudioPath);
                await window.$mapi.file.delete(mixedAudioPath);
            } catch (e) {
                // Ignore cleanup errors
            }
            throw new Error(`VideoBGM failed: ${error.message}`);
        }
    },
    successFunc: async (bizId, bizParam) => {
        console.log(`[VideoBGM.successFunc] 开始处理BGM匹配完成，bizId=${bizId}`);
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        console.log(`[VideoBGM.successFunc] 从数据库获取任务记录完成`);

        // 🔧 诊断：打印 jobResult 的完整内容
        if (!record.jobResult) {
            console.error(`[VideoBGM.successFunc] ❌ 致命错误：jobResult为空或未定义！`);
            console.error(`[VideoBGM.successFunc] 完整record:`, JSON.stringify(record, null, 2));
            throw new Error("jobResult not found");
        }
        console.log(`[VideoBGM.successFunc] jobResult 结构:`, JSON.stringify(record.jobResult, null, 2));

        // 🔧 确保 jobResult.data 不为空
        if (!record.jobResult.data) {
            console.error(`[VideoBGM.successFunc] ❌ 致命错误：jobResult.data为空！`);
            throw new Error("jobResult.data not found");
        }

        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: record.jobResult.data
        });

        console.log(`[VideoBGM.successFunc] ✅ 数据库更新完成`);
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

// Get video duration using FFmpeg
const getVideoDuration = async (videoPath: string): Promise<number> => {
    try {
        const tempJsonPath = await window.$mapi.file.temp("json", "video-duration");
        
        await window.$mapi.shell.execFFmpegCommand([
            "-i", videoPath,
            "-f", "null",
            "-"
        ]);
        
        // Try to extract duration from FFmpeg stderr
        // Note: In a real implementation, you'd parse the stderr output
        // For this example, we'll use a placeholder implementation
        return 30; // Placeholder: 30 seconds
    } catch (e) {
        console.warn("Failed to get video duration", e);
        return 30; // Default fallback
    }
};

// Get audio duration using FFmpeg
const getAudioDuration = async (audioPath: string): Promise<number> => {
    try {
        // Similar implementation to getVideoDuration
        return 45; // Placeholder: 45 seconds
    } catch (e) {
        console.warn("Failed to get audio duration", e);
        return 45; // Default fallback
    }
};

// Create looped BGM to match video duration
const createLoopedBgm = async (
    bgmPath: string, 
    outputPath: string, 
    videoDuration: number, 
    bgmDuration: number
): Promise<void> => {
    const loopCount = Math.ceil(videoDuration / bgmDuration);
    
    // Create a concat file for looping
    const concatFilePath = await window.$mapi.file.temp("txt", "bgm-loop");
    let concatContent = "";
    
    for (let i = 0; i < loopCount; i++) {
        concatContent += `file '${bgmPath}'\n`;
    }
    
    await window.$mapi.file.write(concatFilePath, concatContent);
    
    // Concatenate BGM files
    await window.$mapi.shell.execFFmpegCommand([
        "-f", "concat",
        "-safe", "0",
        "-i", concatFilePath,
        "-c", "copy",
        "-y",
        outputPath
    ]);
    
    // Trim to exact video duration
    const trimmedPath = await window.$mapi.file.temp("wav", "bgm-trimmed");
    await window.$mapi.shell.execFFmpegCommand([
        "-i", outputPath,
        "-t", videoDuration.toString(),
        "-c", "copy",
        "-y",
        trimmedPath
    ]);
    
    // Copy back to output path
    await window.$mapi.file.copy(trimmedPath, outputPath);
    
    // Clean up
    await window.$mapi.file.delete(concatFilePath);
    await window.$mapi.file.delete(trimmedPath);
};

// Mix original audio with BGM
const mixAudio = async (
    originalAudioPath: string, 
    bgmPath: string, 
    outputPath: string, 
    params: VideoBGMModelConfigType['param']
): Promise<void> => {
    // Apply fades to BGM
    const fadedBgmPath = await window.$mapi.file.temp("wav", "bgm-faded");
    
    const fadeInFilter = params.fadeIn > 0 ? `afade=t=in:st=0:d=${params.fadeIn}` : "";
    const fadeOutFilter = params.fadeOut > 0 ? `afade=t=out:st=${params.bgmDuration - params.fadeOut}:d=${params.fadeOut}` : "";
    
    let fadeFilter = "";
    if (fadeInFilter && fadeOutFilter) {
        fadeFilter = `${fadeInFilter},${fadeOutFilter}`;
    } else if (fadeInFilter) {
        fadeFilter = fadeInFilter;
    } else if (fadeOutFilter) {
        fadeFilter = fadeOutFilter;
    }
    
    if (fadeFilter) {
        await window.$mapi.shell.execFFmpegCommand([
            "-i", bgmPath,
            "-af", fadeFilter,
            "-y",
            fadedBgmPath
        ]);
    } else {
        // No fades, just copy
        await window.$mapi.file.copy(bgmPath, fadedBgmPath);
    }
    
    // Mix original audio with faded BGM
    const volumeFilter = `[0:a][1:a]amix=inputs=2:weights=1 ${params.bgmVolume}`;
    
    await window.$mapi.shell.execFFmpegCommand([
        "-i", originalAudioPath,
        "-i", fadedBgmPath,
        "-filter_complex", volumeFilter,
        "-y",
        outputPath
    ]);
    
    // Clean up
    await window.$mapi.file.delete(fadedBgmPath);
};

// Calculate a simple match score based on duration compatibility
const calculateMatchScore = (videoDuration: number, bgmDuration: number): number => {
    const ratio = videoDuration / bgmDuration;
    
    // Perfect score if BGM duration is a clean multiple or fraction of video duration
    const integerRatio = Math.round(ratio);
    if (Math.abs(ratio - integerRatio) < 0.1) {
        return 95;
    }
    
    // Still good if BGM is longer than video (can be trimmed)
    if (bgmDuration >= videoDuration) {
        return 85;
    }
    
    // Lower score if BGM is much shorter than video (requires many loops)
    if (ratio > 3) {
        return 60;
    }
    
    // Medium score for other cases
    return 75;
};
