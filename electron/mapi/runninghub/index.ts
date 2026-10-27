/**
 * RunningHub TTS API 语音合成模块
 * 文档: https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import logger from '../log/main';
import { getFFmpegExecutablePath, resourceExists } from '../../lib/resource-path';
import { getElectronSystemConfigSync, fetchElectronSystemConfig } from '../systemConfig';

const BASE_URL = 'https://www.runninghub.cn';
const WEBAPP_ID_V2 = '1965684535247650818';  // TTS V2 应用ID
const WEBAPP_ID_V3 = '2028779949334728706';  // TTS V3 应用ID（中文最强）

export interface RunningHubConfig {
    apiKey: string;
    audioFileName: string;   // 克隆音频文件名（需先上传到RunningHub）
    emotion?: string;        // 情感描述，如"害羞的"、"开心的"
    outputPath?: string;     // 自定义输出路径
    version?: 'v2' | 'v3' | 't2' | 't3' | 't4' | 't5' | 't6';
    /** T2/T3 自定义工作流ID（优先级高于后台配置） */
    customWorkflowId?: string;
    /** T2/T3 自定义节点配置（优先级高于后台配置） */
    customNodes?: Record<string, any>;
    /** T6 情感音频文件名（不传则使用 audioFileName） */
    emotionAudioFileName?: string;
}

const RUNNINGHUB_EMOTION_ALIASES: Record<string, string> = {
    '开心': '开心的',
    '悲伤': '悲伤的',
    '愤怒': '愤怒的',
    '恐惧': '恐惧的',
    '惊讶': '惊讶的',
    '厌恶': '厌恶的',
    '害羞': '害羞的',
    '温柔': '温柔的',
    '激动': '激动的',
    '平静': '平静的',
    '自然': '自然、平静、克制的',
};

function normalizeEmotionPrompt(emotion?: string): string | undefined {
    const value = String(emotion || '').trim();
    if (!value || value === '无' || value.toLowerCase() === 'none') {
        return undefined;
    }
    return RUNNINGHUB_EMOTION_ALIASES[value] || value;
}

function normalizeSpeed(speed?: number): number {
    const parsed = Number(speed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 1;
    }
    return Math.min(2, Math.max(0.5, parsed));
}

function buildAtempoFilterChain(speed: number): string {
    const filters: string[] = [];
    let remaining = speed;

    while (remaining > 2) {
        filters.push('atempo=2');
        remaining /= 2;
    }
    while (remaining < 0.5) {
        filters.push('atempo=0.5');
        remaining /= 0.5;
    }

    filters.push(`atempo=${remaining.toFixed(3)}`);
    return filters.join(',');
}

function runFFmpeg(ffmpegPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, args);
        let stderr = '';

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr || `FFmpeg exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

async function adjustAudioSpeedIfNeeded(filePath: string, speed?: number): Promise<string> {
    const normalizedSpeed = normalizeSpeed(speed);
    if (Math.abs(normalizedSpeed - 1) < 0.01) {
        return filePath;
    }

    const ffmpegPath = getFFmpegExecutablePath();
    if (!resourceExists(ffmpegPath)) {
        logger.warn('[RunningHub] FFmpeg missing, skip speed post-process', {
            filePath,
            normalizedSpeed,
        });
        return filePath;
    }

    const ext = path.extname(filePath) || '.mp3';
    const tempOutputPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, ext)}_speed${ext}`
    );

    await runFFmpeg(ffmpegPath, [
        '-y',
        '-i', filePath,
        '-vn',
        '-filter:a', buildAtempoFilterChain(normalizedSpeed),
        tempOutputPath,
    ]);

    fs.rmSync(filePath, { force: true });
    fs.renameSync(tempOutputPath, filePath);

    logger.info('[RunningHub] Speed post-process done', { filePath, normalizedSpeed });
    return filePath;
}

export interface RunningHubResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    taskId?: string;
}

