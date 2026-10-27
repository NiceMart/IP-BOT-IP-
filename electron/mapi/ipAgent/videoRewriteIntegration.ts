/**
 * 视频仿写功能集成模块
 * 整合内容解析 + 仿写优化，提供完整的视频文案仿写能力
 *
 * 使用示例：
 * const input = "2.05 03/10 i@p.Qx rRX:/ 每4-7个孩子就有1个受抑郁情绪困扰... #家庭教育 https://v.douyin.com/_HjUnkVdzqU/";
 * const result = await VideoRewriteIntegration.processDouyinShare(input, modelConfig);
 */

import { DouyinContentParser } from './douyinContentParser';
import { VideoRewriteOptimizer, RewriteConfig } from './videoRewriteOptimizer';
import { Log } from '../log/main';
import { extractAudioFromVideo } from './funasr';
import { recognizeAudio } from '../aliyun/funasr';
import { DouyinVideoDownloader } from './videoDownloader';
import * as fs from 'fs';
import { ServerMain } from '../server/main';
import { fetchElectronSystemConfig } from '../systemConfig';

interface ModelConfig {
  providerId: string;
  modelId: string;
  apiUrl: string;
  apiHost: string;
  apiKey: string;
  type: string;
}

interface ProcessResult {
  success: boolean;
  original?: {
    videoUrl: string;
    description: string;
    hashtags: string[];
    title: string;
  };
  rewritten?: {
    description: string;
    title: string;
    fullContent: string; // 完整的仿写文案（包括标题、正文、标签）
  };
  error?: string;
}

