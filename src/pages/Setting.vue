<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, defineAsyncComponent} from "vue";
import {t} from "../lang";
import {TabContentScroller} from "../lib/ui";
import {AppConfig} from "../config";
// 🔧 使用动态导入延迟加载组件，只在标签页被点击时才初始化
const SettingBasic = defineAsyncComponent(() =>
    import("../components/Setting/SettingBasic.vue")
);
const SettingEnv = defineAsyncComponent(() =>
    import("../components/Setting/SettingEnv.vue")
);
const SettingAbout = defineAsyncComponent(() =>
    import("../components/Setting/SettingAbout.vue")
);
const SettingFontManager = defineAsyncComponent(() =>
    import("../components/Setting/SettingFontManager.vue")
);
const SettingSystemTemplates = defineAsyncComponent(() =>
    import("../components/Setting/SettingSystemTemplates.vue")
);
const DataConfigDialogButton = defineAsyncComponent(() =>
    import("../components/common/DataConfigDialogButton.vue")
);

import {LiveBlackWordContent} from "./Live/config/blackWord";
import {LiveReplyGenerateContent} from "./Live/config/replyGenerate";
import {
    SoundAsrResultOptimizedPrompt,
    SoundGenerateTextFormItems,
    SoundGenerateTextPrompt
} from "./Sound/config/prompt";
import {SoundGenerateReplaceContent} from "./Sound/config/replaceContent";
import { useDevMode } from '../composables/useDevMode';

// 🔧 检查开发模式
const { isDev } = useDevMode();

// 🔧 跟踪当前活跃的标签页
const activeTab = ref('basic');

let tabContentScroller: TabContentScroller | null = null;
const contentContainer = ref<HTMLElement | null>(null);
const tabContainer = ref<HTMLElement | null>(null);

// 🔧 直接处理标签页点击
const selectTab = (tabName: string) => {
    activeTab.value = tabName;
    // 同时更新菜单的 active 状态
    const tabs = tabContainer.value?.querySelectorAll('[data-section]');
    if (tabs) {
        tabs.forEach(tab => {
            const sectionName = tab.getAttribute('data-section');
            if (sectionName === tabName) {
                tab.classList.add('menu-active');
            } else {
                tab.classList.remove('menu-active');
            }
        });
    }
    // 滚动到对应内容
    const content = contentContainer.value?.querySelector(`[data-section="${tabName}"]`);
    if (content) {
        content.scrollIntoView({ behavior: 'smooth' });
    }
};

onMounted(() => {
    tabContentScroller = new TabContentScroller(
        tabContainer.value as HTMLElement,
        contentContainer.value as HTMLElement,
        {
            activeClass: "menu-active",
            onSectionChange: (section) => {
                // 🔧 监听标签页变化，更新活跃状态
                activeTab.value = section;
            }
        }
    );
    // 🔧 初始化时设置为 basic
    activeTab.value = 'basic';
});
onBeforeUnmount(() => {
    tabContentScroller?.destroy();
});

// 菜单配置
const menuItems = [
    { key: 'basic', icon: 'icon-settings', label: '基础设置', desc: '通用参数配置' },
    { key: 'font', icon: 'icon-font-colors', label: '字体管理', desc: '字体安装与卸载' },
    { key: 'env', icon: 'icon-code', label: '环境设置', desc: '运行环境配置' },
    { key: 'about', icon: 'icon-info-circle', label: '关于软件', desc: '版本信息与帮助' },
];
</script>

<style lang="less" scoped>
.setting-container {
    background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    color: #e5e7eb;
}

// 侧边栏样式
.setting-sidebar {
    background: linear-gradient(180deg, #1e1e2f 0%, #17172a 100%);
    border-color: #2d2d4a;
    position: relative;
    overflow: hidden;
    
    // 装饰性背景
    &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 200px;
        background: radial-gradient(ellipse at center top, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
        pointer-events: none;
    }
}

// 标题区域
.sidebar-header {
    padding: 24px 20px 20px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
    position: relative;
    
    .header-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35);
        
        svg {
            width: 24px;
            height: 24px;
            color: white;
        }
    }
    
    .header-title {
        font-size: 18px;
        font-weight: 700;
        color: #f8fafc;
        margin-bottom: 4px;
    }
    
    .header-subtitle {
        font-size: 12px;
        color: #64748b;
    }
}

