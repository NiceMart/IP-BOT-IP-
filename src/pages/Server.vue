<script setup lang="ts">
import {ref, computed} from "vue";
import ServerActionDelete from "../components/Server/ServerActionDelete.vue";
import ServerActionInfo from "../components/Server/ServerActionInfo.vue";
import ServerActionLog from "../components/Server/ServerActionLog.vue";
import ServerActionSetting from "../components/Server/ServerActionSetting.vue";
import ServerActionStartStop from "../components/Server/ServerActionStartStop.vue";
import ServerAddDialog from "../components/Server/ServerAddDialog.vue";
import ServerStartTime from "../components/Server/ServerStartTime.vue";
import ServerStatus from "../components/Server/ServerStatus.vue";
import {AppConfig} from "../config";
import {functionToLabels} from "../lib/aigcpanel";
import ModelSettingDialog from "../module/Model/ModelSettingDialog.vue";
import {useServerStore} from "../store/modules/server";
import {EnumServerType} from "../types/Server";

const addDialog = ref<InstanceType<typeof ServerAddDialog> | null>(null);
const modelSettingDialog = ref<InstanceType<typeof ModelSettingDialog> | null>(null);
const serverStore = useServerStore();
const helpShow = ref(false);
const activeTab = ref('all');

const doHelp = () => {
    helpShow.value = !helpShow.value;
};

const doRefresh = async () => {
    await serverStore.refresh();
};

const typeName = (type: string) => {
    if (EnumServerType.LOCAL === type) {
        return "本地模型";
    } else if (EnumServerType.LOCAL_DIR === type) {
        return "本地模型";
    } else if (EnumServerType.CLOUD === type) {
        return "云端模型";
    }
};

// 获取状态颜色
const getStatusColor = (status: string) => {
    if (status === 'online') return '#22c55e';
    if (status === 'offline') return '#64748b';
    return '#f59e0b';
};

// 统计数据
const stats = computed(() => {
    const records = serverStore.records;
    return {
        total: records.length,
        online: records.filter(r => r.status === 'online').length,
        local: records.filter(r => r.type === EnumServerType.LOCAL || r.type === EnumServerType.LOCAL_DIR).length,
        cloud: records.filter(r => r.type === EnumServerType.CLOUD).length,
    };
});

// 过滤后的模型列表
const filteredRecords = computed(() => {
    if (activeTab.value === 'all') return serverStore.records;
    if (activeTab.value === 'local') return serverStore.records.filter(r => r.type === EnumServerType.LOCAL || r.type === EnumServerType.LOCAL_DIR);
    if (activeTab.value === 'cloud') return serverStore.records.filter(r => r.type === EnumServerType.CLOUD);
    if (activeTab.value === 'online') return serverStore.records.filter(r => r.status === 'online');
    return serverStore.records;
});
</script>

