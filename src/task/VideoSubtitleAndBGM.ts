import { TaskBiz } from "../store/modules/task";
import { TaskService } from "../service/TaskService";

/**
 * 视频字幕和BGM处理任务
 *
 * 包含：
 * - 字幕生成（基于语音识别）
 * - BGM添加（可选）
 * - 封面生成（可选）
 *
 * 注意：字幕和BGM可以并行处理，但都需要等待完成后再进入下一步
 */
export const VideoSubtitleAndBGM: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log(`[VideoSubtitleAndBGM.runFunc] 开始处理字幕和BGM: ${bizId}`);

        // 从数据库获取任务记录
        const record = await TaskService.get(bizId);

        if (!record) {
            throw new Error("TaskRecordNotFound");
        }

        const { param } = record;
        const { videoUrl, enableSubtitle, enableBGM, bgmPath } = param || {};

        if (!videoUrl) {
            throw new Error("视频文件不存在，无法生成字幕");
        }

        console.log(`[VideoSubtitleAndBGM.runFunc] 配置:`, {
            videoUrl: videoUrl.substring(0, 50),
            enableSubtitle,
            enableBGM,
            hasBGM: !!bgmPath
        });

        // 调用字幕和BGM处理服务
        // 注意：这里应该调用实际的字幕生成服务
        // 目前使用占位符逻辑，实际实现需要调用 window.$mapi 相关接口

        const tasks: Promise<any>[] = [];

        // 字幕生成任务
        if (enableSubtitle) {
            console.log(`[VideoSubtitleAndBGM.runFunc] 开始生成字幕...`);
            // TODO: 调用实际的字幕生成接口
            // 示例：await window.$mapi.ipAgent.generateSubtitle({ videoUrl });
            tasks.push(
                new Promise(resolve => {
                    // 模拟字幕生成（3秒）
                    setTimeout(() => {
                        resolve({ subtitlePath: '/path/to/subtitle.srt' });
                    }, 3000);
                })
            );
        }

        // BGM添加任务
        if (enableBGM && bgmPath) {
            console.log(`[VideoSubtitleAndBGM.runFunc] 开始添加BGM...`);
            // TODO: 调用实际的BGM添加接口
            // 示例：await window.$mapi.ipAgent.addBGM({ videoUrl, bgmPath });
            tasks.push(
                new Promise(resolve => {
                    // 模拟BGM添加（2秒）
                    setTimeout(() => {
                        resolve({ videoWithBGM: '/path/to/video_with_bgm.mp4' });
                    }, 2000);
                })
            );
        }

        // 并行处理字幕和BGM
        const results = await Promise.all(tasks);

        console.log(`[VideoSubtitleAndBGM.runFunc] 处理完成:`, {
            tasksCount: results.length,
            results: results.length
        });

        // 保存中间结果
        await TaskService.update(bizId, {
            jobResult: {
                data: {
                    results,
                    subtitlePath: results[0]?.subtitlePath,
                    videoWithBGM: results[1]?.videoWithBGM
                }
            }
        });

        return "success";
    },

    successFunc: async (bizId, bizParam) => {
        console.log(`[VideoSubtitleAndBGM.successFunc] 保存处理结果: ${bizId}`);

        // 从任务记录获取处理结果
        const record = await TaskService.get(bizId);

        if (!record || !record.jobResult) {
            throw new Error("任务结果不存在");
        }

        const processedData = record.jobResult.data;

        // 更新任务状态为成功
        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: {
                subtitlePath: processedData.subtitlePath || "",
                videoWithBGM: processedData.videoWithBGM || "",
                processed: true
            }
        });

        console.log(`[VideoSubtitleAndBGM.successFunc] ✓ 字幕和BGM处理任务完成`);
    },

    failFunc: async (bizId, msg, bizParam) => {
        console.warn(`[VideoSubtitleAndBGM.failFunc] 处理失败: ${bizId}, ${msg}`);

        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now()
        });

        // 清理临时文件（如果有）
        try {
            // TODO: 清理字幕生成过程中的临时文件
            console.log(`[VideoSubtitleAndBGM.failFunc] 清理临时文件...`);
        } catch (error) {
            console.warn(`[VideoSubtitleAndBGM.failFunc] 清理临时文件失败:`, error);
        }
    },

    requestCancelFunc: async (bizId, bizParam) => {
        console.log(`[VideoSubtitleAndBGM.requestCancelFunc] 取消处理: ${bizId}`);

        // 停止字幕生成和BGM处理
        // TODO: 调用取消接口（如果支持）
        // 示例：await window.$mapi.ipAgent.cancelSubtitleGeneration(bizId);

        // 清理临时文件
        try {
            console.log(`[VideoSubtitleAndBGM.requestCancelFunc] 清理临时文件...`);
            // TODO: 清理临时文件
        } catch (error) {
            console.warn(`[VideoSubtitleAndBGM.requestCancelFunc] 清理失败:`, error);
        }
    }
};
