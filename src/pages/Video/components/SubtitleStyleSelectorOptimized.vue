<template>
  <div class="subtitle-style-selector">
    <a-card title="字幕样式设置" :bordered="false">
      <a-form layout="vertical">
        <!-- 字体选择 -->
        <a-form-item label="字体">
          <VirtualSelect
            v-model="localStyle.fontName"
            :options="fontOptions"
            :loading="fontsLoading"
            placeholder="选择字体"
            @change="handleFontChange"
          />
        </a-form-item>

        <!-- 字体大小 -->
        <a-form-item label="字体大小">
          <OptimizedSlider
            v-model="localStyle.fontSize"
            :min="12"
            :max="200"
            :step="2"
            show-input
            @change="debouncedUpdate"
          />
        </a-form-item>

        <!-- 颜色设置 -->
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="文字颜色">
              <ColorPicker
                v-model="localStyle.fontColor"
                @change="debouncedUpdate"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="描边颜色">
              <ColorPicker
                v-model="localStyle.outlineColor"
                @change="debouncedUpdate"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="背景颜色">
              <ColorPicker
                v-model="localStyle.backgroundColor"
                @change="debouncedUpdate"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 预览区域 -->
        <a-form-item label="预览">
          <div class="preview-area" :style="previewStyle">
            {{ previewText }}
          </div>
        </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useDebounceFn, useThrottleFn } from '@vueuse/core';
import { ReactiveOptimization } from '../../../utils/reactiveOptimization';
import VirtualSelect from '../../../components/common/VirtualSelect.vue';
import OptimizedSlider from '../../../components/common/OptimizedSlider.vue';
import ColorPicker from '../../../components/common/ColorPicker.vue';

// 类型定义
interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  fontColor: string;
  outlineColor: string;
  outlineWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  position: 'top' | 'center' | 'bottom';
  // ... 其他属性
}

const props = defineProps<{
  modelValue: SubtitleStyle;
  previewText?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: SubtitleStyle): void;
}>();

// 使用优化的响应式数据
const localStyle = ReactiveOptimization.createShallowReactive<SubtitleStyle>({
  fontName: 'Microsoft YaHei',
  fontSize: 48,
  fontColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 2,
  backgroundColor: 'transparent',
  backgroundOpacity: 0,
  position: 'bottom'
});

// 字体列表（使用 markRaw 优化）
const fontOptions = ReactiveOptimization.markNonReactive([]);

// 加载状态
const fontsLoading = ref(false);

// 预览文本
const previewText = computed(() => props.previewText || '预览文字示例');

// 计算预览样式（使用缓存）
const previewStyle = computed(() => {
  return {
    ...localStyle,
    // 确保所有必需属性都有默认值
    fontColor: localStyle.fontColor || '#FFFFFF',
    outlineColor: localStyle.outlineColor || '#000000',
    backgroundColor: localStyle.backgroundColor || 'transparent'
  };
});

// 防抖更新（300ms）
const debouncedUpdate = useDebounceFn(() => {
  emit('update:modelValue', { ...localStyle });
}, 300);

// 节流字体加载
const throttledLoadFonts = useThrottleFn(async () => {
  if (fontOptions.length > 0) return; // 已加载

  fontsLoading.value = true;
  try {
    // 模拟加载字体
    const fonts = await loadFontList();
    fontOptions.push(...fonts);
  } catch (error) {
    console.error('加载字体失败:', error);
  } finally {
    fontsLoading.value = false;
  }
}, 1000);

// 加载字体列表
async function loadFontList() {
  // 这里应该是实际的字体加载逻辑
  return [
    { label: '微软雅黑', value: 'Microsoft YaHei' },
    { label: '微软雅黑粗体', value: 'Microsoft YaHei Bold' },
    { label: '黑体', value: 'SimHei' },
    { label: '宋体', value: 'SimSun' },
    { label: '楷体', value: 'KaiTi' },
    { label: '仿宋', value: 'FangSong' }
    // ... 更多字体
  ];
}

// 事件处理
const handleFontChange = (fontName: string) => {
  localStyle.fontName = fontName;
  debouncedUpdate();

  // 异步加载字体
  loadFontAsync(fontName);
};

// 异步加载字体
async function loadFontAsync(fontName: string) {
  if (!fontName) return;

  try {
    // 使用 FontFace API 动态加载字体
    const fontFace = new FontFace(fontName, `url(/fonts/${fontName}.ttf)`);
    await fontFace.load();
    document.fonts.add(fontFace);
  } catch (error) {
    console.warn(`字体 ${fontName} 加载失败:`, error);
  }
}

// 监听外部变化
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      // 使用批量更新优化性能
      Object.assign(localStyle, newValue);
    }
  },
  { deep: true }
);

// 组件挂载
onMounted(() => {
  // 初始化样式
  if (props.modelValue) {
    Object.assign(localStyle, props.modelValue);
  }

  // 延迟加载字体
  setTimeout(throttledLoadFonts, 100);
});

// 清理资源
onBeforeUnmount(() => {
  // 清理定时器等资源
});

// 导出方法供父组件调用
defineExpose({
  getSelectedStyle: () => ({ ...localStyle }),
  applyStyle: (style: Partial<SubtitleStyle>) => {
    Object.assign(localStyle, style);
    debouncedUpdate();
  }
});
</script>

<style scoped>
.subtitle-style-selector {
  padding: 16px;
}

.preview-area {
  padding: 20px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  text-align: center;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 优化渲染性能 */
.subtitle-style-selector * {
  will-change: auto;
}

/* 减少重排 */
.a-form-item {
  margin-bottom: 16px;
}
</style>
