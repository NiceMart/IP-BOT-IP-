import { ipcRenderer } from "electron";

// 打开浏览器窗口
const openBrowserWindow = async (params: { url: string }) => {
    return ipcRenderer.invoke("ipAgent:openBrowserWindow", params);
};

// 从浏览器抓取数据
const scrapeFromBrowser = async (params: { url: string }) => {
    return ipcRenderer.invoke("ipAgent:scrapeFromBrowser", params);
};

// 分析抖音账号
const analyzeDouyinAccount = async (params: { url: string }) => {
    return ipcRenderer.invoke("ipAgent:analyzeDouyinAccount", params);
};

// 仿写标题
const rewriteTitles = async (params: {
    titles: string[],
    accountName: string,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    rewritePrompt: string
}) => {
    return ipcRenderer.invoke("ipAgent:rewriteTitles", params);
};

// 生成视频文案
const generateScript = async (params: {
    title: string,
    count: number,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    scriptPrompt: string
}) => {
    return ipcRenderer.invoke("ipAgent:generateScript", params);
};

// 生成标题、标签和关键词
const generateTitleTags = async (params: {
    content: string,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    titleTagPrompt: string
}) => {
    return ipcRenderer.invoke("ipAgent:generateTitleTags", params);
};

// 保存设置
const saveSettings = async (params: { settings: any }) => {
    return ipcRenderer.invoke("ipAgent:saveSettings", params);
};

// 获取设置
const getSettings = async () => {
    return ipcRenderer.invoke("ipAgent:getSettings");
};

// 导出设置
const exportSettings = async (data?: any) => {
    return ipcRenderer.invoke("ipAgent:exportSettings", data);
};

// 导入设置
const importSettings = async () => {
    return ipcRenderer.invoke("ipAgent:importSettings");
};

// 处理视频静音检测和剪辑
const processSilenceDetection = async (params: {
    inputVideo: string,
    silenceThreshold: number,
    silenceDuration: number
}) => {
    return ipcRenderer.invoke("ipAgent:processSilenceDetection", params);
};

// 处理绿幕替换
const processGreenScreen = async (params: {
    inputVideo: string,
    backgroundImage: string,
    similarity?: number,
    blend?: number
}) => {
    return ipcRenderer.invoke("ipAgent:processGreenScreen", params);
};

// 生成字幕文件
const generateSubtitle = async (params: {
    videoPath: string,
    scriptContent: string,
    asrModelKey?: string,
    timeOffset?: number
}) => {
    return ipcRenderer.invoke("ipAgent:generateSubtitle", params);
};

// 添加字幕到视频
const addSubtitleToVideo = async (params: {
    inputVideo: string,
    srtPath: string,
    subtitleStyle: any,
    highlightWords?: string[],
    keywordStyle?: any,
    keywords?: Array<{ keyword: string, enabled?: boolean }>,
    keywordMarkers?: any[],
    keywordGroups?: any[],
    enableTopTitle?: boolean,
    topTitleStyle?: any,
    topTitleText?: string
}) => {
    return ipcRenderer.invoke("ipAgent:addSubtitleToVideo", params);
};

// 添加背景音乐到视频
const addBGMToVideo = async (params: {
    inputVideo: string,
    bgmPath: string,
    bgmVolume: number
}) => {
    return ipcRenderer.invoke("ipAgent:addBGMToVideo", params);
};

// 选择本地音乐文件
const selectMusicFile = async () => {
    return ipcRenderer.invoke("ipAgent:selectMusicFile");
};

// 选择本地视频文件（用于上传自己的视频生成字幕）
const selectVideoFile = async () => {
    return ipcRenderer.invoke("ipAgent:selectVideoFile");
};

// 使用FUNASR生成字幕
const generateFunasrSubtitle = async (params: {
    videoPath: string,
    language?: string,
    maxCharsPerLine?: number
}) => {
    return ipcRenderer.invoke("ipAgent:generateFunasrSubtitle", params);
};

// 从视频提取音频（原有版本，用于FUNASR）
const extractAudioFromVideo = async (params: {
    videoPath: string
}) => {
    return ipcRenderer.invoke("ipAgent:extractAudioFromVideo", params);
};

// 从视频提取音频（增强版，支持多种格式）
const extractAudioFromVideoEnhanced = async (params: {
    videoPath: string,
    format?: string,
    quality?: string,
    sampleRate?: string,
    outputPath?: string
}) => {
    return ipcRenderer.invoke("ipAgent:extractAudioFromVideoEnhanced", params);
};

// 从文案生成SRT字幕文件
const generateSrtFromScript = async (params: {
    videoPath: string,
    scriptContent: string,
    audioDuration?: number,
    maxCharsPerLine?: number
}) => {
    return ipcRenderer.invoke("ipAgent:generateSrtFromScript", params);
};

// 从ASR结果生成SRT字幕文件
const generateSrtFromAsrResult = async (params: {
    videoPath: string,
    asrRecords: any[],
    maxCharsPerLine?: number,
    audioPath?: string,  // 可选：音频文件路径，用于提取时间戳
    timestamp?: number   // 可选：直接指定时间戳，用于匹配音频文件
}) => {
    return ipcRenderer.invoke("ipAgent:generateSrtFromAsrResult", params);
};

