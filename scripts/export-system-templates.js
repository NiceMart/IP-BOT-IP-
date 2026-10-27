#!/usr/bin/env node
/**
 * 导出系统模板配置脚本
 * 从数据库导出所有系统模板配置到 system-templates.json
 *
 * 使用方法:
 *   node scripts/export-system-templates.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function exportSystemTemplates() {
    console.log('📦 开始导出系统模板配置...\n');

    try {
        // 确定数据库路径
        let dbPath;
        const possiblePaths = [
            path.join(__dirname, '../userData/data.db'),
            path.join(__dirname, '../data.db'),
            path.join(process.env.APPDATA || process.env.HOME, 'zhenqianba/data.db'),
        ];

        for (const tryPath of possiblePaths) {
            if (fs.existsSync(tryPath)) {
                dbPath = tryPath;
                console.log(`✅ 找到数据库: ${dbPath}\n`);
                break;
            }
        }

        if (!dbPath) {
            console.error('❌ 未找到数据库文件，请确保应用已启动过一次');
            console.error('尝试的路径:', possiblePaths);
            process.exit(1);
        }

        // 打开数据库
        const db = new Database(dbPath, { readonly: true });

        // 导出字幕模板
        console.log('1️⃣ 导出字幕模板...');
        const subtitleTemplates = db.prepare(`
            SELECT id, name, description, config, is_system, readonly, created_at, updated_at
            FROM subtitle_templates
            WHERE is_system = 1
            ORDER BY created_at ASC
        `).all();

        const subtitleTemplatesFormatted = subtitleTemplates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            isSystem: Boolean(t.is_system),
            readonly: Boolean(t.readonly),
            createdAt: t.created_at,
            config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config
        }));

        console.log(`   ✅ 导出 ${subtitleTemplatesFormatted.length} 个字幕模板`);

        // 导出封面模板
        console.log('\n2️⃣ 导出封面模板...');
        const coverTemplates = db.prepare(`
            SELECT id, name, description, config, thumbnail_path, is_system, readonly, created_at, updated_at
            FROM cover_templates
            WHERE is_system = 1
            ORDER BY created_at ASC
        `).all();

        const coverTemplatesFormatted = coverTemplates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            is_system: t.is_system,
            readonly: Boolean(t.readonly),
            config: typeof t.config === 'string' ? JSON.parse(t.config) : t.config,
            thumbnailPath: t.thumbnail_path,
            createdAt: t.created_at
        }));

        console.log(`   ✅ 导出 ${coverTemplatesFormatted.length} 个封面模板`);

        // 生成配置对象
        const systemTemplatesConfig = {
            version: "1.0.0",
            description: "系统内置模板配置 - 包含8套字幕模板和8套封面模板（开发模式可编辑，生产模式只读）",
            timestamp: new Date().toISOString(),
            subtitleTemplates: subtitleTemplatesFormatted,
            coverTemplates: coverTemplatesFormatted
        };

        // 保存到文件
        const configPath = path.join(__dirname, '../electron/config/system-templates.json');
        fs.writeFileSync(
            configPath,
            JSON.stringify(systemTemplatesConfig, null, 2),
            'utf-8'
        );

        console.log(`\n✅ 配置已保存到: ${configPath}`);
        console.log(`   - 字幕模板: ${subtitleTemplatesFormatted.length} 套`);
        console.log(`   - 封面模板: ${coverTemplatesFormatted.length} 套`);
        console.log(`   - 文件大小: ${(fs.statSync(configPath).size / 1024).toFixed(2)} KB`);

        db.close();
        console.log('\n✨ 导出完成！');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 导出失败:', error.message);
        console.error(error);
        process.exit(1);
    }
}

exportSystemTemplates();
