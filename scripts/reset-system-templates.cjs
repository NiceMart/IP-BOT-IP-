/**
 * 清空数据库中的系统模板，让应用重新从配置文件初始化
 * 使用方法：node scripts/reset-system-templates.cjs
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('========================================');
console.log('清空系统模板数据库工具');
console.log('========================================\n');

// 查找数据库文件
const possiblePaths = [
  // 开发环境
  path.join(__dirname, '../database.db'),
  path.join(__dirname, '../dist-release/win-unpacked/data/data/database.db'),
  // 用户数据目录
  path.join(os.homedir(), 'AppData', 'Roaming', 'aigcpanel', 'database.db'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Electron', 'database.db'),
];

console.log('搜索数据库文件...\n');
let dbPath = null;
for (const tryPath of possiblePaths) {
  console.log('尝试路径:', tryPath);
  if (fs.existsSync(tryPath)) {
    dbPath = tryPath;
    console.log('✅ 找到数据库文件!\n');
    break;
  }
}

if (!dbPath) {
  console.error('❌ 未找到数据库文件！');
  console.error('\n请手动删除以下位置的 database.db 文件：');
  possiblePaths.forEach(p => console.error('  - ' + p));
  console.error('\n或提供数据库文件的完整路径作为参数：');
  console.error('  node scripts/reset-system-templates.cjs <数据库路径>');
  process.exit(1);
}

console.log('找到数据库:', dbPath);
console.log('\n========================================');
console.log('选项1（推荐）：直接删除数据库文件');
console.log('========================================');
console.log('');
console.log('最简单的方法是直接删除数据库文件：');
console.log(`  rm "${dbPath}"`);
console.log('');
console.log('然后重启应用，它会重新创建数据库并从配置文件初始化。');
console.log('');
console.log('========================================');
console.log('选项2：使用 SQLite 命令行工具');
console.log('========================================');
console.log('');
console.log('如果你安装了 SQLite，可以运行：');
console.log(`  sqlite3 "${dbPath}" "DELETE FROM subtitle_templates WHERE is_system = 1;"`);
console.log(`  sqlite3 "${dbPath}" "DELETE FROM cover_templates WHERE is_system = 1;"`);
console.log(`  sqlite3 "${dbPath}" "DELETE FROM subtitle_styles WHERE is_system = 1;"`);
console.log('');
console.log('然后重启应用。');
console.log('');
console.log('========================================\n');

// 询问用户是否要自动删除
console.log('是否要自动删除数据库文件？(y/n)');
console.log('注意：这会清空所有数据，包括用户创建的模板！');
console.log('建议先备份数据库文件。\n');

// 由于这是自动化脚本，我们只提供信息，不自动执行删除
console.log('💡 建议步骤：');
console.log('1. 关闭应用');
console.log('2. 备份数据库文件（可选）');
console.log(`3. 删除文件: ${dbPath}`);
console.log('4. 重启应用');
console.log('5. 应用会自动从配置文件初始化8个正确的模板\n');
