import {CoverTemplate} from "../declarations/app";
import { useDevMode } from "../composables/useDevMode";  // ✅ 添加开发模式检测导入

// 生成UUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 保存封面模板
 * @param template 模板配置
 * @returns 模板ID
 */
export async function saveCoverTemplate(template: CoverTemplate): Promise<string> {
    try {
        // ✅ 获取开发模式状态
        const { isDev } = useDevMode();

        console.log('[saveCoverTemplate] 开始保存模板，详细信息:', {
            id: template.id,
            name: template.name,
            hasTemplate: !!template,
            idType: typeof template.id,
            idValue: JSON.stringify(template.id),
            isDev: isDev.value
        });

        // ✅ 修复：不嵌套 config，而是展开配置字段（排除元数据字段）
        // 移除元数据字段（id, name, thumbnailPath, createdAt, updatedAt）
        const { id, name, thumbnailPath, createdAt, updatedAt, is_system, ...configFields } = template;

        console.log('[saveCoverTemplate] 解构后的参数:', {
            id: id,
            idType: typeof id,
            name: name,
            configFieldsKeys: Object.keys(configFields).length,
            thumbnailPath: !!thumbnailPath,
            isDev: isDev.value
        });

        // 通过后端 IPC 保存模板
        console.log('[saveCoverTemplate] 调用后端 IPC: ipAgent.saveCoverTemplate');
        const result = await window.$mapi.ipAgent.saveCoverTemplate({
            id: id || undefined,  // ✅ 确保空字符串变为 undefined
            name,
            config: configFields,  // ✅ 只传配置部分，不嵌套整个对象
            thumbnailPath,
            isDev: isDev.value  // ✅ 传递开发模式标志给后端
        });

        console.log('[saveCoverTemplate] 后端返回结果:', {
            success: result.success,
            id: result.id,
            message: result.message
        });

        if (result.success) {
            const returnId = result.id || template.id || generateUUID();
            console.log('[saveCoverTemplate] ✅ 模板保存成功，返回ID:', returnId);
            return returnId;
        } else {
            console.error('[saveCoverTemplate] ❌ 后端返回失败:', result.message);
            throw new Error(result.message || '保存模板失败');
        }
    } catch (error) {
        console.error('[saveCoverTemplate] ❌ 捕获异常:', {
            message: (error as Error).message,
            stack: (error as Error).stack
        });
        throw error;
    }
}

/**
 * 获取所有封面模板列表（最多24个，按创建时间倒序）
 * @returns 模板列表
 */
export async function getCoverTemplates(): Promise<CoverTemplate[]> {
    try {
        console.log('[getCoverTemplates] 调用后端获取模板列表');

        // 通过后端 IPC 获取模板
        const result = await window.$mapi.ipAgent.getCoverTemplates({ metadataOnly: false });

        if (result.success && result.templates) {
            console.log('[getCoverTemplates] 获取成功，模板数:', result.templates.length);
            return result.templates;
        } else {
            console.error('[getCoverTemplates] 获取失败:', result.message);
            return [];
        }
    } catch (error) {
        console.error('[getCoverTemplates] 调用失败:', error);
        return [];
    }
}

/**
 * 删除封面模板
 * @param templateId 模板ID
 */
export async function deleteCoverTemplate(templateId: string): Promise<void> {
    try {
        const { isDev } = useDevMode();

        console.log('[deleteCoverTemplate] 删除模板:', {
            id: templateId,
            isDev: isDev.value
        });

        // ✅ 调用后端 IPC API，后端会检查权限
        const result = await window.$mapi.ipAgent.deleteCoverTemplate({
            id: templateId,
            isDev: isDev.value  // 传递开发模式标志给后端
        });

        if (!result.success) {
            throw new Error(result.message || '删除模板失败');
        }

        console.log('[deleteCoverTemplate] ✅ 模板删除成功');
    } catch (error) {
        console.error('[deleteCoverTemplate] ❌ 删除失败:', error);
        throw error;
    }
}

/**
 * 更新封面模板
 * @param templateId 模板ID
 * @param template 模板配置
 */
export async function updateCoverTemplate(templateId: string, template: CoverTemplate): Promise<void> {
    try {
        const { isDev } = useDevMode();

        console.log('[updateCoverTemplate] 更新模板:', {
            id: templateId,
            name: template.name,
            isDev: isDev.value
        });

        // ✅ 调用后端 IPC API，后端会检查权限
        const result = await window.$mapi.ipAgent.updateCoverTemplate({
            id: templateId,
            name: template.name,
            description: template.description,
            config: template,
            thumbnailPath: template.thumbnailPath,
            isDev: isDev.value  // 传递开发模式标志给后端
        });

        if (!result.success) {
            throw new Error(result.message || '更新模板失败');
        }

        console.log('[updateCoverTemplate] ✅ 模板更新成功');
    } catch (error) {
        console.error('[updateCoverTemplate] ❌ 更新失败:', error);
        throw error;
    }
}

/**
 * 获取单个封面模板
 * @param templateId 模板ID
 * @returns 模板配置
 */
export async function getCoverTemplate(templateId: string): Promise<CoverTemplate> {
    try {
        console.log('[getCoverTemplate] 调用后端获取模板:', templateId);

        // 通过后端 IPC 获取模板
        const result = await window.$mapi.ipAgent.getCoverTemplate({ id: templateId });

        if (result.success && result.template) {
            console.log('[getCoverTemplate] 获取成功');
            return result.template;
        } else {
            throw new Error(result.message || `模板 ${templateId} 不存在`);
        }
    } catch (error) {
        console.error('[getCoverTemplate] 获取失败:', error);
        throw error;
    }
}

/**
 * 复制封面模板
 * @param templateId 源模板ID
 * @param newName 新模板名称（可选）
 * @returns 新模板ID
 */
export async function duplicateCoverTemplate(templateId: string, newName?: string): Promise<string> {
    try {
        console.log('[duplicateCoverTemplate] 开始复制模板:', {
            sourceId: templateId,
            newName
        });

        // 调用后端 IPC API
        const result = await window.$mapi.ipAgent.duplicateCoverTemplate({
            id: templateId,
            newName
        });

        if (result.success && result.id) {
            console.log('[duplicateCoverTemplate] ✅ 复制成功:', {
                newId: result.id,
                newName: result.name
            });
            return result.id;
        } else {
            throw new Error(result.message || '复制模板失败');
        }
    } catch (error) {
        console.error('[duplicateCoverTemplate] ❌ 复制失败:', error);
        throw error;
    }
}
