<template>
    <div class="extract-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">音频提取</h1>
                    <p class="page-desc">从视频文件中分离提取高质量音频轨道</p>
                </div>
            </div>
            <div class="header-stats">
                <div class="stat-item">
                    <span class="stat-value">4</span>
                    <span class="stat-label">支持格式</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">无损</span>
                    <span class="stat-label">输出质量</span>
                </div>
            </div>
        </div>

        <div class="extract-layout">
            <!-- 左侧：上传区域 -->
            <div class="upload-section">
                <div
                    class="upload-zone"
                    :class="{ 'has-file': videoFile, 'is-dragging': isDragging }"
                    @click="selectVideoFile"
                    @dragenter.prevent="onDragEnter"
                    @dragover.prevent="onDragOver"
                    @dragleave.prevent="onDragLeave"
                    @drop.prevent="onDrop"
                >
                    <div v-if="!videoFile" class="upload-content">
                        <div class="upload-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h3 class="upload-title">拖拽视频文件到此处</h3>
                        <p class="upload-hint">或点击选择文件</p>
                        <div class="format-tags">
                            <span class="format-tag">MP4</span>
                            <span class="format-tag">AVI</span>
                            <span class="format-tag">MOV</span>
                            <span class="format-tag">MKV</span>
                        </div>
                    </div>
                    <div v-else class="file-preview">
                        <div class="file-thumbnail">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="file-details">
                            <div class="file-name">{{ videoFileName }}</div>
                            <div class="file-meta">
                                <span class="meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    {{ formatFileSize(fileSize) }}
                                </span>
                                <span class="meta-item">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    {{ videoDuration || '获取中...' }}
                                </span>
                            </div>
                        </div>
                        <button class="file-remove" @click.stop="removeVideoFile">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- 输出设置 -->
                <div class="settings-card">
                    <div class="settings-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        输出设置
                    </div>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <span class="setting-label">格式</span>
                            <a-select v-model="extractSettings.format" class="setting-select">
                                <a-option value="mp3">MP3</a-option>
                                <a-option value="wav">WAV</a-option>
                                <a-option value="aac">AAC</a-option>
                                <a-option value="m4a">M4A</a-option>
                            </a-select>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">质量</span>
                            <a-select v-model="extractSettings.quality" class="setting-select">
                                <a-option value="320">高质量</a-option>
                                <a-option value="256">中等质量</a-option>
                                <a-option value="192">标准质量</a-option>
                                <a-option value="128">压缩质量</a-option>
                            </a-select>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">采样率</span>
                            <a-select v-model="extractSettings.sampleRate" class="setting-select">
                                <a-option value="44100">44.1 kHz</a-option>
                                <a-option value="48000">48 kHz</a-option>
                                <a-option value="22050">22.05 kHz</a-option>
                            </a-select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：处理/结果区域 -->
            <div class="process-section">
                <!-- 未选择文件状态 -->
                <div v-if="!videoFile" class="empty-state">
                    <div class="empty-illustration">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 6v6l4 2"/>
                        </svg>
                    </div>
                    <h3>选择视频开始提取</h3>
                    <p>上传视频文件后，将自动提取音频轨道</p>
                </div>

                <!-- 处理中状态 -->
                <div v-else-if="isExtracting" class="processing-card">
                    <div class="processing-visual">
                        <div class="waveform">
                            <div v-for="i in 20" :key="i" class="wave-bar" :style="{ animationDelay: (i * 0.1) + 's' }"></div>
                        </div>
                    </div>
                    <div class="processing-info">
                        <h3>正在提取音频</h3>
                        <p>{{ videoFileName }}</p>
                    </div>
                    <div class="progress-section">
                        <div class="progress-track">
                            <div class="progress-glow" :style="{ width: extractProgress + '%' }"></div>
                        </div>
                        <div class="progress-details">
                            <span class="progress-percent">{{ extractProgress }}%</span>
                            <span class="progress-status">处理中...</span>
                        </div>
                    </div>
                </div>

                <!-- 提取完成状态 -->
                <div v-else-if="outputFile" class="result-card">
                    <div class="result-header">
                        <div class="result-badge success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="result-title">
                            <h3>提取完成</h3>
                            <p>音频文件已保存到输出目录</p>
                        </div>
                    </div>
                    <div class="result-file-info">
                        <div class="audio-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="file-details">
                            <div class="file-name">{{ outputFileName }}</div>
                            <div class="file-meta">
                                <span class="format-badge">{{ extractSettings.format.toUpperCase() }}</span>
                                <span class="size-text">{{ formatFileSize(outputFileSize) }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="result-actions">
                        <a-button size="large" @click="previewAudio" class="action-btn preview">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </template>
                            预览音频
                        </a-button>
                        <a-button size="large" @click="openOutputFolder" class="action-btn folder">
                            <template #icon>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </template>
                            打开文件夹
                        </a-button>
                    </div>
                    <a-button type="link" @click="resetExtraction" class="reset-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        提取新文件
                    </a-button>
                </div>

                <!-- 准备就绪状态 -->
                <div v-else class="ready-card">
                    <div class="ready-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3>准备就绪</h3>
                    <p>点击开始提取音频</p>
                    <a-button
                        type="primary"
                        size="large"
                        :loading="isExtracting"
                        @click="startExtraction"
                        class="start-btn"
                    >
                        <template #icon>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 3l14 9-14 9V3z" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </template>
                        开始提取
                    </a-button>
                </div>

                <!-- 使用指南 -->
                <div class="guide-section">
                    <div class="guide-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        提取说明
                    </div>
                    <div class="guide-steps">
                        <div class="guide-step">
                            <span class="step-num">1</span>
                            <span>选择或拖拽视频文件到上传区域</span>
                        </div>
                        <div class="guide-step">
                            <span class="step-num">2</span>
                            <span>根据需要调整输出格式和质量参数</span>
                        </div>
                        <div class="guide-step">
                            <span class="step-num">3</span>
                            <span>点击开始提取，等待处理完成</span>
                        </div>
                        <div class="guide-step">
                            <span class="step-num">4</span>
                            <span>下载或直接使用提取的音频文件</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 音频预览对话框 -->
        <a-modal
            v-model:visible="showPreviewDialog"
            title="音频预览"
            width="520px"
            :footer="null"
            centered
        >
            <div class="preview-content">
                <div class="preview-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="preview-info">
                    <div class="preview-name">{{ outputFileName }}</div>
                    <div class="preview-format">{{ extractSettings.format.toUpperCase() }} · {{ formatFileSize(outputFileSize) }}</div>
                </div>
                <audio ref="audioPlayer" controls class="audio-player" :src="outputFile">
                    您的浏览器不支持音频播放
                </audio>
            </div>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import {ref, reactive, computed} from 'vue';
import {t} from '../../lang';
import {Message} from '@arco-design/web-vue';

const videoFile = ref('');
const outputFile = ref('');
const fileSize = ref(0);
const outputFileSize = ref(0);
const isExtracting = ref(false);
const extractProgress = ref(0);
const showPreviewDialog = ref(false);
const audioPlayer = ref(null);
const isDragging = ref(false);
const videoDuration = ref('');

const extractSettings = reactive({
    format: 'mp3',
    quality: '320',
    sampleRate: '44100'
});

const videoFileName = computed(() => {
    return videoFile.value ? videoFile.value.split(/[/\\]/).pop() || videoFile.value : '';
});

const outputFileName = computed(() => {
    return outputFile.value ? outputFile.value.split(/[/\\]/).pop() || outputFile.value : '';
});

const onDragEnter = () => {
    isDragging.value = true;
};

const onDragOver = () => {
    isDragging.value = true;
};

const onDragLeave = () => {
    isDragging.value = false;
};

const onDrop = async (e: DragEvent) => {
    isDragging.value = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
        const file = files[0];
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && videoExtensions.includes(ext)) {
            videoFile.value = (file as any).path || file.name;
            fileSize.value = file.size;
            Message.success(t('视频文件添加成功'));
        } else {
            Message.error(t('请上传有效的视频文件'));
        }
    }
};

