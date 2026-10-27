<template>
  <div class="title-subtitle-settings">
    <div class="setting-header">
      <a-switch v-model="config.enabled" @change="onEnabledChange" />
      <span class="title">标题字幕</span>
    </div>

    <template v-if="config.enabled">
      <!-- 标题预览 -->
      <div class="title-preview">
        <div class="label">
          当前标题（自动读取"标题标签关键词生成"任务）：
        </div>
        <div v-if="!config.sourceTitle" class="no-title-hint">
          <a-empty description="暂无标题，请先运行'标题标签关键词生成'任务">
            <a-button size="small" @click="refreshTitle">重新加载</a-button>
          </a-empty>
        </div>
        <div v-else class="title-content">
          <div class="title-text">{{ config.sourceTitle }}</div>
          <a-button size="small" @click="refreshTitle">重新加载</a-button>
        </div>
      </div>

      <!-- 每行字符数设置 -->
      <div class="setting-item">
        <div class="label">每行最大字符数：</div>
        <a-slider
          v-model="config.maxCharsPerLine"
          :min="8"
          :max="20"
          :marks="{ 8: '8', 12: '12', 15: '15', 20: '20' }"
          @change="onMaxCharsChange"
          class="slider-control"
        />
      </div>

      <!-- 行间距设置 -->
      <div class="setting-item">
        <div class="label">行间距（%）：</div>
        <a-input-number
          v-model="config.lineSpacingPercent"
          :min="3"
          :max="15"
          :step="1"
          @change="onLineSpacingChange"
        />
        <span class="unit">相对于视频高度</span>
      </div>

      <!-- 顶部边距设置 -->
      <div class="setting-item">
        <div class="label">顶部边距（%）：</div>
        <a-input-number
          v-model="config.topMarginPercent"
          :min="2"
          :max="20"
          :step="1"
          @change="onTopMarginChange"
        />
        <span class="unit">相对于视频高度</span>
      </div>

      <!-- 分行预览 -->
      <div class="lines-preview" v-if="config.lines.length > 0">
        <div class="label">分行预览（共{{ config.lines.length }}行）：</div>
        <div
          v-for="(line, index) in config.lines"
          :key="index"
          class="line-preview"
        >
          <span class="line-number">第{{ index + 1 }}行：</span>
          <span class="line-text">{{ line.text }}</span>
        </div>
      </div>

      <!-- 每行样式配置 -->
      <div class="lines-config" v-if="config.lines.length > 0">
        <div class="label">每行样式配置：</div>
        <a-collapse :default-active-key="['0']">
          <a-collapse-item
            v-for="(line, index) in config.lines"
            :key="index.toString()"
            :header="`第${index + 1}行：${line.text}`"
          >
            <LineStyleEditor
              v-model="config.lines[index]"
              @change="onLineStyleChange"
            />
          </a-collapse-item>
        </a-collapse>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, watch, onMounted } from 'vue';
import type { TitleSubtitleConfig } from '@/types/smartSubtitle';
import { generateTitleLines, getDefaultTitleSubtitleConfig } from '@/lib/subtitle/TitleSubtitleUtils';
import { TaskService } from '@/service/TaskService';
import { Message } from '@arco-design/web-vue';
import { StorageUtil } from '@/lib/storage';
import LineStyleEditor from './LineStyleEditor.vue';

const props = defineProps<{
  modelValue: TitleSubtitleConfig;
  projectId?: string;  // 当前项目ID，用于读取标题
  videoWidth?: number;  // 视频宽度
  videoHeight?: number; // 视频高度
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TitleSubtitleConfig): void;
}>();

const config = ref<TitleSubtitleConfig>(props.modelValue || getDefaultTitleSubtitleConfig());

