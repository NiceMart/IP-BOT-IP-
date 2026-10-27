<template>
    <div class="font-manager-setting">
        <a-space direction="vertical" size="large" class="w-full">
            <!-- 字体统计卡片 -->
            <a-card :title="t('字体统计')" :bordered="false">
                <a-row :gutter="16">
                    <a-col :span="6">
                        <a-statistic
                            :title="t('总字体数')"
                            :value="fontStats.total"
                            :value-style="{ color: '#3f8600' }"
                        >
                            <template #prefix>
                                <icon-font-colors />
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="6">
                        <a-statistic
                            :title="t('预置字体')"
                            :value="fontStats.bundled"
                        >
                            <template #prefix>
                                <icon-check-circle />
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="6">
                        <a-statistic
                            :title="t('系统字体')"
                            :value="fontStats.system"
                        >
                            <template #prefix>
                                <icon-desktop />
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="6">
                        <a-statistic
                            :title="t('ziti字体')"
                            :value="fontStats.ziti"
                        >
                            <template #prefix>
                                <icon-folder />
                            </template>
                        </a-statistic>
                    </a-col>
                    <a-col :span="6">
                        <a-statistic
                            :title="t('自定义字体')"
                            :value="fontStats.custom"
                        >
                            <template #prefix>
                                <icon-user />
                            </template>
                        </a-statistic>
                    </a-col>
                </a-row>
            </a-card>

            <!-- 快速操作 -->
            <a-card :title="t('快速操作')" :bordered="false">
                <a-space>
                    <a-button @click="showUploadDialog = true">
                        <template #icon>
                            <icon-upload />
                        </template>
                        {{ t('上传字体') }}
                    </a-button>
                    <a-button @click="refreshFonts">
                        <template #icon>
                            <icon-refresh />
                        </template>
                        {{ t('刷新字体列表') }}
                    </a-button>
                    <a-input-search
                        :model-value="searchText"
                        @input="(value) => { searchText = value; handleSearchInput(value); }"
                        :placeholder="t('搜索字体名称')"
                        style="width: 300px"
                        allow-clear
                    />
                </a-space>
            </a-card>

            <!-- 所有字体列表 -->
            <a-card :title="t('所有字体')" :bordered="false">
                <!-- 🔧 加载进度提示 -->
                <a-alert v-if="loading" type="info" closable style="margin-bottom: 16px;">
                    <template #title>
                        {{ loadingMessage || t('正在加载字体列表...') }}
                    </template>
                </a-alert>
                <a-spin :loading="loading">
                    <div v-if="filteredFonts.length > 0" class="space-y-2">
                        <div
                            v-for="font in paginatedFonts"
                            :key="font.value"
                            class="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                        >
                            <div class="flex items-center gap-3 flex-1">
                                <icon-font-colors
                                    class="text-2xl"
                                    :class="{
                                        'text-blue-500': font.source === 'bundled',
                                        'text-green-500': font.source === 'ziti',
                                        'text-purple-500': font.source === 'custom',
                                        'text-gray-500': font.source === 'system'
                                    }"
                                />
                                <div class="flex-1">
                                    <div class="font-medium">{{ font.label }}</div>
                                    <div class="text-sm text-gray-500 flex items-center gap-2">
                                        <span>{{ font.value }}</span>
                                        <a-tag size="small" :color="getSourceColor(font.source)">
                                            {{ getSourceLabel(font.source) }}
                                        </a-tag>
                                        <a-tag v-if="font.fontType" size="small" :color="getFontTypeColor(font.fontType)">
                                            {{ getFontTypeLabel(font.fontType) }}
                                        </a-tag>
                                    </div>
                                </div>
                            </div>
                            <a-space>
                                <a-button size="small" @click="previewFont(font)">
                                    <template #icon>
                                        <icon-eye />
                                    </template>
                                    {{ t('预览') }}
                                </a-button>
                                <a-button
                                    v-if="font.source === 'custom' || font.source === 'ziti'"
                                    size="small"
                                    status="danger"
                                    @click="deleteFont(font)"
                                >
                                    <template #icon>
                                        <icon-delete />
                                    </template>
                                    {{ t('删除') }}
                                </a-button>
                            </a-space>
                        </div>
                        
                        <!-- 分页 -->
                        <div class="flex justify-center mt-4">
                            <a-pagination
                                v-model:current="currentPage"
                                :total="filteredFonts.length"
                                :page-size="pageSize"
                                show-total
                                show-jumper
                            />
                        </div>
                    </div>
                    <a-empty v-else :description="t('未找到字体')" />
                </a-spin>
            </a-card>

            <!-- 字体目录信息 -->
            <a-card :title="t('字体目录')" :bordered="false">
                <a-descriptions :column="1" bordered>
                    <a-descriptions-item :label="t('预置字体目录')">
                        <code class="text-xs">fonts/bundled/</code>
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('ziti字体目录')">
                        <code class="text-xs">ziti/</code>
                        <a-button size="mini" type="text" @click="openZitiDir" class="ml-2">
                            <template #icon>
                                <icon-folder />
                            </template>
                            {{ t('打开') }}
                        </a-button>
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('自定义字体目录')">
                        <code class="text-xs">{{ customFontDir }}</code>
                        <a-button size="mini" type="text" @click="openFontDir" class="ml-2">
                            <template #icon>
                                <icon-folder />
                            </template>
                            {{ t('打开') }}
                        </a-button>
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('支持格式')">
                        <a-space>
                            <a-tag>TTF</a-tag>
                            <a-tag>OTF</a-tag>
                            <a-tag>WOFF</a-tag>
                            <a-tag>WOFF2</a-tag>
                            <a-tag>TTC</a-tag>
                        </a-space>
                    </a-descriptions-item>
                </a-descriptions>
            </a-card>
        </a-space>

        <!-- 字体预览对话框 -->
        <a-modal
            v-model:visible="showPreviewDialog"
            :title="t('字体预览')"
            :footer="false"
            width="600px"
        >
            <div v-if="previewingFont" class="space-y-4">
                <div class="text-center">
                    <div class="text-lg font-medium mb-2">{{ previewingFont.label }}</div>
                    <div class="text-sm text-gray-500">{{ previewingFont.value }}</div>
                </div>
                <div
                    class="p-6 bg-gray-50 rounded text-center"
                    :style="{ fontFamily: `'${previewingFont.value}', sans-serif`, fontSize: previewFontSize + 'px' }"
                >
                    {{ previewText || previewingFont.label }}
                </div>
                <div>
                    <div class="text-sm mb-2">{{ t('字号') }}: {{ previewFontSize }}px</div>
                    <a-slider v-model="previewFontSize" :min="12" :max="72" />
                </div>
                <a-textarea
                    v-model="previewText"
                    :placeholder="t('留空则显示字体名称')"
                    :auto-size="{ minRows: 2, maxRows: 4 }"
                />
                <div class="flex gap-2 flex-wrap mt-2">
                    <a-button size="small" @click="previewText = ''">{{ t("字体名称") }}</a-button>
                    <a-button size="small" @click="previewText = '快速的棕色狐狸跳过懒狗'">中文</a-button>
                    <a-button size="small" @click="previewText = 'The quick brown fox jumps over the lazy dog'">English</a-button>
                    <a-button size="small" @click="previewText = '0123456789'">数字</a-button>
                </div>
            </div>
        </a-modal>

        <!-- 字体上传对话框 -->
        <FontUploadDialog
            v-model:visible="showUploadDialog"
            @success="handleUploadSuccess"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Message, Modal } from '@arco-design/web-vue';
