<script setup lang="ts">
// @ts-nocheck
import {ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import type {CoverTemplate} from "../../../declarations/app";
import {getCoverTemplate, saveCoverTemplate} from "../../../api/coverTemplate";  // ✅ 添加 saveCoverTemplate 导入
import {useDevMode} from "../../../composables/useDevMode";  // ✅ 添加开发模式检测

const props = defineProps<{
    visible: boolean;
    baseSettings: {
        backgroundBlurEnabled: boolean;
        backgroundBlurIntensity: number;
        personBorderEnabled: boolean;
        personBorderStyle: 'solid' | 'dashed';
        personBorderColor: string;
        personBorderWidth: number;
        personBorderDashLength?: number | null;
        personBorderGapLength?: number | null;
        autoSplitText: boolean;
        titleMaxLength: number;
        subtitleMaxLength: number;
    };
    referenceText?: string;  // 参考文本，用于自动拆分
    templateId?: string | null;  // 如果编辑已有模板，传入模板ID
    existingTemplate?: CoverTemplate | null;  // 如果编辑已有模板，传入模板数据
    initialTitleStyle?: any; // 初始标题样式（从字幕配置同步）
}>();

const emit = defineEmits<{
    (e: "update:visible", value: boolean): void;
    (e: "save", template: CoverTemplate): void;
    (e: "close"): void;
}>();

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit("update:visible", val)
});

// 画布尺寸（3:4比例）
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1440;  // 3:4 比例
const CANVAS_SCALE = 0.4;  // 预览缩放比例

// 当前编辑的模板配置
const template = reactive<CoverTemplate>({
    id: "",  // ✅ 添加 id 字段初始化（创建新模板时为空字符串）
    name: "",
    // 背景设置
    backgroundEnabled: true,  // 背景开启控制
    backgroundBlurEnabled: props.baseSettings.backgroundBlurEnabled,
    backgroundBlurIntensity: props.baseSettings.backgroundBlurIntensity,
    // 人物描边
    personBorderEnabled: props.baseSettings.personBorderEnabled,
    personBorderStyle: props.baseSettings.personBorderStyle,
    personBorderColor: props.baseSettings.personBorderColor,
    personBorderWidth: props.baseSettings.personBorderWidth,
    personBorderDashLength: props.baseSettings.personBorderDashLength,
    personBorderGapLength: props.baseSettings.personBorderGapLength,
    // 人像设置
    personSize: 80,  // 百分比
    personPosition: { x: 50, y: 50 },  // 百分比坐标
    personRotation: 0,  // 人像旋转角度（0-360度）
    // 背景设置
    backgroundSize: 100,  // 百分比
    backgroundPosition: { x: 50, y: 50 },  // 百分比坐标
    // 文字自动拆分
    autoSplitText: props.baseSettings.autoSplitText,
    titleMaxLength: props.baseSettings.titleMaxLength,
    subtitleMaxLength: props.baseSettings.subtitleMaxLength,
    // 主标题
    titleText: "",
    titleFontFamily: "SimHei",
    titleFontSize: 120,
    titleFontWeight: 700,
    titleColor: "#FFFFFF",
    titleStrokeColor: "#000000",
    titleStrokeWidth: 2,
    titleShadowColor: "#000000",
    titleShadowOffsetX: 0,
    titleShadowOffsetY: 0,
    titleShadowBlur: 0,
    titleShadowEnabled: false,
    titleShadowLayers: [],  // 多层阴影支持
    titlePosition: { x: 50, y: 80 },  // 百分比坐标
    titleRotation: 0,  // 文字旋转角度（0-360度）
    titleDirection: 'horizontal',
    titleCharSpacing: 24, // 默认字体大小的0.2倍
    titleLineSpacing: 144, // 默认字体大小的1.2倍
    titleMaxCharsPerLine: 10,
    // 主标题背景（独立位置和大小）
    titleBackgroundEnabled: false,
    titleBackgroundColor: "#000000",
    titleBackgroundOpacity: 70,
    titleBackgroundShape: 'rectangle' as 'rectangle' | 'rounded' | 'polygon' | 'bezier',
    titleBackgroundSize: { width: 30, height: 10 },  // 百分比（相对于画布）
    titleBackgroundPosition: { x: 50, y: 30 },  // 百分比坐标（相对于画布）
    titleBackgroundPoints: [] as Array<{x: number; y: number; handle1?: {x: number; y: number}; handle2?: {x: number; y: number}}>,
    titleBackgroundRadius: 10,
    titleBackgroundRotation: 0,  // 主标题背景旋转角度（0-360度）
    // 副标题
    subtitleText: "",
    subtitleFontFamily: "SimHei",
    subtitleFontSize: 60,
    subtitleFontWeight: 500,
    subtitleColor: "#FFFFFF",
    subtitleStrokeColor: "#000000",
    subtitleStrokeWidth: 1,
    subtitleShadowColor: "#000000",
    subtitleShadowOffsetX: 0,
    subtitleShadowOffsetY: 0,
    subtitleShadowBlur: 0,
    subtitleShadowEnabled: false,
    subtitleShadowLayers: [],  // 多层阴影支持
    subtitlePosition: { x: 50, y: 90 },  // 百分比坐标
    subtitleRotation: 0,  // 文字旋转角度（0-360度）
    subtitleDirection: 'horizontal',
    subtitleCharSpacing: 12, // 默认字体大小的0.2倍
    subtitleLineSpacing: 72, // 默认字体大小的1.2倍
    subtitleMaxCharsPerLine: 15,
    // 副标题背景（独立位置和大小）
    subtitleBackgroundEnabled: false,
    subtitleBackgroundColor: "#000000",
    subtitleBackgroundOpacity: 70,
    subtitleBackgroundShape: 'rectangle' as 'rectangle' | 'rounded' | 'polygon' | 'bezier',
    subtitleBackgroundSize: { width: 30, height: 10 },  // 百分比（相对于画布）
    subtitleBackgroundPosition: { x: 50, y: 60 },  // 百分比坐标（相对于画布）
    subtitleBackgroundPoints: [] as Array<{x: number; y: number; handle1?: {x: number; y: number}; handle2?: {x: number; y: number}}>,
    subtitleBackgroundRadius: 10,
    subtitleBackgroundRotation: 0,  // 副标题背景旋转角度（0-360度）
    // 蒙版
    maskEnabled: false,
    maskImagePath: undefined,
    maskSize: 100,
    maskPosition: { x: 50, y: 50 },
    maskColor: undefined,
    maskOpacity: 100,
    maskShape: 'rectangle',
});

// ✅ 初始化样式同步：如果是新建模板且有传入初始样式，应用字幕的样式配置
if (!props.existingTemplate && props.initialTitleStyle) {
    const style = props.initialTitleStyle;
    console.log('[CoverCustomEditor] Syncing initial style:', style);
    
    // 1. 同步背景颜色
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        template.titleBackgroundEnabled = true;
        template.titleBackgroundColor = style.backgroundColor;
        // 字幕透明度是0-1，封面是0-100
        template.titleBackgroundOpacity = (style.backgroundOpacity ?? 0.8) * 100;
    }
    
    // 2. 同步文字颜色
    if (style.fontColor) {
        template.titleColor = style.fontColor;
    }
    
    // 3. 同步描边颜色 (如果有描边宽度)
    if (style.outlineColor && style.outlineWidth > 0) {
        template.titleStrokeColor = style.outlineColor;
        // 简单映射宽度
        template.titleStrokeWidth = Math.max(1, style.outlineWidth);
    }
    
    // 4. 同步阴影
    if (style.shadowOffset && style.shadowOffset > 0) {
        template.titleShadowEnabled = true;
        template.titleShadowOffsetX = style.shadowOffset;
        template.titleShadowOffsetY = style.shadowOffset;
        if (style.shadowColor) {
            template.titleShadowColor = style.shadowColor;
        }
    }
    
    // 5. 同步字体（如果可用）
    if (style.fontName) {
        template.titleFontFamily = style.fontName;
    }
}

// 文字自动拆分
const splitText = (text: string, titleMaxLength: number, subtitleMaxLength: number): { title: string; subtitle: string } => {
    if (!text) return { title: '', subtitle: '' };
    const title = text.slice(0, titleMaxLength);
    const remaining = text.slice(titleMaxLength);
    const subtitle = remaining.slice(0, subtitleMaxLength);
    return { title, subtitle };
};

// 画布引用
const canvasRef = ref<HTMLDivElement | null>(null);
const canvasContainerRef = ref<HTMLDivElement | null>(null);
const paramsPanelRef = ref<HTMLDivElement | null>(null);

// 拖拽状态
const draggingElement = ref<string | null>(null);
const dragStartPos = ref({ x: 0, y: 0 });
const elementStartPos = ref({ x: 0, y: 0 });
const elementStartSize = ref<number | {width: number; height: number}>(0);  // 元素初始大小（可以是数字或对象）
const resizeHandle = ref<string | null>(null);  // 调整大小的控制点位置：'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'

// 图层 z-index 管理（使用更大的基础值，避免被其他元素覆盖）
const activeLayer = ref<string | null>(null);  // 当前激活的图层
const layerZIndex = reactive<Record<string, number>>({
    background: 10,
    titleBackground: 20,
    subtitleBackground: 30,
    person: 40,
    title: 50,
    subtitle: 60,
    mask: 70
});
const maxZIndex = ref(70);

// 激活图层（提升到最前，但背景始终保持在底层）
const activateLayer = (layerName: string) => {
    if (activeLayer.value === layerName) return;
    
    activeLayer.value = layerName;
    
    // 背景图层不提升 z-index，始终保持在最底层
    if (layerName === 'background') {
        console.log('[CoverCustomEditor] Background layer activated (z-index unchanged):', layerZIndex[layerName]);
        return;
    }
    
    maxZIndex.value++;
    layerZIndex[layerName] = maxZIndex.value;
    
    console.log('[CoverCustomEditor] Layer activated:', layerName, 'z-index:', layerZIndex[layerName]);
};

// 文字背景控制点编辑状态
const editingBackgroundPoint = ref<{textType: 'title' | 'subtitle', pointIndex: number} | null>(null);

// 可拖拽的元素类型
type DraggableElement = 'person' | 'background' | 'title' | 'subtitle' | 'mask' | 'titleBackground' | 'subtitleBackground';
type ResizableElement = 'person' | 'background' | 'mask' | 'titleBackground' | 'subtitleBackground';  // 可调整大小的元素

// 开始拖拽
const startDrag = (e: MouseEvent, elementType: DraggableElement, handle?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 激活当前图层
    activateLayer(elementType);

    // 如果是调整大小控制点
    if (handle) {
        resizeHandle.value = handle;
        draggingElement.value = elementType;
    } else {
        resizeHandle.value = null;
        draggingElement.value = elementType;
    }

    // ✅ 修复：使用canvasRef的rect，与onDrag保持一致
    const canvasRect = canvasRef.value?.getBoundingClientRect();
    if (canvasRect) {
        dragStartPos.value = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top
        };
        // 获取元素当前位置和大小
        if (elementType === 'person') {
            elementStartPos.value = { ...template.personPosition };
            elementStartSize.value = template.personSize;
        } else if (elementType === 'background') {
            elementStartPos.value = { ...template.backgroundPosition };
            elementStartSize.value = template.backgroundSize;
        } else if (elementType === 'title') {
            elementStartPos.value = { ...template.titlePosition };
        } else if (elementType === 'subtitle') {
            elementStartPos.value = { ...template.subtitlePosition };
        } else if (elementType === 'mask') {
            elementStartPos.value = { ...template.maskPosition };
            elementStartSize.value = template.maskSize;
        } else if (elementType === 'titleBackground') {
            elementStartPos.value = { ...template.titleBackgroundPosition };
            elementStartSize.value = { ...template.titleBackgroundSize }; // 保存完整的size对象
        } else if (elementType === 'subtitleBackground') {
            elementStartPos.value = { ...template.subtitleBackgroundPosition };
            elementStartSize.value = { ...template.subtitleBackgroundSize }; // 保存完整的size对象
        }
    }
};

