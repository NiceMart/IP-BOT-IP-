// 导出类型定义，使其可以作为模块使用
export type VideoGenModelConfigType = {
    videoTemplateId: number;
    videoTemplateName: string;
    videoTemplateUrl: string;
    soundType: "soundGenerate" | "soundCustom";
    soundGenerateId?: number;
    soundGenerateText?: string;
    soundCustomFile?: string;
    // 🔧 新增字段：支持实时TTS合成
    soundPromptId?: number | string; // 音色ID（可以是系统音色字符串或用户音色数字ID）
    soundText?: string; // 合成文本
    soundAudioFile?: string; // TTS合成后的音频文件路径
};

declare type SoundAsrParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "SoundAsr";
    serverKey: string;
    param: {
        [key: string]: any;
    };
};

declare type VideoAsrModelConfigType = {
    video: string;
    type: "VideoAsr";
    serverKey: string;
    param: {
        [key: string]: any;
    };
};

declare type VideoAsrParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoAsr";
    serverKey: string;
    param: {
        [key: string]: any;
    };
};

declare type VideoProcessModelConfigType = {
    video: string;
    type: "VideoProcess";
    serverKey: string;
    param: {
        // 🔧 剪气口模式选择
        processingMode: "jumpcutter" | "ffmpeg"; // jumpcutter 或 ffmpeg_silence_detect

        // JumpCutter 参数
        magnitudeThresholdRatio: number;
        durationThreshold: number;
        failureToleranceRatio: number;
        spaceOnEdges: number;
        silencePartSpeed: number | null;
        minLoudPartDuration: number;
        cut: string;
        codec: string;
        bitrate: string;
    };
};

declare type VideoProcessParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoProcess";
    serverKey: string;
    param: {
        magnitudeThresholdRatio: number;
        durationThreshold: number;
        failureToleranceRatio: number;
        spaceOnEdges: number;
        silencePartSpeed: number | null;
        minLoudPartDuration: number;
        cut: string;
        codec: string;
        bitrate: string;
    };
};

declare type VideoSubtitleModelConfigType = {
    video: string;
    srtFile: string;
    customText: string;
    type: "VideoSubtitle";
    serverKey: string;
    param: {
        fontFamily: string;
        fontSize: number;
        fontColor: string;
        highlightColor: string;
        backgroundColor: boolean;
        backgroundColorOpacity: number;
        position: string;
        maxWidth: number;
        wordHighlight: boolean;
        animationType: string;
        customCss: string;
    };
};

declare type VideoSubtitleParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoSubtitle";
    serverKey: string;
    param: {
        fontFamily: string;
        fontSize: number;
        fontColor: string;
        highlightColor: string;
        backgroundColor: boolean;
        backgroundColorOpacity: number;
        position: string;
        maxWidth: number;
        wordHighlight: boolean;
        animationType: string;
        customCss: string;
    };
};

declare type VideoBGMModelConfigType = {
    video: string;
    bgm: string;
    type: "VideoBGM";
    serverKey: string;
    param: {
        bgmVolume: number;
        fadeIn: number;
        fadeOut: number;
        mixType: string;
        bgmDuration: number;
    };
};

declare type VideoBGMParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoBGM";
    serverKey: string;
    param: {
        bgmVolume: number;
        fadeIn: number;
        fadeOut: number;
        mixType: string;
        bgmDuration: number;
    };
};

declare type VideoCoverModelConfigType = {
    video: string;
    type: "VideoCover";
    serverKey: string;
    param: {
        timePointType: string;
        customTimePoint: number;
        textOverlay: string;
        fontSize: number;
        fontColor: string;
        position: string;
        backgroundColor: boolean;
        backgroundOpacity: number;
        maxWidth: number;
        effectType: string;
        quality: number;
    };
};

declare type VideoCoverParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoCover";
    serverKey: string;
    param: {
        timePointType: string;
        customTimePoint: number;
        textOverlay: string;
        fontSize: number;
        fontColor: string;
        position: string;
        backgroundColor: boolean;
        backgroundOpacity: number;
        maxWidth: number;
        effectType: string;
        quality: number;
    };
};

declare type VideoPublishModelConfigType = {
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
    publishConfig: {
        platform: string;
        title: string;
        description: string;
        tags: string[];
        visibility: string;
        scheduled: boolean;
        publishTime: string;
    };
    param: {
        outputFormat: string;
        videoQuality: string;
        preserveOriginal: boolean;
    };
};

