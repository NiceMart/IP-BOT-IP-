<script setup lang="ts" name="SubtitleStyleSelector">
import { ref, computed, watch, onMounted, onBeforeUnmount, onErrorCaptured } from "vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { Message } from '@arco-design/web-vue';
import StyleService from "../../../service/StyleService";

// 字幕样式定义
export interface SubtitleStyle {
    id: string;
    name: string;
    description: string;
    preview: string;
    fontName: string;
    fontSize: number;
    fontColor: string;
    outlineColor: string;
    outlineWidth: number;
    shadowOffset: number;
    shadowColor: string;
    shadowBlur: number;
    backgroundColor: string;
    backgroundOpacity: number;
    position: 'bottom' | 'top' | 'center';
    alignment: 'center' | 'left' | 'right';
}

const props = defineProps<{
    modelValue?: string;
    fontSizeScale?: number;
    subtitlePosition?: 'top' | 'center' | 'bottom';
    skipInitialLoad?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'update:fontSizeScale', value: number): void;
    (e: 'update:subtitlePosition', value: 'top' | 'center' | 'bottom'): void;
    (e: 'style-change', style: SubtitleStyle): void;
}>();

// 颜色格式规范化函数 - 确保返回大写的#RRGGBB格式
const normalizeColorFormat = (color: any): string => {
    if (!color) return '#FFFFFF';

    // 🆕 修复：处理 transparent
    if (String(color).toLowerCase() === 'transparent') {
        return 'transparent';
    }

    // 如果已经是字符串，进行处理
    if (typeof color === 'string') {
        color = color.trim();
        // 如果不以#开头，添加#
        if (!color.startsWith('#')) {
            color = '#' + color;
        }
        // 转换为大写
        color = color.toUpperCase();
        // 提取hex部分（移除#）
        const hex = color.replace('#', '').toUpperCase();
        // 确保是6个字符
        if (hex.length === 8) {
            return '#' + hex.slice(0, 6);
        }
        if (hex.length === 6) {
            return '#' + hex;
        }
    }

    console.warn('[normalizeColorFormat] Invalid color format:', color);
    return '#FFFFFF';
};

// 字体大小调节（相对于原始大小的百分比）
const fontSizeScale = ref<number>(props.fontSizeScale || 100);  // 默认100%

// 字幕位置
const subtitlePosition = ref<'top' | 'center' | 'bottom'>(props.subtitlePosition || 'bottom');

// 可用字体列表（初始化默认字体）
// 自定义字体目录中的字体列表
const customZitiFonts = [
    { value: '1.程荣光刻楷', label: '1.程荣光刻楷', source: 'custom', filename: '1.程荣光刻楷.ttf' },
    { value: 'MaokenAssortedSans-Lite', label: 'MaokenAssortedSans-Lite', source: 'custom', filename: 'MaokenAssortedSans-Lite.ttf' },
    { value: 'Murecho-ExtraBold', label: 'Murecho-ExtraBold', source: 'custom', filename: 'Murecho-ExtraBold.ttf' },
    { value: 'Murecho-ExtraLight', label: 'Murecho-ExtraLight', source: 'custom', filename: 'Murecho-ExtraLight.ttf' },
    { value: 'USMCCyuanjiantecu', label: 'USMCCyuanjiantecu', source: 'custom', filename: 'USMCCyuanjiantecu.otf' },
    { value: '斗鱼追光体2.0', label: '斗鱼追光体2.0', source: 'custom', filename: '斗鱼追光体2.0.ttf' },
    { value: '飞波正点体V2.1', label: '飞波正点体V2.1', source: 'custom', filename: '飞波正点体V2.1.ttf' },
    { value: '胡晓波骚包体2.0', label: '胡晓波骚包体2.0', source: 'custom', filename: '胡晓波骚包体2.0.otf' },
    { value: '浪课江湖联盟简体', label: '浪课江湖联盟简体', source: 'custom', filename: '浪课江湖联盟简体.ttf' },
    { value: '猫啃珠圆体', label: '猫啃珠圆体', source: 'custom', filename: '猫啃珠圆体 MaokenZhuyuanTi.ttf' },
    { value: '墨趣古风体', label: '墨趣古风体', source: 'custom', filename: '墨趣古风体.ttf' },
    { value: '平方张亚玲黑方体', label: '平方张亚玲黑方体', source: 'custom', filename: '平方张亚玲黑方体.ttf' },
    { value: '千图厚黑体', label: '千图厚黑体', source: 'custom', filename: '千图厚黑体.ttf' },
    { value: '心朵儿体', label: '心朵儿体', source: 'custom', filename: '心朵儿体.ttf' },
    { value: '字玩哥特黑白无常', label: '字玩哥特黑白无常', source: 'custom', filename: '字玩哥特黑白无常 免费 超黑.ttf' }
];

// 系统字体列表
const systemFonts = [
    { value: 'Microsoft YaHei Bold', label: 'Microsoft YaHei Bold (中文/通用)', source: 'system', isInternational: false },
    { value: 'SimHei', label: 'SimHei (黑体-中文)', source: 'system', isInternational: false },
    { value: 'SimSun', label: 'SimSun (宋体-中文)', source: 'system', isInternational: false },
    { value: 'Arial', label: 'Arial (英文/西欧)', source: 'system', isInternational: false },
    { value: 'Malgun Gothic', label: '🌍 Malgun Gothic (韩语)', source: 'system', isInternational: true },
    { value: 'Meiryo', label: '🌍 Meiryo (日语)', source: 'system', isInternational: true },
    { value: 'Segoe UI', label: 'Segoe UI (多语言通用)', source: 'system', isInternational: false }
];

const availableFonts = ref<any[]>([
    ...systemFonts,
    ...customZitiFonts
]);

// 加载字体列表
const loadFonts = async () => {
    try {
        console.log('[SubtitleStyleSelector] 开始加载字体列表...');
        if (!window.$mapi || !window.$mapi.fontManager) {
            console.warn('[SubtitleStyleSelector] fontManager 不可用，使用本地字体列表（系统 + 自定义）');
            availableFonts.value = [
                ...systemFonts,
                ...customZitiFonts
            ];
            console.log('[SubtitleStyleSelector] 加载字体列表成功 (本地):', availableFonts.value.length, '个字体');
            return;
        }
        const result = await window.$mapi.fontManager.getAllFonts();
        if (result && result.success) {
            // ✅ API 已经合并并去重了所有字体源（系统、Ziti、Bundled）
            // 直接使用 API 返回的完整列表，避免重复
            const apiFonts = result.data || [];
            availableFonts.value = apiFonts;
            console.log('[SubtitleStyleSelector] 加载字体列表成功 (API):', availableFonts.value.length, '个字体 (已去重)');
        } else {
            console.warn('[SubtitleStyleSelector] 加载字体失败:', result?.message || '未知错误');
            // 仅在 API 失败时使用本地硬编码作为备选
            availableFonts.value = [
                ...systemFonts,
                ...customZitiFonts
            ];
            console.log('[SubtitleStyleSelector] 使用本地字体列表（系统 + 自定义）:', availableFonts.value.length, '个字体');
        }
    } catch (error) {
        console.error('[SubtitleStyleSelector] 加载字体异常:', error);
        availableFonts.value = [
            ...systemFonts,
            ...customZitiFonts
        ];
        console.log('[SubtitleStyleSelector] 使用本地字体列表（系统 + 自定义）:', availableFonts.value.length, '个字体');
    }
};

// 默认字幕样式 - 打开时默认无背景（用户主动选择背景后才启用）
const defaultStyle: SubtitleStyle = {
    id: 'custom',
    name: '自定义样式',
    description: '完全自定义的字幕样式',
    preview: '示例文字',
    fontName: 'Microsoft YaHei Bold',
    fontSize: 48,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 3,
    shadowOffset: 2,
    shadowColor: '#000000',
    shadowBlur: 4,
    backgroundColor: 'transparent',  // 默认无背景 - 用户可自由选择
    backgroundOpacity: 0,            // 默认无背景时透明度为 0
    position: 'bottom',
    alignment: 'center'
};

// 自定义字幕样式（从本地存储加载或使用默认值）
// 确保总是有一个有效的值，防止 undefined 错误
const customStyle = ref<SubtitleStyle>({ ...defaultStyle });

// 🔧 关键修复：记住当前加载的 styleId，用于后续保存
const currentStyleId = ref<string>('current');

