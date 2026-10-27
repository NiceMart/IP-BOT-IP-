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
            v-model="searchText"
            :placeholder="t('搜索字体名称')"
            style="width: 300px"
            allow-clear
            @input="handleSearchInput"
          />
        </a-space>
      </a-card>

      <!-- 字体列表 - 使用虚拟滚动 -->
      <a-card :title="t('所有字体')" :bordered="false">
        <a-alert v-if="loading" type="info" closable style="margin-bottom: 16px;">
          <template #title>
            {{ loadingMessage || t('正在加载字体列表...') }}
          </template>
        </a-alert>

        <div v-if="filteredFonts.length > 0" class="font-list-container">
          <!-- 虚拟滚动容器 -->
          <div
            ref="scrollContainerRef"
            class="virtual-scroll-container"
            :style="{ height: '600px' }"
            @scroll="handleScroll"
          >
            <!-- 总高度占位 -->
            <div :style="{ height: totalHeight + 'px', position: 'relative' }">
              <!-- 可见区域的字体项 -->
              <div
                v-for="font in visibleFonts"
                :key="font.value"
                class="font-item-wrapper"
                :style="{
                  position: 'absolute',
                  top: font.top + 'px',
                  left: 0,
                  right: 0,
                  height: ITEM_HEIGHT + 'px'
                }"
              >
                <div
                  class="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors h-full"
                >
                  <div class="flex items-center space-x-3">
                    <div
                      class="font-preview text-2xl font-bold"
                      :style="{ fontFamily: font.value }"
                    >
                      {{ t('示例文字') }}
                    </div>
                    <div>
                      <div class="font-name text-sm font-medium">{{ font.label }}</div>
                      <div class="font-path text-xs text-gray-500">{{ font.value }}</div>
                      <div class="font-type text-xs text-gray-400">
                        <a-tag
                          v-if="font.type === 'bundled'"
                          color="green"
                          size="small"
                        >{{ t('预置') }}</a-tag>
                        <a-tag
                          v-else-if="font.type === 'system'"
                          color="blue"
                          size="small"
                        >{{ t('系统') }}</a-tag>
                        <a-tag
                          v-else-if="font.type === 'ziti'"
                          color="orange"
                          size="small"
                        >{{ t('字由') }}</a-tag>
                        <a-tag
                          v-else
                          color="purple"
                          size="small"
                        >{{ t('自定义') }}</a-tag>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2">
                    <a-button
                      type="text"
                      size="small"
                      @click="previewFont(font)"
                    >
                      <template #icon>
                        <icon-eye />
                      </template>
                      {{ t('预览') }}
                    </a-button>
                    <a-button
                      v-if="font.type === 'custom'"
                      type="text"
                      size="small"
                      status="danger"
                      @click="deleteFont(font)"
                    >
                      <template #icon>
                        <icon-delete />
                      </template>
                      {{ t('删除') }}
                    </a-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 滚动到底部按钮 -->
          <a-button
            v-if="showScrollToBottom"
            type="primary"
            shape="circle"
            class="scroll-to-bottom"
            @click="scrollToBottom"
          >
            <template #icon>
              <icon-arrow-down />
            </template>
          </a-button>
        </div>

        <a-empty v-else description="暂无字体" />
      </a-card>
    </a-space>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Message } from '@arco-design/web-vue';
import {
  IconFontColors,
  IconCheckCircle,
  IconDesktop,
  IconUser,
  IconUpload,
  IconRefresh,
  IconEye,
  IconDelete,
  IconArrowDown
} from '@arco-design/web-vue/es/icon';
import { t } from '../../lang';
import { useDebounceFn, useThrottleFn } from '@vueuse/core';

// 类型定义
interface FontItem {
  label: string;
  value: string;
  type: 'bundled' | 'system' | 'ziti' | 'custom';
  loaded?: boolean;
  weight?: string;
  style?: string;
  path?: string;
}

// 虚拟滚动配置
const ITEM_HEIGHT = 80; // 每个字体项的高度
const BUFFER_SIZE = 5; // 上下缓冲区数量

// 响应式数据
const loading = ref(false);
const loadingMessage = ref('');
const searchText = ref('');
const fonts = ref<FontItem[]>([]);
const scrollContainerRef = ref<HTMLElement>();
const scrollTop = ref(0);
const containerHeight = ref(600);

// 计算属性
const filteredFonts = computed(() => {
  if (!searchText.value) return fonts.value;

  const searchLower = searchText.value.toLowerCase();
  return fonts.value.filter(font =>
    font.label.toLowerCase().includes(searchLower) ||
    font.value.toLowerCase().includes(searchLower)
  );
});

const totalHeight = computed(() => {
  return filteredFonts.value.length * ITEM_HEIGHT;
});

