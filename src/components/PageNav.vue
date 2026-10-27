<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../store/modules/auth";

const router = useRouter();
const auth = useAuthStore();

const accountPanelOpen = ref(false);
const accountPanelRef = ref<HTMLElement | null>(null);
const accountTriggerRef = ref<HTMLElement | null>(null);

const activeTab = computed(() => {
    const path = router.currentRoute.value.path;
    const query = router.currentRoute.value.query;

    if (path === "/" || path === "/home") return "home";
    if (path === "/server") return "server";
    if (path === "/setting") return "setting";
    if (path === "/sound") return "sound";
    if (path === "/video") {
        const tab = query.tab as string;
        if (tab === "ipAgent") return "ipAgent";
        if (tab === "videoGen") return "videoGen";
        if (tab === "videoTemplate") return "videoTemplate";
        if (tab === "videoMaterial") return "videoMaterial";
        if (tab === "videoAudioExtract") return "videoAudioExtract";
        return "ipAgent";
    }
    if (path === "/design") return "design";
    if (path === "/tool") return "tool";
    return "";
});

const isLoggedIn = computed(() => !!(auth.token && auth.user));

const maskedPhone = computed(() => {
    const phone = auth.phone || "";
    if (phone.length >= 7) {
        return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
    }
    return phone || auth.subscriptionTypeDisplay || "未订阅";
});

const statusText = computed(() => {
    if (auth.subscription?.subscription_type === "pro") return "专业版已启用";
    if (auth.subscription?.subscription_type === "trial") return "试用中";
    return "就绪";
});

const usedDaysText = computed(() => `${auth.usedDays || 0} 天`);

const navigateTo = async (path: string) => {
    accountPanelOpen.value = false;
    await router.push(path);
};

const toggleAccountPanel = () => {
    accountPanelOpen.value = !accountPanelOpen.value;
};

const doLogout = async () => {
    try {
        const result = await auth.logout();
        if (result.success) {
            accountPanelOpen.value = false;
            await router.push("/login");
        }
    } catch (error) {
        console.error("退出登录失败", error);
    }
};

const handleGlobalPointerDown = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (accountPanelRef.value?.contains(target)) return;
    if (accountTriggerRef.value?.contains(target)) return;
    accountPanelOpen.value = false;
};

const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && accountPanelOpen.value) {
        accountPanelOpen.value = false;
        accountTriggerRef.value?.focus();
    }
};

