<script setup lang="ts">
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import type { CustomTemplate } from '../../types/custom-template'

interface Props {
  templates: CustomTemplate[]
  maxTemplates?: number
  onTemplateSelect?: (template: CustomTemplate) => void
  onTemplateSave?: (template: CustomTemplate) => void
  onTemplateDelete?: (templateId: string) => void
  onTemplateRename?: (templateId: string, newName: string) => void
}

interface Emits {
  (e: 'template-select', template: CustomTemplate): void
  (e: 'template-save', template: CustomTemplate): void
  (e: 'template-delete', templateId: string): void
  (e: 'template-rename', templateId: string, newName: string): void
}

const props = withDefaults(defineProps<Props>(), {
  maxTemplates: 5,
})

const emit = defineEmits<Emits>()

// 状态管理
const showSaveDialog = ref(false)
const templateName = ref('')
const isEditingName = ref(false)
const editingTemplateId = ref<string>('')

// 计算属性
const canAddTemplate = computed(() => props.templates.length < props.maxTemplates)

const getTemplatePreview = (template: CustomTemplate) => {
  const elements = []
  if (template.portrait.strokeEnabled) {
    elements.push(`描边:${template.portrait.strokeType}`)
  }
  if (template.background.blurEnabled) {
    elements.push(`模糊:${template.background.blurRadius}`)
  }
  return elements.join(' | ') || '基础模板'
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 方法
const handleTemplateSelect = (template: CustomTemplate) => {
  emit('template-select', template)
  Message.success(`已选择模板: ${template.name}`)
}

const handleSaveTemplate = () => {
  if (!templateName.value.trim()) {
    Message.error('请输入模板名称')
    return
  }

  const template: CustomTemplate = {
    id: `template_${Date.now()}`,
    name: templateName.value.trim(),
    createdAt: new Date().toISOString(),
    background: {
      blurEnabled: false,
      blurRadius: 15,
    },
    portrait: {
      strokeEnabled: false,
      strokeType: 'solid',
      strokeColor: '#FFD700',
      strokeWidth: 3,
      strokeDashPattern: [10, 5],
      size: { width: 50, height: 70 },
      position: { x: 50, y: 50 },
    },
    titles: {
      main: {
        text: '',
        maxLength: 4,
        fontSize: 60,
        fontWeight: 700,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        position: { x: 50, y: 20 },
      },
      sub: {
        text: '',
        maxLength: 3,
        fontSize: 40,
        fontWeight: 600,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 1,
        position: { x: 50, y: 30 },
      },
    },
    mask: {
      imagePath: '',
      size: { width: 30, height: 20 },
      position: { x: 10, y: 10 },
      opacity: 0.8,
      shape: 'rectangle',
    },
  }

  emit('template-save', template)
  showSaveDialog.value = false
  templateName.value = ''
  Message.success(`模板 "${template.name}" 保存成功`)
}

const handleDeleteTemplate = (templateId: string) => {
  const template = props.templates.find(t => t.id === templateId)
  if (!template) return

  emit('template-delete', templateId)
  Message.success(`模板 "${template.name}" 删除成功`)
}

const handleRenameTemplate = (templateId: string, newName: string) => {
  if (!newName.trim()) {
    Message.error('模板名称不能为空')
    return
  }

  emit('template-rename', templateId, newName.trim())
  isEditingName.value = false
  editingTemplateId.value = ''
  Message.success('模板重命名成功')
}

const startRename = (templateId: string, currentName: string) => {
  isEditingName.value = true
  editingTemplateId.value = templateId
  templateName.value = currentName
}

const cancelRename = () => {
  isEditingName.value = false
  editingTemplateId.value = ''
  templateName.value = ''
}
</script>

<template>
  <div class="template-manager">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold flex items-center">
        <i class="iconfont icon-template mr-2 text-blue-500"></i>
        自定义模板管理
      </h3>
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-500">
          {{ templates.length }}/{{ maxTemplates }}
        </span>
        <a-button
          type="primary"
          size="small"
          :disabled="!canAddTemplate"
          @click="showSaveDialog = true"
        >
          <template #icon>
            <i class="iconfont icon-plus"></i>
          </template>
          新建模板
        </a-button>
      </div>
    </div>

    <!-- 模板列表 -->
    <div v-if="templates.length > 0" class="space-y-3">
      <div
        v-for="template in templates"
        :key="template.id"
        class="template-item p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <!-- 模板名称（可编辑） -->
            <div v-if="isEditingName && editingTemplateId === template.id" class="flex items-center space-x-2 mb-2">
              <a-input
                v-model="templateName"
                size="small"
                class="w-40"
                @keyup.enter="handleRenameTemplate(template.id, templateName)"
                @keyup.escape="cancelRename"
              />
              <a-button
                type="primary"
                size="mini"
                @click="handleRenameTemplate(template.id, templateName)"
              >
                确定
              </a-button>
              <a-button
                type="outline"
                size="mini"
                @click="cancelRename"
              >
                取消
              </a-button>
            </div>
            <div v-else class="flex items-center space-x-2 mb-2">
              <h4 class="font-medium">{{ template.name }}</h4>
              <a-button
                type="text"
                size="mini"
                @click="startRename(template.id, template.name)"
              >
                <template #icon>
                  <i class="iconfont icon-edit"></i>
                </template>
              </a-button>
            </div>

            <!-- 模板预览信息 -->
            <div class="text-sm text-gray-600 space-y-1">
              <p>{{ getTemplatePreview(template) }}</p>
              <p>创建时间: {{ formatDate(template.createdAt) }}</p>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center space-x-2">
            <a-button
              type="primary"
              size="small"
              @click="handleTemplateSelect(template)"
            >
              使用
            </a-button>
            <a-button
              type="outline"
              size="small"
              @click="handleDeleteTemplate(template.id)"
            >
              删除
            </a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center py-8 text-gray-500">
      <i class="iconfont icon-template text-4xl mb-2"></i>
      <p>暂无自定义模板</p>
      <p class="text-sm">点击"新建模板"开始创建您的第一个自定义模板</p>
    </div>

    <!-- 新建模板对话框 -->
    <a-modal
      v-model:visible="showSaveDialog"
      title="新建自定义模板"
      @ok="handleSaveTemplate"
      @cancel="templateName = ''"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">模板名称</label>
          <a-input
            v-model="templateName"
            placeholder="请输入模板名称"
            @keyup.enter="handleSaveTemplate"
          />
        </div>
        <div class="text-sm text-gray-600">
          <p>💡 提示：</p>
          <p>• 模板将保存当前的所有参数设置</p>
          <p>• 最多可保存 {{ maxTemplates }} 个自定义模板</p>
          <p>• 可以使用模板快速应用样式设置</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.template-item {
  transition: all 0.2s ease;
}

.template-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>