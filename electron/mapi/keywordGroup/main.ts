import { ipcMain } from "electron";
import DBMain from "../db/main";
import type { KeywordGroup } from "../../../src/types/smartSubtitle";

// 获取所有关键词分组
const getAllKeywordGroups = async (): Promise<KeywordGroup[]> => {
    try {
        console.log('[keywordGroup:getAllKeywordGroups] IPC 处理器被调用');

        // 检查数据库是否初始化
        if (!DBMain) {
            console.error('[keywordGroup:getAllKeywordGroups] ❌ DBMain 未定义');
            return [];
        }

        console.log('[keywordGroup:getAllKeywordGroups] 准备执行数据库查询...');
        const groups = await DBMain.select(
            `SELECT * FROM keyword_groups
             WHERE id NOT LIKE 'test_group_%' AND name != '测试分组-全部字统一特效'
             ORDER BY createdAt DESC`
        );

        console.log('[keywordGroup:getAllKeywordGroups] 数据库查询完成，返回结果:', {
            count: groups?.length || 0,
            groups: groups?.map((g: any) => ({ id: g.id, name: g.name })) || []
        });

        // 🔍 调试：显示所有分组的贴纸数据
        console.log('[keywordGroup:getAllKeywordGroups] 所有分组的贴纸数据:');
        groups.forEach((g: any, idx: number) => {
            console.log(`  分组 #${idx} "${g.name}": stickerId=${g.stickerId}, stickerConfig=${g.stickerConfig}`);
        });

        const result = groups.map((group: any) => ({
            ...group,
            keywords: JSON.parse(group.keywords || "[]"),
            styleOverride: group.styleOverride ? JSON.parse(group.styleOverride) : undefined,
            // 🔧 修复：为 effectConfig 和 styleConfig 提供默认值以通过前端验证
            effectConfig: group.effectConfig
                ? JSON.parse(group.effectConfig)
                : { type: 'pulse-scale', duration: 600, delay: 0, intensity: 0.8 },
            styleConfig: group.styleConfig
                ? JSON.parse(group.styleConfig)
                : { fontSize: 64, fontColor: '#FFFFFF', outlineColor: '#000000', outlineWidth: 2 },
            // 🔧 修复：贴纸字段直接从对应列读取（stickerId, stickerConfig）
            stickerId: group.stickerId,  // 直接读取贴纸ID列
            stickerConfig: group.stickerConfig ? JSON.parse(group.stickerConfig) : undefined  // 直接读取贴纸配置列
        }));

        // 🔍 调试：显示映射后的结果
        console.log('[keywordGroup:getAllKeywordGroups] 映射后的第一个分组:');
        if (result.length > 0) {
            console.log(`  ID: ${result[2]?.id}`);
            console.log(`  Name: ${result[2]?.name}`);
            console.log(`  stickerId: ${result[2]?.stickerId}`);
            console.log(`  stickerConfig: ${JSON.stringify(result[2]?.stickerConfig)}`);
        }

        console.log('[keywordGroup:getAllKeywordGroups] ✅ 返回最终结果，数量:', result.length);
        return result;
    } catch (error) {
        console.error('[keywordGroup:getAllKeywordGroups] ❌ 异常:', {
            message: error?.message,
            stack: error?.stack
        });
        return [];
    }
};

