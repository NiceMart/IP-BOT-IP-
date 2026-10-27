import { SubtitleTemplate } from "../types/smartSubtitle";

/**
 * 保存字幕模板
 * @param template 模板配置
 * @returns 模板ID
 */
export async function saveSubtitleTemplate(template: SubtitleTemplate): Promise<string> {
    try {
        console.log('[saveSubtitleTemplate] 开始保存字幕模板:', {
            id: template.id,
            name: template.name
        });

        const result = await window.$mapi.ipAgent.saveSubtitleTemplate({
            id: template.id || undefined,
            name: template.name,
            description: template.description,
            config: template.config
        });

        console.log('[saveSubtitleTemplate] 后端返回结果:', {
            success: result.success,
            id: result.id,
            message: result.message
        });

        if (result.success) {
            return result.id || template.id || '';
        } else {
            throw new Error(result.message || '保存模板失败');
        }
    } catch (error) {
        console.error('[saveSubtitleTemplate] 保存失败:', error);
        throw error;
    }
}

/**
 * 获取所有字幕模板
 * @returns 模板列表
 */
export async function getSubtitleTemplates(): Promise<SubtitleTemplate[]> {
    try {
        console.log('[getSubtitleTemplates] 调用后端获取字幕模板列表');

        const result = await window.$mapi.ipAgent.getSubtitleTemplates();

        if (result.success && result.templates) {
            console.log('[getSubtitleTemplates] 获取成功，模板数:', result.templates.length);
            return result.templates;
        } else {
            console.error('[getSubtitleTemplates] 获取失败:', result.message);
            return [];
        }
    } catch (error) {
        console.error('[getSubtitleTemplates] 调用失败:', error);
        return [];
    }
}

/**
 * 获取单个字幕模板
 * @param templateId 模板ID
 * @returns 模板配置
 */
export async function getSubtitleTemplate(templateId: string): Promise<SubtitleTemplate | null> {
    try {
        console.log('[getSubtitleTemplate] 调用后端获取模板:', templateId);

        const result = await window.$mapi.ipAgent.getSubtitleTemplate({ id: templateId });

        if (result.success && result.template) {
            console.log('[getSubtitleTemplate] 获取成功');
            return result.template;
        } else {
            throw new Error(result.message || `模板 ${templateId} 不存在`);
        }
    } catch (error) {
        console.error('[getSubtitleTemplate] 获取失败:', error);
        return null;
    }
}

/**
 * 删除字幕模板
 * @param templateId 模板ID
 */
export async function deleteSubtitleTemplate(templateId: string): Promise<boolean> {
    try {
        console.log('[deleteSubtitleTemplate] 开始删除模板:', templateId);

        const result = await window.$mapi.ipAgent.deleteSubtitleTemplate({
            id: templateId
        });

        if (result.success) {
            console.log('[deleteSubtitleTemplate] 删除成功');
            return true;
        } else {
            console.error('[deleteSubtitleTemplate] 删除失败:', result.message);
            return false;
        }
    } catch (error) {
        console.error('[deleteSubtitleTemplate] 删除异常:', error);
        return false;
    }
}

/**
 * 更新字幕模板
 * @param templateId 模板ID
 * @param template 模板配置
 */
export async function updateSubtitleTemplate(templateId: string, template: SubtitleTemplate): Promise<boolean> {
    try {
        console.log('[updateSubtitleTemplate] 开始更新模板:', templateId);

        const result = await window.$mapi.ipAgent.updateSubtitleTemplate({
            id: templateId,
            name: template.name,
            description: template.description,
            config: template.config
        });

        if (result.success) {
            console.log('[updateSubtitleTemplate] 更新成功');
            return true;
        } else {
            console.error('[updateSubtitleTemplate] 更新失败:', result.message);
            return false;
        }
    } catch (error) {
        console.error('[updateSubtitleTemplate] 更新异常:', error);
        return false;
    }
}

/**
 * 导出所有字幕模板
 * @param includeSystemOnly 是否仅导出系统模板
 * @returns 导出结果
 */
