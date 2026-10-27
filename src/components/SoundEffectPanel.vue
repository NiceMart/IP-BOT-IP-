<template>
  <div class="sound-effect-panel">
    <!-- 标题和启用开关 -->
    <div class="panel-header">
      <div class="title-group">
        <span class="icon">🔊</span>
        <div>
          <div class="title">分组音效设置</div>
          <div class="subtitle">{{ localConfig.enabled ? '已启用' : '点击开关启用音效功能' }}</div>
        </div>
      </div>
      <a-switch
        v-model:model-value="localConfig.enabled"
        @change="handleEnableChange"
      />
    </div>

    <!-- 音效选择和参数调节 -->
    <div v-if="localConfig.enabled" class="panel-content">
      <!-- 调试信息 -->
      <div style="background: #f0f0f0; padding: 8px; margin-bottom: 16px; border-radius: 4px; font-size: 12px;">
        <div>✓ Panel 显示中 | enabled={{ localConfig.enabled }} | 内置音效: {{ builtinEffects.length }} 个</div>
      </div>
      <!-- 标签页：内置 / 自定义 -->
      <a-tabs v-model:active-key="activeTab" type="button-tabs">
        <!-- 内置音效 -->
        <a-tab-pane key="builtin" title="内置音效">
          <div class="effects-grid">
              <div
                v-for="effect in builtinEffects"
                :key="effect.id"
                :class="['effect-card', { active: localConfig.soundEffectId === effect.id }]"
                @click="selectEffect(effect.id, 'builtin')"
              >
                <div class="effect-icon">🔊</div>
                <div class="effect-name">{{ effect.name }}</div>
                <div class="effect-actions">
                  <a-button
                    type="text"
                    size="mini"
                    @click.stop="previewEffect(effect.id)"
                  >
                    试听
                  </a-button>
                </div>
              </div>
            </div>
        </a-tab-pane>

        <!-- 自定义音效 -->
        <a-tab-pane key="custom" title="自定义音效">
            <div class="custom-effects-list">
              <!-- 已上传的音效列表 -->
              <div v-if="userEffects.length > 0" class="effects-list">
                <div
                  v-for="effect in userEffects"
                  :key="effect.id"
                  :class="['effect-item', { active: localConfig.soundEffectId === effect.id }]"
                  @click="selectEffect(effect.id, 'custom')"
                >
                  <div class="effect-info">
                    <div class="effect-name">{{ effect.name }}</div>
                    <div class="effect-meta">
                      {{ formatDuration(effect.duration) }} •
                      {{ formatFileSize(effect.fileSize) }}
                    </div>
                  </div>
                  <div class="effect-actions">
                    <a-button
                      type="text"
                      size="mini"
                      @click.stop="previewEffect(undefined, effect.id)"
                    >
                      试听
                    </a-button>
                    <a-button
                      type="text"
                      status="danger"
                      size="mini"
                      @click.stop="deleteEffect(effect.id)"
                    >
                      删除
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-else class="empty-state">
                <p>📁 暂无自定义音效</p>
                <p style="font-size: 12px; color: #999;">点击下方按钮上传您的音效文件</p>
              </div>

              <!-- 上传区域 - 使用 Electron 原生文件对话框 -->
              <div class="upload-section">
                <a-button type="primary" size="small" @click="handleSelectFile" :loading="uploadLoading">
                  {{ uploadLoading ? '上传中...' : '选择音效文件' }}
                </a-button>
                <span class="upload-tips">支持 MP3, WAV, M4A 格式</span>
              </div>
            </div>
        </a-tab-pane>
      </a-tabs>

      <!-- 音效参数调节 -->
      <div v-if="localConfig.soundEffectId" class="params-section">
        <div class="params-title">音效参数</div>

        <!-- 音量 -->
        <div class="param-item">
          <label class="param-label">音量</label>
          <div class="param-control">
            <a-slider
              v-model:model-value="localConfig.soundEffectConfig.volume"
              :min="0"
              :max="1"
              :step="0.1"
            />
            <span class="param-value">
              {{ (localConfig.soundEffectConfig.volume * 100).toFixed(0) }}%
            </span>
          </div>
        </div>


        <!-- 触发时机 -->
        <div class="param-item">
          <label class="param-label">触发时机</label>
          <a-select
            v-model:model-value="localConfig.soundEffectConfig.triggerTime"
            size="small"
          >
            <a-option value="start">字幕开始</a-option>
            <a-option value="middle">字幕中点</a-option>
            <a-option value="end">字幕结束</a-option>
          </a-select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import SoundEffectService from '@/service/SoundEffectService';
