<template>
    <div class="font-preview-item">
        <div class="flex items-start gap-4">
            <!-- 字体信息 -->
            <div class="flex-shrink-0 w-48">
                <div class="font-medium text-lg mb-1">{{ font.label }}</div>
                <div class="text-sm text-gray-500 mb-2">{{ font.value }}</div>
                <div class="flex gap-2 flex-wrap">
                    <a-tag :color="getSourceColor(font.source)" size="small">
                        {{ getSourceLabel(font.source) }}
                    </a-tag>
                    <a-tag v-if="font.category" size="small">
                        {{ getCategoryLabel(font.category) }}
                    </a-tag>
                    <a-tag v-if="font.languages && font.languages.length > 0" size="small">
                        {{ font.languages.join(', ') }}
                    </a-tag>
                </div>
            </div>

            <!-- 字体预览 -->
            <div class="flex-grow">
                <div
                    class="font-preview-text"
                    :style="{
                        fontFamily: `'${font.value}', sans-serif`,
                        fontSize: previewFontSize + 'px'
                    }"
                >
                    {{ previewText }}
                </div>
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-xs text-gray-500">{{ t("字号") }}:</span>
                    <a-slider
                        v-model="previewFontSize"
                        :min="12"
                        :max="72"
                        :step="2"
                        class="w-32"
                    />
                    <span class="text-xs font-mono">{{ previewFontSize }}px</span>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex-shrink-0 flex flex-col gap-2">
                <a-button size="small" @click="copyFontName">
                    <template #icon>
                        <icon-copy />
                    </template>
                    {{ t("复制名称") }}
                </a-button>
                <a-button size="small" @click="showDetails = true">
                    <template #icon>
                        <icon-info-circle />
                    </template>
                    {{ t("详情") }}
                </a-button>
                <a-button
                    v-if="font.source === 'custom'"
                    size="small"
                    status="danger"
                    @click="handleDelete"
                >
                    <template #icon>
                        <icon-delete />
                    </template>
                    {{ t("删除") }}
                </a-button>
            </div>
        </div>

        <!-- 字体详情对话框 -->
        <a-modal
            v-model:visible="showDetails"
            :title="t('字体详情')"
            :footer="false"
            width="600px"
        >
            <a-descriptions :column="1" bordered>
                <a-descriptions-item :label="t('字体名称')">
                    {{ font.label }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('字体标识')">
                    <code class="bg-gray-100 px-2 py-1 rounded">{{ font.value }}</code>
                </a-descriptions-item>
                <a-descriptions-item :label="t('来源')">
                    <a-tag :color="getSourceColor(font.source)">
                        {{ getSourceLabel(font.source) }}
                    </a-tag>
                </a-descriptions-item>
                <a-descriptions-item v-if="font.category" :label="t('分类')">
                    {{ getCategoryLabel(font.category) }}
                </a-descriptions-item>
                <a-descriptions-item v-if="font.languages && font.languages.length > 0" :label="t('支持语言')">
                    {{ font.languages.join(', ') }}
                </a-descriptions-item>
                <a-descriptions-item v-if="font.path" :label="t('文件路径')">
                    <div class="text-xs font-mono break-all">{{ font.path }}</div>
                </a-descriptions-item>
                <a-descriptions-item :label="t('预览')">
                    <div
                        class="p-4 bg-gray-50 rounded"
                        :style="{ fontFamily: `'${font.value}', sans-serif` }"
                    >
                        <div class="text-2xl mb-2">{{ previewText }}</div>
                        <div class="text-sm text-gray-600">
                            ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>
                            abcdefghijklmnopqrstuvwxyz<br>
                            0123456789 !@#$%^&*()
                        </div>
                    </div>
                </a-descriptions-item>
            </a-descriptions>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Message, Modal } from '@arco-design/web-vue';

const { t } = useI18n();

interface FontInfo {
    value: string;
    label: string;
    source: 'bundled' | 'system' | 'custom' | 'ziti';
    category?: string;
    languages?: string[];
    path?: string;
}

interface Props {
    font: FontInfo;
    previewText: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    delete: [font: FontInfo];
}>();

const showDetails = ref(false);
const previewFontSize = ref(24);
const fontLoaded = ref(false);

// 动态加载字体
onMounted(async () => {
    // 如果是 ziti 字体且有路径，需要动态加载
    if (props.font.source === 'ziti' && props.font.path) {
        try {
            console.log('[FontPreview] Loading font:', props.font.value, 'from:', props.font.path);

            // ✅ 修复：使用 font:// 自定义协议加载字体（支持打包环境）
            const fontUrl = `font://${encodeURIComponent(props.font.path)}`;

            // 创建 style 标签注入 @font-face
            const styleId = `font-face-${props.font.value.replace(/\s+/g, '-')}`;
            let styleEl = document.getElementById(styleId) as HTMLStyleElement;

            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }

            // 使用 font:// 协议 URL（在开发和打包环境都有效）
            styleEl.textContent = `
                @font-face {
                    font-family: "${props.font.value}";
                    src: url("${fontUrl}");
                    font-display: swap;
                }
            `;

            console.log('[FontPreview] Font face created with URL:', fontUrl);

            // 等待字体加载
            await document.fonts.ready;

            fontLoaded.value = true;
            console.log('[FontPreview] Font loaded successfully:', props.font.value);
        } catch (error) {
            console.error('[FontPreview] Failed to load font:', props.font.value, error);
            // 即使加载失败也标记为已尝试，避免一直重试
            fontLoaded.value = true;
        }
    } else {
        // 系统字体和预置字体不需要加载
        fontLoaded.value = true;
    }
});

// 获取来源标签
const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
        bundled: t('预置'),
        system: t('系统'),
        custom: t('自定义'),
        ziti: 'Ziti',
    };
    return labels[source] || source;
};

// 获取来源颜色
const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
        bundled: 'blue',
        system: 'green',
        custom: 'orange',
        ziti: 'purple',
    };
    return colors[source] || 'gray';
};

// 获取分类标签
const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
        'sans-serif': t('无衬线'),
        'serif': t('衬线'),
        'monospace': t('等宽'),
        'handwriting': t('手写'),
        'display': t('展示'),
    };
    return labels[category] || category;
};

// 复制字体名称
const copyFontName = async () => {
    try {
        await navigator.clipboard.writeText(props.font.value);
        Message.success(t('已复制到剪贴板'));
    } catch (error) {
        Message.error(t('复制失败'));
    }
};

// 处理删除
const handleDelete = () => {
    Modal.confirm({
        title: t('确认删除'),
        content: t('确定要删除字体 "{name}" 吗？此操作不可恢复。', { name: props.font.label }),
        onOk: () => {
            emit('delete', props.font);
        },
    });
};
</script>

<style scoped>
.font-preview-item {
    transition: all 0.3s;
}

.font-preview-text {
    padding: 12px;
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
    min-height: 60px;
    display: flex;
    align-items: center;
    word-break: break-word;
}

code {
    font-family: 'Courier New', monospace;
}
</style>