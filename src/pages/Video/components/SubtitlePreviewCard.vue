<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { pathToFileURL } from 'node:url';
import portraitPreviewBg from '../assets/subtitle_preview_bg.png';
import defaultPreviewBg from '../assets/default_preview_bg.jpg';

const availableFonts = ref<any[]>([]);
const loadedFontsCache = new Set<string>();
const resourceRoot = ref('');
const resolvedBackgroundImage = ref<string | null>(null);
const toFileUrl = (filePath: string) => pathToFileURL(filePath).toString();

interface SubtitleStyle {
    fontName?: string;
    fontSize?: number;
    fontColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
    shadowOffset?: number;
    shadowColor?: string;
    shadowBlur?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    alignment?: 'left' | 'center' | 'right';
}

interface TitleLineStyle {
    text?: string;
    fontName?: string;
    fontWeight?: string;
    fontSize?: number;
    fontColor?: string;
    outlineColor?: string;
    outlineWidth?: number;
    shadowOffset?: number;
    shadowColor?: string;
    shadowBlur?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    alignment?: 'left' | 'center' | 'right';
    xOffsetPercent?: number;
    maxWidthPercent?: number;
}

interface TitleSubtitleConfig {
    enabled?: boolean;
    lines?: TitleLineStyle[];
    topMarginPercent?: number;
    lineSpacingPercent?: number;
}

interface KeywordGroupStyle {
    styleOverride?: SubtitleStyle | null;
    color?: string | null;
}

interface PreviewConfig {
    backgroundKey?: 'portrait' | 'mountain';
    backgroundImage?: string;
    backgroundPosition?: string;
    overlayStartColor?: string;
    overlayEndColor?: string;
    titleTexts?: string[];
    subtitleTexts?: string[];
}

interface PreviewSegment {
    text: string;
    accent: boolean;
}

const props = withDefaults(defineProps<{
    templateName?: string;
    subtitleStyle?: SubtitleStyle;
    titleSubtitleConfig?: TitleSubtitleConfig;
    keywordGroupsStyles?: KeywordGroupStyle[];
    keywordRenderMode?: 'floating' | 'inline-emphasis';
    backgroundImage?: string;
    previewConfig?: PreviewConfig;
    isSelected?: boolean;
    previewScale?: number;
    isSystem?: boolean;
    isDev?: boolean;
    showActions?: boolean;
    showMeta?: boolean;
    cardClickable?: boolean;
}>(), {
    showActions: true,
    showMeta: true,
    cardClickable: true,
});

const emit = defineEmits<{
    (e: 'edit'): void;
    (e: 'delete'): void;
    (e: 'select'): void;
    (e: 'export'): void;
    (e: 'clone'): void;
    (e: 'set-as-system'): void;
}>();

const DEFAULT_INLINE_PREVIEW_TEXTS = ['真正会做内容的人', '都会先抓[重点]'];
const DEFAULT_FLOATING_PREVIEW_TEXTS = ['这套模板展示普通字幕', '下方只保留统一颜色'];
const AUTO_HIGHLIGHT_KEYWORDS = [
    '自己',
    '节奏',
    '答案',
    '努力',
    '温柔',
    '快乐',
    '热爱',
    '从容',
    '美好',
    '重点',
    '主动',
    '执行',
    '光',
];

const loadFonts = async () => {
    try {
        if (!window.$mapi?.fontManager) {
            return;
        }
        const result = await window.$mapi.fontManager.getAllFonts();
        if (result?.success) {
            availableFonts.value = result.data || [];
        }
    } catch (error) {
        console.error('[SubtitlePreviewCard] loadFonts failed:', error);
    }
};

const loadFontForPreview = async (fontName: string) => {
    try {
        if (!fontName || loadedFontsCache.has(fontName)) {
            return;
        }

        const fontInfo = availableFonts.value?.find((font) => font?.value === fontName);
        if (!fontInfo) {
            return;
        }

        if ((fontInfo.source === 'ziti' || fontInfo.source === 'custom') && fontInfo.path) {
            const fontUrl = `font://${encodeURIComponent(fontInfo.path)}`;
            const styleId = `font-face-preview-card-${fontName.replace(/\s+/g, '-')}`;
            let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
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
        }

        loadedFontsCache.add(fontName);
    } catch (error) {
        console.error('[SubtitlePreviewCard] loadFontForPreview failed:', fontName, error);
    }
};

