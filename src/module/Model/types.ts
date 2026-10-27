export type ProviderType = "openai"; // | 'anthropic' | 'gemini' | 'qwenlm' | 'azure-openai'

export type ModelType =
    | "text"           // 文本对话模型
    | "asr"            // 语音识别模型 (Automatic Speech Recognition)
    | "voice-clone"    // 语音克隆/TTS模型 (Text-to-Speech)
    | "digital-human"; // 数字人生成模型 (Digital Human Generation)

export type Model = {
    id: string;
    provider: string;
    name: string;
    group: string;
    types: ModelType[];
    enabled: boolean;
    editable: boolean;
};

export type Provider = {
    id: string;
    type: ProviderType;
    logo: string | null;
    title: string;
    isSystem: boolean;
    isBuiltIn?: boolean;  // 标记是否为系统内置提供商
    isServerPush?: boolean;  // 标记是否为服务端推送的供应商
    apiUrl: string;
    websites: {
        official: string;
        docs: string;
        models: string;
    };
    data: {
        apiKey: string;
        apiHost: string;
        models: Model[];
        enabled: boolean;
        // OSS 配置（用于阿里云 FunASR）
        ossAccessKeyId?: string;
        ossAccessKeySecret?: string;
        ossBucket?: string;
        ossRegion?: string;
        ossEndpoint?: string;
    };
    runtime?: {};
};
