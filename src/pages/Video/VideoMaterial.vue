<script setup lang="ts">
import {onMounted, onActivated, ref, computed} from "vue";
import InputInlineEditor from "../../components/common/InputInlineEditor.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {VideoMaterialRecord, VideoMaterialService} from "../../service/VideoMaterialService";

const records = ref<VideoMaterialRecord[]>([]);
const loading = ref(true);
const uploading = ref(false);
const filterType = ref<'all' | 'image' | 'video'>('all');
const searchKeyword = ref('');
const selectedIds = ref<Set<number>>(new Set());
const isSelectMode = ref(false);

// 筛选后的素材列表
const filteredRecords = computed(() => {
    let result = records.value;
    
    // 类型筛选
    if (filterType.value !== 'all') {
        result = result.filter(r => r.type === filterType.value);
    }
    
    // 关键词搜索
    if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        result = result.filter(r => r.name.toLowerCase().includes(keyword));
    }
    
    return result;
});

// 统计信息
const stats = computed(() => {
    const images = records.value.filter(r => r.type === 'image').length;
    const videos = records.value.filter(r => r.type === 'video').length;
    return { total: records.value.length, images, videos };
});

// 切换筛选类型
const setFilter = (type: 'all' | 'image' | 'video') => {
    filterType.value = type;
};

// 切换选择模式
const toggleSelectMode = () => {
    isSelectMode.value = !isSelectMode.value;
    if (!isSelectMode.value) {
        selectedIds.value.clear();
    }
};

// 切换选中
const toggleSelect = (id: number) => {
    if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
    } else {
        selectedIds.value.add(id);
    }
    selectedIds.value = new Set(selectedIds.value);
};

// 全选/取消全选
const toggleSelectAll = () => {
    if (selectedIds.value.size === filteredRecords.value.length) {
        selectedIds.value.clear();
    } else {
        selectedIds.value = new Set(filteredRecords.value.map(r => r.id!));
    }
};

// 批量删除
const doBatchDelete = async () => {
    if (selectedIds.value.size === 0) return;
    await Dialog.confirm(`确认删除选中的 ${selectedIds.value.size} 个素材？`);
    
    for (const id of selectedIds.value) {
        const record = records.value.find(r => r.id === id);
        if (record) {
            await VideoMaterialService.delete(record);
        }
    }
    
    selectedIds.value.clear();
    isSelectMode.value = false;
    await doRefresh();
    emitUpdated();
};

const emitUpdated = () => {
    window.dispatchEvent(new CustomEvent("video-material-updated"));
};

const doRefresh = async () => {
    loading.value = true;
    records.value = await VideoMaterialService.list();
    loading.value = false;
};

const doUpload = async () => {
    try {
        const result = await window.$mapi.file.openFile({
            title: t("选择素材文件"),
            filters: [
                { name: t("媒体文件"), extensions: ["mp4", "mov", "avi", "mkv", "jpg", "jpeg", "png", "gif", "bmp", "webp"] },
            ],
            properties: ["openFile", "multiSelections"],
        });

        if (!result) return;

        const filePaths = Array.isArray(result) ? result : [result];
        if (!filePaths.length) return;

        uploading.value = true;
        await VideoMaterialService.importFiles(filePaths);
        await doRefresh();
        emitUpdated();
        Dialog.tipSuccess(t("上传成功"));
    } finally {
        uploading.value = false;
    }
};

const doDelete = async (record: VideoMaterialRecord) => {
    await Dialog.confirm(t("确认删除该素材？删除后不可恢复"));
    await VideoMaterialService.delete(record);
    await doRefresh();
    emitUpdated();
};

const onChangeTitle = async (record: VideoMaterialRecord, value: string) => {
    await VideoMaterialService.update(record.id!, {name: value});
    await doRefresh();
    emitUpdated();
};

// 获取文件大小
const getFileSize = (path: string) => {
    // 这里可以调用系统接口获取文件大小，暂时返回 --
    return "--";
};

// 打开文件所在文件夹
const openInFolder = async (path: string) => {
    await window.$mapi.file.showInExplorer(path);
};

onActivated(doRefresh);
</script>