// ✨ 从VideoIPAgent的工作数据中读取标题
async function refreshTitle() {
  try {
    console.log('[TitleSubtitleSettings] 开始加载标题...');

    // ✅ 改进：从localStorage中读取VideoIPAgent的工作数据
    const workData = StorageUtil.getObject('VideoIPAgent.workData');

    if (workData && workData.generatedTitle) {
      config.value.sourceTitle = workData.generatedTitle;
      console.log('[TitleSubtitleSettings] ✅ 标题加载成功:', workData.generatedTitle);
      updateLines();
      return;
    }

    // 如果localStorage中没有找到，尝试查询TaskService（兼容旧版本）
    console.log('[TitleSubtitleSettings] 📂 localStorage中未找到标题，尝试查询TaskService...');
    const titleTasks = await TaskService.list('VideoTitleGeneration');

    // 过滤成功的任务，并按ID倒序排列（ID越大越新）
    const successTasks = titleTasks
      .filter(t => t.status === 'success')
      .sort((a, b) => (b.id || 0) - (a.id || 0));

    if (successTasks.length > 0) {
      const latestTask = successTasks[0];

      // 从result中提取标题
      if (latestTask.result && latestTask.result.title) {
        config.value.sourceTitle = latestTask.result.title;
        console.log('[TitleSubtitleSettings] ✅ 从TaskService加载标题成功:', latestTask.result.title);
        updateLines();
        return;
      }
    }

    // 如果都没找到，显示提示
    console.log('[TitleSubtitleSettings] ⚠️ 未找到生成的标题');
    // 不显示Message，避免打扰用户
  } catch (error) {
    console.error('[TitleSubtitleSettings] 读取标题失败:', error);
    // 静默失败，不打扰用户
  }
}

// 更新分行
function updateLines() {
  const videoWidth = props.videoWidth || 1920;
  const videoHeight = props.videoHeight || 1080;

  config.value.lines = generateTitleLines(config.value, videoWidth, videoHeight);
  emit('update:modelValue', config.value);
}

function onEnabledChange() {
  emit('update:modelValue', config.value);
}

function onMaxCharsChange() {
  updateLines();
}

function onLineSpacingChange() {
  updateLines();
}

function onTopMarginChange() {
  updateLines();
}

function onLineStyleChange() {
  emit('update:modelValue', config.value);
}

// 监听配置变化
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    config.value = { ...newValue };
  }
}, { deep: true });

// ✨ 监听启用状态，启用时自动加载标题
watch(() => config.value.enabled, (enabled) => {
  if (enabled && !config.value.sourceTitle) {
    console.log('[TitleSubtitleSettings] 标题字幕已启用，自动加载标题...');
    refreshTitle();
  }
});

// ✨ 监听projectId变化，切换项目时自动加载新项目的标题
watch(() => props.projectId, (newProjectId, oldProjectId) => {
  if (newProjectId && newProjectId !== oldProjectId) {
    console.log('[TitleSubtitleSettings] 项目切换，自动加载新项目标题...');
    refreshTitle();
  }
});

// 组件挂载时自动读取标题
onMounted(() => {
  // ✨ 组件挂载时总是尝试加载最新标题（这样用户可以看到标题预览）
  console.log('[TitleSubtitleSettings] 组件挂载，自动加载标题...');
  refreshTitle();
});
</script>

<style scoped lang="scss">
.title-subtitle-settings {
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  .setting-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e5e6eb;

    .title {
      font-size: 16px;
      font-weight: 600;
      color: #1d2129;
    }
  }

  .title-preview {
    margin-bottom: 20px;
    padding: 16px;
    background: #f7f8fa;
    border-radius: 4px;

    .label {
      font-size: 13px;
      font-weight: 500;
      color: #4e5969;
      margin-bottom: 12px;
    }

    .no-title-hint {
      text-align: center;
      padding: 20px 0;
    }

    .title-content {
      display: flex;
      align-items: center;
      gap: 12px;

      .title-text {
        flex: 1;
        font-size: 14px;
        color: #1d2129;
        padding: 8px 12px;
        background: white;
        border-radius: 4px;
        border: 1px solid #e5e6eb;
      }
    }
  }

  .setting-item {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    gap: 12px;

    .label {
      min-width: 140px;
      font-size: 13px;
      color: #4e5969;
    }

    .slider-control {
      flex: 1;
      max-width: 400px;
    }

    .unit {
      font-size: 12px;
      color: #86909c;
    }
  }

  .lines-preview {
    margin: 20px 0;
    padding: 16px;
    background: #f7f8fa;
    border-radius: 4px;

    .label {
      font-size: 13px;
      font-weight: 500;
      color: #4e5969;
      margin-bottom: 12px;
    }

    .line-preview {
      padding: 8px 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e6eb;

      &:last-child {
        margin-bottom: 0;
      }

      .line-number {
        font-weight: 600;
        color: #165dff;
        margin-right: 8px;
      }

      .line-text {
        color: #1d2129;
      }
    }
  }

  .lines-config {
    margin-top: 20px;

    .label {
      font-size: 14px;
      font-weight: 500;
      color: #4e5969;
      margin-bottom: 12px;
    }
  }
}
</style>
