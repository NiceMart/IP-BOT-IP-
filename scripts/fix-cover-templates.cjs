#!/usr/bin/env node
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function fixCoverTemplates() {
    console.log('🔧 开始修复封面模板...\n');

    try {
        let dbPath;
        const possiblePaths = [
            path.join(__dirname, '../userData/data.db'),
            path.join(__dirname, '../data.db'),
            'C:\\aigcpanel-main\\dist-release\\win-unpacked\\data\\data\\database.db',
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
            console.error('❌ 未找到数据库文件');
            process.exit(1);
        }

        const db = new Database(dbPath);

        const correctSystemIds = [
            '485183be-6eed-4eae-b74a-8591f08b69fa',
            '6404718a-1b1c-4148-9807-ad3c57a53e0c',
            '705fa010-5bf3-4041-b624-0fd364bea5ad',
            '8f17c467-c69c-45b2-8011-94a6c3071d16',
            '1rv2nxmt9td-mkdite60',
            '4ndc1cf5lwo-mkdite61',
            'sjohrqfff7-mkdite61',
            'rxfnphz2eb-mkdite61'
        ];

        console.log('1️⃣ 查询所有模板...');
        const allTemplates = db.prepare(`
            SELECT id, name, is_system FROM cover_templates ORDER BY created_at ASC
        `).all();

        console.log(`   找到 ${allTemplates.length} 个模板\n`);

        const toFix = allTemplates.filter(t => t.is_system === 1 && !correctSystemIds.includes(t.id));

        if (toFix.length === 0) {
            console.log('✅ 数据库已正确，无需修复\n');
            db.close();
            process.exit(0);
        }

        console.log(`2️⃣ 发现 ${toFix.length} 个错误的系统模板:\n`);
        toFix.forEach(t => {
            console.log(`   ⚠️  "${t.name}" (ID: ${t.id})`);
        });

        console.log('\n3️⃣ 修复中...\n');

        toFix.forEach(template => {
            db.prepare(`UPDATE cover_templates SET is_system = 0 WHERE id = ?`).run(template.id);
            console.log(`   ✅ 已修复: "${template.name}"`);
        });

        console.log('\n4️⃣ 验证结果...');
        const systemTemplates = db.prepare(`
            SELECT id, name FROM cover_templates WHERE is_system = 1
        `).all();

        console.log(`   系统模板数量: ${systemTemplates.length}/8`);
        systemTemplates.forEach((t, i) => {
            console.log(`   ${i+1}. ${t.name}`);
        });

        console.log('\n✨ 修复完成！');
        console.log('下一步：重启应用后点击"导出全部"\n');

        db.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ 修复失败:', error.message);
        process.exit(1);
    }
}

fixCoverTemplates();
