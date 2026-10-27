// @ts-nocheck
import { DataService } from "../service/DataService";
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { TaskBiz } from "../store/modules/task";
import type { VideoGenModelConfigType } from "../declarations/app";

const serverStore = useServerStore();

interface SelfServerConfig {
    uhostId: string;
    apiUrl: string;
}

async function getSelfServerConfig(): Promise<SelfServerConfig | null> {
    try {
        const settingsStr = await window.$mapi.config.get('ipAgentSettings');
        if (settingsStr) {
            const settings = typeof settingsStr === 'string' ? JSON.parse(settingsStr) : settingsStr;
            if (settings.selfServerId) {
                return {
                    uhostId: settings.selfServerId,
                    apiUrl: settings.selfServerApiUrl || ''
                };
            }
        }
        return null;
    } catch (e) {
        console.error('[VideoGen] 鑾峰彇鑷富绠楀姏鏈洪厤缃け璐?', e);
        return null;
    }
}

async function runSelfServerMode(bizId: string, record: any, modelConfig: VideoGenModelConfigType) {
    console.log('[VideoGen.runSelfServerMode] start');

    const config = await getSelfServerConfig();
    if (!config || !config.uhostId) {
        throw new Error("SelfServerConfigNotFound");
    }

    let audioFile: string | undefined = undefined;
    if (modelConfig.soundType === "soundGenerate") {
        if (modelConfig.soundAudioFile) {
            audioFile = modelConfig.soundAudioFile;
        } else if (modelConfig.soundGenerateId) {
            const soundRecord = await TaskService.get(modelConfig.soundGenerateId);
            audioFile = soundRecord?.result?.url as string;
        }
    } else if (modelConfig.soundType === "soundCustom") {
        audioFile = modelConfig.soundCustomFile;
    }

    if (!audioFile) {
        throw new Error("AudioFileEmpty");
    }

    const videoFile = modelConfig.videoTemplateUrl;
    if (!videoFile) {
        throw new Error("VideoFileEmpty");
    }

    console.log(`[VideoGen.runSelfServerMode] 馃搧 鏂囦欢璺緞 - 闊抽: ${audioFile}, 瑙嗛: ${videoFile}`);

    try {
        console.log(`[VideoGen.runSelfServerMode] 馃幀 寮€濮嬫暟瀛椾汉澶勭悊...`);
        const processRes = await window.$mapi.compshare.digitalHumanProcess({
            apiUrl: config.apiUrl,
            audioFile: audioFile,
            videoFile: videoFile
        });

        if (!processRes.success) {
            throw new Error(`鏁板瓧浜哄鐞嗗け璐? ${processRes.message}`);
        }

        const videoUrl = processRes.videoPath;
        console.log(`[VideoGen.runSelfServerMode] 鉁?澶勭悊瀹屾垚锛岃棰戣矾寰? ${videoUrl}`);

        await TaskService.update(bizId, {
            jobResult: {
                code: 0,
                data: {
                    type: 'success',
                    data: {
                        url: videoUrl
                    }
                }
            }
        });

        console.log('[VideoGen.runSelfServerMode] jobResult saved');
        return "success";
    } catch (error: any) {
        console.error(`[VideoGen.runSelfServerMode] 鉂?閿欒:`, error);
        throw error;
    }
}

