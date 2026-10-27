import { TaskBiz } from "../store/modules/task";
import { TaskService } from "../service/TaskService";

/**
 * 视频标题生成任务
 *
 * 基于视频文案使用AI生成：
 * - 视频标题
 * - 标签（tags）
 * - 关键词（keywords）
 */
export const VideoTitleGeneration: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log(`[VideoTitleGeneration.runFunc] 开始生成标题: ${bizId}`);

        // 从数据库获取任务记录
        const record = await TaskService.get(bizId);

        if (!record) {
            throw new Error("TaskRecordNotFound");
        }

        const { param } = record;
        const { text } = param || {};

        if (!text || !text.trim()) {
            throw new Error("文案内容为空，无法生成标题");
        }

        console.log(`[VideoTitleGeneration.runFunc] 文案长度: ${text.length} 字符`);

        // 调用AI服务生成标题、标签和关键词
        const result = await window.$mapi.ipAgent.generateTitleTags({
            text: text,
        });

        console.log(`[VideoTitleGeneration.runFunc] AI生成完成:`, {
            title: result.title?.substring(0, 50),
            tagsLength: result.tags?.length,
            keywordsLength: result.keywords?.length
        });

        // 保存生成结果到任务记录
        await TaskService.update(bizId, {
            jobResult: {
                data: result
            }
        });

        return "success";
    },

    successFunc: async (bizId, bizParam) => {
        console.log(`[VideoTitleGeneration.successFunc] 保存标题结果: ${bizId}`);

        // 从任务记录获取生成结果
        const record = await TaskService.get(bizId);

        if (!record || !record.jobResult) {
            throw new Error("任务结果不存在");
        }

        const generatedData = record.jobResult.data;

        // 更新任务状态为成功
        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: {
                title: generatedData.title || "",
                tags: generatedData.tags || "",
                keywords: generatedData.keywords || ""
            }
        });

        console.log(`[VideoTitleGeneration.successFunc] ✓ 标题生成任务完成`);
        try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'script', detail: '文案生成' }); } catch(e) {}
    },

    failFunc: async (bizId, msg, bizParam) => {
        console.warn(`[VideoTitleGeneration.failFunc] 生成失败: ${bizId}, ${msg}`);

        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now()
        });
    },

    requestCancelFunc: async (bizId, bizParam) => {
        console.log(`[VideoTitleGeneration.requestCancelFunc] 取消生成: ${bizId}`);
        // AI生成是短时API调用，无需特殊清理
        // 标记为已取消即可
    }
};
