/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import { ipcMain, net } from "electron";
import { getSessionToken, setSessionToken } from "./session-token";
import { clearElectronConfigCache } from "../systemConfig";
import { Log } from "../log/main";
import { AUTH_SERVER_URL, USE_REMOTE_AUTH } from "./config";

/**
 * 使用 Electron net 模块发送 HTTP 请求
 */
const fetchApi = async (url: string, options: { method?: string; body?: string } = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: options.method || 'GET',
            url: url
        });

        request.setHeader('Content-Type', 'application/json');
        const token = getSessionToken();
        if (token) request.setHeader('Authorization', `Bearer ${token}`);

        let responseData = '';

        request.on('response', (response) => {
            response.on('data', (chunk) => {
                responseData += chunk.toString();
            });

            response.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });

            response.on('error', (error) => {
                reject(error);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            request.write(options.body);
        }

        request.end();
    });
};

/**
 * 远程认证模块
 * 通过 HTTP 调用 user-server API
 */

interface RegisterResult {
    success: boolean;
    userId?: number;
    token?: string;
    message?: string;
    user?: any;
    subscription?: any;
}

interface LoginResult {
    success: boolean;
    token?: string;
    user?: any;
    subscription?: any;
    message?: string;
    needUnbind?: boolean;
    currentDevices?: number;
    maxDevices?: number;
}

let cachedUserId: number | null = null;

function setCachedUserId(userId: number | null) {
    if (userId) cachedUserId = userId;
}

/**
 * 初始化认证模块
 */
const init = async () => {
    Log.info('Auth.init', `认证模块初始化完成 (远程模式: ${USE_REMOTE_AUTH ? '是' : '否'})`);
    Log.info('Auth.init', `认证服务器: ${AUTH_SERVER_URL}`);
};

/**
 * 获取设备指纹
 */
const getDeviceFingerprint = async (): Promise<string> => {
    try {
        const os = require('os');
        const crypto = require('crypto');

        // 收集设备信息
        const info = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0]?.model || 'unknown',
            // 获取第一个非内部网卡的MAC地址
            (Object.values(os.networkInterfaces())
                .flat()
                .find((i: any) => i && !i.internal && i.mac !== '00:00:00:00:00:00') as any)?.mac || 'unknown'
        ].join('|');

        // 生成哈希
        return crypto.createHash('sha256').update(info).digest('hex').substring(0, 32);
    } catch (error) {
        return 'unknown-device';
    }
};

/**
 * 用户注册
 */
const register = async (username: string, email: string, password: string, cdkey?: string): Promise<RegisterResult> => {
    try {
        const deviceFingerprint = await getDeviceFingerprint();

        const result = await fetchApi(`${AUTH_SERVER_URL}/api/register`, {
            method: 'POST',
            body: JSON.stringify({ username, email, password, device_fingerprint: deviceFingerprint, cdkey })
        });
        Log.info('Auth.register', `注册结果: ${result.success ? '成功' : result.message}`);
        if (result.success && result.token) {
            setSessionToken(result.token);
            setCachedUserId(result.user?.id || null);
            clearElectronConfigCache();
        }
        return result;
    } catch (error: any) {
        Log.error('Auth.register', `注册失败: ${error.message}`);
        return {
            success: false,
            message: `网络错误: ${error.message}。请确保认证服务器正在运行。`
        };
    }
};

/**
 * 用户登录
 */
