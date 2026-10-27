import {DataService} from "../service/DataService";
import {TaskService} from "../service/TaskService";
import {useServerStore} from "../store/modules/server";
import {TaskBiz} from "../store/modules/task";

const serverStore = useServerStore();

export const VideoAsr: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoAsrModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        
        if (!videoFile) {
            throw new Error("VideoFileEmpty");
        }
        
        // Create a temporary audio file from video for ASR processing
        const tempAudioPath = await window.$mapi.file.temp("mp3", "video-asr");
        
        // Extract audio from video using FFmpeg
        await window.$mapi.shell.extractAudioFromVideo(videoFile, tempAudioPath, {
            audioCodec: "mp3",
            sampleRate: 16000, // Sample rate suitable for ASR
            channels: 1, // Mono audio
            bitrate: "128k"
        });
        
        const res = await serverStore.call(serverInfo, "asr", {
            id: serverStore.generateTaskId("VideoAsr", bizId),
            result: record.result,
            param: record.param,
            audio: tempAudioPath,
        });
        
        if (res.code) {
            throw res.msg || "VideoAsr run fail";
        }
        
        // Clean up temporary file
        await window.$mapi.file.deleteFile(tempAudioPath);
        
        switch (res.data.type) {
            case "success":
                // 🔧 关键修复：后台异步更新数据库，不要等待
                TaskService.update(bizId, {
                    status: "success",
                    jobResult: res,
                }).catch(e => {
                    console.warn(`[VideoAsr] Failed to update database: ${e}`);
                });
                return "success";
            case "retry":
                return "retry";
            default:
                throw `unknown res.data.type : ${res.data.type}`;
        }
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);

        // Process ASR results and create SRT file
        const transcripts = record.jobResult.data.data.records;
        let fullTranscript = "";
        let srtContent = "";

        transcripts.forEach((item, index) => {
            fullTranscript += item.text + " ";

            // Create SRT format
            const startTime = formatSRTTime(item.start);
            const endTime = formatSRTTime(item.end);
            srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n\n`;
        });

        // 🔧 为文件保存添加超时保护（防止卡住）
        const SAVE_FILE_TIMEOUT = 15 * 1000; // 15秒超时（SRT文件通常较小）
        let srtPath = "";

        try {
            const taskTitle = record.title || "video-asr-result";
            const savePromise = window.$mapi.file.saveFile(srtContent, `${taskTitle}.srt`);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("File save timeout after 15s")), SAVE_FILE_TIMEOUT)
            );
            srtPath = await Promise.race([savePromise, timeoutPromise as any]);
        } catch (error: any) {
            console.warn(`[VideoAsr] SRT file save failed or timeout: ${error.message}`);
            // 如果文件保存失败，继续进行，至少记录了转录文本
        }

        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: {
                transcript: fullTranscript.trim(),
                records: transcripts,
                srtPath: srtPath || ""
            },
        });
        try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'subtitle', detail: `ASR字幕:${transcripts.length}条` }); } catch(e) {}
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

// Helper function to format time for SRT
function formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const ms = Math.floor((secs - Math.floor(secs)) * 1000);
    
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = Math.floor(secs).toString().padStart(2, '0');
    const formattedMs = ms.toString().padStart(3, '0');
    
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds},${formattedMs}`;
}