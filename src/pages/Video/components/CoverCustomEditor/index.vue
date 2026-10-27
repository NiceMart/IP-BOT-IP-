<template>
  <a-modal
    v-model:visible="dialogVisible"
    :title="props.existingTemplate ? '编辑封面模板' : '创建封面模板'"
    width="90%"
    :footer="false"
    @cancel="handleCancel"
  >
    <div class="cover-editor-container">
      <!-- 左侧画布区域 -->
      <CanvasEditor
        ref="canvasEditorRef"
        v-model:template="template"
        v-model:active-layer="activeLayer"
        :canvas-scale="CANVAS_SCALE"
        :canvas-width="CANVAS_WIDTH"
        :canvas-height="CANVAS_HEIGHT"
        @layer-activated="handleLayerActivated"
      />

      <!-- 右侧参数面板 -->
      <StylePanel
        ref="stylePanelRef"
        v-model:template="template"
        :active-layer="activeLayer"
        @update:template="handleTemplateUpdate"
      />
    </div>

    <!-- 底部按钮 -->
    <div class="editor-footer">
      <!-- ✨ 系统模板选项（仅开发模式） -->
      <div v-if="isDev" class="system-template-option">
        <a-checkbox v-model="isSystemTemplate">
          <span class="text-yellow-500 font-medium">✨ 设为系统模板</span>
          <span class="text-gray-400 text-sm ml-2">（保存时自动导出到配置文件）</span>
        </a-checkbox>
      </div>

      <div class="button-group">
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" @click="handleSave" :loading="isSaving">
          {{ isSystemTemplate ? '保存系统模板' : '保存模板' }}
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import type { CoverTemplate } from '../../../declarations/app';
import { getCoverTemplate, saveCoverTemplate } from '../../../api/coverTemplate';
import { saveCoverTemplateWithAutoExport } from '../../../api/systemTemplates';
import { useDevMode } from '../../../composables/useDevMode';
import CanvasEditor from './CanvasEditor.vue';
import StylePanel from './StylePanel.vue';

const props = defineProps<{
  visible: boolean;
  baseSettings: {
    backgroundBlurEnabled: boolean;
    backgroundBlurIntensity: number;
    personBorderEnabled: boolean;
    personBorderStyle: 'solid' | 'dashed';
    personBorderColor: string;
    personBorderWidth: number;
    personBorderDashLength?: number | null;
    personBorderGapLength?: number | null;
    autoSplitText: boolean;
    titleMaxLength: number;
    subtitleMaxLength: number;
  };
  referenceText?: string;
  templateId?: string | null;
  existingTemplate?: CoverTemplate | null;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "save", template: CoverTemplate): void;
  (e: "close"): void;
}>();

// 画布配置
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1440;
const CANVAS_SCALE = 0.4;

// 响应式数据
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val)
});

