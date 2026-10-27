import { ipcMain } from 'electron';
import * as aliyunApi from './index';
import { uploadToOss, getOssConfigFromProvider, OssConfig } from './oss';
import { recognizeRecordedAudio } from './transcription';
import logger from '../log/main';
import { preCacheSystemVoices, getPreCachedVoicePath, isAllVoicesCached, clearPreCache } from './voicePreCache';
import { detectAudioSegments, allocateTextToSegments } from '../audio/volumeDetect';
import { synthesizeSpeechRealtime } from './cosyvoiceRealtime';

export function registerAliyunHandlers() {
    // CosyVoice TTS 合成
    ipcMain.handle('aliyun:cosyvoice:synthesize', async (event, params) => {
        try {
            // 如果指定了 saveToPreCache，自动设置输出路径到预缓存目录
            if (params.config.saveToPreCache) {
                const voiceId = params.config.saveToPreCache;
                const { getPreCacheDir } = await import('./voicePreCache');
                const path = await import('path');
                const cacheDir = getPreCacheDir();
                const outputPath = path.default.join(cacheDir, `${voiceId}.wav`);

                logger.info('[Aliyun:IPC] 保存到预缓存目录', { voiceId, outputPath });

                // 设置输出路径
                params.config.outputPath = outputPath;
                // 移除 saveToPreCache，避免传递给 API
                delete params.config.saveToPreCache;
            }

            // 🆕 如果 provided language but not instruction，自动生成 instruction
            if (params.config.language && !params.config.instruction) {
                const instruction = aliyunApi.cosyvoice.getInstructionForLanguage(params.config.language);
                if (instruction) {
                    params.config.instruction = instruction;
                    logger.info('[Aliyun:IPC] 已为语言生成指令', {
                        language: params.config.language,
                        instruction
                    });
                }
            }

            return await aliyunApi.cosyvoice.synthesizeSpeech(params.text, params.config);
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 合成失败', error);
            return { success: false, error: error.message };
        }
    });

    // CosyVoice 实时语音合成（V1，WebSocket 方式，支持 instruction/语速/情绪）
    ipcMain.handle('aliyun:cosyvoiceRealtime:synthesize', async (event, params) => {
        try {
            logger.info('[Aliyun:IPC] CosyVoice 实时合成', {
                model: params.model,
                voice: params.voice,
                textLength: params.text?.length
            });
            return await synthesizeSpeechRealtime(params);
        } catch (error: any) {
            logger.error('[Aliyun:IPC] CosyVoice 实时合成失败', error);
            return { success: false, error: error.message };
        }
    });

    // Sambert TTS 合成
    ipcMain.handle('aliyun:sambert:synthesize', async (event, params) => {
        try {
            return await aliyunApi.sambertSynthesizeSpeech(params.text, params.config);
        } catch (error: any) {
            logger.error('[Aliyun:IPC] Sambert合成失败', error);
            return { success: false, error: error.message };
        }
    });

    // Sambert 获取音色列表
    ipcMain.handle('aliyun:sambert:getVoices', async () => {
        try {
            return { success: true, voices: aliyunApi.getSambertVoices() };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 获取Sambert音色列表失败', error);
            return { success: false, error: error.message };
        }
    });

    // CosyVoice V2 TTS 合成
    ipcMain.handle('aliyun:cosyvoiceV2:synthesize', async (event, params) => {
        try {
            return await aliyunApi.cosyvoiceV2Synthesize(params.text, params.config);
        } catch (error: any) {
            logger.error('[Aliyun:IPC] CosyVoice V2合成失败', error);
            return { success: false, error: error.message };
        }
    });

    // CosyVoice V2 获取音色列表
    ipcMain.handle('aliyun:cosyvoiceV2:getVoices', async () => {
        try {
            return { success: true, voices: aliyunApi.getCosyVoiceV2Voices() };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 获取CosyVoice V2音色列表失败', error);
            return { success: false, error: error.message };
        }
    });

    // CosyVoice 声音复刻
    ipcMain.handle('aliyun:cosyvoice:enroll', async (event, params) => {
        try {
            // params: { apiKey, audioPath, name, ossConfig }
            return await aliyunApi.enrollVoice(params);
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 复刻失败', error);
            return { success: false, error: error.message };
        }
    });

    // FunASR 语音识别（仅使用录音文件识别模式）
    ipcMain.handle('aliyun:funasr:recognize', async (event, params) => {
        try {
            // params: { audioPath, config: { apiKey, ossConfig } }
            logger.info('[Aliyun:IPC] 开始语音识别（录音文件识别模式）', { audioPath: params.audioPath });

            const { audioPath, config } = params;

            // 检查OSS配置（必需）
            logger.info('[Aliyun:IPC] 接收到的配置', {
                hasOssConfig: !!config.ossConfig,
                ossConfigKeys: config.ossConfig ? Object.keys(config.ossConfig) : [],
                ossConfig: config.ossConfig
            });

            const ossConfig: OssConfig | null = config.ossConfig ? {
                accessKeyId: config.ossConfig.accessKeyId,
                accessKeySecret: config.ossConfig.accessKeySecret,
                bucket: config.ossConfig.bucket,
                region: config.ossConfig.region,
                endpoint: config.ossConfig.endpoint
            } : null;

            // 必须配置OSS才能使用录音识别
            if (!ossConfig || !ossConfig.accessKeyId || !ossConfig.bucket) {
                logger.error('[Aliyun:IPC] OSS未配置，无法使用录音识别', { ossConfig });
                return {
                    success: false,
                    error: '请先在「模型」→「阿里云百炼」中配置OSS（用于快速语音识别）'
                };
            }

            if (!ossConfig.region) {
                logger.error('[Aliyun:IPC] OSS Region 未配置', { ossConfig });
                return {
                    success: false,
                    error: '请在「模型」→「阿里云百炼」中配置 OSS Region（地域）'
                };
            }

            logger.info('[Aliyun:IPC] 使用录音文件识别模式', {
                bucket: ossConfig.bucket,
                region: ossConfig.region,
                hasEndpoint: !!ossConfig.endpoint
            });

            // 检查文件类型，如果是视频文件需要提取音频
            const path = await import('path');
            const ext = path.extname(audioPath).toLowerCase();
            let finalAudioPath = audioPath;

            if (['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm'].includes(ext)) {
                logger.info('[Aliyun:IPC] 检测到视频文件，需要提取音频', { ext, audioPath });
                try {
                    const { extractAudioFromVideo } = await import('../ipAgent/funasr');
                    const extractedAudioPath = await extractAudioFromVideo(audioPath);
                    finalAudioPath = extractedAudioPath;
                    logger.info('[Aliyun:IPC] 音频提取成功', { extractedAudioPath });
                } catch (extractError: any) {
                    logger.warn('[Aliyun:IPC] 音频提取失败，继续尝试上传原文件', { error: extractError.message });
                }
            }

            // 1. 上传到OSS
            const uploadResult = await uploadToOss(finalAudioPath, ossConfig);
            if (!uploadResult.success || !uploadResult.url) {
                logger.error('[Aliyun:IPC] OSS上传失败', uploadResult.error);
                return { success: false, error: `OSS上传失败: ${uploadResult.error}` };
            }

            logger.info('[Aliyun:IPC] OSS上传成功', { url: uploadResult.url });

            // 2. 调用录音识别API
            const result = await recognizeRecordedAudio(uploadResult.url, {
                apiKey: config.apiKey,
                model: config.model || 'qwen3-asr-flash-filetrans'  // 🔧 修复：默认使用 qwen3-asr-flash-filetrans 模型
            });

            // 转换结果格式以保持兼容性
            return {
                success: result.success,
                fullText: result.text,
                sentences: result.sentences?.map(s => ({
                    text: s.text,
                    startTime: s.beginTime,
                    endTime: s.endTime,
                    words: s.words?.map(w => ({
                        text: w.text,
                        startTime: w.beginTime,
                        endTime: w.endTime
                    }))
                })),
                error: result.error,
                requestId: result.taskId
            };
        } catch (error: any) {
            // 确保错误消息可序列化（避免循环引用）
            let errorMessage = '未知错误';
            if (error && typeof error === 'object') {
                errorMessage = error.message || error.toString();
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            logger.error('[Aliyun:IPC] 语音识别失败', { errorMessage });
            return { success: false, error: errorMessage };
        }
    });

    // FunASR 使用 URL 直接识别（无需上传OSS）
    ipcMain.handle('aliyun:funasr:recognizeFromUrl', async (event, params) => {
        try {
            // params: { audioUrl, apiKey }
            logger.info('[Aliyun:IPC] 开始语音识别（URL模式）', { audioUrl: params.audioUrl });

            const { audioUrl, apiKey } = params;

            if (!audioUrl || !apiKey) {
                return { success: false, error: '缺少必要参数：audioUrl 或 apiKey' };
            }

            // 直接使用 URL 调用识别 API
            const result = await recognizeRecordedAudio(audioUrl, {
                apiKey,
                model: params.model || 'fun-asr'  // 使用传递的模型，默认 fun-asr
            });

            // 转换结果格式以保持兼容性
            return {
                success: result.success,
                fullText: result.text,
                sentences: result.sentences?.map(s => ({
                    text: s.text,
                    startTime: s.beginTime,
                    endTime: s.endTime,
                    words: s.words?.map(w => ({
                        text: w.text,
                        startTime: w.beginTime,
                        endTime: w.endTime
                    }))
                })),
                error: result.error,
                requestId: result.taskId
            };
        } catch (error: any) {
            let errorMessage = '未知错误';
            if (error && typeof error === 'object') {
                errorMessage = error.message || error.toString();
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            logger.error('[Aliyun:IPC] URL识别失败', { errorMessage });
            return { success: false, error: errorMessage };
        }
    });

    // 预缓存系统默认音色
    ipcMain.handle('aliyun:cosyvoice:preCacheSystemVoices', async (event, params) => {
        try {
            const { apiKey, force } = params;
            await preCacheSystemVoices(apiKey, force);
            return { success: true };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 预缓存失败', error);
            return { success: false, error: error.message };
        }
    });

    // 获取预缓存的音色文件路径
    ipcMain.handle('aliyun:cosyvoice:getPreCachedVoicePath', async (event, voiceId: string) => {
        try {
            const cachedPath = getPreCachedVoicePath(voiceId);
            return { success: true, path: cachedPath };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 获取预缓存路径失败', error);
            return { success: false, error: error.message };
        }
    });

    // 检查所有音色是否已缓存
    ipcMain.handle('aliyun:cosyvoice:isAllVoicesCached', async (event) => {
        try {
            const allCached = isAllVoicesCached();
            return { success: true, allCached };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 检查缓存状态失败', error);
            return { success: false, error: error.message };
        }
    });

    // 清除预缓存
    ipcMain.handle('aliyun:cosyvoice:clearPreCache', async (event) => {
        try {
            clearPreCache();
            return { success: true };
        } catch (error: any) {
            logger.error('[Aliyun:IPC] 清除预缓存失败', error);
            return { success: false, error: error.message };
        }
    });

    // 音量检测 - 检测音频中的声音片段
    ipcMain.handle('audio:detectVolume', async (event, params) => {
        try {
            // params: { audioPath, config?: { silenceThreshold, minSilenceDuration, minSoundDuration } }
            logger.info('[Audio:IPC] 开始音量检测', { audioPath: params.audioPath });

            const result = await detectAudioSegments(params.audioPath, params.config || {});
            return result;
        } catch (error: any) {
            logger.error('[Audio:IPC] 音量检测失败', error);
            return {
                success: false,
                segments: [],
                totalDuration: 0,
                error: error.message
            };
        }
    });

    // 音量检测 - 根据音频片段分配文本时间
    ipcMain.handle('audio:allocateText', async (event, params) => {
        try {
            // params: { text, segments }
            logger.info('[Audio:IPC] 开始文本时间分配', {
                textLength: params.text?.length,
                segmentCount: params.segments?.length
            });

            // 🔧 验证segments数据完整性
            if (!params.segments || params.segments.length === 0) {
                logger.warn('[Audio:IPC] 警告：segments为空');
                return { success: false, error: 'segments数组为空' };
            }

            // 检查第一个和最后一个segment的结构
            const firstSegment = params.segments[0];
            const lastSegment = params.segments[params.segments.length - 1];

            if (!firstSegment || typeof firstSegment.startTime !== 'number' || typeof firstSegment.endTime !== 'number') {
                logger.error('[Audio:IPC] 第一个segment数据异常:', firstSegment);
                return { success: false, error: `第一个segment数据异常: ${JSON.stringify(firstSegment)}` };
            }

            if (!lastSegment || typeof lastSegment.startTime !== 'number' || typeof lastSegment.endTime !== 'number') {
                logger.error('[Audio:IPC] 最后一个segment数据异常:', lastSegment);
                return { success: false, error: `最后一个segment数据异常: ${JSON.stringify(lastSegment)}` };
            }

            logger.info('[Audio:IPC] segments验证通过，准备分配文本');

            const result = allocateTextToSegments(params.text, params.segments);
            return { success: true, subtitles: result };
        } catch (error: any) {
            logger.error('[Audio:IPC] 文本时间分配失败', error);
            logger.error('[Audio:IPC] 完整错误堆栈:', error.stack);
            return { success: false, error: error.message || error.toString() };
        }
    });
}
