
export default {
    /**
     * 创建发布任务
     */
    createTask: async (params: any) => {
        return await ipcRenderer.invoke('publish:createTask', params);
    },

    /**
     * 执行发布
     */
    execute: async (params: any) => {
        return await ipcRenderer.invoke('publish:execute', params);
    },

    /**
     * 获取发布进度
     */
    getProgress: async (params: { taskId: number }) => {
        return await ipcRenderer.invoke('publish:getProgress', params);
    },

    /**
     * 取消发布任务
     */
    cancel: async (params: { taskId: number }) => {
        return await ipcRenderer.invoke('publish:cancel', params);
    },

    /**
     * 查询发布历史
     */
    getHistory: async (params?: any) => {
        return await ipcRenderer.invoke('publish:getHistory', params || {});
    },

    /**
     * 平台登录
     */
    login: async (params: { platform: string; accountId?: number }) => {
        return await ipcRenderer.invoke('publish:login', params);
    },

    /**
     * 检查平台登录状态
     */
    checkLoginStatus: async (params: { platform: string; accountId?: number; checkBrowser?: boolean }) => {
        return await ipcRenderer.invoke('publish:checkLoginStatus', params);
    },

    /**
     * 关闭指定平台的浏览器
     * @param params.platform - 平台名称
     */
    closeBrowser: async (params: { platform: string }) => {
        return await ipcRenderer.invoke('publish:closeBrowser', params);
    },

    // ==================== 账号管理 ====================

    /**
     * 获取支持的平台列表
     */
    getSupportedPlatforms: async () => {
        return await ipcRenderer.invoke('account:getSupportedPlatforms');
    },

    /**
     * 获取账号列表
     * @param params.platform - 可选，按平台筛选
     */
    listAccounts: async (params?: { platform?: string }) => {
        return await ipcRenderer.invoke('account:list', params);
    },

    /**
     * 添加新账号
     */
    addAccount: async (params: { platform: string; nickname?: string }) => {
        return await ipcRenderer.invoke('account:add', params);
    },

    /**
     * 删除账号
     */
    deleteAccount: async (params: { accountId: number }) => {
        return await ipcRenderer.invoke('account:delete', params);
    },

    /**
     * 更新账号信息
     */
    updateAccount: async (params: { accountId: number; nickname?: string }) => {
        return await ipcRenderer.invoke('account:update', params);
    },

    /**
     * 获取单个账号详情
     */
    getAccount: async (params: { accountId: number }) => {
        return await ipcRenderer.invoke('account:get', params);
    },
};