// 开始拖拽文字背景控制点
const startDragBackgroundPoint = (e: MouseEvent, textType: 'title' | 'subtitle', pointIndex: number, handleType?: 'handle1' | 'handle2') => {
    // 只处理左键点击
    if (e.button !== 0 && e.button !== undefined) {
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    editingBackgroundPoint.value = { textType, pointIndex };

    // ✅ 修复：使用canvasRef的rect，与onDrag保持一致
    const canvasRect = canvasRef.value?.getBoundingClientRect();
    if (canvasRect) {
        dragStartPos.value = {
            x: e.clientX - canvasRect.left,
            y: e.clientY - canvasRect.top
        };
    }
};

// RAF ID 节流优化
let dragRafId: number | null = null;

// 拖拽中 - 添加RAF节流优化
const onDrag = (e: MouseEvent) => {
    // 如果已经有pending的RAF，取消它
    if (dragRafId) {
        cancelAnimationFrame(dragRafId);
    }

    // 使用RAF节流，限制为屏幕刷新率
    dragRafId = requestAnimationFrame(() => {
        // 检查鼠标是否在参数面板上，如果是则停止拖拽
        if (paramsPanelRef.value) {
            const panelRect = paramsPanelRef.value.getBoundingClientRect();
            if (e.clientX >= panelRect.left && e.clientX <= panelRect.right &&
                e.clientY >= panelRect.top && e.clientY <= panelRect.bottom) {
                endDrag();
                dragRafId = null;
                return;
            }
        }

        if (!canvasContainerRef.value || !canvasRef.value) {
            dragRafId = null;
            return;
        }

        const canvasRect = canvasRef.value.getBoundingClientRect();

    // ✅ 修复：使用实际渲染的画布尺寸，而不是CSS定义的常数
    // canvasRef可能因为窗口大小等因素被压缩，需要使用实际的rect.width/height
    const canvasWidth = canvasRect.width;   // 实际渲染的宽
    const canvasHeight = canvasRect.height; // 实际渲染的高

    // 计算鼠标相对于画布的位置
    const currentX = e.clientX - canvasRect.left;
    const currentY = e.clientY - canvasRect.top;
    
    // 处理文字背景控制点拖拽（优化版，直接更新无延迟）
    if (editingBackgroundPoint.value) {
        const { textType, pointIndex } = editingBackgroundPoint.value;
        const bgPoints = textType === 'title' ? template.titleBackgroundPoints : template.subtitleBackgroundPoints;
        const bgSize = textType === 'title' ? template.titleBackgroundSize : template.subtitleBackgroundSize;
        const bgPos = textType === 'title' ? template.titleBackgroundPosition : template.subtitleBackgroundPosition;
        
        if (bgPoints && bgPoints[pointIndex]) {
            // 计算背景大小和中心位置
            const bgWidth = (bgSize.width / 100) * canvasWidth;
            const bgHeight = (bgSize.height / 100) * canvasHeight;
            const bgCenterX = (bgPos.x / 100) * canvasWidth;
            const bgCenterY = (bgPos.y / 100) * canvasHeight;
            
            // 计算控制点相对于背景中心的偏移（像素）
            const pointX = currentX - bgCenterX;
            const pointY = currentY - bgCenterY;
            
            // 转换为百分比坐标（相对于背景大小）
            // 不限制范围，允许拖到背景外
            const pointXPercent = (pointX / bgWidth) * 100;
            const pointYPercent = (pointY / bgHeight) * 100;
            
            // 直接更新控制点位置（无限制，允许任意位置）
            bgPoints[pointIndex].x = pointXPercent;
            bgPoints[pointIndex].y = pointYPercent;
        }
        
        return;
    }
    
    if (!draggingElement.value) return;
    
    // 如果是调整大小
    if (resizeHandle.value) {
        const deltaX = ((currentX - dragStartPos.value.x) / canvasWidth) * 100;
        const deltaY = ((currentY - dragStartPos.value.y) / canvasHeight) * 100;
        
        // 根据控制点位置调整大小和位置
        const handle = resizeHandle.value;
        
        // 对于titleBackground和subtitleBackground，需要调整width和height
        if (draggingElement.value === 'titleBackground' || draggingElement.value === 'subtitleBackground') {
            const startSize = elementStartSize.value as {width: number; height: number};
            
            let newWidth = startSize.width;
            let newHeight = startSize.height;
            let newX = elementStartPos.value.x;
            let newY = elementStartPos.value.y;
            
            if (handle.includes('e')) {  // 右侧
                newWidth = Math.max(10, Math.min(200, startSize.width + deltaX * 2));
            }
            if (handle.includes('w')) {  // 左侧
                newWidth = Math.max(10, Math.min(200, startSize.width - deltaX * 2));
                newX = elementStartPos.value.x + deltaX;
            }
            if (handle.includes('s')) {  // 下侧
                newHeight = Math.max(10, Math.min(200, startSize.height + deltaY * 2));
            }
            if (handle.includes('n')) {  // 上侧
                newHeight = Math.max(10, Math.min(200, startSize.height - deltaY * 2));
                newY = elementStartPos.value.y + deltaY;
            }
            
            if (draggingElement.value === 'titleBackground') {
                template.titleBackgroundSize = { width: newWidth, height: newHeight };
                // 背景允许超出边界
                template.titleBackgroundPosition = { x: newX, y: newY };
            } else {
                template.subtitleBackgroundSize = { width: newWidth, height: newHeight };
                // 背景允许超出边界
                template.subtitleBackgroundPosition = { x: newX, y: newY };
            }
        } else {
            // 对于其他元素（person, background, mask），使用单一size值
            let newSize = elementStartSize.value as number;
            let newX = elementStartPos.value.x;
            let newY = elementStartPos.value.y;
            
            if (handle.includes('e')) {  // 右侧
                newSize = Math.max(5, Math.min(100, (elementStartSize.value as number) + deltaX * 2));
            }
            if (handle.includes('w')) {  // 左侧
                newSize = Math.max(5, Math.min(100, (elementStartSize.value as number) - deltaX * 2));
                newX = elementStartPos.value.x + deltaX;
            }
            if (handle.includes('s')) {  // 下侧
                newSize = Math.max(5, Math.min(100, (elementStartSize.value as number) + deltaY * 2));
            }
            if (handle.includes('n')) {  // 上侧
                newSize = Math.max(5, Math.min(100, (elementStartSize.value as number) - deltaY * 2));
                newY = elementStartPos.value.y + deltaY;
            }
            
            // 应用调整
            if (draggingElement.value === 'person') {
                template.personSize = newSize;
                template.personPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
            } else if (draggingElement.value === 'background') {
                template.backgroundSize = newSize;
                template.backgroundPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
            } else if (draggingElement.value === 'mask') {
                template.maskSize = newSize;
                template.maskPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
            }
        }
    } else {
        // 普通拖拽（移动位置）
        const deltaX = ((currentX - dragStartPos.value.x) / canvasWidth) * 100;
        const deltaY = ((currentY - dragStartPos.value.y) / canvasHeight) * 100;

        // 计算新位置，不限制在0-100范围内，允许文字中心超出画布边界
        // 但对于有尺寸的元素（person, background, mask），仍然限制中心点在合理范围
        const newX = elementStartPos.value.x + deltaX;
        const newY = elementStartPos.value.y + deltaY;

        if (draggingElement.value === 'person') {
            // person有尺寸，应该限制范围
            template.personPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
        } else if (draggingElement.value === 'background') {
            // background有尺寸，应该限制范围
            template.backgroundPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
        } else if (draggingElement.value === 'title') {
            // 文字允许中心超出边界（只要部分可见）
            template.titlePosition = { x: newX, y: newY };
        } else if (draggingElement.value === 'subtitle') {
            // 文字允许中心超出边界（只要部分可见）
            template.subtitlePosition = { x: newX, y: newY };
        } else if (draggingElement.value === 'mask') {
            // mask有尺寸，应该限制范围
            template.maskPosition = { x: Math.max(0, Math.min(100, newX)), y: Math.max(0, Math.min(100, newY)) };
        } else if (draggingElement.value === 'titleBackground') {
            // 背景允许超出边界
            template.titleBackgroundPosition = { x: newX, y: newY };
        } else if (draggingElement.value === 'subtitleBackground') {
            // 背景允许超出边界
            template.subtitleBackgroundPosition = { x: newX, y: newY };
        }
    }

    // 清理RAF ID
    dragRafId = null;
    });
};

// 结束拖拽
const endDrag = () => {
    draggingElement.value = null;
    resizeHandle.value = null;
    editingBackgroundPoint.value = null;

    // 清理RAF ID（重要！防止内存泄漏）
    if (dragRafId) {
        cancelAnimationFrame(dragRafId);
        dragRafId = null;
    }
    
    // 立即重置鼠标样式（使用 !important 确保优先级）
    if (canvasContainerRef.value) {
        canvasContainerRef.value.style.cursor = '';
        canvasContainerRef.value.style.removeProperty('cursor');
    }
    if (canvasRef.value) {
        canvasRef.value.style.cursor = '';
        canvasRef.value.style.removeProperty('cursor');
    }
    // 强制重置 body 的鼠标样式
    document.body.style.cursor = '';
    document.body.style.removeProperty('cursor');
    document.body.style.userSelect = '';
    
    // 使用 requestAnimationFrame 确保样式立即生效
    requestAnimationFrame(() => {
        document.body.style.cursor = 'default';
    });
};

// 鼠标离开画布区域时立即重置
const onCanvasLeave = () => {
    if (draggingElement.value || editingBackgroundPoint.value) {
        endDrag();
    }
};

// 添加控制点（独立于文字位置）
const addBackgroundPoint = (textType: 'title' | 'subtitle', e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const bgPoints = textType === 'title' ? template.titleBackgroundPoints : template.subtitleBackgroundPoints;
    const bgSize = textType === 'title' ? template.titleBackgroundSize : template.subtitleBackgroundSize;
    const bgPos = textType === 'title' ? template.titleBackgroundPosition : template.subtitleBackgroundPosition;
    
    if (!bgPoints) {
        if (textType === 'title') {
            template.titleBackgroundPoints = [];
        } else {
            template.subtitleBackgroundPoints = [];
        }
    }
    
    const canvasRect = canvasRef.value?.getBoundingClientRect();
    if (canvasRect) {
        // ✅ 修复：使用实际渲染的画布尺寸，而不是CSS定义的常数
        const canvasWidth = canvasRect.width;   // 实际渲染的宽
        const canvasHeight = canvasRect.height; // 实际渲染的高
        const currentX = e.clientX - canvasRect.left;
        const currentY = e.clientY - canvasRect.top;

        // 计算背景中心位置
        const bgCenterX = (bgPos.x / 100) * canvasWidth;
        const bgCenterY = (bgPos.y / 100) * canvasHeight;
        const bgWidth = (bgSize.width / 100) * canvasWidth;
        const bgHeight = (bgSize.height / 100) * canvasHeight;
        
        // 计算控制点相对于背景中心的偏移（百分比）
        const pointX = currentX - bgCenterX;
        const pointY = currentY - bgCenterY;
        const pointXPercent = (pointX / bgWidth) * 100;
        const pointYPercent = (pointY / bgHeight) * 100;
        
        const newPoint = { x: pointXPercent, y: pointYPercent };
        if (textType === 'title') {
            if (!template.titleBackgroundPoints) {
                template.titleBackgroundPoints = [];
            }
            template.titleBackgroundPoints.push(newPoint);
        } else {
            if (!template.subtitleBackgroundPoints) {
                template.subtitleBackgroundPoints = [];
            }
            template.subtitleBackgroundPoints.push(newPoint);
        }
    }
};

// 删除控制点（仅右键）
const removeBackgroundPoint = (textType: 'title' | 'subtitle', pointIndex: number, e: MouseEvent) => {
    // 确保是右键点击
    if (e.button !== 2) {
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    const bgPoints = textType === 'title' ? template.titleBackgroundPoints : template.subtitleBackgroundPoints;
    if (bgPoints && bgPoints.length > 3) {  // 至少保留3个点
        if (textType === 'title' && template.titleBackgroundPoints) {
            template.titleBackgroundPoints.splice(pointIndex, 1);
        } else if (textType === 'subtitle' && template.subtitleBackgroundPoints) {
            template.subtitleBackgroundPoints.splice(pointIndex, 1);
        }
    }
};

// 监听鼠标事件
onMounted(() => {
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
});

onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    // 确保状态完全清理
    endDrag();
});

// 🚀 优化：布局缓存（避免重复计算）
const layoutCache = new Map<string, any>();

// 生成缓存key的辅助函数
const createLayoutKey = (params: any[]): string => {
    return params.map(p => JSON.stringify(p)).join('|');
};

// 计算元素在画布上的位置（像素）
// position 是中心点坐标（百分比）
const getElementStyle = (position: { x: number; y: number }, size: number = 0) => {
    const canvasWidth = CANVAS_WIDTH * CANVAS_SCALE;
    const canvasHeight = CANVAS_HEIGHT * CANVAS_SCALE;
    // position 是中心点
    const centerX = (position.x / 100) * canvasWidth;
    const centerY = (position.y / 100) * canvasHeight;
    
    if (size > 0) {
        // 有尺寸的元素（person, background, mask）：转换为左上角
        const elementWidth = (size / 100) * canvasWidth;
        const elementHeight = (size / 100) * canvasHeight;
        const left = centerX - elementWidth / 2;
        const top = centerY - elementHeight / 2;
        return {
            left: `${left}px`,
            top: `${top}px`,
            width: `${elementWidth}px`,
            height: `${elementHeight}px`,
        };
    } else {
        // 文字元素：直接使用中心点 + transform
        return {
            left: `${centerX}px`,
            top: `${centerY}px`,
            transform: 'translate(-50%, -50%)',
        };
    }
};

// 计算文字元素在画布上的位置，根据内容尺寸调整
// position 是中心点坐标（百分比）
// contentSize 是文字内容的实际尺寸 { width, height }
const getElementStyleWithSize = (position: { x: number; y: number }, contentSize: { width: number; height: number }) => {
    const canvasWidth = CANVAS_WIDTH * CANVAS_SCALE;
    const canvasHeight = CANVAS_HEIGHT * CANVAS_SCALE;
    // position 是中心点
    const centerX = (position.x / 100) * canvasWidth;
    const centerY = (position.y / 100) * canvasHeight;

    // 转换为左上角坐标，减去内容尺寸的一半
    const left = centerX - contentSize.width / 2;
    const top = centerY - contentSize.height / 2;

    return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${contentSize.width}px`,
        height: `${contentSize.height}px`,
    };
};

// 计算文字背景在画布上的位置和样式（独立位置，不依赖文字）
const getTextBackgroundStyle = (
    backgroundSize: { width: number; height: number },
    backgroundPosition: { x: number; y: number }
) => {
    const canvasWidth = CANVAS_WIDTH * CANVAS_SCALE;
    const canvasHeight = CANVAS_HEIGHT * CANVAS_SCALE;
    
    // 计算背景大小（百分比转换为像素）
    const bgWidth = (backgroundSize.width / 100) * canvasWidth;
    const bgHeight = (backgroundSize.height / 100) * canvasHeight;
    
    // 计算背景位置（相对于画布的百分比坐标）
    const left = (backgroundPosition.x / 100) * canvasWidth - bgWidth / 2;
    const top = (backgroundPosition.y / 100) * canvasHeight - bgHeight / 2;
    
    return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${bgWidth}px`,
        height: `${bgHeight}px`,
    };
};

// 计算文字背景控制点的绝对位置（独立于文字）- 添加缓存优化
const getBackgroundPointPosition = (
    backgroundSize: { width: number; height: number },
    backgroundPosition: { x: number; y: number },
    point: { x: number; y: number }
) => {
    // 创建缓存key
    const cacheKey = createLayoutKey([backgroundSize, backgroundPosition, point]);

    // 如果缓存中有，直接返回
    if (layoutCache.has(cacheKey)) {
        return layoutCache.get(cacheKey);
    }

    const canvasWidth = CANVAS_WIDTH * CANVAS_SCALE;
    const canvasHeight = CANVAS_HEIGHT * CANVAS_SCALE;

    // 计算背景大小
    const bgWidth = (backgroundSize.width / 100) * canvasWidth;
    const bgHeight = (backgroundSize.height / 100) * canvasHeight;

    // 计算背景中心位置
    const bgCenterX = (backgroundPosition.x / 100) * canvasWidth;
    const bgCenterY = (backgroundPosition.y / 100) * canvasHeight;

    // 计算控制点绝对位置（point.x和point.y是相对于背景中心的百分比）
    const pointX = bgCenterX + (point.x / 100) * bgWidth;
    const pointY = bgCenterY + (point.y / 100) * bgHeight;

    const result = { x: pointX, y: pointY };

    // 缓存结果
    layoutCache.set(cacheKey, result);

    // 限制缓存大小，防止内存泄漏
    if (layoutCache.size > 200) {
        const firstKey = layoutCache.keys().next().value;
        layoutCache.delete(firstKey);
    }

    return result;
};

// 计算多边形/贝塞尔曲线的clip-path
const getBackgroundClipPath = (
    backgroundShape: string,
    backgroundPoints: Array<{x: number; y: number; handle1?: {x: number; y: number}; handle2?: {x: number; y: number}}> | undefined,
    backgroundSize: { width: number; height: number }
) => {
    if (!backgroundPoints || !Array.isArray(backgroundPoints) || backgroundPoints.length === 0) {
        return 'none';
    }
    
    if (backgroundShape === 'polygon' && backgroundPoints.length >= 3) {
        // 多边形：将百分比坐标转换为clip-path格式
        // 控制点坐标是相对于背景中心的百分比，需要转换为相对于元素左上角的百分比
        const points = backgroundPoints.map(pt => {
            if (!pt) return '0% 0%';
            // 将相对于中心的百分比转换为相对于左上角的百分比（50%是中心）
            const x = 50 + pt.x;  // 50%是中心，加上偏移
            const y = 50 + pt.y;
            return `${x}% ${y}%`;
        }).join(', ');
        return `polygon(${points})`;
    } else if (backgroundShape === 'bezier' && backgroundPoints.length >= 2) {
        // 贝塞尔曲线：使用polygon近似（因为CSS clip-path不支持真正的贝塞尔曲线）
        // 实际应该在后端渲染时使用真正的贝塞尔曲线
        const points = backgroundPoints.map(pt => {
            if (!pt) return '0% 0%';
            const x = 50 + pt.x;
            const y = 50 + pt.y;
            return `${x}% ${y}%`;
        }).join(', ');
        return `polygon(${points})`;
    }
    return 'none';
};

// Convert hex color with opacity (0-100) to rgba format
const hexToRgba = (hexColor: string, opacity: number): string => {
    // Default to fully transparent if invalid
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
        return 'rgba(0, 0, 0, 0)';
    }

    // Parse hex color
    const hex = hexColor.substring(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Convert opacity from 0-100 to 0-1
    const alpha = Math.max(0, Math.min(100, opacity)) / 100;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 选择蒙版图片
const selectMaskImage = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            filters: [{name: t("图片文件"), extensions: ["png", "jpg", "jpeg", "gif", "webp"]}],
        });
        if (filePath) {
            template.maskImagePath = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("文件选择失败"));
    }
};