// 🆕 初始化状态追踪（修复 fontColor 时序问题）
const isInitialized = ref(false);
const isLoading = ref(false);
const initializationPromise = ref<Promise<void> | null>(null);

// 安全访问器：确保 customStyle 值永远有效，从不 undefined
const safeCustomStyle = computed(() => {
    const current = customStyle.value;

    // 如果当前值无效，返回默认值
    if (!current || typeof current !== 'object') {
        return { ...defaultStyle };
    }

    // 确保所有必需字段都存在
    return {
        id: current.id || defaultStyle.id,
        name: current.name || defaultStyle.name,
        description: current.description || defaultStyle.description,
        preview: current.preview || defaultStyle.preview,
        fontName: current.fontName || defaultStyle.fontName,
        fontSize: current.fontSize || defaultStyle.fontSize,
        fontColor: current.fontColor || defaultStyle.fontColor,
        outlineColor: current.outlineColor || defaultStyle.outlineColor,
        outlineWidth: current.outlineWidth !== undefined ? current.outlineWidth : defaultStyle.outlineWidth,
        shadowOffset: current.shadowOffset !== undefined ? current.shadowOffset : defaultStyle.shadowOffset,
        shadowColor: current.shadowColor || defaultStyle.shadowColor,
        shadowBlur: current.shadowBlur !== undefined ? current.shadowBlur : defaultStyle.shadowBlur,
        backgroundColor: current.backgroundColor || defaultStyle.backgroundColor,
        backgroundOpacity: current.backgroundOpacity !== undefined ? current.backgroundOpacity : defaultStyle.backgroundOpacity,
        position: current.position || defaultStyle.position,
        alignment: current.alignment || defaultStyle.alignment
    };
});

// 防护函数：确保 customStyle.value 总是有效
const ensureCustomStyleValid = () => {
    if (!customStyle.value || typeof customStyle.value !== 'object') {
        customStyle.value = { ...defaultStyle };
        console.warn('[SubtitleStyleSelector] customStyle.value 为 undefined 或无效，已重置为默认值');
    } else if (!customStyle.value.fontName) {
        // 确保至少有 fontName 属性
        customStyle.value.fontName = defaultStyle.fontName;
        console.warn('[SubtitleStyleSelector] customStyle.value.fontName 缺失，已设置默认值');
    }

    // 新增：检查所有颜色字段
    if (!customStyle.value.fontColor) {
        customStyle.value.fontColor = defaultStyle.fontColor;
        console.warn('[SubtitleStyleSelector] customStyle.value.fontColor 缺失，已设置默认值');
    }
    if (!customStyle.value.outlineColor) {
        customStyle.value.outlineColor = defaultStyle.outlineColor;
        console.warn('[SubtitleStyleSelector] customStyle.value.outlineColor 缺失，已设置默认值');
    }
    if (!customStyle.value.backgroundColor) {
        customStyle.value.backgroundColor = defaultStyle.backgroundColor;
        console.warn('[SubtitleStyleSelector] customStyle.value.backgroundColor 缺失，已设置默认值');
    }

    // 确保描边相关属性存在
    if (customStyle.value.outlineWidth === undefined || customStyle.value.outlineWidth === null) {
        customStyle.value.outlineWidth = defaultStyle.outlineWidth;
        console.warn('[SubtitleStyleSelector] customStyle.value.outlineWidth 缺失，已设置默认值:', defaultStyle.outlineWidth);
    }
    if (customStyle.value.shadowOffset === undefined || customStyle.value.shadowOffset === null) {
        customStyle.value.shadowOffset = defaultStyle.shadowOffset;
        console.warn('[SubtitleStyleSelector] customStyle.value.shadowOffset 缺失，已设置默认值:', defaultStyle.shadowOffset);
    }

    // 确保 fontSize 存在
    if (customStyle.value.fontSize === undefined || customStyle.value.fontSize === null) {
        customStyle.value.fontSize = defaultStyle.fontSize;
        console.warn('[SubtitleStyleSelector] customStyle.value.fontSize 缺失，已设置默认值:', defaultStyle.fontSize);
    }

    // 确保 backgroundOpacity 存在
    if (customStyle.value.backgroundOpacity === undefined || customStyle.value.backgroundOpacity === null) {
        customStyle.value.backgroundOpacity = defaultStyle.backgroundOpacity;
        console.warn('[SubtitleStyleSelector] customStyle.value.backgroundOpacity 缺失，已设置默认值:', defaultStyle.backgroundOpacity);
    }

    // 确保 shadowColor 存在
    if (!customStyle.value.shadowColor) {
        customStyle.value.shadowColor = defaultStyle.shadowColor;
        console.warn('[SubtitleStyleSelector] customStyle.value.shadowColor 缺失，已设置默认值:', defaultStyle.shadowColor);
    }

    // 确保 shadowBlur 存在
    if (customStyle.value.shadowBlur === undefined || customStyle.value.shadowBlur === null) {
        customStyle.value.shadowBlur = defaultStyle.shadowBlur;
        console.warn('[SubtitleStyleSelector] customStyle.value.shadowBlur 缺失，已设置默认值:', defaultStyle.shadowBlur);
    }
};

// 保存"无背景模式下的描边宽度"，用于背景和无背景之间切换时恢复
const savedOutlineWidthWithoutBackground = ref<number>(3);

// 保存上次选择的背景颜色（当切换无背景时用于恢复）
const lastSelectedBackgroundColor = ref<string>('#000000');

// 保存上次选择的阴影偏移值（当切换无阴影时用于恢复）
const lastSelectedShadowOffset = ref<number>(2);

// 🔧 修复：使用普通 ref 代替 computed，因为 Arco Design checkbox 可能不支持 computed setter
const noShadow = ref<boolean>(false);

// 监听 customStyle.shadowOffset 变化，同步更新 noShadow
watch(() => customStyle.value?.shadowOffset, (newValue) => {
    const shouldBeNoShadow = newValue === 0;
    if (noShadow.value !== shouldBeNoShadow) {
        noShadow.value = shouldBeNoShadow;
        console.log('[watch shadowOffset] 同步 noShadow 状态:', shouldBeNoShadow);
    }
}, { immediate: true });

// 监听 noShadow 变化，更新 customStyle.shadowOffset
watch(noShadow, (val) => {
    console.log('[watch noShadow] 🔔 用户操作:', val ? '勾选无阴影' : '取消无阴影');

    // 🔧 防护：确保 customStyle.value 存在
    if (!customStyle.value) {
        console.error('[watch noShadow] ❌ customStyle.value 为 undefined，无法设置');
        return;
    }

    if (val) {
        // 勾选'无阴影' - 保存当前值并设置为0
        if (customStyle.value.shadowOffset > 0) {
            lastSelectedShadowOffset.value = customStyle.value.shadowOffset;
            console.log('[watch noShadow] 📝 保存当前阴影偏移:', lastSelectedShadowOffset.value);
        }
        customStyle.value.shadowOffset = 0;
        console.log('[watch noShadow] ✅ 已设置 shadowOffset = 0');
        console.log('[watch noShadow] 验证: customStyle.value.shadowOffset =', customStyle.value.shadowOffset);
    } else {
        // 取消'无阴影' - 恢复上次保存的阴影偏移
        const restored = lastSelectedShadowOffset.value || 2;
        customStyle.value.shadowOffset = restored;
        console.log('[watch noShadow] ✅ 已恢复阴影偏移为:', customStyle.value.shadowOffset);
    }
});

// 保存状态标志
const isSaving = ref<boolean>(false);

