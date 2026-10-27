/**
 * 视频下载器 - 基于浏览器自动化+API拦截方案
 * 替换原有的在线API分析，实现真正的视频内容下载和识别
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { Page, BrowserContext } from 'playwright';
import { DouyinBrowserManager } from './browserManager';

interface VideoInfo {
  aweme_id: string;
  desc: string;
  author: {
    uid: string;
    nickname: string;
  };
  video: {
    play_addr: {
      url_list: string[];
    };
    duration: number;
  };
}

interface DownloadResult {
  success: boolean;
  videoPath?: string;
  audioPath?: string;
  videoInfo?: VideoInfo;
  error?: string;
}

class DouyinVideoDownloader {
  private static readonly DIRECT_VIDEO_PATTERN = /https?:\/\/[^\s"'<>]+?\.(mp4|mov|m4v|webm|avi|mkv)(\?[^\s"'<>]*)?/i;
  private browserManager: DouyinBrowserManager;
  private externalContext: BrowserContext | null; // 外部传入的浏览器上下文
  private userDataPath: string;

  constructor(externalContext?: BrowserContext) {
    this.externalContext = externalContext || null;
    this.browserManager = DouyinBrowserManager.getInstance();
    // 设置用户数据目录以保持登录状态
    this.userDataPath = path.join(app.getPath('userData'), 'douyin-browser-data');
  }

  private getDownloadDir(): string {
    const downloadDir = path.join(app.getPath('userData'), 'downloads', 'videos');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    return downloadDir;
  }

  private inferVideoExtension(videoUrl: string): string {
    try {
      const pathname = new URL(videoUrl).pathname.toLowerCase();
      const matchedExt = pathname.match(/\.(mp4|mov|m4v|webm|avi|mkv)$/i)?.[1]?.toLowerCase();
      if (matchedExt) {
        return `.${matchedExt}`;
      }
    } catch (error) {
      console.warn('inferVideoExtension failed:', error);
    }

    return '.mp4';
  }

  private isDirectVideoUrl(videoUrl: string): boolean {
    return DouyinVideoDownloader.DIRECT_VIDEO_PATTERN.test(videoUrl.trim());
  }

  private downloadRemoteFile(
    fileUrl: string,
    savePath: string,
    headers: Record<string, string>,
    redirectCount: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading video'));
        return;
      }

      const client = fileUrl.startsWith('https://') ? https : http;
      const fileStream = fs.createWriteStream(savePath);
      let settled = false;

      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        fileStream.destroy();
        if (fs.existsSync(savePath)) {
          fs.unlinkSync(savePath);
        }
        reject(error);
      };

      const request = client.get(fileUrl, { headers }, (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;

        if (statusCode >= 300 && statusCode < 400 && location) {
          fileStream.close();
          fs.unlinkSync(savePath);
          const redirectUrl = location.startsWith('http')
            ? location
            : new URL(location, fileUrl).toString();
          this.downloadRemoteFile(redirectUrl, savePath, headers, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode !== 200) {
          fail(new Error(`HTTP ${statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          if (settled) {
            return;
          }
          settled = true;
          fileStream.close();
          resolve();
        });
      });

      request.on('error', (error) => {
        fail(error);
      });

      fileStream.on('error', (error) => {
        request.destroy();
        fail(error);
      });

      request.setTimeout(120000, () => {
        request.destroy();
        fail(new Error('Download timed out after 120 seconds'));
      });
    });
  }

  /**
   * 初始化浏览器（使用管理器或外部上下文）
   */
  async initBrowser(): Promise<void> {
    // 如果有外部提供的Context，则不需要初始化
    if (this.externalContext) {
      console.log('使用外部提供的浏览器上下文');
      return;
    }

    // 否则使用内部管理器
    await this.browserManager.initBrowser();
  }

  /**
   * 从视频URL提取aweme_id（支持短链接重定向）
   */
  async extractAwemeIdAsync(url: string): Promise<string | null> {
    // 标准化URL格式
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    console.log('标准化URL:', normalizedUrl);

    // 支持多种抖音URL格式
    const patterns = [
      /\/video\/(\d+)/,
      /modal_id=(\d+)/,
      /share\/video\/(\d+)/,
      /item_id=(\d+)/,
      /aweme_id=(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match) {
        console.log('提取到aweme_id:', match[1]);
        return match[1];
      }
    }

    // 如果是短链接（v.douyin.com），需要请求获取重定向后的真实URL
    if (normalizedUrl.includes('v.douyin.com') || normalizedUrl.includes('iesdouyin.com')) {
      console.log('检测到短链接，尝试获取重定向后的真实URL...');
      try {
        const realUrl = await this.resolveShortUrl(normalizedUrl);
        if (realUrl && realUrl !== normalizedUrl) {
          console.log('重定向后的真实URL:', realUrl);
          // 再次尝试从真实URL提取ID
          for (const pattern of patterns) {
            const match = realUrl.match(pattern);
            if (match) {
              console.log('从重定向URL提取到aweme_id:', match[1]);
              return match[1];
            }
          }
        }
      } catch (error) {
        console.error('解析短链接失败:', error);
      }
    }

    console.log('未能提取aweme_id，URL格式可能不支持');
    return null;
  }

  /**
   * 解析短链接获取重定向后的真实URL
   */
  private resolveShortUrl(shortUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(shortUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 30000  // 增加短链接解析超时到30秒
      };

      const req = https.request(options, (res) => {
        // 如果有重定向，返回重定向的URL
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          // 没有重定向，返回原URL
          resolve(shortUrl);
        }
      });

      req.on('error', (error) => {
        console.error('请求短链接失败:', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('短链接解析超时'));
      });

      req.end();
    });
  }

  /**
   * 同步版本的ID提取（兼容旧代码）
   */
  extractAwemeId(url: string): string | null {
    // 标准化URL格式
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    console.log('标准化URL:', normalizedUrl);

    // 支持多种抖音URL格式
    const patterns = [
      /\/video\/(\d+)/,
      /modal_id=(\d+)/,
      /share\/video\/(\d+)/,
      /item_id=(\d+)/,
      /aweme_id=(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match) {
        console.log('提取到aweme_id:', match[1]);
        return match[1];
      }
    }

    // 对于短链接，返回null让调用者使用异步版本
    if (normalizedUrl.includes('v.douyin.com') || normalizedUrl.includes('iesdouyin.com')) {
      console.log('检测到短链接，需要使用异步方法解析');
      return null;
    }

    console.log('未能提取aweme_id，URL格式可能不支持');
    return null;
  }

  /**
   * 拦截API响应获取视频信息
   */
  async interceptVideoInfo(page: Page, awemeId: string): Promise<VideoInfo | null> {
    return new Promise((resolve) => {
      let found = false;

      // 监听API响应
      page.on('response', async (response) => {
        if (found) return;

        const url = response.url();

        // 拦截视频详情API
        if (url.includes('aweme/v1/web/aweme/detail') && url.includes(awemeId)) {
          try {
            const text = await response.text();
            console.log('API响应:', text.substring(0, 200));

            // 处理可能的响应格式
            let data: any;
            try {
              data = JSON.parse(text);
            } catch {
              // 尝试处理带前缀的响应
              const jsonStr = text.replace(/^[^{]*/, '');
              data = JSON.parse(jsonStr);
            }

            if (data.aweme_detail) {
              found = true;
              resolve(data.aweme_detail as VideoInfo);
            }
          } catch (error) {
            console.error('解析API响应失败:', error);
          }
        }
      });

      // 设置超时（增加到30秒，给API足够的时间响应）
      setTimeout(() => {
        if (!found) {
          console.log('API拦截超时，将尝试其他方法获取视频信息');
          resolve(null);
        }
      }, 30000);
    });
  }

  /**
   * 下载视频文件
   */
  async downloadVideo(videoUrl: string, savePath: string): Promise<void> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.douyin.com/',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    return this.downloadRemoteFile(videoUrl, savePath, headers);
  }

  async downloadDirectVideo(videoUrl: string): Promise<DownloadResult> {
    try {
      if (!this.isDirectVideoUrl(videoUrl)) {
        return {
          success: false,
          error: 'Unsupported direct video url'
        };
      }

      const downloadDir = this.getDownloadDir();
      const extension = this.inferVideoExtension(videoUrl);
      const videoPath = path.join(downloadDir, `direct_${Date.now()}${extension}`);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      };

      await this.downloadRemoteFile(videoUrl, videoPath, headers);

      return {
        success: true,
        videoPath,
        audioPath: videoPath.replace(path.extname(videoPath), '_audio.wav')
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 下载抖音视频
   */
  async downloadDouyinVideo(videoUrl: string): Promise<DownloadResult> {
    let page: Page | null = null;
    let browserInitialized = false;

    try {
      console.log('开始下载抖音视频:', videoUrl);

      // 提取视频ID（使用异步版本支持短链接重定向）
      const awemeId = await this.extractAwemeIdAsync(videoUrl);
      if (!awemeId) {
        return { success: false, error: '无法从URL中提取视频ID，请检查链接格式' };
      }

      console.log('提取到视频ID:', awemeId);

      // 创建下载目录
      const downloadDir = path.join(app.getPath('userData'), 'downloads', 'videos');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      // 设置下载路径
      const videoFileName = `douyin_${awemeId}_${Date.now()}.mp4`;
      const videoPath = path.join(downloadDir, videoFileName);
      console.log('视频保存路径:', videoPath);

      try {
        // 初始化浏览器（使用管理器或外部上下文）
        console.log('初始化浏览器...');
        await this.initBrowser();

        // 使用外部Context或内部管理器创建页面
        if (this.externalContext) {
          page = await this.externalContext.newPage();
          console.log('使用外部浏览器上下文创建页面成功');
        } else {
          page = await this.browserManager.newPage();
          console.log('使用内部浏览器管理器创建页面成功');
        }

        // 设置页面超时和错误处理
        page.setDefaultTimeout(60000); // 增加超时时间到60秒

        // 监听页面关闭事件
        page.on('close', () => {
          console.log('页面已关闭');
          page = null;
        });

        // 不再强制前置登录检查 - 公开视频无需登录即可访问
        // 只在真正跳转到登录页时才引导用户登录
        console.log('准备拦截视频信息...');

        // 拦截视频信息（先注册监听，再导航）
        const videoInfoPromise = this.interceptVideoInfo(page, awemeId);

        // 直接构造标准视频URL（避免短链接重定向到 jingxuan+modal_id 不触发API）
        // 由于 awemeId 已经提取，直接访问 /video/{awemeId} 标准路径
        const directVideoUrl = `https://www.douyin.com/video/${awemeId}`;
        console.log('访问视频页面（标准路径）:', directVideoUrl);

        try {
          await page.goto(directVideoUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          console.log('页面DOM加载完成');

          const currentUrl = page.url();
          console.log('当前页面URL:', currentUrl);

          // 只有跳到真正的 /login 页面才引导登录
          const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('login?');

          if (isLoginPage) {
            console.log('⚠️ 页面跳转到了登录页，开始引导登录...');
            await this.ensureLoggedIn(page);

            console.log('登录后重新访问视频页面...');
            await page.goto(directVideoUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });

            const retryUrl = page.url();
            console.log('重试后的页面URL:', retryUrl);
            if (retryUrl.includes('/login')) {
              return { success: false, error: '无法访问视频页面，请先扫码登录抖音后重试' };
            }
          } else if (currentUrl.includes('/video/')) {
            console.log('✅ 视频页面加载成功，等待API响应...');
          } else {
            console.log('⚠️ 页面重定向到:', currentUrl, '，继续等待API响应...');
          }
        } catch (gotoError) {
          console.log('页面goto超时（已忽略），继续等待API响应:', gotoError instanceof Error ? gotoError.message : gotoError);
        }

        console.log('等待API响应...');

        // 获取视频信息
        const videoInfo = await videoInfoPromise;

        if (!videoInfo) {
          console.log('未获取到视频信息，尝试其他方法...');

          // 备用方法：尝试直接从页面获取信息
          try {
            const pageContent = await page.content();
            console.log('页面内容长度:', pageContent.length);

            // 如果页面内容包含视频信息，尝试解析
            if (pageContent.includes('aweme_detail')) {
              // 简单的备用处理
              return {
                success: true,
                videoPath,
                videoInfo: {
                  aweme_id: awemeId,
                  desc: `抖音视频 ${awemeId}`,
                  author: { uid: '', nickname: '未知作者' },
                  video: {
                    play_addr: { url_list: [] },
                    duration: 0
                  }
                },
                audioPath: videoPath.replace('.mp4', '_audio.wav')
              };
            }
          } catch (pageError) {
            console.error('页面解析失败:', pageError);
          }

          return { success: false, error: '无法获取视频信息，可能视频不存在或访问受限' };
        }

        console.log('获取到视频信息:', videoInfo.desc);

        // 获取视频下载链接
        const videoUrls = videoInfo.video?.play_addr?.url_list;
        if (!videoUrls || videoUrls.length === 0) {
          return { success: false, error: '无法获取视频下载链接，可能视频版权限制' };
        }

        const downloadUrl = videoUrls[0];
        console.log('找到下载链接:', downloadUrl.substring(0, 100) + '...');

        // 下载视频文件
        console.log('开始下载视频文件...');
        await this.downloadVideo(downloadUrl, videoPath);

        console.log('视频下载完成:', videoPath);
        console.log('文件大小:', fs.statSync(videoPath).size, 'bytes');

        return {
          success: true,
          videoPath,
          videoInfo,
          audioPath: videoPath.replace('.mp4', '_audio.wav')
        };

      } finally {
        // 页面处理完成，关闭页面
        if (page) {
          try {
            console.log('关闭页面...');
            await page.close();
            console.log('页面已关闭');
          } catch (closeError) {
            console.log('页面关闭时出错:', closeError instanceof Error ? closeError.message : closeError);
          }
        }
      }

    } catch (error) {
      console.error('下载视频失败:', error);

      let errorMessage = '未知错误';
      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('3221225781') || errorMessage.includes('0xC0000135') || errorMessage.includes('0xc0000135')) {
          errorMessage = '浏览器启动失败（错误码: 0xC0000135）。\n' +
            '可能原因：\n' +
            '1. 系统缺少 Visual C++ 运行时库，请安装: https://aka.ms/vs/17/release/vc_redist.x64.exe\n' +
            '2. 系统版本过低，Chromium 要求 Windows 10 或更高版本\n' +
            '3. 杀毒软件拦截了浏览器进程\n' +
            '安装 VC++ 运行库后重启应用即可。';
        } else if (errorMessage.includes('缺少浏览器运行组件') || errorMessage.includes("Executable doesn't exist")) {
          errorMessage = '缺少浏览器运行组件：请安装 Microsoft Edge/Google Chrome，或在项目目录运行 npx playwright install chromium 后重试。';
        } else if (errorMessage.includes('playwright') || errorMessage.includes('browser')) {
          errorMessage = '浏览器启动失败，请检查系统环境和权限设置';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = '网络超时，请检查网络连接或重试';
        } else if (errorMessage.includes('404') || errorMessage.includes('403')) {
          errorMessage = '视频不存在或访问受限';
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 引导用户登录（只在真正需要时调用）
   * 基于Cookie检测是否已登录，未登录则引导扫码
   */
  async ensureLoggedIn(page: Page): Promise<void> {
    try {
      // 如果是外部浏览器上下文（来自已登录的UI），直接信任其登录状态
      if (this.externalContext) {
        console.log('✅ 使用外部已登录的浏览器上下文，跳过登录检查');
        return;
      }

      // 先通过Cookie快速判断是否已登录（避免重新访问首页）
      try {
        const cookies = await page.context().cookies(['https://www.douyin.com']);
        const loginCookies = cookies.filter(c =>
          ['sessionid', 'uid_tt', 'LOGIN_STATUS', 'sid_guard', 'sid_tt'].includes(c.name) && c.value
        );
        if (loginCookies.length > 0) {
          console.log('✅ 检测到已登录Cookie，无需重新登录');
          return;
        }
      } catch (e) {
        // Cookie检测失败，继续走DOM检测
      }

      // Cookie不存在，访问首页检测登录状态
      console.log('检查登录状态，开始访问抖音首页...');
      await page.goto('https://www.douyin.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      console.log('抖音首页加载完成，等待页面元素...');
      try {
        await page.waitForSelector('body', { timeout: 10000 });
      } catch (e) {
        console.log('页面加载超时，继续执行');
      }
      await page.waitForTimeout(2000);

      // 通过DOM元素检测登录状态
      const isLoggedIn = await page.evaluate(() => {
        // 检测登录按钮（未登录时出现）
        const loginBtnSelectors = [
          '[data-e2e="login-button"]',
          '.login-btn',
          '.e2e-login-btn',
          'button[class*="login"]'
        ];
        // 检测用户信息（已登录时出现）
        const userInfoSelectors = [
          '[data-e2e="user-info"]',
          '[data-e2e="user-avatar"]',
          '[class*="userInfo"]',
          '[class*="UserInfo"]',
          '[class*="avatar"]',
          '.user-name',
          '.header-user',
          '.user-avatar',
          '.nickname'
        ];
        const hasLoginButton = loginBtnSelectors.some(s => document.querySelector(s));
        const hasUserInfo = userInfoSelectors.some(s => document.querySelector(s));
        // 如果有用户信息，或者没有登录按钮，认为已登录
        return hasUserInfo || !hasLoginButton;
      });

      if (isLoggedIn) {
        console.log('✅ 用户已登录');
        return;
      }

      console.log('❌ 用户未登录，开始引导登录...');
      console.log('='.repeat(60));
      console.log('📱 请在浏览器中扫码登录抖音');
      console.log('='.repeat(60));
      console.log('1. ✅ 浏览器窗口已打开');
      console.log('2. 📱 请使用抖音APP扫描页面上的二维码');
      console.log('3. ✅ 登录成功后会自动继续处理');
      console.log('4. ⏰ 登录超时时间：2分钟');
      console.log('='.repeat(60));

      // 等待登录（最多2分钟）
      let loginSuccess = false;
      const loginTimeout = 120000;
      const checkInterval = 3000;
      const startTime = Date.now();

      while (Date.now() - startTime < loginTimeout) {
        await page.waitForTimeout(checkInterval);
        const cookies = await page.context().cookies(['https://www.douyin.com']);
        const loginCookies = cookies.filter(c =>
          ['sessionid', 'uid_tt', 'LOGIN_STATUS', 'sid_guard'].includes(c.name) && c.value
        );
        if (loginCookies.length > 0) {
          loginSuccess = true;
          console.log('✅ 登录成功，继续处理...');
          break;
        }
      }

      if (!loginSuccess) {
        console.log('⚠️ 登录超时，以未登录状态继续尝试...');
      }

      // 保存登录状态
      try {
        const statePath = path.join(this.userDataPath, 'douyin-state.json');
        await page.context().storageState({ path: statePath });
      } catch (e) { }

    } catch (error) {
      console.error('登录引导失败:', error);
      // 继续执行
    }
  }

  /**
   * 保存当前浏览器状态
   */
  async saveBrowserState(): Promise<void> {
    try {
      const statePath = path.join(this.userDataPath, 'douyin-state.json');
      const { context } = this.browserManager.getBrowserInfo();
      if (context) {
        await context.storageState({ path: statePath });
        console.log('浏览器状态已保存到:', statePath);
      }
    } catch (error) {
      console.error('保存浏览器状态失败:', error);
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    // 如果使用的是外部提供的Context，不要关闭它，由调用者管理
    if (this.externalContext) {
      console.log('使用外部浏览器上下文，不关闭浏览器（由调用者管理）');
      return;
    }

    try {
      await this.browserManager.close();
    } catch (error) {
      console.error('关闭浏览器失败:', error);
    }

    // 🔧 关键修复：无论如何都要强制杀死 Chromium 进程（确保浏览器真的关闭）
    // [临时禁用] 暂时注释掉强制杀死浏览器进程的逻辑
    /*
    try {
      const { execSync } = require('child_process');
      execSync('taskkill /F /IM chrome.exe /IM chromium.exe 2>nul', { shell: true });
      console.log('✅ 已强制杀死所有 Chromium 进程');
    } catch (killError) {
      console.log('杀死进程失败（忽略）:', killError);
    }
    */
  }
}

export { DouyinVideoDownloader, VideoInfo, DownloadResult };
