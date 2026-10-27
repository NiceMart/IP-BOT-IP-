/**
 * 批量缩小字幕模板的字体大小
 * 包括：标题字幕和关键词字幕
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../electron/resources/extra/common/config/system-templates.json');

console.log('📖 读取配置文件:', configPath);

// 读取配置文件
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

console.log(`✅ 找到 ${config.subtitleTemplates.length} 个字幕模板\n`);

// 字体缩放比例
const SCALE_RATIO = 0.7; // 缩小到原来的 70%

let totalChanges = 0;

// 遍历所有字幕模板
config.subtitleTemplates.forEach((template, index) => {
  console.log(`\n📝 处理模板 ${index + 1}: ${template.name}`);

  const cfg = template.config;
  let changes = 0;

  // 1. 调整基础字幕样式的字体大小
  if (cfg.subtitleStyle && cfg.subtitleStyle.fontSize) {
    const oldSize = cfg.subtitleStyle.fontSize;
    const newSize = Math.round(oldSize * SCALE_RATIO);
    cfg.subtitleStyle.fontSize = newSize;
    console.log(`  - 基础字幕: ${oldSize} → ${newSize}`);
    changes++;
  }

  // 2. 调整标题字幕的字体大小
  if (cfg.titleSubtitleConfig && cfg.titleSubtitleConfig.lines) {
    cfg.titleSubtitleConfig.lines.forEach((line, lineIndex) => {
      if (line.fontSize) {
        const oldSize = line.fontSize;
        const newSize = Math.round(oldSize * SCALE_RATIO);
        line.fontSize = newSize;
        console.log(`  - 标题行 ${lineIndex + 1}: ${oldSize} → ${newSize}`);
        changes++;
      }
    });
  }

  // 3. 调整关键词字幕的字体大小
  if (cfg.keywordGroupsStyles) {
    cfg.keywordGroupsStyles.forEach((group) => {
      if (group.styleOverride && group.styleOverride.fontSize) {
        const oldSize = group.styleOverride.fontSize;
        const newSize = Math.round(oldSize * SCALE_RATIO);
        group.styleOverride.fontSize = newSize;
        console.log(`  - 关键词"${group.groupName}": ${oldSize} → ${newSize}`);
        changes++;
      }
    });
  }

  // 4. 调整描边宽度（字体变小后，描边也应该相应变细）
  if (cfg.subtitleStyle && cfg.subtitleStyle.outlineWidth) {
    const oldWidth = cfg.subtitleStyle.outlineWidth;
    const newWidth = Math.max(1, Math.round(oldWidth * SCALE_RATIO));
    cfg.subtitleStyle.outlineWidth = newWidth;
    console.log(`  - 基础描边: ${oldWidth} → ${newWidth}`);
    changes++;
  }

  if (cfg.titleSubtitleConfig && cfg.titleSubtitleConfig.lines) {
    cfg.titleSubtitleConfig.lines.forEach((line, lineIndex) => {
      if (line.outlineWidth) {
        const oldWidth = line.outlineWidth;
        const newWidth = Math.max(1, Math.round(oldWidth * SCALE_RATIO));
        line.outlineWidth = newWidth;
        console.log(`  - 标题行 ${lineIndex + 1} 描边: ${oldWidth} → ${newWidth}`);
        changes++;
      }
    });
  }

  if (cfg.keywordGroupsStyles) {
    cfg.keywordGroupsStyles.forEach((group) => {
      if (group.styleOverride && group.styleOverride.outlineWidth) {
        const oldWidth = group.styleOverride.outlineWidth;
        const newWidth = Math.max(1, Math.round(oldWidth * SCALE_RATIO));
        group.styleOverride.outlineWidth = newWidth;
        console.log(`  - 关键词"${group.groupName}" 描边: ${oldWidth} → ${newWidth}`);
        changes++;
      }
    });
  }

  console.log(`  ✅ 共修改 ${changes} 处`);
  totalChanges += changes;
});

// 备份原文件
const backupPath = configPath + '.backup-' + Date.now();
fs.copyFileSync(configPath, backupPath);
console.log(`\n💾 已备份原文件到: ${backupPath}`);

// 保存修改后的配置
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
console.log(`\n✅ 已保存修改后的配置文件`);
console.log(`📊 总共修改了 ${totalChanges} 处字体大小和描边宽度`);
console.log(`📏 缩放比例: ${SCALE_RATIO * 100}%`);

console.log('\n🎯 下一步操作:');
console.log('1. 重启应用，系统会自动同步新的字体大小到数据库');
console.log('2. 如果需要恢复，可以从备份文件恢复');
