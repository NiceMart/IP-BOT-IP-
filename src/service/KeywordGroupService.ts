// @ts-nocheck
import type { KeywordGroup } from '../types/smartSubtitle';

/**
 * 关键词分组服务 - 用于数据库持久化和查询
 */
class KeywordGroupService {
    /**
     * 清理关键词分组对象 - 移除不可序列化的内容
     */
    private cleanGroup(group: KeywordGroup): KeywordGroup {
        // 确保 keywords 是纯数组，不是 Proxy
        let cleanedKeywords: any[] = [];
        if (Array.isArray(group.keywords)) {
            cleanedKeywords = group.keywords.map(kw => {
                if (typeof kw === 'string') {
                    return { keyword: kw, enabled: true };
                } else if (typeof kw === 'object' && kw !== null) {
                    return {
                        keyword: String(kw.keyword || ''),
                        enabled: Boolean(kw.enabled !== false)
                    };
                }
                return { keyword: '', enabled: true };
            });
        }

        // 创建完全新的纯 JavaScript 对象
        const cleanedGroup = {
            id: String(group.id || ''),
            name: String(group.name || ''),
            description: group.description ? String(group.description) : undefined,
            keywords: cleanedKeywords,
            color: group.color ? String(group.color) : undefined,
            effectId: group.effectId ? String(group.effectId) : undefined,
            effectDuration: typeof group.effectDuration === 'number' ? group.effectDuration : undefined, // 🆕 特效时长
            stickerId: group.stickerId ? String(group.stickerId) : undefined, // 🆕 贴纸ID
            stickerConfig: group.stickerConfig ? JSON.parse(JSON.stringify(group.stickerConfig)) : undefined, // 🔧 深度克隆移除Proxy
            soundEffectId: group.soundEffectId ? String(group.soundEffectId) : undefined, // 🆕 音效ID
            soundEffectConfig: group.soundEffectConfig ? JSON.parse(JSON.stringify(group.soundEffectConfig)) : undefined, // 🔧 深度克隆移除Proxy
            styleOverride: group.styleOverride ? JSON.parse(JSON.stringify(group.styleOverride)) : undefined,
            effectConfig: group.effectConfig ? JSON.parse(JSON.stringify(group.effectConfig)) : undefined,
            styleConfig: group.styleConfig ? JSON.parse(JSON.stringify(group.styleConfig)) : undefined,
            createdAt: typeof group.createdAt === 'number' ? group.createdAt : Date.now(),
            updatedAt: typeof group.updatedAt === 'number' ? group.updatedAt : Date.now()
        };

        // 🔍 在返回前记录完整的 cleanedGroup 对象，确保 stickerId 被保留
        console.log('[KeywordGroupService.cleanGroup] 📦 完整的 cleanedGroup:', JSON.stringify({
            id: cleanedGroup.id,
            name: cleanedGroup.name,
            stickerId: cleanedGroup.stickerId,
            stickerConfig: cleanedGroup.stickerConfig
        }, null, 2));

        // 清理 styleOverride - 确保只包含基本类型
        if (group.styleOverride && typeof group.styleOverride === 'object') {
            cleanedGroup.styleOverride = {
                fontName: group.styleOverride.fontName ? String(group.styleOverride.fontName) : undefined,
                fontSize: typeof group.styleOverride.fontSize === 'number' ? group.styleOverride.fontSize : undefined,
                fontColor: group.styleOverride.fontColor ? String(group.styleOverride.fontColor) : undefined,
                outlineColor: group.styleOverride.outlineColor ? String(group.styleOverride.outlineColor) : undefined,
                outlineWidth: typeof group.styleOverride.outlineWidth === 'number' ? group.styleOverride.outlineWidth : undefined,
                backgroundColor: group.styleOverride.backgroundColor ? String(group.styleOverride.backgroundColor) : undefined,
                backgroundOpacity: typeof group.styleOverride.backgroundOpacity === 'number' ? group.styleOverride.backgroundOpacity : undefined,
                position: group.styleOverride.position ? String(group.styleOverride.position) : undefined
            };
        }

        console.log('[KeywordGroupService.cleanGroup] 清理后的对象:', {
            id: cleanedGroup.id,
            name: cleanedGroup.name,
            keywordsCount: cleanedGroup.keywords.length,
            hasStyleOverride: !!cleanedGroup.styleOverride,
            // 🔍 关键：检查贴纸和音效字段
            stickerId: cleanedGroup.stickerId,
            hasStickerConfig: !!cleanedGroup.stickerConfig,
            soundEffectId: cleanedGroup.soundEffectId,
            hasSoundEffectConfig: !!cleanedGroup.soundEffectConfig,
            effectDuration: cleanedGroup.effectDuration
        });

        return cleanedGroup;
    }

