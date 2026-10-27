import { ipcMain } from "electron";
import DBMain from "../db/main";

// 获取当前样式（兼容旧代码，使用默认ID）
const getCurrentStyle = async (styleId?: string): Promise<any> => {
    try {
        console.log('[style:getCurrentStyle] IPC 处理器被调用', { styleId: styleId || 'current' });

        // 检查数据库是否初始化
        if (!DBMain) {
            console.error('[style:getCurrentStyle] ❌ DBMain 未定义');
            return null;
        }

        // 如果未提供 styleId，使用默认值 'current'
        const id = styleId || 'current';

        console.log('[style:getCurrentStyle] 准备执行数据库查询...', { id });
        const result = await DBMain.first(
            `SELECT * FROM subtitle_styles WHERE id = ?`,
            [id]
        );

        console.log('[style:getCurrentStyle] 数据库查询完成，返回结果:', result);

        if (!result) {
            console.log('[style:getCurrentStyle] ⚠️ 未找到样式 (id=' + id + ')，返回 null');
            return null;
        }

        // 解析 JSON 字段（如果需要）
        const style = {
            ...result,
            // 其他字段已是标量类型，无需解析
        };

        console.log('[style:getCurrentStyle] ✅ 返回最终结果:', style);
        return style;
    } catch (error) {
        console.error('[style:getCurrentStyle] ❌ 异常:', {
            message: error?.message,
            stack: error?.stack
        });
        return null;
    }
};

// 新增：按ID获取样式（支持多个样式记录）
const getStyleById = async (styleId: string): Promise<any> => {
    try {
        console.log('[style:getStyleById] 按ID获取样式:', { styleId });

        if (!DBMain) {
            console.error('[style:getStyleById] ❌ DBMain 未定义');
            return null;
        }

        if (!styleId) {
            console.error('[style:getStyleById] ❌ styleId 为空');
            return null;
        }

        const result = await DBMain.first(
            `SELECT * FROM subtitle_styles WHERE id = ?`,
            [styleId]
        );

        if (!result) {
            console.log('[style:getStyleById] ⚠️ 未找到样式 (id=' + styleId + ')，返回 null');
            return null;
        }

        console.log('[style:getStyleById] ✅ 找到样式:', result);
        return result;
    } catch (error) {
        console.error('[style:getStyleById] ❌ 异常:', {
            message: error?.message,
            stack: error?.stack
        });
        return null;
    }
};