/**
 * 获取T2/T3语音模型的动态工作流配置
 */
function getDynamicTtsConfig(version: 't2' | 't3' | 't4' | 't5' | 't6', customWorkflowId?: string, customNodes?: Record<string, any>): {
    workflowId: string;
    nodes: Record<string, any>;
} | null {
    const sysCfg = getElectronSystemConfigSync();

    if (version === 't2') {
        const workflowId = customWorkflowId || sysCfg.runninghub_tts_workflow_id_t2 || '';
        const nodesRaw = customNodes ? JSON.stringify(customNodes) : (sysCfg.runninghub_tts_nodes_t2 || '');
        if (!workflowId) return null;
        let nodes: Record<string, any> = { audioNode: '4', textNode: '7' };
        try {
            if (nodesRaw) nodes = { ...nodes, ...JSON.parse(nodesRaw) };
        } catch (e) {
            logger.warn('[RunningHub] 解析T2节点配置失败，使用默认值', { error: (e as Error).message, raw: nodesRaw });
        }
        return { workflowId, nodes };
    }

    if (version === 't3') {
        const workflowId = customWorkflowId || sysCfg.runninghub_tts_workflow_id_t3 || '';
        const nodesRaw = customNodes ? JSON.stringify(customNodes) : (sysCfg.runninghub_tts_nodes_t3 || '');
        if (!workflowId) return null;
        let nodes: Record<string, any> = { audioNode: '4', textNode: '7' };
        try {
            if (nodesRaw) nodes = { ...nodes, ...JSON.parse(nodesRaw) };
        } catch (e) {
            logger.warn('[RunningHub] 解析T3节点配置失败，使用默认值', { error: (e as Error).message, raw: nodesRaw });
        }
        return { workflowId, nodes };
    }

    if (version === 't4') {
        const workflowId = customWorkflowId || sysCfg.runninghub_tts_workflow_id_t4 || '';
        const nodesRaw = customNodes ? JSON.stringify(customNodes) : (sysCfg.runninghub_tts_nodes_t4 || '');
        if (!workflowId) return null;
        let nodes: Record<string, any> = { audioNode: '80', textNode: '87' };
        try {
            if (nodesRaw) nodes = { ...nodes, ...JSON.parse(nodesRaw) };
        } catch (e) {
            logger.warn('[RunningHub] 解析T4节点配置失败，使用默认值', { error: (e as Error).message, raw: nodesRaw });
        }
        return { workflowId, nodes };
    }

    if (version === 't5') {
        const workflowId = customWorkflowId || sysCfg.runninghub_tts_workflow_id_t5 || '';
        const nodesRaw = customNodes ? JSON.stringify(customNodes) : (sysCfg.runninghub_tts_nodes_t5 || '');
        if (!workflowId) return null;
        let nodes: Record<string, any> = { audioNode: '5', textNode: { id: '6', fieldName: 'prompt' } };
        try {
            if (nodesRaw) nodes = { ...nodes, ...JSON.parse(nodesRaw) };
        } catch (e) {
            logger.warn('[RunningHub] 解析T5节点配置失败，使用默认值', { error: (e as Error).message, raw: nodesRaw });
        }
        return { workflowId, nodes };
    }

    if (version === 't6') {
        const workflowId = customWorkflowId || sysCfg.runninghub_tts_workflow_id_t6 || '';
        const nodesRaw = customNodes ? JSON.stringify(customNodes) : (sysCfg.runninghub_tts_nodes_t6 || '');
        if (!workflowId) return null;
        let nodes: Record<string, any> = { audioNode: '13', emotionAudioNode: '15', textNode: { id: '14', fieldName: 'value' } };
        try {
            if (nodesRaw) nodes = { ...nodes, ...JSON.parse(nodesRaw) };
        } catch (e) {
            logger.warn('[RunningHub] 解析T6节点配置失败，使用默认值', { error: (e as Error).message, raw: nodesRaw });
        }
        return { workflowId, nodes };
    }

    return null;
}

