import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import logger from '../log/main';
import { v4 as uuidv4 } from 'uuid';

const DASHSCOPE_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';

/**
 * 中文语言名 → 阿里云 language_type 枚举值映射
 */
function mapLanguageType(language?: string): string | undefined {
    const languageMap: Record<string, string> = {
        '中文': 'Chinese',
        '中文（普通话）': 'Chinese',
        'Chinese': 'Chinese',
        '英语': 'English',
        'English': 'English',
        '德语': 'German',
        'German': 'German',
        '意大利语': 'Italian',
        'Italian': 'Italian',
        '葡萄牙语': 'Portuguese',
        'Portuguese': 'Portuguese',
        '西班牙语': 'Spanish',
        'Spanish': 'Spanish',
        '日语': 'Japanese',
        'Japanese': 'Japanese',
        '韩语': 'Korean',
        'Korean': 'Korean',
        '法语': 'French',
        'French': 'French',
        '俄语': 'Russian',
        'Russian': 'Russian',
    };
    return language ? languageMap[language] : undefined;
}

export interface CosyVoiceRealtimeConfig {
    apiKey: string;
    model: string;
    voice: string;
    text: string;
    rate?: number;
    volume?: number;
    pitch?: number;
    instruction?: string;
    format?: string;
    sampleRate?: number;
    outputPath?: string;
    language?: string; // 语言类型，如 '中文'、'英语'、'日语' 等，映射为 language_type 传给 API
}

export interface CosyVoiceRealtimeResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    requestId?: string;
}

/**
 * 使用 WebSocket 调用阿里云 CosyVoice 实时语音合成
 */
