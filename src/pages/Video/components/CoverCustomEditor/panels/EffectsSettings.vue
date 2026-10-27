<template>
  <div class="effects-settings">
    <a-collapse v-model:active-key="activeCollapse" :bordered="false">
      <!-- 标题背景 -->
      <a-collapse-item key="titleBackground" header="标题背景">
        <a-form layout="vertical">
          <a-form-item label="启用标题背景">
            <a-switch
              v-model="localTemplate.titleBackgroundEnabled"
              @change="handleUpdate"
            />
          </a-form-item>

          <template v-if="localTemplate.titleBackgroundEnabled">
            <a-form-item label="背景颜色">
              <a-color-picker
                v-model="localTemplate.titleBackgroundColor"
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="背景透明度">
              <a-slider
                v-model="localTemplate.titleBackgroundOpacity"
                :min="0"
                :max="100"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="背景形状">
              <a-select
                v-model="localTemplate.titleBackgroundShape"
                @change="handleUpdate"
              >
                <a-option value="rectangle">矩形</a-option>
                <a-option value="rounded">圆角矩形</a-option>
                <a-option value="polygon">多边形</a-option>
                <a-option value="bezier">贝塞尔曲线</a-option>
              </a-select>
            </a-form-item>

            <a-form-item label="背景大小">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="宽度">
                    <a-slider
                      v-model="localTemplate.titleBackgroundSize.width"
                      :min="10"
                      :max="80"
                      show-input
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="高度">
                    <a-slider
                      v-model="localTemplate.titleBackgroundSize.height"
                      :min="5"
                      :max="40"
                      show-input
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form-item>

            <a-form-item label="背景位置">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="X">
                    <a-slider
                      v-model="localTemplate.titleBackgroundPosition.x"
                      :min="5"
                      :max="95"
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="Y">
                    <a-slider
                      v-model="localTemplate.titleBackgroundPosition.y"
                      :min="5"
                      :max="95"
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form-item>

            <a-form-item v-if="localTemplate.titleBackgroundShape === 'rounded'" label="圆角半径">
              <a-slider
                v-model="localTemplate.titleBackgroundRadius"
                :min="0"
                :max="50"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="旋转角度">
              <a-slider
                v-model="localTemplate.titleBackgroundRotation"
                :min="-180"
                :max="180"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>
          </template>
        </a-form>
      </a-collapse-item>

      <!-- 副标题背景 -->
      <a-collapse-item key="subtitleBackground" header="副标题背景">
        <a-form layout="vertical">
          <a-form-item label="启用副标题背景">
            <a-switch
              v-model="localTemplate.subtitleBackgroundEnabled"
              @change="handleUpdate"
            />
          </a-form-item>

          <template v-if="localTemplate.subtitleBackgroundEnabled">
            <a-form-item label="背景颜色">
              <a-color-picker
                v-model="localTemplate.subtitleBackgroundColor"
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="背景透明度">
              <a-slider
                v-model="localTemplate.subtitleBackgroundOpacity"
                :min="0"
                :max="100"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="背景形状">
              <a-select
                v-model="localTemplate.subtitleBackgroundShape"
                @change="handleUpdate"
              >
                <a-option value="rectangle">矩形</a-option>
                <a-option value="rounded">圆角矩形</a-option>
                <a-option value="polygon">多边形</a-option>
                <a-option value="bezier">贝塞尔曲线</a-option>
              </a-select>
            </a-form-item>

            <a-form-item label="背景大小">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="宽度">
                    <a-slider
                      v-model="localTemplate.subtitleBackgroundSize.width"
                      :min="10"
                      :max="80"
                      show-input
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="高度">
                    <a-slider
                      v-model="localTemplate.subtitleBackgroundSize.height"
                      :min="5"
                      :max="40"
                      show-input
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form-item>

            <a-form-item label="背景位置">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="X">
                    <a-slider
                      v-model="localTemplate.subtitleBackgroundPosition.x"
                      :min="5"
                      :max="95"
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="Y">
                    <a-slider
                      v-model="localTemplate.subtitleBackgroundPosition.y"
                      :min="5"
                      :max="95"
                      @change="handleUpdate"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form-item>

            <a-form-item v-if="localTemplate.subtitleBackgroundShape === 'rounded'" label="圆角半径">
              <a-slider
                v-model="localTemplate.subtitleBackgroundRadius"
                :min="0"
                :max="50"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>

            <a-form-item label="旋转角度">
              <a-slider
                v-model="localTemplate.subtitleBackgroundRotation"
                :min="-180"
                :max="180"
                show-input
                @change="handleUpdate"
              />
            </a-form-item>
          </template>
        </a-form>
      </a-collapse-item>
    </a-collapse>
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

const activeCollapse = ref(['titleBackground', 'subtitleBackground']);
const localTemplate = ref({ ...props.template });

watch(() => props.template, (newTemplate) => {
  localTemplate.value = { ...newTemplate };
}, { deep: true });

const handleUpdate = () => {
  emit('update:template', localTemplate.value);
};
</script>

<style scoped>
.effects-settings {
  padding: 10px 0;
}

:deep(.arco-collapse-item-header) {
  font-weight: 500;
}

:deep(.arco-form-item) {
  margin-bottom: 16px;
}
</style>