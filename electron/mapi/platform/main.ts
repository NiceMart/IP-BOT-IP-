import { ipcMain, BrowserWindow } from 'electron';
import { Log } from '../log/main';
import DbMain from '../db/main';
import { PlatformAccount, LoginSession } from './types';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPlaywrightChromiumPath, COMMON_BROWSER_ARGS } from '../../lib/browser-path';
import { getRuntimeDataPath } from '../../lib/resource-path';

// 登录会话存储
const loginSessions: Map<string, LoginSession> = new Map();

// 浏览器实例管理
let browser: Browser | null = null;
const browserContexts: Map<string, BrowserContext> = new Map();

/**
 * 初始化浏览器
 */
async function initBrowser(): Promise<Browser> {
    if (!browser) {
        const executablePath = getPlaywrightChromiumPath();
        browser = await chromium.launch({
            executablePath, // ✅ 使用打包的浏览器，支持自定义安装路径
            headless: false,  // 显示浏览器窗口，方便扫码
            args: COMMON_BROWSER_ARGS
        });
    }
    return browser;
}

/**
 * 获取或创建浏览器上下文
 */
async function getBrowserContext(platform: string): Promise<BrowserContext> {
    if (!browserContexts.has(platform)) {
        const browser = await initBrowser();
        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'zh-CN',
            timezoneId: 'Asia/Shanghai'
        });
        browserContexts.set(platform, context);
    }
    return browserContexts.get(platform)!;
}

/**
 * 生成会话ID
 */
function generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * 启动扫码登录
 */
