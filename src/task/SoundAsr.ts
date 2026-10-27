// @ts-nocheck
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { useModelStore } from "../module/Model/store/model";
import { TaskBiz } from "../store/modules/task";
import { BUILTIN_PROVIDERS, getBuiltInConfig } from "../module/Model/builtinConfig";
import { getSystemConfigSync } from "../service/systemConfig";

const serverStore = useServerStore();
const modelStore = useModelStore();

export const SoundAsr: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // 先获取任务记录
        const record = await TaskService.get(bizId);
        if (!record) {
            throw new Error("任务记录不存在");
        }

        // 检查是本地模型还是在线模型
        const modelType = record.modelConfig.modelType || "local";

        if (modelType === "online") {
            // 在线模型模式 - 调用内置模型的ASR服务
            return await handleOnlineAsr(bizId, record);
        } else {
            // 本地模型模式 - 调用本地服务器
            const { server, serverInfo } = await serverStore.prepareForTask(bizId, bizParam);
            const res = await serverStore.call(serverInfo, "asr", {
                id: serverStore.generateTaskId("SoundAsr", bizId),
                result: record.result,
                param: record.param,
                audio: record.modelConfig.audio,
            });
            if (res.code) {
                throw res.msg || "SoundAsr run fail";
            }
            switch (res.data.type) {
                case "success":
                    TaskService.update(bizId, {
                        status: "success",
                        jobResult: res,
                    }).catch(e => {
                        console.warn(`[SoundAsr] Failed to update database: ${e}`);
                    });
                    return "success";
                case "retry":
                    return "retry";
                default:
                    throw `unknown res.data.type : ${res.data.type}`;
            }
        }
    },
    successFunc: async (bizId, bizParam) => {
        // 先获取任务记录以检查模型类型
        const record = await TaskService.get(bizId);
        if (!record) {
            console.warn(`[SoundAsr] 任务记录不存在: ${bizId}`);
            return;
        }

        const modelType = record.modelConfig.modelType || "local";

        if (modelType === "online") {
            // 在线模型 - 从jobResult中提取识别结果
            if (!record.jobResult?.data?.data?.records) {
                console.warn(`[SoundAsr] 在线模型没有识别结果: ${bizId}`);
                return;
            }

            const records = record.jobResult.data.data.records;
            let fullText = "";
            records.forEach((item: any) => {
                fullText += item.text + " ";
            });

            console.log(`[SoundAsr] successFunc处理在线模型结果`, {
                recordCount: records.length,
                fullText: fullText.trim(),
            });

            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    fullText: fullText.trim(),
                    records: records,
                },
            });
        } else {
            // 本地模型 - 需要获取服务器信息
            const { record: serverRecord } = await serverStore.prepareForTask(bizId, bizParam);
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    records: serverRecord.jobResult.data.data.records,
                },
            });
        }
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

/**
 * 处理在线ASR任务
 */
async function handleOnlineAsr(bizId: string, record: any): Promise<string> {
    try {
        const modelId = record.modelConfig.onlineModelId;
        const providerId = modelId.split("|")[0];

        // 检查是否是阿里云相关模型（支持 builtInAliyun 和 dashscope）
        if (providerId !== "builtInAliyun" && providerId !== "dashscope") {
            throw new Error("当前仅支持阿里云百炼内置模型的在线语音识别");
        }

        // 获取API密钥和OSS配置
        let builtinConfig;
        if (providerId === "builtInAliyun") {
            builtinConfig = getBuiltInConfig(providerId);
        } else {
            // dashscope: 使用用户配置的provider，但提供硬编码兜底
            const { useModelStore } = await import("../module/Model/store/model");
            const modelStore = useModelStore();
            const provider = modelStore.providers.find(p => p.id === 'dashscope');
            const _sysCfg = getSystemConfigSync();
            builtinConfig = {
                apiKey: provider?.data?.apiKey || _sysCfg.aliyun_bailian_api_key,
                ossConfig: provider?.data?.ossAccessKeyId ? {
                    accessKeyId: provider.data.ossAccessKeyId,
                    accessKeySecret: provider.data.ossAccessKeySecret,
                    bucket: provider.data.ossBucket,
                    region: provider.data.ossRegion,
                    endpoint: provider.data.ossEndpoint
                } : {
                    accessKeyId: _sysCfg.aliyun_oss_access_key_id,
                    accessKeySecret: _sysCfg.aliyun_oss_access_key_secret,
                    bucket: _sysCfg.aliyun_oss_bucket,
                    region: _sysCfg.aliyun_oss_region,
                    endpoint: `oss-${_sysCfg.aliyun_oss_region}.aliyuncs.com`
                }
            };
        }

        if (!builtinConfig) {
            throw new Error("无法获取阿里云内置配置");
        }

        const apiKey = builtinConfig.apiKey;

        // 本地文件：需要上传到OSS获得URL
        const audioPath = record.modelConfig.audio;
        if (!audioPath) {
            throw new Error("音频文件路径为空");
        }

        // 调用本地API上传到OSS并获得URL
        const ossResult = await (window as any).$mapi.aliyun.funasr.recognize({
            audioPath,
            config: {
                apiKey,
                ossConfig: builtinConfig.ossConfig,
                model: "qwen3-asr-flash-filetrans"  // 🔧 修复：使用与一键IP智能体相同的模型
            }
        });

        if (!ossResult.success) {
            throw new Error(ossResult.error || "音频处理失败");
        }

        // 🔍 详细输出识别结果，便于调试
        console.log('========== FUNASR识别结果详情 ==========');
        console.log('完整文本:', ossResult.fullText);
        console.log('句子数量:', ossResult.sentences?.length || 0);
        console.log('句子列表:');
        ossResult.sentences?.forEach((s: any, index: number) => {
            console.log(`  句子${index + 1}:`, {
                文本: s.text,
                开始时间: `${s.startTime}ms (${(s.startTime / 1000).toFixed(2)}s)`,
                结束时间: `${s.endTime}ms (${(s.endTime / 1000).toFixed(2)}s)`,
                时长: `${s.endTime - s.startTime}ms`,
                词数: s.words?.length || 0
            });
            if (s.words && s.words.length > 0) {
                console.log(`    词级时间戳 (前5个):`, s.words.slice(0, 5));
            }
        });
        console.log('原始结果对象:', ossResult);
        console.log('========================================');

        // 保存识别结果
        await TaskService.update(bizId, {
            status: "success",
            jobResult: {
                code: 0,
                data: {
                    data: {
                        records: ossResult.sentences?.map((s: any) => ({
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime,
                        })) || [
                                {
                                    text: ossResult.fullText || "",
                                    startTime: 0,
                                    endTime: 0,
                                }
                            ],
                    },
                },
            },
        }).catch(e => {
            console.error(`[SoundAsr] Failed to update database: ${e}`);
        });

        return "success";
    } catch (error: any) {
        throw error.message || "在线ASR处理失败";
    }
}
