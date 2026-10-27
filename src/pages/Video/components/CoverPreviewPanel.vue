<template>
  <div class="cover-preview-panel">
    <div class="preview-container">
      <div class="preview-area">
        <a-spin :spinning="generating" tip="正在生成预览...">
          <div v-if="previewImage" class="preview-image">
            <img :src="previewImage" alt="封面预览" />
          </div>
          <a-empty v-else description="暂无预览">
            <a-button type="primary" @click="handleGenerate">生成预览</a-button>
          </a-empty>
        </a-spin>
      </div>
      
      <div class="preview-info">
        <a-descriptions title="配置信息" :column="1" size="small" bordered>
          <a-descriptions-item label="背景模糊">
            {{ config.coverStyle.backgroundBlurEnabled ? '启用' : '禁用' }}
            <span v-if="config.coverStyle.backgroundBlurEnabled">
              (强度: {{ config.coverStyle.backgroundBlurIntensity }})
            </span>
          </a-descriptions-item>
          
          <a-descriptions-item label="人物描边">
            {{ config.coverStyle.personBorderEnabled ? '启用' : '禁用' }}
            <span v-if="config.coverStyle.personBorderEnabled">
              ({{ config.coverStyle.personBorderStyle }}, 
              {{ config.coverStyle.personBorderWidth }}px)
            </span>
          </a-descriptions-item>
          
          <a-descriptions-item label="标题文字">
            {{ config.coverStyle.titleText || '(未设置)' }}
          </a-descriptions-item>
          
          <a-descriptions-item label="标题字体">
            {{ config.coverStyle.titleFontFamily }} / 
            {{ config.coverStyle.titleFontSize }}px
          </a-descriptions-item>
          
          <a-descriptions-item label="副标题文字">
            {{ config.coverStyle.subtitleText || '(未设置)' }}
          </a-descriptions-item>
          
          <a-descriptions-item label="遮罩">
            {{ config.coverStyle.maskEnabled ? '启用' : '禁用' }}
          </a-descriptions-item>
        </a-descriptions>
        
        <div class="preview-actions">
          <a-space>
            <a-button type="primary" @click="handleGenerate" :loading="generating">
              {{ previewImage ? '重新生成' : '生成预览' }}
            </a-button>
            <a-button v-if="previewImage" @click="handleDownload">
              下载预览
            </a-button>
            <a-button v-if="previewImage" @click="handleClear">
              清除预览
            </a-button>
          </a-space>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface CoverConfig {
  templateId?: string;
  coverStyle: any;
}

const props = defineProps<{
  config: CoverConfig;
  videoPath: string;
}>();

const emit = defineEmits<{
  'generate': [];
}>();

// 预览图片
const previewImage = ref<string>('');

// 生成中状态
const generating = ref(false);

// 生成预览
const handleGenerate = async () => {
  generating.value = true;
  
  try {
    // TODO: 调用后端生成预览
    // const result = await window.$mapi.ipAgent.generateCoverPreview({
    //   videoPath: props.videoPath,
    //   coverStyle: props.config.coverStyle
    // });
    
    // if (result.success) {
    //   previewImage.value = result.previewPath;
    // }
    
    // 临时：模拟生成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    emit('generate');
  } catch (error) {
    console.error('生成预览失败:', error);
  } finally {
    generating.value = false;
  }
};

// 下载预览
const handleDownload = () => {
  if (!previewImage.value) return;
  
  const link = document.createElement('a');
  link.href = previewImage.value;
  link.download = `cover_preview_${Date.now()}.jpg`;
  link.click();
};

// 清除预览
const handleClear = () => {
  previewImage.value = '';
};
</script>

<style scoped lang="less">
.cover-preview-panel {
  padding: 16px;
  
  .preview-container {
    display: flex;
    gap: 24px;
    
    .preview-area {
      flex: 1;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      
      .preview-image {
        max-width: 100%;
        max-height: 600px;
        
        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
      }
    }
    
    .preview-info {
      width: 350px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      
      .preview-actions {
        margin-top: auto;
      }
    }
  }
}

@media (max-width: 1200px) {
  .cover-preview-panel {
    .preview-container {
      flex-direction: column;
      
      .preview-info {
        width: 100%;
      }
    }
  }
}
</style>