import { useRouter } from 'vue-router';
import FontUploadDialog from '../../pages/Video/components/FontUploadDialog.vue';

const { t } = useI18n();
const router = useRouter();

// 🔧 防抖函数
const debounce = (fn: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

const loading = ref(false);
const loadingProgress = ref(0);
const loadingMessage = ref('');
const fonts = ref<any[]>([]);
const showUploadDialog = ref(false);
const showPreviewDialog = ref(false);
const previewingFont = ref<any>(null);
const previewFontSize = ref(24);
const previewText = ref('');
const customFontDir = ref('userData/fonts/custom');

// 搜索文本
const searchText = ref('');
const debouncedSearchText = ref('');

// 当前页码
const currentPage = ref(1);

// 每页显示数量
const pageSize = ref(20);

// 🔧 缓存字体统计结果，避免重复计算
const fontStatsCache = ref<any>(null);

// 字体统计（使用缓存）
const fontStats = computed(() => {
    // 只在 fonts 数组变化时重新计算
    const stats = {
        total: fonts.value.length,
        bundled: fonts.value.filter(f => f.source === 'bundled').length,
        system: fonts.value.filter(f => f.source === 'system').length,
        ziti: fonts.value.filter(f => f.source === 'ziti').length,
        custom: fonts.value.filter(f => f.source === 'custom').length,
    };
    fontStatsCache.value = stats;
    return stats;
});

// 🔧 防抖搜索处理（避免每次搜索都重新过滤）
const handleSearchInput = debounce((value: string) => {
    debouncedSearchText.value = value;
    currentPage.value = 1; // 搜索时重置分页
}, 300);

// 过滤后的字体列表
const filteredFonts = computed(() => {
    if (!debouncedSearchText.value) {
        return fonts.value;
    }
    const search = debouncedSearchText.value.toLowerCase();
    return fonts.value.filter(f =>
        f.label.toLowerCase().includes(search) ||
        f.value.toLowerCase().includes(search)
    );
});

// 分页后的字体列表
const paginatedFonts = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredFonts.value.slice(start, end);
});