const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - BUFFER_SIZE);
});

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / ITEM_HEIGHT);
  return Math.min(
    filteredFonts.value.length - 1,
    startIndex.value + visibleCount + BUFFER_SIZE * 2
  );
});

const visibleFonts = computed(() => {
  return filteredFonts.value
    .slice(startIndex.value, endIndex.value + 1)
    .map((font, index) => ({
      ...font,
      top: (startIndex.value + index) * ITEM_HEIGHT
    }));
});

const showScrollToBottom = computed(() => {
  return scrollTop.value < totalHeight.value - containerHeight.value - 100;
});

// 统计数据
const fontStats = computed(() => {
  const stats = {
    total: fonts.value.length,
    bundled: 0,
    system: 0,
    ziti: 0,
    custom: 0
  };

  fonts.value.forEach(font => {
    stats[font.type]++;
  });

  return stats;
});

// 防抖搜索（已移除不必要的 console.log）
const debouncedSearch = useDebounceFn((value: string) => {
  // 搜索逻辑已在 computed 中处理
}, 300);

// 节流滚动
const throttledScroll = useThrottleFn((e: Event) => {
  const target = e.target as HTMLElement;
  scrollTop.value = target.scrollTop;
}, 16); // 约60fps

// 事件处理
const handleSearchInput = (value: string) => {
  searchText.value = value;
  debouncedSearch(value);
};

const handleScroll = (e: Event) => {
  throttledScroll(e);
};

const scrollToBottom = () => {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTo({
      top: totalHeight.value,
      behavior: 'smooth'
    });
  }
};

const previewFont = (font: FontItem) => {
  // 实现字体预览逻辑
  Message.info(`预览字体: ${font.label}`);
};

const deleteFont = async (font: FontItem) => {
  try {
    // 实现删除字体逻辑
    const index = fonts.value.findIndex(f => f.value === font.value);
    if (index > -1) {
      fonts.value.splice(index, 1);
      Message.success(`已删除字体: ${font.label}`);
    }
  } catch (error) {
    Message.error(`删除字体失败: ${error}`);
  }
};

const refreshFonts = async () => {
  loading.value = true;
  loadingMessage.value = '正在刷新字体列表...';

  try {
    // 模拟加载字体
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 这里应该是实际的字体加载逻辑
    fonts.value = generateMockFonts();

    Message.success('字体列表已刷新');
  } catch (error) {
    Message.error('刷新字体列表失败');
  } finally {
    loading.value = false;
    loadingMessage.value = '';
  }
};

// 生成模拟字体数据
const generateMockFonts = (): FontItem[] => {
  const mockFonts: FontItem[] = [];

  // 预置字体
  for (let i = 1; i <= 20; i++) {
    mockFonts.push({
      label: `预置字体 ${i}`,
      value: `BundledFont${i}`,
      type: 'bundled',
      loaded: true
    });
  }

  // 系统字体
  for (let i = 1; i <= 30; i++) {
    mockFonts.push({
      label: `系统字体 ${i}`,
      value: `SystemFont${i}`,
      type: 'system',
      loaded: true
    });
  }

  // 字由字体
  for (let i = 1; i <= 25; i++) {
    mockFonts.push({
      label: `字由字体 ${i}`,
      value: `ZitiFont${i}`,
      type: 'ziti',
      loaded: false
    });
  }

  // 自定义字体
  for (let i = 1; i <= 15; i++) {
    mockFonts.push({
      label: `自定义字体 ${i}`,
      value: `CustomFont${i}`,
      type: 'custom',
      loaded: true,
      path: `/fonts/custom${i}.ttf`
    });
  }

  return mockFonts;
};

// 生命周期
onMounted(async () => {
  await refreshFonts();

  // 监听容器大小变化
  if (scrollContainerRef.value) {
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(scrollContainerRef.value);

    onBeforeUnmount(() => {
      resizeObserver.disconnect();
    });
  }
});
</script>

<style scoped>
.font-manager-setting {
  padding: 20px;
}

.font-list-container {
  position: relative;
}

.virtual-scroll-container {
  overflow-y: auto;
  overflow-x: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.font-item-wrapper {
  box-sizing: border-box;
  padding: 0 16px;
}

.font-preview {
  min-width: 120px;
  text-align: center;
}

.font-name {
  font-weight: 500;
  color: #1d2129;
}

.font-path {
  color: #86909c;
  margin-top: 2px;
}

.font-type {
  margin-top: 4px;
}

.scroll-to-bottom {
  position: fixed;
  bottom: 100px;
  right: 50px;
  z-index: 1000;
}

/* 滚动条样式 */
.virtual-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #a0a4ac;
}
</style>
