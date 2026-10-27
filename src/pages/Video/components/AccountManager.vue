<script setup lang="ts">
import {ref, onMounted, computed} from "vue";

// 使用 import.meta.glob 批量导入平台图标，确保 Vite 构建时正确处理资源路径
const platformIconModules = import.meta.glob('../../../assets/image/outvideo/*.png', { eager: true, as: 'url' });
const platformIcons: Record<string, string> = {};
for (const path in platformIconModules) {
    const key = path.match(/(\w+)\.png$/)?.[1];
    if (key) platformIcons[key] = platformIconModules[path] as string;
}

interface AccountItem {
    id: number;
    platform: string;
    nickname: string;
    loginStatus: string;
    hasCookies: boolean;
    updatedAt: number;
}

const emit = defineEmits<{
    (e: 'change'): void;
}>();

const platforms = [
    {key: 'douyin', name: '抖音', enName: 'DOUYIN', color: '#000000', gradient: 'linear-gradient(135deg, #1a1a1a, #333)'},
    {key: 'kuaishou', name: '快手', enName: 'KUAISHOU', color: '#FF6900', gradient: 'linear-gradient(135deg, #FF6900, #ff8c3a)'},
    {key: 'shipin', name: '视频号', enName: 'CHANNEL', color: '#07C160', gradient: 'linear-gradient(135deg, #07C160, #10b981)'},
    {key: 'xiaohongshu', name: '小红书', enName: 'XIAOHONGSHU', color: '#FF2442', gradient: 'linear-gradient(135deg, #FF2442, #f43f5e)'},
];

const activePlatform = ref('douyin');
const accounts = ref<AccountItem[]>([]);
const loading = ref(false);
const operatingId = ref<number | null>(null);

// 当前平台的账号列表
const currentAccounts = computed(() => {
    return accounts.value.filter(a => a.platform === activePlatform.value);
});

// 当前平台信息
const currentPlatformInfo = computed(() => {
    return platforms.find(p => p.key === activePlatform.value) || platforms[0];
});

// 各平台账号数量
const platformCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of platforms) {
        counts[p.key] = accounts.value.filter(a => a.platform === p.key).length;
    }
    return counts;
});

// 加载账号列表
async function loadAccounts() {
    loading.value = true;
    try {
        const result = await window.$mapi.publish.listAccounts();
        if (result.success) {
            accounts.value = result.data;
        }
    } catch (e: any) {
        console.error('加载账号失败:', e);
    } finally {
        loading.value = false;
    }
}

// 添加账号
async function addAccount() {
    try {
        const result = await window.$mapi.publish.addAccount({
            platform: activePlatform.value,
        });
        if (result.success) {
            await loadAccounts();
            await setupLogin(result.data.id);
        }
    } catch (e: any) {
        console.error('添加账号失败:', e);
    }
}

// 设置登录（打开浏览器扫码）
async function setupLogin(accountId: number) {
    operatingId.value = accountId;
    try {
        const result = await window.$mapi.publish.login({
            platform: activePlatform.value,
            accountId,
        });
        if (result.success) {
            await loadAccounts();
            emit('change');
        } else {
            alert('登录失败: ' + (result.message || '未知错误'));
        }
    } catch (e: any) {
        console.error('登录失败:', e);
        alert('登录失败: ' + (e.message || '未知错误'));
    } finally {
        operatingId.value = null;
    }
}

// 测试登录状态
async function testLogin(accountId: number) {
    operatingId.value = accountId;
    try {
        const result = await window.$mapi.publish.checkLoginStatus({
            platform: activePlatform.value,
            accountId,
            checkBrowser: true,
        });
        if (result.success && result.isLoggedIn) {
            alert('✅ 登录状态有效');
        } else {
            alert('⚠️ 登录状态已失效，请重新登录');
        }
    } catch (e: any) {
        console.error('测试登录失败:', e);
    } finally {
        operatingId.value = null;
    }
}

