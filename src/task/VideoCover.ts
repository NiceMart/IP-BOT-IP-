// @ts-nocheck
import {DataService} from "../service/DataService";
import {TaskService} from "../service/TaskService";
import {useServerStore} from "../store/modules/server";
import {TaskBiz} from "../store/modules/task";

const serverStore = useServerStore();

export const VideoCover: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoCoverModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        
        if (!videoFile) {
            throw new Error("VideoCover: Video file is empty");
        }
        
        // Create output path
        const videoName = window.$mapi.file.pathToName(videoFile, true);
        const outputFileName = `cover_${videoName.replace(/\.[^/.]+$/, "")}.png`;
        const outputPath = await window.$mapi.file.temp(outputFileName);
        
        // Determine the time point for screenshot
        const timePoint = modelConfig.param.timePointType === "random" 
            ? await getRandomTimePoint(videoFile)
            : modelConfig.param.customTimePoint;
        
        try {
            // Get video dimensions
            const videoInfo = await getVideoInfo(videoFile);
            
            // Extract frame at specified time point
            const screenshotPath = await window.$mapi.file.temp(`screenshot_${videoName.replace(/\.[^/.]+$/, "")}.png`);
            
            await window.$mapi.shell.execFFmpegCommand([
                "-i", videoFile,
                "-ss", timePoint.toString(),
                "-vframes", "1",
                "-y",
                screenshotPath
            ]);
            
            // Apply text overlay if specified
            let finalImagePath = screenshotPath;
            if (modelConfig.param.textOverlay && modelConfig.param.textOverlay.trim()) {
                finalImagePath = await applyTextOverlay(
                    screenshotPath, 
                    outputPath,
                    modelConfig.param.textOverlay,
                    modelConfig.param,
                    videoInfo
                );
            } else {
                // No text overlay, just copy the screenshot to output path
                await window.$mapi.file.copy(screenshotPath, outputPath);
            }
            
            // Get image dimensions
            const imageInfo = await getImageInfo(finalImagePath);
            
            // Clean up temporary files
            if (finalImagePath !== screenshotPath) {
                await window.$mapi.file.delete(screenshotPath);
            }
            
            return {
                type: "success",
                data: {
                    originalVideo: videoFile,
                    coverImage: finalImagePath,
                    timePoint: timePoint,
                    width: imageInfo.width,
                    height: imageInfo.height,
                    textOverlay: modelConfig.param.textOverlay || null,
                    fontSize: modelConfig.param.fontSize,
                    stats: {
                        videoInfo: {
                            duration: videoInfo.duration,
                            width: videoInfo.width,
                            height: videoInfo.height
                        },
                        imageInfo: imageInfo
                    }
                }
            };
        } catch (error: any) {
            throw new Error(`VideoCover failed: ${error.message}`);
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

// Get video information using FFmpeg
const getVideoInfo = async (videoPath: string): Promise<{width: number, height: number, duration: number}> => {
    try {
        // In a real implementation, you would parse the output of FFmpeg
        // For this example, we'll use a placeholder implementation
        return {
            width: 1920,  // Placeholder
            height: 1080, // Placeholder
            duration: 120 // Placeholder: 120 seconds
        };
    } catch (e) {
        console.warn("Failed to get video info", e);
        return {
            width: 1920,
            height: 1080,
            duration: 120
        };
    }
};

// Get image information using FFmpeg
const getImageInfo = async (imagePath: string): Promise<{width: number, height: number}> => {
    try {
        // In a real implementation, you would parse the output of FFmpeg
        // For this example, we'll use a placeholder implementation
        return {
            width: 1920,
            height: 1080
        };
    } catch (e) {
        console.warn("Failed to get image info", e);
        return {
            width: 1920,
            height: 1080
        };
    }
};

// Get a random time point from the video
const getRandomTimePoint = async (videoPath: string): Promise<number> => {
    try {
        const videoInfo = await getVideoInfo(videoPath);
        
        // Avoid the first and last 5 seconds
        const minTime = Math.min(5, videoInfo.duration * 0.1);
        const maxTime = Math.max(videoInfo.duration - 5, videoInfo.duration * 0.9);
        
        // Generate random time between minTime and maxTime
        const randomTime = Math.random() * (maxTime - minTime) + minTime;
        
        return randomTime;
    } catch (e) {
        console.warn("Failed to get random time point", e);
        return 10; // Default fallback: 10 seconds
    }
};

// Apply text overlay to the image
const applyTextOverlay = async (
    inputImagePath: string, 
    outputImagePath: string,
    text: string,
    params: VideoCoverModelConfigType['param'],
    videoInfo: {width: number, height: number}
): Promise<string> => {
    // 根据特效类型选择不同的滤镜
    const effectType = params.effectType || "standard";
    
    // Build the text overlay filter
    const fontSize = params.fontSize;
    const fontColor = params.fontColor;
    const position = params.position;
    const backgroundColor = params.backgroundColor;
    const backgroundOpacity = params.backgroundOpacity / 100; // Convert percentage to decimal
    
    // Determine text position
    let xPosition = "10";
    let yPosition = "10";
    
    switch (position) {
        case "top-left":
            xPosition = "10";
            yPosition = `h-text_h-10`;
            break;
        case "top-right":
            xPosition = `w-text_w-10`;
            yPosition = `h-text_h-10`;
            break;
        case "bottom-left":
            xPosition = "10";
            yPosition = "10";
            break;
        case "bottom-right":
            xPosition = `w-text_w-10`;
            yPosition = "10";
            break;
        case "center":
            xPosition = `(w-text_w)/2`;
            yPosition = `(h-text_h)/2`;
            break;
        default:
            // Default to bottom-left
            xPosition = "10";
            yPosition = "10";
    }
    
    // 根据特效类型构建不同的滤镜
    let drawtextFilter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${xPosition}:y=${yPosition}`;
    
    switch (effectType) {
        case "shadow":
            drawtextFilter += `:shadowcolor=black:shadowx=2:shadowy=2`;
            break;
        case "glow":
            drawtextFilter += `:shadowcolor=yellow:shadowx=0:shadowy=0:blur=3`;
            break;
        case "outline":
            drawtextFilter += `:shadowcolor=black:shadowx=-1:shadowy=-1:shadowx=1:shadowy=-1:shadowx=-1:shadowy=1:shadowx=1:shadowy=1`;
            break;
        default:
            // 标准模式
            break;
    }
    
    // Add background box if enabled
    if (backgroundColor) {
        drawtextFilter += `:box=1:boxcolor=black@${backgroundOpacity}:boxborderw=5`;
    }
    
    // Apply the filter
    await window.$mapi.shell.execFFmpegCommand([
        "-i", inputImagePath,
        "-vf", drawtextFilter,
        "-y",
        outputImagePath
    ]);
    
    return outputImagePath;
};
