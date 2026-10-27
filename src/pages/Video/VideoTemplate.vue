<script setup lang="ts">
import {onMounted, onActivated, ref, computed} from "vue";
import InputInlineEditor from "../../components/common/InputInlineEditor.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {VideoTemplateRecord, VideoTemplateService} from "../../service/VideoTemplateService";
import VideoTemplateEditDialog from "./components/VideoTemplateEditDialog.vue";
import VideoTemplateCloudDialog from "./components/VideoTemplateCloudDialog.vue";

const editDialog = ref<InstanceType<typeof VideoTemplateEditDialog>>();
const cloudDialog = ref<InstanceType<typeof VideoTemplateCloudDialog>>();
const records = ref<VideoTemplateRecord[]>([]);
const loading = ref(true);
const selectedId = ref<number | null>(null);

// 当前选中的形象
const selectedTemplate = computed(() => {
    return records.value.find(r => r.id === selectedId.value);
});

// 选中形象
const selectTemplate = (id: number) => {
    selectedId.value = selectedId.value === id ? null : id;
};

// 获取视频时长显示
const getDuration = (info: any) => {
    if (!info?.duration) return "--:--";
    const seconds = Math.floor(info.duration);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 获取分辨率显示
const getResolution = (info: any) => {
    if (!info?.width || !info?.height) return "--";
    return `${info.width}x${info.height}`;
};

// 获取文件大小显示
const getFileSize = (info: any) => {
    if (!info?.size) return "--";
    const sizeMB = (info.size / 1024 / 1024).toFixed(1);
    return `${sizeMB} MB`;
};

const doRefresh = async () => {
    loading.value = true;
    records.value = await VideoTemplateService.list();
    // 如果有选中项且记录中不再存在，清除选中
    if (selectedId.value && !records.value.find(r => r.id === selectedId.value)) {
        selectedId.value = null;
    }
    loading.value = false;
};

onActivated(doRefresh);

const doDelete = async (record: VideoTemplateRecord) => {
    await Dialog.confirm(t("确认删除该形象？删除后可在云端重新下载"));
    await VideoTemplateService.delete(record);
    await doRefresh();
    window.dispatchEvent(new CustomEvent('video-template-updated'));
};

const onChangeTitle = async (record: VideoTemplateRecord, value: string) => {
    await VideoTemplateService.update(record.id!, {name: value});
    await doRefresh();
    window.dispatchEvent(new CustomEvent('video-template-updated'));
};

const onUpdate = async () => {
    await doRefresh();
    window.dispatchEvent(new CustomEvent('video-template-updated'));
};
</script>

<template>
    <div class="template-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">数字人形象</h1>
                    <p class="page-desc">选择或创建专属的数字人形象用于视频合成</p>
                </div>
            </div>
            <div class="header-actions"><a-button @click="doRefresh" :loading="loading">刷新</a-button>
                <a-button @click="cloudDialog?.show()" class="action-btn">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="btn-icon">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    云端形象库
                </a-button>
                <a-button type="primary" @click="editDialog?.add()" class="action-btn primary">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    添加形象
                </a-button>
            </div>
        </div>

        <!-- 统计信息 -->
        <div class="stats-bar" v-if="records.length">
            <div class="stat-item">
                <span class="stat-value">{{ records.length }}</span>
                <span class="stat-label">个形象</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item tip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="tip-icon">
                    <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>建议使用正脸自拍视频，时长10-30秒效果最佳</span>
            </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!records.length" class="empty-state">
            <div class="empty-visual">
                <div class="empty-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="empty-rings">
                    <div class="ring ring-1"></div>
                    <div class="ring ring-2"></div>
                    <div class="ring ring-3"></div>
                </div>
            </div>
            <div class="empty-title">暂无数字人形象</div>
            <div class="empty-desc">从云端下载预设形象或上传自己的形象视频</div>
            <div class="empty-actions">
                <a-button @click="cloudDialog?.show()">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="btn-icon-sm">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    浏览云端形象库
                </a-button>
                <a-button type="primary" @click="editDialog?.add()">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon-sm">
                            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    上传形象视频
                </a-button>
            </div>
        </div>

        <!-- 形象列表 -->
        <div v-else class="template-content">
            <!-- 左侧：形象网格 -->
            <div class="template-grid-container">
                <div class="template-grid">
                    <div 
                        v-for="r in records" 
                        :key="r.id" 
                        class="template-card"
                        :class="{ selected: selectedId === r.id }"
                        role="button" tabindex="0" :aria-pressed="selectedId === r.id" :aria-label="r.name" @keydown.enter.prevent="selectTemplate(r.id!)" @keydown.space.prevent="selectTemplate(r.id!)" @click="selectTemplate(r.id!)"
                    >
                        <div class="card-preview">
                            <VideoPlayer :url="'file://' + r.video" :autoplay="false"/>
                            <div class="card-overlay">
                                <div class="overlay-actions">
                                    <button class="overlay-btn" @click.stop="editDialog?.edit(r)" :title="t('编辑')" :aria-label="t('编辑')+r.name">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                    <button class="overlay-btn danger" @click.stop="doDelete(r)" :title="t('删除')" :aria-label="t('删除')+r.name">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="card-selected-badge" v-if="selectedId === r.id">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="card-info">
                            <div class="card-name">
                                <InputInlineEditor :value="r.name" @change="onChangeTitle(r, $event)">
                                    <span class="name-text">{{ r.name }}</span>
                                </InputInlineEditor>
                            </div>
                            <div class="card-meta">
                                <span class="meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    {{ getDuration(r.info) }}
                                </span>
                                <span class="meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    {{ getResolution(r.info) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：选中详情面板 -->
            <div class="detail-panel" v-if="selectedTemplate">
                <div class="panel-header">
                    <h3>形象详情</h3>
                </div>
                <div class="panel-preview">
                    <VideoPlayer :url="'file://' + selectedTemplate.video" :autoplay="true"/>
                </div>
                <div class="panel-info">
                    <div class="info-item">
                        <span class="info-label">名称</span>
                        <span class="info-value">{{ selectedTemplate.name }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">时长</span>
                        <span class="info-value">{{ getDuration(selectedTemplate.info) }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">分辨率</span>
                        <span class="info-value">{{ getResolution(selectedTemplate.info) }}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">文件大小</span>
                        <span class="info-value">{{ getFileSize(selectedTemplate.info) }}</span>
                    </div>
                </div>
                <div class="panel-actions">
                    <a-button type="primary" long @click="$router.push({ path: '/video', query: { tab: 'videoGen', template: selectedTemplate?.id } })">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="btn-icon-sm">
                                <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        使用此形象
                    </a-button>
                </div>
            </div>
        </div>
    </div>

    <VideoTemplateEditDialog @update="onUpdate" ref="editDialog"/>
    <VideoTemplateCloudDialog @update="onUpdate" ref="cloudDialog"/>
</template>

<style lang="less" scoped>
.template-page {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: transparent;
}

/* 页面头部 */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 28px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 14px;
    margin-bottom: 20px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.page-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 26px;
        height: 26px;
        color: #fff;
    }
}

.page-title {
    font-size: 20px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
}

.page-desc {
    font-size: 12px;
    color: #64748b;
    margin: 4px 0 0;
}

.header-actions {
    display: flex;
    gap: 10px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-weight: 500;
    
    &.primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        border: none;
        
        &:hover {
            background: linear-gradient(135deg, #5558e3 0%, #7c4de0 100%);
        }
    }
}

.btn-icon {
    width: 16px;
    height: 16px;
}

.btn-icon-sm {
    width: 14px;
    height: 14px;
}

/* 统计栏 */
.stats-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: rgba(99, 102, 241, 0.08);
    border-radius: 10px;
    margin-bottom: 20px;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
    
    &.tip {
        margin-left: auto;
        color: #94a3b8;
        font-size: 12px;
    }
}

.stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #818cf8;
}

.stat-label {
    font-size: 12px;
    color: #94a3b8;
}

.stat-divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.1);
}

.tip-icon {
    width: 14px;
    height: 14px;
    margin-right: 4px;
}

/* 加载状态 */
.loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #64748b;
}

.loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(99, 102, 241, 0.15);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* 空状态 */
.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
}

.empty-visual {
    position: relative;
    width: 140px;
    height: 140px;
    margin-bottom: 28px;
}

.empty-avatar {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    background: rgba(99, 102, 241, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 32px;
        height: 32px;
        color: #6366f1;
    }
}

.empty-rings {
    position: absolute;
    inset: 0;
    
    .ring {
        position: absolute;
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 50%;
        animation: pulse-ring 3s ease-out infinite;
    }
    
    .ring-1 {
        inset: 0;
        animation-delay: 0s;
    }
    
    .ring-2 {
        inset: 15px;
        animation-delay: 0.5s;
    }
    
    .ring-3 {
        inset: 30px;
        animation-delay: 1s;
    }
}

@keyframes pulse-ring {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    100% {
        transform: scale(1.3);
        opacity: 0;
    }
}

.empty-title {
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 8px;
}

.empty-desc {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 28px;
}

.empty-actions {
    display: flex;
    gap: 12px;
}

/* 内容区域 */
.template-content {
    flex: 1;
    display: flex;
    gap: 20px;
    min-height: 0;
}

.template-grid-container {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
}

.template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    padding-right: 4px;
}

/* 形象卡片 */
.template-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s ease;
    
    &:hover {
        border-color: rgba(99, 102, 241, 0.3);
        transform: translateY(-2px);
        
        .card-overlay {
            opacity: 1;
        }
    }
    
    &.selected {
        border-color: #6366f1;
        box-shadow: 0 0 0 1px #6366f1, 0 4px 20px rgba(99, 102, 241, 0.2);
    }
}

.card-preview {
    position: relative;
    aspect-ratio: 16/9;
    background: #000;
    overflow: hidden;
}

.card-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.overlay-actions {
    display: flex;
    gap: 8px;
}

.overlay-btn {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    svg {
        width: 18px;
        height: 18px;
        color: #fff;
    }
    
    &:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    &.danger:hover {
        background: rgba(239, 68, 68, 0.5);
    }
}

.card-selected-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: #6366f1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 14px;
        height: 14px;
        color: #fff;
    }
}

.card-info {
    padding: 12px 14px;
}

.card-name {
    margin-bottom: 8px;
}

.name-text {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
}

.card-meta {
    display: flex;
    gap: 12px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
    
    svg {
        width: 12px;
        height: 12px;
    }
}

/* 详情面板 */
.detail-panel {
    width: 300px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 18px;
    display: flex;
    flex-direction: column;
}

.panel-header {
    margin-bottom: 14px;
    
    h3 {
        font-size: 14px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0;
    }
}

.panel-preview {
    aspect-ratio: 16/9;
    background: #000;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 16px;
}

.panel-info {
    flex: 1;
}

.info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    
    &:last-child {
        border-bottom: none;
    }
}

.info-label {
    font-size: 12px;
    color: #64748b;
}

.info-value {
    font-size: 12px;
    font-weight: 500;
    color: #e2e8f0;
}

.panel-actions {
    margin-top: 16px;
}
</style>
