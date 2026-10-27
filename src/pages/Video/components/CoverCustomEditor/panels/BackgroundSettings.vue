<template>
  <div class="background-settings">
    <a-form layout="vertical">
      <a-form-item label="背景图片">
        <a-space direction="vertical" fill style="width: 100%">
          <a-button @click="selectBackgroundImage">
            <template #icon>
              <icon-upload />
            </template>
            选择背景图片
          </a-button>
          <div v-if="localTemplate.backgroundImagePath" class="image-preview">
            <img
              :src="localTemplate.backgroundImagePath"
              alt="背景预览"
              class="preview-img"
            />
            <a-button
              type="text"
              status="danger"
              @click="removeBackgroundImage"
            >
              删除背景
            </a-button>
          </div>
        </a-space>
      </a-form-item>

      <a-form-item label="背景大小">
        <a-slider
          v-model="localTemplate.backgroundSize"
          :min="50"
          :max="200"
          :step="5"
          show-input
          @change="handleUpdate"
        />
      </a-form-item>

      <a-form-item label="背景位置">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="X">
              <a-slider
                v-model="localTemplate.backgroundPosition.x"
                :min="0"
                :max="100"
                :step="1"
                @change="handleUpdate"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Y">
              <a-slider
                v-model="localTemplate.backgroundPosition.y"
                :min="0"
                :max="100"
                :step="1"
                @change="handleUpdate"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form-item>

      <a-divider>人物设置</a-divider>

      <a-form-item label="人物图片">
        <a-space direction="vertical" fill style="width: 100%">
          <a-button @click="selectPersonImage">
            <template #icon>
              <icon-upload />
            </template>
            选择人物图片
          </a-button>
          <div v-if="localTemplate.personImagePath" class="image-preview">
            <img
              :src="localTemplate.personImagePath"
              alt="人物预览"
              class="preview-img"
            />
            <a-button
              type="text"
              status="danger"
              @click="removePersonImage"
            >
              删除人物
            </a-button>
          </div>
        </a-space>
      </a-form-item>

      <a-form-item label="人物大小">
        <a-slider
          v-model="localTemplate.personSize"
          :min="10"
          :max="150"
          :step="5"
          show-input
          @change="handleUpdate"
        />
      </a-form-item>

      <a-form-item label="人物位置">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="X">
              <a-slider
                v-model="localTemplate.personPosition.x"
                :min="0"
                :max="100"
                :step="1"
                @change="handleUpdate"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Y">
              <a-slider
                v-model="localTemplate.personPosition.y"
                :min="0"
                :max="100"
                :step="1"
                @change="handleUpdate"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form-item>

      <a-form-item label="人物旋转">
        <a-slider
          v-model="localTemplate.personRotation"
          :min="-180"
          :max="180"
          show-input
          @change="handleUpdate"
        />
      </a-form-item>

      <a-divider>蒙版设置</a-divider>

      <a-form-item label="启用蒙版">
        <a-switch
          v-model="localTemplate.maskEnabled"
          @change="handleUpdate"
        />
      </a-form-item>

      <template v-if="localTemplate.maskEnabled">
        <a-form-item label="蒙版图片">
          <a-space direction="vertical" fill style="width: 100%">
            <a-button @click="selectMaskImage">
              <template #icon>
                <icon-upload />
              </template>
              选择蒙版图片
            </a-button>
            <div v-if="localTemplate.maskImagePath" class="image-preview">
              <img
                :src="localTemplate.maskImagePath"
                alt="蒙版预览"
                class="preview-img"
              />
              <a-button
                type="text"
                status="danger"
                @click="removeMaskImage"
              >
                删除蒙版
              </a-button>
            </div>
          </a-space>
        </a-form-item>

        <a-form-item label="蒙版大小">
          <a-slider
            v-model="localTemplate.maskSize"
            :min="10"
            :max="200"
            :step="5"
            show-input
            @change="handleUpdate"
          />
        </a-form-item>

        <a-form-item label="蒙版位置">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="X">
                <a-slider
                  v-model="localTemplate.maskPosition.x"
                  :min="0"
                  :max="100"
                  :step="1"
                  @change="handleUpdate"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="Y">
                <a-slider
                  v-model="localTemplate.maskPosition.y"
                  :min="0"
                  :max="100"
                  :step="1"
                  @change="handleUpdate"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form-item>

        <a-form-item label="蒙版颜色">
          <a-color-picker
            v-model="localTemplate.maskColor"
            @change="handleUpdate"
          />
        </a-form-item>

        <a-form-item label="蒙版透明度">
          <a-slider
            v-model="localTemplate.maskOpacity"
            :min="0"
            :max="100"
            show-input
            @change="handleUpdate"
          />
        </a-form-item>
      </template>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconUpload } from '@arco-design/web-vue/es/icon';
