/**
 * 阿里云 FunAudio 录音文件识别
 * 使用HTTP API异步调用，比实时识别更快
 * 文档: https://help.aliyun.com/zh/model-studio/funauidio-asr-recorded-speech-recognition-python-sdk
 */

import axios from 'axios';
import logger from '../log/main';

export interface TranscriptionConfig {
    apiKey: string;
    model?: string;  // 默认 fun-asr
}

export interface TranscriptionSentence {
    text: string;
    beginTime: number;
    endTime: number;
    words?: Array<{
        text: string;
        beginTime: number;
        endTime: number;
    }>;
}

export interface TranscriptionResult {
    success: boolean;
    text?: string;
    sentences?: TranscriptionSentence[];
    error?: string;
    taskId?: string;
}

const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

/**
 * 验证 API Key 是否有效
 * @returns { valid: boolean, error?: string, models?: string[] }
 */
async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string; models?: string[] }> {
    try {
        logger.info('[FunAudio] 验证 API Key...');
        const response = await axios.get(
            `${BASE_URL}/services/audio/asr/models`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 10000
            }
        );

        if (response.status === 200) {
            const models = response.data?.data?.map((m: any) => m.model_id) || [];
            logger.info('[FunAudio] ✅ API Key 有效', { availableModels: models });
            return { valid: true, models };
        }

        return { valid: false, error: 'API 响应异常' };
    } catch (error: any) {
        logger.error('[FunAudio] ❌ API Key 验证失败', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        return {
            valid: false,
            error: error.response?.data?.message || error.message || 'API Key 无效'
        };
    }
}

/**
 * 提交异步转写任务
 */
async function submitTranscriptionTask(
    fileUrl: string,  // 改为单数：只接受单个URL
    config: TranscriptionConfig
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
        const model = config.model || 'qwen3-asr-flash-filetrans';  // 🔧 修复：默认使用 qwen3-asr-flash-filetrans 模型
        logger.info('[FunAudio] 提交转写任务', { fileUrl, model });

        // 🔧 不同模型使用不同的参数格式
        const inputParam = model === 'qwen3-asr-flash-filetrans'
            ? { file_url: fileUrl }           // qwen3 模型使用 file_url（单数）
            : { file_urls: [fileUrl] };       // fun-asr 模型使用 file_urls（数组）

        const response = await axios.post(
            `${BASE_URL}/services/audio/asr/transcription`,
            {
                model: model,
                input: inputParam,
                parameters: {
                    channel_id: [0],      // 音频通道ID
                    enable_itn: false     // 是否启用逆文本归一化
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-DashScope-Async': 'enable'  // 异步调用
                },
                timeout: 30000
            }
        );

        if (response.data?.output?.task_id) {
            logger.info('[FunAudio] 任务提交成功', { taskId: response.data.output.task_id });
            return { success: true, taskId: response.data.output.task_id };
        } else {
            logger.error('[FunAudio] 任务提交失败', response.data);
            return { success: false, error: response.data?.message || '任务提交失败' };
        }

    } catch (error: any) {
        // 🔧 增强错误日志：记录完整的请求和响应信息
        logger.error('[FunAudio] 任务提交异常', {
            // HTTP 状态信息
            status: error.response?.status,
            statusText: error.response?.statusText,

            // 完整的错误响应体（这是关键！）
            responseData: error.response?.data,

            // 请求信息（用于调试）
            requestUrl: error.config?.url,
            requestMethod: error.config?.method,
            requestData: error.config?.data,
            requestHeaders: {
                Authorization: error.config?.headers?.Authorization ? '(已隐藏)' : undefined,
                'X-DashScope-Async': error.config?.headers?.['X-DashScope-Async']
            },

            // 原始错误信息
            errorMessage: error.message,
            errorStack: error.stack
        });

        // 尝试从响应中提取更详细的错误信息
        const responseData = error.response?.data;
        let errorMsg = '未知错误';

        if (responseData) {
            // 阿里云可能返回的错误格式
            errorMsg = responseData.message
                || responseData.error_message
                || responseData.msg
                || JSON.stringify(responseData);
        } else {
            errorMsg = error.message || '未知错误';
        }

        return { success: false, error: errorMsg };
    }
}

/**
 * 查询任务状态
 */