ipcMain.handle('platform:startQRLogin', async (event, params: { platform: string }) => {
    try {
        const { platform } = params;
        Log.info('platform.startQRLogin', { platform });

        const sessionId = generateSessionId();
        let qrCodeUrl = '';
        const context = await getBrowserContext(platform);
        const page = await context.newPage();

        // 根据平台访问不同的登录页面
        if (platform === 'douyin') {
            await page.goto('https://creator.douyin.com/');

            // 等待二维码出现
            try {
                await page.waitForSelector('.qrcode-img', { timeout: 10000 });
                const qrImgElement = await page.$('.qrcode-img');
                qrCodeUrl = await qrImgElement?.getAttribute('src') || '';

                if (!qrCodeUrl) {
                    // 尝试其他选择器
                    const qrCanvas = await page.$('canvas[class*="qrcode"]');
                    if (qrCanvas) {
                        qrCodeUrl = await qrCanvas.screenshot({ type: 'png' }).then(buffer =>
                            `data:image/png;base64,${buffer.toString('base64')}`
                        );
                    }
                }
            } catch (error) {
                Log.error('Failed to get QR code', error);
            }

        } else if (platform === 'kuaishou') {
            await page.goto('https://cp.kuaishou.com/');

            try {
                await page.waitForSelector('.qrcode-box img', { timeout: 10000 });
                const qrImgElement = await page.$('.qrcode-box img');
                qrCodeUrl = await qrImgElement?.getAttribute('src') || '';
            } catch (error) {
                Log.error('Failed to get QR code', error);
            }

        } else if (platform === 'shipin') {
            await page.goto('https://channels.weixin.qq.com/');

            try {
                await page.waitForSelector('.qrcode img', { timeout: 10000 });
                const qrImgElement = await page.$('.qrcode img');
                qrCodeUrl = await qrImgElement?.getAttribute('src') || '';
            } catch (error) {
                Log.error('Failed to get QR code', error);
            }
        }

        // 存储登录会话
        const session: LoginSession = {
            sessionId,
            platform,
            qrCodeUrl,
            status: 'pending',
            createdAt: Date.now()
        };
        loginSessions.set(sessionId, session);

        // 将page存储到context的metadata中，以便后续使用
        (context as any)._loginPage = page;

        return {
            success: true,
            sessionId,
            qrCodeUrl
        };

    } catch (error: any) {
        Log.error('platform.startQRLogin error', error);
        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 检查登录状态
 */
ipcMain.handle('platform:checkLoginStatus', async (event, params: { sessionId: string }) => {
    try {
        const { sessionId } = params;
        const session = loginSessions.get(sessionId);

        if (!session) {
            return { status: 'expired' };
        }

        // 检查会话是否过期 (5分钟)
        if (Date.now() - session.createdAt > 5 * 60 * 1000) {
            session.status = 'expired';
            return { status: 'expired' };
        }

        const context = browserContexts.get(session.platform);
        if (!context) {
            return { status: 'expired' };
        }

        const page = (context as any)._loginPage as Page;
        if (!page) {
            return { status: 'expired' };
        }

        // 检查是否登录成功（通过检查页面URL或特定元素）
        const currentUrl = page.url();
        let isLoggedIn = false;

        if (session.platform === 'douyin') {
            isLoggedIn = currentUrl.includes('/creator/') && !currentUrl.includes('/login');
        } else if (session.platform === 'kuaishou') {
            isLoggedIn = currentUrl.includes('/cp.kuaishou.com/article');
        } else if (session.platform === 'shipin') {
            isLoggedIn = currentUrl.includes('/channels.weixin.qq.com/platform');
        }

        if (isLoggedIn) {
            // 登录成功，获取Cookie
            const cookies = await context.cookies();

            // 提取用户信息
            let userInfo = await extractUserInfo(page, session.platform);

            // 保存到数据库
            const now = Date.now();

            await DbMain.insert(
                `INSERT INTO platform_accounts (platform, nickname, uid, avatar, cookies, tokens, loginStatus, expiresAt, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    session.platform,
                    userInfo.nickname || '',
                    userInfo.uid || '',
                    userInfo.avatar || '',
                    JSON.stringify(cookies),
                    '',  // tokens
                    'active',
                    now + 30 * 24 * 60 * 60 * 1000,  // 30天后过期
                    now,
                    now
                ]
            );

            session.status = 'success';

            // 🔧 修改：检测到已登录后，必须关闭浏览器（不是关页签，是关闭整个浏览器）
            try {
                // 关闭登录页面
                await page.close();
                (context as any)._loginPage = null;

                // 关闭浏览器上下文（这会关闭整个浏览器窗口）
                Log.info(`✅ 检测到${session.platform}已登录，准备关闭浏览器`);
                await context.close();
                browserContexts.delete(session.platform);
                Log.info(`✅ 浏览器已关闭`);
            } catch (closeError: any) {
                Log.error('关闭浏览器失败:', closeError.message);
            }

            return {
                status: 'success',
                userInfo
            };
        }

        return { status: 'pending' };

    } catch (error: any) {
        Log.error('platform.checkLoginStatus error', error);
        return {
            status: 'failed',
            message: error.message
        };
    }
});

/**
 * 提取用户信息
 */
async function extractUserInfo(page: Page, platform: string): Promise<any> {
    try {
        if (platform === 'douyin') {
            // 尝试提取抖音用户信息
            const nickname = await page.locator('.username, .account-name').first().textContent().catch(() => '');
            const avatar = await page.locator('.avatar img').first().getAttribute('src').catch(() => '');

            return { nickname: nickname?.trim() || '', avatar: avatar || '', uid: '' };
        } else if (platform === 'kuaishou') {
            const nickname = await page.locator('.user-name').first().textContent().catch(() => '');
            const avatar = await page.locator('.user-avatar img').first().getAttribute('src').catch(() => '');

            return { nickname: nickname?.trim() || '', avatar: avatar || '', uid: '' };
        } else if (platform === 'shipin') {
            const nickname = await page.locator('.nickname').first().textContent().catch(() => '');
            const avatar = await page.locator('.avatar img').first().getAttribute('src').catch(() => '');

            return { nickname: nickname?.trim() || '', avatar: avatar || '', uid: '' };
        }
    } catch (error) {
        Log.error('extractUserInfo error', error);
    }

    return { nickname: '', avatar: '', uid: '' };
}

/**
 * 获取账号列表
 */
ipcMain.handle('platform:getAccounts', async (event, params: { platform?: string } = {}) => {
    try {
        let query = 'SELECT * FROM platform_accounts WHERE loginStatus = ?';
        let queryParams: any[] = ['active'];

        if (params.platform) {
            query += ' AND platform = ?';
            queryParams.push(params.platform);
        }

        query += ' ORDER BY updatedAt DESC';

        const accounts = await DbMain.select(query, queryParams);

        // 解密cookies（这里简化处理，实际应该加密存储）
        const result = accounts.map(acc => ({
            ...acc,
            cookies: null,  // 不返回敏感信息到前端
            tokens: null
        }));

        return {
            success: true,
            accounts: result
        };

    } catch (error: any) {
        Log.error('platform.getAccounts error', error);
        return {
            success: false,
            message: error.message,
            accounts: []
        };
    }
});

/**
 * 登出账号
 */
ipcMain.handle('platform:logout', async (event, params: { accountId: number }) => {
    try {
        const { accountId } = params;

        await DbMain.execute(
            'UPDATE platform_accounts SET loginStatus = ?, updatedAt = ? WHERE id = ?',
            ['expired', Date.now(), accountId]
        );

        return { success: true };

    } catch (error: any) {
        Log.error('platform.logout error', error);
        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 清除平台的浏览器数据和Cookie（完全清空登录状态）
 */
ipcMain.handle('platform:clearBrowserData', async (event, params: { platform: string }) => {
    try {
        const { platform } = params;

        Log.info(`[clearBrowserData] 开始清除${platform}的浏览器数据`);

        // 1. 关闭 Publish 模块管理的浏览器上下文 (关键步骤：释放文件锁)
        try {
            // 动态导入 publish 模块，避免循环依赖
            const { closeBrowserContext } = await import('../publish/main');
            await closeBrowserContext(platform);
            Log.info(`[clearBrowserData] 已调用 publish.closeBrowserContext 关闭${platform}浏览器`);
        } catch (e: any) {
            Log.warn(`[clearBrowserData] 关闭Publish模块浏览器失败 (可能未打开):`, e.message);
        }

        // 2. 关闭 Platform 模块自己管理的浏览器上下文 (如果有)
        // 注意：Platform 模块的 key 是 platform，不是 publish_${platform}
        if (browserContexts.has(platform)) {
            try {
                const context = browserContexts.get(platform)!;
                await context.close();
                browserContexts.delete(platform);
                Log.info(`[clearBrowserData] 已关闭并删除Platform模块的${platform}浏览器上下文`);
            } catch (error: any) {
                Log.warn(`[clearBrowserData] 关闭Platform模块浏览器上下文失败:`, error.message);
            }
        }

        // 0. 🔴 终极手段：强制杀死所有 Chromium 进程，确保没有文件被锁
        try {
            const { execSync } = require('child_process');
            Log.info('[clearBrowserData] 正在强制关闭所有浏览器进程...');
            // Windows 下强制杀死 chrome.exe 和 chromium.exe
            if (process.platform === 'win32') {
                execSync('taskkill /F /IM chrome.exe /IM chromium.exe /T 2>nul', { stdio: 'ignore' });
            } else {
                execSync('pkill -9 -f chromium || true', { stdio: 'ignore' });
                execSync('pkill -9 -f chrome || true', { stdio: 'ignore' });
            }
            Log.info('[clearBrowserData] 浏览器进程已强制清理');
        } catch (e) {
            Log.warn('[clearBrowserData] 强制关闭进程时出错（可忽略）:', e);
        }

        // 等待进程完全退出释放文件锁
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 🔥 3. 删除持久化浏览器数据目录（增强版：彻底清除）
        const userDataDir = getRuntimeDataPath('browser-data', 'platform', platform);
        if (fs.existsSync(userDataDir)) {
            try {
                // 第一步：强制关闭占用这个目录的所有进程
                const { execSync } = require('child_process');
                try {
                    Log.info(`[clearBrowserData] 尝试解除${userDataDir}上的文件锁...`);
                    if (process.platform === 'win32') {
                        // Windows 下使用 handle.exe 或直接杀 chrome 进程
                        execSync(`taskkill /F /IM chrome.exe /IM chromium.exe 2>nul`, { stdio: 'ignore' });
                    }
                } catch (e) {
                    Log.debug(`[clearBrowserData] 解除文件锁失败（可忽略）:`, e);
                }

                // 第二步：等待文件锁释放
                await new Promise(resolve => setTimeout(resolve, 500));

                // 第三步：增加重试机制，防止文件锁释放延迟
                let retries = 10; // 增加重试次数到10
                while (retries > 0) {
                    try {
                        // 尝试先清空目录内容
                        if (fs.existsSync(userDataDir)) {
                            const files = fs.readdirSync(userDataDir);
                            for (const file of files) {
                                const curPath = path.join(userDataDir, file);
                                try {
                                    if (fs.lstatSync(curPath).isDirectory()) {
                                        fs.rmSync(curPath, { recursive: true, force: true });
                                    } else {
                                        fs.unlinkSync(curPath);
                                    }
                                } catch (e) { } // 忽略单个文件删除失败
                            }

                            // 然后删除目录本身
                            fs.rmSync(userDataDir, { recursive: true, force: true });
                        }

                        // 第四步：验证目录是否真的被删除了
                        if (fs.existsSync(userDataDir)) {
                            throw new Error('目录仍然存在');
                        }

                        Log.info(`[clearBrowserData] ✅ 已彻底删除浏览器数据目录: ${userDataDir}`);
                        break;
                    } catch (rmError: any) {
                        retries--;
                        if (retries === 0) {
                            throw new Error(`无法删除目录 (尝试${10}次后放弃): ${rmError.message}`);
                        }
                        Log.warn(`[clearBrowserData] 删除目录失败，等待后重试 (${retries} left)...`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            } catch (error: any) {
                Log.error(`[clearBrowserData] 删除浏览器数据目录失败:`, error.message);
                // 最后手段：重命名目录
                try {
                    const trashPath = getRuntimeDataPath('trash', `${platform}_${Date.now()}`);
                    fs.mkdirSync(path.dirname(trashPath), { recursive: true });
                    fs.renameSync(userDataDir, trashPath);
                    Log.warn(`[clearBrowserData] ⚠️ 无法删除，已将目录重命名为: ${trashPath}`);
                } catch (mvError) {
                    Log.error(`[clearBrowserData] 重命名也失败:`, mvError);
                    throw mvError;
                }
            }
        } else {
            Log.info(`[clearBrowserData] 数据目录不存在，无需删除: ${userDataDir}`);
        }

        // 🔥 3.5 关键：清除全局 Chromium User Data 目录中的 cookies
        // 这是真正存储所有 cookies 的地方！（所有 Chromium 实例共享）
        try {
            let globalChromiumDataDir: string;
            if (process.platform === 'win32') {
                globalChromiumDataDir = path.join(os.homedir(), 'AppData', 'Local', 'Chromium', 'User Data', 'Default');
            } else if (process.platform === 'darwin') {
                globalChromiumDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'Chromium', 'Default');
            } else {
                globalChromiumDataDir = path.join(os.homedir(), '.config', 'chromium', 'Default');
            }

            if (fs.existsSync(globalChromiumDataDir)) {
                const filesToClean = [
                    'Network/Cookies',
                    'Network/Cookies-journal',
                    'Network/Network Persistent State',
                    'Cookies',
                    'Cookies-journal',
                ];

                for (const file of filesToClean) {
                    try {
                        const filePath = path.join(globalChromiumDataDir, file);
                        if (fs.existsSync(filePath)) {
                            if (fs.statSync(filePath).isDirectory()) {
                                fs.rmSync(filePath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(filePath);
                            }
                            Log.info(`[clearBrowserData] 已清除全局Chromium cookies: ${file}`);
                        }
                    } catch (e: any) {
                        Log.warn(`[clearBrowserData] 清除全局Chromium文件失败 ${file} (可忽略):`, e.message);
                    }
                }
            }
        } catch (error: any) {
            Log.warn(`[clearBrowserData] 清除全局Chromium User Data失败（可忽略）:`, error.message);
        }

        // 3.6 🔧 新增：清除 ipAgent 模块使用的 douyin-browser-data 目录
        if (platform === 'douyin') {
            // 先关闭 DouyinBrowserManager 管理的浏览器实例
            try {
                const { DouyinBrowserManager } = await import('../ipAgent/browserManager');
                await DouyinBrowserManager.cleanup();
                Log.info(`[clearBrowserData] 已关闭 DouyinBrowserManager 的浏览器实例`);
            } catch (e: any) {
                Log.warn(`[clearBrowserData] 关闭 DouyinBrowserManager 失败 (可能未初始化):`, e.message);
            }

            const { app } = await import('electron');
            const douyinBrowserDataDir = path.join(app.getPath('userData'), 'douyin-browser-data');
            if (fs.existsSync(douyinBrowserDataDir)) {
                try {
                    let retries = 5;
                    while (retries > 0) {
                        try {
                            fs.rmSync(douyinBrowserDataDir, { recursive: true, force: true });
                            if (fs.existsSync(douyinBrowserDataDir)) throw new Error('目录仍存在');

                            Log.info(`[clearBrowserData] 已删除抖音浏览器数据目录: ${douyinBrowserDataDir}`);
                            break;
                        } catch (rmError: any) {
                            retries--;
                            if (retries === 0) throw rmError;
                            Log.warn(`[clearBrowserData] 删除抖音目录失败，等待1秒后重试 (${retries} left)...`);
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        }
                    }
                } catch (error: any) {
                    Log.error(`[clearBrowserData] 删除抖音浏览器数据目录失败:`, error.message);
                    // 尝试重命名
                    try {
                        const trashPath = path.join(app.getPath('userData'), 'trash', `douyin_${Date.now()}`);
                        fs.mkdirSync(path.dirname(trashPath), { recursive: true });
                        fs.renameSync(douyinBrowserDataDir, trashPath);
                        Log.info(`[clearBrowserData] 删除失败，已将目录重命名为: ${trashPath}`);
                    } catch (mvError) { }
                }
            } else {
                Log.info(`[clearBrowserData] 抖音数据目录不存在，无需删除: ${douyinBrowserDataDir}`);
            }
        }

        // 4. 从数据库中删除该平台的所有账号
        try {
            const result = await DbMain.execute(
                'DELETE FROM platform_accounts WHERE platform = ?',
                [platform]
            );
            Log.info(`[clearBrowserData] 已从数据库删除${platform}的所有账号`);
        } catch (error: any) {
            Log.error(`[clearBrowserData] 删除数据库账号失败:`, error.message);
            throw error;
        }

        // 🔥 4.5 关键步骤：清除内存中的浏览器实例和持久化上下文缓存
        // 这是彻底清除cookies的关键！否则Playwright会从内存恢复旧数据
        try {
            // 关闭全局浏览器实例，强制释放内存中的cookies和session
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {
                    Log.warn(`[clearBrowserData] browser.close() 失败:`, e);
                }
                browser = null;
            }

            // 清除所有浏览器上下文的缓存引用（包括该平台的）
            browserContexts.clear();

            Log.info(`[clearBrowserData] ✅ 已关闭全局浏览器实例和所有上下文，清除内存中的所有cookies和session数据`);
        } catch (error: any) {
            Log.warn(`[clearBrowserData] 清除内存缓存时出错（但可以继续）:`, error.message);
        }

        Log.info(`[clearBrowserData] ${platform} 数据清除成功`);
        return { success: true, message: `已清除${platform}的所有浏览器数据和登录信息` };

    } catch (error: any) {
        // 关键：确保记录完整的错误信息
        Log.error('[clearBrowserData] 清除浏览器数据失败:', {
            message: error.message,
            stack: error.stack
        });
        return {
            success: false,
            message: error.message || '未知错误'
        };
    }
});

/**
 * 刷新账号信息（真正打开浏览器检测登录状态）
 */
ipcMain.handle('platform:refreshAccount', async (event, params: { accountId: number }) => {
    try {
        const { accountId } = params;

        const account = await DbMain.first(
            'SELECT * FROM platform_accounts WHERE id = ?',
            [accountId]
        );

        if (!account) {
            return { success: false, message: '账号不存在' };
        }

        // 🔧 修改：调用 publish 模块的检查登录状态功能（这会真正打开浏览器检测）
        const platform = account.platform;
        Log.info(`开始刷新${platform}账号，真正检测登录状态`);

        // 直接使用 publish 模块的函数来检测登录状态
        const { getBrowserContext, closeBrowserContext } = await import('../publish/main');
        const context = await getBrowserContext(platform);
        const page = await context.newPage();

        let isLoggedIn = false;
        let userInfo: any = {};

        try {
            // 根据平台确定检查URL
            let checkUrl = '';
            if (platform === 'douyin') {
                checkUrl = 'https://creator.douyin.com/creator-micro/content/upload';
            } else if (platform === 'kuaishou') {
                checkUrl = 'https://cp.kuaishou.com/article/publish';
            } else if (platform === 'shipin') {
                checkUrl = 'https://channels.weixin.qq.com/platform/post/create';
            } else if (platform === 'xiaohongshu') {
                checkUrl = 'https://creator.xiaohongshu.com/publish/publish';
            }

            if (checkUrl) {
                await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                const currentUrl = page.url();

                // 检测登录状态
                if (platform === 'douyin') {
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    isLoggedIn = fileInputCount > 0 || (currentUrl.includes('creator.douyin.com') && !currentUrl.includes('login'));
                    userInfo.nickname = '用户';
                } else if (platform === 'kuaishou') {
                    isLoggedIn = currentUrl.includes('cp.kuaishou.com') && !currentUrl.includes('login');
                    userInfo.nickname = '用户';
                } else if (platform === 'shipin') {
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    isLoggedIn = fileInputCount > 0 || (currentUrl.includes('channels.weixin.qq.com') && !currentUrl.includes('login'));
                    userInfo.nickname = '用户';
                } else if (platform === 'xiaohongshu') {
                    const fileInputCount = await page.locator('input[type="file"]').count();
                    isLoggedIn = fileInputCount > 0 || (currentUrl.includes('creator.xiaohongshu.com') && !currentUrl.includes('login'));
                    userInfo.nickname = '用户';
                }

                // 如果已登录，获取最新的Cookie
                if (isLoggedIn) {
                    const cookies = await context.cookies();
                    const now = Date.now();

                    // 更新数据库中的账号信息
                    await DbMain.execute(
                        'UPDATE platform_accounts SET cookies = ?, nickname = ?, updatedAt = ?, loginStatus = ? WHERE id = ?',
                        [JSON.stringify(cookies), userInfo.nickname || account.nickname, now, 'active', accountId]
                    );

                    Log.info(`${platform}刷新成功，已登录`);
                } else {
                    // 未登录，更新状态为 inactive
                    await DbMain.execute(
                        'UPDATE platform_accounts SET loginStatus = ?, updatedAt = ? WHERE id = ?',
                        ['inactive', Date.now(), accountId]
                    );
                    Log.info(`${platform}刷新完成，未登录`);
                }
            }
        } catch (error: any) {
            Log.error(`刷新${platform}账号时检测登录状态失败:`, error);
        } finally {
            // 关闭页面和浏览器
            try {
                if (page && !page.isClosed()) {
                    await page.close();
                }
                // 关闭浏览器上下文
                await closeBrowserContext(platform);
            } catch (closeError: any) {
                Log.error('关闭浏览器失败:', closeError.message);
            }
        }

        // 重新查询更新后的账号信息
        const updatedAccount = await DbMain.first(
            'SELECT * FROM platform_accounts WHERE id = ?',
            [accountId]
        );

        return {
            success: true,
            isLoggedIn,
            account: {
                ...updatedAccount,
                cookies: null,  // 不返回敏感信息
                tokens: null
            },
            userInfo
        };

    } catch (error: any) {
        Log.error('platform.refreshAccount error', error);
        return {
            success: false,
            message: error.message
        };
    }
});

/**
 * 清理资源
 */
async function cleanup() {
    for (const context of browserContexts.values()) {
        await context.close();
    }
    browserContexts.clear();

    if (browser) {
        await browser.close();
        browser = null;
    }

    loginSessions.clear();
}

// 应用退出时清理
process.on('exit', () => {
    cleanup();
});

export default {
    async init() {
        Log.info('platform module initialized');
    }
};