const selectVideoFile = async () => {
    try {
        const result = await window.$mapi.file.openFile({
            title: t('选择视频文件'),
            filters: [
                { name: t('视频文件'), extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'] }
            ]
        });
        if (result) {
            videoFile.value = result;
            const stats = await window.$mapi.file.stat(result);
            fileSize.value = stats.size;
            Message.success(t('视频文件选择成功'));
        }
    } catch (error: any) {
        Message.error(t('选择文件失败：') + (error.message || error));
    }
};

const removeVideoFile = () => {
    videoFile.value = '';
    fileSize.value = 0;
    outputFile.value = '';
    outputFileSize.value = 0;
    extractProgress.value = 0;
};

const startExtraction = async () => {
    if (!videoFile.value) {
        Message.error(t('请先选择视频文件'));
        return;
    }
    isExtracting.value = true;
    extractProgress.value = 0;

    // 模拟进度
    const progressTimer = setInterval(() => {
        if (extractProgress.value < 90) {
            extractProgress.value += Math.random() * 15;
        }
    }, 500);

    try {
        const result = await window.$mapi.ipAgent.extractAudioFromVideoEnhanced({
            videoPath: videoFile.value.replace('file://', ''),
            format: extractSettings.format,
            quality: extractSettings.quality,
            sampleRate: extractSettings.sampleRate,
            outputPath: ''
        });

        clearInterval(progressTimer);

        if (result.success) {
            outputFile.value = result.audioPath;
            outputFileSize.value = result.fileSize || 0;
            extractProgress.value = 100;
            Message.success(t('音频提取完成'));
        } else {
            Message.error(result.message || t('提取失败'));
        }
    } catch (error: any) {
        clearInterval(progressTimer);
        Message.error(t('提取失败：') + (error.message || error));
    } finally {
        isExtracting.value = false;
    }
};

const openOutputFolder = async () => {
    try {
        if (outputFile.value) {
            await window.$mapi.shell.showItemInFolder(outputFile.value);
        } else {
            Message.warning(t('无法获取输出文件路径'));
        }
    } catch (error: any) {
        Message.error(t('打开文件夹失败：') + (error.message || error));
    }
};

const previewAudio = () => {
    showPreviewDialog.value = true;
};

const closePreviewDialog = () => {
    showPreviewDialog.value = false;
    if (audioPlayer.value) {
        (audioPlayer.value as HTMLAudioElement).pause();
    }
};

const resetExtraction = () => {
    removeVideoFile();
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style scoped>
.extract-page {
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
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.page-icon svg {
    width: 28px;
    height: 28px;
    color: #fff;
}

.header-text .page-title {
    font-size: 22px;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.5px;
}

.header-text .page-desc {
    font-size: 13px;
    color: #64748b;
    margin: 4px 0 0;
}

.header-stats {
    display: flex;
    gap: 24px;
}

.stat-item {
    text-align: center;
}

.stat-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    color: #34d399;
}

.stat-label {
    font-size: 11px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* 布局 */
.extract-layout {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 28px;
}

/* 上传区域 */
.upload-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.upload-zone {
    background: rgba(255, 255, 255, 0.02);
    border: 2px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 36px 24px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.upload-zone:hover {
    border-color: rgba(16, 185, 129, 0.5);
    background: rgba(16, 185, 129, 0.03);
}

.upload-zone.is-dragging {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.08);
    transform: scale(1.01);
}

.upload-zone.has-file {
    border-style: solid;
    border-color: rgba(16, 185, 129, 0.3);
    padding: 20px;
}

.upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.upload-icon-wrap {
    width: 72px;
    height: 72px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    transition: all 0.3s ease;
}

.upload-zone:hover .upload-icon-wrap {
    background: rgba(16, 185, 129, 0.2);
    transform: translateY(-4px);
}

.upload-icon-wrap svg {
    width: 36px;
    height: 36px;
    color: #34d399;
}

.upload-title {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0 0 6px;
}

.upload-hint {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 16px;
}

.format-tags {
    display: flex;
    gap: 8px;
}

.format-tag {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 11px;
    color: #94a3b8;
    font-weight: 500;
}

/* 文件预览 */
.file-preview {
    display: flex;
    align-items: center;
    gap: 14px;
}

.file-thumbnail {
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.file-thumbnail svg {
    width: 28px;
    height: 28px;
    color: #fff;
}

.file-details {
    flex: 1;
    min-width: 0;
}

.file-details .file-name {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 6px;
}

.file-meta {
    display: flex;
    gap: 16px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #64748b;
}

.meta-item svg {
    width: 14px;
    height: 14px;
}

.file-remove {
    width: 36px;
    height: 36px;
    background: rgba(239, 68, 68, 0.1);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f87171;
    transition: all 0.2s ease;
}

.file-remove:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: scale(1.05);
}

.file-remove svg {
    width: 18px;
    height: 18px;
}

/* 设置卡片 */
.settings-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    overflow: hidden;
}

.settings-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
}

.settings-header svg {
    width: 18px;
    height: 18px;
    color: #34d399;
}

.settings-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 18px;
}