onMounted(() => {
    document.addEventListener("mousedown", handleGlobalPointerDown);
    document.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(() => {
    document.removeEventListener("mousedown", handleGlobalPointerDown);
    document.removeEventListener("keydown", handleEscape);
});

const mainMenuItems = [
    { key: "home", label: "创作概览", path: "/home", iconPath: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
    { key: "ipAgent", label: "创作工作台", path: "/video?tab=ipAgent", iconPath: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { key: "videoTemplate", label: "数字人形象", path: "/video?tab=videoTemplate", iconPath: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { key: "videoMaterial", label: "素材资源", path: "/video?tab=videoMaterial", iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { key: "sound", label: "声音工作室", path: "/sound", iconPath: "M11 5L6 9H2v6h4l5 4V5z M19.07 4.93a10 10 0 010 14.14 M15.54 8.46a5 5 0 010 7.07" },
    { key: "videoGen", label: "视频合成", path: "/video?tab=videoGen", iconPath: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" },
    { key: "videoAudioExtract", label: "音频提取", path: "/video?tab=videoAudioExtract", iconPath: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
    { key: "server", label: "模型服务", path: "/server", iconPath: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" },
];

const accountMenuItems = [
    { key: "help", label: "帮助中心", path: "/setting", iconPath: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { key: "setting", label: "偏好设置", path: "/setting", iconPath: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];
</script>

<template>
    <div class="sidebar-navigation">
    <nav class="page-nav" aria-label="创作导航">
        <div class="nav-section-label">创作</div><div class="nav-group">
            <a
                v-for="item in mainMenuItems"
                :key="item.key"
                class="nav-item" :title="item.label" :aria-label="item.label"
                :class="{ active: activeTab === item.key }"
                @click="navigateTo(item.path)"
                :href="'#' + item.path" :aria-current="activeTab === item.key ? 'page' : undefined" @keydown.enter.prevent="navigateTo(item.path)" @click.prevent
            >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path :d="item.iconPath" />
                </svg>
                <span class="nav-text">{{ item.label }}</span>
            </a>
        </div>

        <div class="nav-section-label nav-extra-label">更多工具</div><div class="nav-group nav-extra"><button type="button" class="nav-item tool-pending" disabled title="封面设计 · 开发中"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4zM4 9h16M9 9v11"/></svg><span class="nav-text">封面设计</span><span class="development-badge">开发中</span></button><button type="button" class="nav-item tool-pending" disabled title="图像创作 · 开发中"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4zM4 16l5-5 5 5 3-3 3 3M15 8h.01"/></svg><span class="nav-text">图像创作</span><span class="development-badge">开发中</span></button><button type="button" class="nav-item tool-pending" disabled title="实用工具 · 开发中"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg><span class="nav-text">实用工具</span><span class="development-badge">开发中</span></button><button type="button" class="nav-item tool-pending" disabled title="互动直播 · 开发中"><svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12v12H4zM16 10l5-3v10l-5-3"/></svg><span class="nav-text">互动直播</span><span class="development-badge">开发中</span></button></div></nav><div class="account-anchor">
            <transition name="account-panel-fade">
                <div
                    v-if="accountPanelOpen"
                    ref="accountPanelRef"
                    class="account-panel" role="region" aria-label="账户与订阅"
                >
                    <div class="account-card">
                        <div class="account-card-main">
                            <div class="account-avatar-large">
                                <svg class="account-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span class="account-avatar-dot"></span>
                            </div>
                            <div class="account-card-text">
                                <div class="account-name-row">
                                    <span class="account-name" :title="auth.username || '未登录'">{{ auth.username || "未登录" }}</span>
                                    <span v-if="auth.subscription?.subscription_type === 'pro'" class="account-badge account-badge-pro">VIP</span>
                                    <span v-else-if="auth.subscription?.subscription_type === 'trial'" class="account-badge account-badge-trial">试用</span>
                                </div>
                                <div class="account-meta-row">
                                    <span class="account-meta-text">{{ maskedPhone }}</span>
                                    <span class="account-meta-separator">·</span>
                                    <span class="account-meta-running">
                                        <svg class="account-meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        已运行 {{ usedDaysText }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="account-status-row">
                            <span class="account-status-dot"></span>
                            <span class="account-status-text">{{ statusText }}</span>
                        </div>
                    </div>

                    <div class="account-menu">
                        <button
                            v-for="item in accountMenuItems.filter(item => item.key !== 'help')"
                            :key="item.key"
                            class="account-menu-item"
                            type="button"
                            @click="navigateTo(item.path)"
                        >
                            <span class="account-menu-item-left">
                                <svg class="account-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                    <path :d="item.iconPath" />
                                </svg>
                                <span>{{ item.label }}</span>
                            </span>
                            <svg class="account-menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 6l6 6-6 6" />
                            </svg>
                        </button>
                        <button
                            v-if="isLoggedIn"
                            class="account-menu-item account-menu-item-exit"
                            type="button"
                            @click="doLogout"
                        >
                            <span class="account-menu-item-left">
                                <svg class="account-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>退出登录</span>
                            </span>
                        </button>
                    </div>
                </div>
            </transition>

            <button
                ref="accountTriggerRef"
                class="account-trigger"
                :class="{ active: accountPanelOpen }" :aria-expanded="accountPanelOpen" aria-label="账户菜单"
                type="button"
                @click="toggleAccountPanel"
            >
                <div class="account-trigger-avatar">
                    <svg class="account-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span class="account-trigger-dot"></span>
                </div><span class="trigger-info"><strong>{{ auth.username || "我的账户" }}</strong><small>{{ auth.subscriptionTypeDisplay || "账户与订阅" }}</small></span><span class="trigger-more">···</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.sidebar-navigation{display:flex;flex-direction:column;flex:1;min-height:0;padding:0 12px 16px;gap:7px;overflow:hidden}.page-nav{display:flex;flex-direction:column;flex:1;min-height:0;padding:0;gap:7px;overflow:auto}.page-nav>.nav-group,.page-nav>.nav-section-label{flex-shrink:0}.nav-section-label{font-size:12px;font-weight:600;color:var(--theme-text-muted);padding:3px 12px 7px}.nav-group{display:flex;flex-direction:column;gap:3px}.nav-item{display:flex;gap:12px;align-items:center;min-height:40px;padding:8px 12px;border-radius:8px;color:var(--theme-text-secondary);font-size:14px;text-decoration:none;border:1px solid transparent;flex-shrink:0}.nav-item:hover{background:var(--theme-panel-bg-muted);color:var(--theme-text-primary)}.nav-item.active,.nav-item.router-link-exact-active{background:var(--theme-brand-soft);color:var(--theme-brand);border-color:var(--studio-accent-border);font-weight:600}.nav-icon{width:19px;height:19px;flex-shrink:0}.nav-text{white-space:nowrap}.nav-extra-label{padding-top:18px}.extra-icon{font-size:21px;width:19px;line-height:1;display:grid;place-items:center}.sidebar-utilities{margin-top:auto;padding-top:18px}.sidebar-utilities button{display:flex;align-items:center;gap:12px;width:100%;min-height:40px;border:0;border-radius:8px;padding:8px 12px;background:transparent;color:var(--theme-text-secondary);font-size:14px}.sidebar-utilities button:hover{background:var(--theme-panel-bg-muted)}.sidebar-utilities button>span:first-child{width:19px;font-size:21px}.account-anchor{flex-shrink:0;margin-top:auto;border-top:1px solid var(--theme-border);padding-top:12px;position:relative}.account-trigger{width:100%;min-height:48px;display:flex;align-items:center;gap:10px;padding:6px;border:0;border-radius:9px;background:transparent;color:var(--theme-text-primary);text-align:left}.account-trigger:hover,.account-trigger.active{background:var(--theme-panel-bg-muted)}.account-trigger-avatar,.account-avatar-large{width:34px;height:34px;border-radius:50%;background:var(--theme-brand-soft);color:var(--theme-brand);display:grid;place-items:center;flex-shrink:0}.account-trigger-icon,.account-avatar-icon{width:19px;height:19px}.trigger-info{min-width:0;display:flex;flex-direction:column;gap:2px}.trigger-info strong{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}.trigger-info small{font-size:12px;color:var(--theme-text-muted)}.trigger-more{margin-left:auto;font-size:20px}.account-panel{position:fixed;left:20px;bottom:78px;width:300px;max-width:calc(100vw - 40px);max-height:calc(100dvh - 120px);overflow:auto;background:var(--studio-surface);border:1px solid var(--theme-border);border-radius:14px;padding:8px;box-shadow:var(--theme-shadow-card);z-index:90}.account-card{padding:14px}.account-card-main{display:flex;align-items:center;gap:10px}.account-card-text{min-width:0}.account-name-row,.account-meta-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.account-name{font-size:15px;font-weight:600}.account-meta-row{font-size:12px;color:var(--theme-text-muted);margin-top:5px}.account-meta-running{display:flex;align-items:center;gap:4px}.account-meta-icon{width:14px;height:14px}.account-status-row{font-size:12px;color:var(--theme-text-secondary);margin-top:12px}.account-badge{font-size:12px;color:var(--theme-brand);background:var(--theme-brand-soft);padding:2px 6px;border-radius:4px}.account-menu{padding-top:6px;border-top:1px solid var(--theme-border)}.account-menu-item{width:100%;min-height:42px;display:flex;justify-content:space-between;align-items:center;padding:10px;border:0;border-radius:8px;color:var(--theme-text-secondary);background:transparent;font-size:14px}.account-menu-item:hover{background:var(--theme-panel-bg-muted)}.account-menu-item-left{display:flex;gap:10px;align-items:center}.account-menu-icon{width:18px;height:18px}.account-menu-arrow{width:14px;height:14px}.account-menu-item-exit{color:var(--danger)}.account-panel-fade-enter-active,.account-panel-fade-leave-active{transition:opacity .15s}.account-panel-fade-enter-from,.account-panel-fade-leave-to{opacity:0}
@media(max-width:1100px){.sidebar-navigation{padding:0 8px 12px}.nav-section-label{font-size:12px;text-align:center;padding:4px 0 8px}.nav-item{justify-content:center;padding:10px 0;min-height:44px}.nav-text,.sidebar-utilities button>span:last-child,.trigger-info,.trigger-more{display:none}.sidebar-utilities button,.account-trigger{justify-content:center}.account-panel{left:12px}.nav-extra-label{padding-top:14px}}
</style>

<style scoped>.tool-pending{width:100%;text-align:left;border:0;background:transparent;color:var(--theme-text-muted);cursor:default;opacity:.78}.development-badge{margin-left:auto;flex-shrink:0;font-size:10px;line-height:18px;padding:0 5px;border:1px solid var(--theme-border);border-radius:5px;color:var(--theme-text-muted)}.tool-pending .nav-text{flex:1}</style>
