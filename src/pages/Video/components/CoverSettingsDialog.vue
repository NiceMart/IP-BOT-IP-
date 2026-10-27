```html
<template>
  <a-modal
    :visible="dialogVisible"
    title="封面设置"
    width="92vw"
    height="88vh"
    :footer="false"
    unmount-on-close
    :maskClosable="false"
    @cancel="handleCancel"
  >
    <div class="cover-settings-container">
      <!-- 控制按钮栏 -->
      <div class="control-bar">
        <div class="control-left">
          <h3 class="control-title">素材和模板</h3>
        </div>
        <a-space>
          <a-button type="primary" @click="selectCustomVideo">
            <template #icon>
              <icon-upload />
            </template>
            选择素材文件
          </a-button>
          <a-button
            v-if="customVideoPath"
            status="danger"
            @click="clearCustomVideo"
          >
            <template #icon>
              <icon-delete />
            </template>
            清除
          </a-button>
          <a-divider direction="vertical" style="margin: 0; height: 20px;" />
          <a-button
            size="small"
            type="secondary"
            @click="handleExportAllTemplates"
          >
            <template #icon>
              <icon-download />
            </template>
            导出全部
          </a-button>
          <a-button
            size="small"
            type="primary"
            @click="handleCreateNew"
          >
            创建新模板
          </a-button>
        </a-space>
      </div>

      <div v-if="customVideoPath" class="selected-file">
        ✓ 已选择素材: {{ getFileName(customVideoPath) }}
      </div>

      <!-- 模板列表 -->
      <div class="section">
        <a-spin :spinning="templatesLoading">
          <a-empty v-if="!templates || templates.length === 0" description="暂无模板">
            <template #extra>
              <a-button type="primary" @click="handleCreateNew">
                创建第一个模板
              </a-button>
            </template>
          </a-empty>

          <div v-else class="template-list">
            <div
              v-for="template in templates"
              :key="template.id"
              :class="['template-item', { 'selected': selectedTemplateId === template.id }]"
              @click="selectedTemplateId = template.id"
            >
              <!-- 缩略图 -->
              <div class="template-thumbnail">
                <img
                  v-if="template.thumbnailPath"
                  :src="template.thumbnailPath"
                  alt="模板缩略图"
                  @error="() => handleImageError(template)"
                />
                <div v-else class="placeholder">
                  <div style="text-align: center; font-size: 48px; font-weight: bold; color: #999;">
                    {{ template.name }}
                  </div>
                </div>
              </div>

              <!-- 模板信息 -->
              <div class="template-details">
                <div class="template-name">
                  {{ template.name }}
                  <span v-if="template.is_system === 1" class="system-tag">✨ 系统模板</span>
                </div>
                <div class="template-info">
                  <span>创建: {{ formatDate(template.createdAt) }}</span>
                  <span v-if="template.updatedAt !== template.createdAt">
                    更新: {{ formatDate(template.updatedAt) }}
                  </span>
                </div>
              </div>

              <!-- 操作按钮组 -->
              <div class="action-buttons">
                <a-button
                  size="mini"
                  type="secondary"
                  @click.stop="handleEditTemplate(template.id)"
                >
                  编辑
                </a-button>
                <a-button
                  size="mini"
                  type="secondary"
                  @click.stop="handleExportTemplate(template.id, template.name)"
                >
                  导出
                </a-button>
                <a-popconfirm
                  v-if="!template.is_system || template.is_system === 0 || isDev"
                  content="确定要删除这个模板吗？此操作无法撤销。"
                  type="warning"
                  @ok="handleDeleteTemplate(template.id)"
                >
                  <a-button
                    size="mini"
                    type="secondary"
                    status="danger"
                    @click.stop
                  >
                    删除
                  </a-button>
                </a-popconfirm>
                <a-button
                  v-if="isDev && (!template.is_system || template.is_system === 0)"
                  size="mini"
                  type="outline"
                  @click.stop="handleSetAsSystemTemplate(template.id, template.name)"
                >
                  系统
                </a-button>
              </div>
            </div>
          </div>
        </a-spin>
      </div>

      <!-- 底部按钮 -->
      <div class="dialog-footer">
        <a-space>
          <a-button @click="handleCancel">取消</a-button>
          <a-button type="primary" @click="handleApply" :loading="applying">
            应用配置
          </a-button>
        </a-space>
      </div>
    </div>
  </a-modal>

  <!-- 编辑模板对话框 -->
  <CoverCustomEditor
    v-if="editorVisible && editingTemplate"
    :visible="editorVisible"
    :base-settings="baseSettings"
    :reference-text="props.referenceText"
    :template-id="editingTemplate.id || '__CREATE_NEW__'"

    :existing-template="currentTemplate"
    :initial-title-style="props.initialTitleStyle"
    @save="handleSaveTemplate"
    @close="handleCloseEditor"
    @update:visible="(val) => { if (!val) handleCloseEditor(); }"
  />
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconUpload, IconDelete, IconImage, IconDownload } from '@arco-design/web-vue/es/icon';
import CoverCustomEditor from './CoverCustomEditor.vue';
import type { CoverTemplate } from '../../../declarations/app';
import { useDevMode } from '../../../composables/useDevMode';
import { saveCoverTemplateWithAutoExport } from '../../../api/systemTemplates';

interface CoverConfig {
  templateId?: string;
  coverStyle: any;
}

const props = defineProps<{
  visible: boolean;
  config: CoverConfig;
  videoPath: string;
  templateName?: string;
  referenceText?: string;
  initialTitleStyle?: any;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'update:config': [value: CoverConfig];
  'update:templateName': [value: string];
  'apply': [value: CoverConfig, templateName?: string];
}>();

// 对话框显示状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
});

// 模板列表
const templates = ref<CoverTemplate[]>([]);
const templatesLoading = ref(false);

// 选中的模板ID
const selectedTemplateId = ref<string>();

// 应用中状态
const applying = ref(false);

// 自定义视频路径
const customVideoPath = ref<string>('');

// 编辑模板相关
const editorVisible = ref(false);
const editingTemplate = ref<CoverTemplate | null>(null);
const currentTemplate = ref<CoverTemplate | null>(null);
const saveAsSystemTemplate = ref(false);  // ✨ 保存为系统模板选项

// 开发模式检测
const { isDev } = useDevMode();

// 基础设置（传递给CoverCustomEditor）
const baseSettings = computed(() => ({
  backgroundBlurEnabled: false,
  backgroundBlurIntensity: 10,
  personBorderEnabled: true,  // 启用人像抠图和描边功能
  personBorderStyle: 'solid' as 'solid' | 'dashed',
  personBorderColor: '#FFFFFF',
  personBorderWidth: 8,
  personBorderDashLength: null,
  personBorderGapLength: null,
  autoSplitText: false,
  titleMaxLength: 20,
  subtitleMaxLength: 30
}));

// 监听对话框打开
watch(() => props.visible, (visible) => {
  if (visible) {
    loadTemplates();

    if (props.config) {
      selectedTemplateId.value = props.config.templateId;
    }
  }
});

// 加载模板列表
const loadTemplates = async () => {
  try {
    templatesLoading.value = true;

    // metadataOnly: false 确保获取完整数据包括 thumbnailPath
    console.log('[CoverSettings] 开始加载模板...');
    const result = await window.$mapi.ipAgent.getCoverTemplates({ metadataOnly: false });

    console.log('[CoverSettings] getCoverTemplates 返回结果:', {
      success: result.success,
      templatesCount: result.templates?.length,
      message: result.message
    });

    if (result.success) {
      templates.value = result.templates || [];
      console.log('[CoverSettings] 模板列表加载完成，总数:', templates.value.length);
      console.log('[CoverSettings] 完整的模板详情:', templates.value.map(t => ({
        id: t.id,
        name: t.name,
        is_system: t.is_system,
        hasThumbnail: !!t.thumbnailPath
      })));
    } else {
      Message.error('加载模板列表失败: ' + result.message);
    }
  } catch (error) {
    console.error('[CoverSettings] 加载模板列表失败:', error);
    Message.error('加载模板列表失败');
  } finally {
    templatesLoading.value = false;
  }
};

// 图片加载失败处理
const handleImageError = (template: any) => {
  console.error(`[CoverSettings] 图片加载失败:`, {
    name: template.name,
    id: template.id,
    thumbnailPath: template.thumbnailPath?.substring(0, 50) + '...'
  });
};

// 应用配置
const handleApply = async () => {
  if (!selectedTemplateId.value) {
    Message.warning('请选择一个模板');
    return;
  }

  applying.value = true;

  try {
    // 获取完整的模板配置
    const result = await window.$mapi.ipAgent.getCoverTemplate({ id: selectedTemplateId.value });

    if (!result.success || !result.template) {
      Message.error('获取模板失败');
      return;
    }

    // 提取纯配置（移除元数据字段）
    const { id, name, thumbnailPath, createdAt, updatedAt, ...pureConfig } = result.template;

    console.log('[加载模板] 从数据库加载的配置:', {
      titleMaxCharsPerLine: pureConfig.titleMaxCharsPerLine,
      subtitleMaxCharsPerLine: pureConfig.subtitleMaxCharsPerLine,
      titleMaxLength: pureConfig.titleMaxLength,
      subtitleMaxLength: pureConfig.subtitleMaxLength,
      'pureConfig keys count': Object.keys(pureConfig).length
    });

    // 创建最终的配置对象
    // 🔧 自定义视频逻辑：
    // - 如果用户上传了自定义视频，使用自定义视频路径
    // - 如果删除了自定义视频，使用原始的videoPath（来自props）
    const finalConfig = {
      templateId: selectedTemplateId.value,
      coverStyle: {
        ...pureConfig,
        ...(customVideoPath.value ? { customVideoPath: customVideoPath.value } : {})
      }
    };

    console.log('[CoverSettings] 应用配置:', {
      templateId: selectedTemplateId.value,
      templateName: name,
      hasCustomVideo: !!customVideoPath.value,
      customVideoPath: customVideoPath.value || '(使用默认视频)',
      'finalConfig.coverStyle keys': Object.keys(finalConfig.coverStyle),
      titleMaxCharsPerLine: finalConfig.coverStyle.titleMaxCharsPerLine,
      subtitleMaxCharsPerLine: finalConfig.coverStyle.subtitleMaxCharsPerLine
    });

    emit('apply', finalConfig, name);
    emit('update:config', finalConfig);
    Message.success('封面配置已应用');
    dialogVisible.value = false;
  } catch (error) {
    console.error('应用配置失败:', error);
    Message.error('应用配置失败');
  } finally {
    applying.value = false;
  }
};

// 取消
const handleCancel = () => {
  dialogVisible.value = false;
};

// 选择自定义视频
const selectCustomVideo = async () => {
  try {
    const filePath = await window.$mapi.file.openFile({
      filters: [
        { name: '素材文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv', 'wmv', 'jpg', 'jpeg', 'png', 'bmp', 'webp'] }
      ],
    });
    if (filePath) {
      customVideoPath.value = filePath;
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext);
      Message.success(isImage ? '图片文件已选择，将直接用于模板生成' : '视频文件已选择');
    }
  } catch (error) {
    console.error('选择文件失败:', error);
    Message.error('文件选择失败');
  }
};

// 清除自定义视频
const clearCustomVideo = () => {
  customVideoPath.value = '';
  Message.info('已清除自定义素材');
};

// 获取文件名
const getFileName = (path: string): string => {
  if (!path) return '';
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
};

// 格式化日期
const formatDate = (timestamp: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 创建新模板
const handleCreateNew = () => {
  editingTemplate.value = {
    id: '',
    name: '新模板',
    thumbnailPath: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    is_system: 0
  } as any;
  currentTemplate.value = null;
  editorVisible.value = true;
};

// 编辑模板
const handleEditTemplate = async (templateId: string) => {
  try {
    const result = await window.$mapi.ipAgent.getCoverTemplate({ id: templateId });
    if (result.success && result.template) {
      editingTemplate.value = result.template;
      currentTemplate.value = JSON.parse(JSON.stringify(result.template));
      editorVisible.value = true;
    } else {
      Message.error('加载模板失败');
    }
  } catch (error) {
    console.error('加载模板失败:', error);
    Message.error('加载模板失败');
  }
};

// 删除模板
const handleDeleteTemplate = async (templateId: string) => {
  try {
    console.log('[CoverSettings] 删除模板:', templateId);
    const result = await window.$mapi.ipAgent.deleteCoverTemplate({ id: templateId, isDev: isDev.value });

    if (result.success) {
      Message.success('模板已删除');

      // 如果删除的是当前选中的模板，清除选中状态
      if (selectedTemplateId.value === templateId) {
        selectedTemplateId.value = undefined;
      }

      // 重新加载模板列表
      await loadTemplates();
    } else {
      Message.error('删除模板失败: ' + (result.message || '未知错误'));
    }
  } catch (error) {
    console.error('删除模板失败:', error);
    Message.error('删除模板失败');
  }
};

// ✨ 设为系统模板
const handleSetAsSystemTemplate = async (templateId: string, templateName: string) => {
  try {
    console.log('[CoverSettings] 设为系统模板:', templateId, templateName);
    const result = await window.$mapi.ipAgent.updateCoverTemplate({
      id: templateId,
      is_system: 1,
      isDev: isDev.value
    });

    if (result.success) {
      Message.success(`已将"${templateName}"设为系统模板`);
      // 重新加载模板列表
      await loadTemplates();
    } else {
      Message.error(result.message || '设置失败');
    }
  } catch (error) {
    console.error('[CoverSettings] 设为系统模板失败:', error);
    Message.error('设置失败：' + (error as Error).message);
  }
};

// 导出模板
const handleExportTemplate = async (templateId: string, templateName: string) => {
  try {
    console.log('[CoverSettings] 开始导出模板:', templateId, templateName);

    // 从后端IPC调用导出接口
    const result = await window.$mapi.ipAgent.exportCoverTemplateById({
      id: templateId
    });

    if (result.success && result.data) {
      // 生成JSON文件并下载
      const jsonString = JSON.stringify(result.data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `cover-template-${templateName.replace(/[\s\/\\:*?"<>|]/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Message.success(`模板 "${templateName}" 导出成功`);
      console.log('[CoverSettings] 导出成功');
    } else {
      Message.error(result.message || '导出失败');
      console.error('[CoverSettings] 导出失败:', result.message);
    }
  } catch (error) {
    Message.error('导出出错: ' + (error as Error).message);
    console.error('[CoverSettings] 导出异常:', error);
  }
};