// 从数据库加载保存的样式
const loadCustomStyle = async () => {
    try {
        // 🔧 修复：检查当前样式是否已有有效数据
        const currentStyleValid = customStyle.value &&
                                 typeof customStyle.value === 'object' &&
                                 customStyle.value.fontColor &&
                                 customStyle.value.fontSize;

        // 首先尝试从数据库加载样式
        console.log('[loadCustomStyle] 准备从数据库加载样式... (当前样式有效:', currentStyleValid, ')');
        const dbStyle = await StyleService.loadStyleFromDatabase();

        let loadedStyle: any;

        if (dbStyle && typeof dbStyle === 'object') {
            console.log('[loadCustomStyle] ✅ 从数据库加载样式成功:', dbStyle);
            loadedStyle = { ...defaultStyle, ...dbStyle };
        } else {
            // 如果数据库中没有样式，尝试从localStorage加载（兼容旧数据）
            console.log('[loadCustomStyle] ⚠️ 数据库中无样式，尝试从localStorage加载...');
            const saved = StorageUtil.getObject("SubtitleStyleSelector.customStyle");
            if (saved && typeof saved === 'object') {
                console.log('[loadCustomStyle] 从localStorage加载到样式，将其迁移到数据库');
                loadedStyle = { ...defaultStyle, ...saved };
            } else {
                console.log('[loadCustomStyle] 未找到保存的样式...');
                // 🔧 修复：如果没有保存的样式，但当前样式有效，则保持当前样式而不是使用默认值
                if (currentStyleValid) {
                    console.log('[loadCustomStyle] ✓ 当前样式有效，保持现有样式');
                    return;
                }
                console.log('[loadCustomStyle] 使用默认值');
                loadedStyle = { ...defaultStyle };
            }
        }

        // 确保fontName是字符串
        if (typeof loadedStyle.fontName === 'object' && loadedStyle.fontName !== null) {
            loadedStyle.fontName = loadedStyle.fontName.value || loadedStyle.fontName.label || defaultStyle.fontName;
            console.log('[loadCustomStyle] 修复字体名称格式:', loadedStyle.fontName);
        } else if (typeof loadedStyle.fontName !== 'string') {
            loadedStyle.fontName = String(loadedStyle.fontName || defaultStyle.fontName);
        }
        loadedStyle.fontName = String(loadedStyle.fontName || 'Microsoft YaHei Bold').trim() || 'Microsoft YaHei Bold';

        // 确保backgroundOpacity是数字
        if (typeof loadedStyle.backgroundOpacity === 'string') {
            if (loadedStyle.backgroundOpacity.endsWith('%')) {
                loadedStyle.backgroundOpacity = parseFloat(loadedStyle.backgroundOpacity) / 100;
            } else {
                loadedStyle.backgroundOpacity = parseFloat(loadedStyle.backgroundOpacity);
            }
        }
        if (isNaN(loadedStyle.backgroundOpacity) || loadedStyle.backgroundOpacity < 0) {
            loadedStyle.backgroundOpacity = defaultStyle.backgroundOpacity;
        } else if (loadedStyle.backgroundOpacity > 1) {
            if (loadedStyle.backgroundOpacity <= 100) {
                loadedStyle.backgroundOpacity = loadedStyle.backgroundOpacity / 100;
            } else {
                loadedStyle.backgroundOpacity = 1;
            }
        }

        // 🔧 修复：只在 backgroundOpacity 为 undefined 时才自动设置为 0.8
        // backgroundOpacity === 0 是用户明确勾选"无背景"的合法值，应该保留
        if (loadedStyle.backgroundColor && loadedStyle.backgroundColor !== 'transparent' &&
            loadedStyle.backgroundOpacity === undefined) {
            loadedStyle.backgroundOpacity = 0.8;
            console.log('[loadCustomStyle] 修复：背景颜色存在但透明度未定义，已自动设置为0.8');
        } else if (loadedStyle.backgroundOpacity === 0) {
            console.log('[loadCustomStyle] 保留用户设置的无背景: backgroundOpacity = 0');
        }

        // 🔧 修复：只修复 undefined 和 null，保留用户明确设置的 0（无阴影）
        // shadowOffset === 0 是用户勾选"无阴影"的合法值，不应该被自动修复
        if (loadedStyle.shadowOffset === undefined ||
            loadedStyle.shadowOffset === null) {
            // 仅对于旧模板（undefined/null）恢复为默认值
            loadedStyle.shadowOffset = defaultStyle.shadowOffset;
            console.log('[loadCustomStyle] 修复：shadowOffset为空（undefined/null），设置为默认值:', loadedStyle.shadowOffset);
        } else if (loadedStyle.shadowOffset === 0) {
            // 保留用户明确设置的 0（无阴影）
            console.log('[loadCustomStyle] 保留用户设置的无阴影: shadowOffset = 0');
        }

        // 确保 shadowColor 有默认值
        if (!loadedStyle.shadowColor) {
            loadedStyle.shadowColor = defaultStyle.shadowColor;
        }

        customStyle.value = loadedStyle;

        // 初始化 lastSelectedBackgroundColor
        if (loadedStyle.backgroundColor && loadedStyle.backgroundColor !== 'transparent') {
            lastSelectedBackgroundColor.value = loadedStyle.backgroundColor;
        }

        // 初始化 lastSelectedShadowOffset
        if (loadedStyle.shadowOffset && loadedStyle.shadowOffset > 0) {
            lastSelectedShadowOffset.value = loadedStyle.shadowOffset;
        }

        console.log('[loadCustomStyle] ✅ 字幕样式加载完成:', customStyle.value);
    } catch (error) {
        console.error('[loadCustomStyle] 加载样式出错:', error);
        ensureCustomStyleValid();
    }

    // 最终确保 customStyle 有效
    ensureCustomStyleValid();
};

// 保存样式到数据库（替代localStorage自动保存）
const saveCustomStyle = async (styleId?: string) => {
    // 防止重复点击
    if (isSaving.value) {
        console.warn('[saveCustomStyle] 正在保存中，请勿重复点击');
        return;
    }

    try {
        isSaving.value = true;
        const styleToSave = { ...customStyle.value };

        // 🔧 关键修复：如果没有传入 styleId，使用记住的 currentStyleId
        const targetStyleId = styleId || currentStyleId.value;

        console.log('[saveCustomStyle] 准备保存样式到数据库:', {
            passedStyleId: styleId,
            currentStyleId: currentStyleId.value,
            targetStyleId,
            fontName: styleToSave.fontName,
            fontSize: styleToSave.fontSize,
            fontColor: styleToSave.fontColor,
            outlineColor: styleToSave.outlineColor,
            outlineWidth: styleToSave.outlineWidth,
            shadowOffset: styleToSave.shadowOffset,
            backgroundColor: styleToSave.backgroundColor,
            backgroundOpacity: styleToSave.backgroundOpacity
        });

        // 保存到数据库（使用 targetStyleId，确保保存到正确的模板样式）
        const result = await StyleService.saveStyle(styleToSave, targetStyleId);

        if (result.success) {
            console.log('✅ 样式已保存到数据库, ID:', result.id);
            Message.success('样式保存成功');
        } else {
            console.error('❌ 样式保存失败:', result.message);
            Message.error('样式保存失败: ' + result.message);
        }
    } catch (error) {
        console.error('[saveCustomStyle] 保存异常:', error);
        Message.error('样式保存异常');
    } finally {
        isSaving.value = false;
    }
};

// 监听字体大小缩放变化并发射事件
watch(fontSizeScale, (newValue) => {
    emit('update:fontSizeScale', newValue);
});

// 监听字幕位置变化并发射事件
watch(subtitlePosition, (newValue) => {
    emit('update:subtitlePosition', newValue);
});

// 注意：已移除自动保存机制，改为仅在用户点击"保存"按钮时手动保存到数据库
// 这样可以确保只有显式的保存操作才能触发数据库持久化

// 预览刷新计数器（用于强制重新渲染）
const previewRefreshKey = ref(0);

// 监听字体名称变化，加载字体并强制刷新预览
watch(() => customStyle.value?.fontName, async (newValue, oldValue) => {
    // 确保字体名称是字符串
    let fontName = newValue;
    if (typeof fontName === 'object' && fontName !== null) {
        fontName = fontName.value || fontName.label || 'Microsoft YaHei Bold';
    } else if (typeof fontName !== 'string') {
        fontName = String(fontName || 'Microsoft YaHei Bold');
    }
    // 防守性编程：确保fontName一定是字符串，然后调用trim()
    fontName = String(fontName || 'Microsoft YaHei Bold').trim() || 'Microsoft YaHei Bold';

    // 加载字体（如果是需要加载的字体）
    if (availableFonts.value.length > 0 && fontName) {
        await loadFontForPreview(fontName);
    }

    // 强制刷新预览（通过更新key来触发重新渲染）
    previewRefreshKey.value++;
    
    // 🆕 发出样式变化事件，通知父组件更新预览
    if (customStyle.value) {
        emit('style-change', { ...customStyle.value });
    }
}, { immediate: false });

// 🆕 添加全局样式变化监听，当任何关键样式属性变化时通知父组件
watch(() => [
    customStyle.value?.fontColor,
    customStyle.value?.fontSize,
    customStyle.value?.outlineColor,
    customStyle.value?.outlineWidth,
    customStyle.value?.backgroundColor,
    customStyle.value?.backgroundOpacity
], () => {
    // 发出样式变化事件，通知父组件更新预览
    if (customStyle.value && !isLoading.value) {
        emit('style-change', { ...customStyle.value });
    }
}, { immediate: false, deep: false });

