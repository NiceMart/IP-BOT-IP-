import type { FixedModeConfig, MaterialReplacement } from './types';
import { MaterialManager } from './MaterialManager';

/**
 * 固定模式处理器
 */
export class FixedModeProcessor {
  static async process(
    videoPath: string,
    fixedConfig: FixedModeConfig,
    videoDuration: number
  ): Promise<MaterialReplacement[]> {
    console.log('[FixedModeProcessor] 开始处理固定模式');
    console.log('[FixedModeProcessor] 视频时长: ' + videoDuration);
    const replacements: MaterialReplacement[] = [];

    // 验证配置
    const validationResult = this.validateFixedModeConfig(fixedConfig, videoDuration);
    console.log('[FixedModeProcessor] 配置验证结果:', {
      isValid: validationResult.isValid,
      errors: validationResult.errors
    });

    if (!validationResult.isValid) {
      throw new Error('固定模式配置不合理：\n' + validationResult.errors.join('\n'));
    }

    // 处理片头
    if (fixedConfig.opening.enabled) {
      console.log('[FixedModeProcessor] 处理片头');
      const opening = fixedConfig.opening;
      const startTime = opening.timeRange.durationMin;
      const endTime = opening.timeRange.durationMax;
      const duration = endTime - startTime;

      console.log('[FixedModeProcessor] 片头配置:', { startTime, endTime, duration, materialFolderPath: opening.materialFolderPath });

      if (endTime <= videoDuration) {
        console.log('[FixedModeProcessor] 片头时间有效，选择素材');
        const selectionMode = opening.selectionMode || 'random';
        const material = await MaterialManager.selectMaterialUnified(
          selectionMode,
          opening.materialFolderPath,
          opening.specifiedMaterialPath
        );
        console.log('[FixedModeProcessor] 片头素材:', { path: material.path, duration: material.duration, selectionMode });
        replacements.push({
          startTime,
          duration,
          materialPath: material.path,
          materialDuration: material.duration,
          materialStartOffset: 0,
          reason: '片头',
          // 🔧 传递画中画自定义配置
          displayMode: opening.displayMode,
          pipPosition: opening.pipPosition,
          pipSizePercent: opening.pipSizePercent,
          pipScaleMode: opening.pipScaleMode,
          // 🔧 新增：传递图片标记
          isImage: material.isImage,
          // 🆕 新增：传递原视频最小化配置
          originalVideoMinimized: opening.originalVideoMinimized
        });

        // 🔍 调试：打印原视频最小化配置
        console.log('[FixedModeProcessor] 片头原视频最小化配置:', opening.originalVideoMinimized);
      } else {
        console.warn('[FixedModeProcessor] 片头时间超出视频时长，跳过');
      }
    } else {
      console.log('[FixedModeProcessor] 片头未启用');
    }

    // 处理片中 - 🔧 修复：改进时间段计算逻辑
    if (fixedConfig.middle.enabled) {
      console.log('[FixedModeProcessor] 处理片中');
      const middle = fixedConfig.middle;
      const midPoint = videoDuration / 2;
      let startTime = midPoint + middle.timeRange.durationMin;
      let endTime = midPoint + middle.timeRange.durationMax;

      // 🔧 修复：确保时间在有效范围内（不能超出视频时长）
      startTime = Math.max(0, startTime);
      endTime = Math.min(videoDuration, endTime);

      const duration = endTime - startTime;

      console.log('[FixedModeProcessor] 片中配置:', { midPoint, startTime, endTime, duration, materialFolderPath: middle.materialFolderPath });

      // 只要有有效的时间范围，就插入素材
      if (duration > 0 && startTime < videoDuration) {
        console.log('[FixedModeProcessor] 片中时间有效，选择素材');
        const selectionMode = middle.selectionMode || 'random';
        const material = await MaterialManager.selectMaterialUnified(
          selectionMode,
          middle.materialFolderPath,
          middle.specifiedMaterialPath
        );
        console.log('[FixedModeProcessor] 片中素材:', { path: material.path, duration: material.duration, selectionMode });
        replacements.push({
          startTime,
          duration,
          materialPath: material.path,
          materialDuration: material.duration,
          materialStartOffset: 0,
          reason: '片中',
          // 🔧 传递画中画自定义配置
          displayMode: middle.displayMode,
          pipPosition: middle.pipPosition,
          pipSizePercent: middle.pipSizePercent,
          pipScaleMode: middle.pipScaleMode,
          // 🔧 新增：传递图片标记
          isImage: material.isImage,
          // 🆕 新增：传递原视频最小化配置
          originalVideoMinimized: middle.originalVideoMinimized
        });
      } else {
        console.warn('[FixedModeProcessor] 片中时间无效，跳过');
      }
    } else {
      console.log('[FixedModeProcessor] 片中未启用');
    }

    // 处理片尾
    if (fixedConfig.ending.enabled) {
      console.log('[FixedModeProcessor] 处理片尾');
      const ending = fixedConfig.ending;
      const duration = ending.timeRange.durationMax - ending.timeRange.durationMin;
      const startTime = videoDuration - duration;

      console.log('[FixedModeProcessor] 片尾配置:', { startTime, duration, materialFolderPath: ending.materialFolderPath });

      if (startTime >= 0) {
        console.log('[FixedModeProcessor] 片尾时间有效，选择素材');
        const selectionMode = ending.selectionMode || 'random';
        const material = await MaterialManager.selectMaterialUnified(
          selectionMode,
          ending.materialFolderPath,
          ending.specifiedMaterialPath
        );
        console.log('[FixedModeProcessor] 片尾素材:', { path: material.path, duration: material.duration, selectionMode });
        replacements.push({
          startTime,
          duration,
          materialPath: material.path,
          materialDuration: material.duration,
          materialStartOffset: 0,
          reason: '片尾',
          // 🔧 传递画中画自定义配置
          displayMode: ending.displayMode,
          pipPosition: ending.pipPosition,
          pipSizePercent: ending.pipSizePercent,
          pipScaleMode: ending.pipScaleMode,
          // 🔧 新增：传递图片标记
          isImage: material.isImage,
          // 🆕 新增：传递原视频最小化配置
          originalVideoMinimized: ending.originalVideoMinimized
        });
      } else {
        console.warn('[FixedModeProcessor] 片尾时间无效（时长超出视频时长），跳过');
      }
    } else {
      console.log('[FixedModeProcessor] 片尾未启用');
    }

    console.log('[FixedModeProcessor] 处理完成，共生成 ' + replacements.length + ' 个替换点');
    return replacements;
  }

  static validateFixedModeConfig(config: FixedModeConfig, videoDuration: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.opening.enabled) {
      const start = config.opening.timeRange.durationMin;
      const end = config.opening.timeRange.durationMax;
      if (end > videoDuration) errors.push(`片头时间范围 ${start}-${end}秒 超出视频时长 ${videoDuration}秒`);
    }

    if (config.middle.enabled) {
      const midPoint = videoDuration / 2;
      const start = midPoint + config.middle.timeRange.durationMin;
      const end = midPoint + config.middle.timeRange.durationMax;
      if (end > videoDuration) errors.push(`片中时间范围超出视频时长`);
      if (start < 0) errors.push(`片中时间范围起始时间为负数`);
    }

    if (config.ending.enabled) {
      const duration = config.ending.timeRange.durationMax - config.ending.timeRange.durationMin;
      if (videoDuration - duration < 0) errors.push(`片尾时长超出视频时长`);
    }

    return { isValid: errors.length === 0, errors };
  }
}
