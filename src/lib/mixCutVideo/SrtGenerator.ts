// @ts-nocheck
/**
 * SRT 字幕生成器 - 轻量级版本
 * 专为视频混剪功能设计，只生成纯文本 SRT，不涉及特效和样式
 */

import { useServerStore } from '../../store/modules/server';

export interface SrtSegment {
  start: number;  // 秒
  end: number;    // 秒
  text: string;
}

export class SrtGenerator {
  /**
   * 从视频生成 SRT 字幕文件
   * @param videoPath 视频文件路径
   * @param outputPath 输出 SRT 文件路径（可选，默认自动生成）
   * @returns SRT 文件路径
   */
  static async generateFromVideo(videoPath: string, outputPath?: string): Promise<string> {
    console.log('[SrtGenerator] 开始从视频生成 SRT 字幕...');
    console.log('[SrtGenerator] 视频路径:', videoPath);

    try {
      // 1. 从视频提取音频
      console.log('[SrtGenerator] 步骤1: 提取音频...');
      const tempAudioPath = await window.$mapi.file.temp('mp3', 'mixcut-asr');

      const audioResult = await window.$mapi.ipAgent.extractAudioFromVideoEnhanced({
        videoPath: videoPath,
        format: 'mp3',
        sampleRate: '16000',  // ASR 适用的采样率
        outputPath: tempAudioPath
      });

      if (!audioResult.success) {
        throw new Error(`音频提取失败: ${audioResult.message}`);
      }

      console.log('[SrtGenerator] 音频提取完成:', tempAudioPath);

      // 2. 调用 ASR 服务识别
      console.log('[SrtGenerator] 步骤2: 调用 ASR 识别...');
      const serverStore = useServerStore();

      // 从 IP 代理配置获取 ASR 模型
      const settingsResult = await window.$mapi.ipAgent.getSettings();
      console.log('[SrtGenerator] IP代理设置:', settingsResult);

      if (!settingsResult.success || !settingsResult.settings || !settingsResult.settings.asrModelKey) {
        throw new Error('未配置语音识别模型，请先在【设置】-【模型设置】-【声音模型】中配置语音识别模型。');
      }

      const asrModelKey = settingsResult.settings.asrModelKey;
      console.log('[SrtGenerator] 使用ASR模型:', asrModelKey);

      // 获取ASR服务器配置
      const server = await serverStore.getByKey(asrModelKey);
      if (!server) {
        throw new Error('未找到语音识别模型，请检查配置。');
      }

      const serverInfo = await serverStore.serverInfo(server);
      console.log('[SrtGenerator] 服务器信息:', serverInfo.name, serverInfo.version);

      const asrResult = await serverStore.call(serverInfo, 'asr', {
        id: serverStore.generateTaskId('MixCutASR', Date.now()),
        audio: tempAudioPath,
        param: {}
      });

      // 清理临时音频文件
      try {
        await window.$mapi.file.delete(tempAudioPath);
      } catch (e) {
        console.warn('[SrtGenerator] 清理临时音频文件失败（不影响结果）:', e);
      }

      console.log('[SrtGenerator] ASR 结果结构:', {
        code: asrResult.code,
        hasData: !!asrResult.data,
        dataType: asrResult.data?.type,
        msg: asrResult.msg
      });

      if (asrResult.code) {
        throw new Error(`ASR 识别失败: ${asrResult.msg || '未知错误'}`);
      }

      if (asrResult.data.type !== 'success') {
        throw new Error(`ASR 识别未成功: ${asrResult.data.type}`);
      }

      // 3. 提取识别结果
      const transcripts = asrResult.data.data.records;
      console.log('[SrtGenerator] ASR 识别完成，识别到 ' + transcripts.length + ' 个字幕段');

      // 🔍 诊断日志：打印前 3 个字幕段的原始数据
      console.log('[SrtGenerator] ASR 返回的前 3 个字幕段（原始数据）:',
        transcripts.slice(0, 3).map((t: any, i: number) => ({
          index: i + 1,
          start: t.start,
          end: t.end,
          text: t.text?.substring(0, 30)
        }))
      );

      // 🔧 修复：ASR 返回的时间单位是毫秒，需要转换为秒
      console.log('[SrtGenerator] 步骤3: 转换时间单位（毫秒 -> 秒）...');
      const transcriptsInSeconds = transcripts.map((t: any) => ({
        start: t.start / 1000,  // 毫秒 -> 秒
        end: t.end / 1000,      // 毫秒 -> 秒
        text: t.text
      }));

      console.log('[SrtGenerator] 转换后的前 3 个字幕段（秒）:',
        transcriptsInSeconds.slice(0, 3).map((t: any, i: number) => ({
          index: i + 1,
          start: t.start.toFixed(2),
          end: t.end.toFixed(2),
          text: t.text?.substring(0, 30)
        }))
      );

      // 4. 格式化为 SRT
      console.log('[SrtGenerator] 步骤4: 格式化为 SRT...');
      const srtContent = this.formatAsSrt(transcriptsInSeconds);

      // 5. 保存 SRT 文件
      console.log('[SrtGenerator] 步骤4: 保存 SRT 文件...');
      const srtPath = outputPath || await window.$mapi.file.temp('srt', 'mixcut-subtitle');
      await window.$mapi.file.write(srtPath, srtContent, { isDataPath: false });

      console.log('[SrtGenerator] ✅ SRT 文件生成成功:', srtPath);
      return srtPath;

    } catch (error: any) {
      console.error('[SrtGenerator] ❌ 生成 SRT 文件失败:', error);
      throw new Error(`生成 SRT 字幕失败: ${error.message || error}`);
    }
  }

  /**
   * 格式化为 SRT 字符串
   * @param segments 字幕段数组
   * @returns SRT 格式字符串
   */
  static formatAsSrt(segments: SrtSegment[]): string {
    let srtContent = '';

    segments.forEach((segment, index) => {
      const startTime = this.formatSrtTime(segment.start);
      const endTime = this.formatSrtTime(segment.end);

      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
    });

    return srtContent;
  }

  /**
   * 格式化时间为 SRT 时间格式 (HH:MM:SS,mmm)
   * @param seconds 秒数
   * @returns SRT 时间格式字符串
   */
  static formatSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const ms = Math.floor((secs - Math.floor(secs)) * 1000);

    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = Math.floor(secs).toString().padStart(2, '0');
    const formattedMs = ms.toString().padStart(3, '0');

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds},${formattedMs}`;
  }

  /**
   * 验证 SRT 文件是否存在且有效
   * @param srtPath SRT 文件路径
   * @returns 是否有效
   */
  static async validateSrtFile(srtPath: string): Promise<boolean> {
    try {
      const content = await window.$mapi.file.read(srtPath, { isDataPath: false });
      return content && content.length > 0 && content.includes('-->');
    } catch (error) {
      console.warn('[SrtGenerator] SRT 文件验证失败:', error);
      return false;
    }
  }
}