async function runCloudBeautyMode(bizId: string, record: any, modelConfig: VideoGenModelConfigType) {
    console.log('[VideoGen.runCloudBeautyMode] start');

    let audioFile: string | undefined;
    if (modelConfig.soundType === "soundGenerate") {
        if (modelConfig.soundAudioFile) {
            audioFile = modelConfig.soundAudioFile;
        } else if (modelConfig.soundGenerateId) {
            const soundRecord = await TaskService.get(modelConfig.soundGenerateId);
            audioFile = soundRecord?.result?.url as string;
        }
    } else if (modelConfig.soundType === "soundCustom") {
        audioFile = modelConfig.soundCustomFile;
    }
    if (!audioFile) throw new Error("AudioFileEmpty");

    const videoFile = modelConfig.videoTemplateUrl;
    if (!videoFile) throw new Error("VideoFileEmpty");

    const sysCfg = (window as any).__systemConfig || {};
    const humanWeight = (modelConfig as any).cloudBeautyMode || sysCfg.cloud_beauty_default_mode || '256m';

    console.log(`[VideoGen.runCloudBeautyMode] 馃搧 瑙嗛:${videoFile}, 闊抽:${audioFile}, 妯″紡:${humanWeight}`);

    try {
        const submitRes = await window.$mapi.runninghub.cloudBeautySubmit({
            videoPath: videoFile,
            audioPath: audioFile,
            humanWeight
        });

        if (!submitRes.success) {
            throw new Error(submitRes.error || '鎻愪氦浠诲姟澶辫触');
        }

        const taskId = submitRes.taskId;
        console.log(`[VideoGen.runCloudBeautyMode] 鉁?浠诲姟宸叉彁浜? taskId: ${taskId}`);

        await TaskService.update(bizId, {
            status: "running",
            statusMsg: `浜戠缇庡寲鐢熸垚涓?(0%)`
        });

        let done = false;
        let attempts = 0;
        const maxAttempts = 200;
        let downloadUrl = '';

        while (!done && attempts < maxAttempts) {
            attempts++;
            await new Promise(r => setTimeout(r, 3000));

            const statusRes = await window.$mapi.runninghub.cloudBeautyQueryStatus({ taskId });
            if (!statusRes.success) {
                console.warn(`[VideoGen.runCloudBeautyMode] 鏌ヨ鐘舵€佸け璐? ${statusRes.error}`);
                continue;
            }

            const statusData = statusRes.data;
            const progress = statusData.progress || 0;
            await TaskService.update(bizId, {
                status: "running",
                statusMsg: `浜戠缇庡寲鐢熸垚涓?(${progress}%)`
            });

            console.log(`[VideoGen.runCloudBeautyMode] 馃攧 鐘舵€?${statusData.status} 杩涘害:${progress}%`);

            if (statusData.status === 'done') {
                done = true;
                downloadUrl = statusData.download_url || '';
            } else if (statusData.status === 'failed') {
                throw new Error(`浜戠缇庡寲浠诲姟澶辫触: ${statusData.error || '鏈煡閿欒'}`);
            }
        }

        if (!done) throw new Error('浜戠缇庡寲浠诲姟瓒呮椂');

        console.log(`[VideoGen.runCloudBeautyMode] 鉁?浠诲姟瀹屾垚, URL: ${downloadUrl}`);

        await TaskService.update(bizId, {
            jobResult: {
                code: 0,
                data: {
                    type: 'success',
                    data: {
                        url: downloadUrl,
                        cloudTaskId: taskId
                    }
                }
            }
        });

        return "success";
    } catch (error: any) {
        console.error(`[VideoGen.runCloudBeautyMode] 鉂?閿欒:`, error);
        throw error;
    }
}

/**
 * 浜戠妯″紡锛氫娇鐢≧unningHub API鎵ц浠诲姟
 */
