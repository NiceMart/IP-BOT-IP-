const fs = require('fs');

const content = fs.readFileSync('electron/resources/extra/common/config/system-templates.json', 'utf-8');
const data = JSON.parse(content);

console.log('模板数量:', data.subtitleTemplates.length);
console.log('');

data.subtitleTemplates.forEach(t => {
  const hasTitle = !!(t.config && t.config.titleSubtitleConfig);
  console.log(`模板 ${t.name}: ${hasTitle ? '有标题配置' : '无标题配置'}`);
  if (hasTitle) {
    const title = t.config.titleSubtitleConfig;
    console.log(`  - ${title.maxCharsPerLine}字符/行, ${title.lines.length}行`);
  }
});