// 注意：已移除自动保存监听，描边宽度和阴影偏移的变化将在用户点击"保存"按钮时持久化

// 监听背景颜色变化，保存选择的颜色并处理描边逻辑（不自动保存到数据库）
watch(() => customStyle.value?.backgroundColor, (newValue) => {
    // 防护：检查 customStyle.value 是否存在
    if (!customStyle.value || typeof customStyle.value !== 'object') {
        return;
    }

    if (newValue && newValue !== 'transparent') {
        try {
            // 规范化颜色格式
            const normalized = normalizeColorFormat(newValue);
            if (normalized !== newValue) {
                customStyle.value.backgroundColor = normalized;
            }
            // 保存用户选择的背景颜色
            lastSelectedBackgroundColor.value = normalized;
            console.log('[背景色监视] 已保存背景颜色:', normalized);

            // 关键修复：当选择背景颜色时，如果背景透明度为0，自动设置为0.8
            // 这样确保后端的 hasValidBackground 条件能够满足（需要 backgroundOpacity > 0）
            // 🆕 修复：仅在非加载状态下自动设置透明度，避免覆盖加载的设置
            if (!isLoading.value) {
                if (customStyle.value.backgroundOpacity === 0 || customStyle.value.backgroundOpacity === undefined) {
                    customStyle.value.backgroundOpacity = 0.8;
                    console.log('✓ 已启用背景，自动设置背景透明度为 0.8');
                }
            } else {
                console.log('[背景色监视] 加载中，跳过自动设置透明度');
            }

            // 注意：后端已支持 BorderStyle = 4（既有背景又有描边）
            // 所以不再需要自动禁用描边，用户可以同时使用背景和描边
            console.log('✓ 已启用背景，用户可继续使用描边（后端支持 BorderStyle=4）');
            // 注意：此处移除了 debouncedSave() 调用，改为在用户点击"保存"按钮时保存
        } catch (err) {
            console.error('[背景色监视] 处理失败:', err);
        }
    }
}, { immediate: false });

// 注意：已移除对 customStyle 的自动保存监听
// 样式的持久化现在仅在用户点击"保存"按钮时进行

// 🆕 监听外部传入的 modelValue (styleId) 变化
watch(() => props.modelValue, async (newVal) => {
    if (newVal && newVal !== currentStyleId.value) {
        console.log('[watch modelValue] External style ID changed:', newVal);
        await loadStyle(newVal);
    }
}, { immediate: false });

// 组件挂载时加载保存的样式和字体列表
onMounted(async () => {
    // 🆕 防止重复初始化
    if (isLoading.value) {
        console.warn('[SubtitleStyleSelector] 已经在初始化中，跳过重复调用');
        return initializationPromise.value;
    }

    isLoading.value = true;

    // 🆕 创建初始化Promise，允许外部等待
    initializationPromise.value = (async () => {
        try {
            console.log('[SubtitleStyleSelector] Component mounted, initializing...');

            // 防护层1：立即确保 customStyle 有基础值
            if (!customStyle.value || typeof customStyle.value !== 'object') {
                console.warn('[SubtitleStyleSelector:onMounted] customStyle.value 无效，立即重置为默认值');
                customStyle.value = { ...defaultStyle };
            }

            // 防护层2：调用验证函数
            ensureCustomStyleValid();  // 确保 customStyle 有效

            // 防护层3：加载样式 (优先使用 props.modelValue)
            try {
                // 🔧 修复：检查当前样式是否已有有效数据，避免不必要地重新加载
                const hasValidStyle = customStyle.value &&
                                     typeof customStyle.value === 'object' &&
                                     customStyle.value.fontColor &&
                                     customStyle.value.fontSize;

                if (props.skipInitialLoad) {
                    console.log('[SubtitleStyleSelector] skipInitialLoad=true, skipping mounted style bootstrap');
                } else if (props.modelValue) {
                    console.log('[SubtitleStyleSelector] onMounted detected modelValue, loading:', props.modelValue);
                    await Promise.race([
                        loadStyle(props.modelValue),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('加载指定样式超时')), 5000))
                    ]);
                } else if (!hasValidStyle) {
                    // 没有 modelValue，且当前样式无效时，才加载默认保存的样式
                    console.log('[SubtitleStyleSelector] No modelValue and no valid style, loading saved custom style');
                    await Promise.race([
                        loadCustomStyle(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('加载样式超时')), 5000))
                    ]);
                } else {
                    // 🔧 有效样式存在，保持当前样式
                    console.log('[SubtitleStyleSelector] onMounted: 检测到有效样式，保持现有样式');
                }
            } catch (loadErr) {
                console.warn('[SubtitleStyleSelector] 加载样式超时或失败:', loadErr);
                ensureCustomStyleValid();
            }

            // 防护层4：再次验证，确保 loadCustomStyle 不会导致无效状态
            ensureCustomStyleValid();

            // 并行加载字体，不阻塞UI
            loadFonts().catch(err => {
                console.warn('[SubtitleStyleSelector] 字体加载失败:', err);
            });

            // ✅ 标记初始化完成
            isInitialized.value = true;
            console.log('[SubtitleStyleSelector] ✅ 初始化完成. customStyle:', {
                fontName: customStyle.value.fontName,
                fontSize: customStyle.value.fontSize,
                fontColor: customStyle.value.fontColor,
                outlineColor: customStyle.value.outlineColor,
                outlineWidth: customStyle.value.outlineWidth,  // 关键：检查初始值
                shadowOffset: customStyle.value.shadowOffset,
                backgroundColor: customStyle.value.backgroundColor,
                backgroundOpacity: customStyle.value.backgroundOpacity
            });

            // 监听字体列表变更事件
            try {
                const unsubscribe = window.$mapi?.fontManager?.onFontsChanged?.(() => {
                    console.log('[SubtitleStyleSelector] Fonts changed, reloading...');
                    loadFonts();
                });

                // 组件卸载时取消监听
                if (unsubscribe) {
                    onBeforeUnmount(() => {
                        unsubscribe();
                    });
                }
            } catch (err) {
                console.error('[SubtitleStyleSelector] Font manager listener setup failed:', err);
            }
        } catch (error) {
            console.error('[SubtitleStyleSelector] 初始化失败:', error);
            ensureCustomStyleValid();
            isInitialized.value = true; // 即使失败也标记完成，使用默认值
        } finally {
            isLoading.value = false;
        }
    })();

    return initializationPromise.value;
});

// 计算实际的字体大小（应用缩放）
const getActualFontSize = (baseFontSize: number) => {
    return Math.round(baseFontSize * (fontSizeScale.value / 100));
};

// 加载字体到浏览器（用于预览）
const loadFontForPreview = async (fontName: string) => {
    try {
        // 防守：确保fontName是字符串
        if (!fontName || typeof fontName !== 'string') {
            console.warn('[loadFontForPreview] 无效的字体名:', fontName);
            return;
        }

        // 在字体列表中查找对应的字体信息
        const fontInfo = availableFonts.value?.find(f => f?.value === fontName);

        if (!fontInfo) {
            console.log('[loadFontForPreview] 未找到字体信息:', fontName);
            return;
        }

        // 只有 ziti 字体需要动态加载（因为可能有路径）
        if (fontInfo.source === 'ziti' && fontInfo.path) {
            try {
                console.log('[loadFontForPreview] 加载字体:', fontName, 'from:', fontInfo.path);

                // ✅ 修复：使用 font:// 自定义协议加载字体（支持打包环境）
                // fontInfo.path 已经包含完整路径，例如: C:\...\ziti\Murecho-Regular.ttf
                const fontUrl = `font://${encodeURIComponent(fontInfo.path)}`;

                // 创建 style 标签注入 @font-face
                const styleId = `font-face-preview-${fontName.replace(/\s+/g, '-')}`;
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

                console.log('[loadFontForPreview] Font face created with URL:', fontUrl);

                // 等待字体加载
                if (document.fonts && document.fonts.check) {
                    await document.fonts.ready;
                    console.log('[loadFontForPreview] Font loaded successfully:', fontName);
                }
            } catch (error) {
                console.error('[loadFontForPreview] Failed to load font:', fontName, error);
            }
        } else {
            console.log('[loadFontForPreview] 字体无需加载 (系统或预置字体):', fontName);
        }
    } catch (outerErr) {
        console.error('[loadFontForPreview] 加载字体失败:', outerErr);
    }
};

