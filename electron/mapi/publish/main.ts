import { ipcMain, app } from 'electron';
import { Log } from '../log/main';
import DbMain from '../db/main';
import { CoverAdapter } from './coverAdapter';
import { ExecutePublishParams, PublishTask, PublishHistory } from './types';
import { chromium, Browser, BrowserContext, Page, Frame } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getPlaywrightChromiumPath, COMMON_BROWSER_ARGS, STEALTH_INIT_SCRIPT } from '../../lib/browser-path';
import { getRuntimeDataPath } from '../../lib/resource-path';

const browserContexts: Map<string, BrowserContext> = new Map();

type PublishResultStatus = 'success' | 'failed' | 'verification_required' | 'manual_pending';

type PublishExecutionResult = {
    success: boolean;
    status: PublishResultStatus;
    message: string;
    videoUrl?: string;
    videoId?: string;
    requiresVerification?: boolean;
    keepPageOpen?: boolean;
};

const STEALTH_UA = process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PUBLISH_SUCCESS_SELECTORS: Record<string, string[]> = {
    douyin: [
        'text="发布成功"',
        'text="已发布"',
        'text="作品发布成功"',
        'text=/发布成功|已发布|发布完成/',
    ],
    kuaishou: [
        'text="发布成功"',
        'text="已发布"',
        'text="作品发布成功"',
        'text=/发布成功|已发布|发布完成/',
    ],
    shipin: [
        'text="发表成功"',
        'text="发布成功"',
        'text="已发表"',
        'text="已发布"',
        'text=/发表成功|发布成功|已发表|已发布/',
    ],
    xiaohongshu: [
        'text="发布成功"',
        'text="已发布"',
        'text="笔记发布成功"',
        'text=/发布成功|已发布|笔记发布成功/',
    ],
};

const PUBLISH_PAGE_MARKERS: Record<string, string[]> = {
    douyin: ['/creator-micro/content/upload'],
    kuaishou: ['/article/publish/video'],
    shipin: ['/platform/post/create'],
    xiaohongshu: ['/publish/publish'],
};

const VERIFICATION_TEXT_SELECTORS = [
    'text=/短信验证码|接收短信验证码|请输入验证码|输入验证码|手机验证码|安全验证|验证手机号|获取验证码|发送验证码|发送短信验证码|验证码错误/',
];

const VERIFICATION_INPUT_SELECTORS = [
    'input[placeholder*="验证码"]',
    'input[placeholder*="输入验证码"]',
    'input[maxlength="6"]',
    'input[maxlength="4"]',
];

const VERIFICATION_ACTION_SELECTORS = [
    'button:has-text("获取验证码")',
    'button:has-text("发送验证码")',
    'button:has-text("验证")',
    'button:has-text("确认")',
];

function getPersistentUserDataDir(platform: string, accountId?: number | string): string {
    const dir = getRuntimeDataPath('browser-data', 'publish', `${platform}_${accountId || 'default'}`);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getSearchFrames(page: Page): Frame[] {
    try {
        return page.frames();
    } catch {
        return [];
    }
}

async function findVisibleSelectorInFrames(page: Page, selectors: string[]): Promise<{ selector: string; frameUrl: string } | null> {
    for (const frame of getSearchFrames(page)) {
        for (const selector of selectors) {
            try {
                const locator = frame.locator(selector).first();
                const count = await locator.count().catch(() => 0);
                if (count > 0) {
                    const visible = await locator.isVisible().catch(() => false);
                    if (visible) {
                        return {
                            selector,
                            frameUrl: frame.url(),
                        };
                    }
                }
            } catch {
                // ignore selector failures
            }
        }
    }
    return null;
}

async function detectVerificationPrompt(page: Page): Promise<{ detected: boolean; selector?: string; frameUrl?: string }> {
    const titleMatch = await findVisibleSelectorInFrames(page, VERIFICATION_TEXT_SELECTORS);
    const inputMatch = await findVisibleSelectorInFrames(page, VERIFICATION_INPUT_SELECTORS);
    const actionMatch = await findVisibleSelectorInFrames(page, VERIFICATION_ACTION_SELECTORS);

    if ((titleMatch && inputMatch) || (inputMatch && actionMatch)) {
        return {
            detected: true,
            selector: titleMatch?.selector || inputMatch?.selector || actionMatch?.selector,
            frameUrl: titleMatch?.frameUrl || inputMatch?.frameUrl || actionMatch?.frameUrl,
        };
    }

    return { detected: false };
}

async function detectPublishSuccess(page: Page, platform: string): Promise<{ detected: boolean; reason?: string }> {
    const successMatch = await findVisibleSelectorInFrames(page, PUBLISH_SUCCESS_SELECTORS[platform] || []);
    if (successMatch) {
        return {
            detected: true,
            reason: `success_selector:${successMatch.selector}`,
        };
    }

    const currentUrl = page.url();
    const publishMarkers = PUBLISH_PAGE_MARKERS[platform] || [];
    const leftPublishPage = publishMarkers.length > 0 && !publishMarkers.some(marker => currentUrl.includes(marker));

    if (leftPublishPage && !currentUrl.includes('login') && !currentUrl.includes('verify') && !currentUrl.includes('passport')) {
        return {
            detected: true,
            reason: `url_changed:${currentUrl}`,
        };
    }

    return { detected: false };
}

async function waitForPublishConfirmation(
    page: Page,
    platform: string,
    timeoutMs = 15 * 60 * 1000
): Promise<PublishExecutionResult> {
    const startTime = Date.now();
    let verificationDetected = false;

    while (Date.now() - startTime < timeoutMs) {
        if (page.isClosed()) {
            return {
                success: false,
                status: verificationDetected ? 'verification_required' : 'failed',
                message: verificationDetected ? '发布页面已关闭，验证码流程未完成' : '发布页面已关闭',
                keepPageOpen: false,
            };
        }

        const verificationResult = await detectVerificationPrompt(page);
        if (verificationResult.detected) {
            if (!verificationDetected) {
                verificationDetected = true;
                Log.warn(`[Publish] 检测到验证码弹窗，进入等待用户验证状态: ${platform}`, verificationResult);
            }
        }

        const successResult = await detectPublishSuccess(page, platform);
        if (successResult.detected) {
            Log.info(`[Publish] 检测到明确发布成功信号: ${platform}`, successResult);
            return {
                success: true,
                status: 'success',
                message: '发布成功',
                videoUrl: page.url(),
                videoId: '',
                keepPageOpen: false,
            };
        }

        await page.waitForTimeout(1500);
    }

    if (verificationDetected) {
        return {
            success: false,
            status: 'verification_required',
            message: '检测到短信验证码，请在浏览器中完成验证码输入并确认发布',
            videoUrl: page.url(),
            videoId: '',
            requiresVerification: true,
            keepPageOpen: true,
        };
    }

    return {
        success: false,
        status: 'manual_pending',
        message: '已点击发布按钮，但未检测到明确的发布成功标识，请在浏览器中确认是否仍需验证码或手动确认',
        videoUrl: page.url(),
        videoId: '',
        keepPageOpen: true,
    };
}

async function getBrowserContext(platform: string, accountId?: number | string): Promise<BrowserContext> {
    const contextKey = accountId ? `publish_${platform}_${accountId}` : `publish_${platform}`;

    if (browserContexts.has(contextKey)) {
        const existingContext = browserContexts.get(contextKey)!;
        try {
            const pages = existingContext.pages();
            Log.info('[Publish] 复用现有持久化上下文, pages:', pages.length);
            return existingContext;
        } catch {
            Log.info('[Publish] 现有上下文已失效，将重新创建');
            browserContexts.delete(contextKey);
        }
    }

    try {
        const executablePath = getPlaywrightChromiumPath();
        const userDataDir = getPersistentUserDataDir(platform, accountId);

        Log.info(`[Publish] 创建持久化浏览器上下文: ${contextKey}, dataDir: ${userDataDir}`);

        const context = await chromium.launchPersistentContext(userDataDir, {
            executablePath,
            headless: false,
            viewport: null,
            userAgent: STEALTH_UA,
            ignoreHTTPSErrors: true,
            locale: 'zh-CN',
            timezoneId: 'Asia/Shanghai',
            permissions: ['geolocation', 'notifications', 'clipboard-read', 'clipboard-write'],
            acceptDownloads: true,
            args: COMMON_BROWSER_ARGS,
        });

        await context.addInitScript(STEALTH_INIT_SCRIPT);

        Log.info('[Publish] 持久化浏览器上下文创建成功');

        context.on('close', () => {
            Log.info(`[Publish] 浏览器上下文已关闭: ${contextKey}`);
            browserContexts.delete(contextKey);
        });

        browserContexts.set(contextKey, context);
        return context;
    } catch (error: any) {
        Log.error('[Publish] 创建浏览器上下文失败:', error.message);

        let errorMessage = error.message || '未知错误';
        if (errorMessage.includes('3221225781') || errorMessage.includes('0xC0000135') || errorMessage.includes('0xc0000135')) {
            errorMessage = '浏览器启动失败（错误码: 0xC0000135）。\n' +
                '可能原因：\n' +
                '1. 系统缺少 Visual C++ 运行时库，请安装: https://aka.ms/vs/17/release/vc_redist.x64.exe\n' +
                '2. 系统版本过低，Chromium 要求 Windows 10 或更高版本\n' +
                '3. 杀毒软件拦截了浏览器进程\n' +
                '安装 VC++ 运行库后重启应用即可。';
        } else if (errorMessage.includes('Executable doesn\'t exist')) {
            errorMessage = '浏览器可执行文件不存在，请重新安装程序';
        } else if (errorMessage.includes('EADDRINUSE')) {
            errorMessage = '浏览器端口被占用，请关闭其他浏览器实例后重试';
        } else if (errorMessage.includes('EACCES') || errorMessage.includes('Permission denied')) {
            errorMessage = '权限不足，请以管理员身份运行程序';
        }

        throw new Error(errorMessage);
    }
}

/**
 * 创建发布任务
 */
ipcMain.handle('publish:createTask', async (event, params: {
    videoPath: string;
    coverPath: string;
    platforms: string[];
    publishConfig: any;
    scheduledTime?: number;
    title?: string;
}) => {
    try {
        const now = Date.now();

        const result = await DbMain.insert(
            `INSERT INTO publish_tasks (title, videoPath, coverPath, platforms, publishConfig, scheduledTime, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                params.title || '视频发布任务',
                params.videoPath,
                params.coverPath,
                JSON.stringify(params.platforms),
                JSON.stringify(params.publishConfig || {}),
                params.scheduledTime || null,
                'pending',
                now,
                now
            ]
        );

        return {
            success: true,
            taskId: result
        };

    } catch (error: any) {
        Log.error('publish.createTask error', error);
        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 平台登录
 */
ipcMain.handle('publish:login', async (event, params: { platform: string; accountId?: number }) => {
    let page: Page | null = null;
    try {
        const { platform, accountId } = params;
        Log.info(`开始登录${platform}, accountId=${accountId}`);

        Log.info('正在获取持久化浏览器上下文...');
        const context = await getBrowserContext(platform, accountId);
        Log.info('浏览器上下文就绪');

        const pages = context.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();

        let loginUrl = '';
        if (platform === 'douyin') {
            loginUrl = 'https://creator.douyin.com/';
        } else if (platform === 'kuaishou') {
            loginUrl = 'https://cp.kuaishou.com/';
        } else if (platform === 'shipin') {
            loginUrl = 'https://channels.weixin.qq.com/';
        } else if (platform === 'xiaohongshu') {
            loginUrl = 'https://creator.xiaohongshu.com/';
        } else {
            throw new Error(`不支持的平台: ${platform}`);
        }

        Log.info(`准备导航到: ${loginUrl}`);
        try {
            await page.goto(loginUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            Log.info(`页面已打开: ${loginUrl}`);
        } catch (error: any) {
            Log.info(`页面加载超时: ${error.message}`);
            Log.info('继续执行...');
        }

        // 等待页面渲染（缩短等待时间）
        await new Promise(resolve => setTimeout(resolve, 2000));

        Log.info(`登录页面已打开: ${loginUrl}`);

        // === 简化的登录检测逻辑（参考 aigc-human 项目） ===
        // 不做任何额外导航，只在当前页面等待登录标志出现

        let isLoggedIn = false;
        let userInfo: any = {};

        // 各平台的登录标志选择器
        const platformLoginSelectors: Record<string, { selectors: string[]; urlExclude: string[] }> = {
            douyin: {
                selectors: ['#header-avatar', '.creator-avatar', 'input[type="file"]'],
                urlExclude: ['login', 'passport'],
            },
            kuaishou: {
                selectors: ['[class*="avatar"]', '.user-avatar', '.user-name', '[class*="upload"]'],
                urlExclude: ['login', 'passport'],
            },
            shipin: {
                selectors: ['[class*="avatar"]', '.avatar', '.user-info'],
                urlExclude: ['login', 'auth', 'qr', 'mp.weixin.qq.com'],
            },
            xiaohongshu: {
                selectors: ['[class*="avatar"]', '.user-avatar', '.user-name', '[class*="upload"]'],
                urlExclude: ['login', 'passport', 'account'],
            },
        };

        const loginConfig = platformLoginSelectors[platform] || platformLoginSelectors.douyin;

        // 等页面稳定
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 通用登录检测函数
        const checkLogin = async (): Promise<boolean> => {
            try {
                const currentUrl = page!.url();
                if (loginConfig.urlExclude.some(kw => currentUrl.includes(kw))) {
                    return false;
                }
                for (const selector of loginConfig.selectors) {
                    const count = await page!.locator(selector).count().catch(() => 0);
                    if (count > 0) return true;
                }
                return false;
            } catch {
                return false;
            }
        };

        // 🔥 从页面提取真实昵称的函数
        const extractNickname = async (): Promise<string> => {
            try {
                // 各平台的昵称提取选择器（按优先级）
                const nicknameSelectors: Record<string, string[]> = {
                    douyin: [
                        '#header-avatar',           // alt 属性可能有昵称
                        '.creator-avatar',
                        '.nickname', '.user-name', '.userName',
                        '[class*="nickname"]', '[class*="userName"]',
                    ],
                    kuaishou: [
                        '.user-name', '.userName', '.nickname',
                        '[class*="nickname"]', '[class*="userName"]',
                    ],
                    shipin: [
                        '.nickname', '.user-name',
                        '[class*="nickname"]', '[class*="userName"]',
                    ],
                    xiaohongshu: [
                        '.user-name', '.userName', '.nickname',
                        '[class*="nickname"]', '[class*="userName"]',
                    ],
                };

                const selectors = nicknameSelectors[platform] || [];

                for (const selector of selectors) {
                    try {
                        const el = await page!.$(selector);
                        if (el) {
                            // 尝试多种方式获取名字
                            const alt = await el.getAttribute('alt').catch(() => '');
                            if (alt && alt.length > 0 && alt !== '头像') return alt;

                            const title = await el.getAttribute('title').catch(() => '');
                            if (title && title.length > 0) return title;

                            const text = await el.textContent().catch(() => '');
                            if (text && text.trim().length > 0 && text.trim().length < 20) return text.trim();
                        }
                    } catch { /* 继续 */ }
                }

                // 回退：从 cookies 中提取（某些平台会在 cookie 中存用户名）
                const cookies = await context.cookies();
                for (const cookie of cookies) {
                    if (cookie.name === 'LOGIN_STATUS' || cookie.name === 'passport_user_name') {
                        try {
                            const decoded = decodeURIComponent(cookie.value);
                            if (decoded.length > 0 && decoded.length < 30) return decoded;
                        } catch { }
                    }
                }

                // 最终回退
                return `用户_${Date.now().toString(36).slice(-4)}`;
            } catch {
                return `用户_${Date.now().toString(36).slice(-4)}`;
            }
        };

        isLoggedIn = await checkLogin();
        if (isLoggedIn) {
            Log.info(`${platform} 通过已保存的cookies自动登录成功`);
            userInfo.nickname = await extractNickname();
            Log.info(`提取到昵称: ${userInfo.nickname}`);
        }

        // 如果未登录，等待用户扫码
        if (!isLoggedIn) {
            Log.info('等待用户扫码登录（页面不会自动跳转）...');
            const maxWaitTime = 300000;
            const startTime = Date.now();
            let lastLogTime = 0;

            while (!isLoggedIn && (Date.now() - startTime) < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, 3000));

                try {
                    if (page!.isClosed()) {
                        Log.info('页面已关闭，退出等待');
                        return { success: false, message: '页面已关闭' };
                    }
                } catch { /* 忽略 */ }

                isLoggedIn = await checkLogin();

                const elapsed = Date.now() - startTime;
                if (elapsed - lastLogTime >= 15000) {
                    Log.info(`等待登录中... [${Math.round(elapsed / 1000)}s]`);
                    lastLogTime = elapsed;
                }
            }

            if (isLoggedIn) {
                userInfo.nickname = await extractNickname();
                Log.info(`${platform} 扫码登录成功！昵称: ${userInfo.nickname}`);
            } else {
                try { if (page && !page.isClosed()) await page.close(); } catch { /* 忽略 */ }
                return { success: false, message: '登录超时，请在5分钟内完成扫码登录' };
            }
        }


        // 保存Cookie到数据库
        const cookies = await context.cookies();
        Log.info(`获取到 ${cookies.length} 个Cookie`);

        const now = Date.now();
        const userId = userInfo.nickname || `user_${now}`;

        let targetAccountId: number | string;

        if (accountId) {
            targetAccountId = accountId;
            await DbMain.execute(
                'UPDATE platform_accounts SET cookies = ?, nickname = ?, uid = ?, updatedAt = ?, loginStatus = ? WHERE id = ?',
                [JSON.stringify(cookies), userInfo.nickname, userId, now, 'active', accountId]
            );
            Log.info(`账号更新成功, ID: ${targetAccountId}`);
        } else {
            const existingAccount = await DbMain.first(
                'SELECT * FROM platform_accounts WHERE platform = ? ORDER BY updatedAt DESC LIMIT 1',
                [platform]
            );

            if (existingAccount) {
                Log.info(`更新已存在的账号: ${existingAccount.nickname}`);
                try {
                    await DbMain.execute(
                        'UPDATE platform_accounts SET cookies = ?, nickname = ?, uid = ?, updatedAt = ?, loginStatus = ? WHERE id = ?',
                        [JSON.stringify(cookies), userInfo.nickname, userId, now, 'active', existingAccount.id]
                    );
                    targetAccountId = existingAccount.id;
                    Log.info(`账号更新成功, ID: ${targetAccountId}`);
                } catch (error: any) {
                    Log.error(`更新账号失败`, error);
                    throw error;
                }
            } else {
                Log.info(`创建新账号: ${userInfo.nickname}`);
                try {
                    targetAccountId = await DbMain.insert(
                        `INSERT INTO platform_accounts (platform, uid, nickname, cookies, loginStatus, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            platform,
                            userId,
                            userInfo.nickname || '用户',
                            JSON.stringify(cookies),
                            'active',
                            now,
                            now
                        ]
                    );
                    Log.info(`账号创建成功, ID: ${targetAccountId}`);
                } catch (error: any) {
                    Log.error(`创建账号失败`, error);
                    throw error;
                }
            }
        }

        // 🔧 关键修复：只关闭页面，不关闭浏览器上下文
        // 原因：浏览器上下文中的Cookie是持久化的，需要保留给后续检查和发布使用
        // 如果关闭上下文，会导致页面被关了又打开，且会丢失登录状态
        if (page && !page.isClosed()) {
            try {
                await page.close();
                Log.info('登录页面已关闭');
            } catch (closeError: any) {
                Log.error('关闭登录页面失败:', closeError.message);
            }
        }

        // 🔧 优化：保留一个页面供后续检查使用，而不是关闭所有页面
        // 这样可以避免检查登录状态时重复打开浏览器
        try {
            const context = await getBrowserContext(platform, accountId);
            const allPages = context.pages();

            // 保留最后一个页面（通常是登录成功的页面），关闭其他多余页签
            if (allPages.length > 1) {
                // 关闭除最后一个页面外的所有页面
                for (let i = 0; i < allPages.length - 1; i++) {
                    try {
                        if (!allPages[i].isClosed()) {
                            await allPages[i].close();
                            Log.info(`已关闭额外页签: ${allPages[i].url()}`);
                        }
                    } catch (e) {
                        Log.debug('关闭页签失败（忽略）');
                    }
                }
            }

            // 🔧 修改：检测到已登录后，必须关闭浏览器（不是关页签，是关闭整个浏览器）
            Log.info(`✅ 登录成功，准备关闭浏览器`);
            await closeBrowserContext(platform, accountId);
            Log.info(`✅ 浏览器已关闭`);
        } catch (closeBrowserError: any) {
            Log.error('关闭浏览器失败:', closeBrowserError.message);
            try {
                await closeBrowserContext(platform, accountId);
            } catch (e) {
                Log.error('强制关闭浏览器失败:', e);
            }
        }

        Log.info(`${platform}登录成功`, {
            nickname: userInfo.nickname,
            accountId,
            cookieCount: cookies.length
        });

        return {
            success: true,
            userInfo: {
                nickname: userInfo.nickname,
                userId: userId,
                accountId: accountId
            }
        };

    } catch (error: any) {
        Log.error('publish.login error', error);

        // 发生错误时也尝试关闭页面（但不关闭浏览器上下文）
        try {
            if (page && !page.isClosed()) {
                await page.close();
                Log.info('错误处理：登录页面已关闭');
            }
        } catch (e) {
            Log.debug('关闭页面失败（忽略）');
        }

        // 不关闭浏览器上下文，保留Cookie供后续使用
        Log.info('✅ 登录出错，但浏览器上下文已保留供后续使用');

        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 实际检查登录状态（打开浏览器页面验证）
 */
async function actuallyCheckLoginStatus(platform: string, accountId?: number | string): Promise<{ isLoggedIn: boolean; userInfo?: any }> {
    let page: Page | null = null;
    try {
        Log.info(`开始实际检查${platform}登录状态, accountId=${accountId}`);

        const context = await getBrowserContext(platform, accountId);

        // 🔧 优化：先检查是否有已打开的页面可以复用
        const existingPages = context.pages();
        const availablePage = existingPages.find(p => !p.isClosed());

        if (availablePage) {
            // 如果有可用页面，复用它而不是创建新页面
            page = availablePage;
            Log.info(`复用已存在的页面: ${page.url()}`);
        } else {
            // 如果没有可用页面，创建新页面
            page = await context.newPage();
            Log.info('创建新页面用于登录检查');
        }

        page.setDefaultTimeout(20000); // 减少默认超时时间
        page.setDefaultNavigationTimeout(20000); // 减少导航超时时间

        // 根据平台确定检查URL
        let checkUrl = '';
        if (platform === 'douyin') {
            checkUrl = 'https://creator.douyin.com/creator-micro/content/upload';
        } else if (platform === 'kuaishou') {
            checkUrl = 'https://cp.kuaishou.com/article/publish';
        } else if (platform === 'shipin') {
            checkUrl = 'https://channels.weixin.qq.com/platform/post/create';
        } else if (platform === 'xiaohongshu') {
            checkUrl = 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=video';
        } else {
            throw new Error(`不支持的平台: ${platform}`);
        }

        // 导航到检查页面（使用domcontentloaded更快，不等待所有资源）
        let currentUrl = '';

        // 🔧 优化：如果页面已经在目标URL，就不需要重新导航
        const currentPageUrl = page.url();
        if (currentPageUrl.includes(checkUrl.split('/').slice(-2).join('/')) ||
            (platform === 'douyin' && currentPageUrl.includes('creator.douyin.com') && !currentPageUrl.includes('login'))) {
            // 页面已经在目标URL或相关页面，直接使用
            currentUrl = currentPageUrl;
            Log.info(`页面已在目标URL，无需重新导航: ${currentUrl}`);
        } else {
            // 需要导航到检查页面
            try {
                await page.goto(checkUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 20000 // 减少超时时间
                });
                Log.info('页面已打开');
                currentUrl = page.url();
            } catch (error: any) {
                Log.info(`页面加载超时或失败: ${error.message}`);
                // 即使超时，也尝试获取当前URL
                try {
                    currentUrl = page.url();
                    Log.info(`获取到当前URL: ${currentUrl}`);
                } catch (urlError: any) {
                    Log.error(`无法获取URL: ${urlError.message}`);
                    // 如果无法获取URL，直接返回未登录
                    return { isLoggedIn: false };
                }
                Log.info('继续执行登录状态检查...');
            }
        }

        // 等待页面渲染（缩短等待时间）
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 如果之前获取URL失败，再次尝试
        if (!currentUrl) {
            try {
                currentUrl = page.url();
            } catch (e) {
                Log.error('无法获取页面URL');
                return { isLoggedIn: false };
            }
        }

        Log.info(`${platform}当前URL: ${currentUrl}`);

        // 根据平台检查登录状态
        let isLoggedIn = false;
        let userInfo: any = {};

        if (platform === 'douyin') {
            // 参考 aigc-human 项目：用 #header-avatar 精确检测登录状态
            if (currentUrl.includes('login') || currentUrl.includes('passport') || currentUrl.includes('sso') || currentUrl.includes('verify')) {
                isLoggedIn = false;
                Log.info(`${platform}检测到登录页面，未登录`);
            } else if (currentUrl.includes('creator.douyin.com')) {
                try {
                    // 等页面完全加载
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    // 🔥 核心检测：查找 #header-avatar（参考 aigc-human douYinService.js:247）
                    const avatarElement = await page.$('#header-avatar');
                    if (avatarElement) {
                        isLoggedIn = true;
                        userInfo.nickname = '用户';
                        Log.info(`${platform}检测到 #header-avatar，已登录`);
                    } else {
                        // 备用：检查 input[type=file]（上传页面的标志）
                        const fileInputCount = await page.locator('input[type="file"]').count();
                        if (fileInputCount > 0) {
                            isLoggedIn = true;
                            userInfo.nickname = '用户';
                            Log.info(`${platform}检测到文件输入框，已登录`);
                        } else {
                            isLoggedIn = false;
                            Log.info(`${platform}未检测到 #header-avatar 和文件输入框，未登录`);
                        }
                    }
                } catch (error: any) {
                    Log.error(`${platform}登录检测过程出错:`, error);
                    isLoggedIn = false;
                }
            } else {
                isLoggedIn = false;
                Log.info(`${platform}URL不在creator.douyin.com，未登录`);
            }
        } else if (platform === 'kuaishou') {
            if (currentUrl.includes('cp.kuaishou.com') && !currentUrl.includes('login')) {
                try {
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    if (fileInputCount > 0 || currentUrl.includes('publish') || currentUrl.includes('article')) {
                        isLoggedIn = true;
                        userInfo.nickname = '用户';
                    } else {
                        isLoggedIn = false;
                    }
                } catch {
                    isLoggedIn = false;
                }
            } else {
                isLoggedIn = false;
            }
        } else if (platform === 'shipin') {
            // 视频号登录状态检测（严格模式）
            // 根本原则：只有确实有文件输入框才是真正登录

            // 首先检查是否在登录/认证页面（明确的未登录标志）
            const isLoginPage = currentUrl.includes('login') ||
                currentUrl.includes('auth') ||
                currentUrl.includes('weixin.qq.com/qr') ||
                currentUrl.includes('mp.weixin.qq.com') ||
                currentUrl.includes('servicelogin');

            if (isLoginPage) {
                isLoggedIn = false;
                Log.info(`${platform}检测到登录页面，未登录`);
            } else if (currentUrl.includes('channels.weixin.qq.com')) {
                try {
                    // 🔧 关键修复：等待5秒让页面完全加载（之前只等2秒，导致误判为未登录）
                    Log.info(`${platform}等待5秒让页面完全加载...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // 严格检查1：必须有文件输入框（真正的登录标志）
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    Log.info(`${platform}检测到文件输入框数量: ${fileInputCount}`);

                    if (fileInputCount > 0) {
                        // 🔧 关键修复：只要文件输入框存在就说明已登录
                        // 不需要检查它是否可见，因为在视频号页面上文件输入框通常被隐藏（这是正常的）
                        // 只要页面加载完整并能找到输入框，就证明用户已登录

                        isLoggedIn = true;
                        userInfo.nickname = '用户';
                        Log.info(`${platform}检测到文件输入框（${fileInputCount}个），确认已登录`);
                    } else {
                        // 没有文件输入框 = 未登录（即使在上传页面）
                        isLoggedIn = false;
                        Log.info(`${platform}未找到文件输入框，确认未登录`);

                        // 额外诊断：检查页面内容是什么
                        const bodyText = await page.locator('body').textContent().catch(() => '');
                        const pageInfo = bodyText?.substring(0, 100) || '无法获取';
                        Log.info(`${platform}页面内容诊断: ${pageInfo}`);
                    }
                } catch (error: any) {
                    Log.error(`${platform}登录检测过程出错: ${error.message}`);
                    isLoggedIn = false;
                }
            } else {
                isLoggedIn = false;
                Log.info(`${platform}URL不在视频号域名，未登录`);
            }
        } else if (platform === 'xiaohongshu') {
            // 检查是否在登录页面
            const isLoginPage = currentUrl.includes('login') ||
                currentUrl.includes('passport') ||
                currentUrl.includes('account');

            if (isLoginPage) {
                isLoggedIn = false;
                Log.info(`${platform}检测到登录页面，未登录`);
            } else if (currentUrl.includes('creator.xiaohongshu.com')) {
                try {
                    // 必须找到文件输入框才能确定已登录（真正登录后才能看到上传界面）
                    await page.waitForTimeout(2000); // 等待页面加载

                    const fileInputCount = await page.locator('input[type="file"]').count();
                    if (fileInputCount > 0) {
                        // 再次验证：检查文件输入框是否真的可用
                        const isFileInputVisible = await page.locator('input[type="file"]').first()
                            .evaluate((el: any) => {
                                // 检查输入框是否在可见的容器中
                                let parent = el.parentElement;
                                let depth = 0;
                                while (parent && depth < 5) {
                                    const style = window.getComputedStyle(parent);
                                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                                        return false;
                                    }
                                    parent = parent.parentElement;
                                    depth++;
                                }
                                return true;
                            }).catch(() => true);

                        if (isFileInputVisible) {
                            isLoggedIn = true;
                            userInfo.nickname = '用户';
                            Log.info(`${platform}检测到文件输入框，已登录`);
                        } else {
                            isLoggedIn = false;
                            Log.info(`${platform}文件输入框不可见，未登录`);
                        }
                    } else {
                        isLoggedIn = false;
                        Log.info(`${platform}未找到文件输入框，未登录`);
                    }
                } catch (error: any) {
                    Log.error(`${platform}登录检测过程出错:`, error);
                    isLoggedIn = false;
                }
            } else {
                isLoggedIn = false;
                Log.info(`${platform}URL不在小红书域名，未登录`);
            }
        }

        Log.info(`${platform}登录状态检查完成: ${isLoggedIn ? '已登录' : '未登录'}`);

        // 🔧 优化：不关闭浏览器上下文，保留以供后续发布使用
        // 这样可以复用已登录的会话，提高效率
        if (isLoggedIn) {
            Log.info(`✅ 检测到已登录，保留浏览器供后续发布使用`);
        } else {
            Log.info(`⚠️ 未登录，保留浏览器供用户继续登录`);
        }

        return { isLoggedIn, userInfo };

    } catch (error: any) {
        Log.error(`检查${platform}登录状态失败:`, {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        // 超时错误不算严重，返回未登录状态即可
        if (error.name === 'TimeoutError') {
            Log.info(`${platform}登录状态检查超时，返回未登录状态`);
        }

        // 🔧 优化：即使出错，也保留页面和浏览器上下文供后续使用
        // 不关闭页面和浏览器上下文！即使发生错误，也要保留供后续发布使用
        Log.info(`⚠️ 登录检查出错，但页面和浏览器上下文已保留供后续发布使用`);

        return { isLoggedIn: false };
    }
}

/**
 * 检查登录状态
 */
ipcMain.handle('publish:checkLoginStatus', async (event, params: { platform: string; accountId?: number; checkBrowser?: boolean }) => {
    try {
        const { platform, accountId, checkBrowser = true } = params; // 默认为true，总是进行真实检查

        // 🔧 修改：如果 checkBrowser 为 false，只从数据库读取状态，不打开浏览器
        // 如果 checkBrowser 为 true（默认），必须真正打开浏览器检测登录状态
        if (checkBrowser === false) {
            let account;
            if (accountId) {
                account = await DbMain.first(
                    'SELECT * FROM platform_accounts WHERE id = ?',
                    [accountId]
                );
            } else {
                account = await DbMain.first(
                    'SELECT * FROM platform_accounts WHERE platform = ? AND loginStatus = ? ORDER BY updatedAt DESC LIMIT 1',
                    [platform, 'active']
                );
            }

            if (account) {
                return {
                    success: true,
                    isLoggedIn: true,
                    userInfo: {
                        nickname: account.nickname,
                        userId: account.uid
                    }
                };
            } else {
                return {
                    success: true,
                    isLoggedIn: false
                };
            }
        }

        // checkBrowser 为 true 时，必须真正打开浏览器检测登录状态
        // 实际检查登录状态（打开浏览器页面验证）
        // 这确保每次都获取最新的真实登录状态
        const actualStatus = await actuallyCheckLoginStatus(platform, accountId);

        let account;
        if (accountId) {
            account = await DbMain.first(
                'SELECT * FROM platform_accounts WHERE id = ?',
                [accountId]
            );
        } else {
            account = await DbMain.first(
                'SELECT * FROM platform_accounts WHERE platform = ? AND loginStatus = ? ORDER BY updatedAt DESC LIMIT 1',
                [platform, 'active']
            );
        }

        // 如果实际检查结果是未登录，更新数据库状态
        if (!actualStatus.isLoggedIn) {
            if (account) {
                Log.info(`检测到${platform}实际未登录，更新数据库状态`);
                await DbMain.execute(
                    'UPDATE platform_accounts SET loginStatus = ? WHERE id = ?',
                    ['inactive', account.id]
                );
            }
            return {
                success: true,
                isLoggedIn: false
            };
        }

        // 如果实际检查结果是已登录
        if (actualStatus.isLoggedIn) {
            const now = Date.now();

            // 如果数据库中有账号记录，更新它
            if (account) {
                Log.info(`检测到${platform}已登录，更新数据库信息`);
                await DbMain.execute(
                    'UPDATE platform_accounts SET nickname = ?, updatedAt = ?, loginStatus = ? WHERE id = ?',
                    [actualStatus.userInfo?.nickname || account.nickname, now, 'active', account.id]
                );
                return {
                    success: true,
                    isLoggedIn: true,
                    userInfo: {
                        nickname: actualStatus.userInfo?.nickname || account.nickname,
                        userId: account.uid
                    }
                };
            } else {
                // 如果数据库中没有账号记录，但实际已登录，创建新记录
                Log.info(`检测到${platform}已登录但数据库无记录，创建新记录`);
                const userId = `user_${now}`;
                const accountId = await DbMain.insert(
                    `INSERT INTO platform_accounts (platform, uid, nickname, cookies, loginStatus, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        platform,
                        userId,
                        actualStatus.userInfo?.nickname || '用户',
                        '[]',
                        'active',
                        now,
                        now
                    ]
                );
                return {
                    success: true,
                    isLoggedIn: true,
                    userInfo: {
                        nickname: actualStatus.userInfo?.nickname || '用户',
                        userId: userId
                    }
                };
            }
        }

        // 如果实际检查结果是未登录，已在上面的分支处理
        return {
            success: false,
            isLoggedIn: false
        };

    } catch (error: any) {
        Log.error('publish.checkLoginStatus error', error);
        return {
            success: false,
            message: error.message,
            isLoggedIn: false
        };
    }
});