// 获取来源标签
const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
        'bundled': t('预置'),
        'ziti': t('ziti'),
        'custom': t('自定义'),
        'system': t('系统')
    };
    return labels[source] || source;
};

// 获取来源颜色
const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
        'bundled': 'blue',
        'ziti': 'green',
        'custom': 'purple',
        'system': 'gray'
    };
    return colors[source] || 'gray';
};

// 获取字体类型标签
const getFontTypeLabel = (fontType: string) => {
    const labels: Record<string, string> = {
        'Chinese': t('中文字体'),
        'English': t('英文字体'),
        'Mixed': t('混合字体')
    };
    return labels[fontType] || fontType;
};

// 获取字体类型颜色
const getFontTypeColor = (fontType: string) => {
    const colors: Record<string, string> = {
        'Chinese': 'red',
        'English': 'cyan',
        'Mixed': 'orange'
    };
    return colors[fontType] || 'gray';
};

// 加载字体列表
const loadFonts = async () => {
    loading.value = true;
    loadingProgress.value = 0;
    loadingMessage.value = t('正在加载字体列表...');

    try {
        console.log('开始加载字体列表...');

        // 🔧 模拟进度更新（字体加载是异步的，不会立即完成）
        const progressInterval = setInterval(() => {
            if (loadingProgress.value < 90) {
                loadingProgress.value += Math.random() * 30;
            }
        }, 200);

        const result = await window.$mapi.fontManager.getAllFonts();
        clearInterval(progressInterval);
        loadingProgress.value = 100;

        console.log('字体加载结果:', result);

        if (result.success) {
            fonts.value = result.data || [];
            debouncedSearchText.value = ''; // 清空搜索
            currentPage.value = 1; // 重置分页

            console.log('成功加载字体数量:', fonts.value.length);
            loadingMessage.value = t('字体列表加载成功，共 {count} 个字体', { count: fonts.value.length });

            // 延迟1秒后隐藏加载提示
            setTimeout(() => {
                loading.value = false;
                loadingProgress.value = 0;
            }, 1000);
        } else {
            console.error('加载字体失败:', result.message);
            loading.value = false;
            Message.error(result.message || t('加载字体列表失败'));
        }
    } catch (error: any) {
        console.error('加载字体异常:', error);
        loading.value = false;
        Message.error(t('加载字体列表失败: {error}', { error: error.message || error }));
    }
};

