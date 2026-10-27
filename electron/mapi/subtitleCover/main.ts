import {Files} from "../file/main";
import {Log} from "../log/main";
import {AppEnv} from "../env";
import {spawn} from "child_process";
import * as fs from "fs";
import * as path from "path";
import {getPythonPath} from "../../lib/python-util";
import {getPythonScriptPath, getFFmpegExecutablePath, resourceExists} from "../../lib/resource-path";
import {spawnPython, createTempConfig, cleanupTempConfig} from "../../lib/python-spawn-util";
import {normalizePath, normalizeOutputPath} from "../../lib/path-util";
import DB from "../db/main";

const TAG = "SubtitleCoverGenerator";

interface GenerateRequest {
    videoPath: string;
    scriptText: string;
    subtitleStyle: string;
    coverStyle: string;
    // 新增参数
    coverText?: string;
    coverTextPosition?: string;
    coverTextColor?: string;
    coverTextSize?: number;
    outlineColor?: string;
    outlineWidth?: number;
    blurRadius?: number;
    zoomLevel?: number;
}

interface GenerateResult {
    success: boolean;
    coverPath?: string;
    srtPath?: string;
    subtitles?: Array<{
        index: number;
        text: string;
        start_time: number;
        end_time: number;
        style: string;
    }>;
    error?: string;
    message: string;
}

class SubtitleCoverGenerator {
    private getPythonScriptPath(): string {
        // Python脚本路径
        return getPythonScriptPath('subtitle_cover_generator_simple.py');
    }

    // 移除重复的 createTempConfig 方法，使用 python-spawn-util 中的统一实现

    /**
     * 执行Python命令
     * ⚠️ 只使用程序自带的 Python，不依赖系统环境
     */
    private async execPython(command: string, timeoutMs: number = 300000): Promise<string> {
        // 解析command字符串为参数数组
        const args = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const parsedArgs = args.map(arg => arg.replace(/^"|"$/g, '')); // 移除引号

        // 使用统一的 Python 调用工具（支持中文路径）
        return spawnPython(parsedArgs, {
            timeout: timeoutMs,
            addFFmpegToPath: true
        });
    }

    /**
     * 生成字幕和封面
     * @param request 生成请求参数
     * @returns 生成结果
     */
    async generateSubtitleAndCover(request: GenerateRequest): Promise<GenerateResult> {
        try {
            Log.info(TAG, `Starting generation for video: ${request.videoPath}`);

            // 验证输入参数
            if (!request.videoPath || !request.scriptText) {
                throw new Error("Video path and script text are required");
            }

            if (!fs.existsSync(request.videoPath)) {
                throw new Error(`Video file not found: ${request.videoPath}`);
            }

            const safeVideoPath = normalizePath(request.videoPath);

            const hubRoot = await Files.hubRoot();
            Log.info(TAG, `Using hubRoot for output: ${hubRoot}`);

            const outputDir = path.join(hubRoot, `subtitle_cover_${Date.now()}`);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeOutputDir = normalizeOutputPath(outputDir);
            const safeHubRoot = normalizePath(hubRoot);

            const config = {
                videoPath: safeVideoPath,
                scriptText: request.scriptText,
                subtitleStyle: request.subtitleStyle || "default",
                coverStyle: request.coverStyle || "default",
                outputDir: safeOutputDir,
                hubRoot: safeHubRoot,
                // 新增参数
                coverText: request.coverText || '',
                coverTextPosition: request.coverTextPosition || 'bottom',
                coverTextColor: request.coverTextColor || '#FFFFFF',
                coverTextSize: request.coverTextSize || 50,
                outlineColor: request.outlineColor || '#FFD700',
                outlineWidth: request.outlineWidth || 3,
                blurRadius: request.blurRadius || 15,
                zoomLevel: request.zoomLevel || 1.0
            };

            const configPath = await createTempConfig(config);
            Log.info(TAG, `Created config file: ${configPath}`);

            // 执行Python脚本 (设置10分钟超时)
            const pythonCommand = `"${this.getPythonScriptPath()}" "${configPath}"`;
            Log.info(TAG, `Executing Python command with 10 minute timeout`);

            const result = await this.execPython(pythonCommand, 600000); // 10分钟超时

            Log.info(TAG, `Python execution completed`);

            // 解析结果
            let generateResult: GenerateResult;
            try {
                // 查找JSON结果（可能在输出的最后）
                const lines = result.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                generateResult = JSON.parse(jsonLine);
            } catch (parseError) {
                Log.error(TAG, `Failed to parse Python result: ${parseError}`);
                throw new Error(`Invalid result format`);
            }

            // 清理临时配置文件
            cleanupTempConfig(configPath);

            Log.info(TAG, `Generation completed: ${generateResult.message}`);
            return generateResult;

        } catch (error: any) {
            Log.error(TAG, `Generation failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Generation failed: ${error.message || String(error)}`
            };
        }
    }

