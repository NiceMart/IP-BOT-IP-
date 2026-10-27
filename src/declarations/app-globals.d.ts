declare global {
    type SoundAsrParamType = {
        serverName: string;
        serverTitle: string;
        serverVersion: string;
        type: "SoundAsr";
        serverKey: string;
        modelType?: string;
        onlineModelId?: string | number;
        param: Record<string, any>;
    };

    type VideoAsrModelConfigType = {
        video: string;
        type: "VideoAsr";
        serverKey: string;
        param: Record<string, any>;
    };

    type VideoProcessModelConfigType = {
        video: string;
        type: "VideoProcess";
        serverKey: string;
        param: Record<string, any>;
    };

    type VideoSubtitleModelConfigType = {
        video: string;
        srtFile: string;
        customText: string;
        type: "VideoSubtitle";
        serverKey: string;
        param: Record<string, any>;
    };

    type VideoBGMModelConfigType = {
        video: string;
        bgm: string;
        type: "VideoBGM";
        serverKey: string;
        param: Record<string, any>;
    };

    type VideoCoverModelConfigType = {
        video: string;
        type: "VideoCover";
        serverKey: string;
        param: Record<string, any>;
    };

    type VideoPublishModelConfigType = {
        video: string;
        bgmFile: string;
        type: "VideoPublish";
        serverKey: string;
        workflows: string[];
        videoAsrConfig: any;
        videoProcessConfig: any;
        videoSubtitleConfig: any;
        videoBgmConfig: any;
        videoCoverConfig: any;
        publishConfig: Record<string, any>;
        param: Record<string, any>;
    };

    type SoundGenerateParamType = {
        serverName: string;
        serverTitle: string;
        serverVersion: string;
        type: "SoundTts" | "SoundClone";
        ttsServerKey?: string;
        ttsParam?: Record<string, any>;
        cloneServerKey?: string;
        cloneParam?: Record<string, any>;
        promptId?: number;
        promptTitle?: string;
        promptUrl?: string;
        promptText?: string;
        aliyunConfig?: Record<string, any>;
    };

    type TextToImageParamType = {
        serverName: string;
        serverTitle: string;
        serverVersion: string;
        type: "TextToImage";
        serverKey: string;
        param: Record<string, any>;
    };

    type ImageToImageParamType = {
        serverName: string;
        serverTitle: string;
        serverVersion: string;
        type: "ImageToImage";
        serverKey: string;
        param: Record<string, any>;
    };

    type VocabularyClassificationOptions = {
        useAI?: boolean;
        providerId?: string;
        modelId?: string;
        fallbackToLexicon?: boolean;
        cacheResults?: boolean;
    };

    const $dialog: any;
}

export {};