const template = reactive<CoverTemplate>({
  id: "",  // ✅ 添加 id 字段初始化（创建新模板时为空字符串）
  name: "",
  backgroundEnabled: true,
  backgroundBlurEnabled: props.baseSettings.backgroundBlurEnabled,
  backgroundBlurIntensity: props.baseSettings.backgroundBlurIntensity,
  personBorderEnabled: props.baseSettings.personBorderEnabled,
  personBorderStyle: props.baseSettings.personBorderStyle,
  personBorderColor: props.baseSettings.personBorderColor,
  personBorderWidth: props.baseSettings.personBorderWidth,
  personBorderDashLength: props.baseSettings.personBorderDashLength,
  personBorderGapLength: props.baseSettings.personBorderGapLength,
  personSize: 80,
  personPosition: { x: 50, y: 50 },
  personRotation: 0,
  backgroundSize: 100,
  backgroundPosition: { x: 50, y: 50 },
  autoSplitText: props.baseSettings.autoSplitText,
  titleMaxLength: props.baseSettings.titleMaxLength,
  subtitleMaxLength: props.baseSettings.subtitleMaxLength,
  titleText: "",
  titleFontFamily: "SimHei",
  titleFontSize: 120,
  titleFontWeight: 700,
  titleColor: "#FFFFFF",
  titleStrokeColor: "#000000",
  titleStrokeWidth: 2,
  titleShadowColor: "#000000",
  titleShadowOffsetX: 0,
  titleShadowOffsetY: 0,
  titleShadowBlur: 0,
  titleShadowEnabled: false,
  titleShadowLayers: [],
  titlePosition: { x: 50, y: 80 },
  titleRotation: 0,
  titleDirection: 'horizontal',
  titleCharSpacing: 24,
  titleLineSpacing: 144,
  titleMaxCharsPerLine: 10,
  titleBackgroundEnabled: false,
  titleBackgroundColor: "#000000",
  titleBackgroundOpacity: 70,
  titleBackgroundShape: 'rectangle',
  titleBackgroundSize: { width: 30, height: 10 },
  titleBackgroundPosition: { x: 50, y: 30 },
  titleBackgroundPoints: [],
  titleBackgroundRadius: 10,
  titleBackgroundRotation: 0,
  subtitleText: "",
  subtitleFontFamily: "SimHei",
  subtitleFontSize: 60,
  subtitleFontWeight: 500,
  subtitleColor: "#FFFFFF",
  subtitleStrokeColor: "#000000",
  subtitleStrokeWidth: 1,
  subtitleShadowColor: "#000000",
  subtitleShadowOffsetX: 0,
  subtitleShadowOffsetY: 0,
  subtitleShadowBlur: 0,
  subtitleShadowEnabled: false,
  subtitleShadowLayers: [],
  subtitlePosition: { x: 50, y: 90 },
  subtitleRotation: 0,
  subtitleDirection: 'horizontal',
  subtitleCharSpacing: 12,
  subtitleLineSpacing: 72,
  subtitleMaxCharsPerLine: 15,
  subtitleBackgroundEnabled: false,
  subtitleBackgroundColor: "#000000",
  subtitleBackgroundOpacity: 70,
  subtitleBackgroundShape: 'rectangle',
  subtitleBackgroundSize: { width: 30, height: 10 },
  subtitleBackgroundPosition: { x: 50, y: 60 },
  subtitleBackgroundPoints: [],
  subtitleBackgroundRadius: 10,
  subtitleBackgroundRotation: 0,
  maskEnabled: false,
  maskImagePath: undefined,
  maskSize: 100,
  maskPosition: { x: 50, y: 50 },
  maskColor: undefined,
  maskOpacity: 100,
  maskShape: 'rectangle',
});

const activeLayer = ref<string | null>(null);

// 组件引用
const canvasEditorRef = ref();
const stylePanelRef = ref();

// 开发模式检查
const { isDev } = useDevMode();

// 系统模板选项（仅在开发模式显示）
const isSystemTemplate = ref(false);
const isSaving = ref(false);

// 初始化模板数据
const initializeTemplate = async () => {
  if (props.existingTemplate) {
    Object.assign(template, props.existingTemplate);
    // ✅ 编辑系统模板时，自动勾选复选框
    if (props.existingTemplate.is_system === 1) {
      isSystemTemplate.value = true;
      console.log('[CoverCustomEditor] 检测到系统模板，自动勾选"设为系统模板"');
    }
  } else if (props.templateId) {
    try {
      const existing = await getCoverTemplate(props.templateId);
      if (existing) {
        Object.assign(template, existing);
        // ✅ 编辑系统模板时，自动勾选复选框
        if (existing.is_system === 1) {
          isSystemTemplate.value = true;
          console.log('[CoverCustomEditor] 检测到系统模板，自动勾选"设为系统模板"');
        }
      }
    } catch (error) {
      console.error('加载模板失败:', error);
    }
  } else {
    template.name = "";
    template.titleText = props.referenceText ?
      props.referenceText.slice(0, props.baseSettings.titleMaxLength) : "";
  }
};