<template>
    <div class="server-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">模型管理</h1>
                    <p class="page-desc">管理本地和云端AI模型服务</p>
                </div>
            </div>
            <div class="header-right">
                <a-button @click="modelSettingDialog?.show()" class="header-btn">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    大模型设置
                </a-button>
                <a-button type="primary" @click="addDialog?.show()" class="header-btn primary">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    添加模型
                </a-button>
            </div>
        </div>

        <!-- 统计卡片 -->
        <div v-if="serverStore.records.length > 0" class="stats-row">
            <div class="stat-card">
                <div class="stat-icon total">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.total }}</span>
                    <span class="stat-label">全部模型</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon online">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.online }}</span>
                    <span class="stat-label">运行中</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon local">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.local }}</span>
                    <span class="stat-label">本地模型</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon cloud">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">{{ stats.cloud }}</span>
                    <span class="stat-label">云端模型</span>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!serverStore.records.length" class="empty-state">
            <div class="empty-visual">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                </div>
                <div class="orbit">
                    <div class="orbit-dot"></div>
                    <div class="orbit-ring"></div>
                </div>
            </div>
            <div class="empty-title">暂无模型</div>
            <div class="empty-desc">添加本地或云端AI模型，开启智能创作之旅</div>
            <div class="empty-actions">
                <a-button type="primary" size="large" @click="addDialog?.show()" class="add-btn">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    添加第一个模型
                </a-button>
            </div>
            <div class="help-card">
                <div class="help-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    快速入门
                </div>
                <div class="help-list">
                    <div class="help-item">
                        <span class="step">1</span>
                        <span>访问模型市场下载所需模型</span>
                    </div>
                    <div class="help-item">
                        <span class="step">2</span>
                        <span>解压并选择config.json配置文件</span>
                    </div>
                    <div class="help-item">
                        <span class="step">3</span>
                        <span>
                            查看
                            <button type="button" class="model-help-link" @click="doHelp">连接模型指南</button>
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 模型列表 -->
        <template v-else>
            <!-- 筛选标签 -->
            <div class="filter-tabs">
                <div
                    class="filter-tab"
                    :class="{ active: activeTab === 'all' }"
                    @click="activeTab = 'all'"
                >
                    <span>全部</span>
                    <span class="tab-count">{{ stats.total }}</span>
                </div>
                <div
                    class="filter-tab"
                    :class="{ active: activeTab === 'online' }"
                    @click="activeTab = 'online'"
                >
                    <span>运行中</span>
                    <span class="tab-count">{{ stats.online }}</span>
                </div>
                <div
                    class="filter-tab"
                    :class="{ active: activeTab === 'local' }"
                    @click="activeTab = 'local'"
                >
                    <span>本地</span>
                    <span class="tab-count">{{ stats.local }}</span>
                </div>
                <div
                    class="filter-tab"
                    :class="{ active: activeTab === 'cloud' }"
                    @click="activeTab = 'cloud'"
                >
                    <span>云端</span>
                    <span class="tab-count">{{ stats.cloud }}</span>
                </div>
            </div>

            <!-- 模型卡片列表 -->
            <div class="model-list">
                <div v-for="record in filteredRecords" :key="record.key" v-memo="[record.status, record.runtime]" class="model-card">
                    <div class="card-left">
                        <div class="model-avatar" :class="record.type === EnumServerType.CLOUD ? 'cloud' : 'local'">
                            <svg v-if="record.type !== EnumServerType.CLOUD" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="model-info">
                            <div class="model-name-row">
                                <span class="model-name">{{ record.title }}</span>
                                <span class="model-version">v{{ record.version }}</span>
                                <icon-thunderbolt v-if="record.config?.mode?.type==='watch'" class="speed-icon"/>
                            </div>
                            <div class="model-meta">
                                <span class="type-badge" :class="record.type === EnumServerType.CLOUD ? 'cloud' : 'local'">
                                    {{ typeName(record.type as string) }}
                                </span>
                                <div class="model-tags">
                                    <a-tag v-for="label in functionToLabels(record.functions)" :key="label" size="small">
                                        {{ label }}
                                    </a-tag>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-right">
                        <div class="status-section">
                            <ServerStatus
                                :status="record.status"
                                :auto-start="record.autoStart!"
                                :runtime="record.runtime"
                            />
                            <ServerStartTime :record="record"/>
                        </div>
                        <div class="action-buttons">
                            <ServerActionStartStop
                                v-if="!record.autoStart && record.type === EnumServerType.LOCAL_DIR"
                                :record="record"
                            />
                            <ServerActionLog :record="record"/>
                            <ServerActionDelete :record="record" @update="doRefresh"/>
                            <ServerActionInfo :record="record"/>
                            <ServerActionSetting
                                v-if="record.settings && Object.keys(record.settings).length > 0"
                                :record="record"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- 无筛选结果 -->
            <div v-if="filteredRecords.length === 0" class="no-result">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>没有找到符合条件的模型</p>
            </div>
        </template>
    </div>

    <ServerAddDialog ref="addDialog" @update="doRefresh"/>
    <ModelSettingDialog ref="modelSettingDialog"/>
<a-modal v-model:visible="helpShow" title="连接模型服务" :footer="false" :esc-to-close="true"><div class="model-help"><p>根据你要完成的任务，在这里添加本地或云端模型。</p><ol><li><strong>准备模型</strong><p>本地模型需要先完成运行环境部署；云端模型需要可用的服务地址和凭据。</p></li><li><strong>添加服务</strong><p>点击「添加模型」，选择提供方和配置文件，保存连接参数。</p></li><li><strong>开始创作</strong><p>回到创作工作台，在相应任务中选择可用模型。数字人和语音运行环境沿用你的原部署。</p></li></ol><a-button long type="primary" @click="helpShow=false">知道了</a-button></div></a-modal></template>

<style lang="less" scoped>
.server-page {
    padding: 24px 32px;
    min-height: 100%;
    background: transparent;
}

/* 页面头部 */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.page-icon {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
}

.page-icon svg {
    width: 28px;
    height: 28px;
    color: #fff;
}

.page-title {
    font-size: 22px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.5px;
}

.page-desc {
    font-size: 13px;
    color: #64748b;
    margin: 4px 0 0;
}

.header-right {
    display: flex;
    gap: 12px;
}

.header-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 10px;
    font-weight: 500;
    font-size: 14px;
}

.header-btn .anticon svg,
.header-btn svg {
    width: 16px;
    height: 16px;
}