.setting-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.setting-label {
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    padding-left: 4px;
}

.setting-select {
    width: 100%;
}

/* 处理区域 */
.process-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

/* 空状态 */
.empty-state {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 48px 24px;
    text-align: center;
}

.empty-illustration {
    width: 80px;
    height: 80px;
    background: rgba(16, 185, 129, 0.08);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
}

.empty-illustration svg {
    width: 40px;
    height: 40px;
    color: #34d399;
}

.empty-state h3 {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0 0 8px;
}

.empty-state p {
    font-size: 13px;
    color: #64748b;
    margin: 0;
}

/* 处理中卡片 */
.processing-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 16px;
    padding: 28px 24px;
}

.processing-visual {
    margin-bottom: 20px;
}

.waveform {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 48px;
}

.wave-bar {
    width: 4px;
    height: 8px;
    background: linear-gradient(to top, #10b981, #34d399);
    border-radius: 2px;
    animation: wave 1s ease-in-out infinite;
}

@keyframes wave {
    0%, 100% { height: 8px; }
    50% { height: 40px; }
}

.processing-info {
    text-align: center;
    margin-bottom: 24px;
}

.processing-info h3 {
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 6px;
}

.processing-info p {
    font-size: 12px;
    color: #64748b;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.progress-section {
    margin-bottom: 8px;
}

.progress-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
}