// 刷新字体列表
const refreshFonts = () => {
    Message.info(t('正在刷新字体列表...'));
    currentPage.value = 1;
    loadFonts();
};

// 打开字体目录
const openFontDir = async () => {
    try {
        await window.$mapi.shell.openPath(customFontDir.value);
    } catch (error) {
        Message.error(t('打开目录失败'));
    }
};

// 打开ziti目录
const openZitiDir = async () => {
    try {
        const path = require('path');
        const zitiPath = path.join(process.cwd(), 'ziti');
        console.log('打开 ziti 目录:', zitiPath);

        // 🔧 使用 $mapi 代替直接 require('electron')
        if (window.$mapi && window.$mapi.app) {
            await window.$mapi.app.openPath(zitiPath);
            Message.success(t('已打开目录'));
        } else {
            console.warn('⚠️ $mapi.app 不可用，无法打开目录');
            Message.error(t('应用接口不可用'));
        }
    } catch (error: any) {
        console.error('打开 ziti 目录失败:', error);
        Message.error(t('打开目录失败: {error}', { error: error.message || error }));
    }
};

// 预览字体
const previewFont = async (font: any) => {
    previewingFont.value = font;
    previewText.value = ''; // 重置为空，显示字体名称
    
    // 如果是 ziti 字体，需要动态加载
    if (font.source === 'ziti' && font.path) {
        try {
            console.log('[SettingFontManager] Loading font:', font.value, 'from:', font.path);
            
            // 使用自定义 font:// 协议
            const fontUrl = `font://${encodeURIComponent(font.path)}`;
            
            // 创建 style 标签注入 @font-face
            const styleId = `font-face-preview-${font.value.replace(/\s+/g, '-')}`;
            let styleEl = document.getElementById(styleId) as HTMLStyleElement;
            
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            // 使用自定义协议 URL
            styleEl.textContent = `
                @font-face {
                    font-family: "${font.value}";
                    src: url("${fontUrl}");
                    font-display: swap;
                }
            `;
            
            console.log('[SettingFontManager] Font face created with URL:', fontUrl);
            
            // 等待字体加载
            await document.fonts.ready;
            
            console.log('[SettingFontManager] Font loaded successfully:', font.value);
        } catch (error) {
            console.error('[SettingFontManager] Failed to load font:', font.value, error);
        }
    }
    
    showPreviewDialog.value = true;
};

// 删除字体
const deleteFont = (font: any) => {
    const isZitiFont = font.source === 'ziti';
    const warningMessage = isZitiFont
        ? t('确定要删除 ziti 目录中的字体 "{name}" 吗？文件将被永久删除！', { name: font.label })
        : t('确定要删除字体 "{name}" 吗？此操作不可恢复。', { name: font.label });
    
    Modal.confirm({
        title: t('确认删除'),
        content: warningMessage,
        onOk: async () => {
            try {
                if (isZitiFont) {
                    // ziti 目录的字体直接删除文件
                    if (!font.path) {
                        Message.error(t('字体文件路径不存在'));
                        return;
                    }
                    
                    const fs = require('fs');
                    console.log('删除 ziti 字体文件:', font.path);
                    
                    // 检查文件是否存在
                    if (!fs.existsSync(font.path)) {
                        Message.error(t('字体文件不存在'));
                        return;
                    }
                    
                    // 删除文件
                    fs.unlinkSync(font.path);
                    Message.success(t('字体删除成功'));
                    loadFonts();
                    return;
                }
                
                const result = await window.$mapi.fontManager.deleteFont(font.value);
                if (result.success) {
                    Message.success(t('字体删除成功'));
                    loadFonts();
                } else {
                    Message.error(result.message || t('删除失败'));
                }
            } catch (error: any) {
                console.error('删除字体失败:', error);
                Message.error(t('删除字体失败: {error}', { error: error.message || error }));
            }
        },
    });
};

// 处理上传成功
const handleUploadSuccess = () => {
    Message.success(t('字体上传成功'));
    loadFonts();
};

