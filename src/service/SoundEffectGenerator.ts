/**
 * 音效生成器
 * 负责根据关键词匹配结果和音效配置生成音效时间表和FFmpeg命令
 */

import type {
  ArrangedSubtitle,
  KeywordMatch
} from '@/service/ZimuShengcheng.types';
import type { KeywordGroup } from '@/types/smartSubtitle';
import type { SoundEffectParams } from '@/types/soundEffect';
import { SoundEffectLibrary } from '@/lib/subtitle/effects/SoundEffectLibrary';

/**
 * 音效实例（用于生成）
 */
interface SoundEffectInstance {
  effectId: string;
  params: SoundEffectParams;
  keyword: string;
  triggerTime: number; // 秒
  duration: number; // 毫秒
}

/**
 * 音效生成器类
 */
export class SoundEffectGenerator {
  /**
   * 为字幕生成音效配置
   * 🆕 修改：同时获取音效文件路径，用于后续 FFmpeg 混音
   */
  static async generateSoundTrack(
    arrangedSubtitles: ArrangedSubtitle[],
    keywordMatches: KeywordMatch[],
    keywordGroups: KeywordGroup[]
  ): Promise<{
    ffmpegAudioFilters: string[];
    soundInstances: (SoundEffectInstance & { filePath?: string })[];
  }> {
    // 1. 构建音效时间表
    const soundTimeline = this.buildSoundEffectTimeline(
      keywordMatches,
      keywordGroups
    );

    // 2. 获取音效文件路径
    const soundInstances: (SoundEffectInstance & { filePath?: string })[] = [];

    for (const instance of soundTimeline) {
      // 🆕 获取音效文件路径
      let filePath: string | undefined;
      try {
        // 🔍 诊断日志
        const hasWindow = typeof window !== 'undefined';
        const hasMapi = hasWindow && !!(window as any).$mapi;
        const hasSoundEffect = hasMapi && !!(window as any).$mapi.soundEffect;
        const hasGetFilePath = hasSoundEffect && typeof (window as any).$mapi.soundEffect.getFilePath === 'function';

        console.log(`[SoundEffectGenerator] 🔍 API 检测: ${instance.effectId}`, {
          hasWindow,
          hasMapi,
          hasSoundEffect,
          hasGetFilePath,
          soundEffectMethods: hasSoundEffect ? Object.keys((window as any).$mapi.soundEffect) : 'N/A'
        });

        if (hasGetFilePath) {
          const result = await (window as any).$mapi.soundEffect.getFilePath(instance.effectId, undefined);
          console.log(`[SoundEffectGenerator] 🔍 getFilePath 返回结果:`, result);
          if (result.success && result.filePath) {
            filePath = result.filePath;
            console.log(`[SoundEffectGenerator] ✅ 获取音效文件路径: ${instance.effectId} -> ${filePath}`);
          } else {
            console.warn(`[SoundEffectGenerator] ⚠️ 音效文件路径不存在: ${instance.effectId}`, result.message);
          }
        } else {
          console.error(`[SoundEffectGenerator] ❌ $mapi.soundEffect.getFilePath 不可用!`);
        }
      } catch (error) {
        console.error(`[SoundEffectGenerator] ❌ 获取音效文件路径失败: ${instance.effectId}`, error);
      }

      // 🔧 由于使用预置音效文件，不再需要生成 FFmpeg 合成命令
      // 音效混音将在 ZimuShengcheng.executeFFmpeg 中通过 audioMixConfig 实现
      if (filePath) {
        soundInstances.push({
          ...instance,
          filePath  // 🆕 添加文件路径
        });
      }
    }

    console.log(`[SoundEffectGenerator] 生成了 ${soundInstances.length} 个有效音效实例`);

    return {
      ffmpegAudioFilters: [],  // 预置音效文件不需要 FFmpeg 合成命令
      soundInstances
    };
  }

  /**
   * 构建音效时间表
   * 将关键词匹配结果转换为音效实例列表
   */
  private static buildSoundEffectTimeline(
    keywordMatches: KeywordMatch[],
    keywordGroups: KeywordGroup[]
  ): SoundEffectInstance[] {
    const timeline: SoundEffectInstance[] = [];

    for (const match of keywordMatches) {
      // 查找该关键词所属的分组
      const group = keywordGroups.find((g) => g.id === match.groupId);

      if (!group || !group.soundEffectId) {
        // 没有配置音效，跳过
        continue;
      }

      // 计算触发时间
      const triggerTime = this.calculateTriggerTime(
        match.startTime,
        match.endTime,
        group.soundEffectConfig?.triggerTime || 'start'
      );

      // 获取音效参数
      const params = SoundEffectLibrary.mergeParams(
        group.soundEffectId,
        group.soundEffectConfig
      );

      // 创建音效实例
      const instance: SoundEffectInstance = {
        effectId: group.soundEffectId,
        params,
        keyword: match.keyword,
        triggerTime,
        duration: match.effectDuration || 1000 // 默认 1 秒
      };

      timeline.push(instance);

      console.log(`[SoundEffectGenerator] 添加音效: ${match.keyword} @ ${triggerTime}s`);
    }

    return timeline;
  }