<template>
    <div class="material-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">素材库</h1>
                    <p class="page-desc">管理画中画和字幕逐行切换素材</p>
                </div>
            </div>
            <div class="header-actions">
                <template v-if="isSelectMode">
                    <a-button @click="toggleSelectAll" class="action-btn">
                        {{ selectedIds.size === filteredRecords.length ? '取消全选' : '全选' }}
                    </a-button>
                    <a-button status="danger" @click="doBatchDelete" :disabled="selectedIds.size === 0" class="action-btn">
                        删除选中 ({{ selectedIds.size }})
                    </a-button>
                    <a-button @click="toggleSelectMode" class="action-btn">
                        取消
                    </a-button>
                </template>
                <template v-else>
                    <a-button @click="doRefresh" class="action-btn">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="btn-icon">
                                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        刷新
                    </a-button>
                    <a-button @click="toggleSelectMode" class="action-btn">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="btn-icon">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        多选
                    </a-button>
                    <a-button type="primary" :loading="uploading" @click="doUpload" class="action-btn primary">
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                                <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        上传素材
                    </a-button>
                </template>
            </div>
        </div>

        <!-- 工具栏 -->
        <div class="toolbar" v-if="records.length">
            <!-- 统计信息 -->
            <div class="stats-group">
                <div class="stat-item">
                    <span class="stat-num">{{ stats.total }}</span>
                    <span class="stat-label">全部</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-num">{{ stats.images }}</span>
                    <span class="stat-label">图片</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-item">
                    <span class="stat-num">{{ stats.videos }}</span>
                    <span class="stat-label">视频</span>
                </div>
            </div>

            <!-- 筛选按钮 -->
            <div class="filter-group">
                <button 
                    class="filter-btn" 
                    :class="{ active: filterType === 'all' }"
                    @click="setFilter('all')"
                >
                    全部
                </button>
                <button 
                    class="filter-btn" 
                    :class="{ active: filterType === 'image' }"
                    @click="setFilter('image')"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="filter-icon">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    图片
                </button>
                <button 
                    class="filter-btn" 
                    :class="{ active: filterType === 'video' }"
                    @click="setFilter('video')"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="filter-icon">
                        <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    视频
                </button>
            </div>

            <!-- 搜索框 -->
            <div class="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="search-icon">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <input 
                    type="text" 
                    v-model="searchKeyword" 
                    placeholder="搜索素材..."
                    class="search-input"
                />
            </div>
        </div>

        <!-- 使用提示 -->
        <div class="usage-tip" v-if="records.length">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="tip-icon">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>素材会保存到本地，画中画字幕模式可直接逐行选择，不需要每次重新选文件</span>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!records.length" class="empty-state">
            <div class="empty-visual">
                <div class="empty-folder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="empty-particles">
                    <div class="particle p1"></div>
                    <div class="particle p2"></div>
                    <div class="particle p3"></div>
                    <div class="particle p4"></div>
                </div>
            </div>
            <div class="empty-title">素材库为空</div>
            <div class="empty-desc">上传视频或图片素材，支持画中画和字幕逐行切换</div>
            <div class="empty-actions">
                <a-button type="primary" size="large" :loading="uploading" @click="doUpload">
                    <template #icon>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon-lg">
                            <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </template>
                    立即上传
                </a-button>
            </div>
        </div>

        <!-- 空筛选结果 -->
        <div v-else-if="!filteredRecords.length" class="empty-state small">
            <div class="empty-icon-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="empty-title">未找到素材</div>
            <div class="empty-desc">尝试调整筛选条件或搜索关键词</div>
        </div>

        <!-- 素材网格 -->
        <div v-else class="material-grid">
            <div 
                v-for="record in filteredRecords" 
                :key="record.id" 
                class="material-card"
                :class="{ selected: selectedIds.has(record.id!) }"
            >
                <!-- 选择框 -->
                <div class="card-checkbox" v-if="isSelectMode" @click.stop="toggleSelect(record.id!)">
                    <svg v-if="selectedIds.has(record.id!)" viewBox="0 0 24 24" fill="currentColor" class="check-icon checked">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <div v-else class="check-box"></div>
                </div>

                <!-- 预览区域 -->
                <div class="card-preview" @click="isSelectMode ? toggleSelect(record.id!) : null">
                    <img
                        v-if="record.type === 'image'"
                        :src="'file://' + record.path"
                        :alt="record.name"
                    />
                    <VideoPlayer
                        v-else
                        :url="'file://' + record.path"
                        :show-open-folder="false"
                        :controls="true"
                        :autoplay="false"
                    />
                    
                    <!-- 类型标签 -->
                    <div class="type-badge" :class="record.type">
                        <svg v-if="record.type === 'image'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>

                <!-- 卡片内容 -->
                <div class="card-content">
                    <div class="card-name">
                        <InputInlineEditor :value="record.name" @change="onChangeTitle(record, $event)">
                            <span class="name-text">{{ record.name }}</span>
                        </InputInlineEditor>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div class="card-actions">
                        <button class="action-btn-sm" @click.stop="openInFolder(record.path)" title="在文件夹中显示">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="action-btn-sm danger" @click.stop="doDelete(record)" title="删除">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
.material-page {
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
    margin-bottom: 16px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.page-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%);
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
        background: linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%);
        border: none;
        
        &:hover {
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
        }
    }
}

.btn-icon {
    width: 16px;
    height: 16px;
}