// 导出全部模板
const handleExportAllTemplates = async () => {
  try {
    console.log('[CoverSettings] 开始导出全部模板');

    // 从后端IPC调用导出全部接口
    const result = await window.$mapi.ipAgent.exportAllCoverTemplates();

    if (result.success) {
      Message.success(`所有模板导出成功 (共 ${result.count} 个)`);
      console.log('[CoverSettings] 导出全部成功:', result.configPath);
    } else {
      Message.error(result.message || '导出失败');
      console.error('[CoverSettings] 导出全部失败:', result.message);
    }
  } catch (error) {
    Message.error('导出出错: ' + (error as Error).message);
    console.error('[CoverSettings] 导出全部异常:', error);
  }
};

// 保存编辑的模板
const handleSaveTemplate = async (template: CoverTemplate) => {
  try {
    // 注：CoverCustomEditor 已经处理了保存逻辑和系统模板导出
    // 这里只需要重新加载模板列表并关闭编辑器
    console.log('[保存模板] 接收到保存事件，模板ID:', template.id, '模板名:', template.name);
    console.log('[保存模板] 保存前的模板数量:', templates.value.length);

    // 短暂延迟，确保后端已保存
    await new Promise(resolve => setTimeout(resolve, 300));

    await loadTemplates();
    console.log('[保存模板] 保存后的模板数量:', templates.value.length);

    editorVisible.value = false;
    editingTemplate.value = null;
  } catch (error) {
    console.error('[保存模板] 保存失败:', error);
    Message.error('保存模板失败');
  }
};

