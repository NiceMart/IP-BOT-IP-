import { DataService } from "../service/DataService";
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { TaskBiz } from "../store/modules/task";
import { replaceSoundGenerateText } from "../lib/server";

const serverStore = useServerStore();

export const SoundGenerate: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // console.log('SoundClone.runFunc', {bizId, bizParam})

        // 🔧 修复：首先获取任务记录，判断是否为阿里云任务
        // 阿里云任务不需要启动本地Python服务器，因此不能调用 serverStore.prepareForTask
        const record = await TaskService.get(bizId);
        if (!record) {
            throw new Error(`Task record not found: ${bizId}`);
        }

        // 如果是阿里云TTS且已经有音频路径（前端直接合成）
        if (record.modelConfig?.type === "AliyunTts" && record.modelConfig?.audioPath) {
            console.log(`[SoundGenerate.runFunc] 检测到阿里云TTS任务，已在前端完成: ${bizId}`);

            // 直接更新结果
            await TaskService.update(bizId, {
                status: "success",
                jobResult: {
                    data: {
                        data: {
                            url: record.modelConfig.audioPath
                        }
                    },
                    code: 0,
                    msg: "success"
                }
            });

            try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'voice', detail: '阿里云TTS' }); } catch(e) {}

            return "success";
        }

        const { server, serverInfo } = await serverStore.prepareForTask(bizId, bizParam);
        // console.log('runFunc', serverInfo, record)

        console.log(`[SoundGenerate.runFunc] 开始执行任务: ${bizId}`);

        let res;
        if (record.modelConfig.type === "SoundTts") {
            // {"type":"SoundTts","ttsServerKey":"server-cosyvoice|0.6.0","ttsParam":{"speaker":"中文女","speed":1},"text":"你好"}
            res = await serverStore.call(serverInfo, "soundTts", {
                id: serverStore.generateTaskId(record.modelConfig.type, bizId),
                result: record.result,
                param: record.modelConfig.ttsParam,
                text: await replaceSoundGenerateText(record.modelConfig.text),
            });
        } else {
            res = await serverStore.call(serverInfo, "soundClone", {
                id: serverStore.generateTaskId(record.modelConfig.type, bizId),
                result: record.result,
                param: record.modelConfig.cloneParam,
                text: await replaceSoundGenerateText(record.modelConfig.text),
                promptAudio: record.modelConfig.promptUrl,
                promptText: record.modelConfig.promptText,
            });
        }
        if (res.code) {
            throw res.msg || "SoundGenerate fail";
        }
        switch (res.data.type) {
            case "success":
                // 🔧 关键修复：必须等待数据库更新完成
                // 否则 successFunc 中查询不到 jobResult
                // 保存 jobResult 和 status（确保 UI 可以立即看到任务已完成）
                try {
                    await TaskService.update(bizId, {
                        status: "success",
                        jobResult: res,
                    });
                    console.log(`[SoundGenerate.runFunc] ✅ jobResult 已保存到数据库，status=success`);
                } catch (e) {
                    console.error(`[SoundGenerate.runFunc] ❌ 保存 jobResult 失败: ${e}`);
                }
                try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'voice', detail: record.modelConfig?.type === 'SoundTts' ? '本地TTS' : '声音克隆' }); } catch(e) {}
                return "success";
            case "retry":
                return "retry";
            default:
                throw `unknown res.data.type : ${res.data.type}`;
        }
    },
    successFunc: async (bizId, bizParam) => {
        console.log(`[SoundGenerate.successFunc] 🎙️ 开始处理语音生成完成，bizId=${bizId}`);

        // 🔧 修复：首先获取任务记录，判断是否为阿里云任务
        const record = await TaskService.get(bizId);
        if (!record) {
            throw new Error(`Task record not found: ${bizId}`);
        }

        // 🔧 关键修复：区分阿里云任务和本地服务器任务
        if (record.modelConfig?.type === "AliyunTts") {
            console.log(`[SoundGenerate.successFunc] 检测到阿里云TTS任务，使用简化流程`);

            // 阿里云任务不需要调用 prepareForTask，直接使用 audioPath
            const audioPath = record.modelConfig?.audioPath;
            if (!audioPath) {
                console.error(`[SoundGenerate.successFunc] ❌ 阿里云任务没有audioPath`);
                throw new Error("AliyunTts task missing audioPath");
            }

            console.log(`[SoundGenerate.successFunc] ✅ 阿里云音频路径: ${audioPath}`);

            // 直接更新任务结果
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    url: audioPath,
                },
            });

            console.log(`[SoundGenerate.successFunc] ✅ 阿里云任务处理完成`);
            try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'voice', detail: '阿里云TTS' }); } catch(e) {}
            return;
        }

        // 本地服务器任务：原有逻辑
        console.log(`[SoundGenerate.successFunc] 本地服务器任务，执行完整流程`);
        const { record: fullRecord, server, serverInfo } = await serverStore.prepareForTask(bizId, bizParam);
        console.log(`[SoundGenerate.successFunc] 📋 从数据库获取任务记录完成`);

        // 🔧 诊断：打印jobResult的完整内容
        if (!fullRecord.jobResult) {
            console.error(`[SoundGenerate.successFunc] ❌ 致命错误：jobResult为空或未定义！`);
            console.error(`[SoundGenerate.successFunc] 完整record:`, JSON.stringify(fullRecord, null, 2));
            throw new Error("jobResult not found");
        }
        console.log(`[SoundGenerate.successFunc] jobResult 结构:`, JSON.stringify(fullRecord.jobResult, null, 2));

        // 🔧 为文件保存添加超时保护（防止卡住）
        const SAVE_FILE_TIMEOUT = 30 * 1000; // 30秒超时
        let savedUrl = "";

        try {
            const audioUrl = fullRecord.jobResult?.data?.data?.url;
            console.log(`[SoundGenerate.successFunc] 🔗 即将保存的音频URL: ${audioUrl}`);
            if (!audioUrl) {
                throw new Error("Audio URL not found in jobResult");
            }

            const savePromise = DataService.saveFile(audioUrl, {saveGroup: 'audio'});
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("File save timeout after 30s")), SAVE_FILE_TIMEOUT)
            );
            savedUrl = await Promise.race([savePromise, timeoutPromise as any]);
            console.log(`[SoundGenerate.successFunc] ✅ 文件保存完成，保存路径: ${savedUrl}`);
        } catch (error: any) {
            console.warn(`[SoundGenerate] 文件保存失败或超时: ${error.message}, 使用原始URL`);
            // 如果文件保存失败或超时，直接使用原始URL
            savedUrl = fullRecord.jobResult?.data?.data?.url || "";
            console.warn(`[SoundGenerate.successFunc] 使用原始URL: ${savedUrl}`);
        }

        // 🔧 确保 savedUrl 不为空
        if (!savedUrl) {
            console.error(`[SoundGenerate.successFunc] ❌ 致命错误：savedUrl为空！`);
            throw new Error("Failed to get audio URL from jobResult");
        }

        // 🔧 确保 result 对象正确创建
        const resultObject = {
            url: savedUrl,
        };
        console.log(`[SoundGenerate.successFunc] 准备保存的结果对象:`, JSON.stringify(resultObject, null, 2));

        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: resultObject,
        });

        console.log(`[SoundGenerate.successFunc] ✅ 数据库更新完成，result.url = ${savedUrl}`);
        try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'voice', detail: '本地TTS' }); } catch(e) {}
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('SoundClone.failFunc', {bizId, bizParam, msg})
        console.log(`[SoundGenerate.failFunc] ❌ 任务失败: ${bizId}, 错误信息: ${msg}`);

        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
    // 🔧 当任务被用户取消时调用（清理进程逻辑已移至stopAllTasks）
    requestCancelFunc: async (bizId, bizParam) => {
        console.log(`[SoundGenerate.requestCancelFunc] 🛑 用户取消任务: ${bizId}`);
        // 不在这里清理进程，由用户主动点击"停止任务"按钮时统一清理
    },
};