/**
 * 关闭指定平台的浏览器
 */
ipcMain.handle('publish:closeBrowser', async (event, params: { platform: string }) => {
    try {
        const { platform } = params;
        Log.info(`关闭${platform}浏览器`);

        await closeBrowserContext(platform);

        return {
            success: true,
            message: `已关闭${platform}浏览器`
        };
    } catch (error: any) {
        Log.error('publish.closeBrowser error', error);
        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 执行发布
 */
ipcMain.handle('publish:execute', async (event, params: ExecutePublishParams) => {
    try {
        const { platform, videoPath, coverPath, title, description, tags } = params;

        Log.info(`开始发布到${platform}`, { platform, accountId: params.accountId });
        Log.info(`发布参数检查: autoPublish=${params.autoPublish}, type=${typeof params.autoPublish}`);

        if (!videoPath || !fs.existsSync(videoPath)) {
            throw new Error('视频文件不存在');
        }

        if (!coverPath || !fs.existsSync(coverPath)) {
            throw new Error('封面文件不存在');
        }

        // 🔥 优先使用前端传入的 accountId，否则自动获取最新活跃账号
        let account;
        if (params.accountId) {
            account = await DbMain.first(
                'SELECT * FROM platform_accounts WHERE id = ?',
                [params.accountId]
            );
        } else {
            account = await DbMain.first(
                'SELECT * FROM platform_accounts WHERE platform = ? AND loginStatus = ? ORDER BY updatedAt DESC LIMIT 1',
                [platform, 'active']
            );
        }

        if (!account) {
            throw new Error('未找到登录账号，请先登录');
        }

        const accountId = account.id;
        Log.info(`使用账号: ${account.nickname}`, { accountId });

        const outputDir = path.join(os.homedir(), '.aigcpanel', 'data', 'hub');
        let adaptedCoverPath = coverPath;

        try {
            Log.info('开始适配封面...', {
                原始封面: coverPath,
                平台: platform,
                输出目录: outputDir
            });

            const adaptResult = await CoverAdapter.adaptCover({
                coverPath,
                platform,
                outputDir
            });

            adaptedCoverPath = adaptResult.adaptedPath;

            // 验证生成的文件
            if (fs.existsSync(adaptedCoverPath)) {
                const stats = fs.statSync(adaptedCoverPath);
                const ext = path.extname(adaptedCoverPath).toLowerCase();
                Log.info('封面适配完成', {
                    platform,
                    适配后路径: adaptedCoverPath,
                    文件大小: `${(stats.size / 1024).toFixed(2)}KB`,
                    文件扩展名: ext,
                    adjustments: adaptResult.adjustments
                });

                // 确保是jpg格式
                if (ext !== '.jpg' && ext !== '.jpeg') {
                    Log.error(`警告：生成的封面格式不是JPG: ${ext}`);
                }
            } else {
                Log.error('适配后的封面文件不存在！');
                throw new Error('适配后的封面文件不存在');
            }
        } catch (error: any) {
            Log.error('封面适配失败，将使用原文件', {
                错误信息: error.message,
                原始文件: coverPath,
                原始文件是否存在: fs.existsSync(coverPath)
            });

            // 检查原始文件格式
            const originalExt = path.extname(coverPath).toLowerCase();
            if (originalExt !== '.jpg' && originalExt !== '.jpeg') {
                Log.error(`原始封面格式不是JPG: ${originalExt}，抖音可能不支持`);
            }
        }

        // 获取浏览器上下文（加载指定账号的 cookies）
        const context = await getBrowserContext(platform, accountId);

        // 执行平台特定的发布操作
        let result: any = {};
        if (platform === 'douyin') {
            result = await publishToDouyin(context, {
                videoPath,
                coverPath: adaptedCoverPath,
                title,
                description,
                tags,
                autoPublish: params.autoPublish
            });
        } else if (platform === 'kuaishou') {
            result = await publishToKuaishou(context, {
                videoPath,
                coverPath: adaptedCoverPath,
                title,
                description,
                tags,
                autoPublish: params.autoPublish
            });
        } else if (platform === 'shipin') {
            result = await publishToShipin(context, {
                videoPath,
                coverPath: adaptedCoverPath,
                title,
                description,
                tags,
                autoPublish: params.autoPublish
            });
        } else if (platform === 'xiaohongshu') {
            result = await publishToXiaohongshu(context, {
                videoPath,
                coverPath: adaptedCoverPath,
                title,
                description,
                tags,
                autoPublish: params.autoPublish
            });
        } else {
            throw new Error(`不支持的平台: ${platform}`);
        }

        const resultStatus: PublishResultStatus = result.status || (result.success ? 'success' : 'failed');

        if (resultStatus === 'verification_required' || resultStatus === 'manual_pending') {
            await DbMain.insert(
                `INSERT INTO publish_history (taskId, platform, accountId, videoUrl, videoId, status, errorMessage, publishedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    params.taskId || 0,
                    platform,
                    accountId,
                    result.videoUrl || '',
                    result.videoId || '',
                    resultStatus,
                    result.message || '',
                    Date.now()
                ]
            );

            Log.warn(`发布进入待确认状态: ${platform}`, {
                status: resultStatus,
                message: result.message,
                videoUrl: result.videoUrl
            });

            return {
                success: false,
                pending: true,
                status: resultStatus,
                message: result.message,
                videoUrl: result.videoUrl,
                videoId: result.videoId,
                platform
            };
        }

        if (!result.success) {
            throw new Error(result.message || '发布失败');
        }

        await DbMain.insert(
            `INSERT INTO publish_history (taskId, platform, accountId, videoUrl, videoId, status, errorMessage, publishedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                params.taskId || 0,
                platform,
                accountId,
                result.videoUrl || '',
                result.videoId || '',
                'success',
                '',
                Date.now()
            ]
        );

        Log.info(`发布成功: ${platform}`, { videoId: result.videoId, videoUrl: result.videoUrl });

        return {
            success: true,
            status: 'success',
            videoUrl: result.videoUrl,
            videoId: result.videoId,
            platform
        };

    } catch (error: any) {
        Log.error('publish.execute error', {
            message: error.message,
            stack: error.stack,
            platform: params.platform
        });

        // 记录失败历史
        try {
            // 尝试获取账号ID
            let accountId = 0;
            try {
                const account = await DbMain.first(
                    'SELECT id FROM platform_accounts WHERE platform = ? AND loginStatus = ? ORDER BY updatedAt DESC LIMIT 1',
                    [params.platform, 'active']
                );
                accountId = account?.id || 0;
            } catch (e) {
                // 忽略错误
            }

            await DbMain.insert(
                `INSERT INTO publish_history (taskId, platform, accountId, status, errorMessage, publishedAt)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    params.taskId || 0,
                    params.platform,
                    accountId,
                    'failed',
                    error.message,
                    Date.now()
                ]
            );
        } catch (e) {
            Log.error('Failed to save error history', e);
        }

        return {
            success: false,
            message: error.message,
            platform: params.platform
        };
    }
});

/**
 * 发布到抖音（使用改进版脚本逻辑）
 */
async function publishToDouyin(context: BrowserContext, params: {
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    autoPublish?: boolean;
}): Promise<any> {
    let page: Page | null = null;

    try {
        Log.info('开始发布到抖音');

        // 创建新页面
        page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);
        Log.info('浏览器页面创建成功');

        // 导航到抖音上传页面（直接访问上传URL）
        Log.info('导航到抖音上传页面');
        const uploadUrl = 'https://creator.douyin.com/creator-micro/content/upload';
        Log.info(`URL: ${uploadUrl}`);

        await page.goto(uploadUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        Log.info(`当前URL: ${currentUrl}`);

        // 🔥 参考 aigc-human 项目：先检查 #header-avatar 确认登录状态
        const avatarElement = await page.$('#header-avatar');
        if (!avatarElement) {
            // 检查是否被重定向到登录页
            if (currentUrl.includes('login') || currentUrl.includes('passport')) {
                Log.error('未登录：被重定向到登录页');
                throw new Error('未登录抖音，请先在账号管理中扫码登录');
            }
            // 再等几秒看看
            await page.waitForTimeout(5000);
            const avatarRetry = await page.$('#header-avatar');
            if (!avatarRetry) {
                Log.error('未检测到 #header-avatar，cookies 可能已过期');
                throw new Error('抖音登录已过期，请重新扫码登录');
            }
        }
        Log.info('✅ 检测到 #header-avatar，已登录');

        // 确保在上传页面
        if (!currentUrl.includes('content/upload')) {
            Log.info('不在上传页面，导航到上传页...');
            await page.goto(uploadUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
        }

        // ========== 步骤1: 上传视频 ==========
        Log.info('【步骤1】上传视频文件');

        // 🔥 参考 aigc-human 项目：用 waitForSelector 等待上传控件出现
        Log.info('等待上传输入框就绪...');
        try {
            await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 60000 });
            Log.info('上传输入框已就绪');
        } catch (e) {
            Log.error('等待上传输入框超时（60秒）');
            throw new Error('上传页面加载超时，请检查网络或重新登录');
        }

        // 查找文件输入框
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) {
            throw new Error('未找到文件上传输入框');
        }

        Log.info(`上传文件: ${params.videoPath}`);

        try {
            await fileInput.setInputFiles(params.videoPath);
            Log.info('视频文件已上传');
        } catch (error: any) {
            Log.error(`文件上传失败: ${error.message}`);
            throw error;
        }

        await page.waitForTimeout(3000);

        // ========== 步骤2: 等待视频处理 ==========
        Log.info('【步骤2】等待视频处理');

        try {
            await Promise.race([
                page.locator('text="预览视频"').waitFor({ timeout: 60000 }).catch(() => null),
                page.locator('text="预览"').waitFor({ timeout: 60000 }).catch(() => null),
                new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), 60000))
            ]).catch(() => {
                Log.info('未检测到预览元素，继续...');
            });

            Log.info('视频处理完成');
        } catch (error: any) {
            Log.info(`预览检测失败: ${error.message}`);
        }

        await page.waitForTimeout(2000);

        // 等待上传完成（最多5分钟）
        Log.info('等待视频上传完成...');
        let uploadComplete = false;
        const maxWaitTime = 300000; // 5分钟
        const startTime = Date.now();

        while (!uploadComplete && (Date.now() - startTime) < maxWaitTime) {
            try {
                // 检查是否有上传成功的标识
                const successIndicator = page.locator('[data-e2e="upload-success"], .upload-success, [class*="success"]').first();
                if (await successIndicator.isVisible({ timeout: 1000 })) {
                    uploadComplete = true;
                    Log.info('检测到上传成功标识');
                    break;
                }
            } catch (e) {
                // 继续等待
            }

            // 检查是否可以填写标题（说明上传完成）
            try {
                const titleInput = page.locator('textarea[placeholder*="标题"], input[placeholder*="标题"]').first();
                if (await titleInput.isVisible({ timeout: 1000 }) && await titleInput.isEnabled()) {
                    uploadComplete = true;
                    Log.info('标题输入框可用，上传应该已完成');
                    break;
                }
            } catch (e) {
                // 继续等待
            }

            await page.waitForTimeout(2000);
            Log.info(`上传中... 已等待 ${Math.floor((Date.now() - startTime) / 1000)} 秒`);
        }

        if (!uploadComplete) {
            Log.info('上传超时，但继续尝试填写表单');
        }

        // ========== 步骤3: 上传封面 ==========
        // 🔥 参考 aigc-human 项目的 uploadCustomCover 方法
        Log.info('【步骤3】上传封面');
        await page.waitForTimeout(3000);

        try {
            // 查找封面控制区域（竖封面 3:4）
            const coverControlXPath = '//div[contains(@class, "coverControl-CjlzqC")][.//div[contains(text(), "竖封面3:4")]]';
            let coverControl = await page.$(coverControlXPath);

            // 如果没找到竖封面控制，尝试点击"选择封面"按钮
            if (!coverControl) {
                Log.info('未找到封面控制区域，尝试点击"选择封面"按钮');
                const coverBtn = page.locator('text="选择封面"').first();
                if (await coverBtn.count() > 0) {
                    await coverBtn.click();
                    Log.info('已点击选择封面');
                    await page.waitForTimeout(3000);
                    // 再次查找
                    coverControl = await page.$(coverControlXPath);
                }
            }

            if (coverControl) {
                // 点击封面控制区域打开弹窗
                await coverControl.click();
                Log.info('已点击封面控制区域');
                await page.waitForTimeout(2000);

                // 🔥 精确定位弹窗内的上传 input（参考 aigc-human douYinService.js:690）
                try {
                    await page.waitForSelector('.upload-BvM5FF .semi-upload-hidden-input', { state: 'attached', timeout: 10000 });
                    const uploadInput = await page.$('.upload-BvM5FF .semi-upload-hidden-input');

                    if (uploadInput) {
                        await uploadInput.setInputFiles(params.coverPath);
                        Log.info(`封面文件已上传: ${params.coverPath}`);
                        await page.waitForTimeout(3000);
                    } else {
                        Log.info('未找到 .upload-BvM5FF 上传输入框，尝试通用选择器');
                        // 回退：查找弹窗中第一个图片 input
                        const imageInput = await page.$('input[type="file"][accept*="image/png"]');
                        if (imageInput) {
                            await imageInput.setInputFiles(params.coverPath);
                            Log.info('使用通用图片输入框上传封面');
                            await page.waitForTimeout(3000);
                        } else {
                            Log.info('未找到任何可用的图片上传输入框');
                        }
                    }
                } catch (waitError: any) {
                    Log.info(`等待上传输入框失败: ${waitError.message}，尝试通用选择器`);
                    const imageInput = await page.$('input[type="file"][accept*="image/png"]');
                    if (imageInput) {
                        await imageInput.setInputFiles(params.coverPath);
                        Log.info('使用通用图片输入框上传封面');
                        await page.waitForTimeout(3000);
                    }
                }

                // 点击完成按钮（参考 aigc-human douYinService.js:698）
                const completeBtnXPath = '//*[@id="tooltip-container"]//button[1]';
                try {
                    await page.waitForSelector(completeBtnXPath, { timeout: 10000 });
                    const completeBtn = await page.$(completeBtnXPath);
                    if (completeBtn) {
                        // 等待按钮可点击
                        await page.waitForTimeout(2000);
                        await completeBtn.click();
                        Log.info('已点击完成按钮');
                        await page.waitForTimeout(2000);
                    }
                } catch (e: any) {
                    // 尝试其他完成按钮选择器
                    const doneBtn = page.locator('button:has-text("完成")').first();
                    if (await doneBtn.count() > 0) {
                        await doneBtn.click();
                        Log.info('已点击完成（备用选择器）');
                        await page.waitForTimeout(2000);
                    }
                }

                Log.info('封面设置完成');
            } else {
                Log.info('未找到封面控制区域，跳过封面上传');
            }
        } catch (error: any) {
            Log.info(`封面上传失败: ${error.message}`);
            // 不抛出错误，继续后续步骤
        }

        // 🔥 自动关闭所有可能弹出的弹窗（如"设置横封面获取更多流量"）
        try {
            await page.waitForTimeout(1000);
            // 点击"暂不设置"跳过横封面设置
            const skipBtn = page.locator('button:has-text("暂不设置"), button:has-text("暂不"), button:has-text("跳过")').first();
            if (await skipBtn.count() > 0) {
                await skipBtn.click();
                Log.info('已关闭弹窗：点击"暂不设置"');
                await page.waitForTimeout(1000);
            }
            // 关闭可能残留的其他弹窗（X 关闭按钮）
            const closeButtons = await page.$$('.semi-modal-close, [aria-label="close"], [class*="close-icon"], [class*="CloseBtn"]');
            for (const closeBtn of closeButtons) {
                try {
                    await closeBtn.click();
                    Log.info('已关闭弹窗：点击 X');
                    await page.waitForTimeout(500);
                } catch { }
            }
        } catch (e: any) {
            Log.debug(`关闭弹窗时出错（忽略）: ${e.message}`);
        }

        // ========== 步骤4: 填写标题 ==========
        Log.info('【步骤4】填写标题');

        try {
            const titleSelectors = [
                'input[placeholder*="填写作品标题"]',
                'input[placeholder*="标题"]',
                'input[placeholder*="作品"]',
                '//input[contains(@placeholder, "填写作品标题")]'
            ];

            let titleInput: any = null;

            for (const selector of titleSelectors) {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    titleInput = page.locator(selector).first();
                    Log.debug(`找到标题输入框: ${selector}`);
                    break;
                }
            }

            if (titleInput) {
                const title = params.title.slice(0, 20); // 抖音标题限制20字
                await titleInput.fill(title);
                Log.info(`标题已填写: "${title}"`);
            } else {
                Log.info('未找到标题输入框');
            }
        } catch (error: any) {
            Log.info(`标题填写失败: ${error.message}`);
        }

        await page.waitForTimeout(1000);

        // 填写描述（填写话题内容）
        Log.info('填写描述（使用话题内容）...');
        try {
            // 尝试多种选择器查找描述输入框
            const descSelectors = [
                'textarea[placeholder*="描述"]',
                'textarea[placeholder*="简介"]',
                'textarea[placeholder*="作品"]',
                '[class*="desc"] textarea',
                '[class*="content"] textarea',
                'div[contenteditable="true"]'
            ];

            let descInput = null;
            for (const selector of descSelectors) {
                try {
                    const element = page.locator(selector).first();
                    await element.waitFor({ timeout: 2000 });
                    if (await element.isVisible()) {
                        descInput = element;
                        Log.info(`找到描述输入框: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // 继续尝试
                }
            }

            if (descInput) {
                // 点击输入框激活
                await descInput.click();
                await page.waitForTimeout(300);

                // 清空输入框
                await descInput.fill('');
                await page.waitForTimeout(300);

                // 逐个输入话题，每个话题后按空格让平台识别
                for (let i = 0; i < params.tags.length; i++) {
                    const tag = params.tags[i].trim();
                    const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;

                    Log.info(`输入话题 ${i + 1}/${params.tags.length}: ${cleanTag}`);

                    // 使用键盘输入话题（而不是fill，以触发平台的话题识别）
                    await page.keyboard.type(cleanTag, { delay: 50 });
                    await page.waitForTimeout(300);

                    // 按空格键触发话题识别和选择
                    await page.keyboard.press('Space');
                    await page.waitForTimeout(500);

                    // 检查是否有话题选择弹窗，如果有则选择第一个
                    try {
                        const topicPopup = page.locator('[class*="topic"], [class*="hashtag"]').first();
                        if (await topicPopup.isVisible({ timeout: 1000 })) {
                            Log.info('检测到话题选择弹窗，选择第一个选项');
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(300);
                        }
                    } catch (e) {
                        // 没有弹窗，继续
                        Log.debug('未检测到话题弹窗，继续');
                    }
                }

                Log.info(`所有话题已逐个输入完成`);
            } else {
                Log.error('未找到描述输入框');
            }
        } catch (error) {
            Log.error('填写描述失败', { message: error.message });
        }

        await page.waitForTimeout(1000);

        // 标签已在步骤4中输入完成，无需重复输入

        await page.waitForTimeout(1000);

        // 所有准备工作已完成，等待用户手动发布
        // 所有准备工作已完成
        Log.info('=== 所有准备工作已完成 ===');
        Log.info('视频、封面、标题、描述、话题标签都已填写完成');

        if (params.autoPublish) {
            Log.info('检测到自动发布标志，准备执行点击发布按钮...');

            // 查找发布按钮（抖音创作者平台的发布按钮）
            // 抖音的发布按钮: <button class="button-xxx primary...">发布</button>
            const publishBtnSelectors = [
                'button.primary:text-is("发布")',
                'button[class*="primary"]:text-is("发布")',
                'button[class*="button-"]:text-is("发布")',
                '#popover-tip-container button:text-is("发布")',
                'button:text-is("发布")',
                'button[class*="primary"]:has-text("发布")',
                'button:has-text("确定发布")'
            ];

            let publishBtn = null;
            for (const selector of publishBtnSelectors) {
                try {
                    const btns = await page.locator(selector).all();
                    for (const btn of btns) {
                        if (await btn.isVisible().catch(() => false)) {
                            const text = await btn.textContent().catch(() => '');
                            const trimmedText = text?.trim() || '';
                            Log.info(`检查发布按钮: selector=${selector}, text="${trimmedText}"`);
                            // 确保按钮文字就是"发布"
                            if (trimmedText === '发布' || trimmedText === '确定发布') {
                                publishBtn = btn;
                                Log.info(`找到发布按钮: ${selector}, text="${trimmedText}"`);
                                break;
                            }
                        }
                    }
                    if (publishBtn) break;
                } catch (e) {
                    Log.debug(`选择器 ${selector} 检查失败: ${e.message}`);
                }
            }

            if (publishBtn) {
                await page.waitForTimeout(2000); // 稍等片刻
                await publishBtn.click(); // publish-triggered
                publishTriggered = true;
                Log.info('已自动点击发布按钮');

                // 等待发布成功提示
                try {
                    await Promise.race([
                        page.locator('text="发布成功"').waitFor({ timeout: 10000 }),
                        page.locator('text="上传成功"').waitFor({ timeout: 10000 }),
                        page.waitForTimeout(5000)
                    ]);
                    Log.info('发布操作已提交');
                } catch (e) {
                    Log.info('未检测到明确的发布成功提示，但已执行点击');
                }
            } else {
                Log.warn('未找到发布按钮，请手动点击');
            }
        } else {
            Log.info('请在浏览器中检查内容，然后手动点击发布按钮');
            Log.info('浏览器窗口将保持打开状态，等待您手动操作...');

            // 等待30秒，给用户足够时间检查和手动发布
            await page.waitForTimeout(30000);
        }

        if (params.autoPublish) {
            if (publishTriggered) {
                const publishResult = await waitForPublishConfirmation(page, 'douyin');
                if (publishResult.success) {
                    shouldClosePage = true;
                }
                return publishResult;
            }

            return {
                success: false,
                status: 'manual_pending',
                message: '未找到明确的发布按钮，请在浏览器中手动确认发布',
                videoUrl: page.url(),
                videoId: '',
                keepPageOpen: true
            };
        }

        const finalUrl = page.url();
        Log.info(`当前页面URL: ${finalUrl}`);

        return {
            success: false,
            status: 'manual_pending',
            message: '准备工作已完成，请在浏览器中手动点击发布按钮',
            videoUrl: finalUrl,
            videoId: 'manual_publish',
            keepPageOpen: true
        };

    } catch (error: any) {
        Log.error('发布到抖音失败', {
            message: error.message,
            stack: error.stack
        });

        // 尝试保存错误截图
        if (page) {
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'douyin_error.png');
                await page.screenshot({ path: screenshotPath });
                Log.info(`错误截图已保存: ${screenshotPath}`);
            } catch (e) {
                Log.error('保存截图失败', e);
            }
        }

        throw error;

    } finally {
        if (page && shouldClosePage) {
            try {
                await page.close();
                Log.info('页面已关闭');
            } catch (error) {
                Log.error('关闭页面失败', { message: error.message });
            }
        }
        // 注意：不关闭context，保持浏览器打开以便下次使用
    }
}

/**
 * 发布到快手
 */
async function publishToKuaishou(context: BrowserContext, params: {
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    autoPublish?: boolean;
}): Promise<any> {
    let page: Page | null = null;

    try {
        Log.info('开始发布到快手');

        // 验证文件
        if (!fs.existsSync(params.videoPath)) {
            throw new Error(`视频文件不存在: ${params.videoPath}`);
        }
        if (params.coverPath && !fs.existsSync(params.coverPath)) {
            Log.info('封面文件不存在，将跳过封面上传');
        }

        Log.info('文件验证通过');
        Log.info(`视频: ${path.basename(params.videoPath)}`);
        if (params.coverPath && fs.existsSync(params.coverPath)) {
            Log.info(`封面: ${path.basename(params.coverPath)}`);
        }

        page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // 导航到快手视频发布页面
        Log.info('【步骤1】导航到快手视频发布页面');
        const uploadUrl = 'https://cp.kuaishou.com/article/publish/video?tabType=1';
        Log.info(`目标URL: ${uploadUrl}`);

        // 直接导航到目标页面
        Log.info('正在导航到上传页面...');
        let currentUrl = '';

        try {
            await page.goto(uploadUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            Log.info('页面导航完成');

            // 等待页面加载
            await page.waitForTimeout(5000);

            currentUrl = page.url();
            Log.info(`导航后URL: ${currentUrl}`);

            // 如果不在目标页面，保存截图
            if (!currentUrl.includes('cp.kuaishou.com/article/publish/video')) {
                try {
                    const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_nav_result.png');
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                    Log.info(`导航后页面截图已保存: ${screenshotPath}`);
                    Log.info(`当前URL: ${currentUrl}`);
                    Log.info(`目标URL: ${uploadUrl}`);
                } catch (screenshotError) {
                    // 忽略截图错误
                }
            }
        } catch (error: any) {
            Log.error(`页面导航出错: ${error.message}`);
            currentUrl = page.url();
            Log.info(`当前URL: ${currentUrl}`);

            // 保存错误截图
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_nav_error.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                Log.info(`导航错误截图已保存: ${screenshotPath}`);
            } catch (screenshotError) {
                // 忽略截图错误
            }
        }

        // 检查是否在目标页面
        const isTargetPage = currentUrl.includes('cp.kuaishou.com/article/publish/video') ||
            currentUrl.includes('cp.kuaishou.com/article/publish') ||
            (currentUrl.includes('cp.kuaishou.com') && currentUrl.includes('publish'));

        const isLoginPage = currentUrl.includes('login') ||
            currentUrl.includes('auth') ||
            currentUrl.includes('passport') ||
            (!currentUrl.includes('cp.kuaishou.com') && currentUrl !== 'about:blank');

        // 如果不在目标页面，尝试导航或等待登录
        if (!isTargetPage && !isLoginPage) {
            Log.info('当前不在目标页面，尝试导航到上传页面...');
            try {
                await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(3000);
                currentUrl = page.url();
                Log.info(`导航后URL: ${currentUrl}`);
            } catch (navError: any) {
                Log.info(`导航失败: ${navError.message}`);
            }
        }

        // 如果检测到需要登录，等待用户登录
        if (isLoginPage || (!currentUrl.includes('cp.kuaishou.com/article/publish') && currentUrl.includes('cp.kuaishou.com'))) {
            Log.info('可能需要登录或页面未加载完成');
            Log.info('请在浏览器窗口中扫码或登录快手账号');
            Log.info('脚本将自动检测登录完成状态（最多等待3分钟）...');

            const maxWaitMs = 180000;
            const checkIntervalMs = 2000;
            const startTime = Date.now();
            let logged = false;

            while (Date.now() - startTime < maxWaitMs) {
                try {
                    await page.waitForTimeout(checkIntervalMs);
                    currentUrl = page.url();

                    const fileInputCount = await page.locator('input[type="file"]').count();
                    const elapsed = Math.round((Date.now() - startTime) / 1000);

                    if (elapsed % 5 === 0) {
                        Log.info(`[${elapsed}s] 检查状态: 文件框=${fileInputCount}, URL=${currentUrl.substring(0, 80)}...`);
                    }

                    // 检查是否已经在目标页面
                    if (currentUrl.includes('cp.kuaishou.com/article/publish/video')) {
                        logged = true;
                        Log.info('检测到已进入目标上传页面，登录成功！');
                        break;
                    }

                    // 检查是否登录但不在目标页面
                    if (!currentUrl.includes('login') &&
                        !currentUrl.includes('auth') &&
                        currentUrl.includes('cp.kuaishou.com')) {
                        logged = true;
                        Log.info('检测到已登录，但不在目标页面，将导航到上传页面');
                        break;
                    }
                } catch (e) {
                    Log.debug(`检查过程中出错: ${(e as Error).message}`);
                }
            }

            if (!logged) {
                Log.info('等待登录超时（180秒），尝试继续...');
            } else {
                // 登录成功后，明确导航到目标上传页面
                Log.info('登录成功，立即导航到目标上传页面...');
                Log.info(`目标URL: ${uploadUrl}`);

                // 等待一下确保登录状态已保存
                await page.waitForTimeout(2000);

                // 明确导航到目标URL
                try {
                    Log.info('开始导航到目标上传页面...');
                    await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await page.waitForTimeout(5000); // 等待页面完全加载

                    currentUrl = page.url();
                    Log.info(`登录后导航URL: ${currentUrl}`);

                    // 保存导航后的截图
                    try {
                        const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_after_login_nav.png');
                        await page.screenshot({ path: screenshotPath, fullPage: true });
                        Log.info(`登录后导航截图已保存: ${screenshotPath}`);
                    } catch (screenshotError) {
                        // 忽略截图错误
                    }

                    // 检查是否成功导航
                    if (currentUrl.includes('cp.kuaishou.com/article/publish/video')) {
                        Log.info('✓ 成功导航到目标上传页面');
                    } else if (currentUrl.includes('cp.kuaishou.com/article/publish')) {
                        Log.info('导航到了发布页面，但URL不完全匹配，继续执行...');
                    } else {
                        Log.info('警告：登录后导航URL不匹配');
                        Log.info(`当前URL: ${currentUrl}`);
                        Log.info(`目标URL: ${uploadUrl}`);
                        Log.info('可能需要手动导航到目标页面');
                    }
                } catch (navError: any) {
                    Log.error(`登录后导航失败: ${navError.message}`);
                    currentUrl = page.url();
                    Log.info(`当前URL: ${currentUrl}`);

                    // 保存错误截图
                    try {
                        const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_login_nav_error.png');
                        await page.screenshot({ path: screenshotPath, fullPage: true });
                        Log.info(`登录后导航错误截图已保存: ${screenshotPath}`);
                    } catch (screenshotError) {
                        // 忽略截图错误
                    }
                }
            }
        }

        // 最终确保在正确的上传页面
        currentUrl = page.url();
        Log.info(`准备开始上传，当前URL: ${currentUrl}`);

        // 如果不在目标页面，保存页面截图并记录详细信息
        if (!currentUrl.includes('cp.kuaishou.com/article/publish/video')) {
            Log.info('当前不在目标上传页面');

            // 保存页面截图以便调试
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_before_upload.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                Log.info(`页面截图已保存: ${screenshotPath}`);
            } catch (screenshotError) {
                // 忽略截图错误
            }

            // 尝试最后一次导航
            Log.info('尝试最后一次导航到目标上传页面...');
            try {
                Log.info(`导航URL: ${uploadUrl}`);
                await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(5000); // 等待页面完全加载
                currentUrl = page.url();
                Log.info(`最后导航后URL: ${currentUrl}`);

                if (!currentUrl.includes('cp.kuaishou.com/article/publish/video')) {
                    Log.info('警告：多次尝试后仍无法导航到目标页面');
                    Log.info(`目标URL应该是: ${uploadUrl}`);
                    Log.info(`实际URL是: ${currentUrl}`);
                    Log.info('将尝试在当前页面查找上传元素...');
                } else {
                    Log.info('✓ 最后导航成功，已到达目标上传页面');
                }
            } catch (navError: any) {
                Log.error(`最后导航失败: ${navError.message}`);
                Log.info(`当前URL: ${page.url()}`);
                Log.info('将尝试在当前页面查找上传元素...');
            }
        } else {
            Log.info('✓ 已在目标上传页面');
        }

        // 等待页面元素加载
        Log.info('等待页面元素加载...');
        await page.waitForTimeout(3000);

        // ========== 步骤2: 上传视频 ==========
        Log.info('【步骤2】上传视频文件');

        // 等待页面完全加载并查找文件输入框（最多等待30秒）
        Log.info('等待页面加载并查找上传视频输入框...');

        let videoInput: any = null;
        let videoInputFound = false;
        const maxWaitTime = 30000; // 最多等待30秒
        const checkInterval = 1000; // 每1秒检查一次
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime && !videoInputFound) {
            try {
                // 先检查当前URL是否还在目标页面
                currentUrl = page.url();
                if (!currentUrl.includes('cp.kuaishou.com')) {
                    Log.info('页面已跳转，尝试重新导航...');
                    await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await page.waitForTimeout(3000);
                }

                // 查找视频文件输入框
                const videoInputSelectors = [
                    'input[type="file"][accept*="video"]',
                    'input[type="file"]'
                ];

                for (const selector of videoInputSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        if (count > 0) {
                            const candidate = page.locator(selector).first();
                            const accept = await candidate.getAttribute('accept').catch(() => '');

                            Log.info(`尝试选择器: "${selector}" - 找到 ${count} 个元素`);

                            if (accept.includes('video') || !accept || count === 1) {
                                videoInput = candidate;
                                videoInputFound = true;
                                Log.info(`✓ 找到视频文件输入框: ${selector} ${accept ? `(accept="${accept}")` : ''}`);
                                break;
                            }
                        }
                    } catch (e: any) {
                        // 继续尝试下一个选择器
                    }
                }

                if (videoInputFound) {
                    break;
                }

                const elapsed = Math.round((Date.now() - startTime) / 1000);
                if (elapsed % 5 === 0 && elapsed > 0) {
                    Log.info(`[${elapsed}s] 继续查找视频文件输入框...`);
                }

                await page.waitForTimeout(checkInterval);
            } catch (e: any) {
                Log.debug(`查找文件输入框时出错: ${e.message}`);
                await page.waitForTimeout(checkInterval);
            }
        }

        if (!videoInputFound || !videoInput) {
            // 保存错误截图
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_error.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                Log.info(`错误截图已保存: ${screenshotPath}`);
            } catch (screenshotError) {
                // 忽略截图错误
            }
            throw new Error('未找到视频文件输入框，页面可能未正确加载');
        }

        // 上传视频文件
        Log.info(`准备上传文件: ${path.basename(params.videoPath)}`);

        // 等待一下确保输入框已准备好
        await page.waitForTimeout(1000);

        // 重新查找文件输入框，使用 all() 获取元素列表，避免 locator 超时
        Log.info('重新查找文件输入框以确保元素可用...');
        let actualFileInput: any = null;

        try {
            // 使用 all() 获取所有文件输入框
            const allFileInputs = await page.locator('input[type="file"]').all();
            Log.info(`找到 ${allFileInputs.length} 个文件输入框`);

            for (let i = 0; i < allFileInputs.length; i++) {
                try {
                    const input = allFileInputs[i];
                    const accept = await input.getAttribute('accept').catch(() => '');
                    const isVisible = await input.isVisible().catch(() => false);

                    Log.info(`输入框 ${i + 1}: accept="${accept}", visible=${isVisible}`);

                    if (accept.includes('video') || !accept || allFileInputs.length === 1) {
                        actualFileInput = input;
                        Log.info(`选择输入框 ${i + 1} 用于上传视频`);
                        break;
                    }
                } catch (e: any) {
                    Log.debug(`检查输入框 ${i + 1} 时出错: ${e.message}`);
                }
            }

            if (!actualFileInput) {
                // 如果没找到，使用第一个
                if (allFileInputs.length > 0) {
                    actualFileInput = allFileInputs[0];
                    Log.info('使用第一个文件输入框');
                }
            }
        } catch (e: any) {
            Log.info(`重新查找文件输入框失败: ${e.message}，使用之前找到的元素`);
            actualFileInput = videoInput;
        }

        if (!actualFileInput) {
            throw new Error('无法找到可用的文件输入框');
        }

        // 阻止系统文件选择器弹出
        await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="file"]');
            inputs.forEach((input: any) => {
                input.addEventListener('click', (e: Event) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);
                input.addEventListener('mousedown', (e: Event) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);
                input.addEventListener('mouseup', (e: Event) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);
                input.addEventListener('focus', (e: Event) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, true);
            });
        });

        // 尝试上传文件，设置较长的超时时间
        try {
            Log.info('开始上传视频文件...');

            // 直接使用 setInputFiles，不等待 locator
            await actualFileInput.setInputFiles(params.videoPath, { timeout: 60000 });
            Log.info('视频文件已上传');
        } catch (uploadError: any) {
            Log.error('文件上传失败', {
                message: uploadError.message,
                stack: uploadError.stack
            });

            // 保存错误截图
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_upload_error.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                Log.info(`上传错误截图已保存: ${screenshotPath}`);
            } catch (screenshotError) {
                // 忽略截图错误
            }

            throw new Error(`文件上传失败: ${uploadError.message}`);
        }

        // 等待视频上传和处理
        await page.waitForTimeout(3000);
        Log.info('等待视频上传处理...');

        // ========== 步骤3: 填写标题、描述和标签 ==========
        Log.info('【步骤3】填写标题、描述和标签');

        // 步骤3.1: 先查找独立的标题输入框（如果有）
        Log.info('查找标题输入框...');
        const titleSelectors = [
            'input[placeholder*="标题"]',
            'input[placeholder*="作品标题"]',
            'input[type="text"][placeholder*="标题"]',
            'input[class*="title"]',
            'textarea[placeholder*="标题"]'
        ];

        let titleInput: any = null;
        let titleFound = false;

        for (const selector of titleSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    titleInput = page.locator(selector).first();
                    const isVisible = await titleInput.isVisible().catch(() => false);
                    if (isVisible) {
                        titleFound = true;
                        Log.info(`✓ 找到标题输入框: ${selector}`);
                        break;
                    }
                }
            } catch (e: any) {
                Log.debug(`标题选择器 "${selector}" 失败: ${e.message}`);
            }
        }

        // 如果找到标题输入框，填写标题
        if (titleFound && titleInput) {
            try {
                if (params.title) {
                    Log.info(`填写标题: ${params.title}`);
                    await titleInput.click();
                    await page.waitForTimeout(300);
                    await titleInput.fill('');
                    await page.waitForTimeout(200);
                    await titleInput.fill(params.title);
                    await page.waitForTimeout(500);
                    Log.info('标题已填写');
                }
            } catch (error: any) {
                Log.info(`标题填写失败: ${error.message}，继续填写描述和标签...`);
            }
        } else {
            Log.info('未找到独立的标题输入框，标题将不单独填写');
        }

        // 步骤3.2: 查找描述输入框（contenteditable div），只填写描述和标签，不填写标题
        Log.info('查找描述输入框...');
        const descSelectors = [
            '#work-description-edit',
            'div#work-description-edit',
            'div._description_eho7l_59',
            'div[contenteditable="true"][placeholder*="添加合适的话题"]',
            'div[contenteditable="true"][id*="description"]',
            'div[contenteditable="true"][id*="work-description"]',
            'div[contenteditable="true"]'
        ];

        let descInput: any = null;
        let descFound = false;

        for (const selector of descSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    descInput = page.locator(selector).first();
                    const isVisible = await descInput.isVisible().catch(() => false);
                    const placeholder = await descInput.getAttribute('placeholder').catch(() => '');

                    Log.info(`尝试选择器: "${selector}" - 找到 ${count} 个元素`);

                    if (isVisible && (placeholder.includes('添加合适的话题') || selector.includes('work-description'))) {
                        descFound = true;
                        Log.info(`✓ 找到描述输入框: ${selector} ${placeholder ? `(placeholder="${placeholder}")` : ''}`);
                        break;
                    }
                }
            } catch (e: any) {
                Log.debug(`选择器 "${selector}" 失败: ${e.message}`);
            }
        }

        if (!descFound || !descInput) {
            Log.info('未找到指定的描述输入框，尝试查找其他contenteditable div...');
            // 尝试查找所有contenteditable div
            const allContentEditable = await page.locator('div[contenteditable="true"]').all();
            for (let i = 0; i < allContentEditable.length; i++) {
                try {
                    const div = allContentEditable[i];
                    const placeholder = await div.getAttribute('placeholder').catch(() => '');
                    const id = await div.getAttribute('id').catch(() => '');
                    const isVisible = await div.isVisible().catch(() => false);

                    if (isVisible && (placeholder.includes('添加合适的话题') || id.includes('description') || id.includes('work-description'))) {
                        descInput = div;
                        descFound = true;
                        Log.info(`找到描述输入框（通过遍历）: id="${id}", placeholder="${placeholder}"`);
                        break;
                    }
                } catch (e) {
                    // 继续
                }
            }
        }

        if (descFound && descInput) {
            try {
                await descInput.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);

                // 点击元素以激活它
                await descInput.click();
                await page.waitForTimeout(300);

                // 快手的标题、描述、标签都在同一个输入框
                // 先输入标题，然后输入标签，不需要描述内容
                Log.info('快手输入框：先填写标题，然后填写话题标签（不填写描述内容）');

                // 步骤1: 先输入标题
                Log.info(`输入标题: ${params.title}`);
                await page.keyboard.type(params.title, { delay: 50 });
                await page.waitForTimeout(300);

                // 步骤2: 输入换行符，分隔标题和标签
                await page.keyboard.press('Enter');
                await page.waitForTimeout(200);

                // 步骤3: 逐个输入话题标签，每个话题后自动空格
                if (params.tags && params.tags.length > 0) {
                    Log.info('开始逐个输入话题标签...');

                    for (let i = 0; i < params.tags.length; i++) {
                        const tag = params.tags[i];
                        Log.info(`输入话题 ${i + 1}/${params.tags.length}: ${tag}`);

                        // 输入#号
                        await page.keyboard.type('#', { delay: 100 });
                        await page.waitForTimeout(200);

                        // 输入话题文字
                        await page.keyboard.type(tag, { delay: 100 });
                        await page.waitForTimeout(300);

                        // 输入空格（自动空格，每个话题后自动空格）
                        await page.keyboard.press('Space');
                        await page.waitForTimeout(200);

                        Log.info(`话题已输入: #${tag} `);
                    }

                    Log.info(`所有话题已输入完成: ${params.tags.map(tag => `#${tag}`).join(' ')}`);
                }

                await page.waitForTimeout(500);

                // 验证是否填写成功
                const filledValue = await descInput.evaluate((el: any) => {
                    return el.innerText || el.textContent || '';
                }).catch(() => '');

                if (filledValue) {
                    Log.info(`描述和标签已填写: "${filledValue.substring(0, 100)}..."`);
                } else {
                    Log.info('内容已填写（已执行填写操作）');
                }

            } catch (error: any) {
                Log.error('填写描述失败', error);
                throw new Error(`填写描述失败: ${error.message}`);
            }
        } else {
            Log.info('未找到描述输入框，跳过填写');
        }

        // ========== 步骤4: 上传封面 ==========
        if (params.coverPath && fs.existsSync(params.coverPath)) {
            Log.info('【步骤4】上传封面');

            try {
                // 步骤1: 点击"封面设置" - 使用用户提供的选择器
                Log.info('查找并点击"封面设置"...');
                const coverSettingsSelectors = [
                    'div._cover-full-editor_ps02t_40:has-text("封面设置")',
                    'div._cover-full-editor_ps02t_40',
                    'div[class*="_cover-full-editor"]:has-text("封面设置")',
                    'div[class*="_cover-full-editor"]',
                    'text=/封面设置/'
                ];

                let coverSettingsFound = false;
                for (const selector of coverSettingsSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        Log.info(`尝试选择器 "${selector}": 找到 ${count} 个元素`);

                        if (count > 0) {
                            // 尝试所有匹配的元素
                            const allMatches = await page.locator(selector).all();
                            for (const element of allMatches) {
                                try {
                                    const isVisible = await element.isVisible().catch(() => false);
                                    const text = await element.textContent().catch(() => '');
                                    const className = await element.getAttribute('class').catch(() => '');

                                    Log.info(`检查元素: visible=${isVisible}, text="${text}", class="${className}"`);

                                    if (isVisible && (text && text.includes('封面设置') || className.includes('_cover-full-editor'))) {
                                        Log.info(`找到"封面设置"按钮: ${selector}, class="${className}"`);
                                        await element.scrollIntoViewIfNeeded();
                                        await page.waitForTimeout(300);
                                        await element.click();
                                        await page.waitForTimeout(1500); // 等待面板打开
                                        coverSettingsFound = true;
                                        Log.info('已点击"封面设置"按钮');
                                        break;
                                    }
                                } catch (e: any) {
                                    Log.debug(`点击元素时出错: ${e.message}`);
                                }
                            }
                            if (coverSettingsFound) break;
                        }
                    } catch (e: any) {
                        Log.debug(`选择器 "${selector}" 失败: ${e.message}`);
                    }
                }

                if (!coverSettingsFound) {
                    Log.info('未找到"封面设置"按钮，尝试直接查找上传封面按钮...');
                } else {
                    // 等待封面设置面板完全打开
                    await page.waitForTimeout(1000);
                    Log.info('封面设置面板应已打开');
                }

                // 步骤2: 点击"上传封面" - 使用用户提供的选择器
                Log.info('查找并点击"上传封面"...');

                const uploadCoverSelectors = [
                    'div._header-title-item_2t3fe_27:has-text("上传封面")',
                    'div._header-title-item_2t3fe_27',
                    'div[class*="_header-title-item"]:has-text("上传封面")',
                    'div[class*="_header-title-item"]',
                    'text=/上传封面/'
                ];

                let uploadCoverFound = false;
                for (const selector of uploadCoverSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        Log.info(`尝试选择器 "${selector}": 找到 ${count} 个元素`);

                        if (count > 0) {
                            // 尝试所有匹配的元素
                            const allMatches = await page.locator(selector).all();
                            for (const element of allMatches) {
                                try {
                                    const isVisible = await element.isVisible().catch(() => false);
                                    const text = await element.textContent().catch(() => '');
                                    const className = await element.getAttribute('class').catch(() => '');

                                    Log.info(`检查元素: visible=${isVisible}, text="${text}", class="${className}"`);

                                    if (isVisible && (text && text.includes('上传封面') || className.includes('_header-title-item'))) {
                                        Log.info(`找到"上传封面"按钮: ${selector}, class="${className}"`);
                                        await element.scrollIntoViewIfNeeded();
                                        await page.waitForTimeout(300);
                                        await element.click();
                                        await page.waitForTimeout(1500); // 等待对话框打开
                                        uploadCoverFound = true;
                                        Log.info('已点击"上传封面"按钮');
                                        break;
                                    }
                                } catch (e: any) {
                                    Log.debug(`点击元素时出错: ${e.message}`);
                                }
                            }
                            if (uploadCoverFound) break;
                        }
                    } catch (e: any) {
                        Log.debug(`选择器 "${selector}" 失败: ${e.message}`);
                    }
                }

                if (!uploadCoverFound) {
                    Log.info('未找到"上传封面"按钮，尝试直接查找"上传图片"按钮...');
                } else {
                    // 等待上传封面对话框完全打开
                    await page.waitForTimeout(1000);
                    Log.info('上传封面对话框应已打开');
                }

                // 步骤3: 查找"上传图片"对应的文件输入框（不点击按钮，避免弹出系统选择框）
                Log.info('查找"上传图片"对应的文件输入框...');

                // 等待页面加载完成
                await page.waitForTimeout(1000);

                // 步骤4: 查找并上传封面文件
                Log.info('查找封面文件输入框...');

                const coverInputSelectors = [
                    'input[type="file"][accept*="image"]:not([accept*="video"])',
                    'input[type="file"][accept*="image"]',
                    'input[type="file"]'
                ];

                let coverInput: any = null;
                let coverInputFound = false;

                // 先查找所有文件输入框
                const allFileInputs = await page.locator('input[type="file"]').all();
                Log.info(`页面中共有 ${allFileInputs.length} 个文件输入框`);

                // 收集所有符合条件的输入框，选择最后一个（最新打开的对话框）
                const validInputs: any[] = [];
                for (let i = 0; i < allFileInputs.length; i++) {
                    try {
                        const input = allFileInputs[i];
                        const accept = await input.getAttribute('accept').catch(() => '');
                        const isVisible = await input.isVisible().catch(() => false);

                        Log.info(`文件输入框 ${i + 1}: accept="${accept}", visible=${isVisible}`);

                        if (accept.includes('image') && !accept.includes('video')) {
                            validInputs.push({ input, accept, index: i + 1 });
                            Log.info(`✓ 输入框 ${i + 1} 符合条件（接受图片）`);
                        }
                    } catch (e) {
                        // 继续
                    }
                }

                // 选择最后一个符合条件的输入框（最新打开的对话框）
                if (validInputs.length > 0) {
                    const lastValid = validInputs[validInputs.length - 1];
                    coverInput = lastValid.input;
                    coverInputFound = true;
                    Log.info(`选择输入框 ${lastValid.index}/${allFileInputs.length}（最后一个符合条件的）: accept="${lastValid.accept}"`);
                }

                if (coverInputFound && coverInput) {
                    Log.info(`上传封面文件: ${path.basename(params.coverPath)}`);

                    // 阻止系统文件选择器弹出
                    await page.evaluate(() => {
                        const inputs = document.querySelectorAll('input[type="file"]');
                        inputs.forEach((input: any) => {
                            input.addEventListener('click', (e: Event) => {
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                            }, true);
                        });
                    });

                    await coverInput.setInputFiles(params.coverPath);
                    Log.info('封面文件已上传');

                    // 等待抖音加载并显示图片预览
                    // 抖音需要时间来处理上传的图片并显示可拖动的预览界面
                    await page.waitForTimeout(3000);

                    // 额外等待：确保图片预览界面完全加载
                    // 检查是否有预览图片或处理中的指示器
                    try {
                        // 等待预览图片出现或加载完成
                        await Promise.race([
                            page.waitForSelector('img[class*="preview"], img[class*="crop"], canvas', { timeout: 3000 }).catch(() => null),
                            new Promise(r => setTimeout(r, 3000))
                        ]);
                        Log.info('图片预览已加载');
                    } catch (e) {
                        Log.info('等待预览图片超时，继续执行');
                    }

                    // 再等待一下确保UI完全渲染
                    await page.waitForTimeout(1000);

                    // 步骤4: 点击确定按钮确认封面上传
                    Log.info('查找并点击确定按钮...');
                    const confirmSelectors = [
                        'button:has-text("确定")',
                        'button:has-text("确认")',
                        'button:has-text("保存")',
                        'button:has-text("完成")',
                        'text=/确定/',
                        'text=/确认/',
                        'text=/保存/',
                        'text=/完成/'
                    ];

                    let confirmFound = false;
                    for (const selector of confirmSelectors) {
                        try {
                            const count = await page.locator(selector).count();
                            if (count > 0) {
                                const allMatches = await page.locator(selector).all();
                                for (const element of allMatches) {
                                    try {
                                        const isVisible = await element.isVisible().catch(() => false);
                                        const text = await element.textContent().catch(() => '');

                                        if (isVisible && text && (text.includes('确定') || text.includes('确认') || text.includes('保存') || text.includes('完成'))) {
                                            Log.info(`找到确定按钮: "${text}"`);
                                            await element.scrollIntoViewIfNeeded();
                                            await page.waitForTimeout(300);
                                            await element.click();
                                            await page.waitForTimeout(1000);
                                            confirmFound = true;
                                            Log.info('已点击确定按钮');
                                            break;
                                        }
                                    } catch (e: any) {
                                        Log.debug(`点击确定按钮时出错: ${e.message}`);
                                    }
                                }
                                if (confirmFound) break;
                            }
                        } catch (e: any) {
                            Log.debug(`选择器 "${selector}" 失败: ${e.message}`);
                        }
                    }

                    if (!confirmFound) {
                        Log.info('未找到确定按钮，封面上传可能已完成或需要手动确认');
                    } else {
                        // 等待确定按钮处理完成
                        await page.waitForTimeout(1000);
                    }
                } else {
                    Log.info('未找到封面文件输入框，跳过封面上传');
                }
            } catch (error: any) {
                Log.error('上传封面失败', error);
                Log.info('继续执行，封面上传失败不影响发布');
            }
        } else {
            Log.info('未提供封面文件，跳过封面上传');
        }

        // ========== 步骤5: 点击发布按钮 ==========
        Log.info('【步骤5】点击发布按钮');

        // 等待一下确保所有内容都已保存
        await page.waitForTimeout(2000);

        // 查找发布按钮（快手的发布按钮可能是div元素）
        const publishButtonSelectors = [
            'div:text-is("发布")',
            'div:has-text("发布"):not(:has-text("发布作品"))',
            'button:text-is("发布")',
            'button:has-text("发布")',
            'button:has-text("立即发布")',
            'button:has-text("确认发布")',
            'button:has-text("上传并发布")',
            'div[class*="publish"]:has-text("发布")',
            'span:text-is("发布")',
            'button[type="submit"]:has-text("发布")',
            'button[class*="publish"]',
            'button[class*="submit"]'
        ];

        let publishButtonFound = false;
        let publishClicked = false;

        for (const selector of publishButtonSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    const allMatches = await page.locator(selector).all();
                    for (const element of allMatches) {
                        try {
                            const isVisible = await element.isVisible().catch(() => false);
                            const text = await element.textContent().catch(() => '');
                            const disabled = await element.getAttribute('disabled').catch(() => null);

                            Log.info(`检查发布按钮: selector=${selector}, visible=${isVisible}, text="${text}", disabled=${disabled}`);

                            // 精确匹配：文字必须是"发布"或包含"发布"但不是"发布作品"等
                            const trimmedText = text?.trim() || '';
                            const isPublishButton = isVisible && !disabled &&
                                (trimmedText === '发布' || trimmedText === '立即发布' || trimmedText === '确认发布');

                            if (isPublishButton) {
                                Log.info(`找到发布按钮: "${trimmedText}"`);
                                await element.scrollIntoViewIfNeeded();
                                await page.waitForTimeout(500);

                                // 尝试点击发布按钮
                                try {
                                    await element.click();
                                    publishButtonFound = true;
                                    publishClicked = true;
                                    Log.info('已点击发布按钮');
                                    await page.waitForTimeout(2000);
                                    break;
                                } catch (clickError: any) {
                                    Log.info(`点击失败: ${clickError.message}，尝试使用JavaScript点击...`);

                                    // 使用JavaScript点击
                                    await element.evaluate((el: any) => {
                                        el.click();
                                    });
                                    publishButtonFound = true;
                                    publishClicked = true;
                                    Log.info('已通过JavaScript点击发布按钮');
                                    await page.waitForTimeout(2000);
                                    break;
                                }
                            }
                        } catch (e: any) {
                            Log.debug(`检查发布按钮时出错: ${e.message}`);
                        }
                    }
                    if (publishClicked) break;
                }
            } catch (e: any) {
                Log.debug(`选择器 "${selector}" 失败: ${e.message}`);
            }
        }

        if (!publishClicked) {
            Log.info('未找到或无法点击发布按钮，请手动点击发布');
            Log.info('浏览器将保持打开以便您检查发布状态');
        } else {
            Log.info('发布按钮已点击，等待发布结果...');
            await page.waitForTimeout(3000);

            // 检查是否有确认对话框
            const confirmDialogSelectors = [
                'button:has-text("确认发布")',
                'button:has-text("确定")',
                'button:has-text("确认")',
                'text=/确认发布/'
            ];

            for (const selector of confirmDialogSelectors) {
                try {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        const btn = page.locator(selector).first();
                        const isVisible = await btn.isVisible().catch(() => false);
                        if (isVisible) {
                            Log.info('检测到确认发布对话框，点击确认...');
                            await btn.click();
                            await page.waitForTimeout(2000);
                            break;
                        }
                    }
                } catch (e) {
                    // 继续
                }
            }
        }

        // 返回成功
        if (publishClicked) {
            return await waitForPublishConfirmation(page, 'kuaishou');
        }

        return {
            success: false,
            status: 'manual_pending',
            videoUrl: page.url(),
            videoId: '',
            message: '视频已上传，但未能自动确认发布，请在浏览器中手动完成发布',
            keepPageOpen: true
        };

    } catch (error: any) {
        Log.error('发布到快手失败', {
            message: error.message,
            stack: error.stack
        });

        // 保存错误截图
        try {
            if (page && !page.isClosed()) {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'kuaishou_error.png');
                await page.screenshot({ path: screenshotPath, fullPage: true });
                Log.info(`错误截图已保存: ${screenshotPath}`);
            }
        } catch (screenshotError) {
            // 忽略截图错误
        }

        throw error;

    } finally {
        // 不关闭页面，让用户手动操作
        // await page?.close();
    }
}