    /**
     * 获取所有关键词分组
     */
    async getAllGroups(): Promise<KeywordGroup[]> {
        try {
            // 检查 IPC 接口是否存在
            if (!window.$mapi) {
                console.error('[KeywordGroupService.getAllGroups] ❌ window.$mapi 未定义');
                return [];
            }

            if (!window.$mapi.keywordGroup) {
                console.error('[KeywordGroupService.getAllGroups] ❌ window.$mapi.keywordGroup 未定义');
                return [];
            }

            if (!window.$mapi.keywordGroup.getAllGroups) {
                console.error('[KeywordGroupService.getAllGroups] ❌ getAllGroups 方法未定义');
                return [];
            }

            console.log('[KeywordGroupService.getAllGroups] 准备调用 IPC getAllGroups...');
            const result = await window.$mapi.keywordGroup.getAllGroups();

            console.log('[KeywordGroupService.getAllGroups] IPC 返回结果:', {
                isArray: Array.isArray(result),
                length: result?.length || 0,
                groups: Array.isArray(result) ? result.map(g => ({ name: g.name, id: g.id })) : 'not an array'
            });

            if (!Array.isArray(result)) {
                console.warn('[KeywordGroupService.getAllGroups] ⚠️ 返回值不是数组:', typeof result);
                return [];
            }

            return result;
        } catch (error) {
            console.error('[KeywordGroupService.getAllGroups] ❌ 异常错误:', {
                message: error?.message,
                stack: error?.stack
            });
            return [];
        }
    }

    /**
     * 保存关键词分组（新增或更新）
     */
    async saveGroup(group: KeywordGroup): Promise<{ success: boolean; id?: string; message?: string }> {
        try {
            // 检查 window.$mapi 是否存在
            if (!window.$mapi) {
                console.error('[KeywordGroupService] ❌ window.$mapi 未定义！IPC 连接失败');
                return { success: false, message: 'IPC 未初始化' };
            }

            if (!window.$mapi.keywordGroup) {
                console.error('[KeywordGroupService] ❌ window.$mapi.keywordGroup 未定义！');
                return { success: false, message: 'keywordGroup IPC 未初始化' };
            }

            // 清理对象以确保IPC兼容性
            const cleanedGroup = this.cleanGroup(group);
            console.log('[KeywordGroupService.saveGroup] 清理后的分组对象:', {
                id: cleanedGroup.id,
                name: cleanedGroup.name,
                keywordsCount: cleanedGroup.keywords?.length || 0,
                hasStyleOverride: !!cleanedGroup.styleOverride
            });

            console.log('[KeywordGroupService.saveGroup] 准备通过 IPC 保存分组...');
            const result = await window.$mapi.keywordGroup.saveGroup(cleanedGroup);

            console.log('[KeywordGroupService.saveGroup] IPC 返回结果:', result);

            if (result.success) {
                console.log('[KeywordGroupService.saveGroup] ✅ 分组保存成功, ID:', result.id);
            } else {
                console.error('[KeywordGroupService.saveGroup] ❌ IPC 返回失败:', result.message);
            }

            return result;
        } catch (error) {
            console.error('[KeywordGroupService.saveGroup] ❌ 异常错误:', {
                message: error.message,
                stack: error.stack,
                errorObject: error
            });
            return { success: false, message: '保存失败: ' + error.message };
        }
    }

    /**
     * 批量保存关键词分组
     */
    async saveGroups(groups: KeywordGroup[]): Promise<{ success: boolean; failedCount?: number }> {
        try {
            let failedCount = 0;
            for (const group of groups) {
                const result = await this.saveGroup(group);
                if (!result.success) {
                    failedCount++;
                }
            }
            return {
                success: failedCount === 0,
                failedCount
            };
        } catch (error) {
            console.error('批量保存关键词分组失败:', error);
            return { success: false, failedCount: groups.length };
        }
    }

    /**
     * 删除关键词分组
     */
    async deleteGroup(groupId: string): Promise<{ success: boolean; message?: string }> {
        try {
            return await window.$mapi.keywordGroup.deleteGroup(groupId);
        } catch (error) {
            console.error('删除关键词分组失败:', error);
            return { success: false, message: '删除失败' };
        }
    }

    /**
     * 查询关键词所属的分组
     */
    async queryKeyword(keyword: string): Promise<KeywordGroup | null> {
        try {
            return await window.$mapi.keywordGroup.queryKeyword(keyword);
        } catch (error) {
            console.error('查询关键词所属分组失败:', error);
            return null;
        }
    }

    /**
     * 批量查询关键词
     */
    async queryKeywordBatch(keywords: string[]): Promise<Map<string, KeywordGroup>> {
        try {
            const result = await window.$mapi.keywordGroup.queryKeywordBatch(keywords);
            const map = new Map<string, KeywordGroup>();

            if (Array.isArray(result)) {
                for (const item of result) {
                    map.set(item.keyword, item.group);
                }
            }

            return map;
        } catch (error) {
            console.error('批量查询关键词所属分组失败:', error);
            return new Map();
        }
    }

    /**
     * 从数据库加载分组并同步到本地存储
     */
    async syncGroupsFromDatabase(): Promise<KeywordGroup[]> {
        try {
            const groups = await this.getAllGroups();
            // 保存到本地存储以供离线使用
            const STORAGE_KEY = 'zhenqianba_keyword_groups';
            localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
            return groups;
        } catch (error) {
            console.error('从数据库同步分组失败:', error);
            return [];
        }
    }

    /**
     * 同步本地分组到数据库
     */
    async syncGroupsToDatabase(groups: KeywordGroup[]): Promise<{ success: boolean; failedCount?: number }> {
        return this.saveGroups(groups);
    }
}

export default new KeywordGroupService();