.progress-glow {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%);
    background-size: 200% 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
    animation: shimmer 1.5s linear infinite;
    position: relative;
}

.progress-glow::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 20px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4));
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.progress-details {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
}

.progress-percent {
    font-size: 14px;
    font-weight: 700;
    color: #34d399;
}

.progress-status {
    font-size: 12px;
    color: #64748b;
}

/* 结果卡片 */
.result-card {
    background: rgba(16, 185, 129, 0.05);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 16px;
    padding: 24px;
}

.result-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
}

.result-badge {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.result-badge.success {
    background: rgba(16, 185, 129, 0.15);
}

.result-badge svg {
    width: 26px;
    height: 26px;
    color: #10b981;
}

.result-title h3 {
    font-size: 16px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 4px;
}

.result-title p {
    font-size: 12px;
    color: #64748b;
    margin: 0;
}

.result-file-info {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    margin-bottom: 20px;
}

.audio-icon {
    width: 52px;
    height: 52px;
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.audio-icon svg {
    width: 26px;
    height: 26px;
    color: #fff;
}

.result-file-info .file-details {
    flex: 1;
}

.result-file-info .file-name {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 6px;
}

.file-meta {
    display: flex;
    align-items: center;
    gap: 10px;
}

.format-badge {
    padding: 3px 8px;
    background: rgba(16, 185, 129, 0.15);
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    color: #34d399;
}

.size-text {
    font-size: 12px;
    color: #64748b;
}

.result-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.action-btn {
    flex: 1;
    height: 44px;
    font-weight: 600;
}

.action-btn.preview {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
}

.action-btn.preview:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
}

.action-btn.folder {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
}

.action-btn.folder:hover {
    background: rgba(255, 255, 255, 0.1);
}

.action-btn svg {
    width: 18px;
    height: 18px;
}

.reset-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    color: #64748b;
    font-size: 13px;
}

.reset-link:hover {
    color: #34d399;
}

.reset-link svg {
    width: 16px;
    height: 16px;
}

/* 准备就绪 */
.ready-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 36px 24px;
    text-align: center;
}

.ready-icon {
    width: 72px;
    height: 72px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
}

.ready-icon svg {
    width: 36px;
    height: 36px;
    color: #34d399;
}

.ready-card h3 {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0 0 6px;
}

.ready-card p {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 24px;
}

.start-btn {
    height: 50px;
    padding: 0 32px;
    font-size: 15px;
    font-weight: 600;
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%) !important;
    border: none !important;
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
}

.start-btn .anticon svg {
    width: 18px;
    height: 18px;
}

/* 使用指南 */
.guide-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 20px;
}

.guide-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 16px;
}

.guide-header svg {
    width: 18px;
    height: 18px;
    color: #64748b;
}

.guide-steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.guide-step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #94a3b8;
}

.step-num {
    width: 24px;
    height: 24px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #34d399;
    flex-shrink: 0;
}

/* 预览弹窗 */
.preview-content {
    padding: 12px 0;
}

.preview-icon {
    width: 64px;
    height: 64px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
}

.preview-icon svg {
    width: 32px;
    height: 32px;
    color: #34d399;
}

.preview-info {
    text-align: center;
    margin-bottom: 20px;
}

.preview-name {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 4px;
}

.preview-format {
    font-size: 12px;
    color: #64748b;
}

.audio-player {
    width: 100%;
    height: 48px;
}
</style>