// 菜单项
.setting-menu-item {
    color: #94a3b8;
    border: 1px solid transparent;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    margin: 0 12px 6px;
    
    &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 0;
        background: linear-gradient(180deg, #8b5cf6, #a78bfa);
        border-radius: 0 2px 2px 0;
        transition: height 0.3s ease;
    }
    
    &:hover {
        color: #e2e8f0;
        background-color: rgba(139, 92, 246, 0.1);
        border-color: rgba(139, 92, 246, 0.25);
        
        &::before {
            height: 50%;
        }
    }
}

// 菜单激活状态
.menu-active {
    background: linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.08) 100%);
    border-color: rgba(139, 92, 246, 0.4);
    color: #f8fafc;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.2);
    
    &::before {
        height: 70% !important;
    }
    
    .menu-icon {
        background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }
}

.menu-icon {
    width: 36px;
    height: 36px;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    svg, .iconfont {
        font-size: 16px;
        color: #a78bfa;
    }
}

// 内容区域
.setting-content {
    background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
    color: #e5e7eb;
}

// 内容头部
.content-header {
    padding: 32px 40px 24px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.12);
    position: relative;
    
    &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 40px;
        right: 40px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent);
    }
    
    .content-title {
        font-size: 26px;
        font-weight: 700;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        
        .title-badge {
            font-size: 12px;
            font-weight: 500;
            padding: 4px 10px;
            background: linear-gradient(135deg, #8b5cf6, #a78bfa);
            border-radius: 20px;
            color: white;
        }
    }
    
    .content-desc {
        font-size: 14px;
        color: #64748b;
    }
}

.section-divider {
    border-color: rgba(139, 92, 246, 0.12);
}

// 内容区
.content-scroll {
    padding: 32px 40px;
    
    .section-title {
        font-size: 16px;
        font-weight: 600;
        color: #f1f5f9;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
        
        &::before {
            content: '';
            width: 4px;
            height: 18px;
            background: linear-gradient(180deg, #8b5cf6, #a78bfa);
            border-radius: 2px;
        }
    }
}

/* 确保所有文字可见 - 提高对比度 */
:deep(.arco-form-item-label-col) {
    color: #f3f4f6 !important;
}

:deep(.arco-radio) {
    color: #f3f4f6 !important;
}

:deep(.arco-radio-label) {
    color: #f3f4f6 !important;
}

:deep(.arco-form-item-label) {
    color: #f3f4f6 !important;
}

:deep(.text-xs) {
    color: #d1d5db !important;
}

:deep(.text-sm) {
    color: #e5e7eb !important;
}

:deep(.font-medium) {
    color: #f3f4f6 !important;
}

:deep(.text-base) {
    color: #f3f4f6 !important;
}

:deep(.text-lg) {
    color: #f3f4f6 !important;
}

:deep(.font-bold) {
    color: #f3f4f6 !important;
}

:deep(.text-2xl) {
    color: #f3f4f6 !important;
}

:deep(.arco-card-header-title) {
    color: #f3f4f6 !important;
}

/* 字体管理页面特殊样式 */
:deep(.arco-space) {
    color: #f3f4f6;
}

:deep(.arco-col) {
    color: #f3f4f6;
}

:deep(.arco-descriptions-item-label) {
    color: #d1d5db !important;
}

:deep(.arco-descriptions-item-value) {
    color: #f3f4f6 !important;
}

:deep(.space-y-2) {
    color: #f3f4f6;
}

:deep(.flex-1) {
    color: #f3f4f6;
}

:deep(code) {
    color: #a78bfa !important;
    background-color: rgba(139, 92, 246, 0.15) !important;
}

[data-theme="dark"] {
    .menu-active {
        background: linear-gradient(90deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.08) 100%);
        border-color: rgba(139, 92, 246, 0.4);
        color: #ffffff;
        box-shadow: 0 4px 20px rgba(139, 92, 246, 0.2);
    }
}

