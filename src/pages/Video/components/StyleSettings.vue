<template>
  <div class="style-settings">
    <a-form layout="vertical">
      <a-form-item label="背景颜色">
        <a-color-picker
          :model-value="config.backgroundColor"
          @change="handleColorChange('backgroundColor', $event)"
        />
      </a-form-item>

      <a-form-item label="字体大小">
        <a-slider
          :model-value="config.fontSize || 24"
          :min="12"
          :max="72"
          show-input
          @change="handleSliderChange('fontSize', $event)"
        />
      </a-form-item>

      <a-form-item label="字体">
        <a-select
          :model-value="config.fontFamily || 'Arial'"
          @change="handleSelectChange('fontFamily', $event)"
        >
          <a-option value="Arial">Arial</a-option>
          <a-option value="Microsoft YaHei">微软雅黑</a-option>
          <a-option value="SimHei">黑体</a-option>
          <a-option value="SimSun">宋体</a-option>
        </a-select>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  config: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: 'update:config', value: Record<string, any>): void;
}>();

const handleColorChange = (key: string, value: string) => {
  emit('update:config', {
    ...props.config,
    [key]: value
  });
};

const handleSliderChange = (key: string, value: number) => {
  emit('update:config', {
    ...props.config,
    [key]: value
  });
};

const handleSelectChange = (key: string, value: string) => {
  emit('update:config', {
    ...props.config,
    [key]: value
  });
};
</script>

<style scoped>
.style-settings {
  padding: 16px;
}
</style>