// 计算预览样式，确保所有属性都能实时更新
const previewStyle = computed(() => {
    try {
        // 使用 safeCustomStyle 确保样式永远有效
        const style = safeCustomStyle.value;

        // safeCustomStyle 已保证返回有效对象，但再做一次防护
        if (!style || typeof style !== 'object') {
            throw new Error('style is invalid');
        }

        // 完整防护：确保所有必需属性都存在
        const fontColor = style?.fontColor || '#FFFFFF';
        const outlineColor = style?.outlineColor || '#000000';
        const outlineWidth = style?.outlineWidth || 3;
        const backgroundColor = style?.backgroundColor || 'transparent';
        const backgroundOpacity = style?.backgroundOpacity ?? 0;
        const shadowOffset = style?.shadowOffset || 2;
        const shadowColor = style?.shadowColor || '#000000';
        const shadowBlur = style?.shadowBlur ?? 4;
        const fontSize = style?.fontSize || 48;

        // 确保字体名称是字符串
        let fontName = style?.fontName || 'Microsoft YaHei Bold';
        if (typeof fontName === 'object' && fontName !== null) {
            fontName = fontName.value || fontName.label || 'Microsoft YaHei Bold';
        } else if (typeof fontName !== 'string') {
            fontName = String(fontName || 'Microsoft YaHei Bold');
        }
        fontName = String(fontName || 'Microsoft YaHei Bold').trim() || 'Microsoft YaHei Bold';

        // 异步加载字体（如果是需要加载的字体）
        if (availableFonts.value && availableFonts.value.length > 0) {
            try {
                loadFontForPreview(fontName).catch(err => {
                    console.error('[previewStyle] 字体加载失败:', err);
                });
            } catch (err) {
                console.error('[previewStyle] 字体加载异常:', err);
            }
        }

        // 计算背景颜色（如果有背景色且不透明）
        let computedBackgroundColor = 'transparent';
        let padding = '0';
        let borderRadius = '0';

        if (backgroundColor && backgroundColor !== 'transparent' && backgroundColor !== undefined) {
            try {
                let opacity = backgroundOpacity ?? 0;

                // 确保透明度是数字
                if (typeof opacity === 'string') {
                    if (opacity.endsWith('%')) {
                        opacity = parseFloat(opacity) / 100;
                    } else {
                        opacity = parseFloat(opacity);
                    }
                }
                if (isNaN(opacity) || opacity < 0) {
                    opacity = 0;
                } else if (opacity > 1) {
                    opacity = opacity <= 100 ? opacity / 100 : 1;
                }

                if (opacity > 0) {
                    // 解析颜色值
                    let hex = String(backgroundColor).replace('#', '');
                    if (hex.length === 8) {
                        hex = hex.slice(0, 6);
                    }
                    if (hex.length === 6) {
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                            computedBackgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                            padding = '8px 20px';
                            borderRadius = '12px';
                        }
                    }
                }
            } catch (err) {
                console.error('[previewStyle] 背景颜色解析失败:', err);
            }
        }

        // 返回样式对象，确保所有属性都安全访问
        const styleObj = {
            fontFamily: fontName,
            color: fontColor,
            textShadow: `
                -${outlineWidth}px -${outlineWidth}px 0 ${outlineColor},
                ${outlineWidth}px -${outlineWidth}px 0 ${outlineColor},
                -${outlineWidth}px ${outlineWidth}px 0 ${outlineColor},
                ${outlineWidth}px ${outlineWidth}px 0 ${outlineColor},
                ${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}
            `.trim(),
            backgroundColor: computedBackgroundColor,
            padding: padding,
            borderRadius: borderRadius,
            fontSize: `${getActualFontSize(fontSize)}px`
        };

        return styleObj;
    } catch (err) {
        console.error('[previewStyle] 计算失败，返回默认样式:', err);
        return {
            fontFamily: 'Microsoft YaHei Bold',
            color: '#FFFFFF',
            textShadow: '-3px -3px 0 #000000, 3px -3px 0 #000000, -3px 3px 0 #000000, 3px 3px 0 #000000, 2px 2px 6px rgba(0,0,0,0.8)',
            backgroundColor: 'transparent',
            padding: '0',
            borderRadius: '0',
            fontSize: '48px'
        };
    }
});

// 导出选中的样式配置（只返回自定义样式）
const getSelectedStyle = () => {
    try {
        // 🆕 检查初始化状态
        if (!isInitialized.value) {
            console.warn('[getSelectedStyle] ⚠️ 组件尚未初始化完成，返回默认样式');
            return { ...defaultStyle };
        }

        // 防护：确保 customStyle.value 存在
        ensureCustomStyleValid();

        if (!customStyle.value || typeof customStyle.value !== 'object') {
            console.warn('[getSelectedStyle] customStyle.value 无效，返回默认值');
            return { ...defaultStyle };
        }

        // 确保所有必要的属性都存在
        const style = {
            ...defaultStyle,
            ...customStyle.value
        };

        // 确保fontName是字符串（处理可能的对象格式）
        let fontName = style.fontName || 'Microsoft YaHei Bold';
        console.log('[SubtitleStyleSelector.getSelectedStyle] 原始fontName:', { fontName, type: typeof fontName });

        if (typeof fontName === 'object' && fontName !== null) {
            // 处理对象格式：{value: "...", label: "..."}
            fontName = fontName.value || fontName.label || 'Microsoft YaHei Bold';
            console.log('[SubtitleStyleSelector.getSelectedStyle] 从对象提取fontName:', fontName);
        } else if (typeof fontName !== 'string') {
            fontName = String(fontName || 'Microsoft YaHei Bold');
            console.log('[SubtitleStyleSelector.getSelectedStyle] 转换为字符串fontName:', fontName);
        }
        // 防守性编程：确保fontName一定是字符串，然后调用trim()
        fontName = String(fontName || 'Microsoft YaHei Bold').trim() || 'Microsoft YaHei Bold';

        // 确保backgroundOpacity是0-1之间的数字
        let backgroundOpacity = style.backgroundOpacity ?? 0;
        console.log('[SubtitleStyleSelector.getSelectedStyle] 原始backgroundOpacity:', { backgroundOpacity, type: typeof backgroundOpacity });

        if (typeof backgroundOpacity === 'string') {
            // 如果是从本地存储读取的百分比格式，转换为0-1范围
            if (backgroundOpacity.endsWith('%')) {
                backgroundOpacity = parseFloat(backgroundOpacity) / 100;
            } else {
                backgroundOpacity = parseFloat(backgroundOpacity);
            }
            console.log('[SubtitleStyleSelector.getSelectedStyle] 从字符串转换backgroundOpacity:', backgroundOpacity);
        }
        if (isNaN(backgroundOpacity) || backgroundOpacity < 0) {
            backgroundOpacity = 0;
        } else if (backgroundOpacity > 1) {
            // 如果是百分比格式（0-100），转换为0-1
            if (backgroundOpacity <= 100) {
                backgroundOpacity = backgroundOpacity / 100;
            } else {
                backgroundOpacity = 1;
            }
        }

        // 规范化所有颜色格式 - 添加完整防护
        const normalizedFontColor = normalizeColorFormat(style?.fontColor || '#FFFFFF');
        const normalizedOutlineColor = normalizeColorFormat(style?.outlineColor || '#000000');
        
        // 🔧 关键修复：如果透明度为0（无背景），强制将背景色设为 'transparent'
        // 这样下次加载时，watcher 就不会因为检测到颜色变化而自动把透明度重置回 0.8
        let normalizedBackgroundColor = (style?.backgroundColor === 'transparent' || !style?.backgroundColor)
            ? 'transparent'
            : normalizeColorFormat(style?.backgroundColor || 'transparent');
            
        if (backgroundOpacity === 0) {
            console.log('[getSelectedStyle] 检测到透明度为0，强制背景色为 transparent');
            normalizedBackgroundColor = 'transparent';
        }

        // 规范化阴影颜色
        const normalizedShadowColor = (style?.shadowColor && style.shadowColor !== 'transparent')
            ? normalizeColorFormat(style.shadowColor)
            : '#000000';

        // ✅ 新增：从 availableFonts 中查找完整的字体信息（包括路径）
        let fontPath: string | undefined;
        let fontSource: string | undefined;

        if (availableFonts.value && availableFonts.value.length > 0) {
            const selectedFont = availableFonts.value.find(f => f.value === fontName);
            if (selectedFont) {
                fontPath = selectedFont.path;
                fontSource = selectedFont.source;
                console.log('[SubtitleStyleSelector.getSelectedStyle] ✅ 找到完整字体信息:', {
                    fontName: fontName,
                    fontPath: fontPath,
                    fontSource: fontSource
                });
            } else {
                console.warn('[SubtitleStyleSelector.getSelectedStyle] ⚠️ 在availableFonts中未找到字体:', fontName);
            }
        }

        const result = {
            ...style,
            fontName: fontName,  // 确保是字符串
            fontSize: getActualFontSize(style?.fontSize || 48),
            position: subtitlePosition.value,
            backgroundOpacity: backgroundOpacity,  // 确保是0-1范围的数字
            // 确保所有颜色都是标准的#RRGGBB格式
            fontColor: normalizedFontColor || '#FFFFFF',  // 添加默认值
            outlineColor: normalizedOutlineColor || '#000000',  // 添加默认值
            backgroundColor: normalizedBackgroundColor || 'transparent',  // 添加默认值
            // 明确包含描边宽度和阴影参数
            // 注意：由于后端已支持 BorderStyle=4（既有背景又有描边），
            // 所以描边宽度直接保存，不再有自动禁用的情况
            outlineWidth: Number(style?.outlineWidth) !== undefined ? Number(style.outlineWidth) : defaultStyle.outlineWidth,
            shadowOffset: style?.shadowOffset !== undefined ? Number(style.shadowOffset) : defaultStyle.shadowOffset,
            shadowColor: normalizedShadowColor,
            shadowBlur: style?.shadowBlur !== undefined ? Number(style.shadowBlur) : defaultStyle.shadowBlur,
            // ✅ 新增：传递完整字体信息
            fontPath: fontPath,
            fontSource: fontSource
        } as any;

        // 最终验证：确保fontColor一定存在且有效
        if (!result.fontColor || typeof result.fontColor !== 'string') {
            console.warn('[getSelectedStyle] 最终验证：fontColor 无效，设置默认值', {
                currentFontColor: result.fontColor,
                type: typeof result.fontColor
            });
            result.fontColor = '#FFFFFF';
        }
        if (!result.outlineColor || typeof result.outlineColor !== 'string') {
            console.warn('[getSelectedStyle] 最终验证：outlineColor 无效，设置默认值');
            result.outlineColor = '#000000';
        }
        if (!result.backgroundColor || typeof result.backgroundColor !== 'string') {
            console.warn('[getSelectedStyle] 最终验证：backgroundColor 无效，设置默认值');
            result.backgroundColor = 'transparent';
        }

        // ===== 移除颜色自动修复逻辑 =====
        // 用户设置的颜色将被直接使用，不做任何自动交换

        // 🔧 额外防护：确保返回的对象永远有有效的fontColor
        const safeResult = {
            ...result,
            fontColor: result.fontColor && typeof result.fontColor === 'string' ? result.fontColor : '#FFFFFF'
        };

        console.log('[getSelectedStyle] 最终返回的样式:', {
            fontColor: safeResult.fontColor,
            fontSize: safeResult.fontSize,
            outlineWidth: safeResult.outlineWidth
        });

        return safeResult;
    } catch (err) {
        console.error('[getSelectedStyle] 发生异常:', err);
        return { ...defaultStyle };
    }
};

