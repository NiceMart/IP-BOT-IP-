<template>
  <div class="text-layout-worker">
    <div class="layout-canvas" ref="canvasRef">
      <div
        v-for="(line, index) in layoutResult?.lines || []"
        :key="index"
        class="text-line"
        :style="{
          position: 'absolute',
          left: line.x + 'px',
          top: line.y + 'px',
          width: line.width + 'px',
          height: line.height + 'px',
          fontSize: fontSize + 'px',
          fontFamily: fontFamily,
          lineHeight: 1.2
        }"
      >
        {{ line.text }}
      </div>
    </div>

    <div class="layout-info">
      <a-space direction="vertical" size="small">
        <div>字符数: {{ layoutResult?.charCount || 0 }}</div>
        <div>行数: {{ layoutResult?.lineCount || 0 }}</div>
        <div>总宽度: {{ layoutResult?.totalWidth || 0 }}px</div>
        <div>总高度: {{ layoutResult?.totalHeight || 0 }}px</div>
      </a-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { calculateTextLayoutCached, textLayoutCache } from '../../utils/workerUtils';

const props = defineProps<{
  text: string;
  fontSize: number;
  fontFamily: string;
  maxWidth: number;
  maxHeight: number;
  direction?: 'horizontal' | 'vertical';
  charSpacing?: number;
  lineSpacing?: number;
}>();

const canvasRef = ref<HTMLElement>();
const layoutResult = ref<any>(null);
const calculating = ref(false);

// 计算文字布局
const calculateLayout = useDebounceFn(async () => {
  if (!props.text) {
    layoutResult.value = null;
    return;
  }

  calculating.value = true;

  try {
    // 使用 Web Worker 计算布局
    const result = await calculateTextLayoutCached({
      text: props.text,
      fontSize: props.fontSize,
      fontFamily: props.fontFamily,
      maxWidth: props.maxWidth,
      maxHeight: props.maxHeight,
      direction: props.direction || 'horizontal',
      charSpacing: props.charSpacing || 0,
      lineSpacing: props.lineSpacing || 0
    });

    layoutResult.value = result;

    // 调整画布大小
    if (canvasRef.value) {
      canvasRef.value.style.width = result.totalWidth + 'px';
      canvasRef.value.style.height = result.totalHeight + 'px';
    }
  } catch (error) {
    console.error('文字布局计算失败:', error);
    layoutResult.value = null;
  } finally {
    calculating.value = false;
  }
}, 100);

// 监听变化
watch(
  [
    () => props.text,
    () => props.fontSize,
    () => props.fontFamily,
    () => props.maxWidth,
    () => props.maxHeight,
    () => props.direction,
    () => props.charSpacing,
    () => props.lineSpacing
  ],
  calculateLayout,
  { deep: true }
);

// 组件挂载时计算
onMounted(() => {
  calculateLayout();
});

// 清理
onBeforeUnmount(() => {
  // 清理缓存
  textLayoutCache.clear();
});

// 导出方法
defineExpose({
  calculateLayout,
  clearCache: () => textLayoutCache.clear()
});
</script>

<style scoped>
.text-layout-worker {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.layout-canvas {
  position: relative;
  background: #f9f9f9;
  border: 1px dashed #d0d0d0;
  min-height: 200px;
  overflow: hidden;
}

.text-line {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 4px;
  margin: 2px;
  padding: 4px 8px;
  font-weight: 500;
}

.layout-info {
  margin-top: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}
</style>