// 保存样式（支持多个样式记录）
const saveStyle = async (style: any, styleId?: string): Promise<{ success: boolean; id?: string; message?: string }> => {
    try {
        const now = Date.now();
        // 使用提供的 styleId，或者默认为 'current'
        const id = styleId || style?.id || 'current';

        console.log('[style:saveStyle] 开始保存样式', { id, styleName: style?.name });

        // 检查数据库是否初始化
        if (!DBMain) {
            console.error('[style:saveStyle] ❌ DBMain 未定义');
            return { success: false, message: 'DBMain 未定义' };
        }

        const existingStyle = await DBMain.first(
            `SELECT id FROM subtitle_styles WHERE id = ?`,
            [id]
        );

        if (existingStyle) {
            // 更新现有样式
            console.log('[style:saveStyle] 更新现有样式:', id);
            await DBMain.update(
                `UPDATE subtitle_styles
                 SET name = ?, description = ?, fontName = ?, fontSize = ?, fontColor = ?,
                     outlineColor = ?, outlineWidth = ?, shadowOffset = ?, backgroundColor = ?,
                     backgroundOpacity = ?, position = ?, alignment = ?, updatedAt = ?
                 WHERE id = ?`,
                [
                    style.name,
                    style.description,
                    style.fontName,
                    style.fontSize,
                    style.fontColor,
                    style.outlineColor,
                    style.outlineWidth,
                    style.shadowOffset,
                    style.backgroundColor,
                    style.backgroundOpacity,
                    style.position,
                    style.alignment,
                    now,
                    id
                ]
            );
            console.log('[style:saveStyle] ✅ 已更新现有样式:', id);
        } else {
            // 插入新样式
            console.log('[style:saveStyle] 插入新样式:', id);
            await DBMain.insert(
                `INSERT INTO subtitle_styles
                 (id, name, description, fontName, fontSize, fontColor, outlineColor, outlineWidth,
                  shadowOffset, backgroundColor, backgroundOpacity, position, alignment, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    style.name,
                    style.description,
                    style.fontName,
                    style.fontSize,
                    style.fontColor,
                    style.outlineColor,
                    style.outlineWidth,
                    style.shadowOffset,
                    style.backgroundColor,
                    style.backgroundOpacity,
                    style.position,
                    style.alignment,
                    now,
                    now
                ]
            );
            console.log('[style:saveStyle] ✅ 已插入新样式:', id);
        }

        return { success: true, id: id };
    } catch (error) {
        console.error('[style:saveStyle] ❌ 保存失败:', {
            errorMessage: error?.message,
            errorStack: error?.stack,
            fullError: error
        });
        return { success: false, message: '保存样式失败: ' + (error?.message || '未知错误') };
    }
};

// 删除样式
const deleteStyle = async (styleId: string): Promise<{ success: boolean; message?: string }> => {
    try {
        // 检查是否为系统样式
        let style;
        try {
            style = await DBMain.first(
                `SELECT is_system FROM subtitle_styles WHERE id = ?`,
                [styleId]
            );
        } catch (columnError) {
            // 如果 is_system 列不存在，则不是系统样式，允许删除
            console.warn('[style:deleteStyle] is_system 列不存在，跳过系统样式检查');
            style = null;
        }

        if (style && style.is_system === 1) {
            console.warn('[style:deleteStyle] ⚠️ 尝试删除系统样式:', styleId);
            return { success: false, message: '系统默认样式不能删除' };
        }

        await DBMain.delete(
            `DELETE FROM subtitle_styles WHERE id = ?`,
            [styleId]
        );
        console.log('[style:deleteStyle] ✅ 样式已删除:', styleId);
        return { success: true };
    } catch (error) {
        console.error('[style:deleteStyle] ❌ 删除失败:', error);
        return { success: false, message: '删除样式失败' };
    }
};

// 注册IPC处理程序
const registerIpcHandlers = () => {
    console.log('[style:registerIpcHandlers] 开始注册字幕样式 IPC 处理器...');

    // 获取当前样式（支持可选的styleId参数）
    ipcMain.handle("style:getCurrentStyle", async (event, styleId?: string) => {
        console.log('[style:IPC:getCurrentStyle] 处理器被触发', { styleId });
        return await getCurrentStyle(styleId);
    });

    console.log('[style:registerIpcHandlers] ✓ 已注册 style:getCurrentStyle');

    // 按ID获取样式（新增）
    ipcMain.handle("style:getStyleById", async (event, styleId: string) => {
        console.log('[style:IPC:getStyleById] 处理器被触发，styleId:', styleId);
        return await getStyleById(styleId);
    });

    console.log('[style:registerIpcHandlers] ✓ 已注册 style:getStyleById');

    // 保存样式（支持可选的styleId参数）
    ipcMain.handle("style:saveStyle", async (event, style: any, styleId?: string) => {
        console.log('[style:IPC:saveStyle] 处理器被触发', { providedStyleId: styleId, styleObjectId: style?.id });
        return await saveStyle(style, styleId);
    });

    console.log('[style:registerIpcHandlers] ✓ 已注册 style:saveStyle');

    // 删除样式
    ipcMain.handle("style:deleteStyle", async (event, styleId: string) => {
        console.log('[style:IPC:deleteStyle] 处理器被触发，styleId:', styleId);
        return await deleteStyle(styleId);
    });

    console.log('[style:registerIpcHandlers] ✓ 已注册 style:deleteStyle');
    console.log('[style:registerIpcHandlers] ===================== 所有 IPC 处理器注册完成 =====================');
};

export default {
    getCurrentStyle,
    getStyleById,
    saveStyle,
    deleteStyle,
    registerIpcHandlers
};
