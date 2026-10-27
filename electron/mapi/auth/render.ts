/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import { ipcRenderer } from "electron";

/**
 * 认证 IPC 接口
 * 由渲染进程调用，通过 IPC 与主进程通信
 */

interface RegisterData {
    username: string;
    email: string;
    password: string;
    cdkey?: string;
}

interface LoginData {
    email: string;
    password: string;
}

/**
 * 用户注册
 */
const register = async (data: RegisterData) => {
    return await ipcRenderer.invoke("auth:register", data.username, data.email, data.password, data.cdkey);
};

/**
 * 用户登录
 */
const login = async (data: LoginData) => {
    return await ipcRenderer.invoke("auth:login", data.email, data.password);
};

/**
 * 验证 Token
 */
const verifyToken = async (token: string) => {
    return await ipcRenderer.invoke("auth:verifyToken", token);
};

/**
 * 获取当前用户信息
 */
const getCurrentUser = async (token: string) => {
    return await ipcRenderer.invoke("auth:getCurrentUser", token);
};

/**
 * 检查订阅状态
 */
const checkSubscriptionStatus = async (userId: number) => {
    return await ipcRenderer.invoke("auth:checkSubscriptionStatus", userId);
};

const clearSession = async () => ipcRenderer.invoke("auth:clearSession");

export default {
    clearSession,
    register,
    login,
    verifyToken,
    getCurrentUser,
    checkSubscriptionStatus
};
