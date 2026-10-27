<template>
  <div class="preview-panel">
    <div class="preview-container" :style="previewContainerStyle">
      <div class="preview-text" :style="previewTextStyle">
        {{ text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface StyleConfig {
  fontColor?: string;
  fontSize?: number;
  fontFamily?: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  [key: string]: any;
}

const props = defineProps<{
  style?: StyleConfig;  // 🔧 修复：style设为可选,避免undefined错误
  text: string;
}>();

const previewContainerStyle = computed(() => ({
  width: '100%',
  height: '200px',
  background: '#f5f5f5',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
}));

const previewTextStyle = computed(() => {
  // 🔧 修复：添加安全检查,防止props.style为undefined
  const style = props.style || {};

  return {
    fontSize: (style.fontSize || 48) + 'px',
    fontFamily: style.fontFamily || 'Arial',
    color: style.fontColor || '#000000',
    WebkitTextStroke: `${style.outlineWidth || 0}px ${style.outlineColor || '#000000'}`,
    backgroundColor: style.backgroundColor || 'transparent',
    padding: '20px',
    textAlign: 'center' as const,
    wordBreak: 'break-all' as const
  };
});
</script>

<style scoped>
.preview-panel {
  width: 100%;
}

.preview-container {
  position: relative;
}

.preview-text {
  white-space: pre-wrap;
}
</style>