<template>
  <div class="sound-page">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <!-- Logo区域 -->
      <div class="sidebar-header">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="logo-text">
          <h1>声音管理</h1>
          <p>语音合成与识别</p>
        </div>
      </div>

      <!-- 模式切换 -->
      <div class="mode-switch">
        <button 
          class="mode-btn"
          :class="{ active: activeMode === 'synthesis' }" :aria-pressed="activeMode === 'synthesis'"
          @click="activeMode = 'synthesis'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>声音合成</span>
        </button>
        <button 
          class="mode-btn"
          :class="{ active: activeMode === 'asr' }" :aria-pressed="activeMode === 'asr'"
          @click="activeMode = 'asr'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>语音识别</span>
        </button>
      </div>

      <!-- 音色管理 -->
      <button class="voice-manage-btn" @click="soundPromptDialog?.show()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        音色管理
      </button>

      <!-- 表单区域 -->
      <div class="form-area">
        <SoundGenerateCreate 
          v-if="activeMode === 'synthesis'" 
          ref="synthesisCreateRef" 
          :simpleMode="true" 
          @submitted="onSynthesisSubmitted" 
        />
        <SoundAsrCreate 
          v-else 
          ref="asrCreateRef"
          :simpleMode="true"
          @submitted="onAsrSubmitted"
        />
      </div>
    </div>

    <!-- 右侧内容区 -->
    <div class="main-content">
      <!-- 顶部工具栏 -->
      <div class="content-header">
        <div class="tab-nav">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'history' }"
            @click="activeTab = 'history'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            历史任务
          </button>

        </div>
        <div class="header-actions">
          <button class="action-btn" aria-label="清空当前任务列表" @click="handleClearTasks" :title="t('清空当前列表')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="refresh-btn" aria-label="刷新任务列表" title="刷新任务列表" @click="handleRefresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-body">
        <!-- 合成列表 -->
        <SoundGenerateList 
          v-if="activeMode === 'synthesis'" 
          ref="synthesisListRef" 
          class="list-container"
        />
        <!-- 识别列表 -->
        <SoundAsrList 
          v-else 
          ref="asrListRef"
          class="list-container"
        />
      </div>
    </div>

    <SoundPromptDialog ref="soundPromptDialog" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../lang';
import SoundGenerateCreate from './components/SoundGenerateCreate.vue';
import SoundGenerateList from './components/SoundGenerateList.vue';
import SoundAsrCreate from './components/SoundAsrCreate.vue';
import SoundAsrList from './components/SoundAsrList.vue';
import SoundPromptDialog from './components/SoundPromptDialog.vue';
import { useTaskStore } from '../../store/modules/task';
import { Message } from '@arco-design/web-vue';
import { Dialog } from '../../lib/dialog';

const activeMode = ref<'synthesis' | 'asr'>('synthesis');
const activeTab = ref('history');
const soundPromptDialog = ref<InstanceType<typeof SoundPromptDialog>>();

const synthesisCreateRef = ref();
const synthesisListRef = ref();
const asrCreateRef = ref();
const asrListRef = ref();

const taskStore = useTaskStore();

const onSynthesisSubmitted = () => {
  if (synthesisListRef.value) {
    synthesisListRef.value.doRefresh();
  }
};

const onAsrSubmitted = () => {
  if (asrListRef.value) {
    asrListRef.value.doRefresh();
  }
};

const handleClearTasks = async () => {
  await Dialog.confirm('将清空当前类型的任务记录，此操作无法撤销。', '清空任务记录');
  const biz = activeMode.value === 'synthesis' ? 'SoundGenerate' : 'SoundAsr';
  try {
    await taskStore.clearTasksByBiz(biz);
    Message.success(t('已清空所有任务'));
    if (activeMode.value === 'synthesis' && synthesisListRef.value) synthesisListRef.value.doRefresh();
    if (activeMode.value === 'asr' && asrListRef.value) asrListRef.value.doRefresh();
  } catch (e: any) {
    Message.error(t('清空失败') + ': ' + e.message);
  }
};

const handleRefresh = () => {
  if (activeMode.value === 'synthesis' && synthesisListRef.value) synthesisListRef.value.doRefresh();
  if (activeMode.value === 'asr' && asrListRef.value) asrListRef.value.doRefresh();
};
</script>

<style scoped>
.sound-page {
  display: flex;
  height: 100%;
  background: transparent;
}

/* 左侧边栏 */
.sidebar {
  width: 360px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
}

/* Logo区域 */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon svg {
  width: 26px;
  height: 26px;
  color: #fff;
}

.logo-text h1 {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.logo-text p {
  font-size: 11px;
  color: #64748b;
  margin: 2px 0 0;
}

/* 模式切换 */
.mode-switch {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
}

.mode-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.mode-btn svg {
  width: 22px;
  height: 22px;
  color: #64748b;
  transition: color 0.25s ease;
}

.mode-btn span {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  transition: color 0.25s ease;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.mode-btn:hover svg,
.mode-btn:hover span {
  color: #94a3b8;
}

.mode-btn.active {
  background: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.3);
}

.mode-btn.active svg {
  color: #fb923c;
}

.mode-btn.active span {
  color: #fb923c;
}

/* 音色管理按钮 */
.voice-manage-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 20px 16px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.voice-manage-btn svg {
  width: 16px;
  height: 16px;
}

.voice-manage-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(249, 115, 22, 0.4);
  color: #fb923c;
}

/* 表单区域 */
.form-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
}

/* 右侧内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* 顶部工具栏 */
.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-nav {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn svg {
  width: 16px;
  height: 16px;
}

.tab-btn:hover {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #fb923c;
  background: rgba(249, 115, 22, 0.1);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn,
.refresh-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.action-btn svg,
.refresh-btn svg {
  width: 18px;
  height: 18px;
  color: #64748b;
}

.action-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.action-btn:hover svg {
  color: #f87171;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.refresh-btn:hover svg {
  color: #94a3b8;
}

/* 内容区域 */
.content-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.list-container {
  height: 100%;
}

/* 滚动条 */
.form-area::-webkit-scrollbar,
.content-body::-webkit-scrollbar {
  width: 4px;
}

.form-area::-webkit-scrollbar-track,
.content-body::-webkit-scrollbar-track {
  background: transparent;
}

.form-area::-webkit-scrollbar-thumb,
.content-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.form-area::-webkit-scrollbar-thumb:hover,
.content-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Arco组件样式覆盖 */
:deep(.arco-textarea),
:deep(.arco-input),
:deep(.arco-select-view) {
  background-color: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  color: #e2e8f0 !important;
}

:deep(.arco-btn-primary) {
  background: linear-gradient(135deg, #f97316 0%, #f59e0b 100%) !important;
  border: none !important;
}

:deep(.arco-radio-group-button) {
  background-color: transparent !important;
  border: none !important;
}
</style>