import type { SoundEffectMetadata, UserSoundEffect } from '@/types/soundEffect';

interface Props {
  modelValue: {
    enabled: boolean;
    soundEffectId?: string;
    soundEffectConfig: {
      volume: number;
      pitch: number;
      fadeIn: number;
      fadeOut: number;
      triggerTime: 'start' | 'middle' | 'end';
    };
  };
}

interface Emits {
  (e: 'update:modelValue', value: Props['modelValue']): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 状态
const activeTab = ref<string>('builtin');
const builtinEffects = ref<SoundEffectMetadata[]>([]);
const userEffects = ref<UserSoundEffect[]>([]);
const uploadLoading = ref(false);
const uploadRef = ref();

// 本地配置副本
const localConfig = reactive({
  enabled: props.modelValue.enabled,
  soundEffectId: props.modelValue.soundEffectId,
  soundEffectConfig: {
    volume: props.modelValue.soundEffectConfig.volume,
    pitch: props.modelValue.soundEffectConfig.pitch,
    fadeIn: props.modelValue.soundEffectConfig.fadeIn,
    fadeOut: props.modelValue.soundEffectConfig.fadeOut,
    triggerTime: props.modelValue.soundEffectConfig.triggerTime
  }
});

// 监听 props 变化
watch(() => props.modelValue, (newVal) => {
  console.log('[SoundEffectPanel] Props 变化:', {
    enabled: newVal.enabled,
    soundEffectId: newVal.soundEffectId
  });
  localConfig.enabled = newVal.enabled;
  localConfig.soundEffectId = newVal.soundEffectId;
  localConfig.soundEffectConfig.volume = newVal.soundEffectConfig.volume;
  localConfig.soundEffectConfig.pitch = newVal.soundEffectConfig.pitch;
  localConfig.soundEffectConfig.fadeIn = newVal.soundEffectConfig.fadeIn;
  localConfig.soundEffectConfig.fadeOut = newVal.soundEffectConfig.fadeOut;
  localConfig.soundEffectConfig.triggerTime = newVal.soundEffectConfig.triggerTime;
}, { deep: true });

// 监听 localConfig.enabled 的变化
watch(() => localConfig.enabled, (newVal) => {
  console.log('[SoundEffectPanel] enabled 状态变化:', newVal);
});

// 加载音效列表
onMounted(async () => {
  console.log('[SoundEffectPanel] 组件挂载，开始加载音效...');
  await loadAllEffects();
  await loadUserEffects();
  console.log('[SoundEffectPanel] 音效加载完成，音效数量:', builtinEffects.value.length);
});

/**
 * 加载所有音效（内置 + 用户自定义合并）
 */
async function loadAllEffects() {
  try {
    // 使用 getAllEffects 获取合并的音效列表
    const effects = await SoundEffectService.getAllEffects();
    console.log('[SoundEffectPanel] 加载所有音效成功:', effects.length, '个');
    builtinEffects.value = effects;
  } catch (error) {
    console.error('[SoundEffectPanel] 加载音效失败:', error);
    // 降级到只加载内置音效
    const effects = await SoundEffectService.getBuiltinEffects();
    builtinEffects.value = effects;
    Message.error('加载音效失败');
  }
}

/**
 * 加载用户自定义音效
 */
async function loadUserEffects() {
  try {
    const effects = await SoundEffectService.getUserEffects();
    userEffects.value = effects;
  } catch (error) {
    console.error('加载用户音效失败:', error);
  }
}

/**
 * 选择音效
 */
function selectEffect(effectId: string, type: 'builtin' | 'custom') {
  localConfig.soundEffectId = effectId;
  emitChange();
}

/**
 * 启用/禁用音效
 */
function handleEnableChange() {
  console.log('[SoundEffectPanel] 开关状态变化:', {
    enabled: localConfig.enabled,
    before: !localConfig.enabled,
    after: localConfig.enabled
  });
  emitChange();
}

/**
 * 预览音效
 */
async function previewEffect(effectId?: string, userEffectId?: string) {
  try {
    await SoundEffectService.previewEffect(effectId, userEffectId);
  } catch (error) {
    console.error('预览音效失败:', error);
    Message.error('预览失败');
  }
}

/**
 * 使用 Electron 原生文件对话框选择音效文件
 */
async function handleSelectFile() {
  try {
    // 使用 Electron 的文件选择对话框
    const result = await (window as any).$mapi.file.openFile({
      title: '选择音效文件',
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (!result) {
      console.log('[SoundEffectPanel] 用户取消选择');
      return;
    }

    // 统一处理为数组（openFile 可能返回字符串或数组）
    const filePaths = Array.isArray(result) ? result : [result];
    console.log('[SoundEffectPanel] 选择的文件:', filePaths);
    uploadLoading.value = true;

    for (const filePath of filePaths) {
      // 从文件路径提取文件名（去掉扩展名）
      const fileName = filePath.split(/[\\/]/).pop() || '未命名音效';
      const name = fileName.replace(/\.[^/.]+$/, '');

      console.log('[SoundEffectPanel] 开始导入音效:', { filePath, name });

      const importResult = await SoundEffectService.importEffect(
        filePath,
        name,
        `自定义音效 - ${new Date().toLocaleString()}`
      );

      console.log('[SoundEffectPanel] 导入结果:', importResult);

      if (importResult.success) {
        Message.success(`已上传: ${name}`);
      } else {
        Message.error(`上传失败: ${importResult.message}`);
      }
    }

    // 刷新音效列表
    await loadAllEffects();
  } catch (error) {
    console.error('[SoundEffectPanel] 选择文件失败:', error);
    Message.error('选择文件失败');
  } finally {
    uploadLoading.value = false;
  }
}

/**
 * 处理文件上传选择
 */
async function handleUploadSelect(fileList: any[]) {
  console.log('[SoundEffectPanel] 文件选择触发，文件列表:', fileList);
  
  if (fileList.length === 0) {
    console.log('[SoundEffectPanel] 没有选择文件');
    return;
  }

  uploadLoading.value = true;

  try {
    for (const fileItem of fileList) {
      console.log('[SoundEffectPanel] 处理文件:', {
        file: fileItem,
        fileKeys: Object.keys(fileItem || {}),
        innerFile: fileItem?.file,
        innerFileKeys: Object.keys(fileItem?.file || {})
      });
      
      // 尝试多种方式获取文件路径（兼容不同版本的 Arco 和 Electron）
      let filePath = 
        fileItem?.file?.path ||           // 标准 Electron File API
        (fileItem?.file as any)?.path ||  // 类型断言方式
        fileItem?.path ||                 // 直接属性
        fileItem?.originFile?.path ||     // Arco 某些版本
        (fileItem?.raw as any)?.path;     // 其他可能的位置
      
      if (!filePath) {
        console.warn('[SoundEffectPanel] 无法获取文件路径，尝试使用 webkitRelativePath');
        // 最后尝试通过 webContents 的 dialog 来获取路径
        Message.warning('无法获取文件路径，请确保在 Electron 环境中运行');
        continue;
      }

      console.log('[SoundEffectPanel] 获取到文件路径:', filePath);
      
      // 从文件名生成音效名称（去掉扩展名）
      const fileName = fileItem.name || fileItem?.file?.name || '未命名音效';
      const name = fileName.replace(/\.[^/.]+$/, '');

      console.log('[SoundEffectPanel] 开始导入音效:', { filePath, name });
      
      const result = await SoundEffectService.importEffect(
        filePath,
        name,
        `自定义音效 - ${new Date().toLocaleString()}`
      );

      console.log('[SoundEffectPanel] 导入结果:', result);

      if (result.success) {
        Message.success(`已上传: ${name}`);
        // 刷新合并的音效列表（用户音效会自动合并到内置列表中）
        await loadAllEffects();
      } else {
        Message.error(`上传失败: ${result.message}`);
      }
    }

    // 清空上传列表
    if (uploadRef.value) {
      uploadRef.value.fileList = [];
    }
  } catch (error) {
    console.error('[SoundEffectPanel] 上传音效失败:', error);
    Message.error('上传失败');
  } finally {
    uploadLoading.value = false;
  }
}

/**
 * 删除自定义音效
 */
async function deleteEffect(effectId: string) {
  try {
    const result = await SoundEffectService.deleteEffect(effectId);
    if (result.success) {
      Message.success('音效已删除');
      // 刷新合并的音效列表
      await loadAllEffects();

      // 如果删除的是当前选中的音效，清除选择
      if (localConfig.soundEffectId === effectId) {
        localConfig.soundEffectId = undefined;
        emitChange();
      }
    } else {
      Message.error(`删除失败: ${result.message}`);
    }
  } catch (error) {
    console.error('删除音效失败:', error);
    Message.error('删除失败');
  }
}

/**
 * 发送更新事件
 */
function emitChange() {
  emit('update:modelValue', {
    enabled: localConfig.enabled,
    soundEffectId: localConfig.soundEffectId,
    soundEffectConfig: localConfig.soundEffectConfig
  });
}

/**
 * 格式化时长
 */
function formatDuration(seconds?: number): string {
  if (!seconds) return '0s';
  return `${seconds.toFixed(1)}s`;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
</script>

<style scoped lang="less">
.sound-effect-panel {
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 16px;
  background-color: var(--color-bg-2);

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 12px;
    background-color: var(--color-fill-2);
    border-radius: 4px;
    border-bottom: 2px solid var(--color-border-3);

    .title-group {
      display: flex;
      align-items: center;
      gap: 8px;

      .icon {
        font-size: 18px;
      }

      .title {
        font-weight: 600;
        color: var(--color-text-1);
        margin-bottom: 2px;
      }

      .subtitle {
        font-size: 12px;
        color: var(--color-text-3);
      }
    }
  }

  .panel-content {
    .effects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      margin-bottom: 16px;

      .effect-card {
        padding: 12px;
        border: 2px solid var(--color-border-2);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;

        &:hover {
          border-color: var(--color-primary);
          background-color: var(--color-fill-2);
        }

        &.active {
          border-color: var(--color-primary);
          background-color: var(--color-primary-light-1);
        }

        .effect-icon {
          font-size: 24px;
          margin-bottom: 8px;
        }

        .effect-name {
          font-size: 12px;
          color: var(--color-text-1);
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .effect-actions {
          :deep(.arco-btn) {
            padding: 0 4px;
          }
        }
      }
    }

    .custom-effects-list {
      .effects-list {
        margin-bottom: 16px;
        max-height: 300px;
        overflow-y: auto;

        .effect-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid var(--color-border-2);
          border-radius: 4px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;

          &:hover {
            background-color: var(--color-fill-2);
          }

          &.active {
            border-color: var(--color-primary);
            background-color: var(--color-primary-light-1);
          }

          .effect-info {
            flex: 1;

            .effect-name {
              font-weight: 500;
              color: var(--color-text-1);
              margin-bottom: 4px;
            }

            .effect-meta {
              font-size: 12px;
              color: var(--color-text-3);
            }
          }

          .effect-actions {
            display: flex;
            gap: 4px;

            :deep(.arco-btn) {
              padding: 0 4px;
            }
          }
        }
      }

      .empty-state {
        text-align: center;
        padding: 24px;
        color: var(--color-text-3);
      }

      .upload-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border: 2px dashed var(--color-border-2);
        border-radius: 4px;
        background-color: var(--color-fill-3);

        .upload-tips {
          font-size: 12px;
          color: var(--color-text-3);
          text-align: center;
        }
      }
    }

    .params-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--color-border-3);

      .params-title {
        font-weight: 500;
        color: var(--color-text-1);
        margin-bottom: 12px;
      }

      .param-item {
        margin-bottom: 16px;

        .param-label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--color-text-1);
          font-weight: 500;
        }

        .param-control {
          display: flex;
          gap: 12px;
          align-items: center;

          :deep(.arco-slider) {
            flex: 1;
          }

          .param-value {
            min-width: 50px;
            text-align: right;
            font-size: 13px;
            color: var(--color-text-2);
          }
        }

        :deep(.arco-select) {
          width: 100%;
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .sound-effect-panel {
    .panel-content {
      .effects-grid {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }
    }
  }
}
</style>
