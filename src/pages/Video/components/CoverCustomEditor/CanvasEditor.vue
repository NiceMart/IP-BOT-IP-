<template>
  <div class="canvas-editor">
    <div class="canvas-container" ref="canvasContainerRef">
      <div
        class="canvas"
        ref="canvasRef"
        :style="{
          width: CANVAS_WIDTH * CANVAS_SCALE + 'px',
          height: CANVAS_HEIGHT * CANVAS_SCALE + 'px',
        }"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
      >
        <!-- 背景层 -->
        <div
          class="layer background-layer"
          :class="{ active: activeLayer === 'background' }"
          :style="{
            zIndex: layerZIndex.background,
            opacity: template.backgroundEnabled ? 1 : 0.3,
          }"
          @mousedown="startDrag($event, 'background')"
        >
          <div
            class="background-image"
            :style="{
              width: template.backgroundSize + '%',
              height: template.backgroundSize + '%',
              left: (50 - template.backgroundSize / 2) + (template.backgroundPosition.x - 50) + '%',
              top: (50 - template.backgroundSize / 2) + (template.backgroundPosition.y - 50) + '%',
              transform: `scale(1)`,
              filter: template.backgroundBlurEnabled
                ? `blur(${template.backgroundBlurIntensity}px)`
                : 'none',
            }"
          >
            <img
              v-if="template.backgroundImagePath"
              :src="template.backgroundImagePath"
              alt="背景"
              class="bg-img"
            />
            <div v-else class="bg-placeholder">点击添加背景图</div>
          </div>
        </div>

        <!-- 人物层 -->
        <div
          class="layer person-layer"
          :class="{ active: activeLayer === 'person' }"
          :style="{
            zIndex: layerZIndex.person,
            left: template.personPosition.x + '%',
            top: template.personPosition.y + '%',
            transform: `translate(-50%, -50%) scale(${template.personSize / 100}) rotate(${template.personRotation}deg)`,
          }"
          @mousedown="startDrag($event, 'person')"
        >
          <div
            class="person-image"
            :class="{
              'border-solid': template.personBorderStyle === 'solid',
              'border-dashed': template.personBorderStyle === 'dashed',
            }"
            :style="{
              borderColor: template.personBorderColor,
              borderWidth: template.personBorderWidth + 'px',
              borderDashLength: template.personBorderDashLength + 'px',
              borderGapLength: template.personBorderGapLength + 'px',
            }"
          >
            <img
              v-if="template.personImagePath"
              :src="template.personImagePath"
              alt="人物"
              class="person-img"
            />
            <div v-else class="person-placeholder">点击添加人物图</div>
          </div>
        </div>

        <!-- 标题背景层 -->
        <div
          v-if="template.titleBackgroundEnabled"
          class="layer title-background-layer"
          :class="{ active: activeLayer === 'titleBackground' }"
          :style="{
            zIndex: layerZIndex.titleBackground,
            width: template.titleBackgroundSize.width + '%',
            height: template.titleBackgroundSize.height + '%',
            left: template.titleBackgroundPosition.x + '%',
            top: template.titleBackgroundPosition.y + '%',
            transform: `translate(-50%, -50%) rotate(${template.titleBackgroundRotation}deg)`,
            backgroundColor: hexToRgba(template.titleBackgroundColor, template.titleBackgroundOpacity / 100),
            borderRadius: template.titleBackgroundRadius + 'px',
          }"
          @mousedown="startDrag($event, 'titleBackground')"
        >
          <!-- 调整大小控制点 -->
          <div
            v-if="activeLayer === 'titleBackground'"
            class="resize-handle"
            data-handle="nw"
            @mousedown.stop="startDrag($event, 'titleBackground', 'nw')"
          ></div>
          <div
            v-if="activeLayer === 'titleBackground'"
            class="resize-handle"
            data-handle="ne"
            @mousedown.stop="startDrag($event, 'titleBackground', 'ne')"
          ></div>
          <div
            v-if="activeLayer === 'titleBackground'"
            class="resize-handle"
            data-handle="sw"
            @mousedown.stop="startDrag($event, 'titleBackground', 'sw')"
          ></div>
          <div
            v-if="activeLayer === 'titleBackground'"
            class="resize-handle"
            data-handle="se"
            @mousedown.stop="startDrag($event, 'titleBackground', 'se')"
          ></div>
        </div>

        <!-- 标题层 -->
        <div
          v-if="template.titleText"
          class="layer title-layer"
          :class="{ active: activeLayer === 'title' }"
          :style="{
            zIndex: layerZIndex.title,
            left: template.titlePosition.x + '%',
            top: template.titlePosition.y + '%',
            transform: `translate(-50%, -50%) rotate(${template.titleRotation}deg)`,
            fontSize: template.titleFontSize * CANVAS_SCALE + 'px',
            fontFamily: template.titleFontFamily,
            fontWeight: template.titleFontWeight,
            color: template.titleColor,
            WebkitTextStroke: `${template.titleStrokeWidth}px ${template.titleStrokeColor}`,
            textShadow: template.titleShadowEnabled
              ? `${template.titleShadowOffsetX}px ${template.titleShadowOffsetY}px ${template.titleShadowBlur}px ${template.titleShadowColor}`
              : 'none',
            letterSpacing: template.titleCharSpacing / 10 + 'px',
            lineHeight: template.titleLineSpacing / template.titleFontSize,
          }"
          @mousedown="startDrag($event, 'title')"
        >
          {{ template.titleText }}
        </div>

        <!-- 副标题背景层 -->
        <div
          v-if="template.subtitleBackgroundEnabled"
          class="layer subtitle-background-layer"
          :class="{ active: activeLayer === 'subtitleBackground' }"
          :style="{
            zIndex: layerZIndex.subtitleBackground,
            width: template.subtitleBackgroundSize.width + '%',
            height: template.subtitleBackgroundSize.height + '%',
            left: template.subtitleBackgroundPosition.x + '%',
            top: template.subtitleBackgroundPosition.y + '%',
            transform: `translate(-50%, -50%) rotate(${template.subtitleBackgroundRotation}deg)`,
            backgroundColor: hexToRgba(template.subtitleBackgroundColor, template.subtitleBackgroundOpacity / 100),
            borderRadius: template.subtitleBackgroundRadius + 'px',
          }"
          @mousedown="startDrag($event, 'subtitleBackground')"
        >
          <!-- 调整大小控制点 -->
          <div
            v-if="activeLayer === 'subtitleBackground'"
            class="resize-handle"
            data-handle="nw"
            @mousedown.stop="startDrag($event, 'subtitleBackground', 'nw')"
          ></div>
          <div
            v-if="activeLayer === 'subtitleBackground'"
            class="resize-handle"
            data-handle="ne"
            @mousedown.stop="startDrag($event, 'subtitleBackground', 'ne')"
          ></div>
          <div
            v-if="activeLayer === 'subtitleBackground'"
            class="resize-handle"
            data-handle="sw"
            @mousedown.stop="startDrag($event, 'subtitleBackground', 'sw')"
          ></div>
          <div
            v-if="activeLayer === 'subtitleBackground'"
            class="resize-handle"
            data-handle="se"
            @mousedown.stop="startDrag($event, 'subtitleBackground', 'se')"
          ></div>
        </div>

        <!-- 副标题层 -->
        <div
          v-if="template.subtitleText"
          class="layer subtitle-layer"
          :class="{ active: activeLayer === 'subtitle' }"
          :style="{
            zIndex: layerZIndex.subtitle,
            left: template.subtitlePosition.x + '%',
            top: template.subtitlePosition.y + '%',
            transform: `translate(-50%, -50%) rotate(${template.subtitleRotation}deg)`,
            fontSize: template.subtitleFontSize * CANVAS_SCALE + 'px',
            fontFamily: template.subtitleFontFamily,
            fontWeight: template.subtitleFontWeight,
            color: template.subtitleColor,
            WebkitTextStroke: `${template.subtitleStrokeWidth}px ${template.subtitleStrokeColor}`,
            textShadow: template.subtitleShadowEnabled
              ? `${template.subtitleShadowOffsetX}px ${template.subtitleShadowOffsetY}px ${template.subtitleShadowBlur}px ${template.subtitleShadowColor}`
              : 'none',
            letterSpacing: template.subtitleCharSpacing / 10 + 'px',
            lineHeight: template.subtitleLineSpacing / template.subtitleFontSize,
          }"
          @mousedown="startDrag($event, 'subtitle')"
        >
          {{ template.subtitleText }}
        </div>

        <!-- 蒙版层 -->
        <div
          v-if="template.maskEnabled"
          class="layer mask-layer"
          :class="{ active: activeLayer === 'mask' }"
          :style="{
            zIndex: layerZIndex.mask,
            width: template.maskSize + '%',
            height: template.maskSize + '%',
            left: template.maskPosition.x + '%',
            top: template.maskPosition.y + '%',
            transform: `translate(-50%, -50%)`,
            backgroundColor: template.maskColor,
            opacity: template.maskOpacity / 100,
            maskImage: template.maskImagePath ? `url(${template.maskImagePath})` : 'none',
            WebkitMaskImage: template.maskImagePath ? `url(${template.maskImagePath})` : 'none',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }"
          @mousedown="startDrag($event, 'mask')"
        >
          <div
            v-if="activeLayer === 'mask'"
            class="resize-handle"
            data-handle="se"
            @mousedown.stop="startDrag($event, 'mask', 'se')"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import type { CoverTemplate } from '../../../../declarations/app';