[data-theme="soft-light"] {
    .setting-container {
        background: linear-gradient(180deg, rgba(248, 246, 255, 0.98) 0%, rgba(237, 239, 255, 0.98) 100%);
        color: #1d2547;
    }

    .setting-sidebar {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(243, 244, 255, 0.97) 100%);
        border-color: rgba(132, 142, 220, 0.22);
        box-shadow: inset -1px 0 0 rgba(255,255,255,0.68), 0 14px 30px rgba(104,110,170,0.08);
        
        &::before {
            background: radial-gradient(ellipse at center top, rgba(139, 92, 246, 0.08) 0%, transparent 70%);
        }
    }
    
    .sidebar-header {
        border-color: rgba(139, 92, 246, 0.12);
        
        .header-icon {
            background: linear-gradient(135deg, #7c5df0 0%, #9d7aff 100%);
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.25);
        }
        
        .header-title {
            color: #1f2749;
        }
        
        .header-subtitle {
            color: #617098;
        }
    }

    .setting-content {
        background: linear-gradient(180deg, rgba(248, 246, 255, 0.92) 0%, rgba(239, 241, 255, 0.96) 100%);
        color: #1d2547;
    }

    .setting-menu-item {
        color: #5b6792;
        border-color: transparent;
        background: rgba(255, 255, 255, 0.44);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
        
        &::before {
            background: linear-gradient(180deg, #7c5df0, #9d7aff);
        }
    }

    .setting-menu-item:hover {
        color: #1f2749;
        background: linear-gradient(135deg, rgba(116, 126, 255, 0.12) 0%, rgba(196, 150, 255, 0.1) 100%);
        border-color: rgba(106, 116, 247, 0.26);
        box-shadow: 0 10px 22px rgba(104,110,170,0.10);
    }

    .menu-active {
        color: #1f2749;
        background: linear-gradient(135deg, rgba(106, 116, 247, 0.18) 0%, rgba(185, 133, 255, 0.12) 100%);
        border-color: rgba(106, 116, 247, 0.32);
        box-shadow: 0 14px 28px rgba(104,110,170,0.14);
    }
    
    .menu-icon {
        background: rgba(139, 92, 246, 0.1);
        
        svg, .iconfont {
            color: #7c5df0;
        }
    }

    .content-header {
        border-color: rgba(139, 92, 246, 0.12);
        
        &::after {
            background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4), transparent);
        }
        
        .content-title {
            color: #1f2749;
            
            .title-badge {
                background: linear-gradient(135deg, #7c5df0, #9d7aff);
            }
        }
        
        .content-desc {
            color: #617098;
        }
    }

    .section-divider {
        border-color: rgba(139, 92, 246, 0.12);
    }
    
    .section-title {
        color: #1f2749;
        
        &::before {
            background: linear-gradient(180deg, #7c5df0, #9d7aff);
        }
    }

    :deep(.arco-form-item-label-col),
    :deep(.arco-form-item-label),
    :deep(.arco-radio),
    :deep(.arco-radio-label),
    :deep(.arco-checkbox),
    :deep(.arco-card-header-title),
    :deep(.arco-descriptions-item-value),
    :deep(.font-medium),
    :deep(.font-bold),
    :deep(.text-base),
    :deep(.text-lg),
    :deep(.text-2xl) {
        color: #1f2749 !important;
    }

    :deep(.text-xs),
    :deep(.text-sm),
    :deep(.arco-form-item-message),
    :deep(.arco-descriptions-item-label),
    :deep(.text-gray-600),
    :deep(.text-gray-500),
    :deep(.text-gray-400) {
        color: #617098 !important;
    }

    :deep(.arco-card),
    :deep(.bg-gray-50),
    :deep(.bg-gray-100),
    :deep(.bg-white),
    :deep(.border),
    :deep(.border-gray-200),
    :deep(.border-gray-300) {
        background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(244,245,255,0.97) 100%) !important;
        border-color: rgba(132, 142, 220, 0.22) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.84), 0 10px 24px rgba(104,110,170,0.08) !important;
    }

    :deep(.hover\:bg-gray-100:hover) {
        background: rgba(106, 116, 247, 0.08) !important;
    }

    :deep(.text-link),
    :deep(a:not(.arco-btn)) {
        color: #4f63e8 !important;
    }

    :deep([class~="text-white"]),
    :deep([class~="text-gray-800"]),
    :deep([class~="text-gray-900"]),
    :deep([style*="color: #f3f4f6"]),
    :deep([style*="color:#f3f4f6"]),
    :deep([style*="color: #e5e7eb"]),
    :deep([style*="color:#e5e7eb"]) {
        color: #1f2749 !important;
    }

    :deep(code) {
        color: #4966e6 !important;
        background-color: rgba(106, 116, 247, 0.08) !important;
    }
}
</style>

