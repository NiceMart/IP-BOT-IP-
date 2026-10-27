/**
 * 字幕模板管理 - IPC Handlers
 * 提供字幕模板的CRUD操作
 * 用于替代 localStorage，将字幕模板持久化到数据库
 */

import { ipcMain, dialog } from "electron";
import { Log } from "../log/main";
import DB from "../db/main";
import * as path from "path";
import * as fs from "fs";
import { AppEnv } from "../env";
import { getCommonResourcePath } from "../../lib/resource-path";

// UUID生成函数
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const cloneJson = <T>(value: T): T => {
    if (value === null || value === undefined) {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
};

const isSystemTemplateRecord = (template: any): boolean => (
    template?.isSystem === true || template?.is_system === 1
);

const parseTemplateConfig = (config: any): any => {
    if (!config) {
        return {};
    }

    if (typeof config === "string") {
        return JSON.parse(config);
    }

    return cloneJson(config);
};

const mergeTemplateConfig = (baseConfig: any, overrideConfig: any): any => {
    const base = baseConfig || {};
    const override = overrideConfig || {};

    return {
        ...base,
        ...override,
        subtitleStyle: override.subtitleStyle ?? base.subtitleStyle,
        titleSubtitleConfig: override.titleSubtitleConfig ?? base.titleSubtitleConfig,
        keywordGroupsStyles: override.keywordGroupsStyles ?? base.keywordGroupsStyles,
        previewConfig: {
            ...(base.previewConfig || {}),
            ...(override.previewConfig || {}),
        },
    };
};

const dedupeTemplatesById = (templates: any[]): any[] => {
    const deduped = new Map<string, any>();

    for (const template of templates) {
        if (!template?.id) {
            continue;
        }
        deduped.set(template.id, template);
    }

    return Array.from(deduped.values());
};

const loadExistingExportConfig = (configPath: string): any => {
    const possiblePaths = Array.from(new Set([
        configPath,
        path.join(AppEnv.appRoot || process.cwd(), "electron", "config", "system-templates.json"),
        path.join(process.cwd(), "electron", "config", "system-templates.json"),
    ]));

    for (const candidatePath of possiblePaths) {
        if (!candidatePath || !fs.existsSync(candidatePath)) {
            continue;
        }

        try {
            const content = fs.readFileSync(candidatePath, "utf-8");
            const parsed = JSON.parse(content);
            return {
                version: parsed.version || "2.0.0",
                description: parsed.description || "系统默认模板配置 - 应用启动时自动初始化",
                subtitleTemplates: Array.isArray(parsed.subtitleTemplates) ? parsed.subtitleTemplates : [],
                subtitleStyles: Array.isArray(parsed.subtitleStyles) ? parsed.subtitleStyles : [],
                coverTemplates: Array.isArray(parsed.coverTemplates) ? parsed.coverTemplates : [],
            };
        } catch (error) {
            Log.warn("ipAgent.exportSubtitleTemplates.loadExistingConfigFailed", {
                configPath: candidatePath,
                error,
            });
        }
    }

    return {
        version: "2.0.0",
        description: "系统默认模板配置 - 应用启动时自动初始化",
        subtitleTemplates: [],
        subtitleStyles: [],
        coverTemplates: [],
    };
};

const buildBundledSystemTemplateMap = (config: any): Map<string, any> => {
    const map = new Map<string, any>();

    for (const template of config?.subtitleTemplates || []) {
        if (!template?.id || !isSystemTemplateRecord(template)) {
            continue;
        }
        map.set(template.id, template);
    }

    return map;
};

const normalizeSubtitleTemplateRecord = (template: any, bundledSystemTemplateMap: Map<string, any>): any => {
    const dbConfig = parseTemplateConfig(template.config);
    const bundledTemplate = template.is_system === 1 ? bundledSystemTemplateMap.get(template.id) : null;
    const bundledConfig = bundledTemplate?.config ? parseTemplateConfig(bundledTemplate.config) : {};
    const mergedConfig = template.is_system === 1
        ? mergeTemplateConfig(bundledConfig, dbConfig)
        : dbConfig;

    return {
        id: template.id,
        name: template.name,
        description: template.description,
        createdAt: template.created_at,
        isSystem: template.is_system === 1,
        config: mergedConfig,
    };
};

// 注册字幕模板相关的IPC handlers
export const registerSubtitleTemplateHandlers = () => {
    // 保存字幕模板
    ipcMain.handle("ipAgent:saveSubtitleTemplate", async (event, params: {
        name: string;
        description?: string;
        config: any;
        id?: string;
        isDev?: boolean;
    }) => {
        try {
            const { name, description, config, id, isDev } = params;

            Log.info("ipAgent.saveSubtitleTemplate - START", {
                name,
                id,
                haConfig: !!config,
                isDev
            });
            console.log('[SubtitleTemplate saveSubtitleTemplate] 接收到参数:', {
                name,
                id,
                description,
                isDev
            });

            // 验证参数
            if (!name || !config) {
                console.error('[SubtitleTemplate saveSubtitleTemplate] ❌ 参数验证失败:', {
                    nameEmpty: !name,
                    configEmpty: !config
                });
                return {
                    success: false,
                    message: "模板名称和配置不能为空"
                };
            }

            const now = Date.now();
            const configJson = JSON.stringify(config);

            // 如果提供了id，先检查该id是否存在
            if (id) {
                const existing = await DB.first(
                    `SELECT id, name, is_system FROM subtitle_templates WHERE id = ?`,
                    [id]
                );

                if (existing) {
                    // ✅ 修复：仅在非开发模式下保护系统模板，开发模式下允许修改
                    if (existing.is_system === 1 && !isDev) {
                        Log.warn("ipAgent.saveSubtitleTemplate.systemTemplate", { id, name, isDev });
                        return {
                            success: false,
                            message: "系统默认模板不能修改"
                        };
                    }

                    // 如果修改了名称，检查新名称是否与其他模板冲突
                    if (existing.name !== name) {
                        const nameConflict = await DB.first(
                            `SELECT id FROM subtitle_templates WHERE name = ? AND id != ?`,
                            [name, id]
                        );
                        if (nameConflict) {
                            return {
                                success: false,
                                message: "模板名称已存在，请使用其他名称"
                            };
                        }
                    }

                    // 更新现有模板
                    await DB.execute(
                        `UPDATE subtitle_templates
                         SET name = ?, description = ?, config = ?, updated_at = ?
                         WHERE id = ?`,
                        [name, description || null, configJson, now, id]
                    );

                    Log.info("ipAgent.saveSubtitleTemplate.updated", { name, id });

                    return {
                        success: true,
                        id,
                        message: "模板更新成功"
                    };
                }
            }

            // 🔧 防止误用已存在的ID进行创建操作
            if (id && typeof id === 'string' && id.trim()) {
                Log.warn("ipAgent.saveSubtitleTemplate.idProvisionedForCreation", { id, name });
                return {
                    success: false,
                    message: "创建新模板不应该指定ID，请不指定ID让系统自动生成，或使用更新接口修改现有模板"
                };
            }

            // 检查是否已存在同名模板
            const existingByName = await DB.first(
                `SELECT id FROM subtitle_templates WHERE name = ?`,
                [name]
            );

            if (existingByName) {
                return {
                    success: false,
                    message: "模板名称已存在，请使用其他名称"
                };
            }

            // 创建新模板 - 生成新UUID
            const newId = generateUUID();
            await DB.execute(
                `INSERT INTO subtitle_templates (id, name, description, config, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newId, name, description || null, configJson, 0, now, now]
            );

            Log.info("ipAgent.saveSubtitleTemplate.created", { name, id: newId });

            return {
                success: true,
                id: newId,
                message: "模板保存成功"
            };
        } catch (error) {
            Log.error("ipAgent.saveSubtitleTemplate.error", error);
            return {
                success: false,
                message: "保存模板失败: " + (error?.message || error)
            };
        }
    });

    // 获取所有字幕模板
    ipcMain.handle("ipAgent:getSubtitleTemplates", async (event, params?: { metadataOnly?: boolean }) => {
        try {
            const metadataOnly = params?.metadataOnly === true;
            Log.info("ipAgent.getSubtitleTemplates - START", { metadataOnly });
            console.log(`[SubtitleTemplate] 开始获取字幕模板列表 (metadataOnly=${metadataOnly})`);

            const selectFields = metadataOnly
                ? `id, name, description, created_at, updated_at, is_system`
                : `id, name, description, config, created_at, updated_at, is_system`;

            const templates = await DB.select(
                `SELECT ${selectFields}
                 FROM subtitle_templates
                 ORDER BY is_system DESC, created_at DESC`
            );

            console.log(`[SubtitleTemplate] 查询到 ${templates.length} 个模板`);
            Log.info("ipAgent.getSubtitleTemplates.queryResult", { count: templates.length, metadataOnly });

            // 仅元数据模式，直接返回
            if (metadataOnly) {
                const metadataTemplates = templates.map(t => ({
                    id: t.id,
                    name: t.name,
                    description: t.description,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                    is_system: t.is_system || 0
                }));

                console.log(`[SubtitleTemplate] 返回 ${metadataTemplates.length} 个模板（仅元数据）`);
                return {
                    success: true,
                    templates: metadataTemplates
                };
            }

            // 解析config JSON并返回完整模板
            const parsedTemplates = templates.map(t => {
                try {
                    const config = JSON.parse(t.config);
                    const template = {
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        is_system: t.is_system || 0,
                        config: config
                    };
                    console.log(`[SubtitleTemplate] 解析模板: ${t.name}, is_system: ${t.is_system}`);
                    return template;
                } catch (error) {
                    Log.error("ipAgent.getSubtitleTemplates.parseError", {
                        templateId: t.id,
                        error: error
                    });
                    console.error(`[SubtitleTemplate] 解析模板失败: ${t.id}`, error);
                    // 返回基本信息，避免整个列表加载失败
                    return {
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        is_system: t.is_system || 0,
                        config: {}
                    };
                }
            });

            Log.info("ipAgent.getSubtitleTemplates.success", {
                count: parsedTemplates.length,
                systemCount: parsedTemplates.filter(t => t.is_system === 1).length
            });

            console.log(`[SubtitleTemplate] 成功返回 ${parsedTemplates.length} 个模板`);

            return {
                success: true,
                templates: parsedTemplates
            };
        } catch (error) {
            console.error("[SubtitleTemplate] 获取模板列表失败:", error);
            Log.error("ipAgent.getSubtitleTemplates.error", error);
            return {
                success: false,
                message: "获取模板列表失败: " + (error?.message || error),
                templates: []
            };
        }
    });

    // 获取单个字幕模板
    ipcMain.handle("ipAgent:getSubtitleTemplate", async (event, params: { id: string }) => {
        try {
            const { id } = params;

            Log.info("ipAgent.getSubtitleTemplate", { id });

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            const template = await DB.first(
                `SELECT id, name, description, config, created_at, updated_at, is_system
                 FROM subtitle_templates
                 WHERE id = ?`,
                [id]
            );

            if (!template) {
                return {
                    success: false,
                    message: "模板不存在"
                };
            }

            try {
                const config = JSON.parse(template.config);
                const parsedTemplate = {
                    id: template.id,
                    name: template.name,
                    description: template.description,
                    createdAt: template.created_at,
                    updatedAt: template.updated_at,
                    is_system: template.is_system || 0,
                    config: config
                };

                Log.info("ipAgent.getSubtitleTemplate.success", { id });

                return {
                    success: true,
                    template: parsedTemplate
                };
            } catch (error) {
                Log.error("ipAgent.getSubtitleTemplate.parseError", {
                    id,
                    error: error
                });
                return {
                    success: false,
                    message: "模板数据解析失败"
                };
            }
        } catch (error) {
            Log.error("ipAgent.getSubtitleTemplate.error", error);
            return {
                success: false,
                message: "获取模板失败: " + (error?.message || error)
            };
        }
    });

    // 删除字幕模板
    ipcMain.handle("ipAgent:deleteSubtitleTemplate", async (event, params: {
        id: string;
        isDev?: boolean;
    }) => {
        try {
            const { id, isDev } = params;

            Log.info("ipAgent.deleteSubtitleTemplate", { id });

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            // 检查是否为系统模板
            const template = await DB.first(
                `SELECT is_system FROM subtitle_templates WHERE id = ?`,
                [id]
            );

            // ✅ 修复：仅在非开发模式下保护系统模板，开发模式下允许删除
            if (template && template.is_system === 1 && !isDev) {
                Log.warn("ipAgent.deleteSubtitleTemplate.systemTemplate", { id, isDev });
                return {
                    success: false,
                    message: "系统默认模板不能删除"
                };
            }

            await DB.execute(
                `DELETE FROM subtitle_templates WHERE id = ?`,
                [id]
            );

            Log.info("ipAgent.deleteSubtitleTemplate.success", { id });

            return {
                success: true,
                message: "模板删除成功"
            };
        } catch (error) {
            Log.error("ipAgent.deleteSubtitleTemplate.error", error);
            return {
                success: false,
                message: "删除模板失败: " + (error?.message || error)
            };
        }
    });

    // 更新字幕模板
    ipcMain.handle("ipAgent:updateSubtitleTemplate", async (event, params: {
        id: string;
        name?: string;
        description?: string;
        config?: any;
        is_system?: number;
        isDev?: boolean;
    }) => {
        try {
            const { id, name, description, config, is_system, isDev } = params;

            Log.info("ipAgent.updateSubtitleTemplate", { id, hasName: !!name, hasConfig: !!config });

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            // ✅ 修复：仅在非开发模式下保护系统模板，开发模式下允许修改
            let template;
            try {
                template = await DB.first(
                    `SELECT is_system FROM subtitle_templates WHERE id = ?`,
                    [id]
                );
            } catch (columnError) {
                console.warn("[SubtitleTemplate] is_system 列不存在，跳过系统模板检查");
                template = null;
            }

            if (template && template.is_system === 1 && !isDev) {
                Log.warn("ipAgent.updateSubtitleTemplate.systemTemplate", { id, isDev });
                return {
                    success: false,
                    message: "系统默认模板不能修改"
                };
            }

            const updates: string[] = [];
            const values: any[] = [];

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }

            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }

            if (config !== undefined) {
                updates.push('config = ?');
                values.push(JSON.stringify(config));
            }

            if (is_system !== undefined) {
                updates.push('is_system = ?');
                values.push(is_system);
            }

            if (updates.length === 0) {
                return {
                    success: false,
                    message: "没有要更新的内容"
                };
            }

            updates.push('updated_at = ?');
            values.push(Date.now());
            values.push(id);

            await DB.execute(
                `UPDATE subtitle_templates
                 SET ${updates.join(', ')}
                 WHERE id = ?`,
                values
            );

            Log.info("ipAgent.updateSubtitleTemplate.success", { id });

            return {
                success: true,
                message: "模板更新成功"
            };
        } catch (error) {
            Log.error("ipAgent.updateSubtitleTemplate.error", error);
            return {
                success: false,
                message: "更新模板失败: " + (error?.message || error)
            };
        }
    });

    // 导出所有字幕模板为JSON配置文件
    ipcMain.handle("ipAgent:exportSubtitleTemplates", async (event, params?: {
        includeSystemOnly?: boolean;
    }) => {
        try {
            const includeSystemOnly = params?.includeSystemOnly === true;

            Log.info("ipAgent.exportSubtitleTemplates - START", { includeSystemOnly });
            console.log('[SubtitleTemplate] 开始导出字幕模板 (includeSystemOnly=' + includeSystemOnly + ')');

            // 查询数据库中的所有模板
            const sqlQuery = includeSystemOnly
                ? `SELECT id, name, description, config, created_at, is_system FROM subtitle_templates WHERE is_system = 1 ORDER BY created_at ASC`
                : `SELECT id, name, description, config, created_at, is_system FROM subtitle_templates ORDER BY is_system DESC, created_at ASC`;

            const dbTemplates = await DB.select(sqlQuery);
            console.log(`[SubtitleTemplate] 查询到 ${dbTemplates.length} 个模板`);

            // 转换为JSON导出格式
            const subtitleTemplates = dbTemplates.map(t => {
                try {
                    return {
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        createdAt: t.created_at,
                        isSystem: t.is_system === 1,
                        config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config
                    };
                } catch (error) {
                    Log.warn("ipAgent.exportSubtitleTemplates.parseError", {
                        templateId: t.id,
                        error: error
                    });
                    return null;
                }
            }).filter(t => t !== null);

            // 获取系统模板配置文件路径（使用统一的打包配置文件）
            const configPath = getCommonResourcePath('config/system-templates.json');
            const existingConfig = loadExistingExportConfig(configPath);
            const bundledSystemTemplateMap = buildBundledSystemTemplateMap(existingConfig);
            const normalizedTemplates = dedupeTemplatesById(
                dbTemplates.map((template) => normalizeSubtitleTemplateRecord(template, bundledSystemTemplateMap))
            );
            console.log(`[SubtitleTemplate] 配置文件路径: ${configPath}`);

            let config: any = {
                version: "2.0.0",
                description: "系统默认模板配置 - 应用启动时自动初始化",
                subtitleTemplates: [],
                subtitleStyles: [],
                coverTemplates: []
            };

            // 读取现有配置文件（保留覆盖模板）
            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    config = JSON.parse(content);
                } catch (error) {
                    console.warn(`[SubtitleTemplate] 读取现有配置失败，使用默认结构`);
                }
            }

            // 获取系统模板ID列表（用于过滤）
            config = {
                ...existingConfig,
                ...config,
                version: existingConfig.version || config.version || "2.0.0",
                description: existingConfig.description || config.description || "系统默认模板配置 - 应用启动时自动初始化",
            };

            const systemTemplateIds = normalizedTemplates.filter(t => t.isSystem).map(t => t.id);

            // 直接查询所有系统字幕样式（is_system = 1）
            // 这样可以确保导出所有系统样式，不依赖模板引用
            let subtitleStyles: any[] = [];
            try {
                subtitleStyles = await DB.select(
                    `SELECT id, name, description, fontName, fontSize, fontColor, outlineColor, outlineWidth,
                            shadowOffset, shadowColor, shadowBlur, backgroundColor, backgroundOpacity,
                            position, alignment, is_system, preview
                     FROM subtitle_styles
                     WHERE is_system = 1
                     ORDER BY id ASC`
                );
                console.log(`[SubtitleTemplate] ✅ 查询到 ${subtitleStyles.length} 个系统字幕样式`);
            } catch (error) {
                console.warn(`[SubtitleTemplate] ⚠️ 查询字幕样式失败，继续不导出样式:`, error);
            }

            // 更新字幕模板：移除旧的系统模板，添加新的
            if (includeSystemOnly) {
                const existingNonSystemTemplates = (existingConfig.subtitleTemplates || []).filter((template: any) => !isSystemTemplateRecord(template));
                config.subtitleTemplates = dedupeTemplatesById([
                    ...normalizedTemplates,
                    ...existingNonSystemTemplates,
                ]);
            } else {
                config.subtitleTemplates = normalizedTemplates;
            }

            // 更新字幕样式：移除旧的系统样式，添加新的
            const systemStyleIds = new Set(subtitleStyles.map(s => s.id));
            config.subtitleStyles = [
                ...subtitleStyles.map(s => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    preview: s.preview || "示例文字",
                    is_system: 1,
                    fontName: s.fontName,
                    fontSize: s.fontSize,
                    fontColor: s.fontColor,
                    outlineColor: s.outlineColor,
                    outlineWidth: s.outlineWidth,
                    shadowOffset: s.shadowOffset,
                    shadowColor: s.shadowColor,
                    shadowBlur: s.shadowBlur,
                    backgroundColor: s.backgroundColor,
                    backgroundOpacity: s.backgroundOpacity,
                    position: s.position,
                    alignment: s.alignment
                })),
                ...(config.subtitleStyles || []).filter((s: any) => !systemStyleIds.has(s.id))
            ];

            // 写回配置文件
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

            console.log(`[SubtitleTemplate] ✅ 已导出 ${config.subtitleTemplates.length} 个模板和 ${subtitleStyles.length} 个样式到配置文件`);
            console.log(`[SubtitleTemplate] 配置文件已更新: ${configPath}`);

            Log.info("ipAgent.exportSubtitleTemplates.success", {
                count: config.subtitleTemplates.length,
                styleCount: subtitleStyles.length,
                configPath: configPath,
                templates: config.subtitleTemplates.map((t: any) => ({ id: t.id, name: t.name }))
            });

            return {
                success: true,
                count: config.subtitleTemplates.length,
                styleCount: subtitleStyles.length,
                message: `已将 ${config.subtitleTemplates.length} 个模板和 ${subtitleStyles.length} 个样式导出到配置文件`,
                configPath: configPath,
                templates: config.subtitleTemplates.map((t: any) => ({ id: t.id, name: t.name }))
            };
        } catch (error) {
            console.error("[SubtitleTemplate] 导出模板失败:", error);
            Log.error("ipAgent.exportSubtitleTemplates.error", error);
            return {
                success: false,
                message: "导出失败: " + (error?.message || error),
                data: null
            };
        }
    });

    // 导出单个字幕模板为JSON
    ipcMain.handle("ipAgent:exportSubtitleTemplateById", async (event, params: {
        id: string;
    }) => {
        try {
            const { id } = params;

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            Log.info("ipAgent.exportSubtitleTemplateById", { id });
            console.log('[SubtitleTemplate] 开始导出单个字幕模板:', id);

            const template = await DB.first(
                `SELECT id, name, description, config, created_at, is_system FROM subtitle_templates WHERE id = ?`,
                [id]
            );

            if (!template) {
                return {
                    success: false,
                    message: "模板不存在"
                };
            }

            const bundledSystemTemplateMap = buildBundledSystemTemplateMap(
                loadExistingExportConfig(getCommonResourcePath('config/system-templates.json'))
            );
            const normalizedTemplate = normalizeSubtitleTemplateRecord(template, bundledSystemTemplateMap);
            const exportData = {
                version: "2.0.0",
                description: "单个字幕模板导出",
                timestamp: new Date().toISOString(),
                subtitleTemplate: {
                    id: normalizedTemplate.id,
                    name: normalizedTemplate.name,
                    description: normalizedTemplate.description,
                    createdAt: normalizedTemplate.createdAt,
                    isSystem: normalizedTemplate.isSystem,
                    config: normalizedTemplate.config
                }
            };

            console.log(`[SubtitleTemplate] 导出单个模板成功: ${template.name}`);
            Log.info("ipAgent.exportSubtitleTemplateById.success", { id, name: template.name });

            return {
                success: true,
                data: exportData,
                message: "导出成功"
            };
        } catch (error) {
            console.error("[SubtitleTemplate] 导出单个模板失败:", error);
            Log.error("ipAgent.exportSubtitleTemplateById.error", error);
            return {
                success: false,
                message: "导出失败: " + (error?.message || error),
                data: null
            };
        }
    });

    // 复制字幕模板
    ipcMain.handle("ipAgent:duplicateSubtitleTemplate", async (event, params: {
        id: string;
        newName?: string;
    }) => {
        try {
            const { id, newName } = params;

            Log.info("ipAgent.duplicateSubtitleTemplate", { id, newName });
            console.log('[SubtitleTemplate duplicateSubtitleTemplate] 开始复制模板:', id);

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            // 获取原模板
            const sourceTemplate = await DB.first(
                `SELECT id, name, description, config, is_system FROM subtitle_templates WHERE id = ?`,
                [id]
            );

            if (!sourceTemplate) {
                return {
                    success: false,
                    message: "源模板不存在"
                };
            }

            // 生成新模板名称
            let duplicateName = newName || `${sourceTemplate.name} - 副本`;

            // 检查名称是否已存在，如果存在则添加数字后缀
            let counter = 1;
            let finalName = duplicateName;
            while (true) {
                const existing = await DB.first(
                    `SELECT id FROM subtitle_templates WHERE name = ?`,
                    [finalName]
                );
                if (!existing) break;

                finalName = `${duplicateName} (${counter})`;
                counter++;
            }

            // 创建新模板
            const newId = generateUUID();
            const now = Date.now();
            const bundledSystemTemplateMap = buildBundledSystemTemplateMap(
                loadExistingExportConfig(getCommonResourcePath('config/system-templates.json'))
            );
            const normalizedSourceTemplate = normalizeSubtitleTemplateRecord(sourceTemplate, bundledSystemTemplateMap);

            await DB.execute(
                `INSERT INTO subtitle_templates (id, name, description, config, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newId, finalName, normalizedSourceTemplate.description, JSON.stringify(normalizedSourceTemplate.config), 0, now, now]
            );

            Log.info("ipAgent.duplicateSubtitleTemplate.success", {
                sourceId: id,
                newId,
                sourceName: sourceTemplate.name,
                newName: finalName
            });
            console.log(`[SubtitleTemplate] ✅ 复制成功: ${sourceTemplate.name} → ${finalName}`);

            return {
                success: true,
                id: newId,
                name: finalName,
                message: "模板复制成功"
            };
        } catch (error) {
            Log.error("ipAgent.duplicateSubtitleTemplate.error", error);
            console.error("[SubtitleTemplate] 复制模板失败:", error);
            return {
                success: false,
                message: "复制模板失败: " + (error?.message || error)
            };
        }
    });

    ipcMain.handle("ipAgent:importSubtitleTemplate", async (event) => {
        try {
            const result = await dialog.showOpenDialog({
                title: '导入字幕模板',
                filters: [
                    { name: 'JSON文件', extensions: ['json'] }
                ],
                properties: ['openFile']
            });

            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                return { success: false, message: '用户取消导入' };
            }

            const filePath = result.filePaths[0];
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            let templateData: any = null;
            if (data.subtitleTemplate) {
                templateData = data.subtitleTemplate;
            } else if (data.name && data.config) {
                templateData = data;
            } else {
                return { success: false, message: '无法识别的模板文件格式' };
            }

            if (!templateData.config) {
                return { success: false, message: '模板文件缺少配置数据' };
            }

            const templateName = templateData.name || '导入的模板';
            const configJson = JSON.stringify(templateData.config);
            const now = Date.now();

            const count = await DB.first(
                `SELECT COUNT(*) as count FROM subtitle_templates WHERE is_system = 0 OR is_system IS NULL`
            );
            if (count && count.count >= 24) {
                return { success: false, message: '最多只能保存24个自定义模板，请先删除一些模板' };
            }

            const existingByName = await DB.first(
                `SELECT id FROM subtitle_templates WHERE name = ?`,
                [templateName]
            );
            let finalName = templateName;
            if (existingByName) {
                finalName = templateName + ' (' + new Date().toLocaleString() + ')';
            }

            const newId = generateUUID();
            await DB.execute(
                `INSERT INTO subtitle_templates (id, name, description, config, created_at, updated_at, is_system)
                 VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [newId, finalName, templateData.description || '', configJson, now, now]
            );

            console.log(`[SubtitleTemplate] 导入模板成功: ${finalName}`);
            Log.info("ipAgent.importSubtitleTemplate.success", { id: newId, name: finalName });

            return {
                success: true,
                id: newId,
                name: finalName,
                message: `模板 "${finalName}" 导入成功`
            };
        } catch (error) {
            console.error("[SubtitleTemplate] 导入模板失败:", error);
            Log.error("ipAgent.importSubtitleTemplate.error", error);
            return {
                success: false,
                message: "导入失败: " + (error?.message || error)
            };
        }
    });

    Log.info("ipAgent.subtitleTemplate.handlers.registered");
};

export default {
    registerSubtitleTemplateHandlers
};