const props = defineProps<{
  template: CoverTemplate;
  activeLayer: string | null;
  canvasScale: number;
  canvasWidth: number;
  canvasHeight: number;
}>();

const emit = defineEmits<{
  (e: 'update:template', value: CoverTemplate): void;
  (e: 'update:activeLayer', value: string | null): void;
  (e: 'layer-activated', layerName: string): void;
}>();

// 画布引用
const canvasRef = ref<HTMLDivElement | null>(null);
const canvasContainerRef = ref<HTMLDivElement | null>(null);

// 拖拽状态
const draggingElement = ref<string | null>(null);
const dragStartPos = ref({ x: 0, y: 0 });
const elementStartPos = ref({ x: 0, y: 0 });
const elementStartSize = ref<number | {width: number; height: number}>(0);
const resizeHandle = ref<string | null>(null);

// 图层 z-index 管理
const layerZIndex = reactive({
  background: 10,
  titleBackground: 20,
  subtitleBackground: 30,
  person: 40,
  title: 50,
  subtitle: 60,
  mask: 70
});
const maxZIndex = ref(70);

// RAF ID
const rafId = ref<number | null>(null);

// 可拖拽的元素类型
type DraggableElement = 'person' | 'background' | 'title' | 'subtitle' | 'mask' | 'titleBackground' | 'subtitleBackground';
type ResizableElement = 'person' | 'background' | 'mask' | 'titleBackground' | 'subtitleBackground';