.header-btn.primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%) !important;
    border: none !important;
    box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
}

.header-btn.primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.45);
}

/* 统计卡片 */
.stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    transition: all 0.25s ease;
}

.stat-card:hover {
    border-color: rgba(139, 92, 246, 0.2);
    background: rgba(139, 92, 246, 0.03);
}

.stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
        width: 22px;
        height: 22px;
    }

    &.total {
        background: rgba(139, 92, 246, 0.12);
        svg { color: #a78bfa; }
    }

    &.online {
        background: rgba(34, 197, 94, 0.12);
        svg { color: #22c55e; }
    }

    &.local {
        background: rgba(99, 102, 241, 0.12);
        svg { color: #6366f1; }
    }

    &.cloud {
        background: rgba(14, 165, 233, 0.12);
        svg { color: #0ea5e9; }
    }
}

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #f1f5f9;
    line-height: 1.2;
}

.stat-label {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px 20px;
    text-align: center;
}

.empty-visual {
    position: relative;
    width: 140px;
    height: 140px;
    margin-bottom: 28px;
}

.empty-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80px;
    height: 80px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;

    svg {
        width: 40px;
        height: 40px;
        color: #8b5cf6;
    }
}

.orbit {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.orbit-ring {
    position: absolute;
    width: 120px;
    height: 120px;
    border: 2px dashed rgba(139, 92, 246, 0.2);
    border-radius: 50%;
    animation: spin 20s linear infinite;
}

.orbit-dot {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #a78bfa;
    border-radius: 50%;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 0 10px #a78bfa;
    animation: orbit 3s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes orbit {
    0% { transform: translateX(-50%) rotate(0deg) translateY(-60px); }
    100% { transform: translateX(-50%) rotate(360deg) translateY(-60px); }
}

.empty-title {
    font-size: 20px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 8px;
}

.empty-desc {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 28px;
    max-width: 360px;
}

.empty-actions {
    margin-bottom: 32px;
}

.add-btn {
    height: 48px;
    padding: 0 28px;
    font-size: 15px;
    font-weight: 600;
    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%) !important;
    border: none !important;
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35);
}

.add-btn svg {
    width: 18px;
    height: 18px;
}

/* 帮助卡片 */
.help-card {
    width: 100%;
    max-width: 420px;
    padding: 22px 26px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    text-align: left;
}

.help-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 18px;

    svg {
        width: 18px;
        height: 18px;
        color: #8b5cf6;
    }
}

.help-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.help-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #94a3b8;

    .step {
        width: 24px;
        height: 24px;
        background: rgba(139, 92, 246, 0.12);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        color: #a78bfa;
        flex-shrink: 0;
    }

    a {
        color: #a78bfa;
        cursor: pointer;

        &:hover {
            text-decoration: underline;
        }
    }
}

/* 筛选标签 */
.filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    width: fit-content;
}

.filter-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.03);
    }

    &.active {
        background: rgba(139, 92, 246, 0.15);
        color: #a78bfa;
    }

    .tab-count {
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        font-size: 11px;
    }

    &.active .tab-count {
        background: rgba(139, 92, 246, 0.2);
    }
}

/* 模型列表 */
.model-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.model-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    transition: all 0.25s ease;

    &:hover {
        border-color: rgba(139, 92, 246, 0.3);
        background: rgba(139, 92, 246, 0.03);
    }
}

.card-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
}

.model-avatar {
    width: 50px;
    height: 50px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
        width: 24px;
        height: 24px;
        color: #fff;
    }

    &.local {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }

    &.cloud {
        background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
    }
}

.model-info {
    flex: 1;
    min-width: 0;
}

.model-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.model-name {
    font-size: 15px;
    font-weight: 600;
    color: #f1f5f9;
}

.model-version {
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 5px;
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
}

.speed-icon {
    color: #fbbf24;
    font-size: 16px;
}

.model-meta {
    display: flex;
    align-items: center;
    gap: 12px;
}

.type-badge {
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;

    &.local {
        background: rgba(99, 102, 241, 0.12);
        color: #818cf8;
    }

    &.cloud {
        background: rgba(14, 165, 233, 0.12);
        color: #38bdf8;
    }
}

.model-tags {
    display: flex;
    gap: 6px;

    :deep(.arco-tag) {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        margin: 0;
    }
}

.card-right {
    display: flex;
    align-items: center;
    gap: 24px;
}

.status-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 120px;
}

.action-buttons {
    display: flex;
    gap: 6px;
}

/* 无结果 */
.no-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 60px 20px;
    text-align: center;
    color: #64748b;

    svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    p {
        font-size: 14px;
    }
}
</style>
