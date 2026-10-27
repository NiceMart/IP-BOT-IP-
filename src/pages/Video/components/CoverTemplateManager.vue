<template>
  <div class="cover-template-manager">
    <a-spin :spinning="loading">
      <div class="template-list">
        <a-empty v-if="!templates || templates.length === 0" description="暂无模板">
          <a-button type="primary" @click="handleCreateNew">创建新模板</a-button>
        </a-empty>
        
        <a-row v-else :gutter="[16, 16]">
          <a-col
            v-for="template in templates"
            :key="template.id"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
          >
            <a-card
              hoverable
              :class="['template-card', { 'selected': selectedTemplate === template.id }]"
              @click="handleSelect(template.id)"
            >
              <template #cover>
                <div class="template-thumbnail">
                  <img
                    v-if="template.thumbnailPath"
                    :src="template.thumbnailPath"
                    alt="模板缩略图"
                  />
                  <div v-else class="placeholder">
                    <icon-image style="font-size: 48px; color: #ccc;" />
                  </div>
                </div>
              </template>
              
              <a-card-meta :title="template.name">
                <template #description>
                  <div class="template-info">
                    <div>创建时间: {{ formatDate(template.createdAt) }}</div>
                    <div v-if="template.updatedAt !== template.createdAt">
                      更新时间: {{ formatDate(template.updatedAt) }}
                    </div>
                  </div>
                </template>
              </a-card-meta>
              
              <template #actions>
                <a-tooltip title="选择">
                  <icon-check @click.stop="handleSelect(template.id)" />
                </a-tooltip>
                <a-tooltip title="编辑">
                  <icon-edit @click.stop="handleEdit(template.id)" />
                </a-tooltip>
                <a-tooltip title="复制">
                  <icon-copy @click.stop="handleDuplicate(template.id, template.name)" />
                </a-tooltip>
                <a-tooltip title="导出">
                  <icon-download @click.stop="handleExport(template.id, template.name)" />
                </a-tooltip>
                <!-- 只有非系统模板才显示删除按钮 -->
                <a-tooltip v-if="!template.is_system || template.is_system === 0" title="删除">
                  <a-popconfirm
                    title="确定要删除这个模板吗？"
                    ok-text="确定"
                    cancel-text="取消"
                    @ok="handleDelete(template.id)"
                  >
                    <icon-delete @click.stop />
                  </a-popconfirm>
                </a-tooltip>
                <!-- 系统模板显示提示 -->
                <a-tooltip v-else title="系统默认模板不可删除">
                  <icon-lock style="color: #ccc; cursor: not-allowed;" />
                </a-tooltip>
              </template>
            </a-card>
          </a-col>
        </a-row>
        
        <div v-if="templates && templates.length > 0 && templates.length < 24" class="add-template">
          <a-button type="dashed" block @click="handleCreateNew">
            <icon-plus /> 创建新模板 ({{ templates.length }}/24)
          </a-button>
        </div>

        <a-alert
          v-if="templates && templates.length >= 24"
          message="已达到模板数量上限"
          description="最多只能保存24个自定义模板，如需创建新模板，请先删除一些现有模板。"
          type="info"
          show-icon
          style="margin-top: 16px;"
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed } from 'vue';
import {
  IconImage,
  IconCheck,
  IconEdit,
  IconDelete,
  IconPlus,
  IconLock,
  IconDownload,
  IconCopy
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { duplicateCoverTemplate } from '@/api/coverTemplate';

interface CoverTemplate {
  id: string;
  name: string;
  thumbnailPath?: string;
  config: any;
  createdAt: number;
  updatedAt: number;
  is_system?: number;  // 是否为系统模板：1=系统模板，0=用户自定义
}

const props = defineProps<{
  selectedTemplate?: string;
  templates: CoverTemplate[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:selectedTemplate': [value: string];
  'select': [templateId: string];
  'edit': [templateId: string];
  'delete': [templateId: string];
  'refresh': [];
}>();

// 格式化日期
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 选择模板
const handleSelect = (templateId: string) => {
  emit('update:selectedTemplate', templateId);
  emit('select', templateId);
};

// 编辑模板
const handleEdit = (templateId: string) => {
  emit('edit', templateId);
};

// 删除模板
const handleDelete = (templateId: string) => {
  emit('delete', templateId);
};

// 复制模板
const handleDuplicate = async (templateId: string, templateName: string) => {
  try {
    console.log('[CoverTemplateManager] 开始复制模板:', templateId);
    Message.loading({ content: '正在复制模板...', duration: 0, id: 'duplicate' });

    const newId = await duplicateCoverTemplate(templateId);

    Message.clear('duplicate');
    Message.success(`模板 "${templateName}" 复制成功`);
    console.log('[CoverTemplateManager] 复制成功，新模板ID:', newId);

    // 刷新模板列表
    emit('refresh');
  } catch (error) {
    Message.clear('duplicate');
    Message.error('复制失败: ' + (error as Error).message);
    console.error('[CoverTemplateManager] 复制异常:', error);
  }
};

// 导出模板
const handleExport = async (templateId: string, templateName: string) => {
  try {
    console.log('[CoverTemplateManager] 开始导出模板:', templateId);

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
      console.log('[CoverTemplateManager] 导出成功');
    } else {
      Message.error(result.message || '导出失败');
      console.error('[CoverTemplateManager] 导出失败:', result.message);
    }
  } catch (error) {
    Message.error('导出出错: ' + (error as Error).message);
    console.error('[CoverTemplateManager] 导出异常:', error);
  }
};

// 创建新模板
const handleCreateNew = () => {
  // 使用特殊标识符表示创建新模板，不清空已选模板
  emit('update:selectedTemplate', '__CREATE_NEW__');
  emit('select', '__CREATE_NEW__');
};
</script>

<style scoped lang="less">
.cover-template-manager {
  padding: 16px;
  
  .template-list {
    .template-card {
      border: 2px solid transparent;
      transition: all 0.3s;
      
      &.selected {
        border-color: #1890ff;
        box-shadow: 0 0 10px rgba(24, 144, 255, 0.3);
      }
      
      &:hover {
        border-color: #40a9ff;
      }
      
      .template-thumbnail {
        width: 100%;
        height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        overflow: hidden;
        
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
      }
      
      .template-info {
        font-size: 12px;
        color: #999;
        
        div {
          margin-bottom: 4px;
          
          &:last-child {
            margin-bottom: 0;
          }
        }
      }
    }
    
    .add-template {
      margin-top: 16px;
    }
  }
}
</style>