async function queryTaskStatus(
    taskId: string,
    apiKey: string
): Promise<{ status: string; output?: any; error?: string; code?: string }> {
    try {
        const response = await axios.get(
            `${BASE_URL}/tasks/${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 30000
            }
        );

        // 🔧 添加完整响应日志（已注释以减少日志）
        // logger.info('[FunAudio] 任务查询响应', {
        //     taskId,
        //     responseStatus: response.status,
        //     responseData: JSON.stringify(response.data, null, 2)
        // });

        const status = response.data?.output?.task_status || 'UNKNOWN';
        const errorMessage = response.data?.output?.message || response.data?.message;
        const errorCode = response.data?.output?.code || response.data?.code;

        return {
            status,
            output: response.data?.output,
            error: errorMessage,
            code: errorCode
        };

    } catch (error: any) {
        logger.error('[FunAudio] 查询任务状态异常', error);
        return { status: 'ERROR', error: error.message };
    }
}

/**
 * 下载并解析转写结果
 */
async function downloadTranscriptionResult(resultUrl: string): Promise<any> {
    try {
        const response = await axios.get(resultUrl, { timeout: 30000 });
        return response.data;
    } catch (error: any) {
        logger.error('[FunAudio] 下载结果失败', error);
        return null;
    }
}

/**
 * 等待任务完成并获取结果
 */
async function waitForTaskCompletion(
    taskId: string,
    apiKey: string,
    maxWaitSeconds: number = 300
): Promise<{ success: boolean; results?: any[]; error?: string }> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2秒轮询一次

    while ((Date.now() - startTime) < maxWaitSeconds * 1000) {
        const { status, output, error } = await queryTaskStatus(taskId, apiKey);

        // logger.info('[FunAudio] 任务状态', { taskId, status });  // 注释以减少日志

        if (status === 'SUCCEEDED') {
            // 任务成功，获取结果
            logger.info('[FunAudio] 任务成功，获取结果', { output: JSON.stringify(output, null, 2) });

            const result = output?.result;  // 🔧 修复：使用单数 result
            const parsedResults = [];

            if (result?.transcription_url) {
                const transcription = await downloadTranscriptionResult(result.transcription_url);
                if (transcription) {
                    parsedResults.push(transcription);
                }
            }

            logger.info('[FunAudio] 解析结果完成', { parsedResultsCount: parsedResults.length });
            return { success: true, results: parsedResults };
        }

        if (status === 'FAILED') {
            logger.error('[FunAudio] ❌ 任务失败详情', {
                taskId,
                status,
                error,
                output: JSON.stringify(output, null, 2)
            });
            return { success: false, error: error || '任务失败' };
        }

        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: '任务超时' };
}

/**
 * 识别录音文件（主接口）
 * @param fileUrl 音频文件的公网URL
 * @param config 配置
 */
export async function recognizeRecordedAudio(
    fileUrl: string,
    config: TranscriptionConfig
): Promise<TranscriptionResult> {
    try {
        logger.info('[FunAudio] 开始录音识别', { fileUrl, model: config.model });

        // 0. 验证 API Key（暂时禁用，因为阿里云不支持该端点）
        // const validation = await validateApiKey(config.apiKey);
        // if (!validation.valid) {
        //     logger.error('[FunAudio] ❌ API Key 验证失败，无法继续', { error: validation.error });
        //     return { success: false, error: `API Key 无效: ${validation.error}` };
        // }

        // 1. 提交任务
        const submitResult = await submitTranscriptionTask(fileUrl, config);  // 传递单个URL，不再使用数组
        if (!submitResult.success || !submitResult.taskId) {
            return { success: false, error: submitResult.error || '任务提交失败' };
        }

        // 2. 等待任务完成
        const waitResult = await waitForTaskCompletion(submitResult.taskId, config.apiKey, 300);
        if (!waitResult.success || !waitResult.results?.length) {
            return { success: false, error: waitResult.error || '未获取到识别结果', taskId: submitResult.taskId };
        }

        // 3. 解析结果
        const transcription = waitResult.results[0];
        const sentences: TranscriptionSentence[] = [];
        let fullText = '';

        if (transcription?.transcripts) {
            for (const transcript of transcription.transcripts) {
                if (transcript.sentences) {
                    for (const sentence of transcript.sentences) {
                        sentences.push({
                            text: sentence.text || '',
                            beginTime: sentence.begin_time || 0,
                            endTime: sentence.end_time || 0,
                            words: sentence.words?.map((w: any) => ({
                                text: w.text || '',
                                beginTime: w.begin_time || 0,
                                endTime: w.end_time || 0
                            }))
                        });
                    }
                }
                if (transcript.text) {
                    fullText += transcript.text;
                }
            }
        }

        logger.info('[FunAudio] ✅ 识别完成', {
            sentenceCount: sentences.length,
            textLength: fullText.length
        });

        // 🔧 修复：去除字幕时间轴重叠
        // 确保上一条字幕的 endTime 不会晚于下一条字幕的 beginTime
        const MIN_GAP_MS = 50; // 最小间隔 50 毫秒
        for (let i = 0; i < sentences.length - 1; i++) {
            const current = sentences[i];
            const next = sentences[i + 1];

            if (current.endTime >= next.beginTime) {
                const oldEndTime = current.endTime;
                // 将当前字幕的结束时间调整为下一条字幕开始时间之前
                current.endTime = Math.max(current.beginTime + MIN_GAP_MS, next.beginTime - MIN_GAP_MS);
                // logger.info('[FunAudio] 修复时间轴重叠', {  // 注释以减少日志
                //     index: i,
                //     text: current.text.substring(0, 20) + '...',
                //     oldEndTime,
                //     newEndTime: current.endTime,
                //     nextBeginTime: next.beginTime
                // });
            }
        }

        return {
            success: true,
            text: fullText,
            sentences,
            taskId: submitResult.taskId
        };

    } catch (error: any) {
        logger.error('[FunAudio] 识别异常', error);
        return { success: false, error: error.message || '未知错误' };
    }
}