onMounted(async () => {
    await loadFonts();
    try {
        if (window.$mapi?.app?.getResourcesPath) {
            resourceRoot.value = await window.$mapi.app.getResourcesPath();
        }
    } catch (error) {
        console.error('[SubtitlePreviewCard] getResourcesPath failed:', error);
    }

});

watch(() => props.subtitleStyle?.fontName, async (fontName) => {
    if (fontName && availableFonts.value.length > 0) {
        await loadFontForPreview(fontName);
    }
}, { immediate: true });

watch(() => props.titleSubtitleConfig?.lines, async (lines) => {
    if (!lines || availableFonts.value.length === 0) {
        return;
    }

    for (const line of lines) {
        if (line.fontName) {
            await loadFontForPreview(line.fontName);
        }
    }
}, { deep: true, immediate: true });

watch(() => availableFonts.value.length, async (length) => {
    if (length === 0) {
        return;
    }

    if (props.subtitleStyle?.fontName) {
        await loadFontForPreview(props.subtitleStyle.fontName);
    }

    for (const line of props.titleSubtitleConfig?.lines || []) {
        if (line.fontName) {
            await loadFontForPreview(line.fontName);
        }
    }
});

const previewScaleValue = computed(() => props.previewScale || 0.33);
const isInlineKeywordMode = computed(() => props.keywordRenderMode === 'inline-emphasis');
const shouldShowActions = computed(() => props.showActions !== false);
const shouldShowMeta = computed(() => props.showMeta !== false);
const isCardClickable = computed(() => props.cardClickable !== false);

const handleCardClick = () => {
    if (!isCardClickable.value) {
        return;
    }
    emit('select');
};