onMounted(async () => {
    console.log('字体管理页面已挂载，开始加载字体...');

    // 🔧 异步加载字体（不阻塞组件初始化）
    // 使用 Promise 而不是 await，让组件先渲染，再加载字体
    loadFonts().catch(error => {
        console.error('字体加载失败:', error);
    });

    // 监听字体列表变更事件
    const unsubscribe = window.$mapi.fontManager.onFontsChanged(() => {
        console.log('[SettingFontManager] Fonts changed, reloading...');
        refreshFonts();
    });

    // 组件卸载时取消监听
    onBeforeUnmount(() => {
        unsubscribe();
    });
});
</script>

<style scoped>
/* 深色主题样式 */
.font-manager-setting {
    color: #f3f4f6;
}

/* 卡片内容背景 */
:deep(.arco-card) {
    background-color: rgba(30, 35, 45, 0.7) !important;
    border-color: rgba(59, 130, 246, 0.2) !important;
    color: #f3f4f6;
}

:deep(.arco-card-header) {
    background-color: transparent !important;
    border-color: rgba(59, 130, 246, 0.2) !important;
    color: #f3f4f6 !important;
}

:deep(.arco-card-body) {
    background-color: transparent !important;
    color: #f3f4f6;
}

/* 字体列表项背景 */
:deep(.bg-gray-50) {
    background-color: rgba(40, 45, 55, 0.7) !important;
    color: #f3f4f6 !important;
}

:deep(.hover\:bg-gray-100:hover) {
    background-color: rgba(59, 130, 246, 0.2) !important;
}

/* 文字颜色 */
:deep(.text-gray-500) {
    color: #d1d5db !important;
}

:deep(.font-medium) {
    color: #f3f4f6 !important;
}

:deep(.text-sm) {
    color: #e5e7eb !important;
}

:deep(.text-lg) {
    color: #f3f4f6 !important;
}

/* 统计数据 */
:deep(.arco-statistic-title) {
    color: #d1d5db !important;
}

:deep(.arco-statistic-value) {
    color: #f3f4f6 !important;
}

/* 输入框 */
:deep(.arco-input-search) {
    background-color: #ffffff !important;
}

/* Code标签 */
code {
    font-family: 'Courier New', monospace;
    background-color: rgba(40, 45, 55, 0.8) !important;
    color: #60a5fa !important;
    padding: 2px 6px;
    border-radius: 3px;
}

/* 描述列表 */
:deep(.arco-descriptions-item-label) {
    color: #d1d5db !important;
    background-color: rgba(30, 35, 45, 0.6) !important;
}

:deep(.arco-descriptions-item-value) {
    color: #f3f4f6 !important;
    background-color: rgba(30, 35, 45, 0.6) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting {
    color: #1f2749 !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-card) {
    background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,245,255,0.98) 100%) !important;
    border-color: rgba(132, 142, 220, 0.22) !important;
    color: #1f2749 !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.84), 0 10px 24px rgba(104,110,170,0.08) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-card-header),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-card-body) {
    background: transparent !important;
    color: #1f2749 !important;
    border-color: rgba(132, 142, 220, 0.22) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.bg-gray-50) {
    background: linear-gradient(180deg, rgba(249,250,255,0.98) 0%, rgba(239,242,255,1) 100%) !important;
    color: #1f2749 !important;
    border-color: rgba(132, 142, 220, 0.22) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.hover\:bg-gray-100:hover) {
    background: rgba(106, 116, 247, 0.08) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.text-gray-500),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-statistic-title) {
    color: #617098 !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.font-medium),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.text-sm),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.text-lg),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-statistic-value),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-card-header-title),
:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-descriptions-item-value) {
    color: #1f2749 !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting :deep(.arco-descriptions-item-label) {
    color: #617098 !important;
    background: rgba(244,245,255,0.98) !important;
}

:global(body[data-theme="soft-light"]) .font-manager-setting code {
    background-color: rgba(106, 116, 247, 0.08) !important;
    color: #4966e6 !important;
}
</style>
