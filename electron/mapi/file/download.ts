import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import logger from '../log/main';
import { AppEnv } from '../env';
import { getFFmpegExecutablePath, getFFprobeExecutablePath, resourceExists } from '../../lib/resource-path';

export async function downloadFile(url: string, saveDir?: string): Promise<string> {
  logger.info('[File:Download] 开始下载文件', { url });

  try {
    const targetDir = saveDir || path.join(AppEnv.dataRoot, 'hub', 'file', getDatePath());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const urlPath = new URL(url).pathname;
    const originalFileName = path.basename(urlPath);
    const ext = path.extname(originalFileName) || '.mp4';
    const fileName = `cloud_${Date.now()}${ext}`;
    const filePath = path.join(targetDir, fileName);

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    const downloadedPath = await new Promise<string>((resolve, reject) => {
      writer.on('finish', () => {
        logger.info('[File:Download] 文件下载完成', { filePath });
        resolve(filePath);
      });

      writer.on('error', (error) => {
        logger.error('[File:Download] 文件写入失败', error);
        reject(error);
      });

      response.data.on('error', (error: Error) => {
        logger.error('[File:Download] 下载失败', error);
        writer.close();
        reject(error);
      });
    });

    const transcodedPath = await transcodeToH264IfNeeded(downloadedPath);
    return transcodedPath;
  } catch (error: any) {
    logger.error('[File:Download] 下载文件失败', {
      url,
      error: error.message
    });
    throw new Error(`下载文件失败: ${error.message}`);
  }
}

async function transcodeToH264IfNeeded(filePath: string): Promise<string> {
  try {
    const ffprobePath = getFFprobeExecutablePath();
    if (!resourceExists(ffprobePath)) {
      return filePath;
    }

    const codecName = await getVideoCodec(filePath, ffprobePath);
    logger.info('[File:Download] 视频编码检测', { filePath, codecName });

    if (codecName === 'h264') {
      return filePath;
    }

    logger.info('[File:Download] 视频非H264编码，开始转码', { codecName });

    const ffmpegPath = getFFmpegExecutablePath();
    if (!resourceExists(ffmpegPath)) {
      logger.warn('[File:Download] FFmpeg不存在，跳过转码');
      return filePath;
    }

    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    const transcodedPath = path.join(dir, `${baseName}_h264.mp4`);

    await runFFmpeg(ffmpegPath, [
      '-y',
      '-i', filePath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      transcodedPath
    ]);

    try {
      fs.unlinkSync(filePath);
      const finalPath = path.join(dir, `${baseName}${path.extname(filePath)}`);
      fs.renameSync(transcodedPath, finalPath);
      logger.info('[File:Download] 转码完成', { finalPath });
      return finalPath;
    } catch (renameErr: any) {
      logger.info('[File:Download] 转码完成(保留新文件名)', { transcodedPath });
      return transcodedPath;
    }
  } catch (err: any) {
    logger.warn('[File:Download] 转码失败，使用原始文件', { error: err.message });
    return filePath;
  }
}

function getVideoCodec(filePath: string, ffprobePath: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0',
      filePath
    ]);
    let output = '';
    proc.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    proc.stderr.on('data', () => {});
    proc.on('close', () => {
      resolve(output.trim() || 'unknown');
    });
    proc.on('error', () => {
      resolve('unknown');
    });
  });
}

function runFFmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

function getDatePath(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
