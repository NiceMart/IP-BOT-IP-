// @ts-nocheck
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import type { TaskBiz } from "../store/modules/task";
import { FixedModeProcessor, KeywordModeProcessor, FFmpegCommandBuilder, MaterialManager, SrtGenerator } from "../lib/mixCutVideo";
import KeywordGroupService from "../service/KeywordGroupService";
import type { VideoMixCutConfig } from "../lib/mixCutVideo/types";

const serverStore = useServerStore();

export const VideoMixCut: TaskBiz = {
  runFunc: async (bizId, bizParam) => {
    const { record } = await serverStore.prepareForTask(bizId, bizParam);
    const mixCutConfig: VideoMixCutConfig = record.modelConfig;
    const originalVideoPath = mixCutConfig.originalVideoPath;

    if (!originalVideoPath) {
      throw new Error("原始视频路径未指定");
    }

    try {
      console.log('[VideoMixCut] 开始混剪处理');

      // 获取视频时长
      const videoDuration = await MaterialManager.getVideoDuration(originalVideoPath);
      if (videoDuration <= 0) {
        throw new Error(`无法获取视频时长: ${originalVideoPath}`);
      }

      console.log(`[VideoMixCut] 视频时长: ${videoDuration.toFixed(1)}秒`);

      let replacements: any[] = [];

      // 处理固定模式
      if (mixCutConfig.mode === 'fixed' && mixCutConfig.fixedModeConfig.enabled) {
        console.log('[VideoMixCut] 使用固定模式处理');
        console.log('[VideoMixCut] 固定模式配置详情:', {
          enabled: mixCutConfig.fixedModeConfig.enabled,
          opening: {
            enabled: mixCutConfig.fixedModeConfig.opening?.enabled,
            materialFolderPath: mixCutConfig.fixedModeConfig.opening?.materialFolderPath
          },
          middle: {
            enabled: mixCutConfig.fixedModeConfig.middle?.enabled,
            materialFolderPath: mixCutConfig.fixedModeConfig.middle?.materialFolderPath
          },
          ending: {
            enabled: mixCutConfig.fixedModeConfig.ending?.enabled,
            materialFolderPath: mixCutConfig.fixedModeConfig.ending?.materialFolderPath
          }
        });

        const fixedReplacements = await FixedModeProcessor.process(
          originalVideoPath,
          mixCutConfig.fixedModeConfig,
          videoDuration
        );

        console.log('[VideoMixCut] 固定模式生成 ' + fixedReplacements.length + ' 个替换点');
        replacements.push(...fixedReplacements);
      } else if (mixCutConfig.mode === 'fixed') {
        console.warn('[VideoMixCut] 固定模式未启用:', {
          mode: mixCutConfig.mode,
          fixedModeEnabled: mixCutConfig.fixedModeConfig?.enabled
        });
      }

      // 🔧 新增：处理关键词模式
      if (mixCutConfig.mode === 'keyword' && mixCutConfig.keywordModeConfig.enabled) {
        console.log('[VideoMixCut] 使用关键词模式处理');

        // 🔧 自动生成 SRT 字幕（如果没有提供）
        let subtitleFilePath = mixCutConfig.subtitleFilePath;

        if (!subtitleFilePath) {
          console.log('[VideoMixCut] 未提供字幕文件，开始自动生成 SRT...');
          try {
            subtitleFilePath = await SrtGenerator.generateFromVideo(originalVideoPath);
            console.log('[VideoMixCut] ✅ SRT 字幕自动生成成功:', subtitleFilePath);
          } catch (error: any) {
            console.error('[VideoMixCut] ❌ SRT 字幕生成失败:', error);
            throw new Error(`关键词模式需要字幕文件，但自动生成失败: ${error.message}`);
          }
        } else {
          console.log('[VideoMixCut] 使用已提供的字幕文件:', subtitleFilePath);
        }

        // 获取关键词分组数据
        const keywordGroups = await KeywordGroupService.getAllGroups();
        console.log('[VideoMixCut] 获取到 ' + keywordGroups.length + ' 个关键词分组');

        // 调用关键词模式处理器
        const keywordReplacements = await KeywordModeProcessor.process(
          subtitleFilePath,
          mixCutConfig.keywordModeConfig,
          keywordGroups
        );

        console.log('[VideoMixCut] 关键词模式生成 ' + keywordReplacements.length + ' 个替换点');
        replacements.push(...keywordReplacements);
      }

      if (replacements.length === 0) {
        console.warn('[VideoMixCut] 没有检测到替换点');
        return {
          type: "success",
          data: {
            originalVideo: originalVideoPath,
            outputVideo: originalVideoPath,
            message: "未检测到任何替换点，返回原视频"
          }
        };
      }

      // 构建并执行FFmpeg命令
      const outputPath = mixCutConfig.outputPath || await window.$mapi.file.temp(`mixed_${Date.now()}.mp4`);
      const videoResolution = mixCutConfig.videoResolution || { width: 1920, height: 1080 };

      // 🔧 修复：displayMode 现在在每个 MaterialReplacement 中设置，不再使用全局 displayMode
      const ffmpegArgs = FFmpegCommandBuilder.buildOverlayCommand(
        originalVideoPath,
        replacements,
        outputPath,
        videoResolution
      );

      console.log(`[VideoMixCut] 开始执行FFmpeg命令`);
      const startTime = Date.now();

      await window.$mapi.shell.execFFmpegCommand(ffmpegArgs);
      const processingTime = Date.now() - startTime;

      console.log(`[VideoMixCut] 处理完成, 耗时: ${(processingTime / 1000).toFixed(1)}秒`);

      return {
        type: "success",
        data: {
          originalVideo: originalVideoPath,
          outputVideo: outputPath,
          mode: mixCutConfig.mode,
          replacementCount: replacements.length,
          processingTime,
          // 🔧 新增：返回详细的替换点信息
          replacements: replacements
        }
      };
    } catch (error: any) {
      console.error('[VideoMixCut] 处理失败:', error);
      throw new Error(`VideoMixCut failed: ${error.message}`);
    }
  },

  successFunc: async (bizId, bizParam) => {
    const { record } = await serverStore.prepareForTask(bizId, bizParam);
    await TaskService.update(bizId, {
      status: "success",
      endTime: Date.now(),
      result: record.jobResult?.data
    });
  },

  failFunc: async (bizId, msg, bizParam) => {
    await TaskService.update(bizId, {
      status: "fail",
      statusMsg: msg,
      endTime: Date.now()
    });
  }
};