// 🔧 新增标记：是否已从对象加载了自定义样式
const isCustomStyleObjectLoaded = ref(false);

// 🔧 新增方法：直接从样式对象加载（参考特效字幕的方式）
// 这样可以确保每个模板的样式完全独立，不通过数据库
const loadStyleFromObject = async (styleObj: any) => {
    isLoading.value = true;
    try {
        console.log('[loadStyleFromObject] 从对象加载样式:', styleObj);

        if (styleObj && typeof styleObj === 'object') {
            // 🔧 深拷贝样式对象，避免多个模板共享同一引用
            const loadedStyle = { ...defaultStyle, ...styleObj };

            // 🔧 修复：只修复 undefined 和 null，保留用户明确设置的 0（无阴影）
            // shadowOffset === 0 是用户勾选"无阴影"的合法值，不应该被自动修复
            if (loadedStyle.shadowOffset === undefined ||
                loadedStyle.shadowOffset === null) {
                // 仅对于旧模板（undefined/null）恢复为默认值
                loadedStyle.shadowOffset = defaultStyle.shadowOffset;
                console.log('[loadStyleFromObject] 修复：shadowOffset为空（undefined/null），设置为默认值:', loadedStyle.shadowOffset);
            } else if (loadedStyle.shadowOffset === 0) {
                // 保留用户明确设置的 0（无阴影）
                console.log('[loadStyleFromObject] 保留用户设置的无阴影: shadowOffset = 0');
            }

            // 确保 shadowColor 有默认值
            if (!loadedStyle.shadowColor) {
                loadedStyle.shadowColor = defaultStyle.shadowColor;
            }

            customStyle.value = loadedStyle;

            // 清除 currentStyleId，表示不使用数据库存储
            currentStyleId.value = '';

            // 🆕 标记为已从对象加载，防止被 loadStyle('') 覆盖
            isCustomStyleObjectLoaded.value = true;

            console.log('[loadStyleFromObject] ✅ 已从对象加载样式:', {
                fontColor: customStyle.value.fontColor,
                fontSize: customStyle.value.fontSize,
                backgroundColor: customStyle.value.backgroundColor,
                shadowOffset: customStyle.value.shadowOffset
            });
        } else {
            console.warn('[loadStyleFromObject] ⚠️ 样式对象无效，使用默认样式');
            customStyle.value = { ...defaultStyle };
            currentStyleId.value = '';
            isCustomStyleObjectLoaded.value = false;
        }

        ensureCustomStyleValid();
    } catch (error) {
        console.error('[loadStyleFromObject] 加载样式失败:', error);
        customStyle.value = { ...defaultStyle };
        isCustomStyleObjectLoaded.value = false;
    } finally {
        isLoading.value = false;
    }
};

// 新增方法：从模板加载样式，但保留数据库中已保存的自定义设置
const loadStyle = async (styleId?: string) => {
    // 🆕 如果没有提供 styleId，且当前处于"从对象加载"的状态，则跳过重置
    if (!styleId && isCustomStyleObjectLoaded.value) {
        console.log('[loadStyle] ⚠️ 检测到已加载自定义对象样式，且 styleId 为空，跳过重置');
        return;
    }

    isLoading.value = true;
    
    // 只要调用了 loadStyle，就意味着不再是"从对象加载"的纯洁状态（除非是被跳过的空调用）
    if (styleId) {
        isCustomStyleObjectLoaded.value = false;
    } else {
        // 如果没提供 styleId，通常是加载默认，也清除标记 (除非上面已经 return 了)
        isCustomStyleObjectLoaded.value = false;
    }

    try {
        console.log('[loadStyle] 开始加载样式...', { styleId });

        // 🔧 关键修复：记住当前加载的 styleId
        currentStyleId.value = styleId || 'current';

        // 如果提供了 styleId，从数据库直接加载该模板的样式
        if (styleId) {
            console.log('[loadStyle] 从数据库加载 styleId:', styleId);
            const dbStyle = await StyleService.getStyleById(styleId);

            if (dbStyle && typeof dbStyle === 'object') {
                // 🔧 修复：深拷贝数据库返回的对象，避免多个模板共享同一引用
                // 这样可以防止在一个模板中修改样式时影响另一个模板
                customStyle.value = { ...defaultStyle, ...dbStyle };
                console.log('[loadStyle] ✅ 已从数据库加载样式:', {
                    fontColor: customStyle.value.fontColor,
                    backgroundColor: customStyle.value.backgroundColor,
                    currentStyleId: currentStyleId.value
                });
            } else {
                console.warn('[loadStyle] ⚠️ 数据库中未找到样式，使用默认样式');
                customStyle.value = { ...defaultStyle };
            }
        } else {
            // 如果未提供 styleId，使用默认样式
            console.log('[loadStyle] 未提供 styleId，使用默认样式');
            customStyle.value = { ...defaultStyle };
        }

        ensureCustomStyleValid();
        console.log('[loadStyle] ✅ 已完成加载:', customStyle.value);
    } catch (error) {
        console.error('[loadStyle] 加载样式失败:', error);
        customStyle.value = { ...defaultStyle };
    } finally {
        isLoading.value = false;
    }
};