// 保存模板
// ✅ 修复：添加 async 关键字，因为函数内部使用了 await
const saveTemplate = async () => {
    if (!template.name.trim()) {
        Dialog.tipError(t("请输入模板名称"));
        return;
    }
    
    // 如果编辑已有模板，保留ID
    if (props.templateId && props.existingTemplate) {
        template.id = props.templateId;
    }
    
    // ✅ 修复：使用生成的标题来初始化 Canvas 预览
    // 如果传入了 referenceText（生成的标题），就用它来填充预览
    if (props.referenceText && !template.titleText) {
        const split = splitText(props.referenceText, template.titleMaxLength, template.subtitleMaxLength);
        template.titleText = split.title;
        template.subtitleText = split.subtitle;

        console.log('[CoverCustomEditor] 使用生成的标题初始化:', {
            reference: props.referenceText,
            title: template.titleText,
            subtitle: template.subtitleText
        });
    }
    
    // 深拷贝模板数据，确保所有字段都被保存
    const templateToSave = JSON.parse(JSON.stringify(template));

    // 转换为custom-template.ts格式，以便后端Python脚本使用
    // 🔧 关键：将所有背景字段平展在convertedTemplate中，后端期望的是平面结构
    const convertedTemplate = {
        ...templateToSave,  // 🔧 首先复制所有原始字段，这样背景点数据会被包含
        id: templateToSave.id || `template_${Date.now()}`,
        name: templateToSave.name,
        createdAt: new Date().toISOString(),
        background: {
            blurEnabled: templateToSave.backgroundBlurEnabled,
            blurRadius: templateToSave.backgroundBlurIntensity || 15
        },
        portrait: {
            strokeEnabled: templateToSave.personBorderEnabled,
            strokeType: templateToSave.personBorderStyle || 'solid',
            strokeColor: templateToSave.personBorderColor || '#FFD700',
            strokeWidth: templateToSave.personBorderWidth || 3,
            strokeDashPattern: templateToSave.personBorderStyle === 'dashed'
                ? [templateToSave.personBorderDashLength || 10, templateToSave.personBorderGapLength || 5]
                : [],
            size: { width: templateToSave.personSize, height: templateToSave.personSize * 1.4 },
            position: templateToSave.personPosition
        },
        titles: {
            main: {
                text: templateToSave.titleText || '',
                maxLength: templateToSave.titleMaxCharsPerLine || 4,
                fontSize: templateToSave.titleFontSize,
                fontFamily: templateToSave.titleFontFamily || 'SimHei',
                fontWeight: templateToSave.titleFontWeight,
                color: templateToSave.titleColor,
                strokeColor: templateToSave.titleStrokeColor,
                strokeWidth: templateToSave.titleStrokeWidth,
                shadowColor: templateToSave.titleShadowColor || '#000000',
                shadowOffsetX: templateToSave.titleShadowOffsetX || 0,
                shadowOffsetY: templateToSave.titleShadowOffsetY || 0,
                shadowBlur: templateToSave.titleShadowBlur || 0,
                shadowLayers: templateToSave.titleShadowLayers || [],
                position: templateToSave.titlePosition,
                direction: templateToSave.titleDirection || 'horizontal',
                charSpacing: templateToSave.titleCharSpacing,
                lineSpacing: templateToSave.titleLineSpacing
            },
            sub: {
                text: templateToSave.subtitleText || '',
                maxLength: templateToSave.subtitleMaxCharsPerLine || 3,
                fontSize: templateToSave.subtitleFontSize,
                fontFamily: templateToSave.subtitleFontFamily || 'SimHei',
                fontWeight: templateToSave.subtitleFontWeight,
                color: templateToSave.subtitleColor,
                strokeColor: templateToSave.subtitleStrokeColor,
                strokeWidth: templateToSave.subtitleStrokeWidth,
                shadowColor: templateToSave.subtitleShadowColor || '#000000',
                shadowOffsetX: templateToSave.subtitleShadowOffsetX || 0,
                shadowOffsetY: templateToSave.subtitleShadowOffsetY || 0,
                shadowBlur: templateToSave.subtitleShadowBlur || 0,
                shadowLayers: templateToSave.subtitleShadowLayers || [],
                position: templateToSave.subtitlePosition,
                direction: templateToSave.subtitleDirection || 'horizontal',
                charSpacing: templateToSave.subtitleCharSpacing,
                lineSpacing: templateToSave.subtitleLineSpacing
            }
        },
        mask: templateToSave.maskEnabled ? {
            imagePath: templateToSave.maskImagePath || '',
            size: { width: templateToSave.maskSize, height: templateToSave.maskSize },
            position: templateToSave.maskPosition,
            opacity: templateToSave.maskOpacity / 100,
            shape: templateToSave.maskShape || 'rectangle'
        } : undefined
    };

    console.log('[CoverCustomEditor] Saving template:', {
        name: convertedTemplate.name,
        id: convertedTemplate.id,
        hasTitleFontFamily: !!convertedTemplate.titles.main,
        hasTitleBackgroundEnabled: !!templateToSave.titleBackgroundEnabled,
        titleBackgroundShape: templateToSave.titleBackgroundShape,
        titleBackgroundPointsCount: templateToSave.titleBackgroundPoints?.length || 0,
        titleBackgroundPoints: templateToSave.titleBackgroundPoints,
        subtitleBackgroundShape: templateToSave.subtitleBackgroundShape,
        subtitleBackgroundPointsCount: templateToSave.subtitleBackgroundPoints?.length || 0,
        subtitleBackgroundPoints: templateToSave.subtitleBackgroundPoints,
        hasPersonSize: !!convertedTemplate.portrait.size,
        hasMask: !!convertedTemplate.mask,
        keys: Object.keys(convertedTemplate).length
    });

    // ✅ 修复：在 emit 前实际保存模板到数据库
    try {
        console.log('[CoverCustomEditor] 调用后端保存 API...');
        const savedId = await saveCoverTemplate(templateToSave);
        console.log('[CoverCustomEditor] ✅ 模板已保存到数据库，返回ID:', savedId);

        // 更新 templateToSave 的 ID（如果是新模板，ID 会由后端生成）
        if (savedId) {
            templateToSave.id = savedId;
        }
    } catch (saveError) {
        console.error('[CoverCustomEditor] ❌ 保存到数据库失败:', saveError);
        Dialog.tipError('保存模板失败：' + (saveError as Error).message);
        return;  // 保存失败，不关闭对话框
    }

    // 保存原始格式（用于UI编辑）和转换后的格式（用于生成）
    emit("save", {
        ...templateToSave,
        // 添加转换后的格式，供后端使用
        _converted: convertedTemplate
    });
    // emit close事件让父组件处理，父组件会通过改变 activeTab 来关闭对话框
    emit("close");
};

// 取消编辑
const cancelEdit = () => {
    emit("close");
    // 父组件会通过改变 activeTab 来关闭对话框，不需要手动设置 dialogVisible
};

// ✅ 修复：使用生成的标题来更新 Canvas 预览
const updateSplitText = () => {
    // 使用 referenceText（生成的标题）来更新预览
    if (props.referenceText && template.autoSplitText) {
        const split = splitText(props.referenceText, template.titleMaxLength, template.subtitleMaxLength);
        template.titleText = split.title;
        template.subtitleText = split.subtitle;
    } else if (props.referenceText) {
        template.titleText = props.referenceText;
        template.subtitleText = '';
    }
};

// 监听参考文本变化，实时自动拆分（如果启用自动拆分）
watch(() => props.referenceText, () => {
    updateSplitText();
}, { immediate: false });  // 不使用 immediate，避免在组件创建时立即调用

// 监听自动拆分设置和字数限制变化，实时重新拆分
watch([() => template.autoSplitText, () => template.titleMaxLength, () => template.subtitleMaxLength], () => {
    // ✅ 修复：当用户改变拆分设置时，重新更新预览
    updateSplitText();
}, { immediate: false });

// 加载现有模板
const loadTemplate = async () => {
    if (props.existingTemplate) {
        // 如果直接传入了模板数据，深拷贝以确保所有字段都被正确复制
        console.log('[CoverCustomEditor] Loading from existingTemplate:', {
            name: props.existingTemplate.name,
            id: props.existingTemplate.id,
            keys: Object.keys(props.existingTemplate).length
        });
        const templateCopy = JSON.parse(JSON.stringify(props.existingTemplate));
        Object.assign(template, templateCopy);

        console.log('[CoverCustomEditor] Template loaded:', {
            name: template.name,
            hasTitleFontFamily: !!template.titleFontFamily,
            hasTitleBackgroundEnabled: !!template.titleBackgroundEnabled,
            hasPersonSize: !!template.personSize
        });
        return;
    }

    // 创建新模板时，跳过数据库加载
    if (props.templateId === '__CREATE_NEW__') {
        console.log('[CoverCustomEditor] Creating new template with default values');
        return;
    }

    if (props.templateId && props.templateId !== '__CREATE_NEW__') {
        // 如果有模板ID且不是创建新模板标识，从数据库加载
        try {
            console.log('[CoverCustomEditor] Loading from templateId:', props.templateId);
            const loadedTemplate = await getCoverTemplate(props.templateId);
            console.log('[CoverCustomEditor] Template loaded from DB:', {
                name: loadedTemplate.name,
                keys: Object.keys(loadedTemplate).length,
                hasTitleColor: !!loadedTemplate.titleColor,
                hasTitlesObj: !!(loadedTemplate as any).titles
            });
            
            const templateCopy = JSON.parse(JSON.stringify(loadedTemplate));
            Object.assign(template, templateCopy);

            // 🔧 修复：如果从数据库加载的模板缺少扁平化字段（可能是保存时丢失了），尝试从嵌套结构中恢复
            // 这种情况通常发生在 saveTemplate 只保存了 config JSON 而没有正确展开所有字段时
            if (!template.titleColor && (loadedTemplate as any).titles) {
                console.log('[CoverCustomEditor] 检测到模板缺少扁平化字段，尝试从嵌套结构恢复...');
                restoreFromConverted(loadedTemplate);
            }
        } catch (error) {
            console.error('[CoverCustomEditor] 加载模板失败:', error);
            Dialog.tipError(t("加载模板失败"));
        }
    }
};

// 🔧 从嵌套的 saved 结构 (convertedTemplate) 恢复扁平化的编辑器状态
const restoreFromConverted = (converted: any) => {
    try {
        console.log('[CoverCustomEditor] Restoring from converted structure');
        
        // 恢复背景
        if (converted.background) {
            template.backgroundBlurEnabled = converted.background.blurEnabled;
            template.backgroundBlurIntensity = converted.background.blurRadius;
        }

        // 恢复人像
        if (converted.portrait) {
            template.personBorderEnabled = converted.portrait.strokeEnabled;
            template.personBorderStyle = converted.portrait.strokeType;
            template.personBorderColor = converted.portrait.strokeColor;
            template.personBorderWidth = converted.portrait.strokeWidth;
            if (converted.portrait.strokeDashPattern && converted.portrait.strokeDashPattern.length >= 2) {
                template.personBorderDashLength = converted.portrait.strokeDashPattern[0];
                template.personBorderGapLength = converted.portrait.strokeDashPattern[1];
            }
            if (converted.portrait.size) {
                template.personSize = typeof converted.portrait.size === 'number' ? converted.portrait.size : converted.portrait.size.width;
            }
            if (converted.portrait.position) {
                template.personPosition = converted.portrait.position;
            }
        }

        // 恢复标题
        if (converted.titles) {
            // 主标题
            if (converted.titles.main) {
                const main = converted.titles.main;
                template.titleText = main.text || t("主标题");
                template.titleFontSize = main.fontSize;
                template.titleFontFamily = main.fontFamily;
                template.titleFontWeight = main.fontWeight;
                template.titleColor = main.color;
                template.titleStrokeColor = main.strokeColor;
                template.titleStrokeWidth = main.strokeWidth;
                template.titleShadowColor = main.shadowColor;
                template.titleShadowOffsetX = main.shadowOffsetX;
                template.titleShadowOffsetY = main.shadowOffsetY;
                template.titleShadowBlur = main.shadowBlur;
                template.titlePosition = main.position;
                template.titleDirection = main.direction;
                template.titleCharSpacing = main.charSpacing;
                template.titleLineSpacing = main.lineSpacing;
                template.titleMaxCharsPerLine = main.maxLength;
            }

            // 副标题
            if (converted.titles.sub) {
                const sub = converted.titles.sub;
                template.subtitleText = sub.text || t("副标题");
                template.subtitleFontSize = sub.fontSize;
                template.subtitleFontFamily = sub.fontFamily;
                template.subtitleFontWeight = sub.fontWeight;
                template.subtitleColor = sub.color;
                template.subtitleStrokeColor = sub.strokeColor;
                template.subtitleStrokeWidth = sub.strokeWidth;
                template.subtitleShadowColor = sub.shadowColor;
                template.subtitleShadowOffsetX = sub.shadowOffsetX;
                template.subtitleShadowOffsetY = sub.shadowOffsetY;
                template.subtitleShadowBlur = sub.shadowBlur;
                template.subtitlePosition = sub.position;
                template.subtitleDirection = sub.direction;
                template.subtitleCharSpacing = sub.charSpacing;
                template.subtitleLineSpacing = sub.lineSpacing;
                template.subtitleMaxCharsPerLine = sub.maxLength;
            }
        }
        
        // 恢复蒙版
        if (converted.mask) {
            template.maskEnabled = true;
            template.maskImagePath = converted.mask.imagePath;
            template.maskSize = typeof converted.mask.size === 'number' ? converted.mask.size : converted.mask.size.width;
            template.maskPosition = converted.mask.position;
            template.maskOpacity = (converted.mask.opacity || 1) * 100;
            template.maskShape = converted.mask.shape;
        }

        console.log('[CoverCustomEditor] Restore complete:', {
            titleColor: template.titleColor,
            personSize: template.personSize
        });
    } catch (error) {
        console.error('[CoverCustomEditor] Failed to restore from converted:', error);
    }
};

// 存储字体监听的取消函数
let fontUnsubscribe: (() => void) | null = null;

// 监听对话框打开/关闭，加载模板
watch(() => props.visible, async (visible) => {
    if (visible) {
        // 停止所有正在进行的编辑操作
        endDrag();

        // 只有在没有现有模板或创建新模板时才重置为初始值
        if ((!props.existingTemplate && !props.templateId) || props.templateId === '__CREATE_NEW__') {
            // 重置模板为初始值
            const init = {
                name: "",
                backgroundEnabled: true,
                backgroundBlurEnabled: props.baseSettings.backgroundBlurEnabled,
                backgroundBlurIntensity: props.baseSettings.backgroundBlurIntensity,
                personBorderEnabled: props.baseSettings.personBorderEnabled,
                personBorderStyle: props.baseSettings.personBorderStyle,
                personBorderColor: props.baseSettings.personBorderColor,
                personBorderWidth: props.baseSettings.personBorderWidth,
                personBorderDashLength: props.baseSettings.personBorderDashLength,
                personBorderGapLength: props.baseSettings.personBorderGapLength,
                personSize: 80,
                personPosition: { x: 50, y: 50 },
                personRotation: 0,
                backgroundSize: 100,
                backgroundPosition: { x: 50, y: 50 },
                autoSplitText: props.baseSettings.autoSplitText,
                titleMaxLength: props.baseSettings.titleMaxLength,
                subtitleMaxLength: props.baseSettings.subtitleMaxLength,
                titleText: t("主标题"), // 🔧 默认显示主标题
                titleFontFamily: "SimHei",
                titleFontSize: 120,
                titleFontWeight: 700,
                titleColor: "#FFFFFF",
                titleStrokeColor: "#000000",
                titleStrokeWidth: 2,
                titlePosition: { x: 50, y: 80 },
                titleRotation: 0,
                titleDirection: 'horizontal',
                titleCharSpacing: 24,
                titleLineSpacing: 144,
                titleMaxCharsPerLine: 10,
                titleBackgroundEnabled: false,
                titleBackgroundColor: "#000000",
                titleBackgroundOpacity: 70,
                titleBackgroundShape: 'rectangle' as 'rectangle' | 'rounded' | 'polygon' | 'bezier',
                titleBackgroundSize: { width: 30, height: 10 },
                titleBackgroundPosition: { x: 50, y: 30 },
                titleBackgroundPoints: [],
                titleBackgroundRadius: 10,
                titleBackgroundRotation: 0,
                subtitleText: t("副标题"), // 🔧 默认显示副标题
                subtitleFontFamily: "SimHei",
                subtitleFontSize: 60,
                subtitleFontWeight: 500,
                subtitleColor: "#FFFFFF",
                subtitleStrokeColor: "#000000",
                subtitleStrokeWidth: 1,
                subtitlePosition: { x: 50, y: 90 },
                subtitleRotation: 0,
                subtitleDirection: 'horizontal',
                subtitleCharSpacing: 12,
                subtitleLineSpacing: 72,
                subtitleMaxCharsPerLine: 15,
                subtitleBackgroundEnabled: false,
                subtitleBackgroundColor: "#000000",
                subtitleBackgroundOpacity: 70,
                subtitleBackgroundShape: 'rectangle' as 'rectangle' | 'rounded' | 'polygon' | 'bezier',
                subtitleBackgroundSize: { width: 30, height: 10 },
                subtitleBackgroundPosition: { x: 50, y: 60 },
                subtitleBackgroundPoints: [],
                subtitleBackgroundRadius: 10,
                subtitleBackgroundRotation: 0,
                maskEnabled: false,
                maskImagePath: undefined,
                maskSize: 100,
                maskPosition: { x: 50, y: 50 },
                maskColor: undefined,
                maskOpacity: 100,
                maskShape: 'rectangle',
            };
            Object.assign(template, init);
        }
        
        // 加载现有模板（如果有）
        await loadTemplate();
        
        // 如果有参考文本且启用自动拆分，自动拆分文字
        updateSplitText();

        // 加载字体列表
        loadFonts();

        // 监听字体列表变更事件（避免嵌套watch）
        fontUnsubscribe = window.$mapi.fontManager.onFontsChanged(() => {
            console.log('[CoverCustomEditor] Fonts changed, reloading...');
            loadFonts();
        });

        // 🔧 优化：字体加载和预览刷新（合并第三个watch的功能）
        // 等待DOM渲染完成后再加载字体和刷新预览
        await nextTick();

        // 等待对话框的CSS过渡动画完成（a-modal的动画大约300ms）
        await new Promise(resolve => setTimeout(resolve, 350));

        // 确保字体列表已加载
        if (availableFonts.value.length === 0) {
            await loadFonts();
        }

        // 加载标题字体
        if (template.titleFontFamily) {
            await loadFontForPreview(template.titleFontFamily);
        }
        // 加载副标题字体
        if (template.subtitleFontFamily) {
            await loadFontForPreview(template.subtitleFontFamily);
        }

        // 优化：减少强制重新渲染的次数
        fontLoadKey.value++;
        await nextTick();

        // 最终确认渲染
        await new Promise(resolve => setTimeout(resolve, 50));
        fontLoadKey.value++;

        console.log('[CoverCustomEditor] 🎨 画布预览已完全加载和渲染');
    } else {
        // 对话框关闭时清理状态
        endDrag();

        // 取消字体监听
        if (fontUnsubscribe) {
            fontUnsubscribe();
            fontUnsubscribe = null;
        }
    }
}, { immediate: true });