declare type VideoPublishParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "VideoPublish";
    serverKey: string;
    workflows: string[];
    videoAsrConfig: any;
    videoProcessConfig: any;
    videoSubtitleConfig: any;
    videoBgmConfig: any;
    videoCoverConfig: any;
    publishConfig: {
        platform: string;
        title: string;
        description: string;
        tags: string[];
        visibility: string;
        scheduled: boolean;
        publishTime: string;
    };
    param: {
        outputFormat: string;
        videoQuality: string;
        preserveOriginal: boolean;
    };
};

declare type SoundGenerateParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "SoundTts" | "SoundClone";
    ttsServerKey?: string;
    ttsParam?: {
        [key: string]: any;
    };
    cloneServerKey?: string;
    cloneParam?: {
        [key: string]: any;
    };
    promptId?: number;
    promptTitle?: string;
    promptUrl?: string;
    promptText?: string;
};

declare type VideoGenParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    serverKey: string;
    param: {
        [key: string]: any;
    };
    videoTemplateId: number;
    videoTemplateName: string;
    videoTemplateUrl: string;
};

declare type TextToImageParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "TextToImage";
    serverKey: string;
    param: {
        [key: string]: any;
    };
};

declare type ImageToImageParamType = {
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    type: "ImageToImage";
    serverKey: string;
    param: {
        [key: string]: any;
    };
};

// 封面模板类型定义
export type CoverTemplate = {
    id?: string;
    name: string;
    description?: string;
    thumbnailPath?: string;
    createdAt?: number;
    updatedAt?: number;
    // ✨ 系统模板标识：1=系统模板，0=用户自定义
    is_system?: number;
    // 自定义视频路径（新增）
    customVideoPath?: string;
    // 背景设置
    backgroundEnabled: boolean;  // 背景开启控制
    backgroundBlurEnabled: boolean;
    backgroundBlurIntensity: number;
    backgroundSize: number;
    backgroundPosition: { x: number; y: number };
    // 人物描边
    personBorderEnabled: boolean;
    personBorderStyle: 'solid' | 'dashed';
    personBorderColor: string;
    personBorderWidth: number;
    personBorderDashLength?: number | null;
    personBorderGapLength?: number | null;
    // 人像设置
    personSize: number;
    personPosition: { x: number; y: number };
    // 文字自动拆分
    autoSplitText: boolean;
    titleMaxLength: number;
    subtitleMaxLength: number;
    // 主标题
    titleText: string;
    titleFontFamily: string;
    titleFontSize: number;
    titleFontWeight: number;
    titleColor: string;
    titleStrokeColor: string;
    titleStrokeWidth: number;
    titlePosition: { x: number; y: number };
    titleDirection?: 'horizontal' | 'vertical';
    titleCharSpacing?: number;
    titleLineSpacing?: number;
    titleMaxCharsPerLine?: number;
    // 主标题背景
    titleBackgroundEnabled: boolean;
    titleBackgroundColor: string;
    titleBackgroundOpacity: number;
    titleBackgroundShape: 'rectangle' | 'rounded' | 'polygon' | 'bezier';
    titleBackgroundSize: { width: number; height: number };
    titleBackgroundPosition: { x: number; y: number };
    titleBackgroundPoints?: Array<{ x: number; y: number; handle1?: { x: number; y: number }; handle2?: { x: number; y: number } }>;
    titleBackgroundRadius?: number;
    // 副标题
    subtitleText: string;
    subtitleFontFamily: string;
    subtitleFontSize: number;
    subtitleFontWeight: number;
    subtitleColor: string;
    subtitleStrokeColor: string;
    subtitleStrokeWidth: number;
    subtitlePosition: { x: number; y: number };
    subtitleDirection?: 'horizontal' | 'vertical';
    subtitleCharSpacing?: number;
    subtitleLineSpacing?: number;
    subtitleMaxCharsPerLine?: number;
    // 副标题背景
    subtitleBackgroundEnabled: boolean;
    subtitleBackgroundColor: string;
    subtitleBackgroundOpacity: number;
    subtitleBackgroundShape: 'rectangle' | 'rounded' | 'polygon' | 'bezier';
    subtitleBackgroundSize: { width: number; height: number };
    subtitleBackgroundPosition: { x: number; y: number };
    subtitleBackgroundPoints?: Array<{ x: number; y: number; handle1?: { x: number; y: number }; handle2?: { x: number; y: number } }>;
    subtitleBackgroundRadius?: number;
    // 蒙版
    maskEnabled: boolean;
    maskImagePath?: string;
    maskSize: number;
    maskPosition: { x: number; y: number };
    maskColor?: string;
    maskOpacity: number;
    maskShape: string;
    [key: string]: any;
};