    /**
     * 获取支持的字幕样式列表
     * @returns 字幕样式列表
     */
    getSubtitleStyles(): Array<{value: string; label: string; description: string}> {
        return [
            {
                value: "default",
                label: "默认样式",
                description: "白色字体，黑色描边"
            },
            {
                value: "highlight",
                label: "高亮样式",
                description: "黄色高亮背景"
            },
            {
                value: "card",
                label: "卡片样式",
                description: "圆角卡片背景"
            },
            {
                value: "neon",
                label: "霓虹样式",
                description: "霓虹灯效果"
            },
            {
                value: "minimal",
                label: "极简样式",
                description: "简洁现代风格"
            }
        ];
    }

    /**
     * 获取支持的封面样式列表
     * @returns 封面样式列表
     */
    getCoverStyles(): Array<{value: string; label: string; description: string}> {
        return [
            {
                value: "default",
                label: "默认封面",
                description: "标准视频封面"
            },
            {
                value: "blur-bg",
                label: "背景虚化",
                description: "人物清晰，背景虚化"
            },
            {
                value: "outline",
                label: "人物描边",
                description: "人物描边效果"
            },
            {
                value: "gradient",
                label: "渐变背景",
                description: "渐变色背景"
            },
            {
                value: "split",
                label: "斜切设计",
                description: "斜切色块设计"
            }
        ];
    }

    /**
     * 重新生成封面
     * @param request 重新生成请求参数
     * @returns 生成结果
     */
    async regenerateCover(request: {
        videoPath: string;
        scriptText: string;
        coverStyle: string;
        // 新增参数
        coverText?: string;
        coverTextPosition?: string;
        coverTextColor?: string;
        coverTextSize?: number;
        outlineColor?: string;
        outlineWidth?: number;
        blurRadius?: number;
        zoomLevel?: number;
    }): Promise<GenerateResult> {
        try {
            Log.info(TAG, `Regenerating cover for video: ${request.videoPath}`);

            // 验证输入参数
            if (!request.videoPath) {
                throw new Error("Video path is required");
            }

            if (!fs.existsSync(request.videoPath)) {
                throw new Error(`Video file not found: ${request.videoPath}`);
            }

            const safeVideoPath = normalizePath(request.videoPath);

            const hubRoot = await Files.hubRoot();
            Log.info(TAG, `Using hubRoot for output: ${hubRoot}`);

            const outputDir = path.join(hubRoot, `subtitle_cover_${Date.now()}`);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeOutputDir = normalizeOutputPath(outputDir);
            const safeHubRoot = normalizePath(hubRoot);

            const config = {
                videoPath: safeVideoPath,
                scriptText: request.scriptText,
                subtitleStyle: "default",
                coverStyle: request.coverStyle || "default",
                outputDir: safeOutputDir,
                hubRoot: safeHubRoot,
                coverOnly: true,
                // 新增参数
                coverText: request.coverText || '',
                coverTextPosition: request.coverTextPosition || 'bottom',
                coverTextColor: request.coverTextColor || '#FFFFFF',
                coverTextSize: request.coverTextSize || 50,
                outlineColor: request.outlineColor || '#FFD700',
                outlineWidth: request.outlineWidth || 3,
                blurRadius: request.blurRadius || 15,
                zoomLevel: request.zoomLevel || 1.0
            };

            const configPath = await createTempConfig(config);
            Log.info(TAG, `Created config file for cover regeneration: ${configPath}`);

            // 执行Python脚本
            const pythonCommand = `"${this.getPythonScriptPath()}" "${configPath}"`;
            Log.info(TAG, `Executing Python command for cover regeneration`);

            const result = await this.execPython(pythonCommand);

            Log.info(TAG, `Python execution completed for cover regeneration`);

            // 解析结果
            let generateResult: GenerateResult;
            try {
                // 查找JSON结果（可能在输出的最后）
                const lines = result.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                generateResult = JSON.parse(jsonLine);
            } catch (parseError) {
                Log.error(TAG, `Failed to parse Python result: ${parseError}`);
                throw new Error(`Invalid result format`);
            }

            // 清理临时配置文件
            cleanupTempConfig(configPath);

            Log.info(TAG, `Cover regeneration completed: ${generateResult.message}`);
            return generateResult;

        } catch (error: any) {
            Log.error(TAG, `Cover regeneration failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Cover regeneration failed: ${error.message || String(error)}`
            };
        }
    }

