<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import DragCanvas from './DragCanvas.vue'
import TemplateManager from './TemplateManager.vue'
import type {
  CustomTemplate,
  DragElements,
  DragElementState,
  TitlesConfig,
  PortraitConfig,
  BackgroundConfig,
  MaskConfig
} from '../../types/custom-template'

interface Props {
  currentTemplate?: CustomTemplate
  onTemplateChange?: (template: CustomTemplate) => void
  onGeneratePreview?: (template: CustomTemplate) => void
}

interface Emits {
  (e: 'template-change', template: CustomTemplate): void
  (e: 'generate-preview', template: CustomTemplate): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 模板状态
const template = ref<CustomTemplate>(props.currentTemplate || {
  id: `template_${Date.now()}`,
  name: '未命名模板',
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
      direction: 'horizontal',
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
      direction: 'horizontal',
    },
  },
  mask: {
    imagePath: '',
    size: { width: 30, height: 20 },
    position: { x: 10, y: 10 },
    opacity: 0.8,
    shape: 'rectangle',
  },
})

// 拖拽元素状态
const dragElements = reactive<DragElements>({
  portrait: {
    x: template.value.portrait.position.x,
    y: template.value.portrait.position.y,
    width: template.value.portrait.size.width,
    height: template.value.portrait.size.height,
    isDragging: false,
  },
  mainTitle: {
    x: template.value.titles.main.position.x,
    y: template.value.titles.main.position.y,
    isDragging: false,
  },
  subTitle: {
    x: template.value.titles.sub.position.x,
    y: template.value.titles.sub.position.y,
    isDragging: false,
  },
  mask: {
    x: template.value.mask.position.x,
    y: template.value.mask.position.y,
    width: template.value.mask.size.width,
    height: template.value.mask.size.height,
    isDragging: false,
  },
})

// 监听外部模板变化
watch(
  () => props.currentTemplate,
  (newTemplate) => {
    if (newTemplate) {
      // 🔧 修复：使用深拷贝，确保嵌套对象不会被共享修改
      template.value = structuredClone(newTemplate)
      updateDragElements(false) // 不触发 emit
    }
  },
  { deep: true }
)

// 更新拖拽元素状态
const updateDragElements = (shouldEmit = true) => {
  dragElements.portrait = {
    x: template.value.portrait.position.x,
    y: template.value.portrait.position.y,
    width: template.value.portrait.size.width,
    height: template.value.portrait.size.height,
    isDragging: false,
  }
  dragElements.mainTitle = {
    x: template.value.titles.main.position.x,
    y: template.value.titles.main.position.y,
    isDragging: false,
  }
  dragElements.subTitle = {
    x: template.value.titles.sub.position.x,
    y: template.value.titles.sub.position.y,
    isDragging: false,
  }
  dragElements.mask = {
    x: template.value.mask.position.x,
    y: template.value.mask.position.y,
    width: template.value.mask.size.width,
    height: template.value.mask.size.height,
    isDragging: false,
  }

  // 只在需要时触发父组件更新
  if (shouldEmit) {
    emit('template-change', template.value)
  }
}

// 处理拖拽元素移动
const handleElementMove = (elementId: string, position: { x: number; y: number }) => {
  if (elementId === 'portrait') {
    template.value.portrait.position = position
    dragElements.portrait.x = position.x
    dragElements.portrait.y = position.y
  } else if (elementId === 'mainTitle') {
    template.value.titles.main.position = position
    dragElements.mainTitle.x = position.x
    dragElements.mainTitle.y = position.y
  } else if (elementId === 'subTitle') {
    template.value.titles.sub.position = position
    dragElements.subTitle.x = position.x
    dragElements.subTitle.y = position.y
  } else if (elementId === 'mask') {
    template.value.mask.position = position
    dragElements.mask.x = position.x
    dragElements.mask.y = position.y
  }

  // 通知父组件模板已更新
  emit('template-change', template.value)
}

// 处理元素大小调整
const handleElementResize = (elementId: string, size: { width: number; height: number }) => {
  if (elementId === 'portrait') {
    template.value.portrait.size = size
    dragElements.portrait.width = size.width
    dragElements.portrait.height = size.height
  } else if (elementId === 'mask') {
    template.value.mask.size = size
    dragElements.mask.width = size.width
    dragElements.mask.height = size.height
  }

  // 通知父组件模板已更新
  emit('template-change', template.value)
}

// 处理标题文字输入
const handleTitleInput = (titleType: 'main' | 'sub', text: string) => {
  if (titleType === 'main') {
    // 允许输入更多字符，会根据maxLength自动换行
    template.value.titles.main.text = text
  } else {
    // 允许输入更多字符，会根据maxLength自动换行
    template.value.titles.sub.text = text
  }
}

// 生成预览
const generatePreview = () => {
  emit('generate-preview', template.value)
  Message.success('正在生成预览...')
}

