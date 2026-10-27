
export default {
    /**
     * 启动扫码登录
     */
    startQRLogin: async (params: { platform: string }) => {
        return await ipcRenderer.invoke('platform:startQRLogin', params);
    },

    /**
     * 检查登录状态
     */
    checkLoginStatus: async (params: { sessionId: string }) => {
        return await ipcRenderer.invoke('platform:checkLoginStatus', params);
    },

    /**
     * 获取账号列表
     */
    getAccounts: async (params?: { platform?: string }) => {
        return await ipcRenderer.invoke('platform:getAccounts', params || {});
    },

    /**
     * 登出账号
     */
    logout: async (params: { accountId: number }) => {
        return await ipcRenderer.invoke('platform:logout', params);
    },

    /**
     * 刷新账号信息
     */
    refreshAccount: async (params: { accountId: number }) => {
        return await ipcRenderer.invoke('platform:refreshAccount', params);
    },

    /**
     * 清除平台数据（Cookie等）
     */
    clearBrowserData: async (params: { platform: string }) => {
        return await ipcRenderer.invoke('platform:clearBrowserData', params);
    }
};
