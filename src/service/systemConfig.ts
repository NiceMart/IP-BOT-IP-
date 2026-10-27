/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import { AppConfig } from '../config'
// Provider credentials are loaded from the authenticated backend, never compiled into renderer assets.
const sensitiveConfig = {} as Record<string, string>

export interface SystemConfig {
    aliyun_bailian_api_key: string
    aliyun_bailian_base_url: string
    aliyun_oss_access_key_id: string
    aliyun_oss_access_key_secret: string
    aliyun_oss_bucket: string
    aliyun_oss_region: string
    volcengine_api_key: string
    volcengine_model: string
    runninghub_api_key: string
    runninghub_workflow_id_1: string
    runninghub_workflow_id_2: string
    runninghub_workflow_id_3: string
    runninghub_workflow_id_4: string
    runninghub_workflow_id_5: string
    runninghub_workflow_id_6: string
    runninghub_workflow_id_7: string
    runninghub_workflow_id_8: string
    runninghub_mode1_nodes: string
    runninghub_mode2_nodes: string
    runninghub_mode3_nodes: string
    runninghub_mode4_nodes: string
    runninghub_mode5_nodes: string
    runninghub_mode6_nodes: string
    runninghub_mode7_nodes: string
    runninghub_mode8_nodes: string
    runninghub_tts_workflow_id_t2: string
    runninghub_tts_nodes_t2: string
    runninghub_tts_workflow_id_t3: string
    runninghub_tts_nodes_t3: string
    runninghub_tts_workflow_id_t4: string
    runninghub_tts_nodes_t4: string
    runninghub_tts_workflow_id_t5: string
    runninghub_tts_nodes_t5: string
    runninghub_tts_workflow_id_t6: string
    runninghub_tts_nodes_t6: string
    model_providers: string
}

const FALLBACK_CONFIG: SystemConfig = {
    aliyun_bailian_api_key: sensitiveConfig.ALIYUN_BAILIAN_API_KEY,
    aliyun_bailian_base_url: sensitiveConfig.ALIYUN_BAILIAN_BASE_URL,
    aliyun_oss_access_key_id: sensitiveConfig.ALIYUN_OSS_ACCESS_KEY_ID,
    aliyun_oss_access_key_secret: sensitiveConfig.ALIYUN_OSS_ACCESS_KEY_SECRET,
    aliyun_oss_bucket: sensitiveConfig.ALIYUN_OSS_BUCKET,
    aliyun_oss_region: sensitiveConfig.ALIYUN_OSS_REGION,
    volcengine_api_key: sensitiveConfig.VOLCENGINE_API_KEY,
    volcengine_model: sensitiveConfig.VOLCENGINE_MODEL,
    runninghub_api_key: sensitiveConfig.RUNNINGHUB_API_KEY,
    runninghub_workflow_id_1: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_1,
    runninghub_workflow_id_2: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_2,
    runninghub_workflow_id_3: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_3,
    runninghub_workflow_id_4: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_4,
    runninghub_workflow_id_5: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_5,
    runninghub_workflow_id_6: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_6,
    runninghub_workflow_id_7: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_7,
    runninghub_workflow_id_8: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_8,
    runninghub_mode1_nodes: sensitiveConfig.RUNNINGHUB_MODE1_NODES,
    runninghub_mode2_nodes: sensitiveConfig.RUNNINGHUB_MODE2_NODES,
    runninghub_mode3_nodes: sensitiveConfig.RUNNINGHUB_MODE3_NODES,
    runninghub_mode4_nodes: sensitiveConfig.RUNNINGHUB_MODE4_NODES,
    runninghub_mode5_nodes: sensitiveConfig.RUNNINGHUB_MODE5_NODES,
    runninghub_mode6_nodes: sensitiveConfig.RUNNINGHUB_MODE6_NODES,
    runninghub_mode7_nodes: sensitiveConfig.RUNNINGHUB_MODE7_NODES,
    runninghub_mode8_nodes: sensitiveConfig.RUNNINGHUB_MODE8_NODES,
    runninghub_tts_workflow_id_t2: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T2,
    runninghub_tts_nodes_t2: sensitiveConfig.RUNNINGHUB_TTS_NODES_T2,
    runninghub_tts_workflow_id_t3: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T3,
    runninghub_tts_nodes_t3: sensitiveConfig.RUNNINGHUB_TTS_NODES_T3,
    runninghub_tts_workflow_id_t4: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T4,
    runninghub_tts_nodes_t4: sensitiveConfig.RUNNINGHUB_TTS_NODES_T4,
    runninghub_tts_workflow_id_t5: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T5,
    runninghub_tts_nodes_t5: sensitiveConfig.RUNNINGHUB_TTS_NODES_T5,
    runninghub_tts_workflow_id_t6: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T6,
    runninghub_tts_nodes_t6: sensitiveConfig.RUNNINGHUB_TTS_NODES_T6,
    model_providers: sensitiveConfig.MODEL_PROVIDERS
}

let cachedConfig: SystemConfig | null = null
let lastFetchTime = 0

function getBaseUrl(): string {
    return AppConfig.apiBaseUrl.replace(/\/api\/?$/, '')
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
    const now = Date.now()

    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/system/config/public?_t=${now}`, {
            cache: 'no-store',
            headers: localStorage.getItem('auth_token') ? { Authorization: 'Bearer ' + localStorage.getItem('auth_token') } : {}
        })
        const data = await response.json()

        if (data.success && data.config) {
            cachedConfig = { ...FALLBACK_CONFIG, ...data.config }
            lastFetchTime = now
            return cachedConfig
        }
    } catch (error) {
        console.warn('[SystemConfig] 获取系统配置失败，使用兜底配置:', error)
    }

    return cachedConfig || FALLBACK_CONFIG
}

export function getSystemConfigSync(): SystemConfig {
    return cachedConfig || FALLBACK_CONFIG
}

export function clearConfigCache(): void {
    cachedConfig = null
    lastFetchTime = 0
}

export async function getAliyunBailianApiKey(): Promise<string> {
    const config = await fetchSystemConfig()
    return config.aliyun_bailian_api_key
}

export async function getAliyunOssConfig(): Promise<{
    accessKeyId: string
    accessKeySecret: string
    bucket: string
    region: string
}> {
    const config = await fetchSystemConfig()
    return {
        accessKeyId: config.aliyun_oss_access_key_id,
        accessKeySecret: config.aliyun_oss_access_key_secret,
        bucket: config.aliyun_oss_bucket,
        region: config.aliyun_oss_region
    }
}

export async function getVolcengineConfig(): Promise<{
    apiKey: string
    model: string
}> {
    const config = await fetchSystemConfig()
    return {
        apiKey: config.volcengine_api_key,
        model: config.volcengine_model
    }
}

export async function getRunningHubApiKey(): Promise<string> {
    const config = await fetchSystemConfig()
    return config.runninghub_api_key
}
