// @ts-nocheck
import {DataService} from "../service/DataService";
import {TaskService} from "../service/TaskService";
import {useServerStore} from "../store/modules/server";
import {TaskBiz} from "../store/modules/task";

const serverStore = useServerStore();

export const VideoPublish: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoPublishModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        
        if (!videoFile) {
            throw new Error("VideoPublish: Video file is empty");
        }
        
        // Create output path
        const videoName = window.$mapi.file.pathToName(videoFile, true);
        const outputFileName = `published_${videoName}`;
        const outputPath = await window.$mapi.file.temp(outputFileName);
        
        // Results object to store intermediate results
        const results = {
            finalVideo: "",
            videoAsrResult: null,
            videoProcessResult: null,
            videoSubtitleResult: null,
            videoBgmResult: null,
            videoCoverResult: null,
            publishResult: null,
            stats: {}
        };
        
        // Temporary files storage
        const tempFiles = [];
        
        try {
            // Progress tracking
            const updateProgress = async (progress: number, message: string) => {
                await TaskService.update(bizId, {
                    statusMsg: `${progress}% - ${message}`
                });
            };
            
            // Start with the original video
            let currentVideo = videoFile;
            
            // Step 1: Video to Text (if enabled)
            await updateProgress(10, $t("正在转换视频为文字"));
            if (modelConfig.workflows.includes("asr")) {
                try {
                    const asrResult = await runVideoAsr(currentVideo, modelConfig.videoAsrConfig);
                    results.videoAsrResult = asrResult;
                } catch (error: any) {
                    console.warn("Video ASR failed:", error.message);
                    results.videoAsrResult = { error: error.message, transcript: "" };
                }
            }
            
            // Step 2: Smart Editing (if enabled)
            await updateProgress(25, $t("正在智能剪辑视频"));
            if (modelConfig.workflows.includes("process")) {
                try {
                    const processResult = await runVideoProcess(currentVideo, modelConfig.videoProcessConfig);
                    results.videoProcessResult = processResult;
                    currentVideo = processResult.processedVideo;
                    tempFiles.push(processResult.processedVideo);
                } catch (error: any) {
                    console.warn("Video Process failed:", error.message);
                    results.videoProcessResult = { error: error.message };
                    // Continue with original video
                }
            }
            
            // Step 3: Subtitle Creation (if enabled)
            await updateProgress(40, $t("正在生成字幕"));
            if (modelConfig.workflows.includes("subtitle")) {
                try {
                    const subtitleResult = await runVideoSubtitle(
                        currentVideo, 
                        modelConfig.videoSubtitleConfig,
                        results.videoAsrResult?.transcript
                    );
                    results.videoSubtitleResult = subtitleResult;
                    currentVideo = subtitleResult.subtitleVideo;
                    tempFiles.push(subtitleResult.subtitleVideo);
                } catch (error: any) {
                    console.warn("Video Subtitle failed:", error.message);
                    results.videoSubtitleResult = { error: error.message };
                    // Continue with current video
                }
            }
            
            // Step 4: BGM Matching (if enabled)
            await updateProgress(55, $t("正在匹配BGM"));
            if (modelConfig.workflows.includes("bgm") && modelConfig.bgmFile) {
                try {
                    const bgmResult = await runVideoBgm(currentVideo, modelConfig.bgmFile, modelConfig.videoBgmConfig);
                    results.videoBgmResult = bgmResult;
                    currentVideo = bgmResult.mixedVideo;
                    tempFiles.push(bgmResult.mixedVideo);
                } catch (error: any) {
                    console.warn("Video BGM failed:", error.message);
                    results.videoBgmResult = { error: error.message };
                    // Continue with current video
                }
            }
            
            // Step 5: Cover Generation (if enabled)
            await updateProgress(70, $t("正在生成封面"));
            if (modelConfig.workflows.includes("cover")) {
                try {
                    const coverResult = await runVideoCover(currentVideo, modelConfig.videoCoverConfig);
                    results.videoCoverResult = coverResult;
                    tempFiles.push(coverResult.coverImage);
                } catch (error: any) {
                    console.warn("Video Cover failed:", error.message);
                    results.videoCoverResult = { error: error.message };
                }
            }
            
            // Step 6: Final output processing
            await updateProgress(85, $t("正在生成最终视频"));
            
            // Copy current video to final output path
            await window.$mapi.file.copy(currentVideo, outputPath);
            results.finalVideo = outputPath;
            
            // Step 7: Publishing (if enabled)
            await updateProgress(95, $t("正在发布"));
            if (modelConfig.workflows.includes("publish") && modelConfig.publishConfig) {
                try {
                    const publishResult = await runPublish(
                        currentVideo, 
                        results.videoCoverResult?.coverImage,
                        modelConfig.publishConfig
                    );
                    results.publishResult = publishResult;
                } catch (error: any) {
                    console.warn("Publish failed:", error.message);
                    results.publishResult = { error: error.message, platform: "none" };
                }
            }
            
            // Clean up temporary files
            await cleanupTempFiles(tempFiles);
            
            // Prepare final stats
            results.stats = {
                workflows: modelConfig.workflows,
                originalVideo: videoFile,
                finalVideo: outputPath,
                stepsCompleted: {
                    asr: !!results.videoAsrResult,
                    process: !!results.videoProcessResult,
                    subtitle: !!results.videoSubtitleResult,
                    bgm: !!results.videoBgmResult,
                    cover: !!results.videoCoverResult,
                    publish: !!results.publishResult
                }
            };
            
            await updateProgress(100, $t("处理完成"));
            
            return {
                type: "success",
                data: results
            };
        } catch (error: any) {
            // Clean up temporary files on error
            await cleanupTempFiles(tempFiles);
            throw new Error(`VideoPublish failed: ${error.message}`);
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

// Run Video ASR process
const runVideoAsr = async (videoFile: string, config: any): Promise<any> => {
    // In a real implementation, this would call the VideoAsr task
    // For now, return a mock result
    return {
        transcript: "这是示例视频转录文本",
        segments: [],
        srtFile: ""
    };
};

// Run Video Process
const runVideoProcess = async (videoFile: string, config: any): Promise<any> => {
    // In a real implementation, this would call the VideoProcess task
    const videoName = window.$mapi.file.pathToName(videoFile, true);
    const outputPath = await window.$mapi.file.temp(`processed_${videoName}`);
    
    // Copy the original file to output path as a placeholder
    await window.$mapi.file.copy(videoFile, outputPath);
    
    return {
        originalVideo: videoFile,
        processedVideo: outputPath,
        stats: {
            originalDuration: 120,
            processedDuration: 90,
            silenceRemoved: 30
        }
    };
};

// Run Video Subtitle
const runVideoSubtitle = async (videoFile: string, config: any, transcript: string): Promise<any> => {
    // In a real implementation, this would call the VideoSubtitle task
    const videoName = window.$mapi.file.pathToName(videoFile, true);
    const outputPath = await window.$mapi.file.temp(`subtitle_${videoName}`);
    
    // Copy the original file to output path as a placeholder
    await window.$mapi.file.copy(videoFile, outputPath);
    
    return {
        originalVideo: videoFile,
        subtitleVideo: outputPath,
        subtitleStyle: "default",
        subtitleFile: "",
        stats: {}
    };
};

// Run Video BGM
const runVideoBgm = async (videoFile: string, bgmFile: string, config: any): Promise<any> => {
    // In a real implementation, this would call the VideoBGM task
    const videoName = window.$mapi.file.pathToName(videoFile, true);
    const outputPath = await window.$mapi.file.temp(`bgm_${videoName}`);
    
    // Copy the original file to output path as a placeholder
    await window.$mapi.file.copy(videoFile, outputPath);
    
    return {
        originalVideo: videoFile,
        bgmAudio: bgmFile,
        mixedVideo: outputPath,
        stats: {
            videoDuration: 120,
            bgmDuration: 45,
            bgmVolume: config.bgmVolume || 0.3
        }
    };
};

// Run Video Cover
const runVideoCover = async (videoFile: string, config: any): Promise<any> => {
    // In a real implementation, this would call the VideoCover task
    const videoName = window.$mapi.file.pathToName(videoFile, true);
    const outputFileName = `cover_${videoName.replace(/\.[^/.]+$/, "")}.png`;
    const outputPath = await window.$mapi.file.temp(outputFileName);
    
    // Create a placeholder image file
    // In a real implementation, you would extract a frame from the video
    // For now, just return a mock path
    return {
        originalVideo: videoFile,
        coverImage: outputPath,
        timePoint: 10,
        width: 1920,
        height: 1080,
        textOverlay: config.textOverlay || null
    };
};

// Run Publishing
const runPublish = async (videoFile: string, coverImage: string, config: any): Promise<any> => {
    // In a real implementation, this would upload the video to the specified platform
    const platform = config.platform || "local";
    
    // Simulate publishing process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        videoFile: videoFile,
        coverImage: coverImage,
        platform: platform,
        url: platform === "local" ? "file://" + videoFile : `https://${platform}.example.com/video/12345`,
        timestamp: Date.now()
    };
};

// Clean up temporary files
const cleanupTempFiles = async (tempFiles: string[]): Promise<void> => {
    for (const file of tempFiles) {
        try {
            await window.$mapi.file.delete(file);
        } catch (e) {
            console.warn("Failed to delete temp file:", file, e);
        }
    }
};
