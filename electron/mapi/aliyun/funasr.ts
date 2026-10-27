import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../log/main';

/**
 * 阿里云 FunASR 语音识别 WebSocket 客户端
 * 文档: https://help.aliyun.com/zh/model-studio/fun-asr-realtime-python-sdk
 */

export interface FunAsrConfig {
    apiKey: string;
    model: string;           // qwen3-asr-flash | fun-asr-realtime | fun-asr
    format: string;          // pcm | wav | mp3 | opus | speex | aac | amr
    sampleRate: number;      // 音频采样率，支持 16000Hz
    language?: string[];     // 语言代码: zh, en, ja
}

export interface AsrWord {
    text: string;
    startTime: number;  // 毫秒
    endTime: number;    // 毫秒
}

export interface AsrSentence {
    text: string;
    startTime: number;
    endTime: number;
    words?: AsrWord[];
}

export interface FunAsrResult {
    success: boolean;
    sentences?: AsrSentence[];
    fullText?: string;
    error?: string;
    requestId?: string;
}

/**
 * FunASR 语音识别主函数
 */
export async function recognizeAudio(
    audioFilePath: string,
    config: FunAsrConfig
): Promise<FunAsrResult> {
    const wsUrl = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';

    logger.info('[FunASR] 开始语音识别', {
        model: config.model,
        format: config.format,
        sampleRate: config.sampleRate,
        audioFile: path.basename(audioFilePath)
    });

    // 读取音频文件
    if (!fs.existsSync(audioFilePath)) {
        return {
            success: false,
            error: `音频文件不存在: ${audioFilePath}`
        };
    }

    const audioData = fs.readFileSync(audioFilePath);
    logger.info(`[FunASR] 音频文件大小: ${audioData.length} bytes`);

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'X-DashScope-DataInspection': 'enable'
            }
        });
        const sentences: AsrSentence[] = [];
        let requestId = '';
        let startTime = Date.now();
        let isFirstPackage = true;
        let taskId = '';
        let audioOffset = 0;
        const chunkSize = 32000; // 每次发送32KB，加速处理

        // 发送下一个音频块的函数（快速批量模式）
        const sendNextChunk = () => {
            if (audioOffset >= audioData.length) {
                // 发送完成信号
                const finishMessage = {
                    header: {
                        action: 'finish-task',
                        task_id: taskId
                    },
                    payload: {
                        input: {}  // 必需字段
                    }
                };

                ws.send(JSON.stringify(finishMessage), (err) => {
                    if (err) {
                        logger.error('[FunASR] 发送完成信号失败', err);
                    } else {
                        logger.info('[FunASR] 音频数据发送完成');
                    }
                });
                return;
            }

            const chunk = audioData.slice(audioOffset, audioOffset + chunkSize);
            audioOffset += chunkSize;

            // 发送二进制音频数据
            ws.send(chunk, (err) => {
                if (err) {
                    logger.error('[FunASR] 发送音频块失败', err);
                    ws.close();
                } else {
                    // 快速批量模式：5ms间隔（接近无延迟但避免缓冲区溢出）
                    setImmediate(sendNextChunk);
                }
            });
        };

        ws.on('open', () => {
            logger.info('[FunASR] WebSocket 连接已建立');

            // 生成任务ID
            taskId = generateTaskId();

            // 第一步：发送配置消息（run-task指令）
            const configMessage = {
                header: {
                    action: 'run-task',
                    streaming: 'duplex',
                    task_id: taskId
                },
                payload: {
                    model: config.model,
                    task: 'asr',
                    task_group: 'audio',
                    function: 'recognition',
                    input: {},  // 必需字段，空对象
                    parameters: {
                        format: config.format,
                        sample_rate: config.sampleRate,
                        language_hints: config.language || ['zh', 'en'],
                        punctuation_prediction_enabled: true,
                        semantic_punctuation_enabled: false,
                        max_sentence_silence: 300,  // 🔧 修复：降低到300ms，让句子分割更细
                        word_timestamp_enabled: true  // 🔧 新增：启用词级时间戳
                    }
                }
            };

            ws.send(JSON.stringify(configMessage), (err) => {
                if (err) {
                    logger.error('[FunASR] 发送配置失败', err);
                    ws.close();
                    reject(new Error(`发送配置失败: ${err.message}`));
                    return;
                }

                logger.info('[FunASR] 配置已发送，立即开始发送音频...');
                // 根据官方文档：start()后立即发送音频，不需要等待服务器响应
                sendNextChunk();
            });
        });

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString());

                // 调试日志：打印服务器返回的完整消息结构
                logger.info('[FunASR] 收到消息:', JSON.stringify(message.header || {}));

                if (message.header) {
                    requestId = message.header.task_id || message.header.request_id || '';

                    // 检查服务器是否准备好接收音频
                    // FunASR可能使用不同的事件名，在收到首包响应后就开始发送
                    const event = message.header.event || message.header.action || '';

                    // 首包延迟统计（仅用于调试）
                    if (isFirstPackage) {
                        const firstPackageDelay = Date.now() - startTime;
                        logger.info(`[FunASR] 收到首包结果，延迟: ${firstPackageDelay}ms, event: ${event}`);
                        isFirstPackage = false;
                        // 注意：音频发送已在配置发送后立即开始，这里不再重复触发
                    }

                    // 检查错误
                    if (message.header.status === 'failed') {
                        const errorMsg = message.header.message || '识别失败';
                        logger.error('[FunASR] 识别失败', message);
                        ws.close();
                        resolve({
                            success: false,
                            error: errorMsg,
                            requestId
                        });
                        return;
                    }
                }

                // 处理识别结果
                if (message.payload && message.payload.output) {
                    const output = message.payload.output;

                    // 中间结果
                    if (output.sentence) {
                        const sentence = output.sentence;

                        // 只处理已完成的句子
                        if (sentence.end_time) {
                            // 🔧 添加详细日志
                            logger.info('[FunASR] 原始句子数据:', {
                                text: sentence.text,
                                begin_time: sentence.begin_time,
                                end_time: sentence.end_time,
                                完整数据: JSON.stringify(sentence)
                            });

                            const asrSentence: AsrSentence = {
                                text: sentence.text || '',
                                startTime: sentence.begin_time || 0,
                                endTime: sentence.end_time || 0
                            };

                            // 添加词级时间戳
                            if (sentence.words && Array.isArray(sentence.words)) {
                                asrSentence.words = sentence.words.map((word: any) => ({
                                    text: word.text || '',
                                    startTime: word.begin_time || 0,
                                    endTime: word.end_time || 0
                                }));
                            }

                            sentences.push(asrSentence);
                            logger.info(`[FunASR] 识别到句子: ${asrSentence.text} (${asrSentence.startTime} - ${asrSentence.endTime})`);
                        }
                    }
                }
            } catch (error: any) {
                logger.error('[FunASR] 处理消息失败', error);
            }
        });

        ws.on('close', () => {
            const totalDuration = Date.now() - startTime;
            logger.info(`[FunASR] WebSocket 连接已关闭，总耗时: ${totalDuration}ms`);

            if (sentences.length === 0) {
                resolve({
                    success: false,
                    error: '未识别到任何文本',
                    requestId
                });
                return;
            }

            // 合并所有句子文本
            const fullText = sentences.map(s => s.text).join('');

            logger.info(`[FunASR] 识别完成，共${sentences.length}个句子，总文本长度: ${fullText.length}`);

            resolve({
                success: true,
                sentences,
                fullText,
                requestId
            });
        });

        ws.on('error', (error) => {
            logger.error('[FunASR] WebSocket 错误', error);
            resolve({
                success: false,
                error: `WebSocket错误: ${error.message}`,
                requestId
            });
        });
    });
}

/**
 * 生成任务ID
 */
function generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 检测音频格式
 */
export function detectAudioFormat(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const formatMap: { [key: string]: string } = {
        '.wav': 'wav',
        '.mp3': 'mp3',
        '.pcm': 'pcm',
        '.opus': 'opus',
        '.aac': 'aac',
        '.amr': 'amr',
        '.speex': 'speex'
    };

    return formatMap[ext] || 'wav';
}
