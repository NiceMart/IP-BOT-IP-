<template>
    <div class="font-manager-page">
        <div class="page-header mb-6">
            <div class="flex items-center justify-between">
                <div class="flex-grow flex items-end">
                    <div class="text-3xl font-bold">{{ t("字体管理") }}</div>
                    <div class="text-gray-400 ml-3">{{ t("管理系统字体和自定义字体，支持预览和上传") }}</div>
                </div>
                <a-space>
                    <a-button type="primary" @click="showUploadDialog = true">
                        <template #icon>
                            <icon-upload />
                        </template>
                        {{ t("上传字体") }}
                    </a-button>
                    <a-button @click="refreshFonts">
                        <template #icon>
                            <icon-refresh />
                        </template>
                        {{ t("刷新") }}
                    </a-button>
                </a-space>
            </div>
        </div>

        <!-- 搜索和筛选 -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
            <a-row :gutter="16">
                <a-col :span="8">
                    <a-input-search
                        v-model="searchKeyword"
                        :placeholder="t('搜索字体名称')"
                        allow-clear
                    >
                        <template #prefix>
                            <icon-search />
                        </template>
                    </a-input-search>
                </a-col>
                <a-col :span="8">
                    <a-select v-model="filterSource" :placeholder="t('字体来源')" allow-clear>
                        <a-option value="all">{{ t("全部") }}</a-option>
                        <a-option value="bundled">{{ t("预置字体") }}</a-option>
                        <a-option value="system">{{ t("系统字体") }}</a-option>
                        <a-option value="custom">{{ t("自定义字体") }}</a-option>
                    </a-select>
                </a-col>
                <a-col :span="8">
                    <a-select v-model="filterCategory" :placeholder="t('字体分类')" allow-clear>
                        <a-option value="all">{{ t("全部") }}</a-option>
                        <a-option value="sans-serif">{{ t("无衬线") }}</a-option>
                        <a-option value="serif">{{ t("衬线") }}</a-option>
                        <a-option value="monospace">{{ t("等宽") }}</a-option>
                        <a-option value="handwriting">{{ t("手写") }}</a-option>
                        <a-option value="display">{{ t("展示") }}</a-option>
                    </a-select>
                </a-col>
            </a-row>
        </div>

        <!-- 字体统计 -->
        <div class="grid grid-cols-4 gap-4 mb-6">
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-4 text-white">
                <div class="text-sm opacity-90">{{ t("总字体数") }}</div>
                <div class="text-3xl font-bold mt-2">{{ fontStats.total }}</div>
            </div>
            <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-4 text-white">
                <div class="text-sm opacity-90">{{ t("预置字体") }}</div>
                <div class="text-3xl font-bold mt-2">{{ fontStats.bundled }}</div>
            </div>
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-4 text-white">
                <div class="text-sm opacity-90">{{ t("系统字体") }}</div>
                <div class="text-3xl font-bold mt-2">{{ fontStats.system }}</div>
            </div>
            <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-4 text-white">
                <div class="text-sm opacity-90">{{ t("自定义字体") }}</div>
                <div class="text-3xl font-bold mt-2">{{ fontStats.custom }}</div>
            </div>
        </div>

        <!-- 字体列表 -->
        <div class="bg-white rounded-lg shadow">
            <a-spin :loading="loading" class="w-full">
                <div v-if="filteredFonts.length > 0" class="divide-y">
                    <div
                        v-for="font in paginatedFonts"
                        :key="font.value"
                        class="p-4 hover:bg-gray-50 transition-colors"
                    >
                        <FontPreview
                            :font="font"
                            :preview-text="previewText || font.label"
                            @delete="handleDeleteFont"
                        />
                    </div>
                </div>
                <div v-else class="text-center py-12 text-gray-400">
                    <icon-font-colors class="text-6xl mb-4" />
                    <p>{{ t("没有找到字体") }}</p>
                </div>
            </a-spin>

            <!-- 分页 -->
            <div v-if="filteredFonts.length > pageSize" class="p-4 border-t">
                <a-pagination
                    v-model:current="currentPage"
                    :total="filteredFonts.length"
                    :page-size="pageSize"
                    show-total
                    show-jumper
                />
            </div>
        </div>

        <!-- 预览文本设置 -->
        <div class="fixed bottom-6 right-6 bg-white rounded-lg shadow-lg p-4 w-80">
            <div class="font-medium mb-2">{{ t("预览文本") }}</div>
            <a-textarea
                v-model="previewText"
                :placeholder="t('留空则显示字体名称')"
                :auto-size="{ minRows: 2, maxRows: 4 }"
            />
            <div class="mt-2 flex gap-2 flex-wrap">
                <a-button size="small" @click="previewText = ''">{{ t("字体名称") }}</a-button>
                <a-button size="small" @click="previewText = '快速的棕色狐狸跳过懒狗'">中文</a-button>
                <a-button size="small" @click="previewText = 'The quick brown fox jumps over the lazy dog'">English</a-button>
                <a-button size="small" @click="previewText = '0123456789'">数字</a-button>
            </div>
        </div>

        <!-- 上传字体对话框 -->
        <FontUploadDialog
            v-model:visible="showUploadDialog"
            @success="handleUploadSuccess"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { Message } from '@arco-design/web-vue';
