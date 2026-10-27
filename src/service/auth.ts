/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
/**
 * 前端认证服务
 * 负责与后端 IPC 通信，处理用户注册、登录、Token 管理等
 */

import { clearConfigCache } from './systemConfig';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const AUTH_SUBSCRIPTION_KEY = 'auth_subscription';
const AUTH_SESSION_FLAG = 'auth_session_active';
const AUTH_REMEMBER_ME_KEY = 'auth_remember_me';

// 🔧 应用启动时清除登录状态（确保每次启动都需要重新登录）
// 使用 sessionStorage 标记当前会话，如果没有标记说明是新启动
// 💡 新增：如果用户选择了"记住我"，则不清除登录状态
if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    const isSessionActive = sessionStorage.getItem(AUTH_SESSION_FLAG);
    const rememberMe = localStorage.getItem(AUTH_REMEMBER_ME_KEY);

    if (!isSessionActive) {
        // 检查是否勾选了"记住我"
        if (rememberMe !== 'true') {
            // 新会话，且用户未选择记住我，清除之前的登录状态
            console.log('[Auth] 新会话启动，清除之前的登录状态');
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
            localStorage.removeItem(AUTH_SUBSCRIPTION_KEY);
        } else {
            console.log('[Auth] 新会话启动，但用户选择了记住我，保留登录状态');
        }
        // 标记当前会话
        sessionStorage.setItem(AUTH_SESSION_FLAG, 'true');
    }
}

interface AuthResult {
    success: boolean;
    token?: string;
    user?: any;
    subscription?: any;
    message?: string;
}

interface VerifyResult {
    valid: boolean;
    payload?: any;
    kicked?: boolean;
    message?: string;
    apiUnavailable?: boolean;
}

interface RegisterData {
    username: string;
    email: string;
    password: string;
    cdkey?: string;
}

interface LoginData {
    email: string;
    password: string;
    rememberMe?: boolean;
}

/**
 * 检查 window.$mapi 是否可用
 */
const ensureApiAvailable = async (): Promise<boolean> => {
    for (let i = 0; i < 10; i++) {
        if (typeof window !== 'undefined' && window['$mapi'] && window['$mapi'].auth) {
            return true;
        }
        if (i === 0) {
            const keys = typeof window !== 'undefined' ? Object.keys(window).filter(k => k.startsWith('$') || k.startsWith('__')) : [];
            console.warn(`[Auth.ensureApiAvailable] window.$mapi 不存在, 等待重试 (${i + 1}/10), window特殊键:`, keys);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    console.error('[Auth.ensureApiAvailable] 等待超时，window.$mapi 仍未就绪');
    return false;
};

const clearAuthStorage = () => {
    clearConfigCache();
    window.$mapi?.auth?.clearSession?.().catch(() => {});
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_SUBSCRIPTION_KEY);
};

/**
 * 用户注册
 */
const register = async (data: RegisterData): Promise<AuthResult> => {
    try {
        if (!await ensureApiAvailable()) {
            return {
                success: false,
                message: '认证 API 不可用'
            };
        }

        const result = await window['$mapi'].auth.register(data);

        if (result.success && result.token) {
            // 保存 Token 和用户信息
            localStorage.setItem(AUTH_TOKEN_KEY, result.token);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
            localStorage.setItem(AUTH_SUBSCRIPTION_KEY, JSON.stringify(result.subscription));
        }

        return result;
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '注册失败'
        };
    }
};

/**
 * 用户登录
 */
const login = async (data: LoginData): Promise<AuthResult> => {
    try {
        if (!await ensureApiAvailable()) {
            return {
                success: false,
                message: '认证 API 不可用'
            };
        }

        const result = await window['$mapi'].auth.login(data);

        if (result.success && result.token) {
            // 保存 Token 和用户信息
            localStorage.setItem(AUTH_TOKEN_KEY, result.token);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
            localStorage.setItem(AUTH_SUBSCRIPTION_KEY, JSON.stringify(result.subscription));

            // 💡 保存"记住我"的选择
            if (data.rememberMe) {
                localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'true');
                localStorage.setItem('auth_saved_email', data.email);
                localStorage.removeItem('auth_saved_password');
                console.log('[Auth] 用户选择了记住我，已保存登录状态');
            } else {
                localStorage.removeItem(AUTH_REMEMBER_ME_KEY);
                localStorage.removeItem('auth_saved_email');
                localStorage.removeItem('auth_saved_password');
                console.log('[Auth] 用户未选择记住我，登录状态仅保留到应用关闭');
            }
        }

        return result;
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '登录失败'
        };
    }
};

