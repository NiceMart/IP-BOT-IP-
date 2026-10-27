<template>
  <div class="basic-settings">
    <a-form layout="vertical">
      <a-form-item label="模板名称">
        <a-input
          v-model="localTemplate.name"
          placeholder="请输入模板名称"
          @input="handleUpdate"
        />
      </a-form-item>

      <a-form-item label="背景模糊">
        <a-space>
          <a-switch
            v-model="localTemplate.backgroundBlurEnabled"
            @change="handleUpdate"
          />
          <a-input-number
            v-if="localTemplate.backgroundBlurEnabled"
            v-model="localTemplate.backgroundBlurIntensity"
            :min="0"
            :max="100"
            :step="1"
            @input="handleUpdate"
          />
          <span v-if="localTemplate.backgroundBlurEnabled">px</span>
        </a-space>
      </a-form-item>

      <a-form-item label="人物描边">
        <a-space direction="vertical" fill>
          <a-switch
            v-model="localTemplate.personBorderEnabled"
            @change="handleUpdate"
          />
          <template v-if="localTemplate.personBorderEnabled">
            <a-select
              v-model="localTemplate.personBorderStyle"
              @change="handleUpdate"
            >
              <a-option value="solid">实线</a-option>
              <a-option value="dashed">虚线</a-option>
            </a-select>
            <a-color-picker
              v-model="localTemplate.personBorderColor"
              @change="handleUpdate"
            />
            <a-input-number
              v-model="localTemplate.personBorderWidth"
              :min="1"
              :max="10"
              :step="1"
              @input="handleUpdate"
            />
            <span>边框宽度: {{ localTemplate.personBorderWidth }}px</span>
            <template v-if="localTemplate.personBorderStyle === 'dashed'">
              <a-input-number
                v-model="localTemplate.personBorderDashLength"
                :min="5"
                :max="20"
                :step="1"
                @input="handleUpdate"
              />
              <span>虚线长度: {{ localTemplate.personBorderDashLength }}px</span>
              <a-input-number
                v-model="localTemplate.personBorderGapLength"
                :min="5"
                :max="20"
                :step="1"
                @input="handleUpdate"
              />
              <span>间隔长度: {{ localTemplate.personBorderGapLength }}px</span>
            </template>
          </template>
        </a-space>
      </a-form-item>

      <a-form-item label="自动拆分文字">
        <a-space direction="vertical" fill>
          <a-switch
            v-model="localTemplate.autoSplitText"
            @change="handleUpdate"
          />
          <template v-if="localTemplate.autoSplitText">
            <a-input-number
              v-model="localTemplate.titleMaxLength"
              :min="5"
              :max="50"
              @input="handleUpdate"
            />
            <span>标题最大长度: {{ localTemplate.titleMaxLength }}</span>
            <a-input-number
              v-model="localTemplate.subtitleMaxLength"
              :min="5"
              :max="100"
              @input="handleUpdate"
            />
            <span>副标题最大长度: {{ localTemplate.subtitleMaxLength }}</span>
          </template>
        </a-space>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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
</script>

<style scoped>
.basic-settings {
  padding: 10px 0;
}
</style>