    /**
     * 生成实时封面预览
     * @param request 预览请求参数
     * @returns 预览结果
     */
    async generateCoverPreviews(request: {
        videoPath: string;
        scriptText?: string;
    }): Promise<{
        success: boolean;
        previews?: Array<{
            style: string;
            url: string;
        }>;
        error?: string;
        message: string;
    }> {
        try {
            Log.info(TAG, `Generating cover previews for video: ${request.videoPath}`);

            // 验证输入参数
            if (!request.videoPath) {
                throw new Error("Video path is required");
            }

            if (!fs.existsSync(request.videoPath)) {
                throw new Error(`Video file not found: ${request.videoPath}`);
            }

            const safeVideoPath = normalizePath(request.videoPath);

            const outputDir = path.join(await Files.tempRoot(), `cover_previews_${Date.now()}`);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeOutputDir = normalizeOutputPath(outputDir);

            const pythonScript = getPythonScriptPath('cover_preview_generator.py');

            if (!fs.existsSync(pythonScript)) {
                throw new Error(`Preview generator script not found: ${pythonScript}`);
            }

            const pythonCommand = `"${pythonScript}" "${safeVideoPath}" --output-dir "${safeOutputDir}"`;
            Log.info(TAG, `Executing preview generation command`);

            const result = await this.execPython(pythonCommand, 120000); // 2分钟超时

            Log.info(TAG, `Preview generation completed`);

            // 解析结果
            let previewResult: any;
            try {
                const lines = result.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                previewResult = JSON.parse(jsonLine);
            } catch (parseError) {
                Log.error(TAG, `Failed to parse preview result: ${parseError}`);
                throw new Error(`Invalid result format`);
            }

            if (previewResult.error) {
                throw new Error(previewResult.error);
            }

            return {
                success: true,
                previews: previewResult.previews || [],
                message: `Generated ${previewResult.previews?.length || 0} previews`
            };

        } catch (error: any) {
            Log.error(TAG, `Preview generation failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Preview generation failed: ${error.message || String(error)}`
            };
        }
    }

    /**
     * 使用自定义模板生成封面
     * @param request 自定义模板生成请求
     * @returns 生成结果
     */
    async generateWithCustomTemplate(request: {
        videoPath: string;
        scriptText: string;
        template: any;  // CustomTemplate interface from frontend
    }): Promise<GenerateResult> {
        try {
            Log.info(TAG, `Generating with custom template for video: ${request.videoPath}`);

            // 验证输入参数
            if (!request.videoPath) {
                throw new Error("Video path is required");
            }

            if (!request.template) {
                throw new Error("Custom template is required");
            }

            if (!fs.existsSync(request.videoPath)) {
                throw new Error(`Video file not found: ${request.videoPath}`);
            }

            const safeVideoPath = normalizePath(request.videoPath);

            const hubRoot = await Files.hubRoot();
            Log.info(TAG, `Using hubRoot for output: ${hubRoot}`);

            const outputDir = path.join(hubRoot, `subtitle_cover_${Date.now()}`);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const safeOutputDir = normalizeOutputPath(outputDir);
            const safeHubRoot = normalizePath(hubRoot);

            const config = {
                videoPath: safeVideoPath,
                scriptText: request.scriptText,
                outputDir: safeOutputDir,
                hubRoot: safeHubRoot,
                customTemplate: true,
                template: request.template
            };

            const configPath = await createTempConfig(config);
            Log.info(TAG, `Created config file with custom template: ${configPath}`);

            // 执行Python脚本
            const pythonCommand = `"${this.getPythonScriptPath()}" "${configPath}"`;
            Log.info(TAG, `Executing Python command with custom template`);

            const result = await this.execPython(pythonCommand, 300000); // 5分钟超时

            Log.info(TAG, `Python execution completed for custom template`);

            // 解析结果
            let generateResult: GenerateResult;
            try {
                // 查找JSON结果（可能在输出的最后）
                const lines = result.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                generateResult = JSON.parse(jsonLine);
            } catch (parseError) {
                Log.error(TAG, `Failed to parse Python result: ${parseError}`);
                throw new Error(`Invalid result format`);
            }

            // 清理临时配置文件
            cleanupTempConfig(configPath);

            Log.info(TAG, `Custom template generation completed: ${generateResult.message}`);
            return generateResult;

        } catch (error: any) {
            Log.error(TAG, `Custom template generation failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Custom template generation failed: ${error.message || String(error)}`
            };
        }
    }