export async function synthesizeSpeechRealtime(
    config: CosyVoiceRealtimeConfig
): Promise<CosyVoiceRealtimeResult> {
    const {
        apiKey,
        model: requestedModel = 'cosyvoice-v3-flash',
        voice,
        text,
        rate: rawRate = 1.0,
        volume: rawVolume = 100,
        pitch: rawPitch = 1.0,
        instruction = '',
        format = 'mp3',
        sampleRate = 22050,
        outputPath
    } = config;

    // Older system voices ending in _v2 are bound to the V2 model.
    const model = /^(?:long|loong).*_v2$/.test(voice || '') ? 'cosyvoice-v2' : requestedModel;

    // 确保参数类型正确（防止前端传入字符串）
    const rate = typeof rawRate === 'string' ? parseFloat(rawRate) : (rawRate ?? 1.0);
    const volume = typeof rawVolume === 'string' ? parseInt(rawVolume, 10) : (rawVolume ?? 50);
    const pitch = typeof rawPitch === 'string' ? parseFloat(rawPitch) : (rawPitch ?? 1.0);

    if (!apiKey) {
        return { success: false, error: '缺少 API Key' };
    }
    if (!voice) {
        return { success: false, error: '缺少音色 voice' };
    }
    if (!text) {
        return { success: false, error: '缺少合成文本' };
    }

    // 确定输出路径
    let finalOutputPath: string;
    if (outputPath) {
        finalOutputPath = outputPath;
        const outputDir = path.dirname(finalOutputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    } else {
        const outputDir = path.join(app.getPath('userData'), 'temp', 'tts');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        finalOutputPath = path.join(outputDir, `cosyvoice_${Date.now()}.${format}`);
    }

    const taskId = uuidv4().replace(/-/g, '');

    logger.info('[CosyVoiceRealtime] 开始 WebSocket 语音合成', {
        model,
        voice,
        textLength: text.length,
        rate,
        instruction,
        outputPath: finalOutputPath
    });

    return new Promise((resolve) => {
        const ws = new WebSocket(DASHSCOPE_WS_URL, {
            headers: {
                Authorization: `bearer ${apiKey}`,
            },
            timeout: 30000
        });

        const audioChunks: Buffer[] = [];
        let taskStarted = false;
        let taskFinished = false;
        let taskFailed = false;
        let errorMessage = '';
        let finishTaskSent = false;

        const timeout = setTimeout(() => {
            if (!taskFinished && !taskFailed) {
                errorMessage = 'WebSocket 连接超时';
                taskFailed = true;
                try { ws.close(); } catch (e) { /* ignore */ }
                resolve({ success: false, error: errorMessage });
            }
        }, 300000); // 5分钟超时

        ws.on('open', () => {
            logger.info('[CosyVoiceRealtime] WebSocket 连接已建立');

            // 发送 run-task
            const runTaskMsg = {
                header: {
                    action: 'run-task',
                    task_id: taskId,
                    streaming: 'duplex'
                },
                payload: {
                    task_group: 'audio',
                    task: 'tts',
                    function: 'SpeechSynthesizer',
                    model: model,
                    parameters: {
                        text_type: 'PlainText',
                        voice: voice,
                        format: format,
                        sample_rate: sampleRate,
                        volume: volume,
                        rate: rate,
                        pitch: pitch,
                        ...(instruction ? { instruction: instruction } : {}),
                        ...(mapLanguageType(config.language) ? { language_type: mapLanguageType(config.language) } : {}),
                        enable_ssml: false
                    },
                    input: {}
                }
            };

            ws.send(JSON.stringify(runTaskMsg));
            logger.info('[CosyVoiceRealtime] 已发送 run-task');
        });

        ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
            if (isBinary) {
                // 二进制音频数据
                const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
                audioChunks.push(buffer);
                logger.info('[CosyVoiceRealtime] 收到音频数据', { size: buffer.length });
                return;
            }

            // JSON 文本消息
            const messageStr = data.toString();
            try {
                const message = JSON.parse(messageStr);
                const event = message.header?.event;

                logger.info('[CosyVoiceRealtime] 收到事件', { event, taskId: message.header?.task_id });

                if (event === 'task-started') {
                    taskStarted = true;
                    // 发送 continue-task（文本）
                    const continueTaskMsg = {
                        header: {
                            action: 'continue-task',
                            task_id: taskId,
                            streaming: 'duplex'
                        },
                        payload: {
                            input: {
                                text: text
                            }
                        }
                    };
                    ws.send(JSON.stringify(continueTaskMsg));
                    logger.info('[CosyVoiceRealtime] 已发送 continue-task');

                    // 发送 finish-task
                    const finishTaskMsg = {
                        header: {
                            action: 'finish-task',
                            task_id: taskId,
                            streaming: 'duplex'
                        },
                        payload: {
                            input: {}
                        }
                    };
                    ws.send(JSON.stringify(finishTaskMsg));
                    finishTaskSent = true;
                    logger.info('[CosyVoiceRealtime] 已发送 finish-task');
                } else if (event === 'task-finished') {
                    taskFinished = true;
                    clearTimeout(timeout);

                    // 保存音频文件
                    if (audioChunks.length > 0) {
                        const totalAudio = Buffer.concat(audioChunks);
                        try {
                            fs.writeFileSync(finalOutputPath, totalAudio);
                        } catch (error: any) {
                            ws.close();
                            resolve({ success: false, error: '保存音频失败: ' + error.message, requestId: taskId });
                            return;
                        }
                        logger.info('[CosyVoiceRealtime] 音频已保存', {
                            path: finalOutputPath,
                            size: totalAudio.length
                        });
                        ws.close();
                        resolve({ success: true, audioPath: finalOutputPath, requestId: taskId });
                    } else {
                        errorMessage = '未收到音频数据';
                        ws.close();
                        resolve({ success: false, error: errorMessage, requestId: taskId });
                    }
                } else if (event === 'task-failed') {
                    taskFailed = true;
                    clearTimeout(timeout);
                    errorMessage = message.header?.error_message || '任务执行失败';
                    logger.error('[CosyVoiceRealtime] 任务失败', {
                        errorCode: message.header?.error_code,
                        errorMessage
                    });
                    ws.close();
                    resolve({ success: false, error: errorMessage });
                } else if (event === 'result-generated') {
                    // 结果生成事件，可能包含 base64 编码的音频数据
                    const output = message.payload?.output;
                    const type = output?.type;

                    if (output?.audio) {
                        // 提取 base64 音频数据
                        const audioBase64 = output.audio;
                        try {
                            const audioBuffer = Buffer.from(audioBase64, 'base64');
                            if (audioBuffer.length > 0) {
                                audioChunks.push(audioBuffer);
                                logger.info('[CosyVoiceRealtime] 收到 base64 音频数据', { size: audioBuffer.length });
                            }
                        } catch (e: any) {
                            logger.error('[CosyVoiceRealtime] 解析 base64 音频失败', e.message);
                        }
                    } else {
                        logger.info('[CosyVoiceRealtime] 结果生成中', { type });
                    }
                }
            } catch (e: any) {
                logger.error('[CosyVoiceRealtime] 解析消息失败', e.message);
            }
        });

        ws.on('error', (error: Error) => {
            logger.error('[CosyVoiceRealtime] WebSocket 错误', error.message);
            if (!taskFinished && !taskFailed) {
                clearTimeout(timeout);
                resolve({ success: false, error: `WebSocket 错误: ${error.message}` });
            }
        });

        ws.on('close', (code: number, reason: Buffer) => {
            logger.info('[CosyVoiceRealtime] WebSocket 连接关闭', {
                code,
                reason: reason.toString()
            });
            clearTimeout(timeout);
            if (!taskFinished && !taskFailed) {
                // A partial stream is not a successful synthesis or a valid preview cache.
                resolve({ success: false, error: errorMessage || '语音合成连接提前关闭，音频未完整生成，请重试', requestId: taskId });
            }
        });
    });
}
