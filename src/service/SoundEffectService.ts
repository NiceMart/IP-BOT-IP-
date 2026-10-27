/**
 * 音效服务 - 前端业务逻辑层
 */

import type {
  SoundEffectMetadata,
  UserSoundEffect,
  SoundEffectParams
} from '@/types/soundEffect';

/**
 * 音效服务类
 */
export class SoundEffectService {
  /**
   * 获取所有内置音效
   */
  static async getBuiltinEffects(): Promise<SoundEffectMetadata[]> {
    try {
      const effects = await (window as any).$mapi.soundEffect.getBuiltinEffects();
      return effects || [];
    } catch (error) {
      console.error('[SoundEffectService] 获取内置音效失败:', error);
      return [];
    }
  }

  /**
   * 🆕 获取所有音效（内置 + 用户自定义）
   */
  static async getAllEffects(): Promise<SoundEffectMetadata[]> {
    try {
      const effects = await (window as any).$mapi.soundEffect.getAllEffects();
      return effects || [];
    } catch (error) {
      console.error('[SoundEffectService] 获取所有音效失败:', error);
      // 降级到只返回内置音效
      return this.getBuiltinEffects();
    }
  }

  /**
   * 按分类获取内置音效
   */
  static async getEffectsByCategory(
    category: 'basic' | 'motion' | 'visual' | 'advanced'
  ): Promise<SoundEffectMetadata[]> {
    const allEffects = await this.getBuiltinEffects();
    return allEffects.filter((effect) => effect.category === category);
  }

  /**
   * 获取所有用户自定义音效
   */
  static async getUserEffects(): Promise<UserSoundEffect[]> {
    try {
      const effects = await (window as any).$mapi.soundEffect.getUserEffects();
      return effects || [];
    } catch (error) {
      console.error('[SoundEffectService] 获取用户音效失败:', error);
      return [];
    }
  }

  /**
   * 导入用户音效文件
   */
  static async importEffect(
    filePath: string,
    name: string,
    description?: string
  ): Promise<{
    success: boolean;
    id?: string;
    message?: string;
  }> {
    try {
      return await (window as any).$mapi.soundEffect.importUserEffect(
        filePath,
        name,
        description
      );
    } catch (error) {
      console.error('[SoundEffectService] 导入音效失败:', error);
      return {
        success: false,
        message: `导入失败: ${error}`
      };
    }
  }

  /**
   * 删除用户音效
   */
  static async deleteEffect(effectId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    try {
      return await (window as any).$mapi.soundEffect.deleteUserEffect(effectId);
    } catch (error) {
      console.error('[SoundEffectService] 删除音效失败:', error);
      return {
        success: false,
        message: `删除失败: ${error}`
      };
    }
  }

  /**
   * 生成音效文件
   */
  static async generateEffect(
    effectId: string,
    params?: SoundEffectParams,
    outputPath?: string
  ): Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }> {
    try {
      const result = await (window as any).$mapi.soundEffect.generateEffect(
        effectId,
        params,
        outputPath
      );

      if (result.success) {
        return {
          success: true,
          path: result.audioFile
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('[SoundEffectService] 生成音效失败:', error);
      return {
        success: false,
        error: `生成失败: ${error}`
      };
    }
  }

  /**
   * 预览音效
   * @param effectId 音效ID（内置或用户自定义，用户音效使用 user_ 前缀）
   * @param userEffectId 已弃用，保留用于兼容
   */
  static async previewEffect(
    effectId?: string,
    userEffectId?: string
  ): Promise<void> {
    try {
      // 统一使用 effectId，兼容旧的 userEffectId 参数
      const id = effectId || userEffectId;

      if (!id) {
        console.warn('[SoundEffectService] 预览音效失败: 需要提供 effectId');
        return;
      }

      console.log(`[SoundEffectService] 预览音效: ${id}`);

      const result = await (window as any).$mapi.soundEffect.previewEffect(id);

      if (!result.success) {
        console.warn('[SoundEffectService] 预览音效失败:', result.message);
        return;
      }

      // 使用 Web Audio API 播放音效
      if (result.audioPath) {
        await this.playAudioFile(result.audioPath);
      }
    } catch (error) {
      console.error('[SoundEffectService] 预览音效失败:', error);
    }
  }

  /**
   * 播放音频文件
   */
  private static async playAudioFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(`file://${filePath}`);
      audio.volume = 0.7;

      audio.onended = () => resolve();
      audio.onerror = (error) => reject(error);

      audio.play().catch(reject);
    });
  }

  /**
   * 合并默认参数和用户参数
   */
  static mergeParams(
    defaultParams: SoundEffectParams,
    userParams?: SoundEffectParams
  ): SoundEffectParams {
    return {
      ...defaultParams,
      ...userParams
    };
  }

  /**
   * 🆕 获取音效文件路径
   */
  static async getEffectFilePath(effectId?: string, userEffectId?: string): Promise<{
    success: boolean;
    filePath?: string;
    message?: string;
  }> {
    try {
      return await (window as any).$mapi.soundEffect.getFilePath(effectId, userEffectId);
    } catch (error) {
      console.error('[SoundEffectService] 获取音效路径失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  }

  /**
   * 🆕 批量获取音效文件路径（用于视频生成）
   */
  static async getBatchFilePaths(soundInstances: any[]): Promise<{
    success: boolean;
    results?: { effectId: string; filePath: string | null; triggerTime: number }[];
    message?: string;
  }> {
    try {
      return await (window as any).$mapi.soundEffect.getBatchFilePaths(soundInstances);
    } catch (error) {
      console.error('[SoundEffectService] 批量获取音效路径失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  }
}

export default SoundEffectService;