<template>
    <div class="setting-container flex select-none">
        <!-- 侧边栏 -->
        <div
            ref="tabContainer"
            class="setting-sidebar flex flex-col w-64 flex-shrink-0 border-r border-solid"
        >
            <!-- 头部 -->
            <div class="sidebar-header">
                <div class="header-icon">
                    <icon-settings />
                </div>
                <div class="header-title">系统设置</div>
                
            </div>
            
            <!-- 菜单 -->
            <div class="flex-1 py-4 overflow-y-auto">
                <div 
                    v-for="item in menuItems" 
                    :key="item.key"
                    :data-section="item.key" 
                    class="setting-menu-item p-3 mb-1 cursor-pointer transition-all" role="button" tabindex="0" :aria-current="activeTab === item.key ? 'page' : undefined" @keydown.enter.prevent="selectTab(item.key)" @keydown.space.prevent="selectTab(item.key)"
                    :class="{ 'menu-active': activeTab === item.key }" 
                    @click="selectTab(item.key)"
                >
                    <div class="flex items-center">
                        <div class="menu-icon mr-3">
                            <component :is="item.icon" class="iconfont" />
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-medium">{{ item.label }}</div>
                            <div class="text-xs opacity-60 mt-0.5">{{ item.desc }}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 底部信息 -->
            <div class="p-4 border-t border-solid border-white/5">
                <div class="text-xs text-center" style="color: #64748b;">
                    <div class="mb-1">数字人视频创作系统</div>
                    <div>v{{ AppConfig.version }}</div>
                </div>
            </div>
        </div>
        
        <!-- 内容区域 -->
        <div class="flex-grow setting-content flex flex-col">
            <div
                ref="contentContainer"
                class="overflow-y-auto flex-1"
                style="height: calc(100vh - var(--window-header-height))"
            >
                <!-- 内容头部 -->
                <div class="content-header">
                    <div class="content-title">
                        {{ t(menuItems.find(m => m.key === activeTab)?.label || '基础设置') }}
                        
                    </div>
                    <div class="content-desc">
                        {{ menuItems.find(m => m.key === activeTab)?.desc || '通用参数配置' }}
                    </div>
                </div>
                
                <!-- 内容区 -->
                <div class="content-scroll">
                    <!-- 🔧 使用 v-if 延迟初始化组件，只在标签页被激活时才创建 -->
                    <div data-section="basic" class="scroll-mt-4">
                        <SettingBasic v-if="activeTab === 'basic' || activeTab === ''"/>
                    </div>
                    
                    <div data-section="font" class="scroll-mt-4">
                        <SettingFontManager v-if="activeTab === 'font'"/>
                    </div>
                    
                    <div data-section="env" class="scroll-mt-4">
                        <SettingEnv v-if="activeTab === 'env'"/>
                    </div>
                    
                    <div data-section="about" class="scroll-mt-4">
                        <SettingAbout v-if="activeTab === 'about'"/>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
