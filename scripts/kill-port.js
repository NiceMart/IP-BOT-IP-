/**
 * 杀死占用特定端口的进程
 * 使用方式: node kill-port.js 5173
 */

import { exec } from 'child_process';
import { platform } from 'os';

const port = process.argv[2] || 5173;

function killPort(port) {
  return new Promise((resolve, reject) => {
    if (platform() === 'win32') {
      // Windows 系统
      exec(`netstat -ano | findstr :${port}`, (error, stdout, stderr) => {
        if (stdout) {
          const lines = stdout.trim().split('\n');
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== 'PID') {
              exec(`taskkill /PID ${pid} /F`, (err) => {
                if (!err) {
                  console.log(`✅ 已杀死进程 PID ${pid}`);
                }
              });
            }
          });
        }
        setTimeout(resolve, 1000);
      });
    } else {
      // macOS/Linux 系统
      exec(`lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`, (error) => {
        if (!error || error.code === 1) {
          // 即使出错也继续（可能是没有找到进程）
          console.log(`✅ 端口 ${port} 已检查`);
        }
        resolve();
      });
    }
  });
}

console.log(`🔍 正在检查端口 ${port}...`);
killPort(port)
  .then(() => {
    console.log(`✅ 准备启动应用...`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`⚠️ 错误:`, err);
    process.exit(0); // 即使出错也继续启动
  });