// 监听existingTemplate变化，实时更新模板数据
watch(() => props.existingTemplate, (existing) => {
    if (existing && props.visible) {
        console.log('[CoverCustomEditor] existingTemplate changed, loading:', {
            name: existing.name,
            id: existing.id,
            hasTitleFontFamily: !!existing.titleFontFamily,
            hasTitleBackgroundEnabled: !!existing.titleBackgroundEnabled,
            hasPersonSize: !!existing.personSize,
            keys: Object.keys(existing).length
        });
        // 深拷贝以确保所有字段都被正确复制
        const templateCopy = JSON.parse(JSON.stringify(existing));
        Object.assign(template, templateCopy);

        console.log('[CoverCustomEditor] template updated:', {
            name: template.name,
            hasTitleFontFamily: !!template.titleFontFamily,
            hasTitleBackgroundEnabled: !!template.titleBackgroundEnabled,
            hasPersonSize: !!template.personSize
        });

        // 🔧 关键修复：加载模板后，检查并初始化多边形背景的顶点
        // 确保即使是加载已有的多边形模板，也能自动创建默认顶点并保存
        let needsSave = false;

        if (template.titleBackgroundShape === 'polygon' && (!template.titleBackgroundPoints || template.titleBackgroundPoints.length < 3)) {
            console.log('[CoverCustomEditor] 加载模板后检测到多边形背景缺少顶点，创建默认顶点');
            template.titleBackgroundPoints = [
                { x: -40, y: -40 },  // 左上
                { x: 40, y: -40 },   // 右上
                { x: 40, y: 40 },    // 右下
                { x: -40, y: 40 }    // 左下
            ];
            needsSave = true;
        }

        if (template.subtitleBackgroundShape === 'polygon' && (!template.subtitleBackgroundPoints || template.subtitleBackgroundPoints.length < 3)) {
            console.log('[CoverCustomEditor] 加载模板后检测到副标题多边形背景缺少顶点，创建默认顶点');
            template.subtitleBackgroundPoints = [
                { x: -40, y: -40 },  // 左上
                { x: 40, y: -40 },   // 右上
                { x: 40, y: 40 },    // 右下
                { x: -40, y: 40 }    // 左下
            ];
            needsSave = true;
        }

        // 🔧 关键：如果创建了默认顶点，自动保存模板以确保顶点被持久化到数据库
        if (needsSave && template.id) {
            console.log('[CoverCustomEditor] 自动保存模板以持久化多边形顶点');
            // 延迟保存，等待 Vue 响应性更新完成
            setTimeout(() => {
                saveTemplate();
            }, 100);
        }
    }
}, { deep: true, immediate: true });

// 获取可用字体列表（动态加载）
const availableFonts = ref<any[]>([
    // 预置字体 - 中文字体（默认值，会被动态加载覆盖）
    { value: "Noto Sans SC", label: "思源黑体简体", source: "bundled", category: "中文字体" },
    { value: "Noto Serif SC", label: "思源宋体简体", source: "bundled", category: "中文字体" },
    { value: "Noto Sans TC", label: "思源黑体繁体", source: "bundled", category: "中文字体" },
    { value: "Maoken Assorted Sans", label: "猫啃杂糅体", source: "bundled", category: "中文字体" },
    { value: "Maoken Assorted Sans Lite", label: "猫啃杂糅体 Lite", source: "bundled", category: "中文字体" },
    { value: "Mo Qu Gu Feng Ti", label: "墨趣古风体", source: "bundled", category: "中文字体" },
    { value: "PingFang Zhang Yaling Hei", label: "平方张亚玲黑方体", source: "bundled", category: "中文字体" },
    { value: "Hu Xiaobo Sao Bao Ti", label: "胡晓波骚包体", source: "bundled", category: "中文字体" },
    
    // 预置字体 - 英文无衬线
    { value: "Roboto", label: "Roboto", source: "bundled", category: "英文无衬线" },
    { value: "Open Sans", label: "Open Sans", source: "bundled", category: "英文无衬线" },
    { value: "Lato", label: "Lato", source: "bundled", category: "英文无衬线" },
    { value: "Montserrat", label: "Montserrat", source: "bundled", category: "英文无衬线" },
    { value: "Raleway", label: "Raleway", source: "bundled", category: "英文无衬线" },
    { value: "Poppins", label: "Poppins", source: "bundled", category: "英文无衬线" },
    { value: "Inter", label: "Inter", source: "bundled", category: "英文无衬线" },
    
    // 预置字体 - 英文衬线
    { value: "Playfair Display", label: "Playfair Display", source: "bundled", category: "英文衬线" },
    { value: "Merriweather", label: "Merriweather", source: "bundled", category: "英文衬线" },
    
    // 预置字体 - 显示字体
    { value: "Oswald", label: "Oswald", source: "bundled", category: "显示字体" },
    { value: "Bebas Neue", label: "Bebas Neue", source: "bundled", category: "显示字体" },
    
    // 预置字体 - 手写体
    { value: "Dymon ShouXieTi", label: "Dymon手写体", source: "bundled", category: "手写体" },
    
    // 预置字体 - 日文字体
    { value: "Murecho", label: "Murecho", source: "bundled", category: "日文字体" },
    { value: "Keinan Maru Pop JP", label: "けいなん丸ポップ体", source: "bundled", category: "日文字体" },
    
    // 系统字体
    { value: "SimHei", label: "黑体", source: "system", category: "系统字体" },
    { value: "SimSun", label: "宋体", source: "system", category: "系统字体" },
    { value: "Microsoft YaHei", label: "微软雅黑", source: "system", category: "系统字体" },
    { value: "Arial", label: "Arial", source: "system", category: "系统字体" },
    { value: "Times New Roman", label: "Times New Roman", source: "system", category: "系统字体" },
]);

// 加载字体列表
const loadFonts = async () => {
    try {
        const result = await window.$mapi.fontManager.getAllFonts();
        if (result.success && result.data) {
            availableFonts.value = result.data;
            console.log('[CoverCustomEditor] Loaded fonts:', availableFonts.value.length);
        }
    } catch (error) {
        console.error('[CoverCustomEditor] Failed to load fonts:', error);
    }
};

// 按分类分组字体
const groupedFonts = computed(() => {
    const groups: Record<string, any[]> = {};
    availableFonts.value.forEach(font => {
        const category = font.category || t("其他");
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(font);
    });
    return groups;
});

// 可折叠面板状态（默认全部折叠）
const collapsedSections = reactive<Record<string, boolean>>({
    basic: true,
    person: true,
    background: true,
    title: true,
    subtitle: true,
    mask: true
});

// 切换折叠状态
const toggleSection = (section: string) => {
    collapsedSections[section] = !collapsedSections[section];
};

