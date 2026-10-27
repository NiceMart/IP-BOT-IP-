<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../../lang';
import { Message } from '@arco-design/web-vue';
import { IconExport, IconImport } from '@arco-design/web-vue/es/icon';

const isExporting = ref(false);
const isImporting = ref(false);

// 导出所有系统模板
const handleExportAllTemplates = async () => {
    try {
        isExporting.value = true;

        // 导出字幕模板
        const subtitleResult = await window.$mapi.ipAgent.exportSubtitleTemplates();
        if (!subtitleResult.success) {
            Message.error('导出字幕模板失败: ' + subtitleResult.message);
            return;
        }

        // 导出封面模板
        const coverResult = await window.$mapi.ipAgent.exportAllCoverTemplates();
        if (!coverResult.success) {
            Message.error('导出封面模板失败: ' + coverResult.message);
            return;
        }

        Message.success('所有系统模板导出成功');
    } catch (error) {
        Message.error('导出失败: ' + (error as Error).message);
    } finally {
        isExporting.value = false;
    }
};

// 打开配置文件所在目录
const handleOpenConfigPath = async () => {
    try {
        // @ts-ignore
        const resourcesPath = await window.$mapi.app.getResourcesPath();
        await window.$mapi.app.openPath(`${resourcesPath}\\common\\config`);
    } catch (error) {
        Message.error('打开目录失败: ' + (error as Error).message);
    }
};
</script>

<template>
    <div class="space-y-6">
        <!-- 系统模板说明 -->
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="text-sm text-blue-900 dark:text-blue-200">
                <p class="font-semibold mb-2">✨ 系统模板管理</p>
                <ul class="list-disc list-inside space-y-1 text-xs">
                    <li>字幕模板在 <strong>视频 > 字幕和音乐</strong> 中管理</li>
                    <li>封面模板在 <strong>视频 > 封面</strong> 中管理</li>
                    <li>在开发模式下可以编辑和删除系统模板</li>
                    <li>系统模板会自动导出到配置文件中</li>
                </ul>
            </div>
        </div>

        <!-- 导出操作 -->
        <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-semibold text-sm mb-1">{{ t('导出配置') }}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-400">
                        将所有系统模板导出到配置文件，供打包时使用
                    </p>
                </div>
                <div class="space-x-2">
                    <a-button
                        type="primary"
                        size="small"
                        :loading="isExporting"
                        @click="handleExportAllTemplates"
                    >
                        <template #icon>
                            <icon-export />
                        </template>
                        {{ t('导出') }}
                    </a-button>
                    <a-button
                        type="secondary"
                        size="small"
                        @click="handleOpenConfigPath"
                    >
                        {{ t('打开目录') }}
                    </a-button>
                </div>
            </div>
        </div>

        <!-- 配置文件位置 -->
        <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p class="font-semibold text-sm mb-2">{{ t('配置文件位置') }}</p>
            <div class="text-xs bg-gray-200 dark:bg-gray-800 rounded p-2 font-mono break-all">
                electron/resources/extra/common/config/system-templates.json
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
                此文件在应用打包时会被包含，所有系统模板都会被初始化。
            </p>
        </div>
    </div>
</template>

<style scoped lang="less">
// 样式由 Tailwind CSS 和 Arco Design 提供
</style>
