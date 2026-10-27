/**
 * 封面模板管理 - IPC Handlers
 * 提供封面模板的CRUD操作
 */

import { ipcMain } from "electron";
import { Log } from "../log/main";
import * as path from "path";
import * as fs from "fs";
import { AppEnv } from "../env";
import DB from "../db/main";
import { spawn } from "child_process";
import { getPythonPath } from "../../lib/python-util";
import { getPythonScriptPath, getCommonResourcePath } from "../../lib/resource-path";
import { getFFmpegExecutablePath, resourceExists } from "../../lib/resource-path";
import { spawnPython } from "../../lib/python-spawn-util";
import { normalizePath, normalizeOutputPath } from "../../lib/path-util";

// UUID生成函数
const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// 获取输出目录
const getOutputDir = () => {
    const outputDir = path.join(AppEnv.dataRoot, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    return outputDir;
};

// 转换 thumbnailPath 为可访问的路径
const convertThumbnailPath = (thumbnailPath: string | null): string | null => {
    if (!thumbnailPath) {
        return null;
    }

    // 如果已经是 data: URL，直接返回
    if (thumbnailPath.startsWith('data:')) {
        return thumbnailPath;
    }

    // 如果是绝对路径，读取并转换为 data: URL
    if (path.isAbsolute(thumbnailPath)) {
        try {
            if (fs.existsSync(thumbnailPath)) {
                const fileBuffer = fs.readFileSync(thumbnailPath);
                const base64 = fileBuffer.toString('base64');

                const ext = path.extname(thumbnailPath).toLowerCase();
                let mimeType = 'image/png';
                if (ext === '.jpg' || ext === '.jpeg') {
                    mimeType = 'image/jpeg';
                } else if (ext === '.gif') {
                    mimeType = 'image/gif';
                } else if (ext === '.webp') {
                    mimeType = 'image/webp';
                }

                const dataUrl = `data:${mimeType};base64,${base64}`;
                return dataUrl;
            }
        } catch (error) {
            Log.warn("convertThumbnailPath.absolutePath.error", { thumbnailPath, error: error?.message });
        }
        return thumbnailPath;
    }

    // 处理相对路径
    try {
        // 🔧 修复：移除可能存在的 extra/common/ 前缀
        let relativePath = thumbnailPath;
        if (relativePath.startsWith('extra/common/')) {
            relativePath = relativePath.substring('extra/common/'.length);
        }

        const fullPath = getCommonResourcePath(relativePath);
        console.log(`[convertThumbnailPath] 相对路径: ${thumbnailPath} -> 完整路径: ${fullPath}`);

        if (fs.existsSync(fullPath)) {
            // 读取文件并转换为 base64 data: URL
            const fileBuffer = fs.readFileSync(fullPath);
            const base64 = fileBuffer.toString('base64');

            // 根据文件扩展名判断 MIME 类型
            const ext = path.extname(fullPath).toLowerCase();
            let mimeType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
            } else if (ext === '.gif') {
                mimeType = 'image/gif';
            } else if (ext === '.webp') {
                mimeType = 'image/webp';
            }

            const dataUrl = `data:${mimeType};base64,${base64}`;
            console.log(`[convertThumbnailPath] ✅ 成功转换为 base64, 大小: ${Math.round(base64.length / 1024)}KB`);
            return dataUrl;
        } else {
            console.warn(`[convertThumbnailPath] ❌ 文件不存在: ${fullPath}`);
            Log.warn("convertThumbnailPath.fileNotFound", { thumbnailPath, fullPath });
        }
    } catch (error) {
        Log.warn("convertThumbnailPath.error", { thumbnailPath, error: error?.message });
        console.error(`[convertThumbnailPath] 转换失败:`, error);
    }

    return thumbnailPath;
};

