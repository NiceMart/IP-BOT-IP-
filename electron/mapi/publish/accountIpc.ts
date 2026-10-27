/**
 * 账号管理 IPC 处理器
 * 提供平台账号的增删改查功能
 */

import { ipcMain } from 'electron';
import { Log } from '../log/main';
import DbMain from '../db/main';
import { PlatformAccount } from './types';

/**
 * 支持的平台列表
 */
const SUPPORTED_PLATFORMS = [
    { key: 'douyin', name: '抖音' },
    { key: 'kuaishou', name: '快手' },
    { key: 'shipin', name: '视频号' },
    { key: 'xiaohongshu', name: '小红书' },
];

/**
 * 获取支持的平台列表
 */
ipcMain.handle('account:getSupportedPlatforms', async () => {
    return { success: true, data: SUPPORTED_PLATFORMS };
});

/**
 * 获取所有账号列表
 */
ipcMain.handle('account:list', async (event, params?: { platform?: string }) => {
    try {
        let sql = 'SELECT * FROM platform_accounts';
        const sqlParams: any[] = [];

        if (params?.platform) {
            sql += ' WHERE platform = ?';
            sqlParams.push(params.platform);
        }

        sql += ' ORDER BY updatedAt DESC';

        const accounts = await DbMain.select(sql, sqlParams);

        // 不返回 cookies 原文（太长），只返回是否有 cookies
        const safeAccounts = accounts.map((a: any) => ({
            ...a,
            hasCookies: !!a.cookies && a.cookies.length > 10,
            cookies: undefined, // 移除 cookies 原文
            tokens: undefined,  // 移除 tokens 原文
        }));

        return { success: true, data: safeAccounts };
    } catch (error: any) {
        Log.error('account:list error', error);
        return { success: false, message: error.message };
    }
});

/**
 * 添加新账号
 */
ipcMain.handle('account:add', async (event, params: { platform: string; nickname?: string }) => {
    try {
        const { platform, nickname } = params;

        // 验证平台
        if (!SUPPORTED_PLATFORMS.find(p => p.key === platform)) {
            return { success: false, message: `不支持的平台: ${platform}` };
        }

        const now = Date.now();
        const accountId = await DbMain.insert(
            `INSERT INTO platform_accounts (platform, nickname, loginStatus, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?)`,
            [platform, nickname || '未登录', 'pending', now, now]
        );

        Log.info(`新账号已创建: platform=${platform}, id=${accountId}`);

        return {
            success: true,
            data: { id: accountId, platform, nickname: nickname || '未登录', loginStatus: 'pending' }
        };
    } catch (error: any) {
        Log.error('account:add error', error);
        return { success: false, message: error.message };
    }
});

/**
 * 删除账号
 */
ipcMain.handle('account:delete', async (event, params: { accountId: number }) => {
    try {
        const { accountId } = params;

        const account = await DbMain.first(
            'SELECT * FROM platform_accounts WHERE id = ?',
            [accountId]
        );

        if (!account) {
            return { success: false, message: '账号不存在' };
        }

        await DbMain.execute('DELETE FROM platform_accounts WHERE id = ?', [accountId]);
        Log.info(`账号已删除: id=${accountId}, platform=${account.platform}`);

        return { success: true, message: '账号已删除' };
    } catch (error: any) {
        Log.error('account:delete error', error);
        return { success: false, message: error.message };
    }
});

/**
 * 更新账号信息
 */
ipcMain.handle('account:update', async (event, params: { accountId: number; nickname?: string }) => {
    try {
        const { accountId, nickname } = params;
        const now = Date.now();

        const updates: string[] = ['updatedAt = ?'];
        const values: any[] = [now];

        if (nickname !== undefined) {
            updates.push('nickname = ?');
            values.push(nickname);
        }

        values.push(accountId);

        await DbMain.execute(
            `UPDATE platform_accounts SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return { success: true, message: '账号已更新' };
    } catch (error: any) {
        Log.error('account:update error', error);
        return { success: false, message: error.message };
    }
});

/**
 * 获取单个账号详情
 */
ipcMain.handle('account:get', async (event, params: { accountId: number }) => {
    try {
        const account = await DbMain.first(
            'SELECT * FROM platform_accounts WHERE id = ?',
            [params.accountId]
        );

        if (!account) {
            return { success: false, message: '账号不存在' };
        }

        return {
            success: true,
            data: {
                ...account,
                hasCookies: !!account.cookies && account.cookies.length > 10,
                cookies: undefined,
                tokens: undefined,
            }
        };
    } catch (error: any) {
        Log.error('account:get error', error);
        return { success: false, message: error.message };
    }
});