// 重置参数
const resetParameters = () => {
  template.value.background = {
    blurEnabled: false,
    blurRadius: 15,
  }
  template.value.portrait = {
    strokeEnabled: false,
    strokeType: 'solid',
    strokeColor: '#FFD700',
    strokeWidth: 3,
    strokeDashPattern: [10, 5],
    size: { width: 50, height: 70 },
    position: { x: 50, y: 50 },
  }
  template.value.titles.main = {
    text: '',
    maxLength: 4,
    fontSize: 60,
    fontWeight: 700,
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 2,
    position: { x: 50, y: 20 },
  }
  template.value.titles.sub = {
    text: '',
    maxLength: 3,
    fontSize: 40,
    fontWeight: 600,
    color: '#FFFFFF',
    strokeColor: '#000000',
    strokeWidth: 1,
    position: { x: 50, y: 30 },
  }
  template.value.mask = {
    imagePath: '',
    size: { width: 30, height: 20 },
    position: { x: 10, y: 10 },
    opacity: 0.8,
    shape: 'rectangle',
  }
  Message.success('参数已重置')
}
</script>

<template>
  <div class="template-editor space-y-6">
    <!-- 模板标题 -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold">自定义封面模板编辑器</h2>
      <div class="flex space-x-2">
        <a-button @click="generatePreview">
          <template #icon>
            <i class="iconfont icon-eye"></i>
          </template>
          生成预览
        </a-button>
        <a-button type="outline" @click="resetParameters">
          <template #icon>
            <i class="iconfont icon-refresh"></i>
          </template>
          重置参数
        </a-button>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <!-- 左侧：拖拽画布 -->
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h3 class="text-lg font-semibold mb-4">元素位置调整</h3>
          <DragCanvas
            :elements="dragElements"
            :template="template"
            :width="432"
            :height="576"
            @element-move="handleElementMove"
            @element-resize="handleElementResize"
          />
        </div>
      </div>

      <!-- 右侧：参数设置 -->
      <div class="space-y-4">
        <!-- 背景设置 -->
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h4 class="font-semibold mb-3 flex items-center">
            <i class="iconfont icon-background mr-2 text-green-500"></i>
            背景设置
          </h4>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm">启用模糊</label>
              <a-switch v-model="template.background.blurEnabled" />
            </div>
            <div v-if="template.background.blurEnabled" class="space-y-2">
              <label class="block text-sm">模糊度: {{ template.background.blurRadius }}</label>
              <a-slider
                v-model="template.background.blurRadius"
                :min="0"
                :max="50"
                :step="1"
              />
            </div>
          </div>
        </div>

        <!-- 人像设置 -->
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h4 class="font-semibold mb-3 flex items-center">
            <i class="iconfont icon-person mr-2 text-blue-500"></i>
            人像设置
          </h4>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm">启用描边</label>
              <a-switch v-model="template.portrait.strokeEnabled" />
            </div>
            <div v-if="template.portrait.strokeEnabled" class="space-y-3">
              <!-- 描边类型 -->
              <div>
                <label class="block text-sm mb-2">描边类型</label>
                <a-radio-group v-model="template.portrait.strokeType" direction="horizontal">
                  <a-radio value="solid">实线</a-radio>
                  <a-radio value="dashed">虚线</a-radio>
                </a-radio-group>
              </div>

              <!-- 描边颜色 -->
              <div>
                <label class="block text-sm mb-2">描边颜色</label>
                <div class="flex space-x-2">
                  <input
                    type="color"
                    v-model="template.portrait.strokeColor"
                    class="w-10 h-8 border border-gray-300 rounded"
                  />
                  <a-input
                    v-model="template.portrait.strokeColor"
                    :placeholder="'#FFD700'"
                    class="flex-1"
                  />
                </div>
              </div>

              <!-- 描边宽度 -->
              <div>
                <label class="block text-sm mb-2">描边宽度: {{ template.portrait.strokeWidth }}px</label>
                <a-slider
                  v-model="template.portrait.strokeWidth"
                  :min="1"
                  :max="20"
                  :step="1"
                />
              </div>

              <!-- 虚线模式设置 -->
              <div v-if="template.portrait.strokeType === 'dashed'" class="space-y-2">
                <label class="block text-sm">虚线模式</label>
                <div class="grid grid-cols-2 gap-2">
                  <a-input-number
                    v-model="template.portrait.strokeDashPattern[0]"
                    :min="1"
                    :max="50"
                    placeholder="线段长度"
                  />
                  <a-input-number
                    v-model="template.portrait.strokeDashPattern[1]"
                    :min="1"
                    :max="50"
                    placeholder="间隔长度"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 标题设置 -->
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h4 class="font-semibold mb-3 flex items-center">
            <i class="iconfont icon-text mr-2 text-red-500"></i>
            标题设置
          </h4>
          <div class="space-y-4">
            <!-- 主标题 -->
            <div class="border-b pb-3">
              <h5 class="font-medium mb-2">主标题 (每行最多{{ template.titles.main.maxLength }}字，支持多行)</h5>
              <div class="space-y-2">
                <a-input
                  v-model="template.titles.main.text"
                  placeholder="输入主标题文字（超过每行字数会自动换行）"
                  @input="handleTitleInput('main', $event)"
                />
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm mb-1">字体大小</label>
                    <a-input-number
                      v-model="template.titles.main.fontSize"
                      :min="20"
                      :max="120"
                      :step="5"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">字体粗细</label>
                    <a-select v-model="template.titles.main.fontWeight">
                      <a-option value="400">正常</a-option>
                      <a-option value="600">中等</a-option>
                      <a-option value="700">粗体</a-option>
                      <a-option value="900">特粗</a-option>
                    </a-select>
                  </div>
                </div>
                <div>
                  <label class="block text-sm mb-2">文字方向</label>
                  <a-radio-group v-model="template.titles.main.direction">
                    <a-radio value="horizontal">横排（从左到右）</a-radio>
                    <a-radio value="vertical">竖排（从上到下）</a-radio>
                  </a-radio-group>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm mb-2">字符间距: {{ template.titles.main.charSpacing || Math.round(template.titles.main.fontSize * 0.2) }}px</label>
                    <a-slider
                      v-model="template.titles.main.charSpacing"
                      :min="0"
                      :max="100"
                      :step="1"
                      :default-value="Math.round(template.titles.main.fontSize * 0.2)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-2">行间距: {{ template.titles.main.lineSpacing || Math.round(template.titles.main.fontSize * 1.2) }}px</label>
                    <a-slider
                      v-model="template.titles.main.lineSpacing"
                      :min="0"
                      :max="200"
                      :step="1"
                      :default-value="Math.round(template.titles.main.fontSize * 1.2)"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm mb-2">文字颜色</label>
                  <div class="flex space-x-2">
                    <input
                      type="color"
                      v-model="template.titles.main.color"
                      class="w-10 h-8 border border-gray-300 rounded"
                    />
                    <a-input
                      v-model="template.titles.main.color"
                      placeholder="#FFFFFF"
                      class="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 副标题 -->
            <div>
              <h5 class="font-medium mb-2">副标题 (每行最多{{ template.titles.sub.maxLength }}字，支持多行)</h5>
              <div class="space-y-2">
                <a-input
                  v-model="template.titles.sub.text"
                  placeholder="输入副标题文字（超过每行字数会自动换行）"
                  @input="handleTitleInput('sub', $event)"
                />
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm mb-1">字体大小</label>
                    <a-input-number
                      v-model="template.titles.sub.fontSize"
                      :min="16"
                      :max="80"
                      :step="4"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">字体粗细</label>
                    <a-select v-model="template.titles.sub.fontWeight">
                      <a-option value="400">正常</a-option>
                      <a-option value="600">中等</a-option>
                      <a-option value="700">粗体</a-option>
                    </a-select>
                  </div>
                </div>
                <div>
                  <label class="block text-sm mb-2">文字方向</label>
                  <a-radio-group v-model="template.titles.sub.direction">
                    <a-radio value="horizontal">横排（从左到右）</a-radio>
                    <a-radio value="vertical">竖排（从上到下）</a-radio>
                  </a-radio-group>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm mb-2">字符间距: {{ template.titles.sub.charSpacing || Math.round(template.titles.sub.fontSize * 0.2) }}px</label>
                    <a-slider
                      v-model="template.titles.sub.charSpacing"
                      :min="0"
                      :max="100"
                      :step="1"
                      :default-value="Math.round(template.titles.sub.fontSize * 0.2)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-2">行间距: {{ template.titles.sub.lineSpacing || Math.round(template.titles.sub.fontSize * 1.2) }}px</label>
                    <a-slider
                      v-model="template.titles.sub.lineSpacing"
                      :min="0"
                      :max="200"
                      :step="1"
                      :default-value="Math.round(template.titles.sub.fontSize * 1.2)"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm mb-2">文字颜色</label>
                  <div class="flex space-x-2">
                    <input
                      type="color"
                      v-model="template.titles.sub.color"
                      class="w-10 h-8 border border-gray-300 rounded"
                    />
                    <a-input
                      v-model="template.titles.sub.color"
                      placeholder="#FFFFFF"
                      class="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 蒙版设置 -->
        <div class="bg-white p-4 rounded-lg border border-gray-200">
          <h4 class="font-semibold mb-3 flex items-center">
            <i class="iconfont icon-mask mr-2 text-purple-500"></i>
            蒙版设置
          </h4>
          <div class="space-y-3">
            <div>
              <label class="block text-sm mb-2">蒙版图片路径</label>
              <a-input
                v-model="template.mask.imagePath"
                placeholder="选择蒙版图片文件"
              />
            </div>
            <div v-if="template.mask.imagePath" class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-sm mb-1">透明度</label>
                  <a-slider
                    v-model="template.mask.opacity"
                    :min="0"
                    :max="1"
                    :step="0.1"
                  />
                </div>
                <div>
                  <label class="block text-sm mb-1">形状</label>
                  <a-select v-model="template.mask.shape">
                    <a-option value="rectangle">矩形</a-option>
                    <a-option value="circle">圆形</a-option>
                    <a-option value="custom">自定义</a-option>
                  </a-select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-editor {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}
</style>