    /**
     * 检查Python环境和依赖
     * @returns 检查结果
     */
    async checkPythonEnvironment(): Promise<{
        pythonAvailable: boolean;
        scriptExists: boolean;
        dependenciesInstalled: boolean;
        missingLibraries?: string[];
        message: string;
    }> {
        try {
            // 检查Python是否可用
            let pythonAvailable = false;
            try {
                await this.execPython('--version');
                pythonAvailable = true;
            } catch (e) {
                pythonAvailable = false;
            }

            // 检查脚本文件是否存在
            const scriptExists = fs.existsSync(this.getPythonScriptPath());

            // 检查依赖库
            const dependencies = ["cv2", "numpy", "PIL"];
            const missingLibraries: string[] = [];

            for (const lib of dependencies) {
                try {
                    await this.execPython(`-c "import ${lib}"`);
                } catch (e) {
                    missingLibraries.push(lib);
                }
            }

            const dependenciesInstalled = missingLibraries.length === 0;

            let message = "";
            if (!pythonAvailable) {
                message = "Python is not available";
            } else if (!scriptExists) {
                message = "Python script not found";
            } else if (!dependenciesInstalled) {
                message = `Missing dependencies: ${missingLibraries.join(", ")}`;
            } else {
                message = "Python environment is ready";
            }

            return {
                pythonAvailable,
                scriptExists,
                dependenciesInstalled,
                missingLibraries: missingLibraries.length > 0 ? missingLibraries : undefined,
                message
            };

        } catch (error: any) {
            Log.error(TAG, `Environment check failed: ${error}`);
            return {
                pythonAvailable: false,
                scriptExists: false,
                dependenciesInstalled: false,
                message: `Environment check failed: ${error.message || String(error)}`
            };
        }
    }