// 事件处理
const handleLayerActivated = (layerName: string) => {
  activeLayer.value = layerName;
};

const handleTemplateUpdate = (updates: Partial<CoverTemplate>) => {
  Object.assign(template, updates);
};

const handleCancel = () => {
  emit("close");
};

const handleSave = async () => {
  console.log('[CoverCustomEditor] handleSave 被调用，模板信息:', {
    id: template.id,
    name: template.name,
    isSystemTemplate: isSystemTemplate.value,
    isDev: isDev.value
  });

  if (!template.name.trim()) {
    Message.warning("请输入模板名称");
    return;
  }

  isSaving.value = true;

  try {
    const templateToSave = { ...template };
    console.log('[CoverCustomEditor] 创建了 templateToSave 副本:', {
      id: templateToSave.id,
      name: templateToSave.name
    });

    // ✨ 如果设置为系统模板，使用自动导出 API
    if (isSystemTemplate.value && isDev.value) {
      console.log('[CoverCustomEditor] 保存为系统模板:', templateToSave.id);

      const result = await saveCoverTemplateWithAutoExport({
        type: 'cover',
        id: templateToSave.id,
        name: templateToSave.name,
        description: templateToSave.name,
        config: templateToSave,
        thumbnailPath: templateToSave.thumbnailPath
      });

      if (result.success) {
        Message.success("✅ 系统模板已保存并自动导出到配置文件");
        console.log('[CoverCustomEditor] 系统模板已导出:', result.id);
        emit("save", templateToSave);
        // 关闭对话框
        dialogVisible.value = false;
      } else {
        Message.error("保存系统模板失败：" + result.error);
        isSaving.value = false;
        return;
      }
    } else {
      // 普通模板保存
      console.log('[CoverCustomEditor] 保存普通模板:', templateToSave.id);

      // ✅ 修复：检查保存是否成功
      try {
        const savedId = await saveCoverTemplate(templateToSave);
        console.log('[CoverCustomEditor] 普通模板已保存，ID:', savedId);

        // ✅ 修复：检查返回值是否有效
        if (!savedId) {
          Message.error("模板保存失败：未获取到模板ID，请检查日志并重试");
          isSaving.value = false;
          return;  // 不关闭对话框，让用户重试
        }

        templateToSave.id = savedId;  // ✨ 更新ID
        Message.success("模板保存成功");
        emit("save", templateToSave);
        // 关闭对话框
        dialogVisible.value = false;
      } catch (saveError) {
        // ✅ 修复：单独捕获保存错误，显示给用户
        console.error('[CoverCustomEditor] 普通模板保存失败:', saveError);
        Message.error("模板保存失败：" + ((saveError as Error).message || '未知错误'));
        isSaving.value = false;
        return;  // 不关闭对话框，让用户重试
      }
    }
  } catch (error) {
    console.error("保存模板失败:", error);
    Message.error("保存模板失败：" + (error as Error).message);
  } finally {
    isSaving.value = false;
  }
};

// 监听对话框显示
watch(() => props.visible, (visible) => {
  if (visible) {
    isSystemTemplate.value = false; // 先重置系统模板标记
    initializeTemplate();  // 然后初始化，initializeTemplate会根据模板类型设置正确的值
  }
});
</script>

<style scoped lang="less">
.cover-editor-container {
  display: flex;
  height: 80vh;
  gap: 20px;
}

.editor-footer {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;

  .system-template-option {
    flex: 1;
    padding: 12px;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
    border-radius: 4px;
    display: flex;
    align-items: center;

    :deep(.arco-checkbox) {
      margin: 0;
    }

    .text-yellow-500 {
      color: #eab308;
    }

    .text-gray-400 {
      color: #9ca3af;
    }
  }

  .button-group {
    display: flex;
    gap: 10px;
  }
}
</style>