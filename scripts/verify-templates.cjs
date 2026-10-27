const fs = require('fs');
const path = require('path');

const jsonFilePath = path.join(__dirname, '../electron/resources/extra/common/config/system-templates.json');
const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

console.log('验证字幕模板配置:\n');
data.subtitleTemplates.forEach(t => {
    const title = t.config.titleSubtitleConfig?.sourceTitle || '无标题';
    const keywordCount = t.config.keywordGroupsStyles?.length || 0;
    const hasTitleConfig = !!t.config.titleSubtitleConfig;
    console.log(`${t.id} (${t.name}):`);
    console.log(`  标题: ${title.substring(0, 30)}`);
    console.log(`  关键词组: ${keywordCount}`);
    console.log(`  标题配置: ${hasTitleConfig ? '有' : '无'}`);
    console.log('');
});