class VideoRewriteIntegration {
  /**
   * 处理抖音分享文本（完整流程）
   * 1. 解析分享内容
   * 2. 仿写文案
   * 3. 返回完整结果
   */
  static async processDouyinShare(
    shareText: string,
    modelConfig: ModelConfig,
    rewriteConfig?: RewriteConfig,
    customPrompt?: string
  ): Promise<ProcessResult> {
    try {
      Log.info('VideoRewriteIntegration.processDouyinShare.start', {
        inputLength: shareText.length,
        modelConfig: {
          providerId: modelConfig.providerId,
          modelId: modelConfig.modelId
        }
      });

      // 1. 解析分享内容
      const parseResult = DouyinContentParser.parseContent(shareText);

      if (!parseResult.success || !parseResult.content) {
        Log.error('VideoRewriteIntegration.parseFailure', {
          error: parseResult.error
        });
        return {
          success: false,
          error: parseResult.error || '内容解析失败'
        };
      }

      const { videoUrl, description, hashtags } = parseResult.content;

      // 生成原始标题
      const originalTitle = DouyinContentParser.generateTitleFromDescription(description);

      Log.info('VideoRewriteIntegration.parseSuccess', {
        videoUrl,
        descriptionLength: description.length,
        hashtagCount: hashtags.length,
        title: originalTitle
      });

      // 2. 检查模型配置
      if (!modelConfig || !modelConfig.apiUrl || !modelConfig.apiKey) {
        return {
          success: false,
          error: '未配置AI模型，请先在设置中配置'
        };
      }

      // 3. 仿写文案内容
      const rewrittenDescription = await this.rewriteWithAI(
        description,
        modelConfig,
        rewriteConfig,
        customPrompt
      );

      if (!rewrittenDescription) {
        return {
          success: false,
          error: 'AI仿写失败，请检查模型配置和网络连接'
        };
      }

      // 4. 生成仿写后的标题
      const rewrittenTitle = DouyinContentParser.generateTitleFromDescription(rewrittenDescription);

      // 5. 组合完整内容（文案 + 标签）
      const fullContent = rewriteConfig?.keepHashtags !== false && hashtags.length > 0
        ? `${rewrittenDescription}\n\n${hashtags.join(' ')}`
        : rewrittenDescription;

      Log.info('VideoRewriteIntegration.success', {
        originalLength: description.length,
        rewrittenLength: rewrittenDescription.length,
        rewrittenTitle
      });

      return {
        success: true,
        original: {
          videoUrl,
          description,
          hashtags,
          title: originalTitle
        },
        rewritten: {
          description: rewrittenDescription,
          title: rewrittenTitle,
          fullContent
        }
      };

    } catch (error) {
      Log.error('VideoRewriteIntegration.error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 批量处理多个抖音分享文本
   */
  static async processBatchDouyinShares(
    shareTexts: string[],
    modelConfig: ModelConfig,
    rewriteConfig?: RewriteConfig,
    customPrompt?: string
  ): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];

    // 逐个处理（避免并发过多导致API限流）
    for (const shareText of shareTexts) {
      const result = await this.processDouyinShare(
        shareText,
        modelConfig,
        rewriteConfig,
        customPrompt
      );
      results.push(result);

      // 简单延迟，避免请求过快
      await this.delay(500);
    }

    return results;
  }

  /**
   * 完整的视频处理流程：下载 + 音频识别 + 文案改写
   * - 下载抖音视频
   * - 提取音频
   * - 使用FUNASR进行语音识别
   * - 改写识别的文案
   */
  static async processDouyinShareComplete(
    shareText: string,
    modelConfig: ModelConfig,
    rewriteConfig?: RewriteConfig,
    customPrompt?: string,
    progressCallback?: (status: string) => void
  ): Promise<ProcessResult> {
    let videoPath: string | null = null;
    let audioPath: string | null = null;

    try {
      Log.info('VideoRewriteIntegration.processDouyinShareComplete.start', {
        inputLength: shareText.length,
        modelConfig: {
          providerId: modelConfig.providerId,
          modelId: modelConfig.modelId
        }
      });

      // 1. 解析抖音分享文本，提取视频URL
      progressCallback?.('正在解析视频URL...');
      const parseResult = DouyinContentParser.parseContent(shareText);

      if (!parseResult.success || !parseResult.content) {
        Log.error('VideoRewriteIntegration.processDouyinShareComplete.parseFailure', {
          error: parseResult.error
        });
        return {
          success: false,
          error: parseResult.error || '内容解析失败'
        };
      }

      const { videoUrl } = parseResult.content;
      Log.info('VideoRewriteIntegration.processDouyinShareComplete.urlExtracted', { videoUrl });

      // 2. 下载视频
      progressCallback?.('正在下载视频...');
      const downloader = new DouyinVideoDownloader();
      const downloadResult = DouyinContentParser.isDirectVideoUrl(videoUrl)
        ? await downloader.downloadDirectVideo(videoUrl)
        : await downloader.downloadDouyinVideo(videoUrl);

      if (!downloadResult.success || !downloadResult.videoPath) {
        Log.error('VideoRewriteIntegration.processDouyinShareComplete.downloadFailed', {
          error: downloadResult.error
        });
        return {
          success: false,
          error: downloadResult.error || '视频下载失败'
        };
      }

      videoPath = downloadResult.videoPath;
      Log.info('VideoRewriteIntegration.processDouyinShareComplete.videoDownloaded', { videoPath });

      // 3. 提取音频
      progressCallback?.('视频下载完成，正在提取音频...');
      try {
        audioPath = await extractAudioFromVideo(videoPath, undefined, true);
        Log.info('VideoRewriteIntegration.processDouyinShareComplete.audioExtracted', { audioPath });
      } catch (audioError) {
        Log.error('VideoRewriteIntegration.processDouyinShareComplete.audioExtractionFailed', audioError);
        return {
          success: false,
          error: `音频提取失败: ${audioError instanceof Error ? audioError.message : String(audioError)}`
        };
      }

      // 4. 语音识别（根据 asrMode 选择在线或本地）
      const asrMode = (modelConfig as any).asrMode || 'online';  // 默认在线模式
      let recognizedText: string;

      if (asrMode === 'online') {
        // ========== 在线模式：阿里云 OSS + 录音识别 ==========
        progressCallback?.('音频提取完成，正在上传到OSS...');
        const _sysCfg = await fetchElectronSystemConfig();
        const aliyunApiKey = (modelConfig as any).aliyunApiKey || process.env.ALIYUN_API_KEY || _sysCfg.aliyun_bailian_api_key;

        const ossConfig = (modelConfig as any).ossConfig || {
          accessKeyId: (_sysCfg.aliyun_oss_access_key_id || '').trim(),
          accessKeySecret: (_sysCfg.aliyun_oss_access_key_secret || '').trim(),
          bucket: (_sysCfg.aliyun_oss_bucket || '').trim(),
          region: (_sysCfg.aliyun_oss_region || '').trim(),
          endpoint: `https://${(_sysCfg.aliyun_oss_region || '').trim()}.aliyuncs.com`
        };

        // 上传音频到 OSS
        let audioUrl: string;
        try {
          const { uploadToOss } = await import('../aliyun/oss');
          const uploadResult = await uploadToOss(audioPath, ossConfig);

          if (!uploadResult.success || !uploadResult.url) {
            throw new Error(uploadResult.error || 'OSS 上传失败');
          }

          audioUrl = uploadResult.url;
          Log.info('VideoRewriteIntegration.processDouyinShareComplete.ossUploadSuccess', {
            audioUrl: audioUrl.substring(0, 100) + '...'
          });
        } catch (ossError) {
          Log.error('VideoRewriteIntegration.processDouyinShareComplete.ossUploadFailed', ossError);
          return {
            success: false,
            error: `音频上传失败: ${ossError instanceof Error ? ossError.message : String(ossError)}`
          };
        }

        // 使用阿里云录音识别
        progressCallback?.('音频上传完成，正在识别文案（在线模式）...');
        try {
          const { recognizeRecordedAudio } = await import('../aliyun/transcription');
          const asrResult = await recognizeRecordedAudio(audioUrl, {
            apiKey: aliyunApiKey,
            model: 'qwen3-asr-flash-filetrans'  // 🔧 使用和生成字幕一样的模型
          });

          if (!asrResult.success) {
            throw new Error(asrResult.error || '阿里云录音识别失败');
          }

          recognizedText = asrResult.text || '';

          Log.info('VideoRewriteIntegration.processDouyinShareComplete.asrSuccess', {
            recognizedLength: recognizedText.length,
            sentenceCount: asrResult.sentences?.length || 0,
            method: 'aliyun-online-transcription',
            recognizedText: recognizedText
          });
        } catch (asrError) {
          Log.error('VideoRewriteIntegration.processDouyinShareComplete.asrFailed', asrError);
          return {
            success: false,
            error: `语音识别失败（在线模式）: ${asrError instanceof Error ? asrError.message : String(asrError)}`
          };
        }

      } else {
        // ========== 本地模式：使用服务器模块系统调用 ASR ==========
        progressCallback?.('音频提取完成，正在识别文案（本地模式）...');
        const asrServerInfo = (modelConfig as any).asrServerInfo;

        if (!asrServerInfo) {
          Log.error('VideoRewriteIntegration.processDouyinShareComplete.noAsrServerInfo');
          return {
            success: false,
            error: '未配置本地语音识别服务器，请在「设置」中配置'
          };
        }

        try {
          Log.info('VideoRewriteIntegration.processDouyinShareComplete.callingAsrServer', {
            serverName: asrServerInfo.name,
            localPath: asrServerInfo.localPath
          });

          // 获取服务器模块
          const serverModule = await ServerMain.getModule(asrServerInfo);

          // 调用服务器的 asr 方法（传递音频文件路径，而不是base64）
          const asrResult = await serverModule.asr({
            id: `video_rewrite_${Date.now()}`,
            audio: audioPath,  // 直接传文件路径
            result: {},
            param: {}
          });

          if (asrResult.code !== 0) {
            throw new Error(asrResult.msg || '本地 ASR 服务返回错误');
          }

          const records = asrResult.data?.data?.records || [];
          if (!records || records.length === 0) {
            throw new Error('本地 ASR 服务未返回识别结果');
          }

          recognizedText = records.map((r: any) => r.text || '').join('');

          Log.info('VideoRewriteIntegration.processDouyinShareComplete.asrSuccess', {
            recognizedLength: recognizedText.length,
            recordCount: records.length,
            method: 'local-asr-server-module',
            serverName: asrServerInfo.name,
            recognizedText: recognizedText
          });
        } catch (asrError) {
          Log.error('VideoRewriteIntegration.processDouyinShareComplete.asrFailed', asrError);
          return {
            success: false,
            error: `语音识别失败（本地模式）: ${asrError instanceof Error ? asrError.message : String(asrError)}`
          };
        }
      }

      // 5. 检查模型配置
      if (!modelConfig || !modelConfig.apiUrl || !modelConfig.apiKey) {
        return {
          success: false,
          error: '未配置AI模型，请先在设置中配置'
        };
      }

      // 6. 改写识别的文案
      progressCallback?.('文案识别完成，正在改写...');
      const rewrittenDescription = await this.rewriteWithAI(
        recognizedText,
        modelConfig,
        rewriteConfig,
        customPrompt
      );

      if (!rewrittenDescription) {
        return {
          success: false,
          error: 'AI仿写失败，请检查模型配置和网络连接'
        };
      }

      // 7. 生成仿写后的标题
      const rewrittenTitle = DouyinContentParser.generateTitleFromDescription(rewrittenDescription);

      Log.info('VideoRewriteIntegration.processDouyinShareComplete.success', {
        originalLength: recognizedText.length,
        rewrittenLength: rewrittenDescription.length,
        rewrittenTitle
      });

      progressCallback?.('完成！');

      return {
        success: true,
        original: {
          videoUrl,
          description: recognizedText,
          hashtags: [],
          title: '视频音频识别结果'
        },
        rewritten: {
          description: rewrittenDescription,
          title: rewrittenTitle,
          fullContent: rewrittenDescription
        }
      };

    } catch (error) {
      Log.error('VideoRewriteIntegration.processDouyinShareComplete.error', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // 7. 清理临时文件
      if (videoPath && fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
          Log.info('VideoRewriteIntegration.processDouyinShareComplete.videoCleanup', { videoPath });
        } catch (cleanupError) {
          Log.warn('VideoRewriteIntegration.processDouyinShareComplete.videoCleanupFailed', cleanupError);
        }
      }

      if (audioPath && fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
          Log.info('VideoRewriteIntegration.processDouyinShareComplete.audioCleanup', { audioPath });
        } catch (cleanupError) {
          Log.warn('VideoRewriteIntegration.processDouyinShareComplete.audioCleanupFailed', cleanupError);
        }
      }
    }
  }