// 🚀 优化：颜色缓存（避免重复计算）
const colorCache = new Map<string, string>();

// 工具函数 - 添加缓存优化
const hexToRgba = (hex: string, alpha: number): string => {
  // 创建缓存key
  const cacheKey = `${hex}-${alpha}`;

  // 如果缓存中有，直接返回
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey)!;
  }

  // 否则计算并缓存
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const result = `rgba(${r}, ${g}, ${b}, ${alpha})`;

  colorCache.set(cacheKey, result);

  // 限制缓存大小，防止内存泄漏
  if (colorCache.size > 100) {
    const firstKey = colorCache.keys().next().value;
    colorCache.delete(firstKey);
  }

  return result;
};

// 开始拖拽
const startDrag = (e: MouseEvent, elementType: DraggableElement, handle?: string) => {
  e.preventDefault();
  e.stopPropagation();

  draggingElement.value = elementType;
  resizeHandle.value = handle || null;
  dragStartPos.value = { x: e.clientX, y: e.clientY };

  emit('layer-activated', elementType);

  // 记录元素初始位置
  switch (elementType) {
    case 'person':
      elementStartPos.value = { ...props.template.personPosition };
      elementStartSize.value = props.template.personSize;
      break;
    case 'background':
      elementStartPos.value = { ...props.template.backgroundPosition };
      elementStartSize.value = props.template.backgroundSize;
      break;
    case 'title':
      elementStartPos.value = { ...props.template.titlePosition };
      break;
    case 'subtitle':
      elementStartPos.value = { ...props.template.subtitlePosition };
      break;
    case 'mask':
      elementStartPos.value = { ...props.template.maskPosition };
      elementStartSize.value = props.template.maskSize;
      break;
    case 'titleBackground':
      elementStartPos.value = { ...props.template.titleBackgroundPosition };
      elementStartSize.value = { ...props.template.titleBackgroundSize };
      break;
    case 'subtitleBackground':
      elementStartPos.value = { ...props.template.subtitleBackgroundPosition };
      elementStartSize.value = { ...props.template.subtitleBackgroundSize };
      break;
  }
};

// 处理拖拽移动
const handleCanvasMouseMove = (e: MouseEvent) => {
  if (!draggingElement.value || !canvasRef.value) return;

  // 使用 requestAnimationFrame 优化性能
  if (rafId.value) {
    cancelAnimationFrame(rafId.value);
  }

  rafId.value = requestAnimationFrame(() => {
    const rect = canvasRef.value!.getBoundingClientRect();
    const deltaX = e.clientX - dragStartPos.value.x;
    const deltaY = e.clientY - dragStartPos.value.y;

    const newTemplate = { ...props.template };

    if (resizeHandle.value) {
      // 调整大小
      handleResize(deltaX, deltaY, newTemplate);
    } else {
      // 移动位置
      handleMove(deltaX, deltaY, newTemplate);
    }

    emit('update:template', newTemplate);
  });
};

