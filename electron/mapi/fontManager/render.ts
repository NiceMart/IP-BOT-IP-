import { ipcRenderer } from 'electron';

export interface FontInfo {
    value: string;
    label: string;
    source: 'bundled' | 'system' | 'custom' | 'ziti';
    category?: string;
    languages?: string[];
    path?: string;
}

/**
 * 监听字体列表变更事件
 */
function onFontsChanged(callback: () => void): () => void {
    const handler = () => callback();
    ipcRenderer.on('fontManager:fontsChanged', handler);

    // 返回取消监听的函数
    return () => {
        ipcRenderer.removeListener('fontManager:fontsChanged', handler);
    };
}

export interface UploadFontParams {
    fileName: string;
    fileData?: number[]; // 保留兼容性
    fileDataBase64?: string; // 新增Base64编码支持
    displayName: string;
    fontFamily: string;
    category: string;
    languages: string[];
    fontType?: 'Chinese' | 'English' | 'Mixed';
}

/**
 * 获取所有可用字体
 */
async function getAllFonts(): Promise<{ success: boolean; data?: FontInfo[]; message?: string }> {
    return await ipcRenderer.invoke('fontManager:getAllFonts');
}

/**
 * 上传自定义字体
 */
async function uploadFont(params: UploadFontParams): Promise<{ success: boolean; message?: string }> {
    return await ipcRenderer.invoke('fontManager:uploadFont', params);
}

/**
 * 删除自定义字体
 */
async function deleteFont(fontFamily: string): Promise<{ success: boolean; message?: string }> {
    return await ipcRenderer.invoke('fontManager:deleteFont', fontFamily);
}

/**
 * 查找字体文件路径
 */
async function findFontPath(fontFamily: string, fontWeight: number = 400): Promise<{ success: boolean; data?: string | null; message?: string }> {
    return await ipcRenderer.invoke('fontManager:findFontPath', fontFamily, fontWeight);
}

export default {
    getAllFonts,
    uploadFont,
    deleteFont,
    findFontPath,
    onFontsChanged,
};