// 删除账号
async function deleteAccount(accountId: number) {
    try {
        const account = accounts.value.find(a => a.id === accountId);
        const platform = account?.platform || activePlatform.value;
        const result = await window.$mapi.publish.deleteAccount({ accountId });
        if (result.success) {
            await loadAccounts();
            emit('change');
            setTimeout(async () => {
                try { await window.$mapi.publish.closeBrowser({ platform }); } catch (e) { /* 忽略 */ }
            }, 100);
        }
    } catch (e: any) {
        console.error('删除账号失败:', e);
    }
}

// 获取登录状态信息
function getStatusInfo(status: string, hasCookies: boolean) {
    if (status === 'active' && hasCookies) {
        return {text: '已登录', color: '#4ade80', bgColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.25)'};
    }
    if (status === 'expired') {
        return {text: '已过期', color: '#fbbf24', bgColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.25)'};
    }
    return {text: '未登录', color: '#6b7280', bgColor: 'rgba(107,114,128,0.12)', borderColor: 'rgba(107,114,128,0.2)'};
}

// 格式化时间
function formatTime(timestamp: number) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

onMounted(() => {
    loadAccounts();
});
</script>

<template>
    <div class="account-manager">
        <!-- 平台标签切换 -->
        <div class="platform-tabs">
            <div
                v-for="p in platforms" :key="p.key"
                class="platform-tab"
                :class="{active: activePlatform === p.key}"
                :style="activePlatform === p.key ? {borderColor: p.color + '60', background: p.gradient + '22' } : {}"
                @click="activePlatform = p.key"
            >
                <!-- Logo -->
                <div class="tab-logo-wrapper" :style="{background: p.gradient}">
                    <img :src="platformIcons[p.key]" class="tab-logo" :alt="p.name" />
                </div>
                <div class="tab-text-group">
                    <span class="tab-name">{{ p.name }}</span>
                    <span class="tab-en">{{ p.enName }}</span>
                </div>
                <!-- 账号数量角标 -->
                <div v-if="platformCounts[p.key] > 0" class="tab-count-badge" :style="{background: p.color}">
                    {{ platformCounts[p.key] }}
                </div>
            </div>
        </div>

        <!-- 分隔线 -->
        <div class="section-divider"></div>

        <!-- 账号列表 -->
        <div class="account-list-wrapper">
            <div v-if="loading" class="loading-state">
                <div class="loading-spinner"></div>
                <span class="loading-text">正在加载账号信息...</span>
            </div>

            <template v-else>
                <div class="account-cards-grid">
                    <div
                        v-for="account in currentAccounts"
                        :key="account.id"
                        class="account-card"
                    >
                        <!-- 卡片头部: 状态 + 昵称 -->
                        <div class="card-header">
                            <div class="card-status-badge"
                                 :style="{
                                     color: getStatusInfo(account.loginStatus, account.hasCookies).color,
                                     background: getStatusInfo(account.loginStatus, account.hasCookies).bgColor,
                                     borderColor: getStatusInfo(account.loginStatus, account.hasCookies).borderColor
                                 }">
                                <span class="status-dot" :style="{background: getStatusInfo(account.loginStatus, account.hasCookies).color}"></span>
                                {{ getStatusInfo(account.loginStatus, account.hasCookies).text }}
                            </div>
                            <div class="card-nickname">{{ account.nickname || '未命名账号' }}</div>
                            <div class="card-meta" v-if="account.updatedAt">
                                <svg class="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                {{ formatTime(account.updatedAt) }}
                            </div>
                        </div>

                        <!-- 卡片操作按钮 -->
                        <div class="card-actions">
                            <a-button
                                size="small"
                                class="card-btn card-btn-primary"
                                :style="activePlatform === 'douyin' ? {background: 'rgba(0,0,0,0.3)', borderColor: '#333', color: '#fff'} :
                                         activePlatform === 'kuaishou' ? {background: 'rgba(255,105,0,0.2)', borderColor: 'rgba(255,105,0,0.4)', color: '#FF6900'} :
                                         activePlatform === 'shipin' ? {background: 'rgba(7,193,96,0.2)', borderColor: 'rgba(7,193,96,0.4)', color: '#07C160'} :
                                         {background: 'rgba(255,36,66,0.2)', borderColor: 'rgba(255,36,66,0.4)', color: '#FF2442'}"
                                :loading="operatingId === account.id"
                                @click="setupLogin(account.id)"
                            >
                                <template #icon>
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
                                </template>
                                {{ account.hasCookies ? '重新登录' : '扫码登录' }}
                            </a-button>
                            <a-button
                                v-if="account.hasCookies"
                                size="small"
                                class="card-btn card-btn-outline"
                                :loading="operatingId === account.id"
                                @click="testLogin(account.id)"
                            >
                                <template #icon>
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                </template>
                                测试
                            </a-button>
                            <a-popconfirm
                                content="确定删除此账号？"
                                @ok="deleteAccount(account.id)"
                            >
                                <a-button size="small" status="danger" class="card-btn">
                                    <template #icon>
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </template>
                                    删除
                                </a-button>
                            </a-popconfirm>
                        </div>
                    </div>
                </div>

                <!-- 空状态 -->
                <div v-if="currentAccounts.length === 0" class="empty-state">
                    <div class="empty-icon-wrapper" :style="{background: currentPlatformInfo.gradient + '22', borderColor: currentPlatformInfo.color + '30'}">
                        <img :src="platformIcons[activePlatform]" class="empty-logo" :alt="currentPlatformInfo.name" />
                    </div>
                    <div class="empty-title">暂无{{ currentPlatformInfo.name }}账号</div>
                    <div class="empty-desc">点击下方按钮添加第一个{{ currentPlatformInfo.name }}账号</div>
                </div>
            </template>

            <!-- 添加账号按钮 -->
            <div class="add-account-btn" @click="addAccount">
                <div class="add-btn-icon" :style="{background: currentPlatformInfo.gradient}">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                </div>
                <span class="add-btn-text">添加{{ currentPlatformInfo.name }}账号</span>
                <span class="add-btn-sub">扫码授权登录</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.account-manager {
    padding: 0;
}