/**
 * 安全的页面等待函数（检查页面是否关闭）
 */
async function safePageWait(page: Page, ms: number): Promise<void> {
    try {
        if (page && !page.isClosed()) {
            await page.waitForTimeout(ms);
        } else {
            await new Promise(resolve => setTimeout(resolve, ms));
        }
    } catch (e) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 发布到视频号（使用改进版脚本逻辑）
 */
async function publishToShipin(context: BrowserContext, params: {
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    autoPublish?: boolean;
}): Promise<any> {
    let page: Page | null = null;
    let shouldClosePage = false;
    let publishTriggered = false;

    try {
        Log.info('开始发布到视频号');

        // 检查上下文中的Cookie
        const cookies = await context.cookies().catch(() => []);
        Log.info('上下文中的Cookie信息', {
            cookie总数: cookies.length,
            weixin相关cookie: cookies.filter(c => c.domain && c.domain.includes('weixin')).length,
            channels相关cookie: cookies.filter(c => c.domain && c.domain.includes('channels')).length
        });

        page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // 导航到视频号上传页面
        Log.info('导航到视频号上传页面');
        const uploadUrl = 'https://channels.weixin.qq.com/platform/post/create';
        Log.info(`URL: ${uploadUrl}`);

        try {
            Log.info('开始导航到页面...');
            const response = await page.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            Log.info('页面导航成功', {
                响应状态: response?.status(),
                响应URL: response?.url(),
                是否成功: response?.ok()
            });

            if (response && !response.ok()) {
                Log.warn(`页面返回非成功状态码: ${response.status()}`);
            }
        } catch (navError: any) {
            Log.error('页面导航失败', {
                错误信息: navError.message,
                错误类型: navError.name,
                URL: uploadUrl,
                当前页面URL: page ? page.url() : '未知'
            });

            // 尝试获取更多诊断信息
            if (page) {
                try {
                    const pageContent = await page.content().catch(() => '无法获取页面内容');
                    const contentLength = typeof pageContent === 'string' ? pageContent.length : 0;
                    Log.error('页面内容诊断', {
                        页面URL: page.url(),
                        内容长度: contentLength,
                        内容示例: contentLength > 0 ? pageContent.substring(0, 200) : '空内容'
                    });
                } catch (e) {
                    Log.error('无法获取页面诊断信息:', e);
                }
            }

            throw navError;
        }

        // 🔧 关键修复：导航后立即等待5秒，让页面完全加载和重定向
        // 某些情况下，页面导航到上传URL时，会先显示中间状态，然后重定向到真正的页面
        Log.info('页面导航完成，等待5秒让页面完全加载和重定向...');
        await page.waitForTimeout(5000);

        const currentUrl = page.url();
        Log.info(`当前URL: ${currentUrl}`);

        // 🔧 改进的登录检测逻辑
        // 检查URL是否表示登录页
        const urlIndicatesLogin = currentUrl.includes('login') ||
            currentUrl.includes('auth') ||
            currentUrl.includes('weixin.qq.com/qr') ||
            currentUrl.includes('mp.weixin.qq.com');

        // 检查页面中是否有文件输入框（这是真正的登录指标）
        const fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0);
        const hasFileInputs = fileInputCount > 0;

        Log.info('登录状态检查', {
            当前URL: currentUrl,
            URL表示登录: urlIndicatesLogin,
            页面有文件框: hasFileInputs,
            文件框数量: fileInputCount
        });

        // 🔧 关键修复：只有当URL表示登录 AND 页面中没有文件输入框时，才判断为需要登录
        // 这防止了误判：如果页面中已有文件输入框，说明已经登录，不需要等待
        const isLoginPage = urlIndicatesLogin && !hasFileInputs;

        Log.info('登录页判断结果', {
            URL表示登录: urlIndicatesLogin,
            页面有文件框: hasFileInputs,
            判断为需要登录: isLoginPage
        });

        if (isLoginPage) {
            Log.info('可能需要登录');
            Log.info('请在浏览器窗口中扫码登录微信账号');
            Log.info('脚本将自动检测登录完成状态（最多等待3分钟）...');

            const maxWaitMs = 180000;
            const checkIntervalMs = 2000;
            const startTime = Date.now();
            let logged = false;

            while (Date.now() - startTime < maxWaitMs) {
                try {
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    const currentUrlNow = page.url();
                    const elapsed = Math.round((Date.now() - startTime) / 1000);

                    if (elapsed % 5 === 0) {
                        Log.info(`[${elapsed}s] 检查状态: 文件框=${fileInputCount}, URL=${currentUrlNow.substring(currentUrlNow.lastIndexOf('/'))}`);
                    }

                    if (fileInputCount > 0 && !currentUrlNow.includes('login') && !currentUrlNow.includes('auth')) {
                        logged = true;
                        Log.info('检测到文件输入框，登录成功！');
                        break;
                    }

                    if (currentUrlNow.includes('platform/post') || currentUrlNow.includes('channels') || currentUrlNow.includes('create')) {
                        const fileInputCountAfterCheck = await page.locator('input[type="file"]').count();
                        if (fileInputCountAfterCheck > 0) {
                            logged = true;
                            Log.info('检测到已进入上传页面，登录成功！');
                            break;
                        }
                    }
                } catch (e) {
                    Log.debug(`检查过程中出错: ${(e as Error).message}`);
                }

                await page.waitForTimeout(checkIntervalMs);
            }

            if (!logged) {
                Log.info('等待超时（180秒），尝试继续...');
            } else {
                await page.goto(uploadUrl, { waitUntil: 'networkidle', timeout: 60000 });
                await page.waitForTimeout(3000);
            }
        } else {
            // 🔧 关键修复：如果页面中已有文件输入框，说明已登录，直接跳过登录等待
            if (hasFileInputs) {
                Log.info('✅ 检测到用户已登录（页面中有文件输入框），跳过登录等待步骤');
            } else {
                Log.info('⚠️ 既不是登录页也没有文件输入框，继续尝试...');
            }
        }

        // ========== 步骤1: 上传视频 ==========
        Log.info('【步骤1】上传视频文件');

        // 等待页面完全加载（增加等待时间，确保文件输入框已渲染）
        Log.info('等待页面加载完成...');
        await safePageWait(page, 5000); // 增加到5秒

        // 等待文件输入框出现
        try {
            await page.locator('input[type="file"]').first().waitFor({ timeout: 10000, state: 'attached' });
            Log.info('文件输入框已出现');
        } catch (e) {
            Log.info('等待文件输入框超时，尝试继续...');
        }

        // 检查视频是否已上传（方法1: 检查文件输入框）
        let videoAlreadyUploaded = false;
        const allFileInputs = await page.locator('input[type="file"]').all();

        for (let i = 0; i < allFileInputs.length; i++) {
            try {
                const input = allFileInputs[i];
                const accept = await input.getAttribute('accept').catch(() => '');
                const hasFiles = await input.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);

                if (hasFiles && (accept.includes('video') || accept.includes('mp4') || !accept)) {
                    videoAlreadyUploaded = true;
                    Log.info('检测到视频已上传（通过文件输入框），跳过视频上传步骤');
                    break;
                }
            } catch (e) {
                // 忽略错误
            }
        }

        // 方法2: 检查页面是否有处理中/上传成功的提示
        if (!videoAlreadyUploaded) {
            try {
                const processingSelectors = [
                    'text="处理中"',
                    'text="上传中"',
                    'text="转码中"',
                    '*:has-text("处理中")',
                    '*:has-text("上传中")'
                ];
                for (const selector of processingSelectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        Log.info('检测到视频正在处理中...');
                        break;
                    }
                }

                const successSelectors = [
                    'text="上传成功"',
                    'text="处理完成"',
                    '*:has-text("上传成功")',
                    '*:has-text("处理完成")'
                ];
                for (const selector of successSelectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        videoAlreadyUploaded = true;
                        Log.info('检测到视频已上传或正在处理（通过页面状态），跳过视频上传步骤');
                        break;
                    }
                }
            } catch (e) {
                Log.debug(`检查页面状态失败: ${(e as Error).message}`);
            }
        }

        // 方法3: 检查是否有视频预览元素
        if (!videoAlreadyUploaded) {
            try {
                const videoInfo = await page.evaluate(() => {
                    const videos = Array.from(document.querySelectorAll('video'));
                    for (const video of videos) {
                        if (video.src || video.poster || video.currentSrc) {
                            return { hasFile: true, reason: '视频元素有源文件' };
                        }
                    }
                    const previewImages = document.querySelectorAll('img[src*="video"], img[class*="preview"], img[class*="thumbnail"]');
                    if (previewImages.length > 0) {
                        for (const img of previewImages as any) {
                            if (img.complete && img.naturalWidth > 0) {
                                return { hasFile: true, reason: '有视频预览图片' };
                            }
                        }
                    }
                    return { hasFile: false, reason: '未找到实际上传的视频' };
                });

                if (videoInfo.hasFile) {
                    videoAlreadyUploaded = true;
                    Log.info(`检测到视频已上传（${videoInfo.reason}），跳过视频上传步骤`);
                }
            } catch (e) {
                Log.debug(`检查视频元素失败: ${(e as Error).message}`);
            }
        }

        if (!videoAlreadyUploaded) {
            Log.info('使用JavaScript直接上传视频（不触发系统文件选择器）...');

            // 在页面级别阻止所有文件输入框触发系统选择器
            await page.evaluate(() => {
                // 阻止所有文件输入框的点击事件，防止系统选择器弹出
                const preventFileDialog = (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                };

                // 为所有文件输入框添加事件阻止
                document.querySelectorAll('input[type="file"]').forEach((input: any) => {
                    input.onclick = preventFileDialog;
                    input.onmousedown = preventFileDialog;
                    input.onmouseup = preventFileDialog;
                    input.onfocus = preventFileDialog;
                    input.addEventListener('click', preventFileDialog, { capture: true, passive: false });
                    input.addEventListener('mousedown', preventFileDialog, { capture: true, passive: false });
                    input.addEventListener('mouseup', preventFileDialog, { capture: true, passive: false });
                    input.addEventListener('focus', preventFileDialog, { capture: true, passive: false });
                });
            });

            Log.info('已在页面级别阻止所有文件输入框触发系统选择器');

            // 直接查找文件输入框（不点击任何按钮）
            let fileInput: any = null;
            let uploadSuccess = false;
            const fileInputSelectors = [
                'input[type="file"][accept*="video"]',
                'input[type="file"]'
            ];

            for (const selector of fileInputSelectors) {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    fileInput = page.locator(selector).first();
                    const accept = await fileInput.getAttribute('accept').catch(() => '');
                    if (accept.includes('video') || !accept) {
                        Log.info(`找到视频文件输入框: ${selector}`);
                        break;
                    }
                }
            }

            if (fileInput) {
                try {
                    const hasFiles = await fileInput.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);
                    if (!hasFiles) {
                        Log.info(`使用setInputFiles直接上传文件: ${path.basename(params.videoPath)}`);
                        // 直接使用setInputFiles设置文件（不会触发系统选择器）
                        await fileInput.setInputFiles(params.videoPath, { timeout: 60000 });
                        Log.info('视频文件已通过setInputFiles直接上传（未触发系统文件选择器）');

                        // 触发change事件，确保上传被处理
                        await fileInput.evaluate((el: any) => {
                            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                            el.dispatchEvent(changeEvent);
                        });

                        uploadSuccess = true;
                        await safePageWait(page, 3000);
                    } else {
                        Log.info('文件输入框已有文件，跳过上传');
                        uploadSuccess = true;
                    }
                } catch (error: any) {
                    Log.error(`文件上传失败: ${error.message}`);
                    throw error;
                }
            } else {
                Log.error('未找到视频上传输入框');
                throw new Error('未找到视频上传输入框');
            }

            if (uploadSuccess) {
                await safePageWait(page, 3000);
                videoAlreadyUploaded = true;
                Log.info('视频上传完成，继续执行');
            }
        }

        // ========== 步骤2: 等待视频处理 ==========
        Log.info('【步骤2】等待视频处理完成');

        // 等待封面编辑按钮出现（最多5分钟）
        let coverEditFound = false;
        const maxWaitTime = 300000;
        const checkInterval = 1000;
        const startTime = Date.now();

        Log.info('正在查找封面编辑按钮...');

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const coverEditSelectors = [
                    '*:has-text("个人主页和分享卡片") *:has-text("编辑")',
                    'text="编辑"',
                    'button:has-text("编辑")'
                ];

                for (const selector of coverEditSelectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        const element = page.locator(selector).first();
                        const isVisible = await element.isVisible().catch(() => false);
                        if (isVisible) {
                            coverEditFound = true;
                            Log.info('找到封面编辑按钮');
                            break;
                        }
                    }
                }

                if (coverEditFound) break;

                const elapsed = Math.round((Date.now() - startTime) / 1000);
                if (elapsed % 10 === 0 && elapsed > 0) {
                    Log.info(`[${elapsed}s] 继续查找封面编辑按钮...`);
                }

                await page.waitForTimeout(checkInterval);
            } catch (e) {
                await page.waitForTimeout(checkInterval);
            }
        }

        // ========== 步骤3: 上传封面 ==========
        Log.info('【步骤3】上传封面');

        try {
            // 查找封面编辑按钮
            const coverSelectors = [
                '*:has-text("个人主页和分享卡片") *:has-text("编辑")',
                'text="编辑"',
                'button:has-text("编辑")'
            ];

            let coverBtn: any = null;
            for (const selector of coverSelectors) {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    coverBtn = page.locator(selector).first();
                    const isVisible = await coverBtn.isVisible().catch(() => false);
                    if (isVisible) {
                        break;
                    }
                }
            }

            if (coverBtn) {
                await coverBtn.click();
                Log.info('已点击封面编辑按钮');
                await page.waitForTimeout(2000);

                // 查找封面图片并点击
                const coverImageSelectors = [
                    'img.cover-img-vertical',
                    'img[class*="cover-img-vertical"]',
                    '[class*="cover-img"]'
                ];

                let coverImageClicked = false;
                for (const selector of coverImageSelectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        const img = page.locator(selector).first();
                        const isVisible = await img.isVisible().catch(() => false);
                        if (isVisible) {
                            await img.click();
                            Log.info('已点击封面图片');
                            coverImageClicked = true;
                            await page.waitForTimeout(1500);
                            break;
                        }
                    }
                }

                if (coverImageClicked) {
                    // 点击封面图片后，直接查找文件输入框（使用JavaScript直接上传，不触发系统文件选择器）
                    Log.info('点击封面图片后，直接查找文件输入框（使用JavaScript直接上传，不触发系统文件选择器）...');
                    await page.waitForTimeout(1000); // 等待上传界面出现

                    // 在页面级别阻止所有文件输入框触发系统选择器
                    await page.evaluate(() => {
                        // 阻止所有文件输入框的点击事件，防止系统选择器弹出
                        const preventFileDialog = (e: any) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            return false;
                        };

                        // 为所有文件输入框添加事件阻止
                        document.querySelectorAll('input[type="file"]').forEach((input: any) => {
                            input.onclick = preventFileDialog;
                            input.onmousedown = preventFileDialog;
                            input.onmouseup = preventFileDialog;
                            input.onfocus = preventFileDialog;
                            input.addEventListener('click', preventFileDialog, { capture: true, passive: false });
                            input.addEventListener('mousedown', preventFileDialog, { capture: true, passive: false });
                            input.addEventListener('mouseup', preventFileDialog, { capture: true, passive: false });
                            input.addEventListener('focus', preventFileDialog, { capture: true, passive: false });
                        });
                    });

                    Log.info('已在页面级别阻止所有文件输入框触发系统选择器');

                    // 查找所有文件输入框
                    const allFileInputs = await page.locator('input[type="file"]').all();
                    Log.info(`找到 ${allFileInputs.length} 个文件输入框`);

                    let coverInput: any = null;

                    // 查找图片输入框（排除视频输入框）
                    for (let i = 0; i < allFileInputs.length; i++) {
                        try {
                            const input = allFileInputs[i];
                            const accept = await input.getAttribute('accept').catch(() => '');
                            const hasFiles = await input.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);

                            Log.info(`文件输入框 ${i + 1}: accept="${accept}", hasFiles=${hasFiles}`);

                            // 排除视频输入框
                            if (hasFiles && (accept.includes('video') || accept.includes('mp4'))) {
                                Log.info(`  跳过视频输入框`);
                                continue;
                            }

                            // 查找图片输入框（accept包含image但不包含video）
                            if (!hasFiles && accept.includes('image') && !accept.includes('video')) {
                                coverInput = input;
                                Log.info(`  找到图片输入框用于封面: accept="${accept}"`);
                                break;
                            }
                        } catch (e: any) {
                            Log.info(`  检查文件输入框 ${i + 1} 失败: ${e.message}`);
                        }
                    }

                    if (!coverInput && allFileInputs.length > 0) {
                        // 如果没找到图片输入框，尝试使用第二个输入框（通常是封面输入框）
                        for (let i = 0; i < allFileInputs.length; i++) {
                            try {
                                const input = allFileInputs[i];
                                const accept = await input.getAttribute('accept').catch(() => '');
                                const hasFiles = await input.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);

                                // 如果输入框没有文件且不是视频输入框，使用它
                                if (!hasFiles && !accept.includes('video') && !accept.includes('mp4')) {
                                    coverInput = input;
                                    Log.info(`  使用文件输入框 ${i + 1} 作为封面输入框`);
                                    break;
                                }
                            } catch (e: any) {
                                // 继续
                            }
                        }
                    }

                    if (coverInput) {
                        try {
                            Log.info('找到文件输入框，使用setInputFiles直接上传（不触发系统文件选择器）...');

                            // 直接使用setInputFiles设置文件（这个方法本身不会触发系统选择器）
                            // 关键：setInputFiles是Playwright提供的方法，直接设置文件值，不会触发系统文件选择器
                            // 只有用户点击文件输入框时才会触发系统选择器
                            await coverInput.setInputFiles(params.coverPath, { timeout: 30000 });
                            Log.info('封面文件已通过setInputFiles直接设置（未触发系统文件选择器）');

                            // 触发change事件，确保上传被处理
                            await coverInput.evaluate((el: any) => {
                                // 触发change事件
                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                el.dispatchEvent(changeEvent);

                                // 触发input事件（某些框架监听这个）
                                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                el.dispatchEvent(inputEvent);
                            });

                            Log.info('已触发change和input事件');

                            // 验证文件是否已设置
                            const hasFiles = await coverInput.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);
                            if (hasFiles) {
                                const fileName = await coverInput.evaluate((el: any) => el.files[0]?.name || '').catch(() => '');
                                Log.info(`验证成功：文件已设置到输入框 (${fileName})`);
                            } else {
                                Log.info('文件已通过setInputFiles设置（files属性可能延迟更新，这是正常的）');
                            }

                            await page.waitForTimeout(2000);

                            // 查找确认按钮
                            const confirmSelectors = [
                                'button:has-text("确认")',
                                'button:has-text("确定")',
                                'button:has-text("保存")',
                                '[role="dialog"] button:has-text("确认")',
                                '.weui-desktop-dialog button:has-text("确认")'
                            ];

                            for (const selector of confirmSelectors) {
                                try {
                                    const count = await page.locator(selector).count();
                                    if (count > 0) {
                                        const btn = page.locator(selector).first();
                                        const isVisible = await btn.isVisible().catch(() => false);
                                        if (isVisible) {
                                            await btn.scrollIntoViewIfNeeded();
                                            await page.waitForTimeout(300);
                                            await btn.click();
                                            Log.info(`已点击确认按钮: ${selector}`);
                                            await page.waitForTimeout(2000);
                                            break;
                                        }
                                    }
                                } catch (e: any) {
                                    // 继续尝试下一个
                                }
                            }
                        } catch (uploadError: any) {
                            Log.info(`直接上传失败: ${uploadError.message}`);
                            Log.info('尝试其他方法...');
                        }
                    } else {
                        Log.info('未找到可用的文件输入框');
                    }
                }
            }
        } catch (error: any) {
            Log.info(`封面上传失败: ${error.message}`);
        }

        // ========== 步骤4: 填写标题 ==========
        Log.info('【步骤4】填写标题');

        // 等待页面完全加载
        await safePageWait(page, 2000);

        // 根据用户提示：查找包含"添加描述"的文字，这是标题输入框
        Log.info('查找标题输入框（包含"添加描述"的文字）...');

        const titleSelectors = [
            // 文本匹配
            'text="添加描述"',
            '*:has-text("添加描述")',
            // placeholder匹配（优先input和textarea，不包含contenteditable div）
            'input[placeholder*="添加描述"]',
            'textarea[placeholder*="添加描述"]',
            'input[placeholder*="描述"]',
            'textarea[placeholder*="描述"]',
            'input[placeholder*="标题"]',
            'textarea[placeholder*="标题"]',
            // class匹配
            '[class*="description"] input',
            '[class*="description"] textarea',
            '[class*="desc"] input',
            '[class*="desc"] textarea',
            '[class*="title"] input',
            '[class*="title"] textarea',
            // 通用输入框（排除文件输入框）
            'input[type="text"]',
            'input[type="text"]:not([type="file"])',
            'textarea',
            // 通过label查找
            'label:has-text("描述") + input',
            'label:has-text("描述") + textarea',
            'label:has-text("标题") + input',
            'label:has-text("标题") + textarea'
        ];

        let titleInput: any = null;
        let titleFound = false;

        // 方法1: 通过选择器查找
        for (const selector of titleSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    // 如果是文本选择器，查找附近的输入框
                    if (selector.startsWith('text') || selector.includes('has-text')) {
                        try {
                            const textElement = page.locator(selector).first();
                            const isVisible = await textElement.isVisible().catch(() => false);

                            if (isVisible) {
                                // 尝试在同一容器内查找input或textarea（不包含contenteditable div）
                                const container = textElement.locator('..');
                                const inputInContainer = container.locator('input, textarea').first();
                                const inputCount = await inputInContainer.count();

                                if (inputCount > 0) {
                                    const inputVisible = await inputInContainer.isVisible().catch(() => false);
                                    const inputType = await inputInContainer.getAttribute('type').catch(() => '');

                                    if (inputVisible && inputType !== 'file') {
                                        titleInput = inputInContainer;
                                        titleFound = true;
                                        Log.info('找到标题输入框（通过"添加描述"文字附近的输入框）');
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            // 继续
                        }
                    } else {
                        // 普通选择器
                        titleInput = page.locator(selector).first();
                        const isVisible = await titleInput.isVisible().catch(() => false);
                        const inputType = await titleInput.getAttribute('type').catch(() => '');
                        const tagName = await titleInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');

                        // 只支持textarea和input（排除文件输入框和contenteditable div）
                        if (isVisible && inputType !== 'file' && (tagName === 'textarea' || inputType === 'text' || !inputType)) {
                            titleFound = true;
                            Log.info(`找到标题输入框: ${selector}`);
                            break;
                        }
                    }
                }
            } catch (e) {
                // 继续
            }
        }

        // 方法2: 如果通过选择器找不到，尝试查找所有输入框和文本域
        if (!titleFound) {
            Log.info('未通过选择器找到输入框，尝试查找所有输入框...');
            const allInputs = await page.locator('input, textarea').all();
            Log.info(`页面中共有 ${allInputs.length} 个输入框/文本域`);

            for (let i = 0; i < allInputs.length; i++) {
                try {
                    const input = allInputs[i];
                    const placeholder = await input.getAttribute('placeholder').catch(() => '');
                    const inputType = await input.getAttribute('type').catch(() => '');
                    const isVisible = await input.isVisible().catch(() => false);
                    const className = await input.getAttribute('class').catch(() => '');
                    const id = await input.getAttribute('id').catch(() => '');

                    // 排除文件输入框和隐藏输入框
                    if (inputType === 'file' || inputType === 'hidden' || inputType === 'submit' || inputType === 'button') {
                        continue;
                    }

                    // 检查是否可见且可能是标题输入框
                    if (isVisible && (
                        placeholder.includes('描述') ||
                        placeholder.includes('标题') ||
                        placeholder.includes('添加') ||
                        className.includes('desc') ||
                        className.includes('title') ||
                        className.includes('description') ||
                        id.includes('desc') ||
                        id.includes('title') ||
                        (inputType === 'text' || !inputType)
                    )) {
                        titleInput = input;
                        titleFound = true;
                        Log.info(`找到标题输入框（通过属性匹配: placeholder="${placeholder}"）`);
                        break;
                    }
                } catch (e) {
                    // 继续
                }
            }
        }

        if (titleInput && titleFound) {
            try {
                await titleInput.scrollIntoViewIfNeeded();
                await safePageWait(page, 500);

                // 检查输入框是否已有内容
                let currentValue = '';
                try {
                    const tagName = await titleInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                    const contentEditable = await titleInput.getAttribute('contenteditable').catch(() => '');
                    const isContentEditable = tagName === 'div' && contentEditable !== '';

                    if (isContentEditable) {
                        currentValue = await titleInput.evaluate((el: any) => {
                            return el.innerText || el.textContent || '';
                        }).catch(() => '');
                    } else {
                        currentValue = await titleInput.inputValue().catch(() => '');
                    }
                } catch (e) {
                    // 忽略
                }

                // 如果输入框已有内容且包含描述，说明描述已经填写，跳过标题填写
                if (currentValue && currentValue.includes(params.description.substring(0, 10))) {
                    Log.info('检测到描述已填写，跳过标题填写（标题和描述使用同一个输入框）');
                } else if (currentValue && currentValue.trim() === params.title) {
                    // 如果当前值已经是标题，跳过
                    Log.info('标题已存在，跳过填写');
                } else {
                    // 如果输入框为空或只有部分内容，填写标题
                    if (currentValue && currentValue.trim()) {
                        Log.info(`输入框已有内容: "${currentValue.substring(0, 30)}..."，将追加标题`);
                        await titleInput.fill(params.title + '\n\n' + currentValue);
                    } else {
                        // 清空现有内容（如果有）
                        await titleInput.fill('');
                        await safePageWait(page, 200);

                        // 填写标题
                        await titleInput.fill(params.title);
                    }

                    await safePageWait(page, 300);

                    // 验证是否填写成功
                    let filledValue = '';
                    try {
                        const tagName = await titleInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                        const contentEditable = await titleInput.getAttribute('contenteditable').catch(() => '');
                        const isContentEditable = tagName === 'div' && contentEditable !== '';

                        if (isContentEditable) {
                            filledValue = await titleInput.evaluate((el: any) => {
                                return el.innerText || el.textContent || '';
                            }).catch(() => '');
                        } else {
                            filledValue = await titleInput.inputValue().catch(() => '');
                        }
                    } catch (e) {
                        filledValue = '';
                    }

                    if (filledValue.includes(params.title.substring(0, 10))) {
                        Log.info(`标题已填写: "${params.title}"`);
                    } else {
                        Log.info(`标题填写可能失败，当前值: "${filledValue}"`);
                    }
                }
            } catch (error: any) {
                Log.info(`标题填写失败: ${error.message}`);
            }
        } else {
            Log.info('未找到标题输入框');
        }

        // ========== 步骤5: 准备输入话题标签（不填写描述） ==========
        Log.info('【步骤5】准备输入话题标签（跳过描述填写）');

        // 改进的描述输入框查找逻辑
        Log.info('查找描述输入框（在"添加描述"区域）...');

        const descSelectors = [
            // contenteditable div匹配（优先，因为这是实际的描述输入框）
            'div[contenteditable][data-placeholder*="添加描述"]',
            'div[contenteditable][data-placeholder*="描述"]',
            'div[contenteditable="true"][data-placeholder*="添加描述"]',
            'div[contenteditable="true"][data-placeholder*="描述"]',
            '[class*="input-editor"][contenteditable]',
            '[class*="input-editor"]',
            'div[contenteditable][class*="editor"]',
            'div[contenteditable][class*="input"]',
            // 文本匹配
            'text="添加描述"',
            '*:has-text("添加描述")',
            // placeholder匹配
            'textarea[placeholder*="添加描述"]',
            'textarea[placeholder*="描述"]',
            'textarea[placeholder*="简介"]',
            'textarea[placeholder*="介绍"]',
            'input[placeholder*="添加描述"]',
            'input[placeholder*="描述"]',
            // class匹配
            '[class*="description"] textarea',
            '[class*="description"] input',
            '[class*="desc"] textarea',
            '[class*="desc"] input',
            // 通用textarea（排除文件输入框）
            'textarea:visible',
            'textarea'
        ];

        let descInput: any = null;
        let descFound = false;

        // 方法1: 通过选择器查找
        for (const selector of descSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    // 如果是文本选择器，查找附近的输入框
                    if (selector.startsWith('text') || selector.includes('has-text')) {
                        try {
                            const textElement = page.locator(selector).first();
                            const isVisible = await textElement.isVisible().catch(() => false);

                            if (isVisible) {
                                // 尝试在同一容器内查找contenteditable div、textarea或input
                                const container = textElement.locator('..');
                                const inputInContainer = container.locator('div[contenteditable], textarea, input[type="text"]').first();
                                const inputCount = await inputInContainer.count();

                                if (inputCount > 0) {
                                    const inputVisible = await inputInContainer.isVisible().catch(() => false);
                                    const inputType = await inputInContainer.getAttribute('type').catch(() => '');
                                    const contentEditable = await inputInContainer.getAttribute('contenteditable').catch(() => '');

                                    if (inputVisible && inputType !== 'file' && (contentEditable !== '' || inputType === 'text' || !inputType)) {
                                        descInput = inputInContainer;
                                        descFound = true;
                                        Log.info('找到描述输入框（通过"添加描述"文字附近的输入框）');
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            // 继续
                        }
                    } else {
                        // 普通选择器
                        descInput = page.locator(selector).first();
                        const isVisible = await descInput.isVisible().catch(() => false);
                        const inputType = await descInput.getAttribute('type').catch(() => '');
                        const tagName = await descInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                        const contentEditable = await descInput.getAttribute('contenteditable').catch(() => '');

                        // 支持contenteditable div、textarea和input（排除文件输入框）
                        if (isVisible && inputType !== 'file' && (
                            contentEditable !== '' ||
                            tagName === 'textarea' ||
                            inputType === 'text' ||
                            !inputType
                        )) {
                            descFound = true;
                            Log.info(`找到描述输入框: ${selector}`);
                            break;
                        }
                    }
                }
            } catch (e) {
                // 继续
            }
        }

        // 方法2: 如果通过选择器找不到，尝试查找所有contenteditable div和textarea
        if (!descFound) {
            Log.info('未通过选择器找到描述输入框，尝试查找所有contenteditable div和textarea...');

            // 先查找contenteditable div
            const allContentEditableDivs = await page.locator('div[contenteditable]').all();
            Log.info(`页面中共有 ${allContentEditableDivs.length} 个contenteditable div`);

            for (let i = 0; i < allContentEditableDivs.length; i++) {
                try {
                    const div = allContentEditableDivs[i];
                    const dataPlaceholder = await div.getAttribute('data-placeholder').catch(() => '');
                    const placeholder = await div.getAttribute('placeholder').catch(() => '');
                    const isVisible = await div.isVisible().catch(() => false);
                    const className = await div.getAttribute('class').catch(() => '');

                    // 检查是否可见且可能是描述输入框
                    if (isVisible && (
                        dataPlaceholder.includes('描述') ||
                        dataPlaceholder.includes('添加') ||
                        placeholder.includes('描述') ||
                        placeholder.includes('添加') ||
                        className.includes('input-editor') ||
                        className.includes('editor') ||
                        className.includes('desc') ||
                        className.includes('description')
                    )) {
                        descInput = div;
                        descFound = true;
                        Log.info(`找到描述输入框（contenteditable div: data-placeholder="${dataPlaceholder}"）`);
                        break;
                    }
                } catch (e) {
                    // 继续
                }
            }

            // 如果还没找到，查找所有textarea
            if (!descFound) {
                const allTextareas = await page.locator('textarea').all();
                Log.info(`页面中共有 ${allTextareas.length} 个textarea`);

                for (let i = 0; i < allTextareas.length; i++) {
                    try {
                        const textarea = allTextareas[i];
                        const placeholder = await textarea.getAttribute('placeholder').catch(() => '');
                        const isVisible = await textarea.isVisible().catch(() => false);
                        const className = await textarea.getAttribute('class').catch(() => '');

                        // 检查是否可见且可能是描述输入框
                        if (isVisible && (
                            placeholder.includes('描述') ||
                            placeholder.includes('添加') ||
                            className.includes('desc') ||
                            className.includes('description')
                        )) {
                            descInput = textarea;
                            descFound = true;
                            Log.info(`找到描述输入框（通过属性匹配: placeholder="${placeholder}"）`);
                            break;
                        }
                    } catch (e) {
                        // 继续
                    }
                }
            }
        }

        // 方法3: 如果还是找不到，检查标题输入框是否是textarea，如果是，可以使用它（标题和描述可能是同一个输入框）
        if (!descFound && titleInput) {
            try {
                const tagName = await titleInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                if (tagName === 'textarea') {
                    descInput = titleInput;
                    descFound = true;
                    Log.info('标题和描述使用同一个输入框（textarea）');
                }
            } catch (e) {
                // 忽略
            }
        }

        if (descInput && descFound) {
            try {
                await descInput.scrollIntoViewIfNeeded();
                await safePageWait(page, 500);

                // 检查是否是contenteditable div
                const tagName = await descInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                const contentEditable = await descInput.getAttribute('contenteditable').catch(() => '');
                const isContentEditable = tagName === 'div' && contentEditable !== '';

                if (isContentEditable) {
                    // contenteditable div的处理方式
                    Log.info('检测到contenteditable div，跳过描述填写，仅激活输入框准备输入话题...');

                    // 点击元素以激活它
                    await descInput.click();
                    await safePageWait(page, 300);

                    // 聚焦元素并将光标移到末尾
                    await descInput.evaluate((el: any) => {
                        el.focus();
                        // 将光标移到末尾
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    });

                    Log.info('描述输入框已激活，等待输入话题标签');
                } else {
                    // 普通input或textarea的处理方式
                    Log.info('检测到普通input/textarea，跳过描述填写，仅激活输入框准备输入话题...');

                    // 点击输入框激活
                    await descInput.click();
                    await safePageWait(page, 300);

                    // 将光标移到末尾
                    await descInput.evaluate((el: any) => {
                        el.focus();
                        if (el.setSelectionRange) {
                            el.setSelectionRange(el.value.length, el.value.length);
                        }
                    });

                    Log.info('描述输入框已激活，等待输入话题标签');
                }
            } catch (error: any) {
                Log.info(`描述填写失败: ${error.message}`);
            }
        } else {
            Log.info('未找到描述输入框');
        }

        // ========== 步骤6: 添加标签 ==========
        if (params.tags && params.tags.length > 0) {
            Log.info('【步骤6】添加标签');

            Log.info('查找标签输入框...');

            const tagSelectors = [
                // contenteditable div匹配（标签可能也在描述输入框中）
                'div[contenteditable][data-placeholder*="标签"]',
                'div[contenteditable][data-placeholder*="话题"]',
                'div[contenteditable="true"][data-placeholder*="标签"]',
                'div[contenteditable="true"][data-placeholder*="话题"]',
                '[class*="tag"] div[contenteditable]',
                '[class*="topic"] div[contenteditable]',
                // input和textarea匹配
                'input[placeholder*="标签"]',
                'input[placeholder*="话题"]',
                'textarea[placeholder*="标签"]',
                'textarea[placeholder*="话题"]',
                '[class*="tag"] input',
                '[class*="topic"] input',
                '[class*="tag"] textarea',
                '[class*="topic"] textarea'
            ];

            let tagInput: any = null;
            let tagFound = false;

            // 方法1: 通过选择器查找
            for (const selector of tagSelectors) {
                try {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        tagInput = page.locator(selector).first();
                        const isVisible = await tagInput.isVisible().catch(() => false);
                        const tagName = await tagInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                        const contentEditable = await tagInput.getAttribute('contenteditable').catch(() => '');

                        if (isVisible) {
                            tagFound = true;
                            Log.info(`找到标签输入框: ${selector}`);
                            break;
                        }
                    }
                } catch (e) {
                    // 继续
                }
            }

            // 方法2: 如果找不到标签输入框，尝试在描述输入框中继续输入标签（如果它们是同一个输入框）
            let useDescInputForTags = false;
            if (!tagFound && descInput && descFound) {
                Log.info('未找到独立的标签输入框，将在描述输入框中继续输入标签（#号已输入）...');
                tagInput = descInput;
                tagFound = true;
                useDescInputForTags = true;
            }

            if (tagInput && tagFound) {
                try {
                    await tagInput.scrollIntoViewIfNeeded();
                    await safePageWait(page, 300);

                    // 检查是否是contenteditable div
                    const tagName = await tagInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                    const contentEditable = await tagInput.getAttribute('contenteditable').catch(() => '');
                    const isContentEditable = tagName === 'div' && contentEditable !== '';

                    if (isContentEditable) {
                        // contenteditable div的处理方式
                        Log.info('检测到contenteditable div，使用键盘输入方式添加标签...');

                        // 视频号不需要填写描述内容，只需要标签
                        Log.info('视频号：跳过描述填写，仅输入话题标签');

                        // 确保输入框已激活（#号已输入，光标应该在末尾）
                        await tagInput.evaluate((el: any) => {
                            el.focus();
                            const selection = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            range.collapse(false); // 移到末尾，不选中内容
                            selection.removeAllRanges();
                            selection.addRange(range);
                        });

                        await safePageWait(page, 200);

                        // 验证内容是否还在（防止点击时内容被清空）
                        const contentAfterFocus = await tagInput.evaluate((el: any) => {
                            return el.innerText || el.textContent || '';
                        }).catch(() => '');

                        // 如果内容丢失了，先恢复
                        if (!contentAfterFocus || contentAfterFocus.trim().length === 0 ||
                            (params.description && params.description.length > 0 && contentAfterFocus.length < params.description.length / 2)) {
                            Log.info('检测到内容可能丢失，尝试恢复...');
                            await tagInput.evaluate((el: any, content: string) => {
                                el.focus();
                                // 恢复内容
                                el.textContent = content;

                                // 将光标移到末尾
                                const selection = window.getSelection();
                                const range = document.createRange();
                                range.selectNodeContents(el);
                                range.collapse(false);
                                selection.removeAllRanges();
                                selection.addRange(range);

                                // 触发input事件
                                const inputEvent = new InputEvent('input', {
                                    bubbles: true,
                                    cancelable: true,
                                    inputType: 'insertText',
                                    data: content
                                });
                                el.dispatchEvent(inputEvent);
                            }, params.description || params.description);

                            await safePageWait(page, 500);
                        }

                        // 确保光标在末尾（再次设置，确保位置正确）
                        await tagInput.evaluate((el: any) => {
                            el.focus();
                            const selection = window.getSelection();
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        });

                        // 检查#号是否已存在，如果不存在则添加
                        const finalContentBeforeTags = await tagInput.evaluate((el: any) => {
                            return el.innerText || el.textContent || '';
                        }).catch(() => '');

                        // 逐个输入标签，每个标签后按空格让平台识别
                        for (let i = 0; i < params.tags.length; i++) {
                            const tag = params.tags[i].trim();
                            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

                            Log.info(`输入话题 ${i + 1}/${params.tags.length}: #${cleanTag}`);

                            // 输入#号
                            await page.keyboard.type('#', { delay: 50 });
                            await safePageWait(page, 100);

                            // 输入标签文字
                            await page.keyboard.type(cleanTag, { delay: 50 });
                            await safePageWait(page, 300);

                            // 按空格键触发话题识别
                            await page.keyboard.press('Space');
                            await safePageWait(page, 500);

                            // 检查是否有话题选择弹窗，如果有则按回车确认
                            try {
                                const topicPopup = page.locator('[class*="topic"], [class*="hashtag"], [class*="suggest"]').first();
                                if (await topicPopup.isVisible({ timeout: 1000 })) {
                                    Log.info('检测到话题选择弹窗，选择第一个选项');
                                    await page.keyboard.press('Enter');
                                    await safePageWait(page, 300);
                                }
                            } catch (e) {
                                Log.debug('未检测到话题弹窗，继续');
                            }
                        }

                        await safePageWait(page, 500);

                        // 验证最终内容
                        const finalContent = await tagInput.evaluate((el: any) => {
                            return el.innerText || el.textContent || '';
                        }).catch(() => '');

                        // 验证标签是否添加成功
                        const tagsText = params.tags.map(tag => `#${tag}`).join(' ');
                        Log.info(`标签已添加: ${tagsText}`);
                    } else {
                        // 普通input或textarea的处理方式
                        // 视频号不需要填写描述，直接输入标签
                        Log.info('视频号：跳过描述填写，直接输入话题标签');

                        // 使用键盘逐个输入标签
                        for (let i = 0; i < params.tags.length; i++) {
                            const tag = params.tags[i].trim();
                            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

                            Log.info(`输入话题 ${i + 1}/${params.tags.length}: #${cleanTag}`);

                            // 输入#号
                            await page.keyboard.type('#', { delay: 50 });
                            await safePageWait(page, 100);

                            // 输入标签文字
                            await page.keyboard.type(cleanTag, { delay: 50 });
                            await safePageWait(page, 300);

                            // 按空格键触发话题识别
                            await page.keyboard.press('Space');
                            await safePageWait(page, 500);
                        }

                        // 验证最终内容
                        const finalValue = await tagInput.inputValue().catch(() => '');

                        // 验证描述内容是否还在（如果使用描述输入框）
                        if (useDescInputForTags) {
                            if (finalValue.includes(params.description.substring(0, 10))) {
                                const tagsText = params.tags.map(tag => `#${tag}`).join(' ');
                                Log.info(`标签已添加: ${tagsText}`);
                                Log.info('描述内容已保留');
                            } else {
                                Log.info('警告：描述内容可能丢失，请检查');
                                const tagsText = params.tags.map(tag => `#${tag}`).join(' ');
                                Log.info(`标签已添加: ${tagsText}`);
                            }
                        } else {
                            const tagsText = params.tags.map(tag => `#${tag}`).join(' ');
                            Log.info(`标签已添加: ${tagsText}`);
                        }
                    }
                } catch (error: any) {
                    Log.info(`标签添加失败: ${error.message}`);
                }
            } else {
                Log.info('未找到标签输入框');
            }
        }

        Log.info('=== 所有准备工作已完成 ===');
        Log.info('视频、封面、标题、描述、标签都已填写完成');
        if (params.autoPublish) {
            Log.info('检测到自动发布标志，准备执行点击发表按钮...');

            // 查找发表按钮（视频号使用"发表"而不是"发布"）
            const publishBtnSelectors = [
                'button:has-text("发表")',
                'div:text-is("发表")',
                'button:has-text("发布")',
                'div[class*="publish"] button',
                'button[class*="publish"]',
                'div:text-is("发布")',
                'button:has-text("确定发布")'
            ];

            let publishBtn = null;
            for (const selector of publishBtnSelectors) {
                const btn = page.locator(selector).first();
                if (await btn.count() > 0 && await btn.isVisible()) {
                    publishBtn = btn;
                    Log.info(`找到发表按钮: ${selector}`);
                    break;
                }
            }

            if (publishBtn) {
                await page.waitForTimeout(2000); // 稍等片刻
                await publishBtn.click(); // publish-triggered
                publishTriggered = true;
                Log.info('已自动点击发表按钮');

                // 等待发布成功提示
                try {
                    await Promise.race([
                        page.locator('text="发表成功"').waitFor({ timeout: 10000 }),
                        page.locator('text="发布成功"').waitFor({ timeout: 10000 }),
                        page.locator('text="上传成功"').waitFor({ timeout: 10000 }),
                        page.waitForTimeout(5000)
                    ]);
                    Log.info('发表操作已提交');
                } catch (e) {
                    Log.info('未检测到明确的发表成功提示，但已执行点击');
                }
            } else {
                Log.warn('未找到发表按钮，请手动点击');
            }
        } else {
            Log.info('请在浏览器中检查内容，然后手动点击发表按钮');
            Log.info('浏览器窗口将保持打开状态，等待您手动操作...');

            // 等待30秒，给用户足够时间检查和手动发布
            await page.waitForTimeout(30000);
        }

        if (params.autoPublish) {
            if (publishTriggered) {
                const publishResult = await waitForPublishConfirmation(page, 'shipin');
                if (publishResult.success) {
                    shouldClosePage = true;
                }
                return publishResult;
            }
            return {
                success: false,
                status: 'manual_pending',
                message: '未找到明确的发表按钮，请在浏览器中手动确认发布',
                videoUrl: page.url(),
                videoId: '',
                keepPageOpen: true
            };
        }

        const finalUrl = page.url();
        Log.info(`当前页面URL: ${finalUrl}`);

        return {
            success: false,
            status: 'manual_pending',
            message: '准备工作已完成，请在浏览器中手动点击发表按钮',
            videoUrl: finalUrl,
            videoId: 'manual_publish',
            keepPageOpen: true
        };

    } catch (error: any) {
        Log.error('发布到视频号失败', {
            message: error.message,
            stack: error.stack
        });

        if (page) {
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'shipin_error.png');
                await page.screenshot({ path: screenshotPath });
                Log.info(`错误截图已保存: ${screenshotPath}`);
            } catch (e) {
                // 忽略错误
            }
        }

        throw error;

    } finally {
        if (page && shouldClosePage) {
            try {
                await page.close();
            } catch (error) {
                // 忽略错误
            }
        }
    }
}