// 动态加载字体到浏览器（用于画布预览）
const loadFontForPreview = async (fontName: string) => {
    if (!fontName) return;

    // 在字体列表中查找对应的字体信息
    const fontInfo = availableFonts.value.find(f => f.value === fontName);

    if (!fontInfo) {
        console.log('[CoverCustomEditor] loadFontForPreview - 未找到字体信息:', fontName);
        return;
    }

    // 只有 ziti 字体需要动态加载（因为可能有路径）
    if (fontInfo.source === 'ziti' && fontInfo.path) {
        try {
            console.log('[CoverCustomEditor] loadFontForPreview - 加载字体:', fontName, 'from:', fontInfo.path);

            // ✅ 修复：使用 font:// 自定义协议加载字体（支持打包环境）
            const fontUrl = `font://${encodeURIComponent(fontInfo.path)}`;

            // 创建 style 标签注入 @font-face
            const styleId = `font-face-preview-${fontName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
            let styleEl = document.getElementById(styleId) as HTMLStyleElement;

            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }

            // 使用 font:// 协议 URL（在开发和打包环境都有效）
            styleEl.textContent = `
                @font-face {
                    font-family: "${fontName}";
                    src: url("${fontUrl}");
                    font-display: swap;
                }
            `;

            console.log('[CoverCustomEditor] loadFontForPreview - Font face created with URL:', fontUrl);

            // 等待字体加载完成，并强制刷新缓存
            if (document.fonts && document.fonts.load) {
                const font = new FontFace(fontName, `url("${fontUrl}")`);
                await font.load();
                document.fonts.add(font);
                console.log('[CoverCustomEditor] loadFontForPreview - Font loaded and cached successfully:', fontName);
            }
        } catch (error) {
            console.error('[CoverCustomEditor] loadFontForPreview - Failed to load font:', fontName, error);
        }
    } else {
        console.log('[CoverCustomEditor] loadFontForPreview - 字体无需加载 (系统或预置字体):', fontName);
        // 即使是系统字体，也需要确保字体已加载到文档字体集合中
        if (document.fonts && document.fonts.check) {
            try {
                // 强制检查字体是否可用
                const isFontAvailable = document.fonts.check(`16px "${fontName}"`);
                console.log('[CoverCustomEditor] loadFontForPreview - System font availability:', fontName, isFontAvailable);
            } catch (e) {
                console.log('[CoverCustomEditor] loadFontForPreview - Font check failed:', fontName, e);
            }
        }
    }
};

// 字体加载状态（用于强制重新渲染）
const fontLoadKey = ref(0);

// 计算标题字体样式字符串
const titleFontFamilyStyle = computed(() => {
    const fontName = template.titleFontFamily || 'SimHei';
    return `"${fontName}", sans-serif`;
});

// 计算副标题字体样式字符串
const subtitleFontFamilyStyle = computed(() => {
    const fontName = template.subtitleFontFamily || 'SimHei';
    return `"${fontName}", sans-serif`;
});

// 将十六进制颜色转换为带透明度的rgba
const hexToRgbaWithOpacity = (hex: string, opacity: number) => {
    // 移除#号
    hex = hex.replace('#', '');

    // 解析RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

// 🚀 优化：使用ref缓存阴影样式，避免computed的重复计算
const titleTextShadowStyle = ref('none');
const subtitleTextShadowStyle = ref('none');

// 优化后的标题阴影计算函数
const calculateTitleTextShadow = () => {
    const shadows = [];

    // 添加传统单层阴影（只有在enabled时才添加）
    if (template.titleShadowEnabled && (template.titleShadowBlur > 0 || template.titleShadowOffsetX !== 0 || template.titleShadowOffsetY !== 0)) {
        shadows.push(
            `${template.titleShadowOffsetX * CANVAS_SCALE}px ${template.titleShadowOffsetY * CANVAS_SCALE}px ${template.titleShadowBlur * CANVAS_SCALE}px ${template.titleShadowColor}`
        );
    }

    // 添加多层阴影
    if (template.titleShadowLayers) {
        template.titleShadowLayers.forEach(layer => {
            if (layer.enabled) {
                const color = layer.opacity < 100
                    ? hexToRgbaWithOpacity(layer.color, layer.opacity)
                    : layer.color;
                shadows.push(
                    `${layer.offsetX * CANVAS_SCALE}px ${layer.offsetY * CANVAS_SCALE}px ${layer.blur * CANVAS_SCALE}px ${color}`
                );
            }
        });
    }

    titleTextShadowStyle.value = shadows.join(', ') || 'none';
};

// 优化后的副标题阴影计算函数
const calculateSubtitleTextShadow = () => {
    const shadows = [];

    // 添加传统单层阴影（只有在enabled时才添加）
    if (template.subtitleShadowEnabled && (template.subtitleShadowBlur > 0 || template.subtitleShadowOffsetX !== 0 || template.subtitleShadowOffsetY !== 0)) {
        shadows.push(
            `${template.subtitleShadowOffsetX * CANVAS_SCALE}px ${template.subtitleShadowOffsetY * CANVAS_SCALE}px ${template.subtitleShadowBlur * CANVAS_SCALE}px ${template.subtitleShadowColor}`
        );
    }

    // 添加多层阴影
    if (template.subtitleShadowLayers) {
        template.subtitleShadowLayers.forEach(layer => {
            if (layer.enabled) {
                const color = layer.opacity < 100
                    ? hexToRgbaWithOpacity(layer.color, layer.opacity)
                    : layer.color;
                shadows.push(
                    `${layer.offsetX * CANVAS_SCALE}px ${layer.offsetY * CANVAS_SCALE}px ${layer.blur * CANVAS_SCALE}px ${color}`
                );
            }
        });
    }

    subtitleTextShadowStyle.value = shadows.join(', ') || 'none';
};

// 🚀 优化：监听阴影相关属性变化，避免频繁重新计算
watch([
    () => template.titleShadowEnabled,
    () => template.titleShadowOffsetX,
    () => template.titleShadowOffsetY,
    () => template.titleShadowBlur,
    () => template.titleShadowColor,
    () => template.titleShadowLayers
], () => {
    calculateTitleTextShadow();
}, { flush: 'post' });

watch([
    () => template.subtitleShadowEnabled,
    () => template.subtitleShadowOffsetX,
    () => template.subtitleShadowOffsetY,
    () => template.subtitleShadowBlur,
    () => template.subtitleShadowColor,
    () => template.subtitleShadowLayers
], () => {
    calculateSubtitleTextShadow();
}, { flush: 'post' });

// 初始化阴影样式
watch(() => props.visible, (visible) => {
    if (visible) {
        calculateTitleTextShadow();
        calculateSubtitleTextShadow();
    }
}, { immediate: true });

// 添加阴影层
const addShadowLayer = (textType: 'title' | 'subtitle') => {
    const newLayer = {
        id: Date.now(),
        offsetX: 2,
        offsetY: 2,
        blur: 4,
        color: '#000000',
        opacity: 100,
        enabled: true
    };

    if (textType === 'title') {
        template.titleShadowLayers.push(newLayer);
        calculateTitleTextShadow();
    } else {
        template.subtitleShadowLayers.push(newLayer);
        calculateSubtitleTextShadow();
    }
};

// ��除阴影层
const removeShadowLayer = (textType: 'title' | 'subtitle', index: number) => {
    if (textType === 'title') {
        template.titleShadowLayers.splice(index, 1);
        calculateTitleTextShadow();
    } else {
        template.subtitleShadowLayers.splice(index, 1);
        calculateSubtitleTextShadow();
    }
};

// 预设阴影配置
const shadowPresets = [
    {
        name: '四周立体',
        layers: [
            { offsetX: -2, offsetY: -2, blur: 2, color: '#FFFFFF', opacity: 100 },
            { offsetX: 2, offsetY: 2, blur: 2, color: '#000000', opacity: 100 },
            { offsetX: 0, offsetY: 0, blur: 4, color: '#000000', opacity: 50 }
        ]
    },
    {
        name: '发光效果',
        layers: [
            { offsetX: 0, offsetY: 0, blur: 8, color: '#FFFF00', opacity: 80 },
            { offsetX: 0, offsetY: 0, blur: 16, color: '#FFFF00', opacity: 40 }
        ]
    },
    {
        name: '外发光',
        layers: [
            { offsetX: 0, offsetY: 0, blur: 12, color: '#000000', opacity: 100 },
            { offsetX: 0, offsetY: 0, blur: 24, color: '#000000', opacity: 50 }
        ]
    },
    {
        name: '多层浮雕',
        layers: [
            { offsetX: -1, offsetY: -1, blur: 1, color: '#FFFFFF', opacity: 100 },
            { offsetX: 1, offsetY: 1, blur: 1, color: '#000000', opacity: 100 },
            { offsetX: 2, offsetY: 2, blur: 2, color: '#000000', opacity: 50 }
        ]
    }
];

// 应用预设阴影
const applyShadowPreset = (textType: 'title' | 'subtitle', preset: typeof shadowPresets[0]) => {
    const layers = preset.layers.map(layer => ({
        id: Date.now() + Math.random(),
        ...layer,
        enabled: true
    }));

    if (textType === 'title') {
        template.titleShadowLayers = layers;
    } else {
        template.subtitleShadowLayers = layers;
    }
};

// 监听标题字体变化，自动加载字体
watch(() => template.titleFontFamily, async (newFontName, oldFontName) => {
    if (!newFontName) return;

    // 等待字体列表加载完成
    if (availableFonts.value.length === 0) {
        await loadFonts();
    }

    if (newFontName !== oldFontName) {
        console.log('[CoverCustomEditor] 标题字体变化:', oldFontName, '->', newFontName);
        await loadFontForPreview(newFontName);
        // 延迟一点时间确保字体完全加载，然后强制重新渲染画布
        await new Promise(resolve => setTimeout(resolve, 100));
        fontLoadKey.value++;
    }
}, { immediate: true });

// 监听副标题字体变化，自动加载字体
watch(() => template.subtitleFontFamily, async (newFontName, oldFontName) => {
    if (!newFontName) return;

    // 等待字体列表加载完成
    if (availableFonts.value.length === 0) {
        await loadFonts();
    }

    if (newFontName !== oldFontName) {
        console.log('[CoverCustomEditor] 副标题字体变化:', oldFontName, '->', newFontName);
        await loadFontForPreview(newFontName);
        // 延迟一��时间确保字体完全加载，然后强制重新渲染画布
        await new Promise(resolve => setTimeout(resolve, 100));
        fontLoadKey.value++;
    }
}, { immediate: true });

// 🔧 监听标题背景形状变化，当为 polygon 且没有足够的顶点时自动创建默认顶点
watch(() => template.titleBackgroundShape, (newShape) => {
    if (newShape === 'polygon') {
        // 🔧 改进：检查当前形状是否为 polygon，且检查是否有足够的顶点
        if (!template.titleBackgroundPoints || template.titleBackgroundPoints.length < 3) {
            console.log('[CoverCustomEditor] 标题背景形状为 polygon 但点数不足，创建默认顶点');
            // 创建默认的四边形顶点（相对于背景中心的百分比坐标）
            template.titleBackgroundPoints = [
                { x: -40, y: -40 },  // 左上
                { x: 40, y: -40 },   // 右上
                { x: 40, y: 40 },    // 右下
                { x: -40, y: 40 }    // 左下
            ];
            console.log('[CoverCustomEditor] 已创建默认四边形顶点:', template.titleBackgroundPoints);

            // 🔧 关键：选择多边形后立即保存，确保顶点被持久化到数据库
            console.log('[CoverCustomEditor] 标题多边形背景：选择后自动保存模板以持久化顶点');
            console.log('[CoverCustomEditor] 当前模板状态:', {
                id: template.id,
                name: template.name,
                titleBackgroundShape: template.titleBackgroundShape,
                titleBackgroundPoints: template.titleBackgroundPoints
            });

            // 需要有模板名称才能保存
            if (!template.name || !template.name.trim()) {
                console.warn('[CoverCustomEditor] ⚠️ 模板名称为空，无法保存');
                return;
            }

            setTimeout(() => {
                try {
                    saveTemplate();
                    console.log('[CoverCustomEditor] ✅ 标题多边形顶点已保存');
                } catch (error) {
                    console.error('[CoverCustomEditor] ❌ 标题多边形顶点保存失败:', error);
                }
            }, 150);
        }
    }
});

// 🔧 监听副标题背景形状变化，当为 polygon 且没有足够的顶点时自动创建默认顶点
watch(() => template.subtitleBackgroundShape, (newShape) => {
    if (newShape === 'polygon') {
        // 🔧 改进：检查当前形状是否为 polygon，且检查是否有足够的顶点
        if (!template.subtitleBackgroundPoints || template.subtitleBackgroundPoints.length < 3) {
            console.log('[CoverCustomEditor] 副标题背景形状为 polygon 但点数不足，创建默认顶点');
            // 创建默认的四边形顶点（相对于背景中心的百分比坐标）
            template.subtitleBackgroundPoints = [
                { x: -40, y: -40 },  // 左上
                { x: 40, y: -40 },   // 右上
                { x: 40, y: 40 },    // 右下
                { x: -40, y: 40 }    // 左下
            ];
            console.log('[CoverCustomEditor] 已创建默认四边形顶点:', template.subtitleBackgroundPoints);

            // 🔧 关键：选择多边形后立即保存，确保顶点被持久化到数据库
            console.log('[CoverCustomEditor] 副标题多边形背景：选择后自动保存模板以持久化顶点');
            console.log('[CoverCustomEditor] 当前模板状态:', {
                id: template.id,
                name: template.name,
                subtitleBackgroundShape: template.subtitleBackgroundShape,
                subtitleBackgroundPoints: template.subtitleBackgroundPoints
            });

            // 需要有模板名称才能保存
            if (!template.name || !template.name.trim()) {
                console.warn('[CoverCustomEditor] ⚠️ 模板名称为空，无法保存');
                return;
            }

            setTimeout(() => {
                try {
                    saveTemplate();
                    console.log('[CoverCustomEditor] ✅ 副标题多边形顶点已保存');
                } catch (error) {
                    console.error('[CoverCustomEditor] ❌ 副标题多边形顶点保存失败:', error);
                }
            }, 150);
        }
    }
});

// 计算文字布局（支持横竖排和间距）
const computeTextLayout = (text: string, direction: 'horizontal' | 'vertical', fontSize: number, charSpacing: number, lineSpacing: number, maxCharsPerLine: number) => {
    // 分行处理
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
        lines.push(text.slice(i, i + maxCharsPerLine));
    }

    const result: Array<{char: string, x: number, y: number}> = [];

    if (direction === 'vertical') {
        // 竖排：从右到左排列列，每列从上到下
        lines.forEach((line, colIdx) => {
            const colX = colIdx * lineSpacing;
            Array.from(line).forEach((char, charIdx) => {
                const charY = charIdx * (fontSize + charSpacing);
                result.push({ char, x: colX, y: charY });
            });
        });
    } else {
        // 横排：从上到下排列行，每行从左到右
        lines.forEach((line, rowIdx) => {
            const rowY = rowIdx * (fontSize + lineSpacing);
            Array.from(line).forEach((char, charIdx) => {
                const charX = charIdx * (fontSize + charSpacing);
                result.push({ char, x: charX, y: rowY });
            });
        });
    }

    return result;
};

// 计算每一行的布局信息（用于自适应背景）
const computeTextLines = (text: string, direction: 'horizontal' | 'vertical', fontSize: number, charSpacing: number, lineSpacing: number, maxCharsPerLine: number) => {
    // 分行
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
        lines.push(text.slice(i, i + maxCharsPerLine));
    }

    const result: Array<{ width: number, height: number, x: number, y: number }> = [];
    
    // 字体渲染高度估计 (与其他函数保持一致)
    const fontRenderHeight = fontSize * 1.3;

    // Padding (与后端保持一致: h=0.4em, v=0.2em)
    const paddingH = fontSize * 0.4;
    const paddingV = fontSize * 0.2;

    if (direction === 'vertical') {
        // 竖排
        lines.forEach((line, colIdx) => {
            const colX = colIdx * lineSpacing;
            // 竖排高度 = (字符数-1)*(size+spacing) + size
            const maxChars = line.length;
            const contentHeight = Math.max(0, (maxChars - 1) * (fontSize + charSpacing) + fontSize);
            
            // 结果包含 padding
            result.push({
                x: colX - paddingV, // 竖排时，宽度是以列宽为基准，这里暂且假设 v_padding 应用于横向(列宽)? 
                                    // 暂且保持简单: 竖排逻辑后端尚未完全完善，这里主要修复横排
                                    // 或者按照竖排直觉：x是水平，y是垂直
                                    // 竖排文字宽度 = fontSize. Pad width = fontSize + 2*paddingV? (后端逻辑 vertical 暂未细化 padding)
                                    // 保持 text 居中?
                y: -paddingH,       // 竖排顶部 padding
                width: fontSize + paddingV * 2, // 竖排宽度扩展
                height: contentHeight + paddingH * 2
            });
        });
    } else {
        // 横排
        lines.forEach((line, rowIdx) => {
            const rowY = rowIdx * (fontSize + lineSpacing);
            const contentWidth = Math.max(0, (line.length - 1) * (fontSize + charSpacing) + fontSize);
            
            // 结果包含 padding
            result.push({
                x: -paddingH,
                y: rowY - paddingV, // 这里的y是相对于行的起始位置(rowY)
                width: contentWidth + paddingH * 2,
                height: fontRenderHeight + paddingV * 2
            });
        });
    }
    return result;
};

// 获取文字布局的容器尺寸
const getTextLayoutSize = (text: string, direction: 'horizontal' | 'vertical', fontSize: number, charSpacing: number, lineSpacing: number, maxCharsPerLine: number) => {
    const lines: string[] = [];
    for (let i = 0; i < text.length; i += maxCharsPerLine) {
        lines.push(text.slice(i, i + maxCharsPerLine));
    }

    // ✅ 修复：考虑字体的实际渲染高度（上升部分 + 下降部分）
    // 字体通常有 ~1.2x 的line-height，取 1.3x 来包含字体的完整渲染高度
    const fontRenderHeight = fontSize * 1.3;

    if (direction === 'vertical') {
        // 竖排：宽度 = fontSize + (列数-1) * lineSpacing
        const totalWidth = fontSize + (lines.length - 1) * lineSpacing;
        const maxColChars = Math.max(...lines.map(l => l.length), 1);
        const totalHeight = (maxColChars - 1) * (fontSize + charSpacing) + fontRenderHeight;
        console.log('[getTextLayoutSize] 竖排', { text, lines: lines.length, maxColChars, fontSize, charSpacing, lineSpacing, totalWidth, totalHeight });
        return { width: totalWidth, height: totalHeight };
    } else {
        // 横排：宽度 = (最长行字符数-1) * (fontSize + charSpacing) + fontSize
        const maxLineChars = Math.max(...lines.map(l => l.length), 1);
        const totalWidth = (maxLineChars - 1) * (fontSize + charSpacing) + fontSize;
        // 横排：高度 = (行数-1) * (fontSize + lineSpacing) + fontRenderHeight
        const totalHeight = (lines.length - 1) * (fontSize + lineSpacing) + fontRenderHeight;
        console.log('[getTextLayoutSize] 横排', { text, lines: lines.length, maxLineChars, fontSize, charSpacing, lineSpacing, totalWidth, totalHeight });
        return { width: totalWidth, height: totalHeight };
    }
};

// ✅ 优化完成：删除重复的第三个watch，功能已合并到第一个watch中
</script>

<template>
    <a-modal
        v-model:visible="dialogVisible"
        :title="t('自定义封面编辑器')"
        width="90%"
        :mask-closable="false"
        :footer="false"
        style="max-width: 1400px;"
        class="cover-editor-modal"
    >
        <div class="flex gap-4 h-[80vh] overflow-hidden">
            <!-- 左侧参数面板 -->
            <div
                ref="paramsPanelRef"
                class="w-80 flex-shrink-0 overflow-y-auto pr-2"
                @mousedown="endDrag"
                @click="endDrag"
                @mouseenter="endDrag"
            >
                <div class="space-y-4">
                    <!-- 模板名称 -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ t("模板名称") }}</label>
                        <input
                            v-model="template.name"
                            type="text"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            :placeholder="t('输入模板名称')"
                        />
                    </div>
                    
                    <!-- 基础设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('basic')"
                        >
                            <h4 class="text-sm font-semibold">{{ t("基础设置") }}</h4>
                            <svg
                                class="w-5 h-5 transition-transform"
                                :class="{ 'rotate-180': !collapsedSections.basic }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <div v-show="!collapsedSections.basic" class="px-4 pb-4 space-y-4">
                            <!-- 背景模糊设置 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-sm font-medium text-gray-700">{{ t("背景模糊") }}</label>
                                    <a-switch
                                        v-model="template.backgroundBlurEnabled"
                                        size="small"
                                    />
                                </div>
                                <div v-if="template.backgroundBlurEnabled" class="mt-2">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">
                                        {{ t("模糊度") }}: {{ template.backgroundBlurIntensity }}
                                    </label>
                                    <input
                                        v-model.number="template.backgroundBlurIntensity"
                                        type="range"
                                        min="1"
                                        max="100"
                                        step="1"
                                        class="w-full"
                                    />
                                </div>
                            </div>
                            
                            <!-- 人物描边设置 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-sm font-medium text-gray-700">{{ t("人物描边") }}</label>
                                    <a-switch
                                        v-model="template.personBorderEnabled"
                                        size="small"
                                    />
                                </div>
                                <div v-if="template.personBorderEnabled" class="space-y-3 mt-2">
                                    <!-- 描边样式 -->
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ t("描边样式") }}</label>
                                        <div class="flex gap-2">
                                            <a-button
                                                :type="template.personBorderStyle === 'solid' ? 'primary' : 'outline'"
                                                size="small"
                                                @click="template.personBorderStyle = 'solid'"
                                            >
                                                {{ t("实线") }}
                                            </a-button>
                                            <a-button
                                                :type="template.personBorderStyle === 'dashed' ? 'primary' : 'outline'"
                                                size="small"
                                                @click="template.personBorderStyle = 'dashed'"
                                            >
                                                {{ t("虚线") }}
                                            </a-button>
                                        </div>
                                    </div>
                                    
                                    <!-- 描边颜色 -->
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ t("描边颜色") }}</label>
                                        <div class="flex items-center gap-2">
                                            <input
                                                v-model="template.personBorderColor"
                                                type="color"
                                                class="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                                            />
                                            <input
                                                v-model="template.personBorderColor"
                                                type="text"
                                                class="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                                placeholder="#FFFFFF"
                                                pattern="^#[0-9A-Fa-f]{6}$"
                                            />
                                        </div>
                                    </div>
                                    
                                    <!-- 描边粗细 -->
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("描边粗细") }}: {{ template.personBorderWidth }}px
                                        </label>
                                        <input
                                            v-model.number="template.personBorderWidth"
                                            type="range"
                                            min="2"
                                            max="200"
                                            step="2"
                                            class="w-full"
                                        />
                                    </div>
                                    
                                    <!-- 虚线设置 -->
                                    <div v-if="template.personBorderStyle === 'dashed'" class="space-y-3">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                                {{ t("虚线长度") }}: 
                                                <span v-if="template.personBorderDashLength">{{ template.personBorderDashLength }}px</span>
                                                <span v-else>{{ t("自动") }}</span>
                                            </label>
                                            <input
                                                v-model.number="template.personBorderDashLength"
                                                type="number"
                                                min="1"
                                                :placeholder="t('留空为自动')"
                                                class="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                                {{ t("虚线间隔") }}: 
                                                <span v-if="template.personBorderGapLength">{{ template.personBorderGapLength }}px</span>
                                                <span v-else>{{ t("自动") }}</span>
                                            </label>
                                            <input
                                                v-model.number="template.personBorderGapLength"
                                                type="number"
                                                min="1"
                                                :placeholder="t('留空为自动')"
                                                class="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 文字自动拆分设置 -->
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <label class="text-sm font-medium text-gray-700">{{ t("文字自动拆分") }}</label>
                                    <a-switch
                                        v-model="template.autoSplitText"
                                        size="small"
                                    />
                                </div>
                                <div v-if="template.autoSplitText" class="space-y-2 mt-2">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("主标题最大字数") }}: {{ template.titleMaxLength }}
                                        </label>
                                        <input
                                            v-model.number="template.titleMaxLength"
                                            type="range"
                                            min="1"
                                            max="20"
                                            step="1"
                                            class="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("副标题最大字数") }}: {{ template.subtitleMaxLength }}
                                        </label>
                                        <input
                                            v-model.number="template.subtitleMaxLength"
                                            type="range"
                                            min="1"
                                            max="20"
                                            step="1"
                                            class="w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 人像设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('person')"
                        >
                            <h4 class="text-sm font-semibold">{{ t("人像设置") }}</h4>
                            <svg
                                class="w-5 h-5 transition-transform"
                                :class="{ 'rotate-180': !collapsedSections.person }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <div v-show="!collapsedSections.person" class="px-4 pb-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("大小") }}: {{ template.personSize }}%
                                </label>
                                <input
                                    v-model.number="template.personSize"
                                    type="range"
                                    min="10"
                                    max="100"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置") }}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-500">X: {{ template.personPosition.x.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.personPosition.x"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-500">Y: {{ template.personPosition.y.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.personPosition.y"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 背景设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('background')"
                        >
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-3">
                                    <h4 class="text-sm font-semibold">{{ t("背景设置") }}</h4>
                                    <div class="flex items-center gap-2" @click.stop>
                                        <span class="text-xs text-gray-600">{{ template.backgroundEnabled ? t("已开启") : t("已关闭") }}</span>
                                        <a-switch
                                            v-model="template.backgroundEnabled"
                                            size="small"
                                        />
                                    </div>
                                </div>
                                <svg
                                    class="w-5 h-5 transition-transform"
                                    :class="{ 'rotate-180': !collapsedSections.background }"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        <div v-if="template.backgroundEnabled && !collapsedSections.background" class="px-4 pb-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("大小") }}: {{ template.backgroundSize }}%
                                </label>
                                <input
                                    v-model.number="template.backgroundSize"
                                    type="range"
                                    min="50"
                                    max="150"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置") }}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-500">X: {{ template.backgroundPosition.x.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.backgroundPosition.x"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-500">Y: {{ template.backgroundPosition.y.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.backgroundPosition.y"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 主标题设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('title')"
                        >
                            <h4 class="text-sm font-semibold">{{ t("主标题") }}</h4>
                            <svg
                                class="w-5 h-5 transition-transform"
                                :class="{ 'rotate-180': !collapsedSections.title }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <div v-show="!collapsedSections.title" class="px-4 pb-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("文字内容") }}</label>
                                <div class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600 min-h-[2.5rem] flex items-center">
                                    {{ template.titleText || t("（从基本信息自动拆分）") }}
                                </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    {{ t("在基本信息中设置文案内容，此处显示拆分结果") }}
                                </p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字体") }}
                                    <span class="text-xs text-gray-500 ml-2">
                                        ({{ availableFonts.length }} {{ t("种可用字体") }})
                                    </span>
                                </label>
                                <select
                                    v-model="template.titleFontFamily"
                                    class="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                                >
                                    <optgroup 
                                        v-for="(group, groupKey) in groupedFonts" 
                                        :key="groupKey" 
                                        :label="groupKey"
                                    >
                                        <option 
                                            v-for="font in group" 
                                            :key="font.value" 
                                            :value="font.value"
                                        >
                                            {{ font.label }}
                                            <span v-if="font.source === 'bundled'" class="text-green-600">●</span>
                                            <span v-else-if="font.source === 'system'" class="text-blue-600">●</span>
                                        </option>
                                    </optgroup>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">
                                    <span class="text-green-600">●</span> {{ t("预置字体") }} | 
                                    <span class="text-blue-600">●</span> {{ t("系统字体") }}
                                </p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字号") }}: {{ template.titleFontSize }}px
                                </label>
                                <input
                                    v-model.number="template.titleFontSize"
                                    type="range"
                                    min="20"
                                    max="500"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字重") }}: {{ template.titleFontWeight }}
                                </label>
                                <input
                                    v-model.number="template.titleFontWeight"
                                    type="range"
                                    min="100"
                                    max="1000"
                                    step="50"
                                    class="w-full"
                                />
                                <div class="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>100</span>
                                    <span>500</span>
                                    <span>700</span>
                                    <span>900</span>
                                    <span>1000</span>
                                </div>
                            </div>
                            <!-- 文字方向 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("文字方向") }}</label>
                                <div class="flex space-x-4">
                                    <label class="flex items-center">
                                        <input
                                            type="radio"
                                            v-model="template.titleDirection"
                                            value="horizontal"
                                            class="mr-2"
                                        />
                                        {{ t("横排") }}
                                    </label>
                                    <label class="flex items-center">
                                        <input
                                            type="radio"
                                            v-model="template.titleDirection"
                                            value="vertical"
                                            class="mr-2"
                                        />
                                        {{ t("竖排") }}
                                    </label>
                                </div>
                            </div>
                            <!-- 每行字数 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ template.titleDirection === 'vertical' ? t("每列字数") : t("每行字数") }}: {{ template.titleMaxCharsPerLine }}
                                </label>
                                <input
                                    v-model.number="template.titleMaxCharsPerLine"
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 字符间距 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字符间距") }}: {{ template.titleCharSpacing }}px
                                </label>
                                <input
                                    v-model.number="template.titleCharSpacing"
                                    type="range"
                                    min="-50"
                                    max="100"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 行间距 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ template.titleDirection === 'vertical' ? t("列间距") : t("行间距") }}: {{ template.titleLineSpacing }}px
                                </label>
                                <input
                                    v-model.number="template.titleLineSpacing"
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("颜色") }}</label>
                                <input
                                    v-model="template.titleColor"
                                    type="color"
                                    class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("描边颜色") }}</label>
                                <input
                                    v-model="template.titleStrokeColor"
                                    type="color"
                                    class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("描边粗细") }}: {{ template.titleStrokeWidth }}px
                                </label>
                                <input
                                    v-model.number="template.titleStrokeWidth"
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 多层阴影设置 -->
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm font-medium text-gray-700">{{ t("多层阴影") }}</label>
                                    <div class="flex gap-2">
                                        <a-button
                                            size="small"
                                            type="primary"
                                            @click="addShadowLayer('title')"
                                        >
                                            {{ t("添加阴影层") }}
                                        </a-button>
                                        <a-dropdown>
                                            <a-button size="small">
                                                {{ t("预设效果") }}
                                                <template #suffix>
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </template>
                                            </a-button>
                                            <template #content>
                                                <a-menu>
                                                    <a-menu-item
                                                        v-for="preset in shadowPresets"
                                                        :key="preset.name"
                                                        @click="applyShadowPreset('title', preset)"
                                                    >
                                                        {{ preset.name }}
                                                    </a-menu-item>
                                                </a-menu>
                                            </template>
                                        </a-dropdown>
                                    </div>
                                </div>

                                <!-- 传统单层阴影（兼容性） -->
                                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-xs font-medium text-gray-600">{{ t("传统阴影") }}</span>
                                        <a-switch
                                            v-model="template.titleShadowEnabled"
                                            size="small"
                                            v-model:checked="template.titleShadowEnabled"
                                        />
                                    </div>
                                    <div v-show="template.titleShadowEnabled" class="space-y-2">
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">{{ t("颜色") }}</label>
                                            <input
                                                v-model="template.titleShadowColor"
                                                type="color"
                                                class="w-full h-6 border border-gray-300 rounded cursor-pointer text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">X: {{ template.titleShadowOffsetX }}px</label>
                                            <input
                                                v-model.number="template.titleShadowOffsetX"
                                                type="range"
                                                min="-50"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">Y: {{ template.titleShadowOffsetY }}px</label>
                                            <input
                                                v-model.number="template.titleShadowOffsetY"
                                                type="range"
                                                min="-50"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">{{ t("模糊") }}: {{ template.titleShadowBlur }}px</label>
                                            <input
                                                v-model.number="template.titleShadowBlur"
                                                type="range"
                                                min="0"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <!-- 多层阴影列表 -->
                                <div class="space-y-2 max-h-64 overflow-y-auto">
                                    <div
                                        v-for="(layer, index) in template.titleShadowLayers"
                                        :key="layer.id"
                                        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                                    >
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-sm font-medium text-gray-700">{{ t("阴影层") }} {{ index + 1 }}</span>
                                            <div class="flex items-center gap-2">
                                                <a-switch
                                                    v-model:checked="layer.enabled"
                                                    size="small"
                                                />
                                                <a-button
                                                    size="small"
                                                    danger
                                                    @click="removeShadowLayer('title', index)"
                                                >
                                                    {{ t("删除") }}
                                                </a-button>
                                            </div>
                                        </div>
                                        <div v-show="layer.enabled" class="space-y-2">
                                            <div class="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label class="block text-xs text-gray-500 mb-1">X: {{ layer.offsetX }}px</label>
                                                    <input
                                                        v-model.number="layer.offsetX"
                                                        type="range"
                                                        min="-20"
                                                        max="20"
                                                        step="1"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                                <div>
                                                    <label class="block text-xs text-gray-500 mb-1">Y: {{ layer.offsetY }}px</label>
                                                    <input
                                                        v-model.number="layer.offsetY"
                                                        type="range"
                                                        min="-20"
                                                        max="20"
                                                        step="1"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-xs text-gray-500 mb-1">{{ t("模糊") }}: {{ layer.blur }}px</label>
                                                <input
                                                    v-model.number="layer.blur"
                                                    type="range"
                                                    min="0"
                                                    max="30"
                                                    step="1"
                                                    class="w-full h-4"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <div class="flex-1">
                                                    <label class="block text-xs text-gray-500 mb-1">{{ t("颜色") }}</label>
                                                    <input
                                                        v-model="layer.color"
                                                        type="color"
                                                        class="w-full h-6 border border-gray-300 rounded cursor-pointer"
                                                    />
                                                </div>
                                                <div class="flex-1">
                                                    <label class="block text-xs text-gray-500 mb-1">{{ t("透明度") }}: {{ layer.opacity }}%</label>
                                                    <input
                                                        v-model.number="layer.opacity"
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置") }}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-500">X: {{ template.titlePosition.x.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.titlePosition.x"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-500">Y: {{ template.titlePosition.y.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.titlePosition.y"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 主标题旋转角度 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("旋转角度") }}: {{ template.titleRotation }}°
                                </label>
                                <input
                                    v-model.number="template.titleRotation"
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            
                            <!-- 主标题背景设置 -->
                            <div class="mt-4 pt-4 border-t border-gray-300">
                                <div class="flex items-center justify-between mb-3">
                                    <h5 class="text-sm font-medium text-gray-700">{{ t("文字背景") }}</h5>
                                    <a-switch
                                        v-model="template.titleBackgroundEnabled"
                                        size="small"
                                    />
                                </div>
                                <div v-if="template.titleBackgroundEnabled" class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("背景颜色") }}</label>
                                        <input
                                            v-model="template.titleBackgroundColor"
                                            type="color"
                                            class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("透明度") }}: {{ template.titleBackgroundOpacity }}%
                                        </label>
                                        <input
                                            v-model.number="template.titleBackgroundOpacity"
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            class="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("形状") }}</label>
                                        <select
                                            v-model="template.titleBackgroundShape"
                                            class="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                                            @change="(e) => {
                                                const shape = (e.target as HTMLSelectElement).value;
                                                if (shape === 'polygon' && (!template.titleBackgroundPoints || template.titleBackgroundPoints.length === 0)) {
                                                    // 初始化控制点（矩形四个角）
                                                    template.titleBackgroundPoints = [
                                                        { x: -50, y: -50 },
                                                        { x: 50, y: -50 },
                                                        { x: 50, y: 50 },
                                                        { x: -50, y: 50 }
                                                    ];
                                                }
                                            }"
                                        >
                                            <option value="rectangle">{{ t("矩形") }}</option>
                                            <option value="rounded">{{ t("圆角矩形") }}</option>
                                            <option value="polygon">{{ t("自定义多边形") }}</option>
                                        </select>
                                        <p v-if="template.titleBackgroundShape === 'polygon'" class="text-xs text-gray-500 mt-1">
                                            {{ t("提示：点击背景区域添加顶点，拖拽调整位置，右键删除顶点") }}
                                        </p>
                                    </div>
                                    <div v-if="template.titleBackgroundShape === 'rounded'">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("圆角半径") }}: {{ template.titleBackgroundRadius }}px
                                        </label>
                                        <input
                                            v-model.number="template.titleBackgroundRadius"
                                            type="range"
                                            min="0"
                                            max="50"
                                            step="1"
                                            class="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("大小") }}</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-500">{{ t("宽度") }}: {{ template.titleBackgroundSize.width }}%</label>
                                                <input
                                                    v-model.number="template.titleBackgroundSize.width"
                                                    type="number"
                                                    min="10"
                                                    max="200"
                                                    step="5"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-500">{{ t("高度") }}: {{ template.titleBackgroundSize.height }}%</label>
                                                <input
                                                    v-model.number="template.titleBackgroundSize.height"
                                                    type="number"
                                                    min="10"
                                                    max="200"
                                                    step="5"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置偏移") }}</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-500">X: {{ template.titleBackgroundPosition.x.toFixed(1) }}%</label>
                                                <input
                                                    v-model.number="template.titleBackgroundPosition.x"
                                                    type="number"
                                                    min="-50"
                                                    max="50"
                                                    step="1"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-500">Y: {{ template.titleBackgroundPosition.y.toFixed(1) }}%</label>
                                                <input
                                                    v-model.number="template.titleBackgroundPosition.y"
                                                    type="number"
                                                    min="-50"
                                                    max="50"
                                                    step="1"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    </div>

                                <!-- 主标题背景旋转角度 -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">
                                        {{ t("旋转角度") }}: {{ template.titleBackgroundRotation }}°
                                    </label>
                                    <input
                                        v-model.number="template.titleBackgroundRotation"
                                        type="range"
                                        min="0"
                                        max="360"
                                        step="1"
                                        class="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 副标题设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('subtitle')"
                        >
                            <h4 class="text-sm font-semibold">{{ t("副标题") }}</h4>
                            <svg
                                class="w-5 h-5 transition-transform"
                                :class="{ 'rotate-180': !collapsedSections.subtitle }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <div v-show="!collapsedSections.subtitle" class="px-4 pb-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("文字内容") }}</label>
                                <div class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600">
                                    {{ template.subtitleText || t("（从基本信息自动拆分）") }}
                                </div>
                                <p class="text-xs text-gray-500 mt-1">
                                    {{ t("文字内容在基本信息中设置，此处仅显示拆分结果") }}
                                </p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字体") }}
                                    <span class="text-xs text-gray-500 ml-2">
                                        ({{ availableFonts.length }} {{ t("种可用字体") }})
                                    </span>
                                </label>
                                <select
                                    v-model="template.subtitleFontFamily"
                                    class="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                                >
                                    <optgroup 
                                        v-for="(group, groupKey) in groupedFonts" 
                                        :key="groupKey" 
                                        :label="groupKey"
                                    >
                                        <option 
                                            v-for="font in group" 
                                            :key="font.value" 
                                            :value="font.value"
                                        >
                                            {{ font.label }}
                                            <span v-if="font.source === 'bundled'" class="text-green-600">●</span>
                                            <span v-else-if="font.source === 'system'" class="text-blue-600">●</span>
                                        </option>
                                    </optgroup>
                                </select>
                                <p class="text-xs text-gray-500 mt-1">
                                    <span class="text-green-600">●</span> {{ t("预置字体") }} | 
                                    <span class="text-blue-600">●</span> {{ t("系统字体") }}
                                </p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字号") }}: {{ template.subtitleFontSize }}px
                                </label>
                                <input
                                    v-model.number="template.subtitleFontSize"
                                    type="range"
                                    min="12"
                                    max="400"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字重") }}: {{ template.subtitleFontWeight }}
                                </label>
                                <input
                                    v-model.number="template.subtitleFontWeight"
                                    type="range"
                                    min="100"
                                    max="1000"
                                    step="50"
                                    class="w-full"
                                />
                                <div class="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>100</span>
                                    <span>500</span>
                                    <span>700</span>
                                    <span>900</span>
                                    <span>1000</span>
                                </div>
                            </div>
                            <!-- 文字方向 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("文字方向") }}</label>
                                <div class="flex space-x-4">
                                    <label class="flex items-center">
                                        <input
                                            type="radio"
                                            v-model="template.subtitleDirection"
                                            value="horizontal"
                                            class="mr-2"
                                        />
                                        {{ t("横排") }}
                                    </label>
                                    <label class="flex items-center">
                                        <input
                                            type="radio"
                                            v-model="template.subtitleDirection"
                                            value="vertical"
                                            class="mr-2"
                                        />
                                        {{ t("竖排") }}
                                    </label>
                                </div>
                            </div>
                            <!-- 每行字数 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ template.subtitleDirection === 'vertical' ? t("每列字数") : t("每行字数") }}: {{ template.subtitleMaxCharsPerLine }}
                                </label>
                                <input
                                    v-model.number="template.subtitleMaxCharsPerLine"
                                    type="range"
                                    min="1"
                                    max="50"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 字符间距 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("字符间距") }}: {{ template.subtitleCharSpacing }}px
                                </label>
                                <input
                                    v-model.number="template.subtitleCharSpacing"
                                    type="range"
                                    min="-50"
                                    max="100"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 行间距 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ template.subtitleDirection === 'vertical' ? t("列间距") : t("行间距") }}: {{ template.subtitleLineSpacing }}px
                                </label>
                                <input
                                    v-model.number="template.subtitleLineSpacing"
                                    type="range"
                                    min="0"
                                    max="300"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("颜色") }}</label>
                                <input
                                    v-model="template.subtitleColor"
                                    type="color"
                                    class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("描边颜色") }}</label>
                                <input
                                    v-model="template.subtitleStrokeColor"
                                    type="color"
                                    class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("描边粗细") }}: {{ template.subtitleStrokeWidth }}px
                                </label>
                                <input
                                    v-model.number="template.subtitleStrokeWidth"
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            <!-- 多层阴影设置 -->
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <label class="text-sm font-medium text-gray-700">{{ t("多层阴影") }}</label>
                                    <div class="flex gap-2">
                                        <a-button
                                            size="small"
                                            type="primary"
                                            @click="addShadowLayer('subtitle')"
                                        >
                                            {{ t("添加阴影层") }}
                                        </a-button>
                                        <a-dropdown>
                                            <a-button size="small">
                                                {{ t("预设效果") }}
                                                <template #suffix>
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </template>
                                            </a-button>
                                            <template #content>
                                                <a-menu>
                                                    <a-menu-item
                                                        v-for="preset in shadowPresets"
                                                        :key="preset.name"
                                                        @click="applyShadowPreset('subtitle', preset)"
                                                    >
                                                        {{ preset.name }}
                                                    </a-menu-item>
                                                </a-menu>
                                            </template>
                                        </a-dropdown>
                                    </div>
                                </div>

                                <!-- 传统单层阴影（兼容性） -->
                                <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-xs font-medium text-gray-600">{{ t("传统阴影") }}</span>
                                        <a-switch
                                            v-model="template.subtitleShadowEnabled"
                                            size="small"
                                            v-model:checked="template.subtitleShadowEnabled"
                                        />
                                    </div>
                                    <div v-show="template.subtitleShadowEnabled" class="space-y-2">
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">{{ t("颜色") }}</label>
                                            <input
                                                v-model="template.subtitleShadowColor"
                                                type="color"
                                                class="w-full h-6 border border-gray-300 rounded cursor-pointer text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">X: {{ template.subtitleShadowOffsetX }}px</label>
                                            <input
                                                v-model.number="template.subtitleShadowOffsetX"
                                                type="range"
                                                min="-50"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">Y: {{ template.subtitleShadowOffsetY }}px</label>
                                            <input
                                                v-model.number="template.subtitleShadowOffsetY"
                                                type="range"
                                                min="-50"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                        <div>
                                            <label class="block text-xs text-gray-500 mb-1">{{ t("模糊") }}: {{ template.subtitleShadowBlur }}px</label>
                                            <input
                                                v-model.number="template.subtitleShadowBlur"
                                                type="range"
                                                min="0"
                                                max="50"
                                                step="1"
                                                class="w-full h-4"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <!-- 多层阴影列表 -->
                                <div class="space-y-2 max-h-64 overflow-y-auto">
                                    <div
                                        v-for="(layer, index) in template.subtitleShadowLayers"
                                        :key="layer.id"
                                        class="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                                    >
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-sm font-medium text-gray-700">{{ t("阴影层") }} {{ index + 1 }}</span>
                                            <div class="flex items-center gap-2">
                                                <a-switch
                                                    v-model:checked="layer.enabled"
                                                    size="small"
                                                />
                                                <a-button
                                                    size="small"
                                                    danger
                                                    @click="removeShadowLayer('subtitle', index)"
                                                >
                                                    {{ t("删除") }}
                                                </a-button>
                                            </div>
                                        </div>
                                        <div v-show="layer.enabled" class="space-y-2">
                                            <div class="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label class="block text-xs text-gray-500 mb-1">X: {{ layer.offsetX }}px</label>
                                                    <input
                                                        v-model.number="layer.offsetX"
                                                        type="range"
                                                        min="-20"
                                                        max="20"
                                                        step="1"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                                <div>
                                                    <label class="block text-xs text-gray-500 mb-1">Y: {{ layer.offsetY }}px</label>
                                                    <input
                                                        v-model.number="layer.offsetY"
                                                        type="range"
                                                        min="-20"
                                                        max="20"
                                                        step="1"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label class="block text-xs text-gray-500 mb-1">{{ t("模糊") }}: {{ layer.blur }}px</label>
                                                <input
                                                    v-model.number="layer.blur"
                                                    type="range"
                                                    min="0"
                                                    max="30"
                                                    step="1"
                                                    class="w-full h-4"
                                                />
                                            </div>
                                            <div class="flex items-center gap-2">
                                                <div class="flex-1">
                                                    <label class="block text-xs text-gray-500 mb-1">{{ t("颜色") }}</label>
                                                    <input
                                                        v-model="layer.color"
                                                        type="color"
                                                        class="w-full h-6 border border-gray-300 rounded cursor-pointer"
                                                    />
                                                </div>
                                                <div class="flex-1">
                                                    <label class="block text-xs text-gray-500 mb-1">{{ t("透明度") }}: {{ layer.opacity }}%</label>
                                                    <input
                                                        v-model.number="layer.opacity"
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="5"
                                                        class="w-full h-4"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置") }}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-500">X: {{ template.subtitlePosition.x.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.subtitlePosition.x"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-500">Y: {{ template.subtitlePosition.y.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.subtitlePosition.y"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 副标题旋转角度 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("旋转角度") }}: {{ template.subtitleRotation }}°
                                </label>
                                <input
                                    v-model.number="template.subtitleRotation"
                                    type="range"
                                    min="0"
                                    max="360"
                                    step="1"
                                    class="w-full"
                                />
                            </div>
                            
                            <!-- 副标题背景设置 -->
                            <div class="mt-4 pt-4 border-t border-gray-300">
                                <div class="flex items-center justify-between mb-3">
                                    <h5 class="text-sm font-medium text-gray-700">{{ t("文字背景") }}</h5>
                                    <a-switch
                                        v-model="template.subtitleBackgroundEnabled"
                                        size="small"
                                    />
                                </div>
                                <div v-if="template.subtitleBackgroundEnabled" class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("背景颜色") }}</label>
                                        <input
                                            v-model="template.subtitleBackgroundColor"
                                            type="color"
                                            class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("透明度") }}: {{ template.subtitleBackgroundOpacity }}%
                                        </label>
                                        <input
                                            v-model.number="template.subtitleBackgroundOpacity"
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            class="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("形状") }}</label>
                                        <select
                                            v-model="template.subtitleBackgroundShape"
                                            class="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                                            @change="(e) => {
                                                const shape = (e.target as HTMLSelectElement).value;
                                                if (shape === 'polygon' && (!template.subtitleBackgroundPoints || template.subtitleBackgroundPoints.length === 0)) {
                                                    // 初始化控制点（矩形四个角）
                                                    template.subtitleBackgroundPoints = [
                                                        { x: -50, y: -50 },
                                                        { x: 50, y: -50 },
                                                        { x: 50, y: 50 },
                                                        { x: -50, y: 50 }
                                                    ];
                                                }
                                            }"
                                        >
                                            <option value="rectangle">{{ t("矩形") }}</option>
                                            <option value="rounded">{{ t("圆角矩形") }}</option>
                                            <option value="polygon">{{ t("自定义多边形") }}</option>
                                        </select>
                                        <p v-if="template.subtitleBackgroundShape === 'polygon'" class="text-xs text-gray-500 mt-1">
                                            {{ t("提示：点击背景区域添加顶点，拖拽调整位置，右键删除顶点") }}
                                        </p>
                                    </div>
                                    <div v-if="template.subtitleBackgroundShape === 'rounded'">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">
                                            {{ t("圆角半径") }}: {{ template.subtitleBackgroundRadius }}px
                                        </label>
                                        <input
                                            v-model.number="template.subtitleBackgroundRadius"
                                            type="range"
                                            min="0"
                                            max="50"
                                            step="1"
                                            class="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("大小") }}</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-500">{{ t("宽度") }}: {{ template.subtitleBackgroundSize.width }}%</label>
                                                <input
                                                    v-model.number="template.subtitleBackgroundSize.width"
                                                    type="number"
                                                    min="10"
                                                    max="200"
                                                    step="5"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-500">{{ t("高度") }}: {{ template.subtitleBackgroundSize.height }}%</label>
                                                <input
                                                    v-model.number="template.subtitleBackgroundSize.height"
                                                    type="number"
                                                    min="10"
                                                    max="200"
                                                    step="5"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置偏移") }}</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-500">X: {{ template.subtitleBackgroundPosition.x.toFixed(1) }}%</label>
                                                <input
                                                    v-model.number="template.subtitleBackgroundPosition.x"
                                                    type="number"
                                                    min="-50"
                                                    max="50"
                                                    step="1"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-500">Y: {{ template.subtitleBackgroundPosition.y.toFixed(1) }}%</label>
                                                <input
                                                    v-model.number="template.subtitleBackgroundPosition.y"
                                                    type="number"
                                                    min="-50"
                                                    max="50"
                                                    step="1"
                                                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 蒙版设置 -->
                    <div class="bg-gray-50 rounded-lg border border-gray-200">
                        <div
                            class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                            @click="toggleSection('mask')"
                        >
                            <div class="flex items-center gap-2">
                                <h4 class="text-sm font-semibold">{{ t("蒙版") }}</h4>
                                <a-switch
                                    v-model="template.maskEnabled"
                                    size="small"
                                    @click.stop
                                />
                            </div>
                            <svg
                                class="w-5 h-5 transition-transform"
                                :class="{ 'rotate-180': !collapsedSections.mask }"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                        <div v-if="template.maskEnabled && !collapsedSections.mask" class="px-4 pb-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("蒙版图片") }}</label>
                                <div class="flex gap-2">
                                    <input
                                        v-model="template.maskImagePath"
                                        type="text"
                                        readonly
                                        class="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-gray-50"
                                    />
                                    <a-button size="small" @click="selectMaskImage">
                                        {{ t("选择") }}
                                    </a-button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("大小") }}: {{ template.maskSize }}%
                                </label>
                                <input
                                    v-model.number="template.maskSize"
                                    type="range"
                                    min="10"
                                    max="200"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("位置") }}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-500">X: {{ template.maskPosition.x.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.maskPosition.x"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-500">Y: {{ template.maskPosition.y.toFixed(1) }}%</label>
                                        <input
                                            v-model.number="template.maskPosition.y"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("颜色") }}</label>
                                <input
                                    v-model="template.maskColor"
                                    type="color"
                                    class="w-full h-8 border border-gray-300 rounded cursor-pointer"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                    {{ t("透明度") }}: {{ template.maskOpacity }}%
                                </label>
                                <input
                                    v-model.number="template.maskOpacity"
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{{ t("形状") }}</label>
                                <select
                                    v-model="template.maskShape"
                                    class="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                                >
                                    <option value="rectangle">{{ t("矩形") }}</option>
                                    <option value="circle">{{ t("圆形") }}</option>
                                    <option value="rounded">{{ t("圆角矩形") }}</option>
                                    <option value="polygon">{{ t("多边形") }}</option>
                                    <option value="custom">{{ t("自定义") }}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 右侧画布预览区 -->
            <div class="flex-1 flex flex-col">
                <div class="mb-4 flex justify-end gap-2">
                    <a-button @click="cancelEdit">
                        {{ t("取消") }}
                    </a-button>
                    <a-button type="primary" @click="saveTemplate">
                        {{ t("保存模板") }}
                    </a-button>
                </div>
                
                <div
                    ref="canvasContainerRef"
                    class="flex-1 bg-gray-100 rounded-lg p-4 overflow-visible"
                    @mouseleave="onCanvasLeave"
                >
                    <div
                        ref="canvasRef"
                        class="relative mx-auto bg-white shadow-lg overflow-visible"
                        :style="{
                            width: `${CANVAS_WIDTH * CANVAS_SCALE}px`,
                            height: `${CANVAS_HEIGHT * CANVAS_SCALE}px`,
                        }"
                    >
                        <!-- 背景占位符（可拖拽和调整大小） -->
                        <div
                            v-if="template.backgroundEnabled"
                            class="absolute bg-gray-300 border-2 border-dashed border-gray-400 transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'background' }"
                            :style="{
                                ...getElementStyle(template.backgroundPosition, template.backgroundSize),
                                zIndex: layerZIndex.background,
                                pointerEvents: activeLayer === 'background' ? 'auto' : 'none'
                            }"
                            @mousedown="(e) => startDrag(e, 'background')"
                        >
                            <div class="w-full h-full flex items-center justify-center text-xs text-gray-500 cursor-move">
                                {{ t("背景") }}
                            </div>
                            <!-- 调整大小控制点 -->
                            <div
                                class="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-nw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'nw')"
                            ></div>
                            <div
                                class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-ne-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'ne')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-sw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'sw')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-se-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'se')"
                            ></div>
                            <div
                                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-n-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'n')"
                            ></div>
                            <div
                                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-s-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 's')"
                            ></div>
                            <div
                                class="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-w-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'w')"
                            ></div>
                            <div
                                class="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-e-resize"
                                @mousedown.stop="(e) => startDrag(e, 'background', 'e')"
                            ></div>
                        </div>
                        
                        <!-- 人像描边预览（SVG） -->
                        <svg
                            v-if="template.personBorderEnabled"
                            class="absolute pointer-events-none"
                            :style="{
                                left: `${(template.personPosition.x / 100) * (CANVAS_WIDTH * CANVAS_SCALE) - (template.personSize / 100) * (CANVAS_WIDTH * CANVAS_SCALE) / 2 - template.personBorderWidth}px`,
                                top: `${(template.personPosition.y / 100) * (CANVAS_HEIGHT * CANVAS_SCALE) - (template.personSize / 100) * (CANVAS_HEIGHT * CANVAS_SCALE) / 2 - template.personBorderWidth}px`,
                                width: `${(template.personSize / 100) * (CANVAS_WIDTH * CANVAS_SCALE) + template.personBorderWidth * 2}px`,
                                height: `${(template.personSize / 100) * (CANVAS_HEIGHT * CANVAS_SCALE) + template.personBorderWidth * 2}px`,
                                zIndex: layerZIndex.person + 1
                            }"
                        >
                            <rect
                                :x="template.personBorderWidth"
                                :y="template.personBorderWidth"
                                :width="(template.personSize / 100) * (CANVAS_WIDTH * CANVAS_SCALE)"
                                :height="(template.personSize / 100) * (CANVAS_HEIGHT * CANVAS_SCALE)"
                                fill="none"
                                :stroke="template.personBorderColor"
                                :stroke-width="template.personBorderWidth * CANVAS_SCALE"
                                :stroke-dasharray="template.personBorderStyle === 'dashed'
                                    ? `${(template.personBorderDashLength || (template.personBorderWidth * 3)) * CANVAS_SCALE} ${(template.personBorderGapLength || (template.personBorderWidth * 2)) * CANVAS_SCALE}`
                                    : 'none'"
                            />
                        </svg>
                        
                        <!-- 人像占位符（可拖拽和调整大小） - 只在描边开启时显示 -->
                        <div
                            v-if="template.personBorderEnabled"
                            class="absolute bg-blue-300 border-2 border-dashed border-blue-500 transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'person' }"
                            :style="{
                                ...getElementStyle(template.personPosition, template.personSize),
                                zIndex: layerZIndex.person,
                                transform: `rotate(${template.personRotation || 0}deg)`,
                                transformOrigin: 'center center',
                            }"
                            @mousedown="(e) => startDrag(e, 'person')"
                        >
                            <div class="w-full h-full flex items-center justify-center text-xs text-blue-700 cursor-move">
                                {{ t("人像") }}
                                <span v-if="template.personBorderEnabled" class="ml-1 text-[10px]">
                                    ({{ template.personBorderStyle === 'solid' ? t('实线') : t('虚线') }}{{ t('描边') }})
                                </span>
                            </div>
                            <!-- 调整大小控制点 -->
                            <div
                                class="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-nw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'nw')"
                            ></div>
                            <div
                                class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-ne-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'ne')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-sw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'sw')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-se-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'se')"
                            ></div>
                            <div
                                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-n-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'n')"
                            ></div>
                            <div
                                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-s-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 's')"
                            ></div>
                            <div
                                class="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-w-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'w')"
                            ></div>
                            <div
                                class="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-e-resize"
                                @mousedown.stop="(e) => startDrag(e, 'person', 'e')"
                            ></div>
                        </div>
                        
                        <!-- 主标题背景（独立元素，可拖拽和调整大小） -->
                        <!-- 多边形使用SVG渲染，矩形使用div -->
                        <svg
                            v-if="template.titleBackgroundEnabled && template.titleBackgroundShape === 'polygon' && template.titleBackgroundPoints && template.titleBackgroundPoints.length >= 3"
                            class="absolute pointer-events-none"
                            :style="{
                                left: 0,
                                top: 0,
                                width: `${CANVAS_WIDTH * CANVAS_SCALE}px`,
                                height: `${CANVAS_HEIGHT * CANVAS_SCALE}px`,
                                zIndex: layerZIndex.titleBackground,
                                overflow: 'visible'
                            }"
                        >
                            <polygon
                                :points="template.titleBackgroundPoints.map(pt => {
                                    const pos = getBackgroundPointPosition(template.titleBackgroundSize, template.titleBackgroundPosition, pt);
                                    return `${Math.round(pos.x)},${Math.round(pos.y)}`;
                                }).join(' ')"
                                :fill="hexToRgba(template.titleBackgroundColor, template.titleBackgroundOpacity)"
                                class="cursor-move"
                                @mousedown="(e) => startDrag(e, 'titleBackground')"
                                @click.stop="(e) => addBackgroundPoint('title', e)"
                                style="pointer-events: all;"
                            />
                            <!-- 虚线边框用于显示可拖拽区域 -->
                            <polygon
                                v-if="activeLayer === 'titleBackground'"
                                :points="template.titleBackgroundPoints.map(pt => {
                                    const pos = getBackgroundPointPosition(template.titleBackgroundSize, template.titleBackgroundPosition, pt);
                                    return `${Math.round(pos.x)},${Math.round(pos.y)}`;
                                }).join(' ')"
                                fill="none"
                                stroke="#9ca3af"
                                stroke-width="2"
                                stroke-dasharray="5,5"
                                style="pointer-events: none;"
                            />
                        </svg>
                        
                        <div
                            v-if="template.titleBackgroundEnabled && (template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded')"
                            class="absolute cursor-move border-2 border-dashed border-gray-400 transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'titleBackground' }"
                            :style="{
                                ...getTextBackgroundStyle(
                                    template.titleBackgroundSize,
                                    template.titleBackgroundPosition
                                ),
                                zIndex: layerZIndex.titleBackground,
                                backgroundColor: hexToRgba(template.titleBackgroundColor, template.titleBackgroundOpacity),
                                borderRadius: template.titleBackgroundShape === 'rounded'
                                    ? `${template.titleBackgroundRadius}px`
                                    : '0',
                                transform: `rotate(${template.titleBackgroundRotation || 0}deg)`,
                                transformOrigin: 'center center',
                            }"
                            @mousedown="(e) => startDrag(e, 'titleBackground')"
                        >
                            <!-- 调整大小控制点 -->
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-nw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'nw')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-ne-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'ne')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-sw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'sw')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-se-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'se')"
                            ></div>
                            <!-- 边框中点控制点 -->
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-n-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'n')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-s-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 's')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-w-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'w')"
                            ></div>
                            <div
                                v-if="template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded'"
                                class="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-e-resize"
                                @mousedown.stop="(e) => startDrag(e, 'titleBackground', 'e')"
                            ></div>
                        </div>
                        
                        <!-- 主标题多边形控制点（独立层，增大尺寸便于选中） -->
                        <template v-if="template.titleBackgroundEnabled && template.titleBackgroundShape === 'polygon' && template.titleBackgroundPoints && template.titleBackgroundPoints.length > 0">
                            <div
                                v-for="(point, index) in template.titleBackgroundPoints"
                                :key="index"
                                class="absolute bg-red-500 border-2 border-red-700 rounded-full cursor-move hover:scale-125 transition-transform"
                                :style="{
                                    width: '16px',
                                    height: '16px',
                                    left: `${getBackgroundPointPosition(
                                        template.titleBackgroundSize,
                                        template.titleBackgroundPosition,
                                        point
                                    ).x - 8}px`,
                                    top: `${getBackgroundPointPosition(
                                        template.titleBackgroundSize,
                                        template.titleBackgroundPosition,
                                        point
                                    ).y - 8}px`,
                                    zIndex: 1000,
                                }"
                                @mousedown.stop="(e) => startDragBackgroundPoint(e, 'title', index)"
                                @contextmenu.prevent.stop="(e) => { e.preventDefault(); e.stopPropagation(); removeBackgroundPoint('title', index, e); }"
                            ></div>
                        </template>
                        
                        <!-- 主标题文字（可拖拽） -->
                        <div
                            v-if="template.titleText"
                            :key="`title-${template.titleFontFamily}-${template.titleFontSize}-${template.titleDirection}-${template.titleCharSpacing}-${template.titleLineSpacing}-${template.titleMaxCharsPerLine}-${fontLoadKey}`"
                            class="absolute cursor-move select-none transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'title' }"
                            :style="{
                                ...getElementStyleWithSize(template.titlePosition, getTextLayoutSize(
                                    template.titleText,
                                    template.titleDirection,
                                    template.titleFontSize * CANVAS_SCALE,
                                    template.titleCharSpacing * CANVAS_SCALE,
                                    template.titleLineSpacing * CANVAS_SCALE,
                                    template.titleMaxCharsPerLine
                                )),
                                zIndex: layerZIndex.title,
                                transform: `rotate(${template.titleRotation || 0}deg)`,
                                transformOrigin: 'center center',
                                pointerEvents: 'auto'
                            }"
                            @mousedown="(e) => startDrag(e, 'title')"
                        >
                            <!-- 自适应标题背景 (render text background rects) -->
                            <div 
                                v-if="template.titleBackgroundEnabled && (template.titleBackgroundShape === 'rectangle' || template.titleBackgroundShape === 'rounded')"
                                v-for="(bgLine, index) in computeTextLines(
                                    template.titleText,
                                    template.titleDirection,
                                    template.titleFontSize * CANVAS_SCALE,
                                    template.titleCharSpacing * CANVAS_SCALE,
                                    template.titleLineSpacing * CANVAS_SCALE,
                                    template.titleMaxCharsPerLine
                                )"
                                :key="`bg-${index}`"
                                class="absolute"
                                :style="{
                                    left: `${bgLine.x}px`,
                                    top: `${bgLine.y}px`,
                                    width: `${bgLine.width}px`,
                                    height: `${bgLine.height}px`,
                                    backgroundColor: hexToRgba(template.titleBackgroundColor, template.titleBackgroundOpacity),
                                    borderRadius: template.titleBackgroundShape === 'rounded' ? `${template.titleBackgroundRadius}px` : '0',
                                    zIndex: -1
                                }"
                            ></div>

                            <span
                                v-for="(item, index) in computeTextLayout(
                                    template.titleText,
                                    template.titleDirection,
                                    template.titleFontSize * CANVAS_SCALE,
                                    template.titleCharSpacing * CANVAS_SCALE,
                                    template.titleLineSpacing * CANVAS_SCALE,
                                    template.titleMaxCharsPerLine
                                )"
                                :key="index"
                                class="absolute"
                                :style="{
                                    left: `${item.x}px`,
                                    top: `${item.y}px`,
                                    fontFamily: titleFontFamilyStyle,
                                    fontSize: `${template.titleFontSize * CANVAS_SCALE}px`,
                                    fontWeight: template.titleFontWeight,
                                    color: template.titleColor,
                                    WebkitTextStroke: template.titleStrokeWidth > 0
                                        ? `${template.titleStrokeWidth * CANVAS_SCALE}px ${template.titleStrokeColor}`
                                        : '0px transparent',
                                    textShadow: titleTextShadowStyle,
                                }"
                            >
                                {{ item.char }}
                            </span>
                        </div>

                        <!-- 副标题背景（独立元素，可拖拽和调整大小） -->
                        <!-- 多边形使用SVG渲染，矩形使用div -->
                        <svg
                            v-if="template.subtitleBackgroundEnabled && template.subtitleBackgroundShape === 'polygon' && template.subtitleBackgroundPoints && template.subtitleBackgroundPoints.length >= 3"
                            class="absolute pointer-events-none"
                            :style="{
                                left: 0,
                                top: 0,
                                width: `${CANVAS_WIDTH * CANVAS_SCALE}px`,
                                height: `${CANVAS_HEIGHT * CANVAS_SCALE}px`,
                                zIndex: layerZIndex.subtitleBackground,
                                overflow: 'visible'
                            }"
                        >
                            <polygon
                                :points="template.subtitleBackgroundPoints.map(pt => {
                                    const pos = getBackgroundPointPosition(template.subtitleBackgroundSize, template.subtitleBackgroundPosition, pt);
                                    return `${Math.round(pos.x)},${Math.round(pos.y)}`;
                                }).join(' ')"
                                :fill="hexToRgba(template.subtitleBackgroundColor, template.subtitleBackgroundOpacity)"
                                class="cursor-move"
                                @mousedown="(e) => startDrag(e, 'subtitleBackground')"
                                @click.stop="(e) => addBackgroundPoint('subtitle', e)"
                                style="pointer-events: all;"
                            />
                            <!-- 虚线边框用于显示可拖拽区域 -->
                            <polygon
                                v-if="activeLayer === 'subtitleBackground'"
                                :points="template.subtitleBackgroundPoints.map(pt => {
                                    const pos = getBackgroundPointPosition(template.subtitleBackgroundSize, template.subtitleBackgroundPosition, pt);
                                    return `${Math.round(pos.x)},${Math.round(pos.y)}`;
                                }).join(' ')"
                                fill="none"
                                stroke="#9ca3af"
                                stroke-width="2"
                                stroke-dasharray="5,5"
                                style="pointer-events: none;"
                            />
                        </svg>
                        
                        <div
                            v-if="template.subtitleBackgroundEnabled && (template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded')"
                            class="absolute cursor-move border-2 border-dashed border-gray-400 transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'subtitleBackground' }"
                            :style="{
                                ...getTextBackgroundStyle(
                                    template.subtitleBackgroundSize,
                                    template.subtitleBackgroundPosition
                                ),
                                zIndex: layerZIndex.subtitleBackground,
                                backgroundColor: hexToRgba(template.subtitleBackgroundColor, template.subtitleBackgroundOpacity),
                                borderRadius: template.subtitleBackgroundShape === 'rounded'
                                    ? `${template.subtitleBackgroundRadius}px`
                                    : '0',
                                transform: `rotate(${template.subtitleBackgroundRotation || 0}deg)`,
                                transformOrigin: 'center center',
                            }"
                            @mousedown="(e) => startDrag(e, 'subtitleBackground')"
                        >
                            <!-- 调整大小控制点 -->
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-nw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'nw')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-ne-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'ne')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-sw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'sw')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-blue-700 cursor-se-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'se')"
                            ></div>
                            <!-- 边框中点控制点 -->
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-n-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'n')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-s-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 's')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-w-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'w')"
                            ></div>
                            <div
                                v-if="template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded'"
                                class="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border border-blue-700 cursor-e-resize"
                                @mousedown.stop="(e) => startDrag(e, 'subtitleBackground', 'e')"
                            ></div>
                        </div>
                        
                        <!-- 副标题多边形控制点（独立层，增大尺寸便于选中） -->
                        <template v-if="template.subtitleBackgroundEnabled && template.subtitleBackgroundShape === 'polygon' && template.subtitleBackgroundPoints && template.subtitleBackgroundPoints.length > 0">
                            <div
                                v-for="(point, index) in template.subtitleBackgroundPoints"
                                :key="index"
                                class="absolute bg-red-500 border-2 border-red-700 rounded-full cursor-move hover:scale-125 transition-transform"
                                :style="{
                                    width: '16px',
                                    height: '16px',
                                    left: `${getBackgroundPointPosition(
                                        template.subtitleBackgroundSize,
                                        template.subtitleBackgroundPosition,
                                        point
                                    ).x - 8}px`,
                                    top: `${getBackgroundPointPosition(
                                        template.subtitleBackgroundSize,
                                        template.subtitleBackgroundPosition,
                                        point
                                    ).y - 8}px`,
                                    zIndex: 1000,
                                }"
                                @mousedown.stop="(e) => startDragBackgroundPoint(e, 'subtitle', index)"
                                @contextmenu.prevent.stop="(e) => { e.preventDefault(); e.stopPropagation(); removeBackgroundPoint('subtitle', index, e); }"
                            ></div>
                        </template>
                        
                        <!-- 副标题文字（可拖拽） -->
                        <div
                            v-if="template.subtitleText"
                            :key="`subtitle-${template.subtitleFontFamily}-${template.subtitleFontSize}-${template.subtitleDirection}-${template.subtitleCharSpacing}-${template.subtitleLineSpacing}-${template.subtitleMaxCharsPerLine}-${fontLoadKey}`"
                            class="absolute cursor-move select-none transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'subtitle' }"
                            :style="{
                                ...getElementStyleWithSize(template.subtitlePosition, getTextLayoutSize(
                                    template.subtitleText,
                                    template.subtitleDirection,
                                    template.subtitleFontSize * CANVAS_SCALE,
                                    template.subtitleCharSpacing * CANVAS_SCALE,
                                    template.subtitleLineSpacing * CANVAS_SCALE,
                                    template.subtitleMaxCharsPerLine
                                )),
                                zIndex: layerZIndex.subtitle,
                                transform: `rotate(${template.subtitleRotation || 0}deg)`,
                                transformOrigin: 'center center',
                                pointerEvents: 'auto'
                            }"
                            @mousedown="(e) => startDrag(e, 'subtitle')"
                        >
                            <!-- 自适应副标题背景 (render text background rects) -->
                            <div 
                                v-if="template.subtitleBackgroundEnabled && (template.subtitleBackgroundShape === 'rectangle' || template.subtitleBackgroundShape === 'rounded')"
                                v-for="(bgLine, index) in computeTextLines(
                                    template.subtitleText,
                                    template.subtitleDirection,
                                    template.subtitleFontSize * CANVAS_SCALE,
                                    template.subtitleCharSpacing * CANVAS_SCALE,
                                    template.subtitleLineSpacing * CANVAS_SCALE,
                                    template.subtitleMaxCharsPerLine
                                )"
                                :key="`bg-${index}`"
                                class="absolute"
                                :style="{
                                    left: `${bgLine.x}px`,
                                    top: `${bgLine.y}px`,
                                    width: `${bgLine.width}px`,
                                    height: `${bgLine.height}px`,
                                    backgroundColor: hexToRgba(template.subtitleBackgroundColor, template.subtitleBackgroundOpacity),
                                    borderRadius: template.subtitleBackgroundShape === 'rounded' ? `${template.subtitleBackgroundRadius}px` : '0',
                                    zIndex: -1
                                }"
                            ></div>

                            <span
                                v-for="(item, index) in computeTextLayout(
                                    template.subtitleText,
                                    template.subtitleDirection,
                                    template.subtitleFontSize * CANVAS_SCALE,
                                    template.subtitleCharSpacing * CANVAS_SCALE,
                                    template.subtitleLineSpacing * CANVAS_SCALE,
                                    template.subtitleMaxCharsPerLine
                                )"
                                :key="index"
                                class="absolute"
                                :style="{
                                    left: `${item.x}px`,
                                    top: `${item.y}px`,
                                    fontFamily: subtitleFontFamilyStyle,
                                    fontSize: `${template.subtitleFontSize * CANVAS_SCALE}px`,
                                    fontWeight: template.subtitleFontWeight,
                                    color: template.subtitleColor,
                                    WebkitTextStroke: template.subtitleStrokeWidth > 0
                                        ? `${template.subtitleStrokeWidth * CANVAS_SCALE}px ${template.subtitleStrokeColor}`
                                        : '0px transparent',
                                    textShadow: subtitleTextShadowStyle,
                                }"
                            >
                                {{ item.char }}
                            </span>
                        </div>

                        <!-- 蒙版（可拖拽和调整大小） -->
                        <div
                            v-if="template.maskEnabled"
                            class="absolute border-2 border-dashed border-purple-500 transition-all"
                            :class="{ 'ring-2 ring-blue-400': activeLayer === 'mask' }"
                            :style="{
                                ...getElementStyle(template.maskPosition, template.maskSize),
                                zIndex: layerZIndex.mask,
                                backgroundColor: template.maskColor || '#000000',
                                opacity: template.maskOpacity / 100,
                            }"
                            @mousedown="(e) => startDrag(e, 'mask')"
                        >
                            <div class="w-full h-full flex items-center justify-center text-xs text-purple-700 cursor-move">
                                {{ template.maskImagePath ? t("蒙版图片") : t("蒙版") }}
                            </div>
                            <!-- 调整大小控制点 -->
                            <div
                                class="absolute -top-1 -left-1 w-3 h-3 bg-purple-500 border border-purple-700 cursor-nw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'nw')"
                            ></div>
                            <div
                                class="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 border border-purple-700 cursor-ne-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'ne')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -left-1 w-3 h-3 bg-purple-500 border border-purple-700 cursor-sw-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'sw')"
                            ></div>
                            <div
                                class="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 border border-purple-700 cursor-se-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'se')"
                            ></div>
                            <div
                                class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 border border-purple-700 cursor-n-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'n')"
                            ></div>
                            <div
                                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-500 border border-purple-700 cursor-s-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 's')"
                            ></div>
                            <div
                                class="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 border border-purple-700 cursor-w-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'w')"
                            ></div>
                            <div
                                class="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-purple-500 border border-purple-700 cursor-e-resize"
                                @mousedown.stop="(e) => startDrag(e, 'mask', 'e')"
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>
/* ⚠️ 已禁用静态字体加载 - 改用动态加载（font:// 协议）
 * 原因：静态 @font-face 使用的 /ziti/ 相对路径在打包环境中不可用
 * 所有字体现在通过 loadFontForPreview() 函数动态加载，使用 font:// 自定义协议
 * 该协议在开发和打包环境都能正确工作
 */

/*
加载本地字体文件 - 中文字体
@font-face {
    font-family: 'Maoken Assorted Sans';
    src: url('/ziti/MaokenAssortedSans.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Maoken Assorted Sans Lite';
    src: url('/ziti/MaokenAssortedSans-Lite.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Mo Qu Gu Feng Ti';
    src: url('/ziti/墨趣古风体.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'PingFang Zhang Yaling Hei';
    src: url('/ziti/平方张亚玲黑方体.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}

@font-face {
    font-family: 'Hu Xiaobo Sao Bao Ti';
    src: url('/ziti/胡晓波骚包体2.0.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

加载本地字体文件 - 手写体
@font-face {
    font-family: 'Dymon ShouXieTi';
    src: url('/ziti/Dymon-ShouXieTi.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
}

加载本地字体文件 - 日文字体
@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Regular.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Thin.ttf') format('truetype');
    font-weight: 100;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-ExtraLight.ttf') format('truetype');
    font-weight: 200;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Light.ttf') format('truetype');
    font-weight: 300;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Medium.ttf') format('truetype');
    font-weight: 500;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-SemiBold.ttf') format('truetype');
    font-weight: 600;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Bold.ttf') format('truetype');
    font-weight: 700;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-ExtraBold.ttf') format('truetype');
    font-weight: 800;
    font-style: normal;
}

@font-face {
    font-family: 'Murecho';
    src: url('/ziti/Murecho-Black.ttf') format('truetype');
    font-weight: 900;
    font-style: normal;
}

@font-face {
    font-family: 'Keinan Maru Pop JP';
    src: url('/ziti/けいなん丸ポップ体JP.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}
*/

/* 模态框高度约束 */
:deep(.arco-modal) {
    display: flex;
    flex-direction: column;
}

:deep(.arco-modal-content) {
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

:deep(.arco-modal-body) {
    padding: 0;
    height: 100%;
    overflow: hidden;
}

.cover-editor-modal {
    /* 确保模态框内容完全包含，不显示多余的白色区域 */
}
</style>

