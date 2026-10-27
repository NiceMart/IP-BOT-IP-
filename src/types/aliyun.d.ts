/**
 * 阿里云语音服务前端类型定义
 * 用于渲染进程调用 IPC
 */

// ========== CosyVoice TTS 类型 ==========

export interface CosyVoiceConfig {
    apiKey: string;
    model: string;           // cosyvoice-v3.5-plus
    voice: string;           // 音色ID
    format?: string;         // 音频格式, 默认 mp3
    sampleRate?: number;     // 采样率, 默认 22050
}

export interface CosyVoiceResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    requestId?: string;
}

export interface VoiceOption {
    id: string;
    name: string;
    desc: string;
}

// ========== FunASR 类型 ==========

export interface FunAsrConfig {
    apiKey: string;
    model: string;           // qwen3-asr-flash | fun-asr-realtime | fun-asr
    format: string;          // pcm | wav | mp3 | opus | speex | aac | amr
    sampleRate: number;      // 音频采样率，支持 16000Hz
    language?: string[];     // 语言代码: zh, en, ja
    ossConfig?: any;         // 阿里云OSS配置
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

// ========== IPC 方法定义 ==========

declare global {
    interface Window {
        $mapi: {
            aliyun?: {
                // CosyVoice TTS
                cosyvoice: {
                    synthesize(params: {
                        text: string;
                        config: CosyVoiceConfig;
                    }): Promise<CosyVoiceResult>;

                    getVoices(model: string): Promise<{
                        success: boolean;
                        voices: VoiceOption[];
                        error?: string;
                    }>;
                };

                // FunASR
                funasr: {
                    recognize(params: {
                        audioPath: string;
                        config: FunAsrConfig;
                    }): Promise<FunAsrResult>;

                    detectFormat(audioPath: string): Promise<{
                        success: boolean;
                        format: string;
                        error?: string;
                    }>;
                };
            };
        };
    }
}

export { };