// 全局错误防护：捕获组件内任何错误，防止 undefined 访问导致整个组件崩溃
onErrorCaptured((err, instance, info) => {
    console.error('[SubtitleStyleSelector] 捕获错误:', {
        error: err instanceof Error ? err.message : String(err),
        component: instance?.$options?.name || 'Unknown',
        info
    });
    // 返回 false 阻止错误继续向上冒泡
    return false;
});

defineExpose({
    getSelectedStyle,
    loadStyle,
    loadStyleFromObject,  // 🔧 新增：支持从对象直接加载样式
    saveCustomStyle,       // 暴露保存方法供父组件调用
    // 🆕 新增：允许外部等待初始化完成，并确保没有正在进行的加载
    waitForInitialization: async () => {
        if (!isInitialized.value && initializationPromise.value) {
            await initializationPromise.value;
        }
        // 🔧 关键修复：不仅要等待初始化完成，还要等待所有 loading 结束
        // 这样可以防止 watcher 触发的 loadStyle 还在进行中时进行下一步操作
        if (isLoading.value) {
            console.log('[waitForInitialization] Detected isLoading=true, waiting for it to finish...');
            // 简单的轮询等待
            let checks = 0;
            while (isLoading.value && checks < 50) { // 最多等待 2.5秒
                await new Promise(resolve => setTimeout(resolve, 50));
                checks++;
            }
            console.log('[waitForInitialization] Finish waiting. isLoading:', isLoading.value);
        }
    },
    isInitialized: () => isInitialized.value
});
</script>

<style>
/* 强制显示浅色背景下的复选框边框 - 组件内直接定义确保生效 */
.force-light-checkbox .arco-checkbox-icon {
  border: 1px solid #86909c !important; /* 灰色边框 */
  background-color: white !important;
}

.force-light-checkbox:hover .arco-checkbox-icon {
  border-color: #165dff !important;
}

.force-light-checkbox.arco-checkbox-checked .arco-checkbox-icon {
  background-color: #165dff !important;
  border-color: #165dff !important;
  color: white !important;
}

/* 确保勾选标记可见 */
.force-light-checkbox.arco-checkbox-checked .arco-checkbox-icon svg {
  color: white !important;
  fill: white !important;
}
</style>