const login = async (email: string, password: string): Promise<LoginResult> => {
    try {
        const deviceFingerprint = await getDeviceFingerprint();

        const result = await fetchApi(`${AUTH_SERVER_URL}/api/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password, device_fingerprint: deviceFingerprint })
        });
        Log.info('Auth.login', `登录结果: ${result.success ? '成功' : result.message}`);
        if (result.success && result.user?.id) { setCachedUserId(result.user.id); setSessionToken(result.token); clearElectronConfigCache(); }
        return result;
    } catch (error: any) {
        Log.error('Auth.login', `登录失败: ${error.message}`);
        return {
            success: false,
            message: `网络错误: ${error.message}。请确保认证服务器正在运行。`
        };
    }
};

/**
 * 验证 Token
 */
const verifyToken = async (token: string): Promise<{ valid: boolean; payload?: any; message?: string }> => {
    try {
        const deviceFingerprint = await getDeviceFingerprint();

        const result = await fetchApi(`${AUTH_SERVER_URL}/api/verify`, {
            method: 'POST',
            body: JSON.stringify({ token, device_fingerprint: deviceFingerprint })
        });
        if (result.valid && result.user?.id) { setCachedUserId(result.user.id); setSessionToken(token); }
        else if (getSessionToken() === token) { setSessionToken(null); clearElectronConfigCache(); }
        return result;
    } catch (error: any) {
        return {
            valid: false,
            message: `网络错误: ${error.message}`
        };
    }
};

/**
 * 获取当前用户信息
 */
const getCurrentUser = async (token: string): Promise<{ success: boolean; user?: any; subscription?: any; message?: string }> => {
    try {
        const result = await fetchApi(`${AUTH_SERVER_URL}/api/verify`, {
            method: 'POST',
            body: JSON.stringify({ token })
        });

        if (result.valid) {
            return {
                success: true,
                user: result.user,
                subscription: result.subscription
            };
        } else {
            return {
                success: false,
                message: result.message || 'Token无效'
            };
        }
    } catch (error: any) {
        return {
            success: false,
            message: `网络错误: ${error.message}`
        };
    }
};

/**
 * 检查订阅状态
 */
const checkSubscriptionStatus = async (userId: number): Promise<{
    hasAccess: boolean;
    expiresAt?: string;
    daysRemaining?: number;
    isExpired?: boolean;
    subscription?: any;
}> => {
    try {
        const result = await fetchApi(`${AUTH_SERVER_URL}/api/subscription/check`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });

        return {
            hasAccess: result.hasAccess,
            expiresAt: result.expiresAt,
            daysRemaining: result.remainingDays,
            isExpired: result.isExpired,
            subscription: result.subscription
        };
    } catch (error: any) {
        Log.error('Auth.checkSubscriptionStatus', `检查订阅状态失败: ${error.message}`);
        return {
            hasAccess: false,
            isExpired: true
        };
    }
};

/**
 * 设备签到
 */
const deviceCheckin = async (userId: number): Promise<{ success: boolean; message?: string }> => {
    try {
        const deviceFingerprint = await getDeviceFingerprint();

        const result = await fetchApi(`${AUTH_SERVER_URL}/api/device/checkin`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, device_fingerprint: deviceFingerprint })
        });
        return result;
    } catch (error: any) {
        return {
            success: false,
            message: error.message
        };
    }
};

// IPC 处理器
ipcMain.handle("auth:register", async (event, username: string, email: string, password: string, cdkey?: string) => {
    return register(username, email, password, cdkey);
});

ipcMain.handle("auth:clearSession", () => { setSessionToken(null); cachedUserId = null; clearElectronConfigCache(); });

ipcMain.handle("auth:login", async (event, email: string, password: string) => {
    return login(email, password);
});

ipcMain.handle("auth:verifyToken", async (event, token: string) => {
    return verifyToken(token);
});

ipcMain.handle("auth:getCurrentUser", async (event, token: string) => {
    return getCurrentUser(token);
});

ipcMain.handle("auth:checkSubscriptionStatus", async (event, userId: number) => {
    return checkSubscriptionStatus(userId);
});

ipcMain.handle("auth:deviceCheckin", async (event, userId: number) => {
    return deviceCheckin(userId);
});

ipcMain.handle("auth:reportGeneration", async (event, params: { userId: number; type: string; detail?: string }) => {
    return reportGeneration(params.userId, params.type, params.detail);
});

async function reportGeneration(userId: number | null, type: string, detail?: string) {
    try {
        const uid = userId || cachedUserId;
        if (!uid) return;
        await fetchApi(`${AUTH_SERVER_URL}/api/user/generation-log`, {
            method: 'POST',
            body: JSON.stringify({ userId: uid, type, detail: detail || '' })
        });
    } catch (e) {}
}

export default {
    init,
    register,
    login,
    verifyToken,
    getCurrentUser,
    checkSubscriptionStatus,
    deviceCheckin,
    getDeviceFingerprint,
    reportGeneration
};
