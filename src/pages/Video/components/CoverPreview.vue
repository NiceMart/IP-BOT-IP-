<template>
  <div class="cover-preview">
    <a-spin :loading="loading">
      <div class="preview-container" :style="containerStyle">
        <img
          v-if="coverData.backgroundImagePath"
          :src="coverData.backgroundImagePath"
          alt="背景"
          class="background-image"
        />
        <div v-else class="background-placeholder">
          无背景图片
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface CoverConfig {
  name?: string;
  backgroundImagePath?: string;
  coverStyle?: Record<string, any>;
  [key: string]: any;
}

const props = defineProps<{
  config?: CoverConfig;
  templateId?: string;
}>();

const loading = ref(false);

const coverData = computed(() => props.config || {});

const containerStyle = computed(() => ({
  width: '100%',
  minHeight: '300px',
  background: '#f5f5f5',
  border: '1px solid #e0e0e0',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
}));
</script>

<style scoped>
.cover-preview {
  width: 100%;
}

.preview-container {
  position: relative;
  width: 100%;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.background-placeholder {
  color: #999;
  text-align: center;
  padding: 50px;
}
</style>