/**
 * 检查和切换到正确的页面（用于处理页面切换）
 */
async function ensureCorrectPage(context: BrowserContext, currentPage: Page | null, uploadUrl: string): Promise<Page> {
    if (!currentPage || currentPage.isClosed()) {
        Log.info('当前页面已关闭，查找可用页面...');
        const pages = context.pages();
        if (pages.length > 0) {
            for (let i = pages.length - 1; i >= 0; i--) {
                if (!pages[i].isClosed()) {
                    const url = pages[i].url();
                    if (url.includes('creator.xiaohongshu.com')) {
                        Log.info(`找到可用页面: ${url}`);
                        return pages[i];
                    }
                }
            }
            // 如果没有找到合适的页面，使用第一个可用页面
            for (let i = pages.length - 1; i >= 0; i--) {
                if (!pages[i].isClosed()) {
                    Log.info('使用第一个可用页面');
                    return pages[i];
                }
            }
        }
        // 如果所有页面都关闭了，创建新页面
        Log.info('所有页面都已关闭，创建新页面');
        const newPage = await context.newPage();
        await newPage.goto(uploadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
        return newPage;
    }

    // 检查是否有新页面打开
    const pages = context.pages();
    if (pages.length > 1) {
        // 查找包含publish的页面（通常是编辑页面）
        for (const p of pages) {
            if (p !== currentPage && !p.isClosed()) {
                try {
                    const url = p.url();
                    if (url.includes('creator.xiaohongshu.com') && url.includes('publish')) {
                        Log.info(`检测到编辑页面: ${url}，切换到该页面`);
                        await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
                        return p;
                    }
                } catch (e) {
                    // 继续
                }
            }
        }
    }

    // 检查当前页面URL是否变化
    try {
        const currentUrl = currentPage.url();
        if (!currentUrl.includes('creator.xiaohongshu.com')) {
            Log.info(`当前页面URL不在创作中心: ${currentUrl}，查找正确的页面...`);
            for (const p of pages) {
                if (p !== currentPage && !p.isClosed()) {
                    try {
                        const url = p.url();
                        if (url.includes('creator.xiaohongshu.com')) {
                            Log.info(`切换到创作中心页面: ${url}`);
                            await p.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
                            return p;
                        }
                    } catch (e) {
                        // 继续
                    }
                }
            }
        }
    } catch (e) {
        // URL检查失败，继续使用当前页面
    }

    return currentPage;
}

/**
 * 发布到小红书（使用改进版脚本逻辑）
 */
async function publishToXiaohongshu(context: BrowserContext, params: {
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    autoPublish?: boolean;
}): Promise<any> {
    let page: Page | null = null;
    let shouldClosePage = false;
    let publishTriggered = false;

    try {
        Log.info('开始发布到小红书');

        // 验证文件
        if (!fs.existsSync(params.videoPath)) {
            throw new Error(`视频文件不存在: ${params.videoPath}`);
        }
        if (!fs.existsSync(params.coverPath)) {
            throw new Error(`封面文件不存在: ${params.coverPath}`);
        }

        Log.info('文件验证通过');
        Log.info(`视频: ${path.basename(params.videoPath)}`);
        Log.info(`封面: ${path.basename(params.coverPath)}`);

        page = await context.newPage();
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // 导航到小红书创作中心
        Log.info('【步骤1】导航到小红书创作中心');
        const uploadUrl = 'https://creator.xiaohongshu.com/publish/publish?from=menu&target=video';
        Log.info(`URL: ${uploadUrl}`);

        try {
            await page.goto(uploadUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            Log.info('页面已打开');
        } catch (error: any) {
            Log.info(`页面加载超时: ${error.message}`);
            Log.info('继续执行...');
        }

        await page.waitForTimeout(3000);

        let currentUrl = page.url();
        Log.info(`当前URL: ${currentUrl}`);

        // 🔥 登录前置检查（参考 aigc-human xiaoHongShuService.js:190-194）
        if (currentUrl.includes('login') || currentUrl.includes('passport') || currentUrl.includes('account')) {
            Log.error('未登录：被重定向到登录页');
            throw new Error('未登录小红书，请先在账号管理中扫码登录');
        }

        // 检查登录状态：查找用户头像等特征元素
        const loginIndicator = await page.$('.user-info, .avatar, .user-avatar, [data-testid="user-avatar"]');
        if (!loginIndicator) {
            await page.waitForTimeout(3000);
            const retryIndicator = await page.$('.user-info, .avatar, .user-avatar, [data-testid="user-avatar"]');
            if (!retryIndicator) {
                // 再检查是否有 file input（可能页面结构不同但确实已登录）
                const fileCheck = await page.locator('input[type="file"]').count();
                if (fileCheck === 0) {
                    Log.error('未检测到登录特征且无上传输入框，cookies 可能已过期');
                    throw new Error('小红书登录已过期，请重新扫码登录');
                }
            }
        }
        Log.info('✅ 检测到已登录');

        // 确保在发布页面
        if (!currentUrl.includes('/publish/publish')) {
            Log.info('不在发布页面，重新导航...');
            await page.goto(uploadUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);
        }

        Log.info('页面加载完成');

        // ========== 步骤2: 上传视频 ==========
        Log.info('【步骤2】上传视频文件');

        // 🔥 参考 aigc-human：用 waitForSelector 等待上传控件（state: 'attached' 因为 input 通常是 hidden 的）
        Log.info('等待上传输入框就绪...');
        try {
            await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 60000 });
            Log.info('上传输入框已就绪');
        } catch (e) {
            Log.error('等待上传输入框超时（60秒）');
            throw new Error('发布页面加载超时，请检查网络或重新登录');
        }

        // 查找视频上传输入框（参考 aigc-human xiaoHongShuService.js:317-327）
        let fileInput = await page.$('input.upload-input[type="file"][accept*=".mp4,.mov"]');
        if (!fileInput) {
            fileInput = await page.$('input[type="file"][accept*="video"]');
        }
        if (!fileInput) {
            fileInput = await page.$('input[type="file"]');
        }

        let uploadSuccess = false;

        if (fileInput) {
            try {
                Log.info(`上传文件: ${path.basename(params.videoPath)}`);
                await fileInput.setInputFiles(params.videoPath);
                Log.info('视频文件已上传');
                uploadSuccess = true;

                // 等待页面响应
                await page.waitForTimeout(3000);
            } catch (error: any) {
                Log.error(`文件上传失败: ${error.message}`);
            }
        } else {
            Log.error('未找到视频上传输入框');
            throw new Error('未找到文件上传输入框，请检查页面或重新登录');
        }

        Log.info('');

        // ========== 步骤3: 等待视频处理完成并查找封面编辑按钮 ==========
        Log.info('【步骤3】等待视频处理完成并查找封面编辑按钮');

        // 视频上传后页面可能已经跳转，检测并切换到编辑页面
        Log.info('检测页面是否跳转...');

        // 等待页面响应（视频上传后可能需要一些时间才会跳转）
        await page.waitForTimeout(3000);

        // 循环检查所有页面，找到正确的编辑页面（最多等待10秒）
        let correctPageFound = false;
        const maxWaitTime = 10000; // 最多等待10秒
        const checkInterval = 1000; // 每1秒检查一次
        const startTime = Date.now();

        while (!correctPageFound && (Date.now() - startTime) < maxWaitTime) {
            try {
                // 检查所有页面
                const allPages = context.pages();
                Log.info(`检查页面状态（${allPages.length} 个页面）...`);

                // 首先检查当前页面的URL是否已经变化
                try {
                    const currentUrl = page.url();
                    Log.info(`当前页面URL: ${currentUrl}`);

                    // 检查是否是编辑页面（URL包含/publish/后跟数字，而不是只是/publish）
                    if (currentUrl.includes('creator.xiaohongshu.com')) {
                        // 编辑页面的URL通常是 /publish/数字 格式
                        const isEditPage = (currentUrl.match(/\/publish\/\d+/) ||
                            (currentUrl.includes('/publish/') && !currentUrl.endsWith('/publish') && currentUrl !== 'https://creator.xiaohongshu.com/publish/publish'));

                        if (isEditPage) {
                            Log.info('当前页面已经是编辑页面');
                            correctPageFound = true;
                            break;
                        }
                    }
                } catch (urlError: any) {
                    Log.info(`检查当前页面URL失败: ${urlError.message}`);
                }

                // 检查所有页面，找到编辑页面
                for (let i = 0; i < allPages.length; i++) {
                    const p = allPages[i];
                    if (p.isClosed()) continue;

                    try {
                        const url = p.url();

                        // 跳过about:blank页面和当前页面
                        if (url === 'about:blank' || p === page) {
                            continue;
                        }

                        Log.info(`检查页面 ${i + 1}: ${url}`);

                        // 查找编辑页面（URL包含/publish/后跟数字）
                        if (url.includes('creator.xiaohongshu.com')) {
                            const isEditPage = (url.match(/\/publish\/\d+/) ||
                                (url.includes('/publish/') && !url.endsWith('/publish') && url !== 'https://creator.xiaohongshu.com/publish/publish'));

                            if (isEditPage) {
                                Log.info('找到编辑页面，切换到该页面');
                                await p.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { });
                                await p.waitForTimeout(2000);
                                page = p;
                                correctPageFound = true;
                                break;
                            }
                        }
                    } catch (e: any) {
                        // 继续检查下一个页面
                    }
                }

                if (correctPageFound) {
                    break;
                }

                // 等待一段时间后再次检查
                if ((Date.now() - startTime) < maxWaitTime) {
                    await page.waitForTimeout(checkInterval);
                }
            } catch (checkError: any) {
                Log.info(`页面检查过程中出错: ${checkError.message}`);
                await page.waitForTimeout(checkInterval);
            }
        }

        if (!correctPageFound) {
            Log.info('未找到编辑页面，继续使用当前页面');
        }

        Log.info(`最终操作页面URL: ${page.url()}`);

        // 先等待视频处理完成（视频上传后需要时间处理）
        Log.info('等待视频处理完成...');
        await page.waitForTimeout(5000); // 等待5秒让视频开始处理

        // 等待视频处理完成的标志出现
        let videoProcessed = false;
        const processMaxWait = 120000; // 最多等待2分钟
        const processStartTime = Date.now();

        while (Date.now() - processStartTime < processMaxWait) {
            try {
                // 检查是否有处理完成的标志
                const processedSelectors = [
                    'text="处理完成"',
                    'text="上传成功"',
                    '*:has-text("处理完成")',
                    '*:has-text("上传成功")',
                    'video[src]', // 有视频源说明已处理
                    '[class*="preview"]', // 预览区域出现
                    '[class*="cover"]' // 封面区域出现
                ];

                for (const selector of processedSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        if (count > 0) {
                            videoProcessed = true;
                            Log.info('检测到视频处理完成');
                            break;
                        }
                    } catch (selectorError: any) {
                        // 继续检查下一个选择器
                    }
                }

                if (videoProcessed) break;

                const elapsed = Math.round((Date.now() - processStartTime) / 1000);
                if (elapsed % 10 === 0 && elapsed > 0) {
                    Log.info(`[${elapsed}s] 等待视频处理...`);
                }

                await page.waitForTimeout(2000);
            } catch (e: any) {
                Log.info(`检查视频处理状态失败: ${e.message}`);
                await page.waitForTimeout(2000);
            }
        }

        if (!videoProcessed) {
            Log.info('未检测到视频处理完成标志，继续执行...');
            await page.waitForTimeout(5000); // 额外等待5秒
        }

        Log.info('每1秒查找一次封面编辑按钮，找到后立即执行下一步...');

        let coverEditFound = false;
        const coverMaxWaitTime = 300000; // 最多等待5分钟
        const coverCheckInterval = 1000;
        const coverStartTime = Date.now();

        Log.info('正在查找封面编辑按钮...');

        while (Date.now() - coverStartTime < coverMaxWaitTime) {
            try {
                const coverEditSelectors = [
                    // 优先查找"设置封面"按钮
                    'text="设置封面"',
                    'div:has-text("设置封面")',
                    '*:has-text("设置封面")',
                    '[class*="text"]:has-text("设置封面")',
                    'div.text:has-text("设置封面")',
                    // 其他封面相关按钮
                    '*:has-text("封面") *:has-text("编辑")',
                    '*:has-text("更换封面")',
                    'button:has-text("编辑封面")',
                    'button:has-text("更换封面")',
                    '*:has-text("编辑封面")',
                    'text="编辑"',
                    'button:has-text("编辑")',
                    '[class*="cover"] button:has-text("编辑")',
                    '[class*="cover"] *:has-text("编辑")',
                    '[class*="edit-cover"]',
                    '[class*="cover-edit"]'
                ];

                for (const selector of coverEditSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        if (count > 0) {
                            const element = page.locator(selector).first();
                            const isVisible = await element.isVisible().catch(() => false);
                            if (isVisible) {
                                coverEditFound = true;
                                Log.info('找到封面编辑按钮，立即执行下一步');
                                break;
                            }
                        }
                    } catch (selectorError: any) {
                        // 继续尝试下一个选择器
                    }
                }

                if (coverEditFound) {
                    break;
                }

                const elapsed = Math.round((Date.now() - coverStartTime) / 1000);
                if (elapsed % 10 === 0 && elapsed > 0) {
                    Log.info(`[${elapsed}s] 继续查找封面编辑按钮...`);
                }

                await page.waitForTimeout(coverCheckInterval);
            } catch (e: any) {
                Log.info(`查找封面编辑按钮失败: ${e.message}`);
                await page.waitForTimeout(coverCheckInterval);
            }
        }

        if (!coverEditFound) {
            Log.info('查找封面编辑按钮超时（5分钟）');
            Log.info('继续执行，如果封面编辑按钮未出现，可能需要更长时间');
        }

        // ========== 步骤4: 上传封面 ==========
        Log.info('【步骤4】上传封面');

        Log.info('查找封面编辑按钮（"设置封面"）...');

        const coverSelectors = [
            // 优先查找"设置封面"按钮
            'text="设置封面"',
            'div:has-text("设置封面")',
            '*:has-text("设置封面")',
            '[class*="text"]:has-text("设置封面")',
            'div.text:has-text("设置封面")',
            // 其他封面相关按钮
            '*:has-text("封面") *:has-text("编辑")',
            '*:has-text("更换封面")',
            'button:has-text("编辑封面")',
            'button:has-text("更换封面")',
            'input[type="file"][accept*="image"]'
        ];

        let coverBtn: any = null;
        let coverBtnFound = false;

        for (const selector of coverSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    coverBtn = page.locator(selector).first();
                    const isVisible = await coverBtn.isVisible().catch(() => false);
                    if (isVisible) {
                        coverBtnFound = true;
                        Log.info(`✓ 找到封面编辑按钮: ${selector}`);
                        break;
                    }
                }
            } catch (e: any) {
                Log.info(`选择器 ${selector} 失败: ${e.message}`);
            }
        }

        if (coverBtnFound && coverBtn) {
            try {
                await coverBtn.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
                await coverBtn.click();
                Log.info('已点击封面编辑按钮');

                await page.waitForTimeout(2000);

                // 查找文件输入框
                const coverInputSelectors = [
                    'input[type="file"][accept*="image"]',
                    'input[type="file"]'
                ];

                let coverInput: any = null;
                for (const selector of coverInputSelectors) {
                    const count = await page.locator(selector).count();
                    if (count > 0) {
                        coverInput = page.locator(selector).first();
                        const accept = await coverInput.getAttribute('accept').catch(() => '');
                        if (accept.includes('image') || !accept) {
                            Log.info(`✓ 找到封面文件输入框`);
                            break;
                        }
                    }
                }

                if (coverInput) {
                    try {
                        Log.info(`上传封面: ${path.basename(params.coverPath)}`);
                        await coverInput.setInputFiles(params.coverPath, { timeout: 30000 });
                        Log.info('封面文件已上传');
                        await page.waitForTimeout(2000);

                        // 查找确认按钮
                        const confirmSelectors = [
                            'button:has-text("确认")',
                            'button:has-text("确定")',
                            'button:has-text("保存")',
                            'button:has-text("完成")'
                        ];

                        for (const selector of confirmSelectors) {
                            const count = await page.locator(selector).count();
                            if (count > 0) {
                                const btn = page.locator(selector).first();
                                const isVisible = await btn.isVisible().catch(() => false);
                                if (isVisible) {
                                    await btn.click();
                                    Log.info('已点击确认按钮');
                                    await page.waitForTimeout(2000);
                                    break;
                                }
                            }
                        }
                    } catch (error: any) {
                        Log.info(`封面上传失败: ${error.message}`);
                        Log.info('请手动在浏览器中上传封面');
                    }
                } else {
                    Log.info('未找到封面文件输入框');
                    Log.info('请手动在浏览器中上传封面');
                }
            } catch (error: any) {
                Log.info(`封面编辑失败: ${error.message}`);
                Log.info('请手动在浏览器中上传封面');
            }
        } else {
            Log.info('未找到封面编辑按钮');
            Log.info('请手动在浏览器中上传封面');
        }

        Log.info('');

        // ========== 步骤5: 填写标题 ==========
        Log.info('【步骤5】填写标题');

        await page.waitForTimeout(2000);

        Log.info('查找标题输入框（placeholder="填写标题会有更多赞哦～"）...');

        const titleSelectors = [
            // 优先查找包含"填写标题会有更多赞哦～"的输入框
            'input[placeholder="填写标题会有更多赞哦～"]',
            'input[placeholder*="填写标题会有更多赞哦"]',
            'input[placeholder*="填写标题"]',
            'textarea[placeholder="填写标题会有更多赞哦～"]',
            'textarea[placeholder*="填写标题会有更多赞哦"]',
            'textarea[placeholder*="填写标题"]',
            // 通用标题选择器
            'input[placeholder*="标题"]',
            'textarea[placeholder*="标题"]',
            '[class*="title"] input',
            '[class*="title"] textarea'
        ];

        let titleInput: any = null;
        let titleFound = false;

        for (const selector of titleSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    // 如果有多个，优先选择包含"填写标题会有更多赞哦～"的
                    for (let i = 0; i < count; i++) {
                        const input = page.locator(selector).nth(i);
                        const isVisible = await input.isVisible().catch(() => false);

                        if (isVisible) {
                            // 检查placeholder是否匹配
                            const placeholder = await input.getAttribute('placeholder').catch(() => '');
                            if (placeholder.includes('填写标题会有更多赞哦') || selector.includes('填写标题')) {
                                titleInput = input;
                                titleFound = true;
                                Log.info(`✓ 找到标题输入框: ${selector} (placeholder="${placeholder}")`);
                                break;
                            } else if (i === 0 && placeholder.includes('标题')) {
                                // 如果没有找到完全匹配的，使用第一个包含"标题"的
                                titleInput = input;
                                titleFound = true;
                                Log.info(`✓ 找到标题输入框: ${selector} (placeholder="${placeholder}")`);
                                break;
                            }
                        }
                    }

                    if (titleFound) break;
                }
            } catch (e: any) {
                Log.info(`选择器 ${selector} 失败: ${e.message}`);
            }
        }

        if (titleInput && titleFound) {
            try {
                await titleInput.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
                await titleInput.fill(params.title);
                await page.waitForTimeout(300);
                Log.info(`标题已填写: "${params.title}"`);
            } catch (error: any) {
                Log.info(`标题填写失败: ${error.message}`);
                Log.info('请手动填写标题');
            }
        } else {
            Log.info('未找到标题输入框');
            Log.info('请手动在"填写标题会有更多赞哦～"处填写标题');
        }

        Log.info('');

        // ========== 步骤6: 填写描述和话题 ==========
        Log.info('【步骤6】填写描述和话题');

        await page.waitForTimeout(1000);

        Log.info('查找描述和话题输入框（data-placeholder="输入正文描述，真诚有价值的分享予人温暖"）...');
        Log.info('描述和话题可以在同一个输入框中一起输入');

        const descSelectors = [
            // 优先查找 <p data-placeholder> 标签（ProseMirror编辑器）
            'p[data-placeholder="输入正文描述，真诚有价值的分享予人温暖"]',
            'p[data-placeholder*="输入正文描述"]',
            'p[data-placeholder*="真诚有价值的分享予人温暖"]',
            'p.is-editor-empty[data-placeholder*="输入正文描述"]',
            'p[class*="is-editor-empty"][data-placeholder*="输入正文描述"]',
            'p[class*="is-empty"][data-placeholder*="输入正文描述"]',
            // 查找父容器（可能包含contenteditable）
            '[contenteditable] p[data-placeholder*="输入正文描述"]',
            '[contenteditable="true"] p[data-placeholder*="输入正文描述"]',
            // 其他可能的输入框类型
            'textarea[placeholder="输入正文描述，真诚有价值的分享予人温暖"]',
            'textarea[placeholder*="输入正文描述"]',
            'textarea[placeholder*="真诚有价值的分享予人温暖"]',
            'div[contenteditable][placeholder="输入正文描述，真诚有价值的分享予人温暖"]',
            'div[contenteditable][placeholder*="输入正文描述"]',
            'div[contenteditable][placeholder*="真诚有价值的分享予人温暖"]',
            // 通用选择器
            'textarea[placeholder*="描述"]',
            'textarea[placeholder*="正文"]',
            'div[contenteditable][placeholder*="描述"]',
            'div[contenteditable][placeholder*="正文"]',
            '[class*="description"] textarea',
            '[class*="desc"] textarea',
            '[class*="content"] textarea',
            '[class*="editor"] textarea',
            '[class*="input-editor"]',
            'div[contenteditable="true"]'
        ];

        let descInput: any = null;
        let descFound = false;

        // 方法1: 通过data-placeholder或placeholder直接查找
        for (const selector of descSelectors) {
            try {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    // 如果有多个，优先选择包含提示文字的
                    for (let i = 0; i < count; i++) {
                        const input = page.locator(selector).nth(i);
                        const isVisible = await input.isVisible().catch(() => false);

                        if (isVisible) {
                            // 检查data-placeholder或placeholder是否匹配
                            const dataPlaceholder = await input.getAttribute('data-placeholder').catch(() => '');
                            const placeholder = await input.getAttribute('placeholder').catch(() => '');
                            const combinedPlaceholder = dataPlaceholder || placeholder;

                            if (combinedPlaceholder.includes('输入正文描述') || combinedPlaceholder.includes('真诚有价值的分享予人温暖')) {
                                descInput = input;
                                descFound = true;
                                Log.info(`✓ 找到描述和话题输入框: ${selector} (data-placeholder="${dataPlaceholder}", placeholder="${placeholder}")`);
                                break;
                            } else if (i === 0 && (combinedPlaceholder.includes('描述') || combinedPlaceholder.includes('正文'))) {
                                // 如果没有找到完全匹配的，使用第一个包含"描述"或"正文"的
                                descInput = input;
                                descFound = true;
                                Log.info(`✓ 找到描述和话题输入框: ${selector} (data-placeholder="${dataPlaceholder}", placeholder="${placeholder}")`);
                                break;
                            }
                        }
                    }

                    if (descFound) break;
                }
            } catch (e: any) {
                Log.info(`选择器 ${selector} 失败: ${e.message}`);
            }
        }

        // 方法2: 如果方法1失败，查找包含contenteditable的父容器，然后找其中的p标签
        if (!descFound) {
            try {
                const editableContainers = await page.locator('[contenteditable="true"]').all();
                for (const container of editableContainers) {
                    try {
                        const pTag = container.locator('p[data-placeholder*="输入正文描述"]').first();
                        const pCount = await pTag.count();
                        if (pCount > 0) {
                            const isVisible = await pTag.isVisible().catch(() => false);
                            if (isVisible) {
                                descInput = pTag;
                                descFound = true;
                                Log.info('✓ 找到描述和话题输入框（通过contenteditable容器中的p标签）');
                                break;
                            }
                        }
                    } catch (e) {
                        // 继续查找
                    }
                }
            } catch (e: any) {
                Log.info(`通过contenteditable容器查找失败: ${e.message}`);
            }
        }

        // 方法3: 如果方法1和2失败，通过文本查找包含提示文字的元素
        if (!descFound) {
            try {
                const textElement = page.locator('*:has-text("输入正文描述")').first();
                const textCount = await textElement.count();
                if (textCount > 0) {
                    Log.info('找到包含提示文字的元素，查找附近的输入框...');

                    // 在同一容器内查找输入框（包括p标签）
                    const container = textElement.locator('..');
                    const inputInContainer = container.locator('p[data-placeholder], textarea, div[contenteditable], input[type="text"]').first();
                    const inputCount = await inputInContainer.count();

                    if (inputCount > 0) {
                        const isVisible = await inputInContainer.isVisible().catch(() => false);
                        if (isVisible) {
                            descInput = inputInContainer;
                            descFound = true;
                            Log.info('✓ 找到描述和话题输入框（通过提示文字）');
                        }
                    }
                }
            } catch (e: any) {
                Log.info(`通过文本查找失败: ${e.message}`);
            }
        }

        if (descInput && descFound) {
            try {
                await descInput.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);

                const tagName = await descInput.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
                const contentEditable = await descInput.getAttribute('contenteditable').catch(() => '');
                const dataPlaceholder = await descInput.getAttribute('data-placeholder').catch(() => '');
                const isPTag = tagName === 'p';
                const isContentEditable = contentEditable !== '' || isPTag;

                if (isPTag) {
                    // <p> 标签的处理（ProseMirror编辑器）
                    Log.info('检测到 <p> 标签编辑器，先填写描述，然后逐个输入话题...');
                    await descInput.click();
                    await page.waitForTimeout(300);

                    // 先一次性填写描述
                    Log.info('填写描述...');
                    await descInput.evaluate((el: any, text: string) => {
                        // 清空现有内容（包括br标签）
                        el.innerHTML = '';
                        // 设置文本内容（只包含描述）
                        el.textContent = text;
                        // 移除is-empty类（如果有）
                        el.classList.remove('is-empty', 'is-editor-empty');

                        // 触发input事件
                        const inputEvent = new InputEvent('input', {
                            bubbles: true,
                            cancelable: true,
                            inputType: 'insertText',
                            data: text
                        });
                        el.dispatchEvent(inputEvent);

                        // 查找父容器（可能包含contenteditable），也在父容器上触发事件
                        let parent = el.parentElement;
                        while (parent) {
                            if (parent.getAttribute('contenteditable') === 'true') {
                                const parentInputEvent = new InputEvent('input', { bubbles: true, cancelable: true });
                                parent.dispatchEvent(parentInputEvent);
                                break;
                            }
                            parent = parent.parentElement;
                        }
                    }, params.description);

                    await page.waitForTimeout(500);
                    Log.info(`描述已填写: "${params.description.substring(0, 50)}..."`);

                    // 然后逐个输入话题，每个话题后按回车（不进行任何操作，直接输入#号）
                    if (params.tags && params.tags.length > 0) {
                        Log.info('直接输入#号...');
                        // 直接输入#号，不进行任何其他操作
                        await page.keyboard.type('#', { delay: 100 });
                        await page.waitForTimeout(500); // 增加等待时间，确保#号输入完成

                        // 逐个输入话题
                        for (let i = 0; i < params.tags.length; i++) {
                            const tag = params.tags[i].trim();
                            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

                            Log.info(`输入话题 ${i + 1}/${params.tags.length}: #${cleanTag}`);

                            // 输入话题文字（增加延迟确保输入完成）
                            await page.keyboard.type(cleanTag, { delay: 100 });
                            await page.waitForTimeout(300);

                            // 按空格键触发话题识别（改用空格而不是回车）
                            await page.keyboard.press('Space');
                            await page.waitForTimeout(500);

                            // 检查是否有话题选择弹窗，如果有则按回车确认
                            try {
                                const topicPopup = page.locator('[class*="topic"], [class*="hashtag"], [class*="suggest"]').first();
                                if (await topicPopup.isVisible({ timeout: 1000 })) {
                                    Log.info('检测到话题选择弹窗，选择第一个选项');
                                    await page.keyboard.press('Enter');
                                    await page.waitForTimeout(300);
                                }
                            } catch (e) {
                                Log.debug('未检测到话题弹窗，继续');
                            }

                            // 如果不是最后一个话题，输入#号准备下一个话题
                            if (i < params.tags.length - 1) {
                                await page.keyboard.type('#', { delay: 100 });
                                await page.waitForTimeout(300);
                            }
                        }

                        await page.waitForTimeout(500);
                        Log.info(`话题已添加: ${params.tags.map(tag => `#${tag}`).join(' ')}`);
                    }
                } else if (isContentEditable) {
                    // contenteditable div的处理
                    Log.info('先填写描述，然后逐个输入话题...');
                    await descInput.click();
                    await page.waitForTimeout(300);

                    // 先一次性填写描述
                    Log.info('填写描述...');
                    await descInput.evaluate((el: any, text: string) => {
                        el.focus();
                        el.textContent = text;
                        const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true });
                        el.dispatchEvent(inputEvent);
                    }, params.description);

                    await page.waitForTimeout(500);
                    Log.info(`描述已填写: "${params.description.substring(0, 50)}..."`);

                    // 然后逐个输入话题，每个话题后按回车（不进行任何操作，直接输入#号）
                    if (params.tags && params.tags.length > 0) {
                        Log.info('直接输入#号...');
                        // 直接输入#号，不进行任何其他操作
                        await page.keyboard.type('#', { delay: 100 });
                        await page.waitForTimeout(500); // 增加等待时间，确保#号输入完成

                        // 逐个输入话题
                        for (let i = 0; i < params.tags.length; i++) {
                            const tag = params.tags[i].trim();
                            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

                            Log.info(`输入话题 ${i + 1}/${params.tags.length}: #${cleanTag}`);

                            // 输入话题文字（增加延迟确保输入完成）
                            await page.keyboard.type(cleanTag, { delay: 100 });
                            await page.waitForTimeout(300);

                            // 按空格键触发话题识别（改用空格而不是回车）
                            await page.keyboard.press('Space');
                            await page.waitForTimeout(500);

                            // 检查是否有话题选择弹窗，如果有则按回车确认
                            try {
                                const topicPopup = page.locator('[class*="topic"], [class*="hashtag"], [class*="suggest"]').first();
                                if (await topicPopup.isVisible({ timeout: 1000 })) {
                                    Log.info('检测到话题选择弹窗，选择第一个选项');
                                    await page.keyboard.press('Enter');
                                    await page.waitForTimeout(300);
                                }
                            } catch (e) {
                                Log.debug('未检测到话题弹窗，继续');
                            }

                            // 如果不是最后一个话题，输入#号准备下一个话题
                            if (i < params.tags.length - 1) {
                                await page.keyboard.type('#', { delay: 100 });
                                await page.waitForTimeout(300);
                            }
                        }

                        await page.waitForTimeout(500);
                        Log.info(`话题已添加: ${params.tags.map(tag => `#${tag}`).join(' ')}`);
                    }
                } else {
                    // 普通textarea或input - 先填写描述，然后逐个输入话题
                    Log.info('先填写描述，然后逐个输入话题...');

                    // 先一次性填写描述
                    Log.info('填写描述...');
                    await descInput.fill(params.description);
                    await page.waitForTimeout(500);
                    Log.info(`描述已填写: "${params.description.substring(0, 50)}..."`);

                    // 然后逐个输入话题，每个话题后按回车（不进行任何操作，直接输入#号）
                    if (params.tags && params.tags.length > 0) {
                        Log.info('直接输入#号...');
                        // 直接输入#号，不进行任何其他操作
                        await page.keyboard.type('#', { delay: 100 });
                        await page.waitForTimeout(500); // 增加等待时间，确保#号输入完成

                        // 逐个输入话题
                        for (let i = 0; i < params.tags.length; i++) {
                            const tag = params.tags[i].trim();
                            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

                            Log.info(`输入话题 ${i + 1}/${params.tags.length}: #${cleanTag}`);

                            // 输入话题文字（增加延迟确保输入完成）
                            await page.keyboard.type(cleanTag, { delay: 100 });
                            await page.waitForTimeout(300);

                            // 按空格键触发话题识别（改用空格而不是回车）
                            await page.keyboard.press('Space');
                            await page.waitForTimeout(500);

                            // 检查是否有话题选择弹窗，如果有则按回车确认
                            try {
                                const topicPopup = page.locator('[class*="topic"], [class*="hashtag"], [class*="suggest"]').first();
                                if (await topicPopup.isVisible({ timeout: 1000 })) {
                                    Log.info('检测到话题选择弹窗，选择第一个选项');
                                    await page.keyboard.press('Enter');
                                    await page.waitForTimeout(300);
                                }
                            } catch (e) {
                                Log.debug('未检测到话题弹窗，继续');
                            }

                            // 如果不是最后一个话题，输入#号准备下一个话题
                            if (i < params.tags.length - 1) {
                                await page.keyboard.type('#', { delay: 100 });
                                await page.waitForTimeout(300);
                            }
                        }

                        await page.waitForTimeout(500);
                        Log.info(`话题已添加: ${params.tags.map(tag => `#${tag}`).join(' ')}`);
                    }
                }
            } catch (error: any) {
                Log.info(`描述和话题填写失败: ${error.message}`);
                Log.info('请手动填写描述和话题');
            }
        } else {
            Log.info('未找到描述和话题输入框');
            Log.info('请手动在"输入正文描述"处填写描述和话题（话题用#号添加）');
        }

        Log.info('');

        // ========== 步骤7: 验证封面是否已添加 ==========
        Log.info('【步骤7】验证封面是否已添加');

        // 验证封面是否已上传
        let coverUploaded = false;
        try {
            // 检查是否有封面图片
            const coverImageSelectors = [
                'img[class*="cover"]',
                '[class*="cover"] img',
                'img[src*="cover"]',
                '[class*="thumbnail"] img'
            ];

            for (const selector of coverImageSelectors) {
                const count = await page.locator(selector).count();
                if (count > 0) {
                    const img = page.locator(selector).first();
                    const src = await img.getAttribute('src').catch(() => '');
                    // 如果图片有src且不是占位符，认为封面已上传
                    if (src && !src.includes('placeholder') && !src.includes('default')) {
                        coverUploaded = true;
                        Log.info('验证：封面已上传');
                        break;
                    }
                }
            }

            if (!coverUploaded) {
                Log.info('警告：未检测到封面图片，封面可能未上传');
                Log.info('请检查封面是否已正确上传');
            }
        } catch (e: any) {
            Log.info(`验证封面失败: ${e.message}`);
            Log.info('无法验证封面状态，请手动检查');
        }

        // 话题已经在上面成功添加，不需要验证
        Log.info('话题已在上面成功添加，跳过验证');

        // 如果封面未添加，等待一段时间让用户手动操作
        if (!coverUploaded) {
            Log.info('重要提示：');
            Log.info('  - 封面可能未上传，请检查并手动上传封面');
            Log.info('等待5秒，请手动完成封面上传...');
            await page.waitForTimeout(5000);
        } else {
            Log.info('验证完成：封面已上传，话题已添加');
        }

        Log.info('');

        Log.info('=== 所有准备工作已完成 ===');
        Log.info('视频、封面、标题、描述、话题都已填写完成');

        if (params.autoPublish) {
            Log.info('检测到自动发布标志，准备执行点击发布按钮...');

            // 查找发布按钮
            const publishBtnSelectors = [
                'button:has-text("发布")',
                'div[class*="publish"] button',
                'button[class*="submit"]',
                'button:has-text("立即发布")',
                'div:text-is("发布")'
            ];

            let publishBtn = null;
            for (const selector of publishBtnSelectors) {
                const btn = page.locator(selector).first();
                if (await btn.count() > 0 && await btn.isVisible()) {
                    publishBtn = btn;
                    Log.info(`找到发布按钮: ${selector}`);
                    break;
                }
            }

            if (publishBtn) {
                await page.waitForTimeout(2000); // 稍等片刻
                await publishBtn.click(); // publish-triggered
                publishTriggered = true;
                Log.info('已自动点击发布按钮');

                // 等待发布成功提示
                try {
                    await Promise.race([
                        page.locator('text="发布成功"').waitFor({ timeout: 10000 }),
                        page.locator('text="上传成功"').waitFor({ timeout: 10000 }),
                        page.locator('text="已发布"').waitFor({ timeout: 10000 }),
                        page.waitForTimeout(5000)
                    ]);
                    Log.info('发布操作已提交');
                } catch (e) {
                    Log.info('未检测到明确的发布成功提示，但已执行点击');
                }
            } else {
                Log.warn('未找到发布按钮，请手动点击');
            }
        } else {
            Log.info('请在浏览器中检查内容，然后手动点击保存草稿或发布按钮');
            Log.info('浏览器窗口将保持打开状态，等待您手动操作...');

            await page.waitForTimeout(30000);
        }

        if (params.autoPublish) {
            if (publishTriggered) {
                const publishResult = await waitForPublishConfirmation(page, 'xiaohongshu');
                if (publishResult.success) {
                    shouldClosePage = true;
                }
                return publishResult;
            }
            return {
                success: false,
                status: 'manual_pending',
                message: '未找到明确的发布按钮，请在浏览器中手动确认发布',
                videoUrl: page.url(),
                videoId: '',
                keepPageOpen: true
            };
        }

        const finalUrl = page.url();
        Log.info(`当前页面URL: ${finalUrl}`);

        return {
            success: false,
            status: 'manual_pending',
            message: '准备工作已完成，请在浏览器中手动点击保存草稿或发布按钮',
            videoUrl: finalUrl,
            videoId: 'manual_publish',
            keepPageOpen: true
        };

    } catch (error: any) {
        Log.error('发布到小红书失败', {
            message: error.message,
            stack: error.stack
        });

        if (page) {
            try {
                const screenshotPath = path.join(os.homedir(), '.aigcpanel', 'xiaohongshu_error.png');
                await page.screenshot({ path: screenshotPath });
                Log.info(`错误截图已保存: ${screenshotPath}`);
            } catch (e) {
                // 忽略错误
            }
        }

        throw error;

    } finally {
        if (page && shouldClosePage) {
            try {
                await page.close();
            } catch (error) {
                // 忽略错误
            }
        }
    }
}