  /**
   * 使用AI模型仿写文案
   */
  private static async rewriteWithAI(
    content: string,
    modelConfig: ModelConfig,
    rewriteConfig?: RewriteConfig,
    customPrompt?: string
  ): Promise<string | null> {
    try {
      // 构建提示词
      const prompt = VideoRewriteOptimizer.buildRewritePrompt(
        content,
        rewriteConfig || {},
        customPrompt
      );

      Log.info('VideoRewriteIntegration.rewriteWithAI.request', {
        apiUrl: modelConfig.apiUrl,
        modelId: modelConfig.modelId,
        promptLength: prompt.length,
        contentLength: content.length
      });

      // 调用API
      const response = await fetch(modelConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${modelConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelConfig.modelId,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.8, // 增加创意性
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        Log.error('VideoRewriteIntegration.apiError', {
          status: response.status,
          error: errorText
        });
        return null;
      }

      const data = await response.json();
      const rewrittenContent = data.choices?.[0]?.message?.content;

      if (!rewrittenContent) {
        Log.error('VideoRewriteIntegration.emptyResponse', { data });
        return null;
      }

      // 清理可能的多余格式
      const cleaned = rewrittenContent.trim();

      Log.info('VideoRewriteIntegration.rewriteSuccess', {
        originalLength: content.length,
        rewrittenLength: cleaned.length
      });

      return cleaned;

    } catch (error) {
      Log.error('VideoRewriteIntegration.rewriteWithAI.error', error);
      return null;
    }
  }

  /**
   * 工具：延迟执行
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 快速提取URL（不需要完整解析）
   * 用于简单的链接提取场景
   */
  static quickExtractUrl(text: string): string | null {
    const parseResult = DouyinContentParser.parseContent(text);
    return parseResult.success && parseResult.content
      ? parseResult.content.videoUrl
      : null;
  }

  /**
   * 快速提取描述（不需要完整解析）
   */
  static quickExtractDescription(text: string): string | null {
    const parseResult = DouyinContentParser.parseContent(text);
    return parseResult.success && parseResult.content
      ? parseResult.content.description
      : null;
  }

  /**
   * 验证文本是否包含有效的抖音链接
   */
  static hasValidDouyinLink(text: string): boolean {
    const url = this.quickExtractUrl(text);
    return url !== null;
  }
}

export { VideoRewriteIntegration, ProcessResult, ModelConfig };
