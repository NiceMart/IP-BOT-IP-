<template>
  <div class="text-properties">
    <a-collapse v-model:active-key="activeCollapse" :bordered="false">
      <!-- 主标题设置 -->
      <a-collapse-item key="title" header="主标题设置">
        <a-form layout="vertical">
          <a-form-item label="标题文字">
            <a-textarea
              v-model="localTemplate.titleText"
              placeholder="请输入主标题"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              @input="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="字体">
            <a-select
              v-model="localTemplate.titleFontFamily"
              placeholder="选择字体"
              @change="handleUpdate"
            >
              <a-option value="SimHei">黑体</a-option>
              <a-option value="SimSun">宋体</a-option>
              <a-option value="Microsoft YaHei">微软雅黑</a-option>
              <a-option value="Microsoft YaHei Bold">微软雅黑粗体</a-option>
              <a-option value="KaiTi">楷体</a-option>
              <a-option value="FangSong">仿宋</a-option>
            </a-select>
          </a-form-item>

          <a-form-item label="字体大小">
            <a-slider
              v-model="localTemplate.titleFontSize"
              :min="24"
              :max="200"
              :step="2"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="字体粗细">
            <a-slider
              v-model="localTemplate.titleFontWeight"
              :min="100"
              :max="900"
              :step="100"
              show-input
              :marks="{
                400: '正常',
                700: '粗体',
                900: '特粗'
              }"
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="文字颜色">
            <a-color-picker
              v-model="localTemplate.titleColor"
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="描边">
            <a-space direction="vertical" fill>
              <a-switch
                v-model="titleStrokeEnabled"
                @change="handleTitleStrokeChange"
              />
              <template v-if="titleStrokeEnabled">
                <a-color-picker
                  v-model="localTemplate.titleStrokeColor"
                  @change="handleUpdate"
                />
                <a-slider
                  v-model="localTemplate.titleStrokeWidth"
                  :min="0"
                  :max="10"
                  :step="0.5"
                  show-input
                  @change="handleUpdate"
                />
              </template>
            </a-space>
          </a-form-item>

          <a-form-item label="阴影">
            <a-space direction="vertical" fill>
              <a-switch
                v-model="localTemplate.titleShadowEnabled"
                @change="handleUpdate"
              />
              <template v-if="localTemplate.titleShadowEnabled">
                <a-color-picker
                  v-model="localTemplate.titleShadowColor"
                  @change="handleUpdate"
                />
                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="X偏移">
                      <a-input-number
                        v-model="localTemplate.titleShadowOffsetX"
                        :min="-50"
                        :max="50"
                        @input="handleUpdate"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="Y偏移">
                      <a-input-number
                        v-model="localTemplate.titleShadowOffsetY"
                        :min="-50"
                        :max="50"
                        @input="handleUpdate"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-slider
                  v-model="localTemplate.titleShadowBlur"
                  :min="0"
                  :max="50"
                  show-input
                  @change="handleUpdate"
                />
              </template>
            </a-space>
          </a-form-item>

          <a-form-item label="文字方向">
            <a-select
              v-model="localTemplate.titleDirection"
              @change="handleUpdate"
            >
              <a-option value="horizontal">横向</a-option>
              <a-option value="vertical">竖向</a-option>
            </a-select>
          </a-form-item>

          <a-form-item label="字间距">
            <a-slider
              v-model="localTemplate.titleCharSpacing"
              :min="-50"
              :max="100"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="行间距">
            <a-slider
              v-model="localTemplate.titleLineSpacing"
              :min="50"
              :max="300"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="旋转角度">
            <a-slider
              v-model="localTemplate.titleRotation"
              :min="-180"
              :max="180"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>
        </a-form>
      </a-collapse-item>

      <!-- 副标题设置 -->
      <a-collapse-item key="subtitle" header="副标题设置">
        <a-form layout="vertical">
          <a-form-item label="副标题文字">
            <a-textarea
              v-model="localTemplate.subtitleText"
              placeholder="请输入副标题"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              @input="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="字体">
            <a-select
              v-model="localTemplate.subtitleFontFamily"
              placeholder="选择字体"
              @change="handleUpdate"
            >
              <a-option value="SimHei">黑体</a-option>
              <a-option value="SimSun">宋体</a-option>
              <a-option value="Microsoft YaHei">微软雅黑</a-option>
              <a-option value="Microsoft YaHei Bold">微软雅黑粗体</a-option>
              <a-option value="KaiTi">楷体</a-option>
              <a-option value="FangSong">仿宋</a-option>
            </a-select>
          </a-form-item>

          <a-form-item label="字体大小">
            <a-slider
              v-model="localTemplate.subtitleFontSize"
              :min="12"
              :max="100"
              :step="2"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="字体粗细">
            <a-slider
              v-model="localTemplate.subtitleFontWeight"
              :min="100"
              :max="900"
              :step="100"
              show-input
              :marks="{
                400: '正常',
                500: '中等',
                700: '粗体'
              }"
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="文字颜色">
            <a-color-picker
              v-model="localTemplate.subtitleColor"
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="描边">
            <a-space direction="vertical" fill>
              <a-switch
                v-model="subtitleStrokeEnabled"
                @change="handleSubtitleStrokeChange"
              />
              <template v-if="subtitleStrokeEnabled">
                <a-color-picker
                  v-model="localTemplate.subtitleStrokeColor"
                  @change="handleUpdate"
                />
                <a-slider
                  v-model="localTemplate.subtitleStrokeWidth"
                  :min="0"
                  :max="10"
                  :step="0.5"
                  show-input
                  @change="handleUpdate"
                />
              </template>
            </a-space>
          </a-form-item>

          <a-form-item label="阴影">
            <a-space direction="vertical" fill>
              <a-switch
                v-model="localTemplate.subtitleShadowEnabled"
                @change="handleUpdate"
              />
              <template v-if="localTemplate.subtitleShadowEnabled">
                <a-color-picker
                  v-model="localTemplate.subtitleShadowColor"
                  @change="handleUpdate"
                />
                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="X偏移">
                      <a-input-number
                        v-model="localTemplate.subtitleShadowOffsetX"
                        :min="-50"
                        :max="50"
                        @input="handleUpdate"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="Y偏移">
                      <a-input-number
                        v-model="localTemplate.subtitleShadowOffsetY"
                        :min="-50"
                        :max="50"
                        @input="handleUpdate"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
                <a-slider
                  v-model="localTemplate.subtitleShadowBlur"
                  :min="0"
                  :max="50"
                  show-input
                  @change="handleUpdate"
                />
              </template>
            </a-space>
          </a-form-item>

          <a-form-item label="文字方向">
            <a-select
              v-model="localTemplate.subtitleDirection"
              @change="handleUpdate"
            >
              <a-option value="horizontal">横向</a-option>
              <a-option value="vertical">竖向</a-option>
            </a-select>
          </a-form-item>

          <a-form-item label="字间距">
            <a-slider
              v-model="localTemplate.subtitleCharSpacing"
              :min="-50"
              :max="100"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="行间距">
            <a-slider
              v-model="localTemplate.subtitleLineSpacing"
              :min="30"
              :max="200"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>

          <a-form-item label="旋转角度">
            <a-slider
              v-model="localTemplate.subtitleRotation"
              :min="-180"
              :max="180"
              show-input
              @change="handleUpdate"
            />
          </a-form-item>
        </a-form>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { CoverTemplate } from '../../../../../declarations/app';

