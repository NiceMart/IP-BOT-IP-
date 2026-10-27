<template>
  <div class="line-style-editor">
    <!-- ========== 字体配置 ========== -->
    <div class="style-section">
      <div class="section-title">字体设置</div>

      <!-- 字体选择 -->
      <div class="style-item">
        <div class="label">字体：</div>
        <a-select
          v-model="lineStyle.fontName"
          @change="onFontChange"
          class="font-select"
          :loading="fontsLoading"
        >
          <!-- 系统字体 -->
          <a-optgroup label="系统字体">
            <a-option
              v-for="font in systemFonts"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </a-option>
          </a-optgroup>

          <!-- 自定义字体 -->
          <a-optgroup label="自定义字体">
            <a-option
              v-for="font in customFonts"
              :key="font.value"
              :value="font.value"
            >
              {{ font.label }}
            </a-option>
          </a-optgroup>
        </a-select>
      </div>

      <!-- 字体大小 -->
      <div class="style-item">
        <div class="label">字体大小：</div>
        <a-input-number
          v-model="lineStyle.fontSize"
          :min="24"
          :max="120"
          :step="2"
          @change="onChange"
        />
        <span class="unit">像素</span>
      </div>
    </div>

    <!-- ========== 颜色配置 ========== -->
    <div class="style-section">
      <div class="section-title">颜色设置</div>

      <!-- 文字颜色 -->
      <div class="style-item">
        <div class="label">文字颜色：</div>
        <div class="color-picker-wrapper">
          <input
            type="color"
            v-model="lineStyle.fontColor"
            @change="onChange"
            class="color-input"
          />
          <span class="color-value">{{ lineStyle.fontColor }}</span>
        </div>
      </div>
    </div>

    <!-- ========== 描边设置 ========== -->
    <div class="style-section">
      <div class="section-title">描边设置</div>

      <div class="style-item">
        <div class="label">描边宽度：</div>
        <a-slider
          v-model="lineStyle.outlineWidth"
          :min="0"
          :max="10"
          :marks="{ 0: '无', 3: '默认', 10: '最粗' }"
          @change="onChange"
        />
      </div>

      <div class="style-item" v-if="lineStyle.outlineWidth > 0">
        <div class="label">描边颜色：</div>
        <div class="color-picker-wrapper">
          <input
            type="color"
            v-model="lineStyle.outlineColor"
            @change="onChange"
            class="color-input"
          />
          <span class="color-value">{{ lineStyle.outlineColor }}</span>
        </div>
      </div>
    </div>

    <!-- ========== 背景设置 ========== -->
    <div class="style-section">
      <div class="section-title">背景设置</div>

      <div class="style-item">
        <a-checkbox
          :checked="lineStyle.backgroundColor !== 'transparent'"
          @change="onBackgroundToggle"
          class="force-light-checkbox"
        >
          <span style="color: #1d2129; font-weight: 500;">启用背景</span>
        </a-checkbox>
      </div>

      <template v-if="lineStyle.backgroundColor !== 'transparent'">
        <div class="style-item">
          <div class="label">背景颜色：</div>
          <div class="color-picker-wrapper">
            <input
              type="color"
              v-model="lineStyle.backgroundColor"
              @change="onChange"
              class="color-input"
            />
            <span class="color-value">{{ lineStyle.backgroundColor }}</span>
          </div>
        </div>

        <div class="style-item">
          <div class="label">背景透明度：</div>
          <a-slider
            v-model="lineStyle.backgroundOpacity"
            :min="0"
            :max="1"
            :step="0.1"
            :marks="{ 0: '全透明', 0.5: '半透明', 1: '不透明' }"
            @change="onChange"
          />
        </div>
      </template>
    </div>

    <!-- ========== 阴影设置（可选） ========== -->
    <div class="style-section">
      <div class="section-title">阴影设置（可选）</div>

      <div class="style-item">
        <a-checkbox
          :checked="!!lineStyle.shadowOffset && lineStyle.shadowOffset > 0"
          @change="onShadowToggle"
          class="force-light-checkbox"
        >
          <span style="color: #1d2129; font-weight: 500;">启用阴影</span>
        </a-checkbox>
      </div>

      <template v-if="lineStyle.shadowOffset && lineStyle.shadowOffset > 0">
        <div class="style-item">
          <div class="label">阴影偏移：</div>
          <a-slider
            v-model="lineStyle.shadowOffset"
            :min="1"
            :max="10"
            @change="onChange"
          />
        </div>

        <div class="style-item">
          <div class="label">阴影颜色：</div>
          <div class="color-picker-wrapper">
            <input
              type="color"
              v-model="lineStyle.shadowColor"
              @change="onChange"
              class="color-input"
            />
            <span class="color-value">{{ lineStyle.shadowColor || '#000000' }}</span>
          </div>
        </div>
      </template>
    </div>

    <!-- ========== 预览区 ========== -->
    <div class="style-section">
      <div class="section-title">效果预览</div>
      <div
        class="preview-text"
        :style="previewStyle"
      >
        {{ lineStyle.text || '示例文本' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { TitleSubtitleLine } from '@/types/smartSubtitle';
import { getFontPath } from '@/lib/subtitle/TitleSubtitleUtils';
import { Message } from '@arco-design/web-vue';

const props = defineProps<{
  modelValue: TitleSubtitleLine;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: TitleSubtitleLine): void;
  (e: 'change'): void;
}>();

const lineStyle = ref<TitleSubtitleLine>(props.modelValue);

// 🆕 字体列表相关状态
const availableFonts = ref<any[]>([]);
const fontsLoading = ref(true);

// 🆕 系统字体
const systemFonts = computed(() => availableFonts.value.filter(f => f.source === 'system'));

// 🆕 自定义字体 (ziti 和 custom 来源)
const customFonts = computed(() => availableFonts.value.filter(f => f.source === 'ziti' || f.source === 'custom'));

// 🆕 加载字体列表
const loadFonts = async () => {
  try {
    fontsLoading.value = true;
    if (!window.$mapi || !window.$mapi.fontManager) {
      console.warn('[LineStyleEditor] fontManager 不可用');
      return;
    }
    const result = await window.$mapi.fontManager.getAllFonts();
    if (result && result.success) {
      availableFonts.value = result.data || [];
      console.log('[LineStyleEditor] 加载字体列表成功:', availableFonts.value.length, '个字体');
    }
  } catch (error) {
    console.error('[LineStyleEditor] 加载字体列表失败:', error);
  } finally {
    fontsLoading.value = false;
  }
};

// 🆕 组件挂载时加载字体列表
onMounted(() => {
  loadFonts();
});

// 🆕 加载字体到浏览器（用于预览）
const loadFontForPreview = async (fontName: string) => {
  try {
    if (!fontName || typeof fontName !== 'string') {
      console.log('[LineStyleEditor] 字体名称无效:', fontName);
      return;
    }

    console.log('[LineStyleEditor] 尝试加载字体:', fontName);
    const fontInfo = availableFonts.value?.find(f => f?.value === fontName);
    
    if (!fontInfo) {
      console.log('[LineStyleEditor] 未找到字体信息:', fontName);
      return;
    }
    
    console.log('[LineStyleEditor] 找到字体信息:', { name: fontInfo.value, source: fontInfo.source });

    // 只有 ziti 或 custom 字体需要动态加载
    if ((fontInfo.source === 'ziti' || fontInfo.source === 'custom') && fontInfo.path) {
      const fontUrl = `font://${encodeURIComponent(fontInfo.path)}`;
      const styleId = `font-face-line-editor-${fontName.replace(/\s+/g, '-')}`;
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
        console.log('[LineStyleEditor] 创建新的style标签:', styleId);
      }

      styleEl.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
      `;
      console.log('[LineStyleEditor] ✅ 字体已加载:', fontName);
    } else {
      console.log('[LineStyleEditor] 系统字体无需加载:', fontName);
    }
  } catch (error) {
    console.error('[LineStyleEditor] ❌ 加载字体失败:', fontName, error);
  }
};

// 🆕 监听字体名称变化，自动加载字体
watch(() => lineStyle.value.fontName, async (newFontName) => {
  if (newFontName && availableFonts.value.length > 0) {
    await loadFontForPreview(newFontName);
  }
}, { immediate: true });

// 🆕 字体列表加载完成后，加载当前字体
watch(() => availableFonts.value.length, async (len) => {
  if (len > 0 && lineStyle.value.fontName) {
    await loadFontForPreview(lineStyle.value.fontName);
  }
});

// 预览样式计算
const previewStyle = computed(() => {
  let textShadow = 'none';

  if (lineStyle.value.outlineWidth > 0) {
    // 模拟描边效果
    const outlineOffsets = [];
    for (let x = -lineStyle.value.outlineWidth; x <= lineStyle.value.outlineWidth; x++) {
      for (let y = -lineStyle.value.outlineWidth; y <= lineStyle.value.outlineWidth; y++) {
        if (x !== 0 || y !== 0) {
          outlineOffsets.push(`${x}px ${y}px 0 ${lineStyle.value.outlineColor}`);
        }
      }
    }
    textShadow = outlineOffsets.join(', ');
  }

  const fontFamily = lineStyle.value.fontName ? `'${lineStyle.value.fontName}'` : 'Microsoft YaHei Bold';

  return {
    fontFamily,
    fontSize: lineStyle.value.fontSize + 'px',
    color: lineStyle.value.fontColor,
    backgroundColor: lineStyle.value.backgroundColor !== 'transparent'
      ? `${lineStyle.value.backgroundColor}${Math.floor(lineStyle.value.backgroundOpacity * 255).toString(16).padStart(2, '0')}`
      : 'transparent',
    textShadow,
    padding: '10px 20px'
  };
});

function onChange() {
  emit('update:modelValue', lineStyle.value);
  emit('change');
}

// 字体变化时更新字体路径
async function onFontChange() {
  try {
    const fontName = lineStyle.value.fontName;
    
    // ✅ 修复：从 availableFonts 中查找正确的字体路径
    const fontInfo = availableFonts.value.find(f => f.value === fontName);
    if (fontInfo && fontInfo.path) {
      lineStyle.value.fontPath = fontInfo.path;
      console.log('[LineStyleEditor] 从字体列表获取路径:', { fontName, fontPath: fontInfo.path });
    } else {
      // 回退：尝试使用 fontManager API 异步获取
      if (window.$mapi?.fontManager?.findFontPath) {
        const result = await window.$mapi.fontManager.findFontPath(fontName, 400);
        if (result && result.success && result.data) {
          lineStyle.value.fontPath = result.data;
          console.log('[LineStyleEditor] 从 fontManager API 获取路径:', { fontName, fontPath: result.data });
        } else {
          // 最终回退到同步方法
          lineStyle.value.fontPath = getFontPath(fontName);
          console.warn('[LineStyleEditor] 使用同步回退方法获取路径:', { fontName, fontPath: lineStyle.value.fontPath });
        }
      } else {
        lineStyle.value.fontPath = getFontPath(fontName);
      }
    }
    
    onChange();
  } catch (error) {
    Message.error('获取字体路径失败');
    console.error('[LineStyleEditor] 获取字体路径失败:', error);
  }
}


// 背景开关
function onBackgroundToggle(checked: boolean) {
  if (!checked) {
    lineStyle.value.backgroundColor = 'transparent';
    lineStyle.value.backgroundOpacity = 0;
  } else {
    lineStyle.value.backgroundColor = '#000000';
    lineStyle.value.backgroundOpacity = 0.8;
  }
  onChange();
}

// 阴影开关
function onShadowToggle(checked: boolean) {
  if (!checked) {
    lineStyle.value.shadowOffset = 0;
    lineStyle.value.shadowColor = undefined;
  } else {
    lineStyle.value.shadowOffset = 2;
    lineStyle.value.shadowColor = '#000000';
  }
  onChange();
}

watch(() => props.modelValue, (newValue) => {
  lineStyle.value = { ...newValue };
}, { deep: true });
</script>

<style scoped lang="scss">
.line-style-editor {
  padding: 16px;
  background: #f7f8fa;
  border-radius: 4px;

  .style-section {
    margin-bottom: 24px;
    padding: 12px;
    background: white;
    border-radius: 4px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #1d2129;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e6eb;
    }
  }

  .style-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    gap: 12px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      min-width: 90px;
      font-size: 13px;
      color: #4e5969;
    }

    .unit {
      margin-left: 8px;
      font-size: 12px;
      color: #86909c;
    }

    .font-select {
      min-width: 200px;
    }
  }

  .color-picker-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;

    .color-input {
      width: 48px;
      height: 32px;
      border-radius: 4px;
      border: 1px solid #e5e6eb;
      cursor: pointer;
      outline: none;

      &::-webkit-color-swatch-wrapper {
        padding: 2px;
      }

      &::-webkit-color-swatch {
        border-radius: 2px;
        border: none;
      }
    }

    .color-value {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #4e5969;
      text-transform: uppercase;
    }
  }

  .preview-text {
    display: inline-block;
    margin: 12px 0;
    max-width: 100%;
    word-break: break-all;
    border-radius: 4px;
    border: 2px dashed #e5e6eb;
  }
}
</style>

<style>
/* 强制显示浅色背景下的复选框边框 - 组件内直接定义确保生效 */
.line-style-editor .force-light-checkbox .arco-checkbox-icon {
  border: 1px solid #86909c !important; /* 灰色边框 */
  background-color: white !important;
}

.line-style-editor .force-light-checkbox:hover .arco-checkbox-icon {
  border-color: #165dff !important;
}

.line-style-editor .force-light-checkbox.arco-checkbox-checked .arco-checkbox-icon {
  background-color: #165dff !important;
  border-color: #165dff !important;
  color: white !important;
}

/* 确保勾选标记可见 */
.line-style-editor .force-light-checkbox.arco-checkbox-checked .arco-checkbox-icon svg {
  color: white !important;
  fill: white !important;
}
</style>
