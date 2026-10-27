import type { SubtitleStyle } from '../pages/Video/components/SubtitleStyleSelector.vue';

/**
 * 字幕样式服务 - 用于数据库持久化和查询
 */
class StyleService {
    /**
     * 清理字幕样式对象 - 移除不可序列化的内容
     */
    private cleanStyle(style: any): any {
        if (!style || typeof style !== 'object') {
            return null;
        }

        // 创建完全新的纯 JavaScript 对象，确保不包含 Proxy
        const cleanedStyle = {
            id: style.id ? String(style.id) : 'custom',
            name: style.name ? String(style.name) : '自定义样式',
            description: style.description ? String(style.description) : '完全自定义的字幕样式',
            preview: style.preview ? String(style.preview) : '示例文字',
            fontName: style.fontName ? String(style.fontName) : 'Microsoft YaHei Bold',
            fontSize: typeof style.fontSize === 'number' ? style.fontSize : 48,
            fontColor: style.fontColor ? String(style.fontColor) : '#FFFFFF',
            outlineColor: style.outlineColor ? String(style.outlineColor) : '#000000',
            outlineWidth: typeof style.outlineWidth === 'number' ? style.outlineWidth : 3,
            shadowOffset: typeof style.shadowOffset === 'number' ? style.shadowOffset : 2,
            backgroundColor: style.backgroundColor ? String(style.backgroundColor) : 'transparent',
            backgroundOpacity: typeof style.backgroundOpacity === 'number' ? style.backgroundOpacity : 0,
            position: (style.position === 'top' || style.position === 'center' || style.position === 'bottom') ? style.position : 'bottom',
            alignment: (style.alignment === 'center' || style.alignment === 'left' || style.alignment === 'right') ? style.alignment : 'center'
        };

        console.log('[StyleService.cleanStyle] 清理后的对象:', {
            id: cleanedStyle.id,
            name: cleanedStyle.name,
            fontColor: cleanedStyle.fontColor
        });

        return cleanedStyle;
    }

    /**
     * 获取当前样式（支持按 styleId 获取）
     */
    async getCurrentStyle(styleId?: string): Promise<any> {
        try {
            // 检查 IPC 接口是否存在
            if (!window.$mapi) {
                console.error('[StyleService.getCurrentStyle] ❌ window.$mapi 未定义');
                return null;
            }

            if (!window.$mapi.style) {
                console.error('[StyleService.getCurrentStyle] ❌ window.$mapi.style 未定义');
                return null;
            }

            if (!window.$mapi.style.getCurrentStyle) {
                console.error('[StyleService.getCurrentStyle] ❌ getCurrentStyle 方法未定义');
                return null;
            }

            console.log('[StyleService.getCurrentStyle] 准备调用 IPC getCurrentStyle...', { styleId });
            const result = await window.$mapi.style.getCurrentStyle(styleId);

            console.log('[StyleService.getCurrentStyle] IPC 返回结果:', result);

            return result || null;
        } catch (error) {
            console.error('[StyleService.getCurrentStyle] ❌ 异常错误:', {
                message: error?.message,
                stack: error?.stack
            });
            return null;
        }
    }

    /**
     * 按ID获取样式（新增方法，支持多个样式记录）
     */
    async getStyleById(styleId: string): Promise<any> {
        try {
            if (!window.$mapi) {
                console.error('[StyleService.getStyleById] ❌ window.$mapi 未定义');
                return null;
            }

            if (!window.$mapi.style) {
                console.error('[StyleService.getStyleById] ❌ window.$mapi.style 未定义');
                return null;
            }

            if (!window.$mapi.style.getStyleById) {
                console.error('[StyleService.getStyleById] ❌ getStyleById 方法未定义');
                return null;
            }

            console.log('[StyleService.getStyleById] 准备调用 IPC getStyleById...', { styleId });
            const result = await window.$mapi.style.getStyleById(styleId);

            console.log('[StyleService.getStyleById] IPC 返回结果:', result);

            return result || null;
        } catch (error) {
            console.error('[StyleService.getStyleById] ❌ 异常错误:', {
                message: error?.message,
                stack: error?.stack
            });
            return null;
        }
    }

    /**
     * 保存样式（新增或更新，支持多个样式记录）
     */
    async saveStyle(style: any, styleId?: string): Promise<{ success: boolean; id?: string; message?: string }> {
        try {
            // 检查 window.$mapi 是否存在
            if (!window.$mapi) {
                console.error('[StyleService.saveStyle] ❌ window.$mapi 未定义！IPC 连接失败');
                return { success: false, message: 'IPC 未初始化' };
            }

            if (!window.$mapi.style) {
                console.error('[StyleService.saveStyle] ❌ window.$mapi.style 未定义！');
                return { success: false, message: 'style IPC 未初始化' };
            }

            // 清理对象以确保IPC兼容性
            const cleanedStyle = this.cleanStyle(style);
            console.log('[StyleService.saveStyle] 清理后的样式对象:', {
                id: cleanedStyle.id,
                name: cleanedStyle.name,
                fontColor: cleanedStyle.fontColor
            });

            console.log('[StyleService.saveStyle] 准备通过 IPC 保存样式...', {
                providedStyleId: styleId,
                styleName: cleanedStyle.name
            });
            const result = await window.$mapi.style.saveStyle(cleanedStyle, styleId);

            console.log('[StyleService.saveStyle] IPC 返回结果:', result);

            if (result.success) {
                console.log('[StyleService.saveStyle] ✅ 样式保存成功, ID:', result.id);
            } else {
                console.error('[StyleService.saveStyle] ❌ IPC 返回失败:', result.message);
            }

            return result;
        } catch (error) {
            console.error('[StyleService.saveStyle] ❌ 异常错误:', {
                message: error.message,
                stack: error.stack,
                errorObject: error
            });
            return { success: false, message: '保存失败: ' + error.message };
        }
    }

    /**
     * 删除样式
     */
    async deleteStyle(styleId: string): Promise<{ success: boolean; message?: string }> {
        try {
            return await window.$mapi.style.deleteStyle(styleId);
        } catch (error) {
            console.error('[StyleService] 删除样式失败:', error);
            return { success: false, message: '删除失败' };
        }
    }

    /**
     * 从数据库加载样式
     */
    async loadStyleFromDatabase(): Promise<any> {
        try {
            const style = await this.getCurrentStyle();
            return style || null;
        } catch (error) {
            console.error('[StyleService] 从数据库加载样式失败:', error);
            return null;
        }
    }

    /**
     * 同步样式到数据库
     */
    async syncStyleToDatabase(style: any): Promise<{ success: boolean; message?: string }> {
        return this.saveStyle(style);
    }
}

export default new StyleService();
