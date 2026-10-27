import { ipcRenderer } from "electron";

/**
 * 阿里云语音服务 - 渲染进程API
 */


export default {
    cosyvoice: {
        /**
         * 语音合成
         */
        async synthesize(params: {
            text: string;
            config: {
                apiKey: string;
                model: string;
                voice: string;
                format?: string;
                sampleRate?: number;
                instruction?: string;
                saveToPreCache?: string;  // 如果提供了voiceId，自动保存到预缓存目录
            };
        }) {
            return await ipcRenderer.invoke('aliyun:cosyvoice:synthesize', params);
        },

        /**
         * V1 实时语音合成（cosyvoice-v3-flash）
         * 支持语速调节和情绪指令（instruction）
         */
        async synthesizeRealtime(params: {
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
        }) {
            return await ipcRenderer.invoke('aliyun:cosyvoiceRealtime:synthesize', params);
        },

        /**
         * 获取可用音色列表
         */
        async getVoices(model: string) {
            return await ipcRenderer.invoke('aliyun:cosyvoice:getVoices', model);
        },

        /**
         * 预缓存所有系统默认音色
         */
        async preCacheSystemVoices(apiKey: string, force: boolean = false) {
            return await ipcRenderer.invoke('aliyun:cosyvoice:preCacheSystemVoices', { apiKey, force });
        },

        /**
         * 获取预缓存的音色路径
         */
        async getPreCachedVoicePath(voiceId: string) {
            return await ipcRenderer.invoke('aliyun:cosyvoice:getPreCachedVoicePath', voiceId);
        },

        /**
         * 检查所有音色是否已缓存
         */
        async isAllVoicesCached() {
            return await ipcRenderer.invoke('aliyun:cosyvoice:isAllVoicesCached');
        },

        /**
         * 清除预缓存
         */
        async clearPreCache() {
            return await ipcRenderer.invoke('aliyun:cosyvoice:clearPreCache');
        }
    },

    funasr: {
        /**
         * 语音识别（本地文件，自动上传到 OSS）
         */
        async recognize(params: {
            audioPath: string;
            config: {
                apiKey: string;
                ossConfig?: {
                    accessKeyId: string;
                    accessKeySecret: string;
                    bucket: string;
                    region: string;
                    endpoint?: string;
                };
                model?: string;
            };
        }) {
            return await ipcRenderer.invoke('aliyun:funasr:recognize', params);
        },

        /**
         * 语音识别（直接使用 URL，无需上传 OSS）
         */
        async recognizeFromUrl(params: {
            audioUrl: string;
            apiKey: string;
        }) {
            return await ipcRenderer.invoke('aliyun:funasr:recognizeFromUrl', params);
        },

        /**
         * 检测音频格式
         */
        async detectFormat(audioPath: string) {
            return await ipcRenderer.invoke('aliyun:funasr:detectFormat', audioPath);
        }
    },

    audio: {
        /**
         * 检测音频中的声音片段（基于音量）
         */
        async detectVolume(params: {
            audioPath: string;
            config?: {
                silenceThreshold?: number;  // 静音阈值（dB），默认 -40dB
                minSilenceDuration?: number; // 最小静音时长（秒），默认 0.5s
                minSoundDuration?: number;   // 最小有声时长（秒），默认 0.3s
            };
        }) {
            return await ipcRenderer.invoke('audio:detectVolume', params);
        },

        /**
         * 根据音频片段分配文本时间
         */
        async allocateText(params: {
            text: string;
            segments: Array<{
                startTime: number;
                endTime: number;
                duration: number;
            }>;
        }) {
            return await ipcRenderer.invoke('audio:allocateText', params);
        }
    },

    sambert: {
        /**
         * Sambert 语音合成
         */
        async synthesize(params: {
            text: string;
            config: {
                apiKey: string;
                model: string;
                format?: 'pcm' | 'wav' | 'mp3';
                sampleRate?: number;
                volume?: number;
                rate?: number;
                pitch?: number;
            };
        }) {
            return await ipcRenderer.invoke('aliyun:sambert:synthesize', params);
        },

        /**
         * 获取 Sambert 可用音色列表
         */
        async getVoices() {
            return await ipcRenderer.invoke('aliyun:sambert:getVoices');
        }
    },

    cosyvoiceV2: {
        /**
         * CosyVoice V2 语音合成
         */
        async synthesize(params: {
            text: string;
            config: {
                apiKey: string;
                model?: string;
                voice: string;
                format?: 'mp3' | 'wav' | 'pcm' | 'opus';
                sampleRate?: number;
                volume?: number;
                rate?: number;
                pitch?: number;
                language_hints?: string[];
            };
        }) {
            return await ipcRenderer.invoke('aliyun:cosyvoiceV2:synthesize', params);
        },

        /**
         * 获取 CosyVoice V2 可用音色列表
         */
        async getVoices() {
            return await ipcRenderer.invoke('aliyun:cosyvoiceV2:getVoices');
        }
    }
};