/**
 * 发起TTS任务
 */
async function submitTask(
    text: string,
    config: RunningHubConfig
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
        const version = config.version || 'v2';
        const normalizedEmotion = normalizeEmotionPrompt(config.emotion);
        const normalizedSpeed = normalizeSpeed((config as any).speed);

        logger.info('[RunningHub] 提交TTS任务', {
            version,
            text: text.substring(0, 50),
            emotion: normalizedEmotion,
            speed: normalizedSpeed
        });

        let nodeInfoList: any[];
        let webappId: string;

        // T2/T3/T4 动态工作流模式
        if (version === 't2' || version === 't3' || version === 't4' || version === 't5' || version === 't6') {
            const dynConfig = getDynamicTtsConfig(version, config.customWorkflowId, config.customNodes);
            if (!dynConfig) {
                return { success: false, error: `${version.toUpperCase()}语音模型未配置，请在管理后台配置工作流ID和节点` };
            }
            webappId = dynConfig.workflowId;
            nodeInfoList = [];

            // 音频节点（上传参考音频）
            if (dynConfig.nodes.audioNode) {
                const audioNodeVal = dynConfig.nodes.audioNode;
                const nodeId = typeof audioNodeVal === 'object' ? audioNodeVal.id : String(audioNodeVal);
                const fieldName = typeof audioNodeVal === 'object' ? (audioNodeVal.fieldName || 'audio') : 'audio';
                nodeInfoList.push({
                    nodeId,
                    fieldName,
                    fieldValue: config.audioFileName,
                    description: '需要克隆的语音'
                });
            }

            // 情感音频节点（T6: 需要模仿的情感语气）
            if (dynConfig.nodes.emotionAudioNode) {
                const emotionNodeVal = dynConfig.nodes.emotionAudioNode;
                const nodeId = typeof emotionNodeVal === 'object' ? emotionNodeVal.id : String(emotionNodeVal);
                const fieldName = typeof emotionNodeVal === 'object' ? (emotionNodeVal.fieldName || 'audio') : 'audio';
                nodeInfoList.push({
                    nodeId,
                    fieldName,
                    fieldValue: config.emotionAudioFileName || config.audioFileName,
                    description: '需要模仿的情感语气'
                });
            }

            // 文本节点（语音内容）
            if (dynConfig.nodes.textNode) {
                const textNodeVal = dynConfig.nodes.textNode;
                const nodeId = typeof textNodeVal === 'object' ? textNodeVal.id : String(textNodeVal);
                const fieldName = typeof textNodeVal === 'object' ? (textNodeVal.fieldName || 'text') : 'text';
                nodeInfoList.push({
                    nodeId,
                    fieldName,
                    fieldValue: text,
                    description: '语音文本内容'
                });
            }

            // 其他自定义节点
            for (const [key, val] of Object.entries(dynConfig.nodes)) {
                if (key === 'audioNode' || key === 'textNode' || key === 'emotionAudioNode') continue;
                const nodeId = typeof val === 'object' ? val.id : String(val);
                const fieldName = typeof val === 'object' ? (val.fieldName || 'value') : 'value';
                nodeInfoList.push({
                    nodeId,
                    fieldName,
                    fieldValue: typeof val === 'object' ? (val.fieldValue || '') : String(val),
                    description: key
                });
            }

            logger.info('[RunningHub] T2/T3/T4/T5/T6动态节点配置', { version, workflowId: webappId, nodeInfoList });
        } else if (version === 'v3') {
            // V3 节点配置（根据文档 2028779949334728706）
            webappId = WEBAPP_ID_V3;
            nodeInfoList = [
                {
                    nodeId: "5",
                    fieldName: "audio",
                    fieldValue: config.audioFileName,
                    description: "需要克隆的语音"
                },
                {
                    nodeId: "4",
                    fieldName: "prompt",
                    fieldValue: text,
                    description: "文字"
                }
            ];
        } else {
            // V2 节点配置（原有配置）
            webappId = WEBAPP_ID_V2;
            nodeInfoList = [
                {
                    nodeId: "9",
                    fieldName: "audio",
                    fieldValue: config.audioFileName,
                    description: "上传克隆音频"
                },
                {
                    nodeId: "6",
                    fieldName: "text",
                    fieldValue: text,
                    description: "上传语音文本"
                }
            ];

            // V2 如果有情感描述，添加情感节点
            if (normalizedEmotion) {
                nodeInfoList.push({
                    nodeId: "17",
                    fieldName: "text",
                    fieldValue: normalizedEmotion,
                    description: "情感描述"
                });
            }
        }

        const response = await axios.post(
            `${BASE_URL}/openapi/v2/run/ai-app/${webappId}`,
            {
                nodeInfoList,
                instanceType: "plus",
                usePersonalQueue: "false"
            },
            {
                headers: {
                    'Host': 'www.runninghub.cn',
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        // 兼容 V2 和 V3 的响应格式
        const taskId = response.data?.taskId || response.data?.data?.taskId;
        const status = response.data?.status || response.data?.data?.taskStatus;

        if (taskId) {
            logger.info('[RunningHub] 任务提交成功', {
                version,
                taskId,
                status
            });
            return {
                success: true,
                taskId
            };
        } else {
            logger.error('[RunningHub] 任务提交失败', response.data);
            return {
                success: false,
                error: response.data?.errorMessage || response.data?.msg || '任务提交失败'
            };
        }

    } catch (error: any) {
        logger.error('[RunningHub] 任务提交异常', error);
        const errorMsg = error.response?.data?.msg || error.message || '未知错误';
        return { success: false, error: errorMsg };
    }
}

/**
 * 查询任务结果
 */
async function queryTaskResult(
    taskId: string,
    apiKey: string
): Promise<{
    success: boolean;
    status?: string;
    outputs?: any[];
    error?: string
}> {
    try {
        logger.info('[RunningHub] 查询任务状态', { taskId });

        const response = await axios.post(
            `${BASE_URL}/openapi/v2/query`,
            { taskId, apiKey },
            {
                headers: {
                    'Host': 'www.runninghub.cn',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        // 打印完整响应便于调试
        logger.info('[RunningHub] 查询响应原始数据', JSON.stringify(response.data));

        // 尝试从不同字段获取状态（兼容不同API版本）
        // 尝试从不同字段获取状态（兼容不同API版本）
        const data = response.data?.data || response.data;
        const status = data?.taskStatus || data?.status;
        const outputs = data?.outputs || data?.results;

        // API直接返回{status, results}格式，不需要检查code
        if (status) {
            return {
                success: true,
                status: status,
                outputs: outputs
            };
        } else {
            return {
                success: false,
                error: response.data?.msg || response.data?.errorMessage || '查询失败'
            };
        }

    } catch (error: any) {
        logger.error('[RunningHub] 查询任务异常', error);
        return {
            success: false,
            error: error.response?.data?.msg || error.message
        };
    }
}

/**
 * 等待任务完成
 */
async function waitForTaskCompletion(
    taskId: string,
    apiKey: string,
    maxWaitTime: number = 3600000,  // 最长等待60分钟
    pollInterval: number = 3000    // 每3秒轮询一次
): Promise<{ success: boolean; outputs?: any[]; error?: string }> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        const result = await queryTaskResult(taskId, apiKey);

        if (!result.success) {
            return { success: false, error: result.error };
        }

        logger.info('[RunningHub] 任务状态', {
            taskId,
            status: result.status,
            elapsed: Date.now() - startTime
        });

        if (result.status === 'SUCCESS' || result.status === 'COMPLETED') {
            return { success: true, outputs: result.outputs };
        }

        if (result.status === 'FAILED' || result.status === 'ERROR') {
            return { success: false, error: '任务执行失败' };
        }

        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, error: '任务超时' };
}

/**
 * 下载音频文件
 */
async function downloadAudio(
    url: string,
    outputPath: string
): Promise<boolean> {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, response.data);
        logger.info('[RunningHub] 音频下载成功', { outputPath });
        return true;

    } catch (error: any) {
        logger.error('[RunningHub] 音频下载失败', error);
        return false;
    }
}

/**
 * RunningHub TTS 语音合成主函数
 */
export async function synthesizeSpeech(
    text: string,
    config: RunningHubConfig
): Promise<RunningHubResult> {
    logger.info('[RunningHub] 开始语音合成', {
        text: text.substring(0, 50),
        audioFileName: config.audioFileName,
        emotion: normalizeEmotionPrompt(config.emotion),
        speed: normalizeSpeed((config as any).speed)
    });

    // 1. 提交任务
    const submitResult = await submitTask(text, config);
    if (!submitResult.success || !submitResult.taskId) {
        return {
            success: false,
            error: submitResult.error || '任务提交失败'
        };
    }

    const taskId = submitResult.taskId;

    // 2. 等待任务完成
    const completionResult = await waitForTaskCompletion(taskId, config.apiKey);
    if (!completionResult.success) {
        return {
            success: false,
            error: completionResult.error,
            taskId
        };
    }

    // 3. 获取音频URL
    const outputs = completionResult.outputs || [];
    let audioUrl: string | null = null;

    // 遍历outputs找到音频文件
    for (const output of outputs) {
        // 使用url或fileUrl字段
        const url = output.url || output.fileUrl;
        if (url && (
            url.endsWith('.mp3') ||
            url.endsWith('.wav') ||
            url.endsWith('.flac') ||  // 添加flac支持
            output.outputType === 'flac' ||
            output.outputType === 'audio' ||
            output.fileType === 'audio'
        )) {
            audioUrl = url;
            break;
        }
    }

    if (!audioUrl) {
        logger.error('[RunningHub] 未找到音频输出', { outputs });
        return {
            success: false,
            error: '未找到音频输出',
            taskId
        };
    }

    // 4. 下载音频
    let outputPath: string;
    if (config.outputPath) {
        outputPath = config.outputPath;
    } else {
        const outputDir = path.join(app.getPath('userData'), 'temp', 'tts');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const ext = path.extname(audioUrl) || '.mp3';
        outputPath = path.join(outputDir, `runninghub_${Date.now()}${ext}`);
    }

    const downloaded = await downloadAudio(audioUrl, outputPath);
    if (!downloaded) {
        return {
            success: false,
            error: '音频下载失败',
            taskId
        };
    }

    logger.info('[RunningHub] 语音合成完成', { outputPath, taskId });
    outputPath = await adjustAudioSpeedIfNeeded(outputPath, (config as any).speed);

    return {
        success: true,
        audioPath: outputPath,
        taskId
    };
}

/**
 * 获取可用的情感描述列表
 */
export function getAvailableEmotions(): Array<{ id: string; name: string; desc: string }> {
    return [
        { id: '', name: '无', desc: '不指定情感' },
        { id: '开心的', name: '开心', desc: '愉快欢乐' },
        { id: '悲伤的', name: '悲伤', desc: '伤心难过' },
        { id: '愤怒的', name: '愤怒', desc: '生气恼怒' },
        { id: '害羞的', name: '害羞', desc: '羞涩腼腆' },
        { id: '温柔的', name: '温柔', desc: '轻柔亲切' },
        { id: '激动的', name: '激动', desc: '激昂兴奋' },
        { id: '平静的', name: '平静', desc: '冷静沉稳' },
        { id: '惊讶的', name: '惊讶', desc: '吃惊意外' },
        { id: '恐惧的', name: '恐惧', desc: '害怕担忧' }
    ];
}