<template>
    <div class="subtitle-style-selector">
        <!-- 字幕样式配置 - 总是显示，使用默认值如果需要 -->
        <div class="space-y-4" :data-component="'SubtitleStyleSelector-template-rendered'">
            <!-- 字体大小调节滑块 -->
            <div class="p-4 bg-gray-50 rounded-lg border">
                <div class="flex items-center justify-between mb-3">
                    <label class="text-sm font-medium text-gray-700">字体大小</label>
                    <span class="text-sm font-bold text-blue-600">{{ fontSizeScale }}%</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-500">小</span>
                    <a-slider
                        v-model="fontSizeScale"
                        :min="20"
                        :max="150"
                        :step="5"
                        :show-tooltip="true"
                        class="flex-1"
                        :format-tooltip="(value: number) => `${value}%`"
                    />
                    <span class="text-xs text-gray-500">大</span>
                </div>
                <div class="flex gap-2 mt-3">
                    <a-button size="mini" @click="fontSizeScale = 30">30%</a-button>
                    <a-button size="mini" @click="fontSizeScale = 50">50%</a-button>
                    <a-button size="mini" @click="fontSizeScale = 75">75%</a-button>
                    <a-button size="mini" @click="fontSizeScale = 100">100%</a-button>
                </div>
            </div>

            <!-- 字幕位置选择 -->
            <div class="p-4 bg-gray-50 rounded-lg border">
                <div class="flex items-center justify-between mb-3">
                    <label class="text-sm font-medium text-gray-700">字幕位置</label>
                </div>
                <div class="flex gap-2">
                    <a-button
                        size="small"
                        :type="subtitlePosition === 'top' ? 'primary' : 'outline'"
                        @click="subtitlePosition = 'top'"
                    >
                        上
                    </a-button>
                    <a-button
                        size="small"
                        :type="subtitlePosition === 'center' ? 'primary' : 'outline'"
                        @click="subtitlePosition = 'center'"
                    >
                        中
                    </a-button>
                    <a-button
                        size="small"
                        :type="subtitlePosition === 'bottom' ? 'primary' : 'outline'"
                        @click="subtitlePosition = 'bottom'"
                    >
                        下
                    </a-button>
                </div>
            </div>

            <!-- 自定义样式编辑器 -->
            <div class="p-4 bg-white rounded-lg border">
                <h5 class="font-medium text-sm mb-4">自定义字幕样式</h5>

                <!-- 预览区域 -->
                <div class="p-4 bg-gray-800 rounded-lg mb-4">
                    <div class="text-xs text-gray-400 mb-3 text-center">效果预览</div>
                    <div class="flex items-center justify-center" style="min-height: 120px;">
                        <!-- 防护：确保 customStyle 有效后再渲染 -->
                        <div
                            v-if="customStyle && customStyle.fontColor"
                            :key="`font-preview-${customStyle?.fontName || 'default'}-${previewRefreshKey}`"
                            class="preview-text font-bold inline-block"
                            :style="previewStyle"
                        >
                            示例字幕文字
                        </div>
                        <!-- 防护：如果 customStyle 无效，显示加载提示 -->
                        <div v-else class="text-gray-400 text-sm">初始化中...</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <!-- 字体选择 -->
                    <div class="col-span-2">
                        <label class="text-sm text-gray-600 mb-2 block">字体</label>
                        <a-select
                            :model-value="customStyle?.fontName ?? defaultStyle.fontName"
                            :placeholder="t('选择字体')"
                            allow-search
                            clearable
                            class="w-full"
                            @update:model-value="(value) => {
                                try {
                                    console.log('[SubtitleStyleSelector] 字体选择更新:', { value, type: typeof value });
                                    // 确保字体名称是字符串格式
                                    let fontNameStr = value;
                                    if (typeof value === 'object' && value !== null) {
                                        fontNameStr = value.value || value.label || 'Microsoft YaHei Bold';
                                    } else if (typeof value !== 'string') {
                                        fontNameStr = String(value || 'Microsoft YaHei Bold');
                                    }
                                    fontNameStr = fontNameStr.trim() || 'Microsoft YaHei Bold';

                                    // 直接更新字体名称
                                    customStyle.fontName = fontNameStr;
                                    console.log('[SubtitleStyleSelector] 字体名称已更新为:', customStyle.fontName);
                                } catch (error) {
                                    console.error('[SubtitleStyleSelector] 字体更新异常:', error);
                                    customStyle.fontName = 'Microsoft YaHei Bold';
                                }
                            }"
                        >
                            <a-option
                                v-for="(font, idx) in availableFonts"
                                :key="`${font.value || idx}`"
                                :value="font.value || 'Microsoft YaHei Bold'"
                                :label="font.label || font.value"
                            >
                                <div v-if="font" class="flex items-center justify-between">
                                    <div class="flex items-center gap-2 flex-1">
                                        <span>{{ font.label || font.value }}</span>
                                        <!-- 🆕 国际字体标识 -->
                                        <a-tag v-if="font.isInternational" size="small" color="orange" style="margin-left: 8px;">
                                            🌍 国际字体
                                        </a-tag>
                                    </div>
                                    <a-tag size="small" :color="font.source === 'ziti' ? 'green' : font.source === 'bundled' ? 'blue' : 'gray'">
                                        {{ font.source === 'ziti' ? 'Ziti' : font.source === 'bundled' ? '预置' : font.source === 'system' ? '系统' : '自定义' }}
                                    </a-tag>
                                </div>
                            </a-option>
                        </a-select>
                    </div>
                    <!-- 文字颜色 -->
                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">文字颜色</label>
                        <div class="flex items-center gap-2">
                            <a-color-picker v-model="customStyle.fontColor" />
                            <a-input v-model="customStyle.fontColor" class="flex-1" size="small" />
                        </div>
                    </div>

                    <!-- 描边颜色 -->
                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">描边颜色</label>
                        <div class="flex items-center gap-2">
                            <a-color-picker v-model="customStyle.outlineColor" />
                            <a-input v-model="customStyle.outlineColor" class="flex-1" size="small" />
                        </div>
                    </div>

                    <!-- 描边宽度 -->
                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">描边宽度</label>
                        <div class="flex items-center gap-2">
                            <a-slider
                                v-model="customStyle.outlineWidth"
                                :min="0"
                                :max="10"
                                :step="1"
                                class="flex-1"
                            />
                            <span class="text-sm font-mono w-12 text-right">{{ customStyle.outlineWidth }}px</span>
                        </div>
                    </div>

                    <!-- 无阴影开关 -->
                    <div>
                        <a-checkbox v-model="noShadow" class="text-black font-medium force-light-checkbox" style="color: #000000 !important">
                            <span style="color: #000000 !important; font-weight: 500;">无阴影</span>
                        </a-checkbox>
                    </div>

                    <!-- 阴影设置（仅在启用阴影时显示） -->
                    <div v-if="!noShadow" class="space-y-3">
                        <!-- 阴影偏移 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-2 block">阴影偏移</label>
                            <div class="flex items-center gap-2">
                                <a-slider
                                    v-model="customStyle.shadowOffset"
                                    :min="1"
                                    :max="10"
                                    :step="1"
                                    class="flex-1"
                                />
                                <span class="text-sm font-mono w-12 text-right">{{ customStyle.shadowOffset }}px</span>
                            </div>
                        </div>

                        <!-- 阴影颜色 -->
                        <div>
                            <label class="text-sm text-gray-600 mb-2 block">阴影颜色</label>
                            <div class="flex items-center gap-2">
                                <a-color-picker v-model="customStyle.shadowColor" />
                                <a-input v-model="customStyle.shadowColor" class="flex-1" size="small" />
                            </div>
                        </div>

                        <!-- 阴影模糊说明 -->
                        <div>
                            <label class="text-sm text-gray-400 mb-2 block">阴影模糊（仅预览有效）</label>
                            <div class="flex items-center gap-2">
                                <a-slider
                                    v-model="customStyle.shadowBlur"
                                    :min="0"
                                    :max="20"
                                    :step="1"
                                    class="flex-1"
                                    disabled
                                />
                                <span class="text-sm font-mono w-12 text-right text-gray-400">{{ customStyle.shadowBlur }}px</span>
                            </div>
                            <div class="text-xs text-gray-400 mt-1">注：FFmpeg不支持阴影模糊，实际视频中仅显示阴影偏移效果</div>
                        </div>
                    </div>

                    <!-- 背景颜色 -->
                    <div>
                        <label class="text-sm text-gray-600 mb-2 block">背景颜色</label>
                        <div class="flex items-center gap-2">
                            <a-color-picker v-model="customStyle.backgroundColor" />
                            <a-input
                                v-model="customStyle.backgroundColor"
                                class="flex-1"
                                size="small"
                            />
                        </div>
                        <a-checkbox
                            class="mt-2 text-black font-medium force-light-checkbox"
                            style="color: #000000 !important"
                            :model-value="customStyle.backgroundColor === 'transparent'"
                            @change="(val: any) => {
                                const isChecked = Boolean(val);
                                if (isChecked) {
                                    // 勾选'无背景' - 设置为透明
                                    customStyle.backgroundColor = 'transparent';
                                    console.log('✓ 已禁用背景，设置为透明');
                                } else {
                                    // 取消'无背景' - 恢复上次保存的背景颜色
                                    if (customStyle.backgroundColor === 'transparent') {
                                        // 恢复上次用户选择的背景颜色（而不是默认的黑色）
                                        customStyle.backgroundColor = lastSelectedBackgroundColor.value || '#000000';
                                        console.log('✓ 已启用背景，恢复用户上次选择的颜色:', customStyle.backgroundColor);
                                    }
                                }
                            }">
                            <span style="color: #000000 !important; font-weight: 500;">无背景</span>
                        </a-checkbox>
                        <div class="text-xs text-gray-500 mt-1">
                            💡 提示：背景和描边可以同时使用（后端支持 BorderStyle=4）
                        </div>
                    </div>

                    <!-- 背景透明度 -->
                    <div v-if="customStyle.backgroundColor !== 'transparent'">
                        <label class="text-sm text-gray-600 mb-2 block">背景透明度</label>
                        <div class="flex items-center gap-2">
                            <a-slider
                                v-model="customStyle.backgroundOpacity"
                                :min="0"
                                :max="1"
                                :step="0.1"
                                class="flex-1"
                            />
                            <span class="text-sm font-mono w-12 text-right">{{ Math.round(customStyle.backgroundOpacity * 100) }}%</span>
                        </div>
                    </div>
                </div>

                <!-- 快速预设 -->
                <div class="mt-4">
                    <label class="text-sm text-gray-600 mb-2 block">快速预设</label>
                    <div class="flex gap-2 flex-wrap">
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#000000';
                            customStyle.backgroundColor = '#000000';
                            lastSelectedBackgroundColor.value = '#000000';
                            customStyle.backgroundOpacity = 0.8;
                        }">黑底白字</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#000000';
                            customStyle.outlineColor = '#FFFFFF';
                            customStyle.backgroundColor = '#FFFFFF';
                            lastSelectedBackgroundColor.value = '#FFFFFF';
                            customStyle.backgroundOpacity = 0.9;
                        }">白底黑字</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#FFD700';
                            customStyle.backgroundColor = 'transparent';
                            customStyle.backgroundOpacity = 0;
                            customStyle.outlineWidth = 4;
                        }">抖音风格</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#DC143C';
                            customStyle.backgroundColor = '#DC143C';
                            lastSelectedBackgroundColor.value = '#DC143C';
                            customStyle.backgroundOpacity = 0.85;
                        }">红底白字</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#000000';
                            customStyle.outlineColor = '#FFEB3B';
                            customStyle.backgroundColor = '#FFEB3B';
                            lastSelectedBackgroundColor.value = '#FFEB3B';
                            customStyle.backgroundOpacity = 0.9;
                        }">黄底黑字</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#00BFFF';
                            customStyle.backgroundColor = '#00BFFF';
                            lastSelectedBackgroundColor.value = '#00BFFF';
                            customStyle.backgroundOpacity = 0.85;
                        }">蓝底白字</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#00FF00';
                            customStyle.outlineColor = '#000000';
                            customStyle.backgroundColor = '#000000';
                            lastSelectedBackgroundColor.value = '#000000';
                            customStyle.backgroundOpacity = 0.8;
                        }">绿色高亮</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FF00FF';
                            customStyle.outlineColor = '#000000';
                            customStyle.backgroundColor = '#000000';
                            lastSelectedBackgroundColor.value = '#000000';
                            customStyle.backgroundOpacity = 0.8;
                        }">紫色高亮</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#000000';
                            customStyle.outlineWidth = 2;
                            customStyle.backgroundColor = 'transparent';
                            customStyle.backgroundOpacity = 0;
                            customStyle.shadowOffset = 4;
                            customStyle.shadowColor = '#000000';
                        }">立体阴影</a-button>
                        <a-button size="small" @click="() => {
                            customStyle.fontColor = '#FFFFFF';
                            customStyle.outlineColor = '#FF6B6B';
                            customStyle.outlineWidth = 3;
                            customStyle.backgroundColor = 'transparent';
                            customStyle.backgroundOpacity = 0;
                            customStyle.shadowOffset = 3;
                            customStyle.shadowColor = '#FF6B6B';
                        }">霓虹发光</a-button>
                    </div>
                </div>
            </div>

            <!-- 保存提示 -->
            <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div class="text-sm text-blue-700">
                    <strong>💡 提示：</strong>
                    编辑完成后，点击对话框右下角的"保存"按钮来保存所有设置（包括字幕样式）。
                </div>
            </div>


        </div>
    </div>
</template>

<style scoped>
.subtitle-style-selector {
    display: block;
    width: 100%;
    min-width: 100%;
    max-width: 100%;
    padding: 0;
    margin: 0;
}


.preview-text {
    transition: all 0.3s ease;
}

/* 强制覆盖 Arco Design checkbox 样式，确保在白底上可见 */
:deep(.arco-checkbox) {
    color: #000000 !important;
}

/* 确保复选框图标有边框和背景 */
:deep(.arco-checkbox-icon) {
    border: 1px solid #d9d9d9 !important; /* 强制显示边框 */
    background-color: white !important;
}

/* 选中状态 */
:deep(.arco-checkbox-checked .arco-checkbox-icon) {
    background-color: #165DFF !important;
    border-color: #165DFF !important;
    color: white !important;
}

/* 鼠标悬停时的边框加深，而不是隐藏 */
:deep(.arco-checkbox:hover .arco-checkbox-icon) {
    border-color: #165DFF !important;
}
</style>