const resolveBackgroundImage = (image?: string) => {
    if (!image) {
        return null;
    }

    if (/^https?:\/\//i.test(image) || image.startsWith('file://') || image.startsWith('data:')) {
        return image;
    }

    if (/^[a-zA-Z]:[\\/]/.test(image) || image.startsWith('\\\\')) {
        return toFileUrl(image);
    }

    if (resourceRoot.value) {
        const normalizedImage = image.replace(/\\/g, '/');

        if (normalizedImage.startsWith('extra/')) {
            const relativePath = normalizedImage.replace(/^extra\//, '');
            const filePath = resourceRoot.value.replace(/\\/g, '/') + '/' + relativePath;
            return toFileUrl(filePath);
        }

        if (normalizedImage.startsWith('common/')) {
            const filePath = resourceRoot.value.replace(/\\/g, '/') + '/' + normalizedImage;
            return toFileUrl(filePath);
        }
    }

    return image;
};

const refreshResolvedBackgroundImage = async () => {
    const image = props.backgroundImage || props.previewConfig?.backgroundImage;
    if (!image) {
        resolvedBackgroundImage.value = null;
        return;
    }

    const normalizedImage = image.replace(/\\/g, '/');

    try {
        if (normalizedImage.startsWith('extra/') && window.$mapi?.app?.extraPathResolve) {
            const relativePath = normalizedImage.replace(/^extra\//, '');
            const resolvedPath = await window.$mapi.app.extraPathResolve(relativePath);
            resolvedBackgroundImage.value = toFileUrl(resolvedPath);
            return;
        }

        if (normalizedImage.startsWith('common/') && window.$mapi?.app?.extraPathResolve) {
            const resolvedPath = await window.$mapi.app.extraPathResolve(normalizedImage);
            resolvedBackgroundImage.value = toFileUrl(resolvedPath);
            return;
        }
    } catch (error) {
        console.warn('[SubtitlePreviewCard] refreshResolvedBackgroundImage failed:', image, error);
    }

    resolvedBackgroundImage.value = resolveBackgroundImage(image);
};

watch(
    () => [props.backgroundImage, props.previewConfig?.backgroundImage, resourceRoot.value],
    () => {
        void refreshResolvedBackgroundImage();
    },
    { immediate: true }
);

const bgImageUrl = computed(() => {
    const explicitImage = resolvedBackgroundImage.value || resolveBackgroundImage(props.backgroundImage || props.previewConfig?.backgroundImage);
    if (explicitImage) {
        return explicitImage;
    }

    if (props.previewConfig?.backgroundKey === 'mountain') {
        return defaultPreviewBg;
    }

    return portraitPreviewBg;
});

const backgroundImageStyle = computed(() => ({
    objectPosition: props.previewConfig?.backgroundPosition || 'center 28%',
}));

const overlayStyle = computed(() => {
    const startColor = props.previewConfig?.overlayStartColor || 'rgba(0, 0, 0, 0.12)';
    const endColor = props.previewConfig?.overlayEndColor || 'rgba(0, 0, 0, 0.56)';

    return {
        background: `linear-gradient(180deg, ${startColor} 0%, rgba(15, 23, 42, 0.04) 38%, ${endColor} 100%)`,
    };
});

const titlePreviewStyle = computed(() => ({
    top: `${props.titleSubtitleConfig?.topMarginPercent ?? 7}%`,
}));

const toRgba = (color?: string, opacity?: number) => {
    if (!color || color === 'transparent' || opacity === undefined || opacity <= 0) {
        return 'transparent';
    }

    const rawHex = color.replace('#', '');
    const hex = rawHex.length === 8 ? rawHex.slice(0, 6) : rawHex;
    if (hex.length !== 6) {
        return 'transparent';
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const hexToRgba = (color?: string, opacity = 1) => {
    if (!color || color === 'transparent') {
        return `rgba(0, 0, 0, ${opacity})`;
    }

    const rawHex = color.replace('#', '');
    const hex = rawHex.length === 8 ? rawHex.slice(0, 6) : rawHex;
    if (hex.length !== 6) {
        return `rgba(0, 0, 0, ${opacity})`;
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const buildTextStyle = (
    style?: SubtitleStyle | TitleLineStyle | null,
    options?: {
        minFontSize?: number;
        scaleMultiplier?: number;
        maxStrokeWidth?: number;
        filterShadow?: string;
    },
) => {
    const scale = previewScaleValue.value;
    const minFontSize = options?.minFontSize ?? 12;
    const scaleMultiplier = options?.scaleMultiplier ?? 1;
    const fontSize = Math.max(minFontSize, (style?.fontSize || 48) * scale * scaleMultiplier);
    const outlineWidth = Math.max(0, (style?.outlineWidth || 0) * scale);
    const shadowOffset = Math.max(0, (style?.shadowOffset || 0) * scale);
    const shadowBlur = Math.max(0, (style?.shadowBlur || 0) * scale);
    const backgroundColor = toRgba(style?.backgroundColor, style?.backgroundOpacity ?? 0);
    const maxStrokeWidth = options?.maxStrokeWidth ?? 1.6;
    const strokeWidth = outlineWidth > 0 ? Math.max(0.5, Math.min(maxStrokeWidth, outlineWidth * 0.55)) : 0;
    const useSoftOutline = strokeWidth > 0;
    const textShadowLayers: string[] = [];

    if (strokeWidth > 0 && useSoftOutline) {
        const shadowOutlineColor = hexToRgba(style?.outlineColor || '#000000', 0.78);
        const shadowStroke = Math.max(0.65, Math.min(0.95, strokeWidth));
        textShadowLayers.push(
            `${shadowStroke}px 0 0 ${shadowOutlineColor}`,
            `-${shadowStroke}px 0 0 ${shadowOutlineColor}`,
            `0 ${shadowStroke}px 0 ${shadowOutlineColor}`,
            `0 -${shadowStroke}px 0 ${shadowOutlineColor}`,
        );
    }

    if (shadowOffset > 0) {
        textShadowLayers.push(
            `${shadowOffset}px ${shadowOffset}px ${Math.max(1, shadowBlur)}px ${style?.shadowColor || '#000000'}`
        );
    } else {
        textShadowLayers.push('0 1px 1px rgba(0, 0, 0, 0.18)');
    }

    return {
        fontFamily: style?.fontName ? `'${style.fontName}'` : 'Microsoft YaHei UI',
        fontSize: `${fontSize}px`,
        color: style?.fontColor || '#FFFFFF',
        backgroundColor,
        padding: backgroundColor !== 'transparent' ? '0.18em 0.44em' : '0',
        borderRadius: backgroundColor !== 'transparent' ? '0.28em' : '0',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        WebkitTextStroke: '0 transparent',
        paintOrder: 'stroke fill',
        textShadow: textShadowLayers.length > 0 ? textShadowLayers.join(', ') : 'none',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        transform: 'translateZ(0)',
        filter: 'none',
    };
};

const titleLines = computed(() => {
    if (!props.titleSubtitleConfig?.enabled || !props.titleSubtitleConfig?.lines?.length) {
        return [];
    }
    const configuredTitleTexts = props.previewConfig?.titleTexts?.filter((text) => Boolean(text && text.trim()));
    return props.titleSubtitleConfig.lines.map((line, index) => ({
        ...line,
        text: configuredTitleTexts?.[index] || line.text,
    }));
});

const hasTitleOverlay = computed(() => titleLines.value.length > 0);

const getTitleLineStyle = (line: TitleLineStyle, index: number) => {
    const lineSpacing = (props.titleSubtitleConfig?.lineSpacingPercent || 4.5) * previewScaleValue.value;
    const hasBackground = Boolean(
        line.backgroundColor &&
        line.backgroundColor !== 'transparent' &&
        (line.backgroundOpacity ?? 0) > 0
    );
    const titleBackground = toRgba(line.backgroundColor, line.backgroundOpacity ?? 0);
    const outlinePad = Math.max(0, (line.outlineWidth || 0) * previewScaleValue.value * 1.7);
    const shadowPad = Math.max(0, (line.shadowOffset || 0) * previewScaleValue.value * 1.9);
    const textSafetyPad = Math.max(4, Math.ceil((line.fontSize || 56) * previewScaleValue.value * 0.08));
    const extraInlinePad = Math.ceil(outlinePad + shadowPad + textSafetyPad);
    const extraBlockPad = Math.ceil(Math.max(outlinePad * 0.85, shadowPad * 0.65, textSafetyPad * 0.7));

    return {
        ...buildTextStyle(line, {
            minFontSize: 12,
            scaleMultiplier: 0.62,
            maxStrokeWidth: 0.82,
        }),
        fontWeight: line.fontWeight || '900',
        marginBottom: index < titleLines.value.length - 1 ? `${lineSpacing}px` : '0',
        lineHeight: '1.12',
        letterSpacing: '-0.045em',
        maxWidth: '100%',
        display: 'block',
        width: '100%',
        whiteSpace: 'nowrap',
        wordBreak: 'keep-all',
        overflowWrap: 'normal',
        overflow: 'hidden',
        textAlign: 'center',
        boxSizing: 'border-box',
        backgroundColor: hasBackground ? titleBackground : 'transparent',
        padding: hasBackground
            ? `calc(0.18em + ${Math.max(1, Math.ceil(extraBlockPad * 0.45))}px) calc(0.22em + ${Math.max(2, Math.ceil(extraInlinePad * 0.18))}px) calc(0.22em + ${Math.max(1, Math.ceil(extraBlockPad * 0.45))}px)`
            : '0',
        borderRadius: hasBackground ? '0.18em' : '0',
        boxShadow: 'none',
    };
};

const getTitleLineWrapStyle = (_line: TitleLineStyle) => {
    return {
        justifyContent: 'center',
        paddingLeft: '2%',
        paddingRight: '2%',
    };
};

const highlightStyles = computed(() => {
    const groups = props.keywordGroupsStyles || [];
    return groups
        .map((group) => group?.styleOverride || (group?.color ? { ...props.subtitleStyle, fontColor: group.color } : null))
        .filter(Boolean) as SubtitleStyle[];
});

const bodyBaseStyle = computed(() => buildTextStyle(props.subtitleStyle, {
        minFontSize: hasTitleOverlay.value
            ? (isInlineKeywordMode.value ? 16 : 15)
            : (isInlineKeywordMode.value ? 13 : 12),
        scaleMultiplier: hasTitleOverlay.value
            ? (isInlineKeywordMode.value ? 1.12 : 1.02)
            : (isInlineKeywordMode.value ? 0.98 : 0.88),
        maxStrokeWidth: hasTitleOverlay.value ? 0.9 : 0.82,
}));

const inlineAccentStyle = computed(() => {
    const accent = highlightStyles.value.find((style) => (
        style?.fontColor && style.fontColor !== props.subtitleStyle?.fontColor
    )) || highlightStyles.value[0] || props.subtitleStyle;

    return buildTextStyle({
        ...accent,
        fontColor: accent?.fontColor || '#ffe600',
        outlineColor: accent?.outlineColor || '#111111',
        fontSize: Math.max(
            (accent?.fontSize || 0),
            (props.subtitleStyle?.fontSize || 0) + 4,
            Math.round((props.subtitleStyle?.fontSize || 0) * 1.1),
        ),
    }, {
        minFontSize: 14,
        scaleMultiplier: 1.02,
        maxStrokeWidth: 0.9,
    });
});

const estimatePreviewTextUnits = (text: string) => (
    Array.from(text || '').reduce((total, char) => {
        if (/\s/.test(char)) {
            return total + 0.28;
        }
        if (/[A-Za-z0-9]/.test(char)) {
            return total + 0.58;
        }
        return total + 1;
    }, 0)
);

const getPreviewLineScale = (line: PreviewSegment[]) => {
    const textUnits = estimatePreviewTextUnits(line.map((segment) => segment.text).join(''));

    if (hasTitleOverlay.value) {
        if (textUnits > 16) return 0.5;
        if (textUnits > 14) return 0.58;
        if (textUnits > 12) return 0.68;
        if (textUnits > 10) return 0.78;
    }

    if (textUnits > 18) return 0.6;
    if (textUnits > 16) return 0.7;
    if (textUnits > 14) return 0.8;
    return 1;
};

const scalePreviewTextStyle = (
    styleObj: Record<string, any>,
    scale: number,
    minFontSize: number,
) => {
    if (scale >= 0.999) {
        return styleObj;
    }

    const baseFontSize = Number.parseFloat(String(styleObj.fontSize || '0'));
    if (!baseFontSize || Number.isNaN(baseFontSize)) {
        return styleObj;
    }

    return {
        ...styleObj,
        fontSize: `${Math.max(minFontSize, Math.round(baseFontSize * scale * 10) / 10)}px`,
    };
};

const getPreviewSegmentStyle = (segment: PreviewSegment, line: PreviewSegment[]) => {
    const previewLineScale = getPreviewLineScale(line);

    if (!segment.accent || !isInlineKeywordMode.value) {
        return scalePreviewTextStyle(
            bodyBaseStyle.value,
            previewLineScale,
            hasTitleOverlay.value ? 11 : 10,
        );
    }

    return scalePreviewTextStyle({
        ...inlineAccentStyle.value,
        transform: 'translateY(-0.06em)',
    }, previewLineScale, hasTitleOverlay.value ? 12 : 11);
};

const bodyAlignment = computed(() => props.subtitleStyle?.alignment || 'center');

const subtitlePreviewContainerStyle = computed(() => {
    if (bodyAlignment.value === 'left') {
        return {
            left: '0',
            right: '0',
            transform: 'none',
            width: '100%',
            paddingLeft: '10%',
            paddingRight: '10%',
            alignItems: 'stretch',
        };
    }

    if (bodyAlignment.value === 'right') {
        return {
            left: '0',
            right: '0',
            transform: 'none',
            width: '100%',
            paddingLeft: '10%',
            paddingRight: '10%',
            alignItems: 'stretch',
        };
    }

    return {
        left: '50%',
        transform: 'translateX(-50%)',
        width: '84%',
        alignItems: 'center',
    };
});

const getSubtitleLineStyle = (line: PreviewSegment[]) => {
    const previewLineScale = getPreviewLineScale(line);

    if (bodyAlignment.value === 'left') {
        return {
            textAlign: 'left',
            maxWidth: '100%',
            width: '100%',
            transform: previewLineScale < 0.999 ? `scale(${previewLineScale})` : 'none',
            transformOrigin: 'left center',
        };
    }

    if (bodyAlignment.value === 'right') {
        return {
            textAlign: 'right',
            maxWidth: '100%',
            width: '100%',
            transform: previewLineScale < 0.999 ? `scale(${previewLineScale})` : 'none',
            transformOrigin: 'right center',
        };
    }

    return {
        textAlign: 'center',
        maxWidth: '100%',
        width: '100%',
        transform: previewLineScale < 0.999 ? `scale(${previewLineScale})` : 'none',
        transformOrigin: 'center center',
    };
};

const autoHighlightPreviewText = (lineText: string) => {
    if (!lineText || lineText.includes('[') || lineText.includes(']')) {
        return lineText;
    }

    const keyword = AUTO_HIGHLIGHT_KEYWORDS.find((item) => lineText.includes(item));
    if (keyword) {
        return lineText.replace(keyword, `[${keyword}]`);
    }

    const compactText = lineText.trim();
    if (compactText.length < 4) {
        return compactText;
    }

    const highlightLength = compactText.length >= 8 ? 3 : 2;
    const start = Math.max(1, Math.floor((compactText.length - highlightLength) / 2));
    return `${compactText.slice(0, start)}[${compactText.slice(start, start + highlightLength)}]${compactText.slice(start + highlightLength)}`;
};

const previewTexts = computed(() => {
    const configuredTexts = props.previewConfig?.subtitleTexts?.filter((text) => Boolean(text && text.trim()));
    const baseTexts = configuredTexts && configuredTexts.length > 0
        ? configuredTexts
        : (isInlineKeywordMode.value ? DEFAULT_INLINE_PREVIEW_TEXTS : DEFAULT_FLOATING_PREVIEW_TEXTS);

    if (!isInlineKeywordMode.value) {
        return baseTexts;
    }

    return baseTexts.map((text) => autoHighlightPreviewText(text));
});

const splitPreviewLine = (lineText: string, allowAccent: boolean): PreviewSegment[] => {
    if (!allowAccent) {
        return [{ text: lineText.replace(/\[|\]/g, ''), accent: false }];
    }

    const segments: PreviewSegment[] = [];
    const pattern = /(\[[^\]]+\])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(lineText)) !== null) {
        const plainText = lineText.slice(lastIndex, match.index);
        if (plainText) {
            segments.push({ text: plainText, accent: false });
        }

        const accentText = match[0].slice(1, -1);
        if (accentText) {
            segments.push({ text: accentText, accent: true });
        }

        lastIndex = match.index + match[0].length;
    }

    const tail = lineText.slice(lastIndex);
    if (tail) {
        segments.push({ text: tail, accent: false });
    }

    return segments.length > 0 ? segments : [{ text: lineText.replace(/\[|\]/g, ''), accent: false }];
};

const renderedSubtitlePreviewLines = computed(() => (
    previewTexts.value.map((lineText) => splitPreviewLine(lineText, isInlineKeywordMode.value))
));

const isTitleVisible = computed(() => titleLines.value.length > 0);
</script>

<template>
    <div
        class="subtitle-preview-card"
        :class="{ 'is-selected': isSelected, 'is-static': !isCardClickable }"
        @click="handleCardClick"
    >
        <div class="preview-shell">
            <div class="preview-container">
                <img :src="bgImageUrl" class="preview-bg" :style="backgroundImageStyle" alt="preview" />
                <div class="preview-overlay" :style="overlayStyle"></div>

                <div v-if="isTitleVisible" class="title-subtitle-preview" :style="titlePreviewStyle">
                    <div
                        v-for="(line, idx) in titleLines"
                        :key="idx"
                        class="title-line-wrap"
                        :style="getTitleLineWrapStyle(line)"
                    >
                        <div class="title-line" :style="getTitleLineStyle(line, idx)">
                            {{ line.text || `标题 ${idx + 1}` }}
                        </div>
                    </div>
                </div>

                <div class="normal-subtitle-preview" :style="subtitlePreviewContainerStyle">
                    <div
                        v-for="(line, lineIndex) in renderedSubtitlePreviewLines"
                        :key="lineIndex"
                        class="subtitle-line"
                        :style="getSubtitleLineStyle(line)"
                    >
                        <span
                            v-for="(segment, segmentIndex) in line"
                            :key="`${lineIndex}-${segmentIndex}`"
                            class="subtitle-segment"
                            :class="{ 'subtitle-segment--accent': segment.accent && isInlineKeywordMode }"
                            :style="getPreviewSegmentStyle(segment, line)"
                        >
                            {{ segment.text }}
                        </span>
                    </div>
                </div>

            </div>
        </div>
        <div v-if="shouldShowMeta || shouldShowActions" class="template-info">
            <div v-if="shouldShowMeta" class="template-title-row">
                <span class="template-name">{{ templateName || '未命名模板' }}</span>
                <span v-if="isSelected" class="selected-badge">已选</span>
                <span v-else-if="isSystem" class="system-tag">系统</span>
            </div>

            <div
                v-if="shouldShowActions"
                class="template-actions"
                :class="{ 'template-actions--with-system': isDev && !isSystem }"
            >
                <a-button type="primary" size="mini" @click.stop="emit('edit')">
                    <icon-edit />
                    编辑
                </a-button>
                <a-button type="outline" size="mini" @click.stop="emit('clone')">
                    <icon-copy />
                    复制
                </a-button>
                <a-button type="outline" size="mini" @click.stop="emit('export')">
                    <icon-download />
                    导出
                </a-button>
                <a-button type="outline" status="danger" size="mini" @click.stop="emit('delete')">
                    <icon-delete />
                    删除
                </a-button>
                <a-button
                    v-if="isDev && !isSystem"
                    type="outline"
                    size="mini"
                    @click.stop="emit('set-as-system')"
                >
                    系统
                </a-button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.subtitle-preview-card {
    position: relative;
    width: 100%;
    min-width: 0;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(203, 213, 225, 0.96);
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    cursor: pointer;
    transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;

    &:hover {
        border-color: rgba(59, 130, 246, 0.3);
        transform: translateY(-3px);
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
    }

    &.is-selected {
        border-color: #14b8a6;
        background: linear-gradient(180deg, #f8fffe 0%, #f0fdfa 100%);
        box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.12), 0 14px 30px rgba(15, 23, 42, 0.1);
    }

    &.is-static {
        cursor: default;

        &:hover {
            border-color: rgba(203, 213, 225, 0.96);
            transform: none;
            box-shadow: none;
        }
    }
}

.preview-shell {
    padding: 10px 10px 0;
}

.preview-container {
    position: relative;
    width: 100%;
    min-height: 308px;
    aspect-ratio: 9 / 16;
    overflow: hidden;
    background: #000;
    border-radius: 14px;
}

.preview-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: none;
    transform: none;
}

.preview-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.title-subtitle-preview {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    z-index: 2;
    padding-top: 6px;
}

.title-line-wrap {
    width: 100%;
    display: flex;
}

.title-line {
    width: fit-content;
    margin-inline: auto;
}

.normal-subtitle-preview {
    position: absolute;
    left: 50%;
    bottom: 8.2%;
    transform: translateX(-50%);
    width: 88%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
    z-index: 2;
}

.subtitle-line {
    display: block;
    max-width: 100%;
    line-height: 1.08;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
}

.subtitle-segment {
    display: inline;
    font-weight: 900;
    letter-spacing: -0.03em;
    white-space: nowrap;
}

.subtitle-segment--accent {
    margin-inline: 2px;
}

.system-tag {
    color: #9a6700;
    font-size: 10px;
    font-weight: 700;
    background: #fef3c7;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
}

.selected-badge {
    color: #0f766e;
    font-size: 10px;
    font-weight: 700;
    background: #ccfbf1;
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
}

.template-info {
    padding: 12px 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.template-title-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
}

.template-name {
    color: #0f172a;
    font-size: 14px;
    line-height: 1.25;
    font-weight: 700;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.template-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: center;
    gap: 6px;
}

.template-actions--with-system {
    grid-template-columns: repeat(5, minmax(0, 1fr));
}

.template-actions :deep(.arco-btn) {
    height: 28px;
    width: 100%;
    min-width: 0;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 11px;
}

.template-actions :deep(.arco-btn-content) {
    gap: 4px;
    min-width: 0;
    white-space: nowrap;
}

@media (max-width: 768px) {
    .subtitle-preview-card {
        max-width: none;
    }
}

/* ====== 卡片背景始终是浅色，按钮文字必须保持深色（两个主题通用） ====== */
.subtitle-preview-card :deep(.arco-btn-outline) {
    color: #475569 !important;
    border-color: #94a3b8 !important;
}
.subtitle-preview-card :deep(.arco-btn-outline.arco-btn-status-danger) {
    color: #dc2626 !important;
    border-color: #fca5a5 !important;
}

/* ====== 深色主题额外覆盖 ====== */
::global(body[data-theme="dark"]) .subtitle-preview-card {
    color: #1e293b !important;
}
::global(body[data-theme="dark"]) .subtitle-preview-card .template-name {
    color: #0f172a !important;
}
::global(body[data-theme="dark"]) .subtitle-preview-card .system-tag {
    color: #9a6700 !important;
    background: #fef3c7 !important;
}
::global(body[data-theme="dark"]) .subtitle-preview-card .selected-badge {
    color: #0f766e !important;
    background: #ccfbf1 !important;
}
::global(body[data-theme="dark"]) .subtitle-preview-card :deep(.arco-btn-primary) {
    color: #ffffff !important;
}
</style>