// 识别字幕中的关键词
const extractKeywords = async (params: {
    subtitleText: string,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiKey: string },
    customPrompt?: string
}) => {
    return ipcRenderer.invoke("ipAgent:extractKeywords", params);
};

// 提取视频中的出彩帧
const extractBestFrames = async (params: {
    videoPath: string,
    frameCount?: number
}) => {
    return ipcRenderer.invoke("ipAgent:extractBestFrames", params);
};

// 生成视频封面
const generateVideoCover = async (params: {
    videoPath: string,
    titleText: string,
    effectStyle?: any
}) => {
    return ipcRenderer.invoke("ipAgent:generateVideoCover", params);
};

// 读取SRT文件
const readSrtFile = async (params: {
    srtPath: string
}) => {
    return ipcRenderer.invoke("ipAgent:readSrtFile", params);
};

// 保存ASS字幕文件
const saveAssFile = async (params: {
    assContent: string,
    videoPath?: string,
    timestamp?: number
}) => {
    return ipcRenderer.invoke("ipAgent:saveAssFile", params);
};

// 获取所有封面模板
const getCoverTemplates = async () => {
    return ipcRenderer.invoke("ipAgent:getCoverTemplates");
};

// 获取单个封面模板
const getCoverTemplate = async (params: { id: string }) => {
    return ipcRenderer.invoke("ipAgent:getCoverTemplate", params);
};

// 保存封面模板
const saveCoverTemplate = async (params: {
    name: string,
    config: any,
    thumbnailPath?: string,
    id?: string
}) => {
    return ipcRenderer.invoke("ipAgent:saveCoverTemplate", params);
};

// 删除封面模板
const deleteCoverTemplate = async (params: { id: string }) => {
    return ipcRenderer.invoke("ipAgent:deleteCoverTemplate", params);
};

// 更新封面模板
const updateCoverTemplate = async (params: {
    id: string,
    name?: string,
    config?: any,
    thumbnailPath?: string
}) => {
    return ipcRenderer.invoke("ipAgent:updateCoverTemplate", params);
};

// 预览封面模板效果
const previewCoverTemplate = async (params: {
    videoPath: string,
    titleText: string,
    config: any
}) => {
    return ipcRenderer.invoke("ipAgent:previewCoverTemplate", params);
};

// 清理损坏的封面模板数据
const cleanupCoverTemplates = async () => {
    return ipcRenderer.invoke("ipAgent:cleanupCoverTemplates");
};

// 导出所有封面模板
const exportCoverTemplatesToConfig = async () => {
    return ipcRenderer.invoke("ipAgent:exportCoverTemplatesToConfig");
};

// 导出所有封面模板（别名）
const exportAllCoverTemplates = async () => {
    return ipcRenderer.invoke("ipAgent:exportCoverTemplatesToConfig");
};

// 导出单个封面模板
const exportCoverTemplateById = async (params: { id: string }) => {
    return ipcRenderer.invoke("ipAgent:exportCoverTemplateById", params);
};

// 视频仿写功能
const rewriteVideoContent = async (params: {
    videoUrl: string,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    rewritePrompt: string
}) => {
    return ipcRenderer.invoke("ipAgent:rewriteVideoContent", params);
};

// 新版字幕生成接口（使用ZimuShengcheng服务）
const generateSubtitleV2 = async (params: {
    videoPath: string,
    videoWidth: number,
    videoHeight: number,
    userText: string,
    funasrSegments: any[],
    subtitleStyle: any,
    keywordGroups: any[],
    keywordRenderMode?: 'floating' | 'inline-emphasis',
    fontDir: string,
    outputPath: string
}) => {
    return ipcRenderer.invoke("ipAgent:generateSubtitleV2", params);
};

// 获取视频时长
const getVideoDuration = async (params: { videoPath: string }) => {
    return ipcRenderer.invoke("ipAgent:getVideoDuration", params);
};

// 处理视频混剪
const processVideoMixCut = async (params: {
    inputVideo: string,
    replacements: Array<{
        startTime: number,
        duration: number,
        materialPath: string,
        materialDuration: number,
        materialStartOffset: number,
        reason: string
    }>,
    outputPath: string,
    videoResolution: { width: number, height: number },
    videoDuration: number,
    displayMode?: 'pip' | 'fullscreen'
}) => {
    return ipcRenderer.invoke("ipAgent:processVideoMixCut", params);
};

// 下载视频 (URL)
const downloadVideoFromUrl = async (params: { videoUrl: string, fileName?: string }) => {
    return ipcRenderer.invoke("ipAgent:downloadVideoFromUrl", params);
};

// 下载视频 (专门用于视频仿写，返回详细信息)
const downloadVideo = async (params: { url: string }) => {
    return ipcRenderer.invoke("ipAgent:downloadVideo", params);
};

// ========== 视频仿写优化 - 新增方法 ==========

