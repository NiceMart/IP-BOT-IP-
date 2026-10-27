import { getSystemConfigSync, fetchSystemConfig } from '../../service/systemConfig'
import { SystemModels } from './models'

export interface BuiltInProviderConfig {
  id: string;
  apiKey: string;
  apiHost?: string;
  enabled: boolean;
  ossConfig?: {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region: string;
  };
}

function buildBuiltinProviders(): Record<string, BuiltInProviderConfig> {
  const sysConfig = getSystemConfigSync()

  return {
    builtInAliyun: {
      id: 'builtInAliyun',
      apiKey: sysConfig.aliyun_bailian_api_key || '',
      apiHost: sysConfig.aliyun_bailian_base_url || 'https://dashscope.aliyuncs.com/api/v1',
      enabled: true,
      ossConfig: {
        accessKeyId: sysConfig.aliyun_oss_access_key_id || '',
        accessKeySecret: sysConfig.aliyun_oss_access_key_secret || '',
        bucket: sysConfig.aliyun_oss_bucket || '',
        region: sysConfig.aliyun_oss_region || 'oss-cn-beijing'
      }
    },

    builtInDoubao: {
      id: 'builtInDoubao',
      apiKey: sysConfig.volcengine_api_key || '',
      apiHost: '',
      enabled: true
    }
  }
}

export const BUILTIN_PROVIDERS: Record<string, BuiltInProviderConfig> = buildBuiltinProviders()

export function refreshBuiltinProviders(): void {
  const providers = buildBuiltinProviders()
  Object.assign(BUILTIN_PROVIDERS, providers)
  syncDoubaoModel()
}

function syncDoubaoModel(): void {
  const sysConfig = getSystemConfigSync()
  const configuredModel = sysConfig.volcengine_model || 'doubao-seed-2-0-lite-260215'
  const models = SystemModels.builtInDoubao
  if (models && models.length > 0) {
    // 🔧 修复：不再强制覆盖模型的 id/name/group，而是将远程配置的默认模型排到第一位
    const targetIndex = models.findIndex(m => m.id === configuredModel)
    if (targetIndex > 0) {
      // 将配置的默认模型移到第一位
      const [target] = models.splice(targetIndex, 1)
      models.unshift(target)
    } else if (targetIndex === -1) {
      // 远程配置的模型不在列表中，插入到第一位
      models.unshift({
        id: configuredModel,
        provider: 'builtInDoubao',
        name: configuredModel.includes('lite') ? '豆包-2.0-lite (首推)' : '豆包-2.0-mini (最新)',
        group: '豆包模型',
        types: ['text'],
        enabled: true,
      })
    }
    // 如果 targetIndex === 0，说明远程配置的模型已经在第一位，无需调整
  }
}

export async function initBuiltinProviders(): Promise<void> {
  await fetchSystemConfig()
  refreshBuiltinProviders()
}

export function isBuiltInProvider(providerId: string): boolean {
  return providerId.startsWith('builtIn');
}

export function getBuiltInConfig(providerId: string): BuiltInProviderConfig | null {
  return BUILTIN_PROVIDERS[providerId] || null;
}