/**
 * 从URL提取视频ID
 */
function extractVideoIdFromUrl(url: string): string {
    try {
        const match = url.match(/(?:id=|video\/)([a-zA-Z0-9_-]+)/);
        return match ? match[1] : '';
    } catch (error) {
        return '';
    }
}

/**
 * 获取发布进度
 */
ipcMain.handle('publish:getProgress', async (event, params: { taskId: number }) => {
    try {
        const task = await DbMain.first('SELECT * FROM publish_tasks WHERE id = ?', [params.taskId]);

        if (!task) {
            return { success: false, message: '任务不存在' };
        }

        return {
            success: true,
            status: task.status,
            progress: 0
        };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

/**
 * 取消发布任务
 */
ipcMain.handle('publish:cancel', async (event, params: { taskId: number }) => {
    try {
        await DbMain.execute(
            'UPDATE publish_tasks SET status = ?, updatedAt = ? WHERE id = ?',
            ['cancelled', Date.now(), params.taskId]
        );

        return { success: true };

    } catch (error: any) {
        return { success: false, message: error.message };
    }
});

/**
 * 查询发布历史
 */
ipcMain.handle('publish:getHistory', async (event, params: {
    startDate?: number;
    endDate?: number;
    platform?: string;
    limit?: number;
} = {}) => {
    try {
        let query = 'SELECT * FROM publish_history WHERE 1=1';
        const queryParams: any[] = [];

        if (params.startDate) {
            query += ' AND publishedAt >= ?';
            queryParams.push(params.startDate);
        }

        if (params.endDate) {
            query += ' AND publishedAt <= ?';
            queryParams.push(params.endDate);
        }

        if (params.platform) {
            query += ' AND platform = ?';
            queryParams.push(params.platform);
        }

        query += ' ORDER BY publishedAt DESC';

        if (params.limit) {
            query += ` LIMIT ${params.limit}`;
        }

        const history = await DbMain.select(query, queryParams);

        return {
            success: true,
            history
        };

    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            history: []
        };
    }
});

/**
 * 清理资源
 */
async function cleanup() {
    const contexts = Array.from(browserContexts.values());
    for (const context of contexts) {
        await context.close();
    }
    browserContexts.clear();
}

/**
 * 关闭指定平台的浏览器上下文
 * @param platform 平台名称，如 'douyin'
 */
async function closeBrowserContext(platform: string, accountId?: number | string): Promise<void> {
    try {
        const contextKey = accountId ? `publish_${platform}_${accountId}` : `publish_${platform}`;
        Log.info(`[closeBrowserContext] 开始关闭 ${contextKey} 的浏览器上下文`);

        try {
            const context = browserContexts.get(contextKey);

            if (!context) {
                Log.info(`[closeBrowserContext] ${platform} 的浏览器上下文不存在于缓存中`);
                return;
            }

            Log.info(`[closeBrowserContext] 获取到 ${platform} 的浏览器上下文，开始关闭...`);

            const allPages = context.pages();
            Log.info(`[closeBrowserContext] 发现 ${allPages.length} 个页面，准备关闭`);

            for (const p of allPages) {
                try {
                    const pageUrl = p.url();
                    await p.close();
                    Log.info(`[closeBrowserContext] 已关闭页签: ${pageUrl}`);
                } catch (e) {
                    Log.debug(`[closeBrowserContext] 关闭页签失败（忽略）: ${e}`);
                }
            }

            Log.info(`[closeBrowserContext] 正在调用 context.close()...`);
            await context.close();
            Log.info(`[closeBrowserContext] context.close() 调用完成`);

            browserContexts.delete(contextKey);
            Log.info(`[closeBrowserContext] ✅ ${platform} 浏览器上下文已从缓存删除`);
        } catch (closeBrowserError: any) {
            Log.error(`[closeBrowserContext] 关闭浏览器失败:`, closeBrowserError.message);
            browserContexts.delete(contextKey);
        }
    } catch (error) {
        Log.error(`[closeBrowserContext] 出现异常:`, error);
    }
}

process.on('exit', () => {
    cleanup();
});

export default {
    async init() {
        Log.info('publish module initialized');
    }
};

/**
 * 导出getBrowserContext和closeBrowserContext函数，供其他模块使用（如视频处理）
 */
export { getBrowserContext, closeBrowserContext };