// 注册封面模板相关的IPC handlers
export const registerCoverTemplateHandlers = () => {
    // 保存封面模板
    ipcMain.handle("ipAgent:saveCoverTemplate", async (event, params: {
        name: string;
        config: any;
        thumbnailPath?: string;
        id?: string;
        isDev?: boolean;  // ✅ 添加开发模式标志
    }) => {
        try {
            const { name, config, thumbnailPath, id, isDev } = params;  // ✅ 解构 isDev

            Log.info("ipAgent.saveCoverTemplate - START", {
                name,
                id,
                idType: typeof id,
                hasThumbnail: !!thumbnailPath,
                hasConfig: !!config,
                configKeys: config ? Object.keys(config).length : 0
            });
            console.log('[CoverTemplate saveCoverTemplate] 接收到参数:', {
                name,
                id,
                hasThumbnail: !!thumbnailPath,
                configKeys: config ? Object.keys(config).length : 0,
                configKeysArray: config ? Object.keys(config).slice(0, 5) : []
            });

            // 验证参数
            if (!name || !config) {
                console.error('[CoverTemplate saveCoverTemplate] ❌ 参数验证失败:', {
                    nameEmpty: !name,
                    configEmpty: !config,
                    configValue: config
                });
                return {
                    success: false,
                    message: "模板名称和配置不能为空"
                };
            }

            const now = Date.now();
            const configJson = JSON.stringify(config);

            // 详细日志：记录配置内容的关键字段
            Log.info("ipAgent.saveCoverTemplate.config", {
                hasId: !!id,
                configKeys: Object.keys(config),
                hasTitleFontFamily: !!config.titleFontFamily,
                hasTitleBackgroundEnabled: !!config.titleBackgroundEnabled,
                configLength: configJson.length
            });

            // 如果提供了id，先检查该id是否存在
            if (id) {
                const existing = await DB.first(
                    `SELECT id, name, COALESCE(is_system, 0) as is_system FROM cover_templates WHERE id = ?`,
                    [id]
                );

                if (existing) {
                    // ✅ 修复：仅在非开发模式下保护系统模板，开发模式下允许修改
                    if (existing.is_system === 1 && !isDev) {
                        Log.warn("ipAgent.saveCoverTemplate.systemTemplate", { id, name, isDev });
                        return {
                            success: false,
                            message: "系统默认模板不能修改"
                        };
                    }

                    // 如果修改了名称，检查新名称是否与其他模板冲突
                    if (existing.name !== name) {
                        const nameConflict = await DB.first(
                            `SELECT id FROM cover_templates WHERE name = ? AND id != ?`,
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
                        `UPDATE cover_templates
                         SET name = ?, config = ?, thumbnail_path = ?, updated_at = ?
                         WHERE id = ?`,
                        [name, configJson, thumbnailPath || null, now, id]
                    );

                    Log.info("ipAgent.saveCoverTemplate.updated", { name, id });

                    return {
                        success: true,
                        id,
                        message: "模板更新成功"
                    };
                }
            }

            // 🔧 防止误用已存在的ID进行创建操作
            // 如果创建新模板时提供了ID，需要检查这个ID是否已经存在
            // ✅ 修复：检查 id 是否为非空字符串（排除空字符串 "" 或 null/undefined）
            if (id && typeof id === 'string' && id.trim()) {
                // 能进入这个分支，说明在前面的第68行已经检查过，这个ID在数据库中不存在
                // 但仍然需要确保逻辑清晰：不允许用ID创建，只允许用ID更新
                // 直接返回错误，建议用户不指定ID或直接更新现有模板
                Log.warn("ipAgent.saveCoverTemplate.idProvisionedForCreation", { id, name });
                return {
                    success: false,
                    message: "创建新模板不应该指定ID，请不指定ID让系统自动生成，或使用更新接口修改现有模板"
                };
            }

            // 检查是否已存在同名模板
            const existingByName = await DB.first(
                `SELECT id FROM cover_templates WHERE name = ?`,
                [name]
            );

            if (existingByName) {
                return {
                    success: false,
                    message: "模板名称已存在，请使用其他名称"
                };
            }

            // 检查模板数量限制（最多24个用户模板，不包括系统模板）
            // ✅ 修复：只计数用户模板（is_system=0或NULL），不包括系统模板（is_system=1）
            const count = await DB.first(
                `SELECT COUNT(*) as count FROM cover_templates WHERE is_system = 0 OR is_system IS NULL`
            );
            if (count && count.count >= 24) {
                return {
                    success: false,
                    message: "最多只能保存24个自定义模板，请先删除一些模板"
                };
            }

            // 创建新模板 - 生成新UUID
            const newId = generateUUID();
            await DB.execute(
                `INSERT INTO cover_templates (id, name, config, thumbnail_path, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [newId, name, configJson, thumbnailPath || null, now, now]
            );

            Log.info("ipAgent.saveCoverTemplate.created", { name, id: newId });

            return {
                success: true,
                id: newId,
                message: "模板保存成功"
            };
        } catch (error) {
            Log.error("ipAgent.saveCoverTemplate.error", error);
            return {
                success: false,
                message: "保存模板失败: " + (error?.message || error)
            };
        }
    });

    // 获取所有封面模板
    ipcMain.handle("ipAgent:getCoverTemplates", async (event, params?: { metadataOnly?: boolean }) => {
        try {
            const metadataOnly = params?.metadataOnly === true;
            Log.info("ipAgent.getCoverTemplates - START", { metadataOnly });
            console.log(`[CoverTemplate] 开始获取封面模板列表 (metadataOnly=${metadataOnly})`);

            // 先尝试查询，如果 is_system 字段不存在则使用备用查询
            let templates;
            try {
                // 🔧 性能优化：如果只需要元数据，不查询config字段
                const selectFields = metadataOnly
                    ? `id, name, thumbnail_path, created_at, updated_at, COALESCE(is_system, 0) as is_system`
                    : `id, name, thumbnail_path, config, created_at, updated_at, COALESCE(is_system, 0) as is_system`;

                templates = await DB.select(
                    `SELECT ${selectFields}
                     FROM cover_templates
                     ORDER BY created_at DESC
                     LIMIT 24`
                );
            } catch (columnError) {
                // 如果 is_system 列不存在，使用不包含该列的查询
                console.warn("[CoverTemplate] is_system 列不存在，使用备用查询");
                const selectFields = metadataOnly
                    ? `id, name, thumbnail_path, created_at, updated_at`
                    : `id, name, thumbnail_path, config, created_at, updated_at`;

                templates = await DB.select(
                    `SELECT ${selectFields}
                     FROM cover_templates
                     ORDER BY created_at DESC
                     LIMIT 24`
                );
                // 为所有模板添加默认的 is_system = 0
                templates = templates.map(t => ({ ...t, is_system: 0 }));
            }

            console.log(`[CoverTemplate] 查询到 ${templates.length} 个模板`);
            Log.info("ipAgent.getCoverTemplates.queryResult", { count: templates.length, metadataOnly });

            // 🔧 性能优化：如果只需要元数据，直接返回，不解析config
            if (metadataOnly) {
                const metadataTemplates = templates.map(t => ({
                    id: t.id,
                    name: t.name,
                    thumbnailPath: convertThumbnailPath(t.thumbnail_path),
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                    is_system: t.is_system || 0
                }));

                console.log(`[CoverTemplate] 返回 ${metadataTemplates.length} 个模板（仅元数据）`);
                Log.info("ipAgent.getCoverTemplates.metadataOnly", { count: metadataTemplates.length });

                return {
                    success: true,
                    templates: metadataTemplates
                };
            }

            // 解析config JSON并合并所有字段（完整模式）
            const parsedTemplates = templates.map(t => {
                try {
                    const config = JSON.parse(t.config);
                    // 将config中的所有���段展开，并确保id、name等字段正确
                    let thumbnailPath = convertThumbnailPath(t.thumbnail_path);

                    // 如果数据库中没有缩略图路径，使用映射表中的默认图片
                    const imageMap: { [key: string]: string } = {
                        '485183be-6eed-4eae-b74a-8591f08b69fa': 'huangbai-shishi.jpg',
                        '6404718a-1b1c-4148-9807-ad3c57a53e0c': 'landi-baizi.jpg',
                        '705fa010-5bf3-4041-b624-0fd364bea5ad': 'dasi-baobao.jpg',
                        '8f17c467-c69c-45b2-8011-94a6c3071d16': 'xiehanghuangbai.jpg',
                        '43t1uykj8zg-mkdite6i': 'fenghong-xubai.jpg',
                        'v08ezr6v3x-mkdite6i': 'renyixujzhong.jpg',
                        '1xwrrcvf7a5-mkdite6i': 'qinglan-xushi.png',
                        'sb8mm7l4bjf-mkdite6i': 'honghang-xushi.png'
                    };

                    if (!thumbnailPath && imageMap[t.id]) {
                        const imageName = imageMap[t.id];
                        const fullPath = getCommonResourcePath(`cover-templates/${imageName}`);
                        console.log(`[CoverTemplate] 检查图片: ${t.name}, id=${t.id}, 文件=${imageName}, 路径=${fullPath}, 存在=${fs.existsSync(fullPath)}`);
                        if (fs.existsSync(fullPath)) {
                            const fileBuffer = fs.readFileSync(fullPath);
                            const base64 = fileBuffer.toString('base64');
                            const ext = path.extname(fullPath).toLowerCase();
                            let mimeType = 'image/png';
                            if (ext === '.jpg' || ext === '.jpeg') {
                                mimeType = 'image/jpeg';
                            }
                            thumbnailPath = `data:${mimeType};base64,${base64}`;
                            console.log(`[CoverTemplate] ✅ 使用默认图片: ${t.id} -> ${imageName}`);
                        } else {
                            console.log(`[CoverTemplate] ❌ 文件不存在: ${fullPath}`);
                        }
                    }

                    const template = {
                        ...config,
                        id: t.id,
                        name: t.name,
                        thumbnailPath: thumbnailPath,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        is_system: t.is_system || 0
                    };
                    console.log(`[CoverTemplate] 解析模板: ${t.name}, is_system: ${t.is_system}`);
                    return template;
                } catch (error) {
                    Log.error("ipAgent.getCoverTemplates.parseError", {
                        templateId: t.id,
                        error: error
                    });
                    console.error(`[CoverTemplate] 解析模板失败: ${t.id}`, error);
                    // 返回基本信息，避免整个列表加载失败
                    return {
                        id: t.id,
                        name: t.name,
                        thumbnailPath: convertThumbnailPath(t.thumbnail_path),
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        is_system: t.is_system || 0
                    };
                }
            });

            // 详细日志：记录每个模板的关键信息
            Log.info("ipAgent.getCoverTemplates.success", {
                count: parsedTemplates.length,
                templates: parsedTemplates.map(t => ({
                    id: t.id,
                    name: t.name,
                    is_system: t.is_system,
                    hasTitleFontFamily: !!t.titleFontFamily,
                    hasTitleBackgroundEnabled: !!t.titleBackgroundEnabled,
                    hasPersonSize: !!t.personSize,
                    configKeys: Object.keys(t).length
                }))
            });

            console.log(`[CoverTemplate] 成功返回 ${parsedTemplates.length} 个模板`);

            return {
                success: true,
                templates: parsedTemplates
            };
        } catch (error) {
            console.error("[CoverTemplate] 获取模板列表失败:", error);
            Log.error("ipAgent.getCoverTemplates.error", error);
            return {
                success: false,
                message: "获取模板列表失败: " + (error?.message || error),
                templates: []
            };
        }
    });

    // 删除封面模板
    ipcMain.handle("ipAgent:deleteCoverTemplate", async (event, params: {
        id: string;
        isDev?: boolean;  // ✅ 添加开发模式标志
    }) => {
        try {
            const { id, isDev } = params;  // ✅ 解构 isDev

            Log.info("ipAgent.deleteCoverTemplate", { id });

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            // 检查是否为系统模板
            let template;
            try {
                template = await DB.first(
                    `SELECT is_system FROM cover_templates WHERE id = ?`,
                    [id]
                );
            } catch (columnError) {
                // 如果 is_system 列不存在，则不是系统模板，允许删除
                console.warn("[CoverTemplate] is_system 列不存在，跳过系统模板检查");
                template = null;
            }

            // ✅ 修复：仅在非开发模式下保护系统模板，开发模式下允许删除
            if (template && template.is_system === 1 && !isDev) {
                Log.warn("ipAgent.deleteCoverTemplate.systemTemplate", { id, isDev });
                return {
                    success: false,
                    message: "系统默认模板不能删除"
                };
            }

            await DB.execute(
                `DELETE FROM cover_templates WHERE id = ?`,
                [id]
            );

            Log.info("ipAgent.deleteCoverTemplate.success", { id });

            return {
                success: true,
                message: "模板删除成功"
            };
        } catch (error) {
            Log.error("ipAgent.deleteCoverTemplate.error", error);
            return {
                success: false,
                message: "删除模板失败: " + (error?.message || error)
            };
        }
    });

    // 更新封面模板
    ipcMain.handle("ipAgent:updateCoverTemplate", async (event, params: {
        id: string;
        name?: string;
        config?: any;
        thumbnailPath?: string;
        is_system?: number;  // ✅ 添加设置 is_system 的能力
        isDev?: boolean;     // ✅ 添加开发模式标志
    }) => {
        try {
            const { id, name, config, thumbnailPath, is_system, isDev } = params;  // ✅ 解构新参数

            Log.info("ipAgent.updateCoverTemplate", { id, hasName: !!name, hasConfig: !!config });

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
                    `SELECT is_system FROM cover_templates WHERE id = ?`,
                    [id]
                );
            } catch (columnError) {
                console.warn("[CoverTemplate] is_system 列不存在，跳过系统模板检查");
                template = null;
            }

            if (template && template.is_system === 1 && !isDev) {
                Log.warn("ipAgent.updateCoverTemplate.systemTemplate", { id, isDev });
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

            if (config !== undefined) {
                updates.push('config = ?');
                values.push(JSON.stringify(config));
            }

            if (thumbnailPath !== undefined) {
                updates.push('thumbnail_path = ?');
                values.push(thumbnailPath);
            }

            // ✅ 添加设置 is_system 的能力
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
                `UPDATE cover_templates
                 SET ${updates.join(', ')}
                 WHERE id = ?`,
                values
            );

            Log.info("ipAgent.updateCoverTemplate.success", { id });

            return {
                success: true,
                message: "模板更新成功"
            };
        } catch (error) {
            Log.error("ipAgent.updateCoverTemplate.error", error);
            return {
                success: false,
                message: "更新模板失败: " + (error?.message || error)
            };
        }
    });

    // 获取单个封面模板
    ipcMain.handle("ipAgent:getCoverTemplate", async (event, params: { id: string }) => {
        try {
            const { id } = params;

            Log.info("ipAgent.getCoverTemplate", { id });

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            const template = await DB.first(
                `SELECT id, name, thumbnail_path, config, created_at, updated_at
                 FROM cover_templates
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
                // 返回完整的模板对象，包含元数据和配置
                // 前端会负责分离元数据和配置
                const parsedTemplate = {
                    ...config,  // 展开所有配置字段
                    id: template.id,
                    name: template.name,
                    thumbnailPath: convertThumbnailPath(template.thumbnail_path),
                    createdAt: template.created_at,
                    updatedAt: template.updated_at
                };

                Log.info("ipAgent.getCoverTemplate.success", {
                    id,
                    hasTitleFontFamily: !!config.titleFontFamily,
                    hasTitleBackgroundEnabled: !!config.titleBackgroundEnabled,
                    configKeys: Object.keys(config).length
                });

                return {
                    success: true,
                    template: parsedTemplate
                };
            } catch (error) {
                Log.error("ipAgent.getCoverTemplate.parseError", {
                    id,
                    error: error
                });
                return {
                    success: false,
                    message: "模板数据解析失败"
                };
            }
        } catch (error) {
            Log.error("ipAgent.getCoverTemplate.error", error);
            return {
                success: false,
                message: "获取模板失败: " + (error?.message || error)
            };
        }
    });

    // 预览封面效果（不保存，仅生成临时预览图）
    ipcMain.handle("ipAgent:previewCoverTemplate", async (event, params: {
        videoPath: string;
        titleText: string;
        config: any;
    }) => {
        try {
            const { videoPath, titleText, config } = params;

            Log.info("ipAgent.previewCoverTemplate", { videoPath, titleText });

            // 验证参数
            if (!videoPath || !fs.existsSync(videoPath)) {
                return {
                    success: false,
                    message: "视频文件不存在"
                };
            }

            if (!titleText || !titleText.trim()) {
                return {
                    success: false,
                    message: "标题文字不能为空"
                };
            }

            const pythonScript = getPythonScriptPath('advanced_cover_generator.py');
            const outputDir = getOutputDir();
            const timestamp = Date.now();
            const previewPath = path.join(outputDir, `cover_preview_${timestamp}.jpg`);

            const safeVideoPath = normalizePath(videoPath);
            const safePreviewPath = normalizeOutputPath(previewPath);

            const configJson = JSON.stringify(config);

            return new Promise(async (resolve) => {
                try {
                    const result = await spawnPython([
                        pythonScript,
                        '--video', safeVideoPath,
                        '--title', titleText,
                        '--output', safePreviewPath,
                        '--config', configJson,
                        '--preview'
                    ], {
                        timeout: 120000, // 2分钟超时
                        addFFmpegToPath: true
                    });

                    if (fs.existsSync(previewPath)) {
                        Log.info("ipAgent.previewCoverTemplate.success", { previewPath });
                        resolve({
                            success: true,
                            previewPath,
                            message: "预览生成成功"
                        });
                    } else {
                        Log.error("ipAgent.previewCoverTemplate.noOutput", { result });
                        resolve({
                            success: false,
                            message: `预览生成失败: 未生成输出文件`
                        });
                    }
                } catch (error: any) {
                    Log.error("ipAgent.previewCoverTemplate.error", error);
                    resolve({
                        success: false,
                        message: `预览生成失败: ${error.message || '未知错误'}`
                    });
                }
            });
        } catch (error) {
            Log.error("ipAgent.previewCoverTemplate.error", error);
            return {
                success: false,
                message: "预览生成失败: " + (error?.message || error)
            };
        }
    });

    // 清理损坏的模板数据（修复嵌套循环引用问题）
    ipcMain.handle("ipAgent:cleanupCoverTemplates", async (event) => {
        try {
            Log.info("ipAgent.cleanupCoverTemplates.start");

            const templates = await DB.select(
                `SELECT id, name, config FROM cover_templates`
            );

            let cleanedCount = 0;
            let errorCount = 0;

            for (const template of templates) {
                try {
                    const config = JSON.parse(template.config);

                    // 检查是否存在嵌套的 config 字段
                    if (config.config) {
                        Log.info("ipAgent.cleanupCoverTemplates.foundNested", {
                            id: template.id,
                            name: template.name
                        });

                        // 递归提取最内层的配置（不包含元数据字段）
                        let cleanConfig = config;
                        while (cleanConfig.config) {
                            cleanConfig = cleanConfig.config;
                        }

                        // 移除元数据字段
                        const { id, name, thumbnailPath, createdAt, updatedAt, ...pureConfig } = cleanConfig;

                        // 更新数据库
                        await DB.execute(
                            `UPDATE cover_templates SET config = ? WHERE id = ?`,
                            [JSON.stringify(pureConfig), template.id]
                        );

                        cleanedCount++;
                        Log.info("ipAgent.cleanupCoverTemplates.cleaned", {
                            id: template.id,
                            name: template.name
                        });
                    }
                } catch (error) {
                    errorCount++;
                    Log.error("ipAgent.cleanupCoverTemplates.templateError", {
                        id: template.id,
                        error: error
                    });
                }
            }

            Log.info("ipAgent.cleanupCoverTemplates.complete", {
                total: templates.length,
                cleaned: cleanedCount,
                errors: errorCount
            });

            return {
                success: true,
                total: templates.length,
                cleaned: cleanedCount,
                errors: errorCount,
                message: `清理完成：共 ${templates.length} 个模板，修复 ${cleanedCount} 个，失败 ${errorCount} 个`
            };
        } catch (error) {
            Log.error("ipAgent.cleanupCoverTemplates.error", error);
            return {
                success: false,
                message: "清理失败: " + (error?.message || error)
            };
        }
    });

    // 批量标记所有现有模板为系统模板
    ipcMain.handle("ipAgent:markAllTemplatesAsSystem", async (event) => {
        try {
            Log.info("ipAgent.markAllTemplatesAsSystem - START");
            console.log("[CoverTemplate] 批量标记所有模板为系统模板");

            await DB.execute(
                `UPDATE cover_templates SET is_system = 1 WHERE is_system IS NULL OR is_system = 0`
            );

            const templates = await DB.select(
                `SELECT id, name, is_system FROM cover_templates`
            );

            console.log(`[CoverTemplate] 已标记 ${templates.length} 个模板为系统模板`);
            console.table(templates);

            return {
                success: true,
                count: templates.length,
                message: `已将 ${templates.length} 个模板标记为系统模板`
            };
        } catch (error) {
            Log.error("ipAgent.markAllTemplatesAsSystem.error", error);
            console.error("[CoverTemplate] 批量标记失败:", error);
            return {
                success: false,
                message: "操作失败: " + (error?.message || error)
            };
        }
    });

    // 导出系统模板到配置文件（供新用户自动导入）
    ipcMain.handle("ipAgent:exportCoverTemplatesToConfig", async (event) => {
        try {
            Log.info("ipAgent.exportCoverTemplatesToConfig - START");
            console.log("[CoverTemplate] 开始导出所有系统模板到配置文件");

            // 🔒 正确的8个系统模板ID（白名单）- 与图片映射中的ID必须一致
            const validSystemTemplateIds = [
                '485183be-6eed-4eae-b74a-8591f08b69fa', // 黄白实描
                '6404718a-1b1c-4148-9807-ad3c57a53e0c', // 蓝底白字
                '705fa010-5bf3-4041-b624-0fd364bea5ad', // 大四字报
                '8f17c467-c69c-45b2-8011-94a6c3071d16', // 斜黄白
                '43t1uykj8zg-mkdite6i',                  // 粉红虚白
                'v08ezr6v3x-mkdite6i',                   // 人像居中
                '1xwrrcvf7a5-mkdite6i',                  // 青蓝虚描
                'sb8mm7l4bjf-mkdite6i'                   // 红黄虚描
            ];

            // 查询数据库中所有 is_system=1 的模板
            const allSystemTemplates = await DB.select(
                `SELECT id, name, config FROM cover_templates WHERE is_system = 1 ORDER BY created_at ASC`
            );

            // ✅ 只保留白名单中的模板（过滤掉错误的系统模板标记）
            const templates = allSystemTemplates.filter((t: any) => validSystemTemplateIds.includes(t.id));

            // ⚠️ 警告：如果数据库中有多余的 is_system=1 标记
            if (allSystemTemplates.length > templates.length) {
                const invalidCount = allSystemTemplates.length - templates.length;
                console.warn(`[CoverTemplate] ⚠️ 数据库中有 ${invalidCount} 个错误的系统模板标记被忽略`);
                Log.warn("ipAgent.exportCoverTemplatesToConfig.invalidTemplates", {
                    totalInDb: allSystemTemplates.length,
                    validCount: templates.length,
                    invalidCount
                });
            }

            // 获取导出的系统模板 ID 列表（用于后续过滤）
            const systemTemplateIds = templates.map((t: any) => t.id);

            if (templates.length === 0) {
                return {
                    success: false,
                    message: "未找到要导出的系统模板"
                };
            }

            // 使用统一的配置文件路径（用于打包和开发）
            const configPath = getCommonResourcePath('config/system-templates.json');

            console.log(`[CoverTemplate] 配置文件路径: ${configPath}`);

            let config: any = {
                version: "1.0.0",
                description: "系统默认模板配置 - 应用启动时自动初始化",
                subtitleTemplates: [],
                coverTemplates: [],
                subtitleStyles: []
            };

            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                config = JSON.parse(content);
                // ✅ 确保保留字幕模板，只更新封面模板
            }

            // 转换模板格式
            const exportedTemplates = templates.map((template: any) => {
                const tplConfig = JSON.parse(template.config);

                // ✅ 确保所有必需的参数都存在，补充缺失的默认值
                const completeConfig = {
                    // 背景相关
                    backgroundEnabled: tplConfig.backgroundEnabled ?? false,
                    backgroundImagePath: tplConfig.backgroundImagePath ?? null,
                    backgroundBlurEnabled: tplConfig.backgroundBlurEnabled ?? false,
                    backgroundBlurIntensity: tplConfig.backgroundBlurIntensity ?? 10,
                    backgroundSize: tplConfig.backgroundSize ?? 100,
                    backgroundPosition: tplConfig.backgroundPosition ?? { x: 50, y: 50 },

                    // 人物相关
                    personImagePath: tplConfig.personImagePath ?? null,
                    personSize: tplConfig.personSize ?? 80,
                    personPosition: tplConfig.personPosition ?? { x: 50, y: 50 },
                    personRotation: tplConfig.personRotation ?? 0,
                    personBorderEnabled: tplConfig.personBorderEnabled ?? false,
                    personBorderStyle: tplConfig.personBorderStyle ?? "solid",
                    personBorderColor: tplConfig.personBorderColor ?? "#FFFFFF",
                    personBorderWidth: tplConfig.personBorderWidth ?? 8,
                    personBorderDashLength: tplConfig.personBorderDashLength ?? null,
                    personBorderGapLength: tplConfig.personBorderGapLength ?? null,

                    // 文本相关
                    autoSplitText: tplConfig.autoSplitText ?? true,
                    titleMaxLength: tplConfig.titleMaxLength ?? 4,
                    subtitleMaxLength: tplConfig.subtitleMaxLength ?? 10,

                    // 主标题相关
                    titleText: tplConfig.titleText ?? "",
                    titleFontFamily: tplConfig.titleFontFamily ?? "SimHei",
                    titleFontSize: tplConfig.titleFontSize ?? 120,
                    titleFontWeight: tplConfig.titleFontWeight ?? 700,
                    titleColor: tplConfig.titleColor ?? "#FFFFFF",
                    titleStrokeColor: tplConfig.titleStrokeColor ?? "#000000",
                    titleStrokeWidth: tplConfig.titleStrokeWidth ?? 2,
                    titleShadowColor: tplConfig.titleShadowColor ?? "#000000",
                    titleShadowOffsetX: tplConfig.titleShadowOffsetX ?? 0,
                    titleShadowOffsetY: tplConfig.titleShadowOffsetY ?? 0,
                    titleShadowBlur: tplConfig.titleShadowBlur ?? 0,
                    titleShadowEnabled: tplConfig.titleShadowEnabled ?? false,
                    titleShadowLayers: tplConfig.titleShadowLayers ?? [],
                    titlePosition: tplConfig.titlePosition ?? { x: 50, y: 80 },
                    titleRotation: tplConfig.titleRotation ?? 0,
                    titleDirection: tplConfig.titleDirection ?? "horizontal",
                    titleCharSpacing: tplConfig.titleCharSpacing ?? 24,
                    titleLineSpacing: tplConfig.titleLineSpacing ?? 144,
                    titleMaxCharsPerLine: tplConfig.titleMaxCharsPerLine ?? 10,
                    titleBackgroundEnabled: tplConfig.titleBackgroundEnabled ?? false,
                    titleBackgroundColor: tplConfig.titleBackgroundColor ?? "#000000",
                    titleBackgroundOpacity: tplConfig.titleBackgroundOpacity ?? 70,
                    titleBackgroundShape: tplConfig.titleBackgroundShape ?? "rectangle",
                    titleBackgroundSize: tplConfig.titleBackgroundSize ?? { width: 30, height: 10 },
                    titleBackgroundPosition: tplConfig.titleBackgroundPosition ?? { x: 50, y: 30 },
                    titleBackgroundPoints: tplConfig.titleBackgroundPoints ?? [],
                    titleBackgroundRadius: tplConfig.titleBackgroundRadius ?? 10,
                    titleBackgroundRotation: tplConfig.titleBackgroundRotation ?? 0,

                    // 副标题相关
                    subtitleText: tplConfig.subtitleText ?? "",
                    subtitleFontFamily: tplConfig.subtitleFontFamily ?? "SimHei",
                    subtitleFontSize: tplConfig.subtitleFontSize ?? 60,
                    subtitleFontWeight: tplConfig.subtitleFontWeight ?? 500,
                    subtitleColor: tplConfig.subtitleColor ?? "#FFFFFF",
                    subtitleStrokeColor: tplConfig.subtitleStrokeColor ?? "#000000",
                    subtitleStrokeWidth: tplConfig.subtitleStrokeWidth ?? 1,
                    subtitleShadowColor: tplConfig.subtitleShadowColor ?? "#000000",
                    subtitleShadowOffsetX: tplConfig.subtitleShadowOffsetX ?? 0,
                    subtitleShadowOffsetY: tplConfig.subtitleShadowOffsetY ?? 0,
                    subtitleShadowBlur: tplConfig.subtitleShadowBlur ?? 0,
                    subtitleShadowEnabled: tplConfig.subtitleShadowEnabled ?? false,
                    subtitleShadowLayers: tplConfig.subtitleShadowLayers ?? [],
                    subtitlePosition: tplConfig.subtitlePosition ?? { x: 50, y: 90 },
                    subtitleRotation: tplConfig.subtitleRotation ?? 0,
                    subtitleDirection: tplConfig.subtitleDirection ?? "horizontal",
                    subtitleCharSpacing: tplConfig.subtitleCharSpacing ?? 12,
                    subtitleLineSpacing: tplConfig.subtitleLineSpacing ?? 72,
                    subtitleMaxCharsPerLine: tplConfig.subtitleMaxCharsPerLine ?? 15,
                    subtitleBackgroundEnabled: tplConfig.subtitleBackgroundEnabled ?? false,
                    subtitleBackgroundColor: tplConfig.subtitleBackgroundColor ?? "#000000",
                    subtitleBackgroundOpacity: tplConfig.subtitleBackgroundOpacity ?? 70,
                    subtitleBackgroundShape: tplConfig.subtitleBackgroundShape ?? "rectangle",
                    subtitleBackgroundSize: tplConfig.subtitleBackgroundSize ?? { width: 30, height: 10 },
                    subtitleBackgroundPosition: tplConfig.subtitleBackgroundPosition ?? { x: 50, y: 60 },
                    subtitleBackgroundPoints: tplConfig.subtitleBackgroundPoints ?? [],
                    subtitleBackgroundRadius: tplConfig.subtitleBackgroundRadius ?? 10,
                    subtitleBackgroundRotation: tplConfig.subtitleBackgroundRotation ?? 0,

                    // 蒙版相关
                    maskEnabled: tplConfig.maskEnabled ?? false,
                    maskImagePath: tplConfig.maskImagePath ?? null,
                    maskSize: tplConfig.maskSize ?? 100,
                    maskPosition: tplConfig.maskPosition ?? { x: 50, y: 50 },
                    maskColor: tplConfig.maskColor ?? null,
                    maskOpacity: tplConfig.maskOpacity ?? 100,
                    maskShape: tplConfig.maskShape ?? "rectangle"
                };

                return {
                    id: template.id,
                    name: template.name,
                    description: `系统模板 - ${template.name}`,
                    is_system: 1,
                    config: completeConfig
                };
            });

            // ✨ 改进：只保留数据库导出的系统模板，不混入配置文件里的其他模板
            // 原因：配置文件是用于新用户初始化的，只应包含系统模板，用户自定义模板应在应用中创建
            config.coverTemplates = exportedTemplates;

            // 写回配置文件
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

            console.log(`[CoverTemplate] ✅ 已导出 ${exportedTemplates.length} 个系统模板到配置文件`);
            console.log(`[CoverTemplate] 配置文件已更新: ${configPath}`);

            Log.info("ipAgent.exportCoverTemplatesToConfig.success", {
                count: exportedTemplates.length,
                configPath: configPath,
                templates: exportedTemplates.map(t => ({ id: t.id, name: t.name }))
            });

            return {
                success: true,
                count: exportedTemplates.length,
                message: `已将 ${exportedTemplates.length} 个模板导出到配置文件`,
                configPath: configPath,
                templates: exportedTemplates.map(t => ({ id: t.id, name: t.name }))
            };
        } catch (error) {
            Log.error("ipAgent.exportCoverTemplatesToConfig.error", error);
            console.error("[CoverTemplate] 导出配置文件失败:", error);
            return {
                success: false,
                message: "导出失败: " + (error?.message || error)
            };
        }
    });

    // 导出单个封面模板为JSON
    ipcMain.handle("ipAgent:exportCoverTemplateById", async (event, params: { id: string }) => {
        try {
            const { id } = params;

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            Log.info("ipAgent.exportCoverTemplateById", { id });
            console.log('[CoverTemplate] 开始导出单个模板:', id);

            const template = await DB.first(
                `SELECT id, name, config FROM cover_templates WHERE id = ?`,
                [id]
            );

            if (!template) {
                return {
                    success: false,
                    message: "模板不存在"
                };
            }

            const config = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
            const exportData = {
                version: "1.0.0",
                description: "封面模板导出配置",
                timestamp: new Date().toISOString(),
                coverTemplate: {
                    id: template.id,
                    name: template.name,
                    config: config
                }
            };

            console.log(`[CoverTemplate] 导出单个模板成功: ${template.name}`);
            Log.info("ipAgent.exportCoverTemplateById.success", { id, name: template.name });

            return {
                success: true,
                data: exportData,
                message: "导出成功"
            };
        } catch (error) {
            console.error("[CoverTemplate] 导出单个模板失败:", error);
            Log.error("ipAgent.exportCoverTemplateById.error", error);
            return {
                success: false,
                message: "导出失败: " + (error?.message || error),
                data: null
            };
        }
    });

    // 注意：这个接口已废弃，前端 render.ts 中的 exportAllCoverTemplates 已指向 exportCoverTemplatesToConfig
    // 保留此接口是为了向后兼容，但实际上前端不会调用到这里
    ipcMain.handle("ipAgent:exportAllCoverTemplates", async (event) => {
        // 直接重定向到正确的导出接口
        console.log('[CoverTemplate] ⚠️ 警告：调用了废弃的 exportAllCoverTemplates 接口，重定向到 exportCoverTemplatesToConfig');
        return event.sender.invoke("ipAgent:exportCoverTemplatesToConfig");
    });

    // 加载封面模板图片文件
    ipcMain.handle("ipAgent:getCoverTemplateImage", async (event, params: { templateId: string }) => {
        try {
            const { templateId } = params;

            // 根据 templateId 映射到图片文件
            const imageMap: { [key: string]: string } = {
                '485183be-6eed-4eae-b74a-8591f08b69fa': 'huangbai-shishi.jpg',  // 黄白实描
                '6404718a-1b1c-4148-9807-ad3c57a53e0c': 'landi-baizi.jpg',      // 蓝底白字
                '705fa010-5bf3-4041-b624-0fd364bea5ad': 'dasi-baobao.jpg',      // 大四字报
                '8f17c467-c69c-45b2-8011-94a6c3071d16': 'xiehanghuangbai.jpg',  // 斜黄白
                '43t1uykj8zg-mkdite6i': 'fenghong-xubai.jpg',                    // 粉红虚白
                'v08ezr6v3x-mkdite6i': 'renyixujzhong.jpg',                      // 人像居中
                '1xwrrcvf7a5-mkdite6i': 'qinglan-xushi.png',                     // 青蓝虚描
                'sb8mm7l4bjf-mkdite6i': 'honghang-xushi.png'                     // 红黄虚描
            };

            const imageName = imageMap[templateId];
            if (!imageName) {
                Log.warn("ipAgent.getCoverTemplateImage.noMap", { templateId });
                return null;
            }

            const imagePath = getCommonResourcePath(`cover-templates/${imageName}`);

            if (!fs.existsSync(imagePath)) {
                Log.warn("ipAgent.getCoverTemplateImage.notFound", { templateId, imagePath });
                return null;
            }

            console.log(`[CoverTemplate] 读取图片: ${imagePath}`);

            // 读取文件并转换为 base64
            const fileBuffer = fs.readFileSync(imagePath);
            const base64 = fileBuffer.toString('base64');

            // 判断 MIME 类型
            const ext = path.extname(imagePath).toLowerCase();
            let mimeType = 'image/png';
            if (ext === '.jpg' || ext === '.jpeg') {
                mimeType = 'image/jpeg';
            }

            const dataUrl = `data:${mimeType};base64,${base64}`;
            console.log(`[CoverTemplate] 图片 base64 长度: ${dataUrl.length}`);

            return dataUrl;
        } catch (error) {
            Log.error("ipAgent.getCoverTemplateImage.error", error);
            console.error("[CoverTemplate] 加载图片失败:", error);
            return null;
        }
    });

    // 强制重新初始化系统模板（用于运行时更新）
    ipcMain.handle("ipAgent:reinitSystemTemplates", async (event) => {
        try {
            Log.info("ipAgent.reinitSystemTemplates - START");
            console.log("[CoverTemplate] 开始强制重新初始化系统模板");

            // 动态导入 initSystemTemplates 函数
            const { initSystemTemplates } = await import("../db/initSystemTemplates");

            // 执行初始化
            await initSystemTemplates();

            Log.info("ipAgent.reinitSystemTemplates - SUCCESS");
            console.log("[CoverTemplate] ✅ 系统模板强制重新初始化完成");

            return {
                success: true,
                message: "系统模板已重新初始化，请刷新页面查看更新"
            };
        } catch (error) {
            Log.error("ipAgent.reinitSystemTemplates.error", error);
            console.error("[CoverTemplate] 强制重新初始化失败:", error);
            return {
                success: false,
                message: "重新初始化失败: " + (error?.message || error)
            };
        }
    });

    // 复制封面模板
    ipcMain.handle("ipAgent:duplicateCoverTemplate", async (event, params: {
        id: string;
        newName?: string;
    }) => {
        try {
            const { id, newName } = params;

            Log.info("ipAgent.duplicateCoverTemplate", { id, newName });
            console.log('[CoverTemplate duplicateCoverTemplate] 开始复制模板:', id);

            if (!id) {
                return {
                    success: false,
                    message: "模板ID不能为空"
                };
            }

            // 获取原模板
            const sourceTemplate = await DB.first(
                `SELECT id, name, config, thumbnail_path, is_system FROM cover_templates WHERE id = ?`,
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
                    `SELECT id FROM cover_templates WHERE name = ?`,
                    [finalName]
                );
                if (!existing) break;

                finalName = `${duplicateName} (${counter})`;
                counter++;
            }

            // 创建新模板
            const newId = generateUUID();
            const now = Date.now();

            await DB.execute(
                `INSERT INTO cover_templates (id, name, config, thumbnail_path, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [newId, finalName, sourceTemplate.config, sourceTemplate.thumbnail_path, 0, now, now]
            );

            Log.info("ipAgent.duplicateCoverTemplate.success", {
                sourceId: id,
                newId,
                sourceName: sourceTemplate.name,
                newName: finalName
            });
            console.log(`[CoverTemplate] ✅ 复制成功: ${sourceTemplate.name} → ${finalName}`);

            return {
                success: true,
                id: newId,
                name: finalName,
                message: "模板复制成功"
            };
        } catch (error) {
            Log.error("ipAgent.duplicateCoverTemplate.error", error);
            console.error("[CoverTemplate] 复制模板失败:", error);
            return {
                success: false,
                message: "复制模板失败: " + (error?.message || error)
            };
        }
    });

    Log.info("ipAgent.coverTemplate.handlers.registered");
};

export default {
    registerCoverTemplateHandlers
};