const props = defineProps<{
  template: CoverTemplate;
}>();

const emit = defineEmits<{
  (e: 'update:template', value: CoverTemplate): void;
}>();

const activeCollapse = ref(['title', 'subtitle']);
const localTemplate = ref({ ...props.template });

// 计算描边是否启用
const titleStrokeEnabled = computed({
  get: () => localTemplate.value.titleStrokeWidth > 0,
  set: (value) => {
    localTemplate.value.titleStrokeWidth = value ? 2 : 0;
    handleUpdate();
  }
});

const subtitleStrokeEnabled = computed({
  get: () => localTemplate.value.subtitleStrokeWidth > 0,
  set: (value) => {
    localTemplate.value.subtitleStrokeWidth = value ? 1 : 0;
    handleUpdate();
  }
});

watch(() => props.template, (newTemplate) => {
  localTemplate.value = { ...newTemplate };
}, { deep: true });

const handleUpdate = () => {
  emit('update:template', localTemplate.value);
};

const handleTitleStrokeChange = () => {
  if (titleStrokeEnabled.value && localTemplate.value.titleStrokeWidth === 0) {
    localTemplate.value.titleStrokeWidth = 2;
  }
  handleUpdate();
};

const handleSubtitleStrokeChange = () => {
  if (subtitleStrokeEnabled.value && localTemplate.value.subtitleStrokeWidth === 0) {
    localTemplate.value.subtitleStrokeWidth = 1;
  }
  handleUpdate();
};
</script>

<style scoped>
.text-properties {
  padding: 10px 0;
}

:deep(.arco-collapse-item-header) {
  font-weight: 500;
}

:deep(.arco-form-item) {
  margin-bottom: 16px;
}
</style>