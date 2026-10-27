import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { StorageMain } from '../storage/main';
import { ConfigMain } from './main';
import { Log } from '../log/main';

export interface ExportableConfig {
    version: string;
    exportDate: string;
    config: {
        // 基础配置
        [key: string]: any;
        // 提示词配置
        prompts?: {
            [key: string]: any;
        };
        // 在线模型配置
        onlineModels?: {
            providers?: any[];
            currentProviderId?: string;
            modelSettings?: any;
        };
    };
}

/**
 * 导出当前用户配置
 */
export async function exportCurrentConfig(): Promise<ExportableConfig> {
    const config: ExportableConfig = {
        version: app.getVersion(),
        exportDate: new Date().toISOString(),
        config: {}
    };

    try {
        // 1. 导出基础配置
        const appConfig = await ConfigMain.all();
        config.config = { ...appConfig };

        // 2. 导出提示词（从 storage 中读取）
        const globalStorage = await StorageMain.all('global');
        const prompts: any = {};

        // 提取所有包含 Prompt 的键
        for (const [key, value] of Object.entries(globalStorage)) {
            if (key.toLowerCase().includes('prompt') ||
                key.toLowerCase().includes('提示词')) {
                prompts[key] = value;
            }
        }

        if (Object.keys(prompts).length > 0) {
            config.config.prompts = prompts;
        }

        // 3. 导出在线模型配置
        const onlineModels: any = {};

        if (globalStorage.provider) {
            onlineModels.providers = globalStorage.provider;
        }
        if (globalStorage.currentProviderId) {
            onlineModels.currentProviderId = globalStorage.currentProviderId;
        }
        if (globalStorage.modelSettings) {
            onlineModels.modelSettings = globalStorage.modelSettings;
        }

        if (Object.keys(onlineModels).length > 0) {
            config.config.onlineModels = onlineModels;
        }

        console.log('[exportConfig] 配置导出成功', {
            version: config.version,
            promptCount: Object.keys(prompts).length,
            providersCount: onlineModels.providers?.length || 0
        });

        return config;
    } catch (error: any) {
        console.error('[exportConfig] 配置导出失败', error);
        throw error;
    }
}

/**
 * 保存配置到文件
 */
export async function saveConfigToFile(
    config: ExportableConfig,
    targetPath: string
): Promise<void> {
    try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            targetPath,
            JSON.stringify(config, null, 4),
            'utf-8'
        );

        console.log(`✅ 配置已导出到: ${targetPath}`);
    } catch (error: any) {
        console.error('❌ 保存配置失败:', error);
        throw error;
    }
}