async function runCloudMode(bizId: string, record: any, modelConfig: VideoGenModelConfigType) {
    console.log(`[VideoGen.runCloudMode] start, serverName=${record.serverName}`);

    if (record.serverName === '__CLOUD_BEAUTY__') {
        return await runCloudBeautyMode(bizId, record, modelConfig);
    }

    const mode = record.serverName;

    // 1. 鍑嗗闊抽鏂囦欢
    let audioFile: string | undefined = undefined;
    if (modelConfig.soundType === "soundGenerate") {
        if (modelConfig.soundAudioFile) {
            audioFile = modelConfig.soundAudioFile;
        } else if (modelConfig.soundGenerateId) {
            const soundRecord = await TaskService.get(modelConfig.soundGenerateId);
            audioFile = soundRecord?.result?.url as string;
        }
    } else if (modelConfig.soundType === "soundCustom") {
        audioFile = modelConfig.soundCustomFile;
    }

    if (!audioFile) {
        throw new Error("AudioFileEmpty");
    }

    const videoFile = modelConfig.videoTemplateUrl;
    if (!videoFile) {
        throw new Error("VideoFileEmpty");
    }

    console.log(`[VideoGen.runCloudMode] 馃搧 鏂囦欢璺緞 - 闊抽: ${audioFile}, 瑙嗛: ${videoFile}`);

    // 鑾峰彇闊抽鏃堕暱锛堜紭鍏堜娇鐢ㄥ墠绔紶閫掔殑鏃堕暱锛?
    let audioDuration: number | undefined = modelConfig.audioDuration;

    if (mode === '__CLOUD__' || mode === '__CLOUD_MODE2__' || mode === '__CLOUD_MODEL_3__' || mode === '__CLOUD_MODEL_4__' || mode === '__CLOUD_MODEL_5__' || mode === '__CLOUD_MODEL_6__' || mode === '__CLOUD_MODEL_7__' || mode === '__CLOUD_MODEL_8__') {
        if (audioDuration && audioDuration > 0) {
            console.log(`[VideoGen.runCloudMode] using provided audioDuration=${audioDuration}s`);
        } else {
            // 濡傛灉鍓嶇娌℃湁浼犻€掓椂闀匡紝灏濊瘯鐢?ffprobe 鑾峰彇
            try {
                console.log(`[VideoGen.runCloudMode] 馃搳 鍓嶇鏈紶閫掓椂闀匡紝灏濊瘯鐢╢fprobe鑾峰彇: ${audioFile}`);
                const videoInfo = await window.$mapi.app.ffprobeVideoInfo(audioFile);
                console.log(`[VideoGen.runCloudMode] 馃搳 ffprobe杩斿洖缁撴灉:`, videoInfo);
                if (videoInfo?.duration && videoInfo.duration > 0) {
                    audioDuration = videoInfo.duration;
                    console.log(`[VideoGen.runCloudMode] ffprobe got audio duration: ${audioDuration}s`);
                } else {
                    console.warn(`[VideoGen.runCloudMode] 鈿狅笍 鏈幏鍙栧埌鏈夋晥鐨勯煶棰戞椂闀? videoInfo:`, videoInfo);
                }
            } catch (error) {
                console.error(`[VideoGen.runCloudMode] 鉂?鑾峰彇闊抽鏃堕暱澶辫触:`, error);
            }
        }
    }

    try {
        // 2. 涓婁紶瑙嗛鏂囦欢
        console.log(`[VideoGen.runCloudMode] 猬嗭笍 涓婁紶瑙嗛鏂囦欢: ${videoFile}, mode: ${mode}`);
        const uploadVideoRes = await window.$mapi.runninghub.uploadFile({
            filePath: videoFile,
            fileType: 'video',
            mode: mode
        });
        if (!uploadVideoRes.success) {
            throw new Error(`瑙嗛涓婁紶澶辫触: ${uploadVideoRes.error}`);
        }
        const videoFileName = uploadVideoRes.fileName;
        console.log(`[VideoGen.runCloudMode] 鉁?瑙嗛涓婁紶鎴愬姛: ${videoFileName}`);

        // 3. 涓婁紶闊抽鏂囦欢
        console.log(`[VideoGen.runCloudMode] 猬嗭笍 涓婁紶闊抽鏂囦欢: ${audioFile}, mode: ${mode}`);
        const uploadAudioRes = await window.$mapi.runninghub.uploadFile({
            filePath: audioFile,
            fileType: 'audio',
            mode: mode
        });
        if (!uploadAudioRes.success) {
            throw new Error(`闊抽涓婁紶澶辫触: ${uploadAudioRes.error}`);
        }
        const audioFileName = uploadAudioRes.fileName;
        console.log(`[VideoGen.runCloudMode] 鉁?闊抽涓婁紶鎴愬姛: ${audioFileName}`);

        // 4. 鍒涘缓浜戠浠诲姟
        console.log(`[VideoGen.runCloudMode] 馃殌 鍒涘缓浜戠浠诲姟, mode: ${mode}, audioDuration: ${audioDuration}`);
        const createTaskRes = await window.$mapi.runninghub.createTask({
            videoFileName,
            audioFileName,
            audioDuration,
            mode: mode,
            text: modelConfig.text || modelConfig.promptText || ''
        });
        if (!createTaskRes.success) {
            throw new Error(`鍒涘缓浠诲姟澶辫触: ${createTaskRes.error}`);
        }
        const cloudTaskId = createTaskRes.taskId;
        console.log(`[VideoGen.runCloudMode] 鉁?浠诲姟鍒涘缓鎴愬姛, taskId: ${cloudTaskId}`);

        // 5. 绛夊緟浠诲姟瀹屾垚锛堝甫杞锛屾渶闀?0鍒嗛挓锛?
        console.log(`[VideoGen.runCloudMode] 鈴?绛夊緟浠诲姟瀹屾垚锛堟渶闀?0鍒嗛挓锛?..`);
        const waitRes = await window.$mapi.runninghub.waitForTaskComplete({
            taskId: cloudTaskId,
            maxRetries: 600,  // 10鍒嗛挓 = 600绉?
            interval: 1000,
            mode: mode
        });

        if (!waitRes.success) {
            throw new Error(`浠诲姟鎵ц澶辫触: ${waitRes.error}`);
        }

        const result = waitRes.result;
        console.log(`[VideoGen.runCloudMode] 鉁?浠诲姟瀹屾垚`, result);

        // 6. 淇濆瓨jobResult锛堜笉璁剧疆status锛岃successFunc鏉ュ鐞嗭級
        const videoUrl = result.results?.[0]?.url;
        await TaskService.update(bizId, {
            jobResult: {
                code: 0,
                data: {
                    type: 'success',
                    data: {
                        url: videoUrl,
                        cloudTaskId: cloudTaskId
                    }
                }
            }
        });

        console.log(`[VideoGen.runCloudMode] 鉁?jobResult宸蹭繚瀛橈紝绛夊緟successFunc涓嬭浇瑙嗛`);
        return "success";
    } catch (error: any) {
        console.error(`[VideoGen.runCloudMode] 鉂?閿欒:`, error);
        throw error;
    }
}