import type { CoverTemplate } from '../../../../../declarations/app';

const props = defineProps<{
  template: CoverTemplate;
}>();

const emit = defineEmits<{
  (e: 'update:template', value: CoverTemplate): void;
}>();

const localTemplate = ref({ ...props.template });

watch(() => props.template, (newTemplate) => {
  localTemplate.value = { ...newTemplate };
}, { deep: true });

const handleUpdate = () => {
  emit('update:template', localTemplate.value);
};

const selectBackgroundImage = async () => {
  try {
    // 🔧 使用 window.ipcRenderer 代替 window.require('electron')
    if (typeof (window as any).ipcRenderer === 'undefined') {
      console.warn('⚠️ ipcRenderer 不可用');
      Message.error('应用接口不可用');
      return;
    }

    const ipcRenderer = (window as any).ipcRenderer;
    const result = await ipcRenderer.invoke('dialog:openFile', {
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ],
      properties: ['openFile']
    });

    if (result && !result.canceled && result.filePaths.length > 0) {
      localTemplate.value.backgroundImagePath = result.filePaths[0];
      handleUpdate();
    }
  } catch (error) {
    console.error('选择背景图片失败:', error);
    Message.error('选择背景图片失败');
  }
};

const removeBackgroundImage = () => {
  localTemplate.value.backgroundImagePath = undefined;
  handleUpdate();
};

const selectPersonImage = async () => {
  try {
    // 🔧 使用 window.ipcRenderer 代替 window.require('electron')
    if (typeof (window as any).ipcRenderer === 'undefined') {
      console.warn('⚠️ ipcRenderer 不可用');
      Message.error('应用接口不可用');
      return;
    }

    const ipcRenderer = (window as any).ipcRenderer;
    const result = await ipcRenderer.invoke('dialog:openFile', {
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ],
      properties: ['openFile']
    });

    if (result && !result.canceled && result.filePaths.length > 0) {
      localTemplate.value.personImagePath = result.filePaths[0];
      handleUpdate();
    }
  } catch (error) {
    console.error('选择人物图片失败:', error);
    Message.error('选择人物图片失败');
  }
};

const removePersonImage = () => {
  localTemplate.value.personImagePath = undefined;
  handleUpdate();
};

const selectMaskImage = async () => {
  try {
    // 🔧 使用 window.ipcRenderer 代替 window.require('electron')
    if (typeof (window as any).ipcRenderer === 'undefined') {
      console.warn('⚠️ ipcRenderer 不可用');
      Message.error('应用接口不可用');
      return;
    }

    const ipcRenderer = (window as any).ipcRenderer;
    const result = await ipcRenderer.invoke('dialog:openFile', {
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ],
      properties: ['openFile']
    });

    if (result && !result.canceled && result.filePaths.length > 0) {
      localTemplate.value.maskImagePath = result.filePaths[0];
      handleUpdate();
    }
  } catch (error) {
    console.error('选择蒙版图片失败:', error);
    Message.error('选择蒙版图片失败');
  }
};

const removeMaskImage = () => {
  localTemplate.value.maskImagePath = undefined;
  handleUpdate();
};
</script>

<style scoped>
.background-settings {
  padding: 10px 0;
}

.image-preview {
  margin-top: 10px;
  text-align: center;
}

.preview-img {
  max-width: 200px;
  max-height: 150px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-bottom: 8px;
}

:deep(.arco-form-item) {
  margin-bottom: 16px;
}
</style>