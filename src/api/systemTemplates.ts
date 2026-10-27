/**
 * 系统模板管理 API
 * 用于开发模式下编辑系统字幕和封面模板
 *
 * ✨ 改进：保存时自动导出到配置文件
 */

import { useDevMode } from '@/composables/useDevMode';

/**
 * 获取系统模板列表
 */
export async function getSystemTemplatesList() {
    try {
        const result = await window.$mapi.subtitleCover.getSystemTemplatesList();
        return result;
    } catch (error: any) {
        console.error('Failed to get system templates list:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 保存/编辑字幕模板并自动导出（开发模式）
 * ✨ 新增：保存时自动导出到 system-templates.json
 */
export async function saveSubtitleTemplateWithAutoExport(template: any) {
    try {
        const isDev = isDevMode();
        if (!isDev) {
            throw new Error('System templates can only be edited in development mode');
        }

        const result = await window.$mapi.subtitleCover.saveSubtitleTemplateAndExport(template, isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to save subtitle template:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 保存/编辑封面模板并自动导出（开发模式）
 * ✨ 新增：保存时自动导出到 system-templates.json
 */
export async function saveCoverTemplateWithAutoExport(template: any) {
    try {
        const isDev = isDevMode();
        if (!isDev) {
            throw new Error('System templates can only be edited in development mode');
        }

        const result = await window.$mapi.subtitleCover.saveCoverTemplateAndExport(template, isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to save cover template:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 保存/编辑系统模板（仅在开发模式）
 *
 * @deprecated 请使用 saveSubtitleTemplateWithAutoExport 或 saveCoverTemplateWithAutoExport
 */
export async function saveSystemTemplate(template: any) {
    try {
        const isDev = isDevMode();
        if (!isDev) {
            throw new Error('System templates can only be edited in development mode');
        }

        // 在生产模式下，强制设置 readonly = true
        if (!isDev && template.readonly === undefined) {
            template.readonly = true;
        }

        const result = await window.$mapi.subtitleCover.saveSystemTemplate(template, isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to save system template:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 删除系统模板（仅在开发模式，且不能删除系统模板）
 */
export async function deleteSystemTemplate(templateId: string) {
    try {
        const isDev = useDevMode().isDev.value;
        if (!isDev) {
            throw new Error('Cannot delete system templates in production mode');
        }

        const result = await window.$mapi.subtitleCover.deleteSystemTemplate(templateId, isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to delete system template:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 重置系统模板为默认值（仅在开发模式）
 */
export async function resetSystemTemplates() {
    try {
        const isDev = useDevMode().isDev.value;
        if (!isDev) {
            throw new Error('System templates can only be reset in development mode');
        }

        const result = await window.$mapi.subtitleCover.resetSystemTemplates(isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to reset system templates:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 导出系统模板配置到文件（仅在开发模式）
 */
export async function exportSystemTemplatesToFile() {
    try {
        const isDev = isDevMode();
        if (!isDev) {
            throw new Error('System templates can only be exported in development mode');
        }

        const result = await window.$mapi.subtitleCover.exportSystemTemplatesToFile(isDev);
        return result;
    } catch (error: any) {
        console.error('Failed to export system templates:', error);
        return {
            success: false,
            error: error.message || String(error)
        };
    }
}

/**
 * 检查是否为开发模式
 */
export function isDevMode(): boolean {
    return useDevMode().isDev.value;
}
