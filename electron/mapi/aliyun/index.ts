/**
 * 阿里云语音服务模块入口
 * 整合 CosyVoice (TTS) 和 FunASR (ASR) 功能
 */

import * as cosyvoice from './cosyvoice';
import * as funasr from './funasr';
import * as enrollment from './enrollment';
import { getOssConfigFromProvider } from './oss';
import logger from '../log/main';

export {
    cosyvoice,
    funasr,
    enrollment
};

// 导出主要函数
export const {
    synthesizeSpeech,
    getAvailableVoices,
    sambertSynthesizeSpeech,
    getSambertVoices,
    cosyvoiceV2Synthesize,
    getCosyVoiceV2Voices
} = cosyvoice;

export const {
    recognizeAudio,
    detectAudioFormat
} = funasr;

// 导出类型
export type {
    CosyVoiceConfig,
    CosyVoiceResult,
    SambertConfig,
    SambertResult,
    CosyVoiceV2Config,
    CosyVoiceV2Result
} from './cosyvoice';

export type {
    FunAsrConfig,
    FunAsrResult,
    AsrSentence,
    AsrWord
} from './funasr';

/**
 * 执行声音复刻流程
 */
export async function enrollVoice(params: {
    apiKey: string,
    audioPath: string,
    name: string,
    ossConfig?: any
}): Promise<{ success: boolean, voiceId?: string, error?: string }> {
    try {
        logger.info('[Aliyun] 开始执行声音复刻', { name: params.name, audioPath: params.audioPath });

        // 1. 准备 OSS 配置
        let ossConfig = params.ossConfig ? getOssConfigFromProvider(params.ossConfig) : undefined;

        // 2. 上传文件到 OSS 获取公网 URL
        const audioUrl = await enrollment.uploadFileToLease(params.apiKey, params.audioPath, ossConfig);

        // 3. 创建音色
        // 使用 name 作为 prefix，但需过滤非法字符（仅允许数字、字母、下划线）
        // 阿里云要求 prefix: [a-zA-Z0-9_]{1,10}
        // 如果 name 有中文，替换为 custom
        let prefix = params.name.replace(/[^a-zA-Z0-9_]/g, '');
        // 阿里云要求 prefix: [a-zA-Z0-9_]{1,10}
        // 如果处理后为空，或者还是太长，则进行截断或使用默认值
        if (!prefix) {
            prefix = 'custom';
        } else if (prefix.length > 10) {
            prefix = prefix.substring(0, 10);
        }

        const voiceId = await enrollment.createVoice(params.apiKey, audioUrl, prefix);

        return { success: true, voiceId };
    } catch (error: any) {
        logger.error('[Aliyun] 声音复刻失败', error);
        return { success: false, error: error.message };
    }
}