.btn-icon-lg {
    width: 18px;
    height: 18px;
}

/* 工具栏 */
.toolbar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 14px 20px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    margin-bottom: 16px;
}

.stats-group {
    display: flex;
    align-items: center;
    gap: 12px;
}

.stat-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.stat-num {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
}

.stat-label {
    font-size: 11px;
    color: #64748b;
}

.stat-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
}

.filter-group {
    display: flex;
    gap: 6px;
}

.filter-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
    }
    
    &.active {
        background: rgba(6, 182, 212, 0.15);
        border-color: rgba(6, 182, 212, 0.3);
        color: #22d3ee;
    }
}

.filter-icon {
    width: 14px;
    height: 14px;
}

.search-box {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    width: 200px;
}

.search-icon {
    width: 16px;
    height: 16px;
    color: #64748b;
    flex-shrink: 0;
}

.search-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #e2e8f0;
    font-size: 12px;
    
    &::placeholder {
        color: #64748b;
    }
}

/* 使用提示 */
.usage-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(6, 182, 212, 0.08);
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #67e8f9;
}

.tip-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
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
    border: 3px solid rgba(6, 182, 212, 0.15);
    border-top-color: #06b6d4;
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
    
    &.small {
        padding: 40px 20px;
        
        .empty-icon-sm {
            width: 56px;
            height: 56px;
            margin-bottom: 16px;
            
            svg {
                width: 28px;
                height: 28px;
            }
        }
        
        .empty-title {
            font-size: 16px;
        }
    }
}

.empty-visual {
    position: relative;
    width: 120px;
    height: 120px;
    margin-bottom: 24px;
}

.empty-folder {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70px;
    height: 70px;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 36px;
        height: 36px;
        color: #06b6d4;
    }
}

.empty-particles {
    position: absolute;
    inset: 0;
    
    .particle {
        position: absolute;
        width: 8px;
        height: 8px;
        background: rgba(6, 182, 212, 0.3);
        border-radius: 50%;
        animation: float 3s ease-in-out infinite;
    }
    
    .p1 { top: 10%; left: 20%; animation-delay: 0s; }
    .p2 { top: 20%; right: 15%; animation-delay: 0.5s; }
    .p3 { bottom: 20%; left: 15%; animation-delay: 1s; }
    .p4 { bottom: 15%; right: 20%; animation-delay: 1.5s; }
}

@keyframes float {
    0%, 100% {
        transform: translateY(0) scale(1);
        opacity: 0.3;
    }
    50% {
        transform: translateY(-10px) scale(1.2);
        opacity: 0.6;
    }
}

.empty-icon-sm {
    width: 64px;
    height: 64px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 32px;
        height: 32px;
        color: #64748b;
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
    margin-bottom: 24px;
}

.empty-actions {
    display: flex;
    gap: 12px;
}

/* 素材网格 */
.material-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    overflow-y: auto;
    padding-right: 4px;
}

/* 素材卡片 */
.material-card {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.25s ease;
    
    &:hover {
        border-color: rgba(6, 182, 212, 0.3);
        transform: translateY(-2px);
        
        .card-actions {
            opacity: 1;
        }
    }
    
    &.selected {
        border-color: #06b6d4;
        box-shadow: 0 0 0 1px #06b6d4, 0 4px 20px rgba(6, 182, 212, 0.15);
    }
}

/* 复选框 */
.card-checkbox {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    cursor: pointer;
}

.check-box {
    width: 20px;
    height: 20px;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 4px;
    transition: all 0.2s ease;
    
    &:hover {
        border-color: #06b6d4;
    }
}

.check-icon {
    width: 20px;
    height: 20px;
    
    &.checked {
        color: #06b6d4;
    }
}

/* 预览区域 */
.card-preview {
    position: relative;
    aspect-ratio: 16/9;
    background: #0a0a0f;
    overflow: hidden;
    cursor: pointer;
    
    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
}

.type-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    svg {
        width: 14px;
        height: 14px;
    }
    
    &.image {
        background: rgba(99, 102, 241, 0.8);
        color: #fff;
    }
    
    &.video {
        background: rgba(34, 211, 238, 0.8);
        color: #fff;
    }
}

/* 卡片内容 */
.card-content {
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.card-name {
    flex: 1;
    min-width: 0;
}

.name-text {
    font-size: 12px;
    font-weight: 500;
    color: #e2e8f0;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.action-btn-sm {
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    svg {
        width: 14px;
        height: 14px;
        color: #94a3b8;
    }
    
    &:hover {
        background: rgba(255, 255, 255, 0.1);
        
        svg {
            color: #e2e8f0;
        }
    }
    
    &.danger:hover {
        background: rgba(239, 68, 68, 0.2);
        
        svg {
            color: #f87171;
        }
    }
}
</style>
