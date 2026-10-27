<template>
  <div class="style-panel">
    <a-tabs v-model:active-key="activeTab" type="card-gutter">
      <!-- 基础设置 -->
      <a-tab-pane key="basic" title="基础设置">
        <BasicSettings
          v-model:template="template"
          @update:template="handleUpdate"
        />
      </a-tab-pane>

      <!-- 文字设置 -->
      <a-tab-pane key="text" title="文字设置">
        <TextProperties
          v-model:template="template"
          @update:template="handleUpdate"
        />
      </a-tab-pane>

      <!-- 背景设置 -->
      <a-tab-pane key="background" title="背景设置">
        <BackgroundSettings
          v-model:template="template"
          @update:template="handleUpdate"
        />
      </a-tab-pane>

      <!-- 效果设置 -->
      <a-tab-pane key="effects" title="效果设置">
        <EffectsSettings
          v-model:template="template"
          @update:template="handleUpdate"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { CoverTemplate } from '../../../../declarations/app';
import BasicSettings from './panels/BasicSettings.vue';
import TextProperties from './panels/TextProperties.vue';
import BackgroundSettings from './panels/BackgroundSettings.vue';
import EffectsSettings from './panels/EffectsSettings.vue';

const props = defineProps<{
  template: CoverTemplate;
  activeLayer: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:template', value: CoverTemplate): void;
}>();

const activeTab = ref('basic');

const handleUpdate = (updates: Partial<CoverTemplate>) => {
  emit('update:template', { ...props.template, ...updates });
};
</script>

<style scoped>
.style-panel {
  width: 400px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
  max-height: 100%;
}

:deep(.arco-tabs-content) {
  padding-top: 20px;
}

:deep(.arco-tabs-content-item) {
  padding: 0;
}
</style>