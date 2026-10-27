/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
import * as http from 'http'
import { AUTH_SERVER_URL } from './auth/config'
import { getSessionToken } from './auth/session-token'
const sensitiveConfig = process.env as Record<string, string>

interface SystemConfig {
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
    update_url: string
    model_providers: string
}

let cachedConfig: SystemConfig | null = null
let lastFetchTime = 0

const FALLBACK: SystemConfig = {
    aliyun_bailian_api_key: sensitiveConfig.ALIYUN_BAILIAN_API_KEY || '',
    aliyun_bailian_base_url: sensitiveConfig.ALIYUN_BAILIAN_BASE_URL || '',
    aliyun_oss_access_key_id: sensitiveConfig.ALIYUN_OSS_ACCESS_KEY_ID || '',
    aliyun_oss_access_key_secret: sensitiveConfig.ALIYUN_OSS_ACCESS_KEY_SECRET || '',
    aliyun_oss_bucket: sensitiveConfig.ALIYUN_OSS_BUCKET || '',
    aliyun_oss_region: sensitiveConfig.ALIYUN_OSS_REGION || '',
    volcengine_api_key: sensitiveConfig.VOLCENGINE_API_KEY || '',
    volcengine_model: sensitiveConfig.VOLCENGINE_MODEL || '',
    runninghub_api_key: sensitiveConfig.RUNNINGHUB_API_KEY || '',
    runninghub_workflow_id_1: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_1 || '',
    runninghub_workflow_id_2: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_2 || '',
    runninghub_workflow_id_3: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_3 || '',
    runninghub_workflow_id_4: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_4 || '',
    runninghub_workflow_id_5: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_5 || '',
    runninghub_workflow_id_6: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_6 || '',
    runninghub_workflow_id_7: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_7 || '',
    runninghub_workflow_id_8: sensitiveConfig.RUNNINGHUB_WORKFLOW_ID_8 || '',
    runninghub_mode1_nodes: sensitiveConfig.RUNNINGHUB_MODE1_NODES || '',
    runninghub_mode2_nodes: sensitiveConfig.RUNNINGHUB_MODE2_NODES || '',
    runninghub_mode3_nodes: sensitiveConfig.RUNNINGHUB_MODE3_NODES || '',
    runninghub_mode4_nodes: sensitiveConfig.RUNNINGHUB_MODE4_NODES || '',
    runninghub_mode5_nodes: sensitiveConfig.RUNNINGHUB_MODE5_NODES || '',
    runninghub_mode6_nodes: sensitiveConfig.RUNNINGHUB_MODE6_NODES || '',
    runninghub_mode7_nodes: sensitiveConfig.RUNNINGHUB_MODE7_NODES || '',
    runninghub_mode8_nodes: sensitiveConfig.RUNNINGHUB_MODE8_NODES || '',
    runninghub_tts_workflow_id_t2: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T2 || '',
    runninghub_tts_nodes_t2: sensitiveConfig.RUNNINGHUB_TTS_NODES_T2 || '',
    runninghub_tts_workflow_id_t3: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T3 || '',
    runninghub_tts_nodes_t3: sensitiveConfig.RUNNINGHUB_TTS_NODES_T3 || '',
    runninghub_tts_workflow_id_t4: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T4 || '',
    runninghub_tts_nodes_t4: sensitiveConfig.RUNNINGHUB_TTS_NODES_T4 || '',
    runninghub_tts_workflow_id_t5: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T5 || '',
    runninghub_tts_nodes_t5: sensitiveConfig.RUNNINGHUB_TTS_NODES_T5 || '',
    runninghub_tts_workflow_id_t6: sensitiveConfig.RUNNINGHUB_TTS_WORKFLOW_ID_T6 || '',
    runninghub_tts_nodes_t6: sensitiveConfig.RUNNINGHUB_TTS_NODES_T6 || '',
    update_url: sensitiveConfig.UPDATE_URL || '',
    model_providers: sensitiveConfig.MODEL_PROVIDERS || ''
}

export async function fetchElectronSystemConfig(): Promise<SystemConfig> {
    const token = getSessionToken()
    if (!token) return FALLBACK
    const now = Date.now()

    try {
        const baseUrl = AUTH_SERVER_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')
        const requestUrl = `${baseUrl}/api/system/config/public?_t=${now}`
        console.log(`[ElectronSystemConfig] 正在请求配置: ${requestUrl}`)

        // 使用 Node.js 原生 http 模块，避免 axios 在 Electron 打包后被 browser 字段替换为浏览器版
        const configData = await nativeHttpGet(requestUrl, 10000, token)
        console.log(`[ElectronSystemConfig] 配置请求成功`)

        if (configData?.success && configData?.config) {
            cachedConfig = { ...FALLBACK, ...configData.config }
            lastFetchTime = now
            // Provider secrets stay in memory; do not persist a shared credential cache.
                        return cachedConfig
        }
        } catch (error: any) {
        console.warn('[ElectronSystemConfig] 获取系统配置失败:', error.message || error)
    }

    const result = cachedConfig || FALLBACK
        return result
}

/**
 * 使用 Node.js 原生 http/https 模块发送 GET 请求
 * 避免 axios 在 Electron 打包后被 browser 字段替换为浏览器版
 */
function nativeHttpGet(url: string, timeout: number = 10000, token?: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const isHttps = urlObj.protocol === 'https:'
        const requestLib = isHttps ? require('https') : require('http')

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                ...(token ? { Authorization: 'Bearer ' + token } : {})
            }
        }

        const req = requestLib.request(options, (res: any) => {
            let data = ''
            res.on('data', (chunk: Buffer) => { data += chunk.toString() })
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch {
                    reject(new Error(`配置响应非JSON`))
                }
            })
        })

        req.on('error', (error: Error) => { reject(error) })
        req.setTimeout(timeout, () => {
            req.destroy()
            reject(new Error(`配置请求超时(${timeout}ms)`))
        })
        req.end()
    })
}

export function getElectronSystemConfigSync(): SystemConfig {
    if (!getSessionToken()) return FALLBACK
    if (cachedConfig) return cachedConfig
    return FALLBACK
}

export function clearElectronConfigCache(): void {
    cachedConfig = null
    lastFetchTime = 0
}