export const VideoGen: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // console.log('VideoGen.runFunc', {bizId, bizParam})
        const record = await TaskService.get(bizId);
        if (!record) {
            throw new Error("Task record not found");
        }
        const modelConfig: VideoGenModelConfigType = record.modelConfig;

        console.log(`[VideoGen.runFunc] 寮€濮嬫墽琛屼换鍔? ${bizId}`);

        // 浜戠妯″紡
        if (record.serverName?.startsWith('__CLOUD')) {
            return await runCloudMode(bizId, record, modelConfig);
        }

        // 鑷富绠楀姏鏈烘ā寮?
        if (record.serverName === '__SELF_SERVER__') {
            return await runSelfServerMode(bizId, record, modelConfig);
        }

        // 鏈湴妯″紡
        const { server, serverInfo } = await serverStore.prepareForTask(bizId, bizParam);
        let audioFile: string | undefined = undefined;
        console.log('[VideoGen] 馃攳 闊抽閰嶇疆:', {
            soundType: modelConfig.soundType,
            soundAudioFile: modelConfig.soundAudioFile,
            soundGenerateId: modelConfig.soundGenerateId,
            soundCustomFile: modelConfig.soundCustomFile
        });

        if (modelConfig.soundType === "soundGenerate") {
            // 馃敡 浼樺厛浣跨敤鏂扮殑 soundAudioFile锛圱TS瀹炴椂鍚堟垚鐨勯煶棰戯級
            if (modelConfig.soundAudioFile) {
                audioFile = modelConfig.soundAudioFile;
                console.log('[VideoGen] 馃幍 浣跨敤TTS鍚堟垚鐨勯煶棰戞枃浠?', audioFile);
            } else if (modelConfig.soundGenerateId) {
                // 鍏煎鏃ф柟寮忥細浠庨煶棰戠敓鎴愪换鍔¤幏鍙?
                const soundRecord = await TaskService.get(modelConfig.soundGenerateId);
                console.log('[VideoGen] 馃搵 鑾峰彇鍒扮殑闊抽浠诲姟璁板綍:', soundRecord);
                audioFile = soundRecord?.result?.url as string;
                console.log('[VideoGen] 馃幍 浠庝换鍔¤褰曟彁鍙栫殑闊抽鏂囦欢:', audioFile);
            }
        } else if (modelConfig.soundType === "soundCustom") {
            audioFile = modelConfig.soundCustomFile;
            console.log('[VideoGen] 馃搧 鑷畾涔夐煶棰戞枃浠惰矾寰?', audioFile);
        }

        console.log('[VideoGen] 鉁?鏈€缁堥煶棰戞枃浠惰矾寰?', audioFile);
        if (!audioFile) {
            console.error('[VideoGen] 鉂?閿欒锛氶煶棰戞枃浠惰矾寰勪负绌猴紒', {
                soundType: modelConfig.soundType,
                soundAudioFile: modelConfig.soundAudioFile,
                soundGenerateId: modelConfig.soundGenerateId,
                soundCustomFile: modelConfig.soundCustomFile
            });
            throw new Error("AudioFileEmpty");
        }
        const res = await serverStore.call(serverInfo, "videoGen", {
            id: serverStore.generateTaskId("VideoGen", bizId),
            result: record.result,
            param: record.param,
            video: modelConfig.videoTemplateUrl,
            audio: audioFile,
        });
        // console.log('VideoGen.runFunc.res', res)
        if (res.code) {
            throw res.msg || "apiRequest videoGen fail";
        }
        switch (res.data.type) {
            case "success":
                // 馃敡 鍏抽敭淇锛氬繀椤荤瓑寰呮暟鎹簱鏇存柊瀹屾垚
                // 鍚﹀垯 successFunc 涓煡璇笉鍒?jobResult
                // 淇濆瓨 jobResult 鍜?status锛堢‘淇?UI 鍙互绔嬪嵆鐪嬪埌浠诲姟宸插畬鎴愶級
                try {
                    await TaskService.update(bizId, {
                        status: "success",
                        jobResult: res,
                    });
                    console.log(`[VideoGen.runFunc] 鉁?jobResult 宸蹭繚瀛樺埌鏁版嵁搴擄紝status=success`);
                } catch (e) {
                    console.error(`[VideoGen.runFunc] 鉂?淇濆瓨 jobResult 澶辫触: ${e}`);
                }
                return "success";
            case "retry":
                return "retry";
            default:
                throw `unknown res.data.type : ${res.data.type}`;
        }
    },
    successFunc: async (bizId, bizParam) => {
        console.log(`[VideoGen.successFunc] 馃摻锔?寮€濮嬪鐞嗚棰戠敓鎴愬畬鎴愶紝bizId=${bizId}`);
        const record = await TaskService.get(bizId);
        if (!record) {
            throw new Error("Task record not found");
        }
        console.log(`[VideoGen.successFunc] 馃搵 浠庢暟鎹簱鑾峰彇浠诲姟璁板綍瀹屾垚`);

        // 馃敡 璇婃柇锛氭墦鍗癹obResult鐨勫畬鏁村唴瀹?
        if (!record.jobResult) {
            console.error('[VideoGen.successFunc] jobResult is empty or undefined');
            console.error(`[VideoGen.successFunc] 瀹屾暣record:`, JSON.stringify(record, null, 2));
            throw new Error("jobResult not found");
        }
        console.log(`[VideoGen.successFunc] jobResult 缁撴瀯:`, JSON.stringify(record.jobResult, null, 2));

        // 馃敡 涓烘枃浠朵繚瀛樻坊鍔犺秴鏃朵繚鎶わ紙闃叉鍗′綇锛?
        const SAVE_FILE_TIMEOUT = 60 * 1000; // 60绉掕秴鏃讹紙瑙嗛閫氬父杈冨ぇ锛?
        let savedUrl = "";

        try {
            const videoUrl = record.jobResult?.data?.data?.url;
            console.log(`[VideoGen.successFunc] 馃敆 鍗冲皢淇濆瓨鐨勮棰慤RL: ${videoUrl}`);
            if (!videoUrl) {
                throw new Error("Video URL not found in jobResult");
            }

            // 浜戠妯″紡锛氫笅杞戒簯绔棰戝埌鏈湴
            const isCloudMode = record.serverName?.startsWith('__CLOUD');
            if (isCloudMode) {
                console.log(`[VideoGen.successFunc] 鈽侊笍 浜戠妯″紡锛屽紑濮嬩笅杞借棰戝埌鏈湴...`);
                const downloadPromise = window.$mapi.file.downloadUrl(videoUrl);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("File download timeout after 60s")), SAVE_FILE_TIMEOUT)
                );
                savedUrl = await Promise.race([downloadPromise, timeoutPromise as any]);
                console.log(`[VideoGen.successFunc] 鉁?浜戠瑙嗛涓嬭浇瀹屾垚锛屼繚瀛樿矾寰? ${savedUrl}`);
            } else {
                // 鏈湴妯″紡锛氫繚瀛樺埌鏈湴
                const savePromise = DataService.saveFile(videoUrl, {saveGroup: 'video'});
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("File save timeout after 60s")), SAVE_FILE_TIMEOUT)
                );
                savedUrl = await Promise.race([savePromise, timeoutPromise as any]);
                console.log(`[VideoGen.successFunc] 鉁?鏂囦欢淇濆瓨瀹屾垚锛屼繚瀛樿矾寰? ${savedUrl}`);
            }
        } catch (error: any) {
            console.warn(`[VideoGen] 鏂囦欢淇濆瓨澶辫触鎴栬秴鏃? ${error.message}, 浣跨敤鍘熷URL`);
            // 濡傛灉鏂囦欢淇濆瓨澶辫触鎴栬秴鏃讹紝鐩存帴浣跨敤鍘熷URL
            savedUrl = record.jobResult?.data?.data?.url || "";
            console.warn(`[VideoGen.successFunc] 浣跨敤鍘熷URL: ${savedUrl}`);
        }

        // 馃敡 纭繚 savedUrl 涓嶄负绌?
        if (!savedUrl) {
            console.error('[VideoGen.successFunc] savedUrl is empty');
            throw new Error("Failed to get video URL from jobResult");
        }

        // 馃敡 鍑嗗鏇存柊鏁版嵁
        const updateData = {
            status: "success",
            endTime: Date.now(),
            result: {
                url: savedUrl,
                cloudTaskId: record.jobResult?.data?.data?.cloudTaskId
            },
        };

        console.log(`[VideoGen.successFunc] 馃摑 鍑嗗鏇存柊鏁版嵁搴擄紝updateData:`, JSON.stringify(updateData, null, 2));

        try {
            await TaskService.update(bizId, updateData);
            console.log(`[VideoGen.successFunc] 鉁?鏁版嵁搴撴洿鏂版垚鍔燂紝result.url = ${savedUrl}`);

            // 馃敡 楠岃瘉锛氶噸鏂版煡璇㈢‘淇濇暟鎹凡淇濆瓨
            const verifyRecord = await TaskService.get(bizId);
            console.log(`[VideoGen.successFunc] 鉁?楠岃瘉锛氶噸鏂版煡璇换鍔★紝result:`, {
                url: verifyRecord?.result?.url,
                cloudTaskId: verifyRecord?.result?.cloudTaskId,
                status: verifyRecord?.status,
                endTime: verifyRecord?.endTime
            });

            if (!verifyRecord?.result?.url) {
                console.error('[VideoGen.successFunc] result.url verification failed');
                throw new Error("Failed to verify saved result");
            }
        } catch (updateError: any) {
            console.error(`[VideoGen.successFunc] 鉂?鏁版嵁搴撴洿鏂板け璐?`, {
                error: updateError?.message,
                bizId,
                updateData: JSON.stringify(updateData)
            });
            throw updateError;
        }

        try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'video', detail: record.name || '' }); } catch(e) {}

        // 浜戠妯″紡璺宠繃GPU娓呯悊
        if (record.serverName?.startsWith('__CLOUD')) {
            console.log(`[VideoGen.successFunc] 鈽侊笍 浜戠妯″紡锛岃烦杩嘒PU娓呯悊`);
            return;
        }

        // 馃敡 浠诲姟瀹屾垚鍚庢墽琛孏PU娓呯悊锛堜粎鏈湴妯″紡锛?
        // 寤惰繜10绉掔‘淇濆墠绔暟鎹繚瀛橈紙saveWorkData锛夊畬鎴?
        setTimeout(async () => {
            try {
                const ipAgentSettingsStr = await window.$mapi.config.get('ipAgentSettings');
                const ipAgentSettings = ipAgentSettingsStr ? (typeof ipAgentSettingsStr === 'string' ? JSON.parse(ipAgentSettingsStr) : ipAgentSettingsStr) : {};
                if (!ipAgentSettings.enableGpuCleanup) {
                    console.log('[VideoGen.successFunc] 鏈湴妯″瀷杩涚▼浼樺寲鏈紑鍚紝璺宠繃GPU娓呯悊');
                    return;
                }

                console.log('[VideoGen.successFunc] 馃Ч 浠诲姟瀹屾垚锛屽紑濮婫PU娣卞害娓呯悊...');
                if (window.$mapi && window.$mapi.shell) {
                    // 馃敡 鑾峰彇鎵€鏈夋ā鍨嬬殑瀹屾暣璺緞锛堢粷瀵硅矾寰勶級
                    const modelPaths: string[] = [];
                    for (const record of serverStore.records) {
                        if (record.localPath) {
                            try {
                                // 鑾峰彇瀹屾暣缁濆璺緞
                                const serverInfo = await serverStore.serverInfo(record);
                                if (serverInfo.localPath) {
                                    modelPaths.push(serverInfo.localPath);
                                }
                            } catch (e) {
                                console.warn(`[VideoGen.successFunc] 鑾峰彇璺緞澶辫触: ${record.name}`, e);
                            }
                        }
                    }

                    // 鍘婚噸
                    const uniquePaths = modelPaths.filter((path, index, self) => self.indexOf(path) === index);

                    // 馃敡 淇锛氫娇鐢ㄦ墦鍖呯殑Python锛岃€屼笉鏄緷璧栫郴缁熺殑py鍛戒护
                    const pythonPath = await window.$mapi.shell.getPythonPath();

                    // 馃敡 鍔ㄦ€佽幏鍙栬剼鏈矾寰勶紙鏀寔寮€鍙戝拰鐢熶骇鐜锛?
                    const appRoot = (window as any)["APP_ROOT"] || process.env.APP_ROOT || process.cwd();
                    const cleanupScriptPath = `${appRoot}/scripts/cleanup_gpu.py`;

                    // 鏋勫缓鍛戒护琛屽弬鏁帮紙璺緞浠ラ€楀彿鍒嗛殧锛?
                    const pathsArg = uniquePaths.join(',');
                    const command = pathsArg
                        ? `"${pythonPath}" "${cleanupScriptPath}" "${pathsArg}"`
                        : `"${pythonPath}" "${cleanupScriptPath}"`;

                    console.log(`[VideoGen.successFunc] 娓呯悊鍛戒护: ${command}`);
                    console.log(`[VideoGen.successFunc] Python璺緞: ${pythonPath}`);
                    console.log(`[VideoGen.successFunc] 鑴氭湰璺緞: ${cleanupScriptPath}`);
                    console.log(`[VideoGen.successFunc] 妯″瀷璺緞鏁? ${uniquePaths.length}`);
                    await window.$mapi.shell.exec(command);
                    console.log('[VideoGen.successFunc] 鉁?GPU娣卞害娓呯悊瀹屾垚');
                }
            } catch (cleanupError: any) {
                console.warn('[VideoGen.successFunc] 鈿狅笍 GPU娓呯悊澶辫触锛堜笉褰卞搷涓绘祦绋嬶級:', cleanupError?.message);
            }
        }, 10000); // 寤惰繜10绉掔‘淇濇墍鏈夋暟鎹繚瀛樺畬鎴?
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('VideoGen.failFunc', {bizId, bizParam, msg})
        console.log(`[VideoGen.failFunc] 鉂?浠诲姟澶辫触: ${bizId}, 閿欒淇℃伅: ${msg}`);

        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });

        // 馃敡 浠诲姟澶辫触鍚庢墽琛孏PU娓呯悊
        // 寤惰繜10绉掔‘淇濆墠绔暟鎹繚瀛樺畬鎴?
        setTimeout(async () => {
            try {
                const ipAgentSettingsStr = await window.$mapi.config.get('ipAgentSettings');
                const ipAgentSettings = ipAgentSettingsStr ? (typeof ipAgentSettingsStr === 'string' ? JSON.parse(ipAgentSettingsStr) : ipAgentSettingsStr) : {};
                if (!ipAgentSettings.enableGpuCleanup) {
                    console.log('[VideoGen.failFunc] 鏈湴妯″瀷杩涚▼浼樺寲鏈紑鍚紝璺宠繃GPU娓呯悊');
                    return;
                }

                console.log('[VideoGen.failFunc] 馃Ч 浠诲姟澶辫触锛屽紑濮婫PU娣卞害娓呯悊...');
                if (window.$mapi && window.$mapi.shell) {
                    // 馃敡 鑾峰彇鎵€鏈夋ā鍨嬬殑瀹屾暣璺緞锛堢粷瀵硅矾寰勶級
                    const modelPaths: string[] = [];
                    for (const record of serverStore.records) {
                        if (record.localPath) {
                            try {
                                // 鑾峰彇瀹屾暣缁濆璺緞
                                const serverInfo = await serverStore.serverInfo(record);
                                if (serverInfo.localPath) {
                                    modelPaths.push(serverInfo.localPath);
                                }
                            } catch (e) {
                                console.warn(`[VideoGen.failFunc] 鑾峰彇璺緞澶辫触: ${record.name}`, e);
                            }
                        }
                    }

                    // 鍘婚噸
                    const uniquePaths = modelPaths.filter((path, index, self) => self.indexOf(path) === index);

                    // 馃敡 淇锛氫娇鐢ㄦ墦鍖呯殑Python锛岃€屼笉鏄緷璧栫郴缁熺殑py鍛戒护
                    const pythonPath = await window.$mapi.shell.getPythonPath();

                    // 馃敡 鍔ㄦ€佽幏鍙栬剼鏈矾寰勶紙鏀寔寮€鍙戝拰鐢熶骇鐜锛?
                    const appRoot = (window as any)["APP_ROOT"] || process.env.APP_ROOT || process.cwd();
                    const cleanupScriptPath = `${appRoot}/scripts/cleanup_gpu.py`;

                    // 鏋勫缓鍛戒护琛屽弬鏁帮紙璺緞浠ラ€楀彿鍒嗛殧锛?
                    const pathsArg = uniquePaths.join(',');
                    const command = pathsArg
                        ? `"${pythonPath}" "${cleanupScriptPath}" "${pathsArg}"`
                        : `"${pythonPath}" "${cleanupScriptPath}"`;

                    console.log(`[VideoGen.failFunc] 娓呯悊鍛戒护: ${command}`);
                    console.log(`[VideoGen.failFunc] Python璺緞: ${pythonPath}`);
                    console.log(`[VideoGen.failFunc] 鑴氭湰璺緞: ${cleanupScriptPath}`);
                    console.log(`[VideoGen.failFunc] 妯″瀷璺緞鏁? ${uniquePaths.length}`);
                    await window.$mapi.shell.exec(command);
                    console.log('[VideoGen.failFunc] 鉁?GPU娓呯悊瀹屾垚');
                }
            } catch (cleanupError: any) {
                console.warn('[VideoGen.failFunc] 鈿狅笍 GPU娓呯悊澶辫触锛堜笉褰卞搷涓绘祦绋嬶級:', cleanupError?.message);
            }
        }, 10000); // 寤惰繜10绉掔‘淇濇墍鏈夋暟鎹繚瀛樺畬鎴?
    },
    // 馃敡 褰撲换鍔¤鐢ㄦ埛鍙栨秷鏃惰皟鐢?
    requestCancelFunc: async (bizId, bizParam) => {
        console.log(`[VideoGen.requestCancelFunc] 馃洃 鐢ㄦ埛鍙栨秷浠诲姟: ${bizId}`);

        // 馃敡 浠诲姟鍙栨秷鍚庢墽琛孏PU娓呯悊
        // 寤惰繜10绉掔‘淇濆墠绔暟鎹繚瀛樺畬鎴?
        setTimeout(async () => {
            try {
                const ipAgentSettingsStr = await window.$mapi.config.get('ipAgentSettings');
                const ipAgentSettings = ipAgentSettingsStr ? (typeof ipAgentSettingsStr === 'string' ? JSON.parse(ipAgentSettingsStr) : ipAgentSettingsStr) : {};
                if (!ipAgentSettings.enableGpuCleanup) {
                    console.log('[VideoGen.requestCancelFunc] 鏈湴妯″瀷杩涚▼浼樺寲鏈紑鍚紝璺宠繃GPU娓呯悊');
                    return;
                }

                console.log('[VideoGen.requestCancelFunc] 馃Ч 浠诲姟鍙栨秷锛屽紑濮婫PU娣卞害娓呯悊...');
                if (window.$mapi && window.$mapi.shell) {
                    // 馃敡 鑾峰彇鎵€鏈夋ā鍨嬬殑瀹屾暣璺緞锛堢粷瀵硅矾寰勶級
                    const modelPaths: string[] = [];
                    for (const record of serverStore.records) {
                        if (record.localPath) {
                            try {
                                // 鑾峰彇瀹屾暣缁濆璺緞
                                const serverInfo = await serverStore.serverInfo(record);
                                if (serverInfo.localPath) {
                                    modelPaths.push(serverInfo.localPath);
                                }
                            } catch (e) {
                                console.warn(`[VideoGen.requestCancelFunc] 鑾峰彇璺緞澶辫触: ${record.name}`, e);
                            }
                        }
                    }

                    // 鍘婚噸
                    const uniquePaths = modelPaths.filter((path, index, self) => self.indexOf(path) === index);

                    // 馃敡 淇锛氫娇鐢ㄦ墦鍖呯殑Python锛岃€屼笉鏄緷璧栫郴缁熺殑py鍛戒护
                    const pythonPath = await window.$mapi.shell.getPythonPath();

                    // 馃敡 鍔ㄦ€佽幏鍙栬剼鏈矾寰勶紙鏀寔寮€鍙戝拰鐢熶骇鐜锛?
                    const appRoot = (window as any)["APP_ROOT"] || process.env.APP_ROOT || process.cwd();
                    const cleanupScriptPath = `${appRoot}/scripts/cleanup_gpu.py`;

                    // 鏋勫缓鍛戒护琛屽弬鏁帮紙璺緞浠ラ€楀彿鍒嗛殧锛?
                    const pathsArg = uniquePaths.join(',');
                    const command = pathsArg
                        ? `"${pythonPath}" "${cleanupScriptPath}" "${pathsArg}"`
                        : `"${pythonPath}" "${cleanupScriptPath}"`;

                    console.log(`[VideoGen.requestCancelFunc] 娓呯悊鍛戒护: ${command}`);
                    console.log(`[VideoGen.requestCancelFunc] Python璺緞: ${pythonPath}`);
                    console.log(`[VideoGen.requestCancelFunc] 鑴氭湰璺緞: ${cleanupScriptPath}`);
                    console.log(`[VideoGen.requestCancelFunc] 妯″瀷璺緞鏁? ${uniquePaths.length}`);
                    await window.$mapi.shell.exec(command);
                    console.log('[VideoGen.requestCancelFunc] 鉁?GPU娓呯悊瀹屾垚');
                }
            } catch (cleanupError: any) {
                console.warn('[VideoGen.requestCancelFunc] 鈿狅笍 GPU娓呯悊澶辫触锛堜笉褰卞搷涓绘祦绋嬶級:', cleanupError?.message);
            }
        }, 10000); // 寤惰繜10绉掔‘淇濇墍鏈夋暟鎹繚瀛樺畬鎴?
    },
};
