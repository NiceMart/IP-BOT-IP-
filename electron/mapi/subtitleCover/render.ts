
// 生成字幕和封面
const generate = async (params: {
    videoPath: string;
    scriptText: string;
    subtitleStyle: string;
    coverStyle: string;
    // 新增参数
    coverText?: string;
    coverTextPosition?: string;
    coverTextColor?: string;
    coverTextSize?: number;
    outlineColor?: string;
    outlineWidth?: number;
    blurRadius?: number;
    zoomLevel?: number;
}) => {
    return ipcRenderer.invoke("subtitleCover:generate", params);
};

// 获取字幕样式列表
const getSubtitleStyles = async () => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("subtitleCover:getSubtitleStyles");
};

// 获取封面样式列表
const getCoverStyles = async () => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("subtitleCover:getCoverStyles");
};

// 检查Python环境
const checkEnvironment = async () => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("subtitleCover:checkEnvironment");
};

// 重新生成封面
const regenerateCover = async (params: {
    videoPath: string;
    scriptText: string;
    coverStyle: string;
    // 新增参数
    coverText?: string;
    coverTextPosition?: string;
    coverTextColor?: string;
    coverTextSize?: number;
    outlineColor?: string;
    outlineWidth?: number;
    blurRadius?: number;
    zoomLevel?: number;
}) => {
    return ipcRenderer.invoke("subtitleCover:regenerateCover", params);
};

// 生成封面预览
const generatePreviews = async (params: {
    videoPath: string;
    scriptText?: string;
}) => {
    return ipcRenderer.invoke("subtitleCover:generatePreviews", params);
};

// 使用自定义模板生成封面
const generateWithCustomTemplate = async (params: {
    videoPath: string;
    scriptText: string;
    template: any;  // CustomTemplate object
}) => {
    return ipcRenderer.invoke("subtitleCover:generateWithCustomTemplate", params);
};

// ======================== 系统模板编辑 API (开发模式) ========================

// 获取系统模板列表
const getSystemTemplatesList = async () => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:getList");
};

// 保存/编辑系统模板（仅在开发模式）
const saveSystemTemplate = async (template: any, isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:save", template, isDev);
};

// 删除系统模板（仅在开发模式，且不能删除系统模板）
const deleteSystemTemplate = async (templateId: string, isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:delete", templateId, isDev);
};

// 重置系统模板为默认值（仅在开发模式）
const resetSystemTemplates = async (isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:reset", isDev);
};

// 导出系统模板配置到 JSON 文件（仅在开发模式）
const exportSystemTemplatesToFile = async (isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:export", isDev);
};

// ✨ 新增：保存字幕模板并自动导出（开发模式）
const saveSubtitleTemplateAndExport = async (template: any, isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:saveSubtitleAndExport", template, isDev);
};

// ✨ 新增：保存封面模板并自动导出（开发模式）
const saveCoverTemplateAndExport = async (template: any, isDev: boolean) => {
    const ipcRenderer = (window as any).ipcRenderer;
    return ipcRenderer.invoke("systemTemplates:saveCoverAndExport", template, isDev);
};

export default {
    generate,
    regenerateCover,
    generatePreviews,
    generateWithCustomTemplate,
    getSubtitleStyles,
    getCoverStyles,
    checkEnvironment,
    // 系统模板管理 API
    getSystemTemplatesList,
    saveSystemTemplate,
    deleteSystemTemplate,
    resetSystemTemplates,
    exportSystemTemplatesToFile,
    saveSubtitleTemplateAndExport,
    saveCoverTemplateAndExport
};
