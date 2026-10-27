/**
 * 进一步缩小标题字幕的字体大小
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../electron/resources/extra/common/config/system-templates.json');

console.log('📖 读取配置文件:', configPath);

// 读取配置文件
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

console.log(`✅ 找到 ${config.subtitleTemplates.length} 个字幕模板\n`);

// 标题字幕缩放比例（在当前基础上再缩小）
const TITLE_SCALE_RATIO = 0.75; // 缩小到当前的 75%

let totalChanges = 0;

// 遍历所有字幕模板
config.subtitleTemplates.forEach((template, index) => {
  console.log(`\n📝 处理模板 ${index + 1}: ${template.name}`);

  const cfg = template.config;
  let changes = 0;

  // 只调整标题字幕的字体大小
  if (cfg.titleSubtitleConfig && cfg.titleSubtitleConfig.lines) {
    cfg.titleSubtitleConfig.lines.forEach((line, lineIndex) => {
      if (line.fontSize) {
        const oldSize = line.fontSize;
        const newSize = Math.round(oldSize * TITLE_SCALE_RATIO);
        line.fontSize = newSize;
        console.log(`  - 标题行 ${lineIndex + 1}: ${oldSize} → ${newSize}`);
        changes++;
      }

      // 同时调整描边宽度
      if (line.outlineWidth) {
        const oldWidth = line.outlineWidth;
        const newWidth = Math.max(1, Math.round(oldWidth * TITLE_SCALE_RATIO));
        line.outlineWidth = newWidth;
        console.log(`  - 标题行 ${lineIndex + 1} 描边: ${oldWidth} → ${newWidth}`);
        changes++;
      }
    });
  }

  if (changes > 0) {
    console.log(`  ✅ 共修改 ${changes} 处`);
  } else {
    console.log(`  ⏭️  无标题字幕需要调整`);
  }
  totalChanges += changes;
});

// 备份原文件
const backupPath = configPath + '.backup-title-' + Date.now();
fs.copyFileSync(configPath, backupPath);
console.log(`\n💾 已备份原文件到: ${backupPath}`);

// 保存修改后的配置
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
console.log(`\n✅ 已保存修改后的配置文件`);
console.log(`📊 总共修改了 ${totalChanges} 处标题字幕大小和描边宽度`);
console.log(`📏 缩放比例: ${TITLE_SCALE_RATIO * 100}%`);

console.log('\n📐 调整后的标题字幕大小范围:');
console.log('  - 约 37-53px（原来是 49-70px）');

console.log('\n🎯 下一步操作:');
console.log('1. 重启应用，系统会自动同步新的字体大小到数据库');
console.log('2. 如果还是太大，可以修改脚本中的 TITLE_SCALE_RATIO 参数再次运行');
console.log('3. 如果需要恢复，可以从备份文件恢复');
