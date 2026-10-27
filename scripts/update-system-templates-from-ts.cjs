const fs = require('fs');
const path = require('path');

// 读取 TypeScript 配置文件
const tsFilePath = path.join(__dirname, '../src/config/systemSubtitleTemplates.ts');
const jsonFilePath = path.join(__dirname, '../electron/resources/extra/common/config/system-templates.json');

console.log('读取 TypeScript 配置文件:', tsFilePath);
const tsContent = fs.readFileSync(tsFilePath, 'utf-8');

// 提取 SYSTEM_TEMPLATES 数组
const match = tsContent.match(/export const SYSTEM_TEMPLATES = (\[[\s\S]*?\]);/);
if (!match) {
    console.error('无法找到 SYSTEM_TEMPLATES 定义');
    process.exit(1);
}

// 使用 eval 解析（因为这是 TypeScript 文件，但结构是 JSON）
const templates = eval(match[1]);

console.log(`找到 ${templates.length} 个模板`);

// 读取现有的 system-templates.json
console.log('读取现有的 system-templates.json:', jsonFilePath);
const jsonContent = fs.readFileSync(jsonFilePath, 'utf-8');
const jsonData = JSON.parse(jsonContent);

// 更新字幕模板配置
console.log('更新字幕模板配置...');
jsonData.subtitleTemplates = templates.map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    createdAt: template.createdAt,
    isSystem: template.isSystem !== undefined ? template.isSystem : true,
    config: template.config
}));

// 保存更新后的配置
console.log('保存更新后的配置...');
fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');

console.log('✅ 更新完成！');
console.log(`已更新 ${jsonData.subtitleTemplates.length} 个字幕模板`);

// 验证每个模板的配置
jsonData.subtitleTemplates.forEach(t => {
    const hasTitleConfig = !!t.config.titleSubtitleConfig;
    const keywordCount = t.config.keywordGroupsStyles?.length || 0;
    console.log(`  - ${t.id} (${t.name}): keywordGroupsStyles=${keywordCount}, titleSubtitleConfig=${hasTitleConfig}`);
});