/**
 * 用户登出
 */
const logout = async () => {
    try {
        clearAuthStorage();
        localStorage.removeItem(AUTH_REMEMBER_ME_KEY);
        localStorage.removeItem('auth_saved_email');
        localStorage.removeItem('auth_saved_password');

        return {
            success: true,
            message: '已登出'
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '登出失败'
        };
    }
};

/**
 * 获取存储的 Token
 */
const getToken = (): string | null => {
    try {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
        return null;
    }
};

/**
 * 获取存储的用户信息
 */
const getUser = (): any | null => {
    try {
        const userStr = localStorage.getItem(AUTH_USER_KEY);
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        return null;
    }
};

/**
 * 获取存储的订阅信息
 */
const getSubscription = (): any | null => {
    try {
        const subStr = localStorage.getItem(AUTH_SUBSCRIPTION_KEY);
        return subStr ? JSON.parse(subStr) : null;
    } catch (error) {
        return null;
    }
};

/**
 * 验证 Token 有效性
 */
const verifyToken = async (token?: string): Promise<VerifyResult> => {
    try {
        if (!await ensureApiAvailable()) {
            return {
                valid: false,
                message: '认证 API 不可用',
                apiUnavailable: true,
            };
        }

        const tokenToVerify = token || getToken();
        if (!tokenToVerify) {
            return {
                valid: false,
                message: 'Token 不存在'
            };
        }

        const result = await window['$mapi'].auth.verifyToken(tokenToVerify);

        if (!result.valid) {
            clearAuthStorage();
        }

        return result;
    } catch (error: any) {
        return {
            valid: false,
            message: error.message || 'Token 验证失败'
        };
    }
};

/**
 * 获取当前用户信息（从后端）
 */
const getCurrentUser = async (token?: string) => {
    try {
        if (!await ensureApiAvailable()) {
            return {
                success: false,
                message: '认证 API 不可用'
            };
        }

        const tokenToUse = token || getToken();
        if (!tokenToUse) {
            return {
                success: false,
                message: 'Token 不存在'
            };
        }

        const result = await window['$mapi'].auth.getCurrentUser(tokenToUse);

        if (result.success) {
            // 更新本地缓存
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
            localStorage.setItem(AUTH_SUBSCRIPTION_KEY, JSON.stringify(result.subscription));
        }

        return result;
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '获取用户信息失败'
        };
    }
};

/**
 * 检查订阅状态
 */
const checkSubscriptionStatus = async (userId?: number) => {
    try {
        if (!await ensureApiAvailable()) {
            return {
                hasAccess: false,
                isExpired: true
            };
        }

        // 如果没有提供 userId，从本地用户信息获取
        const user = userId ? { id: userId } : getUser();
        if (!user || !user.id) {
            return {
                hasAccess: false,
                isExpired: true,
                message: '用户不存在'
            };
        }

        const result = await window['$mapi'].auth.checkSubscriptionStatus(user.id);

        if (result.subscription) {
            localStorage.setItem(AUTH_SUBSCRIPTION_KEY, JSON.stringify(result.subscription));
        }

        return result;
    } catch (error: any) {
        return {
            hasAccess: false,
            isExpired: true,
            message: error.message || '检查订阅状态失败'
        };
    }
};

/**
 * 检查用户是否已登录
 */
const isAuthenticated = (): boolean => {
    return !!getToken() && !!getUser();
};

/**
 * 检查用户是否为管理员
 */
const isAdmin = (): boolean => {
    const user = getUser();
    return user?.role === 'admin';
};

/**
 * 检查是否可以访问应用（已登录 + 订阅未过期）
 */
const canAccess = async (): Promise<boolean> => {
    const token = getToken();
    if (!token) {
        return false;
    }

    const verifyResult = await verifyToken(token);
    if (!verifyResult.valid) {
        return false;
    }

    const result = await getCurrentUser(token);
    if (!result.success || !result.subscription) {
        return false;
    }

    const expiresAt = new Date(result.subscription.expires_at);
    const now = new Date();
    return now <= expiresAt;
};

/**
 * 获取剩余天数
 */
const getRemainingDays = (): number => {
    const subscription = getSubscription();
    if (!subscription) {
        return 0;
    }

    const expiresAt = new Date(subscription.expires_at);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
};

export default {
    register,
    login,
    logout,
    getToken,
    getUser,
    getSubscription,
    verifyToken,
    getCurrentUser,
    checkSubscriptionStatus,
    isAuthenticated,
    isAdmin,
    canAccess,
    getRemainingDays
};
