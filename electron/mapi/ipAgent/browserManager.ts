/**
 * 浏览器管理器 - 单例模式管理浏览器实例
 * 避免重复初始化和过早关闭问题
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { getPlaywrightChromiumPath, COMMON_BROWSER_ARGS, BROWSER_IGNORE_DEFAULT_ARGS, STEALTH_INIT_SCRIPT } from '../../lib/browser-path';
import { getRuntimeDataPath } from '../../lib/resource-path';

export interface BrowserManager {
  getInstance(): BrowserManager;
  initBrowser(): Promise<void>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
  isInitialized(): boolean;
}

class DouyinBrowserManager implements BrowserManager {
  private static instance: DouyinBrowserManager;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isInitializing: boolean = false;
  private userDataPath: string;

  private constructor() {
    this.userDataPath = getRuntimeDataPath('browser-data', 'douyin');
  }

  /**
   * 获取浏览器可执行文件路径（使用统一工具）
   */
  private getChromiumExecutablePath(): string | undefined {
    return getPlaywrightChromiumPath();
  }

  public static getInstance(): DouyinBrowserManager {
    if (!DouyinBrowserManager.instance) {
      DouyinBrowserManager.instance = new DouyinBrowserManager();
    }
    return DouyinBrowserManager.instance;
  }

  public async initBrowser(): Promise<void> {
    if (this.isInitializing) {
      console.log('浏览器正在初始化中，等待完成...');
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return;
    }

    if (this.context) {
      console.log('浏览器已初始化，直接返回');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('开始初始化浏览器实例...');

      const executablePath = this.getChromiumExecutablePath();
      if (executablePath) {
        console.log('✅ [Browser] 使用可用浏览器:', executablePath);
        try {
          fs.accessSync(executablePath, fs.constants.R_OK);
          console.log('✅ [Browser] 浏览器文件可读');
        } catch (e) {
          console.error('❌ [Browser] 浏览器文件不可访问:', executablePath, e);
        }
      } else {
        console.log('⚠️ [Browser] 未找到可用浏览器，将尝试 Playwright 默认浏览器');
      }

      // === 阶段1：正常启动 ===
      try {
        console.log('[阶段1] 使用现有用户数据目录启动:', this.userDataPath);
        await this.launchBrowserContext(executablePath, this.userDataPath);
        console.log('✅ [阶段1] 浏览器启动成功');
        return;
      } catch (error1) {
        const errMsg1 = error1 instanceof Error ? error1.message : String(error1);
        console.error('❌ [阶段1] 启动失败:', errMsg1);

        // === 阶段2：清理锁文件后重试 ===
        try {
          console.log('[阶段2] 清理锁文件后重试...');
          this.cleanupBrowserLocks(this.userDataPath);
          await this.launchBrowserContext(executablePath, this.userDataPath);
          console.log('✅ [阶段2] 浏览器启动成功（清理锁文件后）');
          return;
        } catch (error2) {
          const errMsg2 = error2 instanceof Error ? error2.message : String(error2);
          console.error('❌ [阶段2] 启动失败:', errMsg2);

          // === 阶段3：使用全新临时目录 ===
          try {
            const tempDataPath = getRuntimeDataPath('temp', `douyin-browser-${Date.now()}`);
            console.log('[阶段3] 使用全新临时目录启动:', tempDataPath);
            fs.mkdirSync(tempDataPath, { recursive: true });
            await this.launchBrowserContext(executablePath, tempDataPath);
            console.log('✅ [阶段3] 浏览器启动成功（使用临时目录）');
            return;
          } catch (error3) {
            const errMsg3 = error3 instanceof Error ? error3.message : String(error3);
            console.error('❌ [阶段3] 所有启动方式均失败:', errMsg3);

            // 给出详细的诊断信息
            const isDllError = errMsg3.includes('3221225781') || errMsg3.includes('0xC0000135');
            const isMissingBrowser = errMsg3.includes("Executable doesn't exist");
            if (isMissingBrowser) {
              throw new Error('缺少浏览器运行组件：未找到配套 Chromium 或已安装的 Edge/Chrome。请安装 Microsoft Edge/Google Chrome，或在项目目录运行 npx playwright install chromium 后重试。');
            }

            if (isDllError) {
              throw new Error(
                '浏览器启动失败（错误码: 0xC0000135）。\n' +
                '可能原因：\n' +
                '1. 系统缺少 Visual C++ 运行时库，请安装: https://aka.ms/vs/17/release/vc_redist.x64.exe\n' +
                '2. 系统版本过低，Chromium 要求 Windows 10 或更高版本\n' +
                '3. 杀毒软件拦截了浏览器进程\n' +
                '安装 VC++ 运行库后重启应用即可。'
              );
            }
            throw error3;
          }
        }
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 启动浏览器上下文（内部方法）
   */
  private async launchBrowserContext(executablePath: string | undefined, userDataPath: string): Promise<void> {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.context = await chromium.launchPersistentContext(userDataPath, {
      executablePath,
      headless: true,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      permissions: ['geolocation', 'notifications'],
      serviceWorkers: 'block',
      args: COMMON_BROWSER_ARGS,
      ignoreDefaultArgs: BROWSER_IGNORE_DEFAULT_ARGS,
    });

    // 注入反检测脚本（与自动发布模块一致）
    await this.context.addInitScript(STEALTH_INIT_SCRIPT);

    this.browser = this.context.browser();

    console.log('✅ 浏览器实例初始化成功');

    if (this.browser) {
      this.browser.on('disconnected', () => {
        console.log('浏览器已断开连接');
        this.browser = null;
        this.context = null;
      });
    }
  }

  /**
   * 清理浏览器锁文件（修复崩溃后无法重启的问题）
   */
  private cleanupBrowserLocks(userDataPath: string): void {
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'Lock'];
    for (const lockFile of lockFiles) {
      const lockPath = path.join(userDataPath, lockFile);
      try {
        if (fs.existsSync(lockPath)) {
          fs.unlinkSync(lockPath);
          console.log('🗑️ 已清理锁文件:', lockFile);
        }
      } catch (e) {
        console.log('清理锁文件失败（忽略）:', lockFile, e);
      }
    }
  }

  public async newPage(): Promise<Page> {
    if (!this.browser || !this.context) {
      await this.initBrowser();
    }

    if (!this.context) {
      throw new Error('浏览器上下文未初始化');
    }

    try {
      const page = await this.context.newPage();

      // 设置页面配置
      page.setDefaultTimeout(60000);

      // 监听页面事件
      page.on('close', () => {
        console.log('页面已关闭');
      });

      page.on('error', (error) => {
        console.error('页面错误:', error);
      });

      return page;
    } catch (error) {
      console.error('创建新页面失败:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    try {
      console.log('开始关闭浏览器管理器...');

      // 保存状态
      if (this.context) {
        try {
          const statePath = path.join(this.userDataPath, 'douyin-state.json');
          await this.context.storageState({ path: statePath });
          console.log('✅ 浏览器状态已保存');
        } catch (saveError) {
          console.log('保存浏览器状态失败:', saveError);
        }

        // 🔧 关键修复：从 context 对象中获取浏览器实例
        try {
          const browserInstance = (this.context as any).browser?.() || (this.context as any)._browser;
          if (browserInstance) {
            console.log('找到浏览器实例，准备直接关闭浏览器窗口...');
            try {
              await browserInstance.close();
              console.log('✅ 浏览器窗口已关闭');
            } catch (browserCloseError) {
              console.log('浏览器关闭失败:', browserCloseError);
            }
          }
        } catch (e) {
          console.log('无法获取浏览器实例，尝试通过 context.close() 关闭:', e);
        }

        // 关闭上下文
        try {
          await this.context?.close();
          console.log('✅ 上下文已关闭');
        } catch (contextCloseError) {
          console.log('上下文关闭失败（忽略）:', contextCloseError);
        }

        this.context = null;
      }

      // 确保浏览器进程被关闭
      if (this.browser) {
        try {
          console.log('正在关闭浏览器主进程...');
          await this.browser.close();
          console.log('✅ 浏览器主进程已关闭');
        } catch (browserCloseError) {
          console.log('浏览器主进程关闭失败:', browserCloseError);
        }
        this.browser = null;
      }

      console.log('✅ 浏览器管理器已彻底关闭');
    } catch (error) {
      console.error('关闭浏览器管理器失败:', error);
    }
  }

  public isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }

  public getBrowserInfo(): { browser: Browser | null; context: BrowserContext | null } {
    return {
      browser: this.browser,
      context: this.context
    };
  }

  // 全局清理方法
  public static async cleanup(): Promise<void> {
    if (DouyinBrowserManager.instance) {
      await DouyinBrowserManager.instance.close();
      DouyinBrowserManager.instance = null as any;
    }
  }
}

export { DouyinBrowserManager };