// 处理移动
const handleMove = (deltaX: number, deltaY: number, template: CoverTemplate) => {
  const scale = props.canvasScale;
  const deltaXPercent = (deltaX / scale / props.canvasWidth) * 100;
  const deltaYPercent = (deltaY / scale / props.canvasHeight) * 100;

  switch (draggingElement.value) {
    case 'person':
      template.personPosition = {
        x: Math.max(0, Math.min(100, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(0, Math.min(100, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'background':
      template.backgroundPosition = {
        x: Math.max(0, Math.min(100, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(0, Math.min(100, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'title':
      template.titlePosition = {
        x: Math.max(5, Math.min(95, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(5, Math.min(95, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'subtitle':
      template.subtitlePosition = {
        x: Math.max(5, Math.min(95, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(5, Math.min(95, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'mask':
      template.maskPosition = {
        x: Math.max(0, Math.min(100, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(0, Math.min(100, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'titleBackground':
      template.titleBackgroundPosition = {
        x: Math.max(5, Math.min(95, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(5, Math.min(95, elementStartPos.value.y + deltaYPercent))
      };
      break;
    case 'subtitleBackground':
      template.subtitleBackgroundPosition = {
        x: Math.max(5, Math.min(95, elementStartPos.value.x + deltaXPercent)),
        y: Math.max(5, Math.min(95, elementStartPos.value.y + deltaYPercent))
      };
      break;
  }
};

// 处理调整大小
const handleResize = (deltaX: number, deltaY: number, template: CoverTemplate) => {
  const scale = props.canvasScale;
  const deltaWidthPercent = (deltaX / scale / props.canvasWidth) * 100;
  const deltaHeightPercent = (deltaY / scale / props.canvasHeight) * 100;

  switch (draggingElement.value) {
    case 'person':
      const personSizeDelta = Math.max(deltaWidthPercent, deltaHeightPercent);
      template.personSize = Math.max(10, Math.min(150,
        (elementStartSize.value as number) + personSizeDelta));
      break;
    case 'background':
      const backgroundSizeDelta = Math.max(deltaWidthPercent, deltaHeightPercent);
      template.backgroundSize = Math.max(50, Math.min(200,
        (elementStartSize.value as number) + backgroundSizeDelta));
      break;
    case 'mask':
      const maskSizeDelta = Math.max(deltaWidthPercent, deltaHeightPercent);
      template.maskSize = Math.max(10, Math.min(200,
        (elementStartSize.value as number) + maskSizeDelta));
      break;
    case 'titleBackground':
      const titleStartSize = elementStartSize.value as {width: number; height: number};
      template.titleBackgroundSize = {
        width: Math.max(10, Math.min(80, titleStartSize.width + deltaWidthPercent)),
        height: Math.max(5, Math.min(40, titleStartSize.height + deltaHeightPercent))
      };
      break;
    case 'subtitleBackground':
      const subtitleStartSize = elementStartSize.value as {width: number; height: number};
      template.subtitleBackgroundSize = {
        width: Math.max(10, Math.min(80, subtitleStartSize.width + deltaWidthPercent)),
        height: Math.max(5, Math.min(40, subtitleStartSize.height + deltaHeightPercent))
      };
      break;
  }
};

// 结束拖拽
const handleCanvasMouseUp = () => {
  draggingElement.value = null;
  resizeHandle.value = null;
  if (rafId.value) {
    cancelAnimationFrame(rafId.value);
    rafId.value = null;
  }
};

// 处理画布鼠标按下
const handleCanvasMouseDown = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    emit('update:activeLayer', null);
  }
};

// 清理
onBeforeUnmount(() => {
  if (rafId.value) {
    cancelAnimationFrame(rafId.value);
  }
});
</script>

<style scoped>
.canvas-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
}

.canvas {
  position: relative;
  background: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: grab;
}

.canvas:active {
  cursor: grabbing;
}

.layer {
  position: absolute;
  cursor: pointer;
  transition: opacity 0.2s;
}

.layer.active {
  outline: 2px dashed #409eff;
  outline-offset: 2px;
}

.background-layer,
.person-layer,
.title-background-layer,
.subtitle-background-layer {
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}

.bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bg-placeholder {
  color: #999;
  font-size: 14px;
}

.person-image {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
}

.person-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.border-solid {
  border-style: solid;
}

.border-dashed {
  border-style: dashed;
}

.person-placeholder {
  color: #999;
  font-size: 14px;
}

.title-layer,
.subtitle-layer {
  white-space: pre-wrap;
  text-align: center;
  user-select: none;
}

.title-background-layer,
.subtitle-background-layer {
  border-radius: 8px;
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid #409eff;
  border-radius: 50%;
  z-index: 10;
}

.resize-handle[data-handle="nw"] {
  top: -5px;
  left: -5px;
  cursor: nw-resize;
}

.resize-handle[data-handle="ne"] {
  top: -5px;
  right: -5px;
  cursor: ne-resize;
}

.resize-handle[data-handle="sw"] {
  bottom: -5px;
  left: -5px;
  cursor: sw-resize;
}

.resize-handle[data-handle="se"] {
  bottom: -5px;
  right: -5px;
  cursor: se-resize;
}

.mask-layer {
  border-radius: 8px;
}
</style>