  /**
   * 计算触发时间
   * @note FunASR 时间戳是毫秒，需要转换为秒供 FFmpeg adelay 使用
   */
  private static calculateTriggerTime(
    startTime: number,
    endTime: number,
    triggerPoint: 'start' | 'middle' | 'end'
  ): number {
    let triggerMs: number;
    switch (triggerPoint) {
      case 'start':
        triggerMs = startTime;
        break;
      case 'middle':
        triggerMs = (startTime + endTime) / 2;
        break;
      case 'end':
        triggerMs = endTime;
        break;
      default:
        triggerMs = startTime;
    }
    // 🔧 FunASR 时间戳是毫秒，转换为秒
    return triggerMs / 1000;
  }

  /**
   * 生成 FFmpeg 音频混音滤镜
   * 用于将多个音效混音到原视频的音轨
   */
  static buildAudioMixFilters(
    soundInstances: SoundEffectInstance[],
    masterVolume: number = 0.7
  ): string {
    if (soundInstances.length === 0) {
      return '';
    }

    // 按触发时间排序
    const sortedInstances = [...soundInstances].sort(
      (a, b) => a.triggerTime - b.triggerTime
    );

    // 构建 adelay 和 volume 滤镜链
    const filterChains: string[] = [];

    for (const instance of sortedInstances) {
      // 计算延迟（毫秒）
      const delayMs = Math.floor(instance.triggerTime * 1000);

      // 构建单个音效的滤镜链
      let filter = '';

      // 添加延迟
      if (delayMs > 0) {
        filter += `adelay=${delayMs}|${delayMs},`;
      }

      // 添加音量调整
      const volume = (instance.params.volume || 0.7) * masterVolume;
      filter += `volume=${volume}`;

      // 添加淡入淡出
      const fadeInMs = instance.params.fadeIn || 0;
      const fadeOutMs = instance.params.fadeOut || 0;

      if (fadeInMs > 0) {
        const fadeInSec = fadeInMs / 1000;
        filter += `,afade=t=in:st=${delayMs / 1000}:d=${fadeInSec}`;
      }

      if (fadeOutMs > 0) {
        const fadeOutStartSec = delayMs / 1000 + (instance.duration || 1000) / 1000;
        const fadeOutSec = fadeOutMs / 1000;
        filter += `,afade=t=out:st=${fadeOutStartSec}:d=${fadeOutSec}`;
      }

      filterChains.push(filter);
    }

    return filterChains.join(';');
  }

  /**
   * 验证音效配置
   */
  static validateSoundConfig(
    keywordGroups: KeywordGroup[]
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const group of keywordGroups) {
      if (!group.soundEffectId) {
        continue; // 没有配置音效，不需要验证
      }

      // 检查音效ID是否有效
      const effect = SoundEffectLibrary.getBuiltinEffect(group.soundEffectId);
      if (!effect) {
        errors.push(`分组 "${group.name}" 的音效ID无效: ${group.soundEffectId}`);
      }

      // 检查音效参数
      const params = group.soundEffectConfig;
      if (params) {
        if (params.volume !== undefined && (params.volume < 0 || params.volume > 1)) {
          errors.push(
            `分组 "${group.name}" 的音量值无效: ${params.volume}（应在 0-1 之间）`
          );
        }

        if (params.pitch !== undefined && (params.pitch < 0.5 || params.pitch > 2)) {
          errors.push(
            `分组 "${group.name}" 的音调值无效: ${params.pitch}（应在 0.5-2 之间）`
          );
        }

        if (params.fadeIn !== undefined && (params.fadeIn < 0 || params.fadeIn > 1000)) {
          errors.push(
            `分组 "${group.name}" 的淡入时间无效: ${params.fadeIn}ms（应在 0-1000ms 之间）`
          );
        }

        if (params.fadeOut !== undefined && (params.fadeOut < 0 || params.fadeOut > 1000)) {
          errors.push(
            `分组 "${group.name}" 的淡出时间无效: ${params.fadeOut}ms（应在 0-1000ms 之间）`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default SoundEffectGenerator;
