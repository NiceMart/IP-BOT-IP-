import { ipcMain } from 'electron';
import logger from '../log/main';
import axios from 'axios';
import crypto from 'crypto';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import { getPythonExecutablePath, resourceExists } from '../../lib/resource-path';

const COMPSHARE_API_BASE = 'https://api.compshare.cn';

let autoShutdownTimer: NodeJS.Timeout | null = null;
let lastTaskTime: number = 0;
const AUTO_SHUTDOWN_DELAY = 10 * 60 * 1000;

interface SelfServerConfig {
  region: string;
  zone: string;
  projectId: string;
  uhostId: string;
  apiUrl: string;
}

let currentServerConfig: SelfServerConfig | null = null;
let apiKey: { publicKey: string; privateKey: string } | null = null;

export function setCompShareApiKey(publicKey: string, privateKey: string) {
  apiKey = { publicKey, privateKey };
}

function generateSignature(params: Record<string, string>): string {
  if (!apiKey) {
    throw new Error('API密钥未配置');
  }

  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}${params[key]}`).join('');
  const stringToSign = paramString + apiKey.privateKey;

  return crypto.createHash('sha1').update(stringToSign).digest('hex');
}

function buildSignedParams(action: string, extraParams: Record<string, string> = {}): URLSearchParams {
  if (!apiKey) {
    throw new Error('API密钥未配置');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2);

  const params: Record<string, string> = {
    Action: action,
    PublicKey: apiKey.publicKey,
    Timestamp: timestamp,
    Nonce: nonce,
    ...extraParams
  };

  const signature = generateSignature(params);
  params.Signature = signature;

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    urlParams.append(key, value);
  }

  return urlParams;
}

export function getSelfServerConfig(): SelfServerConfig | null {
  return currentServerConfig;
}

export function setSelfServerConfig(config: SelfServerConfig) {
  currentServerConfig = config;
}

export async function startCompShareInstance(config: {
  region: string;
  zone: string;
  projectId: string;
  uhostId: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const extraParams: Record<string, string> = {
      Region: config.region,
      Zone: config.zone,
      UHostId: config.uhostId,
      WithoutGpu: 'false'
    };
    if (config.projectId) {
      extraParams.ProjectId = config.projectId;
    }

    const params = buildSignedParams('StartCompShareInstance', extraParams);
    const response = await axios.get(`${COMPSHARE_API_BASE}/?${params.toString()}`);
    const data = response.data;

    if (data.RetCode === 0) {
      logger.info('[CompShare] 实例启动成功', { uhostId: config.uhostId });
      return { success: true, message: '实例启动成功' };
    } else {
      logger.error('[CompShare] 实例启动失败', data);
      return { success: false, message: `启动失败: ${data.Message || '未知错误'}` };
    }
  } catch (error: any) {
    logger.error('[CompShare] 启动实例异常', error);
    return { success: false, message: error.message };
  }
}

export async function stopCompShareInstance(config: {
  region: string;
  zone: string;
  projectId: string;
  uhostId: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const extraParams: Record<string, string> = {
      Region: config.region,
      Zone: config.zone,
      UHostId: config.uhostId
    };
    if (config.projectId) {
      extraParams.ProjectId = config.projectId;
    }

    const params = buildSignedParams('StopCompShareInstance', extraParams);
    const response = await axios.get(`${COMPSHARE_API_BASE}/?${params.toString()}`);
    const data = response.data;

    if (data.RetCode === 0) {
      logger.info('[CompShare] 实例关闭成功', { uhostId: config.uhostId });
      return { success: true, message: '实例关闭成功' };
    } else {
      logger.error('[CompShare] 实例关闭失败', data);
      return { success: false, message: `关闭失败: ${data.Message || '未知错误'}` };
    }
  } catch (error: any) {
    logger.error('[CompShare] 关闭实例异常', error);
    return { success: false, message: error.message };
  }
}

export async function describeCompShareInstance(config: {
  region?: string;
  zone?: string;
  projectId?: string;
  uhostIds?: string[];
}): Promise<{ success: boolean; instances?: any[]; message?: string }> {
  try {
    const extraParams: Record<string, string> = {};
    if (config.region) extraParams.Region = config.region;
    if (config.zone) extraParams.Zone = config.zone;
    if (config.projectId) extraParams.ProjectId = config.projectId;
    if (config.uhostIds && config.uhostIds.length > 0) {
      config.uhostIds.forEach((id, index) => {
        extraParams[`UHostIds.${index}`] = id;
      });
    }

    const params = buildSignedParams('DescribeCompShareInstance', extraParams);
    const response = await axios.get(`${COMPSHARE_API_BASE}/?${params.toString()}`);
    const data = response.data;

    if (data.RetCode === 0) {
      return { success: true, instances: data.UHostSet || [] };
    } else {
      return { success: false, message: `查询失败: ${data.Message || '未知错误'}` };
    }
  } catch (error: any) {
    logger.error('[CompShare] 查询实例异常', error);
    return { success: false, message: error.message };
  }
}

export async function processDigitalHuman(params: {
  apiUrl: string;
  audioFile: string;
  videoFile: string;
}): Promise<{ success: boolean; videoPath?: string; message?: string }> {
  const { apiUrl, audioFile, videoFile } = params;
  logger.info('[CompShare] 开始数字人处理', { apiUrl, audioFile, videoFile });

  try {
    // 使用 Python 脚本调用 Gradio API
    let scriptPath: string = '';

    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(process.resourcesPath || '', 'scripts', 'digital_human_process.py'),
      path.join(process.env.APP_ROOT || '', 'scripts', 'digital_human_process.py'),
      path.join(process.cwd(), 'scripts', 'digital_human_process.py'),
      path.join(process.cwd(), '..', 'scripts', 'digital_human_process.py'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        scriptPath = p;
        break;
      }
    }

    if (!scriptPath) {
      // 如果都找不到，使用 cwd 版本
      scriptPath = path.join(process.cwd(), 'scripts', 'digital_human_process.py');
    }

    logger.info('[CompShare] Python 脚本路径', { scriptPath });

    // ✅ 关键修复：使用内嵌的 Python，避免依赖系统安装
    let pythonExe = getPythonExecutablePath();
    if (!resourceExists(pythonExe)) {
      logger.warn(`[CompShare] 内嵌Python不存在: ${pythonExe}，尝试系统python`);
      pythonExe = 'python'; // 回退到系统 python
    }
    logger.info('[CompShare] 使用Python路径', { pythonExe });

    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonExe, [scriptPath, apiUrl, audioFile, videoFile], {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        logger.info('[CompShare] Python 脚本执行完成', { code, stdout: stdout.substring(0, 500) });

        if (code === 0 && stdout.trim()) {
          try {
            const stdoutLines = stdout
              .split(/\r?\n/)
              .map(line => line.trim())
              .filter(Boolean);
            const jsonLine = [...stdoutLines].reverse().find(line => line.startsWith('{') && line.endsWith('}'));

            if (!jsonLine) {
              resolve({ success: false, message: `解析结果失败: ${stdout.substring(0, 200)}` });
              return;
            }

            const result = JSON.parse(jsonLine);
            if (result.success) {
              resolve({ success: true, videoPath: result.videoPath });
            } else {
              resolve({ success: false, message: result.error || '处理失败' });
            }
          } catch (e) {
            resolve({ success: false, message: `解析结果失败: ${stdout.substring(0, 200)}` });
          }
        } else {
          resolve({ success: false, message: stderr || `进程退出码: ${code}` });
        }
      });

      pythonProcess.on('error', (err: Error) => {
        logger.error('[CompShare] Python 进程错误', err);
        resolve({ success: false, message: err.message });
      });

      // 10分钟超时
      setTimeout(() => {
        pythonProcess.kill();
        resolve({ success: false, message: '处理超时' });
      }, 600000);
    });

  } catch (error: any) {
    const errorDetail = error.message || '未知错误';
    logger.error('[CompShare] 数字人处理失败', errorDetail);
    return { success: false, message: errorDetail };
  }
}

export function updateLastTaskTime() {
  lastTaskTime = Date.now();

  if (autoShutdownTimer) {
    clearTimeout(autoShutdownTimer);
  }

  autoShutdownTimer = setTimeout(async () => {
    const now = Date.now();
    if (now - lastTaskTime >= AUTO_SHUTDOWN_DELAY && currentServerConfig) {
      logger.info('[CompShare] 10分钟无任务，自动关闭实例');
      await stopCompShareInstance(currentServerConfig);
      autoShutdownTimer = null;
    }
  }, AUTO_SHUTDOWN_DELAY);
}

export function registerCompShareHandlers() {
  ipcMain.handle('compshare:setApiKey', async (event, params: { publicKey: string; privateKey: string }) => {
    logger.info('[CompShare:IPC] 设置API密钥');
    setCompShareApiKey(params.publicKey, params.privateKey);
    return { success: true };
  });

  ipcMain.handle('compshare:startInstance', async (event, params) => {
    logger.info('[CompShare:IPC] 启动实例', params);
    const result = await startCompShareInstance(params);
    if (result.success) {
      setSelfServerConfig({
        region: params.region,
        zone: params.zone,
        projectId: params.projectId,
        uhostId: params.uhostId,
        apiUrl: ''
      });
      updateLastTaskTime();
    }
    return result;
  });

  ipcMain.handle('compshare:stopInstance', async (event, params) => {
    logger.info('[CompShare:IPC] 关闭实例', params);
    return await stopCompShareInstance(params);
  });

  ipcMain.handle('compshare:describeInstance', async (event, params) => {
    logger.info('[CompShare:IPC] 查询实例', params);
    return await describeCompShareInstance(params);
  });

  ipcMain.handle('compshare:digitalHumanProcess', async (event, params) => {
    logger.info('[CompShare:IPC] 数字人处理', { apiUrl: params.apiUrl });
    const result = await processDigitalHuman(params);
    if (result.success) {
      updateLastTaskTime();
    }
    return result;
  });

  logger.info('[CompShare:IPC] Handlers已注册');
}