// 关闭编辑器
const handleCloseEditor = () => {
  editorVisible.value = false;
  editingTemplate.value = null;
};
</script>

<style scoped lang="less">
.cover-settings-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  overflow: hidden;

  .control-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;

    .control-left {
      display: flex;
      align-items: center;
      min-width: 80px;

      .control-title {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        color: #333;
      }
    }

    :deep(.arco-space) {
      flex-wrap: wrap;
      gap: 6px;
    }

    :deep(.arco-btn) {
      padding: 3px 10px;
      height: 28px;
      font-size: 12px;
    }
  }

  .selected-file {
    padding: 1px 0;
    font-size: 10px;
    color: #00b42a;
    flex-shrink: 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    overflow: hidden;

    .section-title {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      color: #333;
    }
  }

  .template-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    flex: 1;
    overflow-y: auto;
    padding-right: 6px;
    align-content: start;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #d9d9d9;
      border-radius: 3px;

      &:hover {
        background: #bfbfbf;
      }
    }

    .template-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 2px solid #f0f0f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 0;
      min-height: 0;

      &:hover {
        border-color: #4080ff;
        background-color: #f5f7ff;
      }

      &.selected {
        border-color: #4080ff;
        background-color: #e8f3ff;
      }

      .template-thumbnail {
        flex-shrink: 0;
        width: 100%;
        height: auto;
        min-height: 220px;
        max-height: min(46vh, 360px);
        aspect-ratio: 9 / 16;
        border-radius: 10px;
        background-color: #f0f0f0;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #fafafa;
          font-size: 32px;
          font-weight: bold;
          color: #999;
          padding: 4px;
          text-align: center;
        }
      }

      .template-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex-shrink: 0;

        .template-name {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1.35;
          flex-wrap: wrap;

          .system-tag {
            color: #faad14;
            font-size: 10px;
            background: rgba(250, 173, 20, 0.1);
            padding: 2px 6px;
            border-radius: 999px;
            flex-shrink: 0;
            white-space: nowrap;
          }
        }

        .template-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 11px;
          color: #64748b;
        }
      }

      .action-buttons {
        width: 100%;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: center;

        :deep(.arco-btn) {
          flex: 1;
          min-width: 64px;
          padding: 0 8px;
          font-size: 12px;
          height: 28px;
          border-radius: 999px;
        }
      }
    }
  }

  .dialog-footer {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    flex-shrink: 0;

    :deep(.arco-btn) {
      padding: 3px 10px;
      height: 28px;
      font-size: 12px;
    }
  }
}

@media (max-width: 1440px) {
  .cover-settings-container {
    .template-list {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
  }
}

@media (max-width: 1080px) {
  .cover-settings-container {
    .template-list {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
  }
}
</style>