export async function exportSubtitleTemplates(includeSystemOnly: boolean = false): Promise<any> {
    try {
        console.log('[exportSubtitleTemplates] 开始导出字幕模板配置', {
            includeSystemOnly
        });

        const result = await window.$mapi.ipAgent.exportSubtitleTemplates({
            includeSystemOnly
        });

        if (result.success) {
            console.log('[exportSubtitleTemplates] 导出成功，包含 ' + result.count + ' 个模板');
            return result;
        } else {
            throw new Error(result.message || '导出失败');
        }
    } catch (error) {
        console.error('[exportSubtitleTemplates] 导出异常:', error);
        throw error;
    }
}

/**
 * 导出单个字幕模板为JSON
 * @param templateId 模板ID
 * @returns 导出的JSON数据
 */
export async function exportSubtitleTemplate(templateId: string): Promise<any> {
    try {
        console.log('[exportSubtitleTemplate] 开始导出单个字幕模板:', templateId);

        const result = await window.$mapi.ipAgent.exportSubtitleTemplateById({
            id: templateId
        });

        if (result.success && result.data) {
            console.log('[exportSubtitleTemplate] 导出成功:', result.data.subtitleTemplate.name);
            return result.data;
        } else {
            throw new Error(result.message || '导出失败');
        }
    } catch (error) {
        console.error('[exportSubtitleTemplate] 导出异常:', error);
        throw error;
    }
}

/**
 * 下载JSON文件
 * @param data JSON数据
 * @param filename 文件名
 */
export function downloadJSON(data: any, filename: string = 'subtitle-templates.json'): void {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[downloadJSON] 文件下载成功:', filename);
    } catch (error) {
        console.error('[downloadJSON] 文件下载失败:', error);
        throw error;
    }
}

/**
 * 复制字幕模板
 * @param templateId 源模板ID
 * @param newName 新模板名称（可选）
 * @returns 新模板ID
 */
export async function duplicateSubtitleTemplate(templateId: string, newName?: string): Promise<string> {
    try {
        console.log('[duplicateSubtitleTemplate] 开始复制模板:', {
            sourceId: templateId,
            newName
        });

        // 调用后端 IPC API
        const result = await window.$mapi.ipAgent.duplicateSubtitleTemplate({
            id: templateId,
            newName
        });

        if (result.success && result.id) {
            console.log('[duplicateSubtitleTemplate] ✅ 复制成功:', {
                newId: result.id,
                newName: result.name
            });
            return result.id;
        } else {
            throw new Error(result.message || '复制模板失败');
        }
    } catch (error) {
        console.error('[duplicateSubtitleTemplate] ❌ 复制失败:', error);
        throw error;
    }
}

/**
 * 导出所有字幕模板（更新配置文件）
 * @param includeSystemOnly 是否仅导出系统模板
 */
export async function exportAndDownloadSubtitleTemplates(includeSystemOnly: boolean = false): Promise<void> {
    try {
        const result = await exportSubtitleTemplates(includeSystemOnly);
        console.log('[exportAndDownloadSubtitleTemplates] 字幕模板已导出到配置文件', {
            count: result.count,
            configPath: result.configPath
        });
    } catch (error) {
        console.error('[exportAndDownloadSubtitleTemplates] 导出失败:', error);
        throw error;
    }
}

/**
 * 导出并下载单个字幕模板
 * @param templateId 模板ID
 */
export async function exportAndDownloadSubtitleTemplate(templateId: string): Promise<void> {
    try {
        const exportData = await exportSubtitleTemplate(templateId);
        const templateName = exportData.subtitleTemplate.name.replace(/[\s\/\\:*?"<>|]/g, '_');
        const filename = `subtitle-template-${templateName}.json`;
        downloadJSON(exportData, filename);
        console.log('[exportAndDownloadSubtitleTemplate] 导出并下载完成:', filename);
    } catch (error) {
        console.error('[exportAndDownloadSubtitleTemplate] 导出下载失败:', error);
        throw error;
    }
}

export async function importSubtitleTemplateFromFile(): Promise<{ success: boolean; id?: string; name?: string; message?: string }> {
    try {
        const result = await window.$mapi.ipAgent.importSubtitleTemplate();
        return result;
    } catch (error: any) {
        console.error('[importSubtitleTemplateFromFile] 导入失败:', error);
        return { success: false, message: error?.message || '导入失败' };
    }
}
