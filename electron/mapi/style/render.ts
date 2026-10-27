import { ipcRenderer } from 'electron';

// 字幕样式 IPC 接口
export default {
    /**
     * 获取当前样式（支持按styleId获取）
     */
    getCurrentStyle: async (styleId?: string) => {
        try {
            return await ipcRenderer.invoke("style:getCurrentStyle", styleId);
        } catch (error) {
            console.error('[StyleRender] getCurrentStyle 异常:', error);
            return null;
        }
    },

    /**
     * 按ID获取样式（新增）
     */
    getStyleById: async (styleId: string) => {
        try {
            return await ipcRenderer.invoke("style:getStyleById", styleId);
        } catch (error) {
            console.error('[StyleRender] getStyleById 异常:', error);
            return null;
        }
    },

    /**
     * 保存样式（支持按styleId保存）
     */
    saveStyle: async (style: any, styleId?: string) => {
        try {
            return await ipcRenderer.invoke("style:saveStyle", style, styleId);
        } catch (error) {
            console.error('[StyleRender] saveStyle 异常:', error);
            return { success: false, message: '保存失败' };
        }
    },

    /**
     * 删除样式
     */
    deleteStyle: async (styleId: string) => {
        try {
            return await ipcRenderer.invoke("style:deleteStyle", styleId);
        } catch (error) {
            console.error('[StyleRender] deleteStyle 异常:', error);
            return { success: false, message: '删除失败' };
        }
    }
};