import FontPreview from './components/FontPreview.vue';
import FontUploadDialog from './components/FontUploadDialog.vue';

const { t } = useI18n();

// 状态
const loading = ref(false);
const fonts = ref<any[]>([]);
const searchKeyword = ref('');
const filterSource = ref('all');
const filterCategory = ref('all');
const previewText = ref('');
const showUploadDialog = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);

// 字体统计
const fontStats = computed(() => {
    return {
        total: fonts.value.length,
        bundled: fonts.value.filter(f => f.source === 'bundled').length,
        system: fonts.value.filter(f => f.source === 'system').length,
        custom: fonts.value.filter(f => f.source === 'custom').length,
    };
});

// 过滤后的字体
const filteredFonts = computed(() => {
    let result = fonts.value;

    // 搜索过滤
    if (searchKeyword.value) {
        const keyword = searchKeyword.value.toLowerCase();
        result = result.filter(font =>
            font.label.toLowerCase().includes(keyword) ||
            font.value.toLowerCase().includes(keyword)
        );
    }

    // 来源过滤
    if (filterSource.value && filterSource.value !== 'all') {
        result = result.filter(font => font.source === filterSource.value);
    }

    // 分类过滤
    if (filterCategory.value && filterCategory.value !== 'all') {
        result = result.filter(font => font.category === filterCategory.value);
    }

    return result;
});

// 分页后的字体
const paginatedFonts = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredFonts.value.slice(start, end);
});

// 加载字体列表
const loadFonts = async () => {
    loading.value = true;
    try {
        // 调用API获取字体列表
        const result = await window.$mapi.fontManager.getAllFonts();
        if (result.success) {
            fonts.value = result.data;
        } else {
            Message.error(t('加载字体列表失败'));
        }
    } catch (error) {
        console.error('加载字体失败:', error);
        Message.error(t('加载字体列表失败'));
    } finally {
        loading.value = false;
    }
};

// 刷新字体列表
const refreshFonts = () => {
    currentPage.value = 1;
    loadFonts();
};

// 处理字体上传成功
const handleUploadSuccess = () => {
    Message.success(t('字体上传成功'));
    refreshFonts();
};

// 处理删除字体
const handleDeleteFont = async (font: any) => {
    if (font.source !== 'custom') {
        Message.warning(t('只能删除自定义字体'));
        return;
    }

    try {
        const result = await window.$mapi.fontManager.deleteFont(font.value);
        if (result.success) {
            Message.success(t('字体删除成功'));
            refreshFonts();
        } else {
            Message.error(result.message || t('删除失败'));
        }
    } catch (error) {
        console.error('删除字体失败:', error);
        Message.error(t('删除字体失败'));
    }
};

onMounted(() => {
    loadFonts();
    
    // 监听字体列表变更事件
    const unsubscribe = window.$mapi.fontManager.onFontsChanged(() => {
        console.log('[FontManager] Fonts changed, reloading...');
        refreshFonts();
    });
    
    // 组件卸载时取消监听
    onBeforeUnmount(() => {
        unsubscribe();
    });
});
</script>

<style scoped>
.font-manager-page {
    padding: 24px;
    min-height: 100vh;
    background: #f5f5f5;
}

.page-header {
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>