// 处理抖音分享文本（新功能：不打开浏览器）
const processDouyinShare = async (params: {
    shareText: string,
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    rewriteConfig?: {
        style?: 'casual' | 'professional' | 'emotional' | 'humorous',
        length?: 'short' | 'medium' | 'long',
        keepHashtags?: boolean,
        keepEmoji?: boolean
    },
    customPrompt?: string
}) => {
    return ipcRenderer.invoke("ipAgent:processDouyinShare", params);
};

// 批量处理抖音分享文本
const processBatchDouyinShares = async (params: {
    shareTexts: string[],
    modelConfig: { providerId: string, modelId: string, apiUrl: string, apiHost: string, apiKey: string, type: string },
    rewriteConfig?: {
        style?: 'casual' | 'professional' | 'emotional' | 'humorous',
        length?: 'short' | 'medium' | 'long',
        keepHashtags?: boolean,
        keepEmoji?: boolean
    },
    customPrompt?: string
}) => {
    return ipcRenderer.invoke("ipAgent:processBatchDouyinShares", params);
};

// ========== 字幕模板管理 ==========

// 保存字幕模板
const saveSubtitleTemplate = async (params: {
    name: string,
    description?: string,
    config: any,
    id?: string,
    isDev?: boolean
}) => {
    return ipcRenderer.invoke("ipAgent:saveSubtitleTemplate", params);
};

// 获取所有字幕模板
const getSubtitleTemplates = async (params?: { metadataOnly?: boolean }) => {
    return ipcRenderer.invoke("ipAgent:getSubtitleTemplates", params);
};

// 获取单个字幕模板
const getSubtitleTemplate = async (params: { id: string }) => {
    return ipcRenderer.invoke("ipAgent:getSubtitleTemplate", params);
};

// 删除字幕模板
const deleteSubtitleTemplate = async (params: { id: string, isDev?: boolean }) => {
    return ipcRenderer.invoke("ipAgent:deleteSubtitleTemplate", params);
};

// 更新字幕模板
const updateSubtitleTemplate = async (params: {
    id: string,
    name?: string,
    description?: string,
    config?: any,
    is_system?: number,
    isDev?: boolean
}) => {
    return ipcRenderer.invoke("ipAgent:updateSubtitleTemplate", params);
};

// 导出所有字幕模板
const exportSubtitleTemplates = async (params?: { includeSystemOnly?: boolean }) => {
    return ipcRenderer.invoke("ipAgent:exportSubtitleTemplates", params);
};

// 导出单个字幕模板
const exportSubtitleTemplateById = async (params: { id: string }) => {
    return ipcRenderer.invoke("ipAgent:exportSubtitleTemplateById", params);
};

// 导入字幕模板
const importSubtitleTemplate = async () => {
    return ipcRenderer.invoke("ipAgent:importSubtitleTemplate");
};

// 复制字幕模板
const duplicateSubtitleTemplate = async (params: { id: string; newName?: string }) => {
    return ipcRenderer.invoke("ipAgent:duplicateSubtitleTemplate", params);
};

// 获取最近生成的结果文件
const getResultFilesRecently = async (type: 'audio' | 'video', limit?: number) => {
    return ipcRenderer.invoke("ipAgent:getResultFilesRecently", { type, limit: limit || 5 });
};

export default {
    openBrowserWindow,
    scrapeFromBrowser,
    generateSrtFromScript,
    analyzeDouyinAccount,
    rewriteTitles,
    generateScript,
    generateTitleTags,
    saveSettings,
    getSettings,
    exportSettings,
    importSettings,
    processSilenceDetection,
    processGreenScreen,
    generateSubtitle,
    addSubtitleToVideo,
    addBGMToVideo,
    selectMusicFile,
    selectVideoFile,
    generateFunasrSubtitle,
    extractAudioFromVideo,
    extractAudioFromVideoEnhanced,
    generateSrtFromAsrResult,
    extractKeywords,
    extractBestFrames,
    generateVideoCover,
    readSrtFile,
    saveAssFile,
    // 封面模板管理
    getCoverTemplates,
    getCoverTemplate,
    saveCoverTemplate,
    deleteCoverTemplate,
    updateCoverTemplate,
    previewCoverTemplate,
    cleanupCoverTemplates,
    exportCoverTemplatesToConfig,
    exportAllCoverTemplates,
    exportCoverTemplateById,
    rewriteVideoContent,
    generateSubtitleV2,
    // 混剪功能
    getVideoDuration,
    processVideoMixCut,
    downloadVideoFromUrl,
    downloadVideo,
    // 视频仿写优化
    processDouyinShare,
    processBatchDouyinShares,
    // 字幕模板管理
    saveSubtitleTemplate,
    getSubtitleTemplates,
    getSubtitleTemplate,
    deleteSubtitleTemplate,
    updateSubtitleTemplate,
    exportSubtitleTemplates,
    exportSubtitleTemplateById,
    importSubtitleTemplate,
    duplicateSubtitleTemplate,
    // 文件查询
    getResultFilesRecently
};