// 保存关键词分组
const saveKeywordGroup = async (group: KeywordGroup): Promise<{ success: boolean; id?: string; message?: string }> => {
    try {
        const now = Date.now();
        const existingGroup = await DBMain.first(
            `SELECT id FROM keyword_groups WHERE id = ?`,
            [group.id]
        );

        const keywords = JSON.stringify(group.keywords || []);
        const styleOverride = group.styleOverride ? JSON.stringify(group.styleOverride) : null;
        const effectConfig = group.effectConfig ? JSON.stringify(group.effectConfig) : null;
        const styleConfig = group.styleConfig ? JSON.stringify(group.styleConfig) : null;
        const stickerConfig = group.stickerConfig ? JSON.stringify(group.stickerConfig) : null; // 🆕
        const soundEffectConfig = group.soundEffectConfig ? JSON.stringify(group.soundEffectConfig) : null; // 🆕

        // 🔍 调试：显示即将保存的贴纸数据
        console.log('[keywordGroup:saveGroup] 准备保存的贴纸数据:', {
            groupId: group.id,
            groupName: group.name,
            stickerId: group.stickerId,
            stickerConfig: group.stickerConfig,
            stickerConfigStringified: stickerConfig
        });

        if (existingGroup) {
            // 更新现有分组
            await DBMain.update(
                `UPDATE keyword_groups
                 SET name = ?, description = ?, keywords = ?, color = ?, effectId = ?,
                      styleOverride = ?, effectConfig = ?, styleConfig = ?, 
                      stickerId = ?, stickerConfig = ?, effectDuration = ?,
                      sound_effect_id = ?, sound_effect_config = ?, updatedAt = ?
                 WHERE id = ?`,
                [
                    group.name,
                    group.description || null,
                    keywords,
                    group.color || null,
                    group.effectId || null,
                    styleOverride,
                    effectConfig,
                    styleConfig,
                    group.stickerId || null,
                    stickerConfig,
                    group.effectDuration || null,
                    group.soundEffectId || null,
                    soundEffectConfig,
                    now,
                    group.id
                ]
            );
            console.log('[keywordGroup:saveGroup] ✅ UPDATE 成功，groupId:', group.id, 'stickerId:', group.stickerId);
        } else {
            // 插入新分组
            await DBMain.insert(
                `INSERT INTO keyword_groups
                 (id, name, description, keywords, color, effectId, styleOverride, effectConfig, styleConfig, 
                  stickerId, stickerConfig, effectDuration, sound_effect_id, sound_effect_config, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    group.id,
                    group.name,
                    group.description || null,
                    keywords,
                    group.color || null,
                    group.effectId || null,
                    styleOverride,
                    effectConfig,
                    styleConfig,
                    group.stickerId || null,
                    stickerConfig,
                    group.effectDuration || null,
                    group.soundEffectId || null,
                    soundEffectConfig,
                    now,
                    now
                ]
            );
            console.log('[keywordGroup:saveGroup] ✅ INSERT 成功，groupId:', group.id, 'stickerId:', group.stickerId);
        }

        return { success: true, id: group.id };
    } catch (error) {
        console.error("保存关键词分组失败:", error);
        return { success: false, message: "保存关键词分组失败" };
    }
};

// 删除关键词分组
const deleteKeywordGroup = async (groupId: string): Promise<{ success: boolean; message?: string }> => {
    try {
        await DBMain.delete(
            `DELETE FROM keyword_groups WHERE id = ?`,
            [groupId]
        );
        return { success: true };
    } catch (error) {
        console.error("删除关键词分组失败:", error);
        return { success: false, message: "删除关键词分组失败" };
    }
};

// 查询关键词所属的分组
const queryKeyword = async (keyword: string): Promise<KeywordGroup | null> => {
    try {
        const groups = await getAllKeywordGroups();

        for (const group of groups) {
            const groupKeywords = group.keywords || [];
            const found = groupKeywords.some((kw: any) => {
                const kwStr = typeof kw === 'string' ? kw : kw.keyword;
                return kwStr === keyword;
            });

            if (found) {
                return group;
            }
        }

        return null;
    } catch (error) {
        console.error("查询关键词所属分组失败:", error);
        return null;
    }
};

// 批量查询关键词
const queryKeywordBatch = async (keywords: string[]): Promise<Map<string, KeywordGroup>> => {
    try {
        const result = new Map<string, KeywordGroup>();
        const groups = await getAllKeywordGroups();

        for (const keyword of keywords) {
            for (const group of groups) {
                const groupKeywords = group.keywords || [];
                const found = groupKeywords.some((kw: any) => {
                    const kwStr = typeof kw === 'string' ? kw : kw.keyword;
                    return kwStr === keyword;
                });

                if (found) {
                    result.set(keyword, group);
                    break;
                }
            }
        }

        return result;
    } catch (error) {
        console.error("批量查询关键词所属分组失败:", error);
        return new Map();
    }
};

// 注册IPC处理程序
const registerIpcHandlers = () => {
    console.log('[keywordGroup:registerIpcHandlers] 开始注册关键词分组 IPC 处理器...');

    // 获取所有关键词分组
    ipcMain.handle("keywordGroup:getAllGroups", async () => {
        console.log('[keywordGroup:IPC:getAllGroups] 处理器被触发');
        return await getAllKeywordGroups();
    });

    console.log('[keywordGroup:registerIpcHandlers] ✓ 已注册 keywordGroup:getAllGroups');

    // 保存关键词分组
    ipcMain.handle("keywordGroup:saveGroup", async (event, group: KeywordGroup) => {
        console.log('[keywordGroup:IPC:saveGroup] 处理器被触发，groupId:', group.id);
        return await saveKeywordGroup(group);
    });

    console.log('[keywordGroup:registerIpcHandlers] ✓ 已注册 keywordGroup:saveGroup');

    // 删除关键词分组
    ipcMain.handle("keywordGroup:deleteGroup", async (event, groupId: string) => {
        console.log('[keywordGroup:IPC:deleteGroup] 处理器被触发，groupId:', groupId);
        return await deleteKeywordGroup(groupId);
    });

    console.log('[keywordGroup:registerIpcHandlers] ✓ 已注册 keywordGroup:deleteGroup');

    // 查询关键词所属分组
    ipcMain.handle("keywordGroup:queryKeyword", async (event, keyword: string) => {
        console.log('[keywordGroup:IPC:queryKeyword] 处理器被触发，keyword:', keyword);
        return await queryKeyword(keyword);
    });

    console.log('[keywordGroup:registerIpcHandlers] ✓ 已注册 keywordGroup:queryKeyword');

    // 批量查询关键词
    ipcMain.handle("keywordGroup:queryKeywordBatch", async (event, keywords: string[]) => {
        console.log('[keywordGroup:IPC:queryKeywordBatch] 处理器被触发，keywords数量:', keywords.length);
        const result = await queryKeywordBatch(keywords);
        return Array.from(result.entries()).map(([keyword, group]) => ({
            keyword,
            group
        }));
    });

    console.log('[keywordGroup:registerIpcHandlers] ✓ 已注册 keywordGroup:queryKeywordBatch');
    console.log('[keywordGroup:registerIpcHandlers] ===================== 所有 IPC 处理器注册完成 =====================');
};

export default {
    getAllKeywordGroups,
    saveKeywordGroup,
    deleteKeywordGroup,
    queryKeyword,
    queryKeywordBatch,
    registerIpcHandlers
};
