import SubtitleCoverGenerator from "./main";
import {ipcMain} from "electron";
import {Log} from "../log/main";

let subtitleCoverGenerator: SubtitleCoverGenerator | null = null;

// 注册字幕封面生成器IPC处理程序
export const register = () => {
    // 延迟实例化,确保 AppEnv 已经初始化
    if (!subtitleCoverGenerator) {
        subtitleCoverGenerator = new SubtitleCoverGenerator();
    }

    // 生成字幕和封面
    ipcMain.handle("subtitleCover:generate", async (event, request) => {
        try {
            Log.info("SubtitleCover", `Generate request received: ${JSON.stringify(request)}`);
            const result = await subtitleCoverGenerator!.generateSubtitleAndCover(request);
            return result;
        } catch (error) {
            Log.error("SubtitleCover", `Generate failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Generation failed: ${error.message || String(error)}`
            };
        }
    });

    // 获取字幕样式列表
    ipcMain.handle("subtitleCover:getSubtitleStyles", async () => {
        try {
            return subtitleCoverGenerator!.getSubtitleStyles();
        } catch (error) {
            Log.error("SubtitleCover", `Get subtitle styles failed: ${error}`);
            return [];
        }
    });

    // 获取封面样式列表
    ipcMain.handle("subtitleCover:getCoverStyles", async () => {
        try {
            return subtitleCoverGenerator!.getCoverStyles();
        } catch (error) {
            Log.error("SubtitleCover", `Get cover styles failed: ${error}`);
            return [];
        }
    });

    // 检查Python环境
    ipcMain.handle("subtitleCover:checkEnvironment", async () => {
        try {
            Log.info("SubtitleCover", "Environment check requested");
            const result = await subtitleCoverGenerator!.checkPythonEnvironment();
            return result;
        } catch (error) {
            Log.error("SubtitleCover", `Environment check failed: ${error}`);
            return {
                pythonAvailable: false,
                scriptExists: false,
                dependenciesInstalled: false,
                message: `Environment check failed: ${error.message || String(error)}`
            };
        }
    });

    // 重新生成封面
    ipcMain.handle("subtitleCover:regenerateCover", async (event, request) => {
        try {
            Log.info("SubtitleCover", `Regenerate cover request: ${JSON.stringify(request)}`);
            const result = await subtitleCoverGenerator!.regenerateCover(request);
            return result;
        } catch (error) {
            Log.error("SubtitleCover", `Regenerate cover failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Regeneration failed: ${error.message || String(error)}`
            };
        }
    });

    // 生成实时封面预览
    ipcMain.handle("subtitleCover:generatePreviews", async (event, request) => {
        try {
            Log.info("SubtitleCover", `Generate previews request: ${JSON.stringify(request)}`);
            const result = await subtitleCoverGenerator!.generateCoverPreviews(request);
            return result;
        } catch (error) {
            Log.error("SubtitleCover", `Generate previews failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Preview generation failed: ${error.message || String(error)}`
            };
        }
    });

    // 使用自定义模板生成封面
    ipcMain.handle("subtitleCover:generateWithCustomTemplate", async (event, request) => {
        try {
            Log.info("SubtitleCover", `Generate with custom template request: ${JSON.stringify(request)}`);
            const result = await subtitleCoverGenerator!.generateWithCustomTemplate(request);
            return result;
        } catch (error) {
            Log.error("SubtitleCover", `Generate with custom template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Custom template generation failed: ${error.message || String(error)}`
            };
        }
    });

    // ======================== 系统模板编辑 API (开发模式) ========================

    // 获取系统模板列表
    ipcMain.handle("systemTemplates:getList", async (event) => {
        try {
            Log.info("SystemTemplates", "Get system templates list requested");
            const result = await subtitleCoverGenerator!.getSystemTemplatesList();
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Get system templates list failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to get system templates list: ${error.message || String(error)}`
            };
        }
    });

    // 保存/编辑系统模板（仅在开发模式）
    ipcMain.handle("systemTemplates:save", async (event, template, isDev) => {
        try {
            if (!isDev) {
                throw new Error("System templates can only be edited in development mode");
            }
            Log.info("SystemTemplates", `Save system template: ${template.id}`);
            const result = await subtitleCoverGenerator!.saveSystemTemplate(template);
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Save system template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to save system template: ${error.message || String(error)}`
            };
        }
    });

    // 删除系统模板（仅在开发模式，且不能删除系统模板）
    ipcMain.handle("systemTemplates:delete", async (event, templateId, isDev) => {
        try {
            if (!isDev) {
                throw new Error("System templates cannot be deleted in production mode");
            }
            Log.info("SystemTemplates", `Delete system template: ${templateId}`);
            const result = await subtitleCoverGenerator!.deleteSystemTemplate(templateId);
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Delete system template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to delete system template: ${error.message || String(error)}`
            };
        }
    });

    // 重置系统模板为默认值（仅在开发模式）
    ipcMain.handle("systemTemplates:reset", async (event, isDev) => {
        try {
            if (!isDev) {
                throw new Error("System templates can only be reset in development mode");
            }
            Log.info("SystemTemplates", "Reset system templates to defaults");
            const result = await subtitleCoverGenerator!.resetSystemTemplates();
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Reset system templates failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to reset system templates: ${error.message || String(error)}`
            };
        }
    });

    // 导出系统模板配置到 JSON 文件（仅在开发模式）
    ipcMain.handle("systemTemplates:export", async (event, isDev) => {
        try {
            if (!isDev) {
                throw new Error("System templates can only be exported in development mode");
            }
            Log.info("SystemTemplates", "Export system templates configuration");
            const result = await subtitleCoverGenerator!.exportSystemTemplatesToFile();
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Export system templates failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to export system templates: ${error.message || String(error)}`
            };
        }
    });

    // ✨ 新增：保存字幕模板并自动导出（开发模式）
    ipcMain.handle("systemTemplates:saveSubtitleAndExport", async (event, template, isDev) => {
        try {
            if (!isDev) {
                throw new Error("Can only save and export in development mode");
            }
            Log.info("SystemTemplates", `Save subtitle template and export: ${template.id}`);
            const result = await subtitleCoverGenerator!.saveSubtitleTemplateAndExport(template, isDev);
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Save and export subtitle template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to save and export: ${error.message || String(error)}`
            };
        }
    });

    // ✨ 新增：保存封面模板并自动导出（开发模式）
    ipcMain.handle("systemTemplates:saveCoverAndExport", async (event, template, isDev) => {
        try {
            if (!isDev) {
                throw new Error("Can only save and export in development mode");
            }
            Log.info("SystemTemplates", `Save cover template and export: ${template.id}`);
            const result = await subtitleCoverGenerator!.saveCoverTemplateAndExport(template, isDev);
            return result;
        } catch (error) {
            Log.error("SystemTemplates", `Save and export cover template failed: ${error}`);
            return {
                success: false,
                error: error.message || String(error),
                message: `Failed to save and export: ${error.message || String(error)}`
            };
        }
    });

    Log.info("SubtitleCover", "SubtitleCover module initialized");
};