/* 平台标签 */
.platform-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 0;
    flex-wrap: wrap;
}

.platform-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 10px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    transition: all 0.25s ease;
    position: relative;
    flex: 1;
    min-width: 0;
}

.platform-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
}

.platform-tab.active {
    transform: translateY(-1px);
}

.tab-logo-wrapper {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
}

.tab-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
}

.tab-text-group {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.tab-name {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    line-height: 1.2;
    white-space: nowrap;
}

.tab-en {
    font-size: 9px;
    color: #64748b;
    letter-spacing: 0.5px;
    font-weight: 500;
}

.tab-count-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}

/* 分隔线 */
.section-divider {
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent);
    margin: 12px 0;
}

/* 账号列表 */
.account-list-wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 0;
}

.loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255,255,255,0.08);
    border-top-color: rgba(168,85,247,0.7);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    font-size: 13px;
    color: #64748b;
}

/* 账号卡片网格 */
.account-cards-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
}

.account-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
    gap: 12px;
}

.account-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
}

.card-header {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
}

.card-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    border: 1px solid;
    width: fit-content;
    letter-spacing: 0.3px;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.card-nickname {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
}

.card-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}

.card-btn {
    font-size: 12px !important;
    border-radius: 8px !important;
    padding: 0 10px !important;
    height: 28px !important;
}

.card-btn-outline {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(255,255,255,0.12) !important;
    color: #94a3b8 !important;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 32px 0 24px;
}

.empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.empty-logo {
    width: 36px;
    height: 36px;
    object-fit: contain;
}

.empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #94a3b8;
}

.empty-desc {
    font-size: 12px;
    color: #475569;
    text-align: center;
}

/* 添加账号按钮 */
.add-account-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1.5px dashed rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    cursor: pointer;
    color: #64748b;
    transition: all 0.2s ease;
    margin-top: 4px;
}

.add-account-btn:hover {
    border-color: rgba(168, 85, 247, 0.5);
    color: #a78bfa;
    background: rgba(168, 85, 247, 0.06);
}

.add-btn-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.add-btn-text {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    flex: 1;
}

.add-btn-sub {
    font-size: 11px;
    color: #475569;
    background: rgba(255,255,255,0.04);
    padding: 2px 8px;
    border-radius: 6px;
}
</style>
