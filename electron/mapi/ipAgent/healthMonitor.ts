/**
 * 健康监控服务 - 防止用户机器卡死
 * 自动检测GPU、进程、超时，并自动恢复
 */

import { execSync } from 'child_process';
import { app } from 'electron';
import path from 'path';

interface HealthStatus {
  gpuMemoryUsage: number;  // GPU显存使用率 0-100
  chromiumProcessCount: number;  // Chromium进程数
  pythonProcessCount: number;  // Python进程数
  isHealthy: boolean;
  warnings: string[];
}

class HealthMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  /**
   * 启动健康监控（每30秒检查一次）
   */
  startMonitoring(intervalSeconds: number = 30) {
    if (this.isMonitoring) {
      console.log('[健康监控] 已在运行');
      return;
    }

    console.log(`[健康监控] 启动监控，间隔${intervalSeconds}秒`);
    this.isMonitoring = true;

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalSeconds * 1000);

    // 立即执行一次检查
    this.performHealthCheck();
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isMonitoring = false;
      console.log('[健康监控] 已停止');
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck() {
    try {
      const status = await this.getHealthStatus();

      console.log('[健康监控] 状态:', {
        GPU显存: `${status.gpuMemoryUsage}%`,
        Chromium进程: status.chromiumProcessCount,
        Python进程: status.pythonProcessCount,
        健康: status.isHealthy
      });

      // 如果不健康，执行自动修复
      if (!status.isHealthy) {
        console.warn('[健康监控] 检测到异常，开始自动修复...');
        await this.autoRepair(status);
      }
    } catch (error) {
      console.error('[健康监控] 检查失败:', error);
    }
  }

  /**
   * 获取系统健康状态
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      gpuMemoryUsage: 0,
      chromiumProcessCount: 0,
      pythonProcessCount: 0,
      isHealthy: true,
      warnings: []
    };

    try {
      // 检查GPU显存
      try {
        const gpuResult = execSync(
          'nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits',
          { encoding: 'utf-8', timeout: 5000 }
        );

        const lines = gpuResult.trim().split('\n');
        if (lines.length > 0) {
          const [used, total] = lines[0].split(',').map(s => parseFloat(s.trim()));
          status.gpuMemoryUsage = Math.round((used / total) * 100);

          // GPU显存 > 85% 警告
          if (status.gpuMemoryUsage > 85) {
            status.isHealthy = false;
            status.warnings.push(`GPU显存占用过高: ${status.gpuMemoryUsage}%`);
          }
        }
      } catch (e) {
        // nvidia-smi不可用，跳过GPU检查
      }

      // 检查Chromium进程数量
      try {
        const cmd = process.platform === 'win32'
          ? 'tasklist | findstr /I "chromium.exe chrome.exe"'
          : 'pgrep -c "chromium|chrome" || true';
        const chromiumResult = execSync(cmd, { encoding: 'utf-8', timeout: 3000 });
        if (process.platform === 'win32') {
          status.chromiumProcessCount = chromiumResult.split('\n').filter(line => line.trim()).length;
        } else {
          status.chromiumProcessCount = parseInt(chromiumResult.trim()) || 0;
        }

        // Chromium进程 > 10 个警告
        if (status.chromiumProcessCount > 10) {
          status.isHealthy = false;
          status.warnings.push(`Chromium进程过多: ${status.chromiumProcessCount}个`);
        }
      } catch (e) {
        // 没有Chromium进程
        status.chromiumProcessCount = 0;
      }

      // 检查Python进程数量
      try {
        const pythonCmd = process.platform === 'win32'
          ? 'tasklist | findstr /I "python.exe"'
          : 'pgrep -c "python" || true';
        const pythonResult = execSync(pythonCmd, { encoding: 'utf-8', timeout: 3000 });
        if (process.platform === 'win32') {
          status.pythonProcessCount = pythonResult.split('\n').filter(line => line.trim()).length;
        } else {
          status.pythonProcessCount = parseInt(pythonResult.trim()) || 0;
        }

        // Python进程 > 5 个警告（正常应该1-2个）
        if (status.pythonProcessCount > 5) {
          status.isHealthy = false;
          status.warnings.push(`Python进程过多: ${status.pythonProcessCount}个`);
        }
      } catch (e) {
        status.pythonProcessCount = 0;
      }

    } catch (error) {
      console.error('[健康监控] 状态获取失败:', error);
    }

    return status;
  }

  /**
   * 自动修复
   */
  private async autoRepair(status: HealthStatus) {
    const repairs: string[] = [];
    console.log('[HealthMonitor] autoRepair disabled');
    return;

    try {
      // 修复1: GPU显存过高 → 清理GPU缓存
      if (status.gpuMemoryUsage > 85) {
        console.log('[自动修复] GPU显存占用过高，执行清理...');
        try {
          const scriptPath = path.join(app.getAppPath(), '..', 'scripts', 'cleanup_gpu.py');
          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
          execSync(`${pythonCmd} "${scriptPath}"`, { timeout: 10000 });
          repairs.push('GPU显存已清理');
        } catch (e) {
          console.error('[自动修复] GPU清理失败:', e);
        }
      }

      // 修复2: Chromium进程过多 → 强制关闭
      if (status.chromiumProcessCount > 10) {
        console.log('[自动修复] Chromium进程过多，强制关闭...');
        try {
          const killCmd = process.platform === 'win32'
            ? 'taskkill /F /IM chromium.exe /IM chrome.exe 2>nul'
            : 'pkill -f "chromium|chrome" 2>/dev/null || true';
          execSync(killCmd, { timeout: 5000 });
          repairs.push(`已关闭${status.chromiumProcessCount}个Chromium进程`);
        } catch (e) {
          // 忽略错误（可能没有进程可杀）
        }
      }

      // 修复3: Python进程过多 → 警告（不自动杀，可能影响正在运行的任务）
      if (status.pythonProcessCount > 5) {
        console.warn('[自动修复] Python进程过多，建议用户重启应用');
        repairs.push('检测到多个Python进程，建议重启应用');
      }

      if (repairs.length > 0) {
        console.log('[自动修复] 修复完成:', repairs.join('; '));
      }

    } catch (error) {
      console.error('[自动修复] 修复失败:', error);
    }
  }

  /**
   * 手动清理所有资源（用户点击"清理"按钮时调用）
   */
  async manualCleanup(): Promise<{ success: boolean; message: string }> {
    console.log('[手动清理] 开始清理所有资源...');
    const results: string[] = [];
    console.log('[HealthMonitor] manualCleanup disabled');
    return {
      success: true,
      message: 'disabled'
    };

    try {
      // 1. 清理GPU
      try {
        const scriptPath = path.join(app.getAppPath(), '..', 'scripts', 'cleanup_gpu.py');
        execSync(`python "${scriptPath}" --force`, { timeout: 15000 });
        results.push('✓ GPU清理完成');
      } catch (e) {
        results.push('✗ GPU清理失败');
      }

      // 2. 关闭Chromium
      try {
        const killCmd = process.platform === 'win32'
          ? 'taskkill /F /IM chromium.exe /IM chrome.exe 2>nul'
          : 'pkill -f "chromium|chrome" 2>/dev/null || true';
        execSync(killCmd, { timeout: 5000 });
        results.push('✓ 浏览器进程已关闭');
      } catch (e) {
        results.push('✓ 无需关闭浏览器进程');
      }

      // 3. 清理临时文件（可选）
      // ...

      return {
        success: true,
        message: results.join('\n')
      };

    } catch (error) {
      return {
        success: false,
        message: '清理失败: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
}

// 单例模式
let instance: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!instance) {
    instance = new HealthMonitor();
  }
  return instance;
}

export { HealthMonitor, HealthStatus };