    /**
     * 获取系统模板列表
     */
    async getSystemTemplatesList(): Promise<{success: boolean; templates?: any[]; error?: string}> {
        try {

            // 从数据库获取系统模板
            const subtitleTemplates = await DB.select(
                `SELECT id, name, description, config, is_system, readonly, created_at, updated_at
                 FROM subtitle_templates WHERE is_system = 1 ORDER BY created_at ASC`
            );

            const coverTemplates = await DB.select(
                `SELECT id, name, description, config, is_system, readonly, created_at, updated_at
                 FROM cover_templates WHERE is_system = 1 ORDER BY created_at ASC`
            );

            return {
                success: true,
                templates: {
                    subtitleTemplates: subtitleTemplates || [],
                    coverTemplates: coverTemplates || []
                }
            };
        } catch (error: any) {
            Log.error(TAG, `Get system templates list failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 保存/编辑系统模板
     */
    async saveSystemTemplate(template: any): Promise<{success: boolean; id?: string; error?: string; message?: string}> {
        try {
            const now = Date.now();

            if (template.type === 'subtitle') {
                // 保存字幕模板
                const configJson = JSON.stringify(template.config);
                const existing = await DB.first(
                    `SELECT id FROM subtitle_templates WHERE id = ?`,
                    [template.id]
                );

                if (existing) {
                    await DB.execute(
                        `UPDATE subtitle_templates SET name = ?, description = ?, config = ?, updated_at = ? WHERE id = ?`,
                        [template.name, template.description, configJson, now, template.id]
                    );
                } else {
                    await DB.execute(
                        `INSERT INTO subtitle_templates (id, name, description, config, is_system, readonly, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [template.id, template.name, template.description, configJson, 1, 0, now, now]
                    );
                }

                Log.info(TAG, `Saved subtitle template: ${template.id}`);
                return {success: true, id: template.id, message: "Subtitle template saved successfully"};

            } else if (template.type === 'cover') {
                // 保存封面模板
                const configJson = JSON.stringify(template.config);
                const existing = await DB.first(
                    `SELECT id FROM cover_templates WHERE id = ?`,
                    [template.id]
                );

                if (existing) {
                    await DB.execute(
                        `UPDATE cover_templates SET name = ?, description = ?, config = ?, thumbnail_path = ?, updated_at = ? WHERE id = ?`,
                        [template.name, template.description, configJson, template.thumbnailPath || null, now, template.id]
                    );
                } else {
                    await DB.execute(
                        `INSERT INTO cover_templates (id, name, config, is_system, readonly, created_at, updated_at, thumbnail_path)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [template.id, template.name, configJson, 1, 0, now, now, template.thumbnailPath || null]
                    );
                }

                Log.info(TAG, `Saved cover template: ${template.id}`);
                return {success: true, id: template.id, message: "Cover template saved successfully"};

            } else {
                throw new Error("Invalid template type");
            }
        } catch (error: any) {
            Log.error(TAG, `Save system template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 删除系统模板
     */
    async deleteSystemTemplate(templateId: string): Promise<{success: boolean; error?: string; message?: string}> {
        try {

            // 检查模板是否存在
            const template = await DB.first(
                `SELECT id, is_system FROM subtitle_templates WHERE id = ? UNION SELECT id, is_system FROM cover_templates WHERE id = ?`,
                [templateId, templateId]
            );

            if (!template) {
                throw new Error("Template not found");
            }

            if (template.is_system === 1) {
                throw new Error("Cannot delete system templates");
            }

            // 从数据库删除
            await DB.execute(`DELETE FROM subtitle_templates WHERE id = ?`, [templateId]);
            await DB.execute(`DELETE FROM cover_templates WHERE id = ?`, [templateId]);

            Log.info(TAG, `Deleted template: ${templateId}`);
            return {success: true, message: "Template deleted successfully"};

        } catch (error: any) {
            Log.error(TAG, `Delete system template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 重置系统模板为默认值
     */
    async resetSystemTemplates(): Promise<{success: boolean; error?: string; message?: string}> {
        try {
            const { initSystemTemplates } = await import('../db/initSystemTemplates');

            // 调用初始化函数重置系统模板
            await initSystemTemplates();

            Log.info(TAG, "System templates reset to defaults");
            return {success: true, message: "System templates reset to defaults successfully"};

        } catch (error: any) {
            Log.error(TAG, `Reset system templates failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 保存字幕模板并自动导出（开发模式）
     */
    async saveSubtitleTemplateAndExport(template: any, isDev: boolean = false): Promise<{success: boolean; id?: string; error?: string; message?: string}> {
        try {
            const now = Date.now();

            const configJson = JSON.stringify(template.config);
            const existing = await DB.first(
                `SELECT id FROM subtitle_templates WHERE id = ?`,
                [template.id]
            );

            if (existing) {
                await DB.execute(
                    `UPDATE subtitle_templates SET name = ?, description = ?, config = ?, updated_at = ? WHERE id = ?`,
                    [template.name, template.description, configJson, now, template.id]
                );
            } else {
                await DB.execute(
                    `INSERT INTO subtitle_templates (id, name, description, config, is_system, readonly, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [template.id, template.name, template.description, configJson, 0, 0, now, now]
                );
            }

            // ✨ 关键：保存后自动导出到JSON（开发模式）
            if (isDev) {
                const exportResult = await this.exportSystemTemplatesToFile();
                if (!exportResult.success) {
                    Log.warn(TAG, 'Failed to auto-export after saving', { templateId: template.id, error: exportResult.error });
                    // 不中断保存，只记录警告
                } else {
                    Log.info(TAG, 'Auto-exported system template after saving', { templateId: template.id });
                }
            }

            Log.info(TAG, `Saved subtitle template: ${template.id}`);
            return { success: true, id: template.id, message: "Subtitle template saved successfully" };

        } catch (error: any) {
            Log.error(TAG, `Save subtitle template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 保存封面模板并自动导出（开发模式）
     */
    async saveCoverTemplateAndExport(template: any, isDev: boolean = false): Promise<{success: boolean; id?: string; error?: string; message?: string}> {
        try {
            const now = Date.now();

            const configJson = JSON.stringify(template.config);
            const existing = await DB.first(
                `SELECT id FROM cover_templates WHERE id = ?`,
                [template.id]
            );

            if (existing) {
                await DB.execute(
                    `UPDATE cover_templates SET name = ?, description = ?, config = ?, thumbnail_path = ?, updated_at = ? WHERE id = ?`,
                    [template.name, template.description, configJson, template.thumbnailPath || null, now, template.id]
                );
            } else {
                await DB.execute(
                    `INSERT INTO cover_templates (id, name, description, config, thumbnail_path, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [template.id, template.name, template.description, configJson, template.thumbnailPath || null, now, now]
                );
            }

            // ✨ 关键：保存后自动导出到JSON（开发模式）
            if (isDev) {
                const exportResult = await this.exportSystemTemplatesToFile();
                if (!exportResult.success) {
                    Log.warn(TAG, 'Failed to auto-export after saving', { templateId: template.id, error: exportResult.error });
                    // 不中断保存，只记录警告
                } else {
                    Log.info(TAG, 'Auto-exported system template after saving', { templateId: template.id });
                }
            }

            Log.info(TAG, `Saved cover template: ${template.id}`);
            return { success: true, id: template.id, message: "Cover template saved successfully" };

        } catch (error: any) {
            Log.error(TAG, `Save cover template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }

    /**
     * 导出系统模板配置到 JSON 文件
     */
    async exportSystemTemplatesToFile(): Promise<{success: boolean; filePath?: string; error?: string; message?: string}> {
        try {
            const pathModule = await import('path');
            const fsModule = await import('fs');

            // 从数据库获取所有系统模板
            const subtitleTemplates = await DB.select(
                `SELECT id, name, description, config, is_system, readonly, created_at, updated_at
                 FROM subtitle_templates WHERE is_system = 1 ORDER BY created_at ASC`
            );

            const coverTemplates = await DB.select(
                `SELECT id, name, description, config, is_system, readonly, created_at, updated_at, thumbnail_path
                 FROM cover_templates WHERE is_system = 1 ORDER BY created_at ASC`
            );

            // 格式化数据
            const subtitleTemplatesFormatted = (subtitleTemplates || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                isSystem: Boolean(t.is_system),
                readonly: Boolean(t.readonly),
                createdAt: t.created_at,
                config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config
            }));

            const coverTemplatesFormatted = (coverTemplates || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                is_system: t.is_system,
                readonly: Boolean(t.readonly),
                config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config,
                thumbnailPath: t.thumbnail_path,
                createdAt: t.created_at
            }));

            // 生成配置对象
            const systemTemplatesConfig = {
                version: "1.0.0",
                description: "系统内置模板配置 - 包含8套字幕模板和8套封面模板（开发模式可编辑，生产模式只读）",
                timestamp: new Date().toISOString(),
                subtitleTemplates: subtitleTemplatesFormatted,
                coverTemplates: coverTemplatesFormatted
            };

            // 确定输出路径
            const configDir = pathModule.join(__dirname, '../../config');
            const configPath = pathModule.join(configDir, 'system-templates.json');

            // 确保目录存在
            if (!fsModule.existsSync(configDir)) {
                fsModule.mkdirSync(configDir, { recursive: true });
            }

            // 保存到文件
            fsModule.writeFileSync(
                configPath,
                JSON.stringify(systemTemplatesConfig, null, 2),
                'utf-8'
            );

            Log.info(TAG, `Exported system templates to ${configPath}`, {
                subtitleCount: subtitleTemplatesFormatted.length,
                coverCount: coverTemplatesFormatted.length,
                filePath: configPath
            });

            return {
                success: true,
                filePath: configPath,
                message: `Successfully exported ${subtitleTemplatesFormatted.length} subtitle templates and ${coverTemplatesFormatted.length} cover templates`
            };

        } catch (error: any) {
            Log.error(TAG, `Export system templates failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error)
            };
        }
    }
}

export default SubtitleCoverGenerator;
