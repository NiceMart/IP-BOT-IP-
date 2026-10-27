/**
 * 字幕模式处理器
 * 功能：根据字幕-素材映射配置，生成素材替换点
 */

import type { SubtitleModeConfig, MaterialReplacement } from './types';
import { MaterialManager } from './MaterialManager';

export class SubtitleModeProcessor {
  /**
   * 处理字幕模式混剪
   * @param records ASR识别结果（从步骤2传递）
   * @param subtitleConfig 字幕模式配置
   * @param scriptLines 用户输入的文案行数组（可选，用于基于文案行的映射）
   * @returns 素材替换点数组，按时间排序
   */
  static async process(
    records: any[],
    subtitleConfig: SubtitleModeConfig,
    scriptLines?: string[]
  ): Promise<MaterialReplacement[]> {
    console.log('[SubtitleModeProcessor] 开始处理字幕模式混剪', {
      recordsCount: records.length,
      mappingsCount: subtitleConfig.mappings.length,
      hasScriptLines: !!scriptLines,
      scriptLinesCount: scriptLines?.length || 0
    });

    const replacements: MaterialReplacement[] = [];

    for (const mapping of subtitleConfig.mappings) {
      // 🆕 判断是基于文案行还是基于ASR字幕
      const useScriptLines = scriptLines && scriptLines.length > 0;

      if (useScriptLines) {
        // 模式1：基于文案行 - 需要将文案行映射到ASR records
        console.log('[SubtitleModeProcessor] 使用文案行模式，选中的行索引:', mapping.subtitleIndices);

        // 将选中的文案行文本提取出来
        const selectedTexts: string[] = [];
        for (const lineIndex of mapping.subtitleIndices) {
          if (lineIndex >= 0 && lineIndex < scriptLines.length) {
            selectedTexts.push(scriptLines[lineIndex]);
          }
        }

        if (selectedTexts.length === 0) {
          console.warn('[SubtitleModeProcessor] 跳过无效映射（无有效文案行）');
          continue;
        }

        // 在 ASR records 中查找包含这些文本的记录
        const matchedRecords: any[] = [];
        const combinedText = selectedTexts.join('');

        for (const record of records) {
          // 检查 record 的文本是否包含在选中的文案中
          if (combinedText.includes(record.text.trim())) {
            matchedRecords.push(record);
          }
        }

        if (matchedRecords.length === 0) {
          console.warn('[SubtitleModeProcessor] 未找到匹配的ASR记录，文案:', selectedTexts.join(' | '));
          continue;
        }

        // 计算时间范围：取匹配记录的最小开始和最大结束
        let minStart = Infinity;
        let maxEnd = -Infinity;

        for (const record of matchedRecords) {
          const startTime = record.start / 1000;  // 毫秒→秒
          const endTime = record.end / 1000;

          console.log('[SubtitleModeProcessor] 处理记录:', {
            text: record.text,
            start: record.start,
            end: record.end,
            startTime,
            endTime
          });

          minStart = Math.min(minStart, startTime);
          maxEnd = Math.max(maxEnd, endTime);
        }

        const duration = maxEnd - minStart;

        console.log('[SubtitleModeProcessor] 计算时间范围:', {
          minStart,
          maxEnd,
          duration,
          matchedRecordsCount: matchedRecords.length
        });

        if (duration <= 0) {
          console.error('[SubtitleModeProcessor] ⚠️ duration 为负数或零，跳过此映射');
          continue;
        }

        // 获取素材信息
        let materialPath: string;
        let materialDuration: number;

        // 🆕 支持三种素材选择模式
        const selectionMode = mapping.selectionMode || 'specified';

        if (selectionMode === 'specified') {
          // 指定素材模式（原有逻辑）
          materialPath = mapping.materialPath;
          if (mapping.isImage) {
            materialDuration = duration;
          } else {
            materialDuration = await MaterialManager.getVideoDuration(materialPath);
          }
        } else {
          // 随机或顺序模式（从素材文件夹选择）
          if (!mapping.materialFolderPath) {
            console.warn('[SubtitleModeProcessor] 跳过映射：随机/顺序模式下未配置素材文件夹');
            continue;
          }

          const material = await MaterialManager.selectMaterialUnified(
            selectionMode,
            mapping.materialFolderPath,
            undefined
          );

          materialPath = material.path;
          materialDuration = material.duration;
        }

        // 生成替换点
        replacements.push({
          startTime: minStart,
          duration: duration,
          materialPath: materialPath,
          materialDuration: materialDuration,
          materialStartOffset: 0,
          reason: `字幕模式(文案行): "${selectedTexts.join(' ')}"`,
          displayMode: mapping.displayMode ?? 'fullscreen',
          pipPosition: mapping.pipPosition ?? 'bottom-right',
          pipSizePercent: mapping.pipSizePercent ?? 30,
          pipScaleMode: mapping.pipScaleMode ?? 'fit',
          isImage: mapping.isImage,
          originalVideoMinimized: mapping.originalVideoMinimized
        });

        console.log('[SubtitleModeProcessor] 添加替换点(文案行):', {
          startTime: minStart.toFixed(2),
          duration: duration.toFixed(2),
          scriptLines: selectedTexts.join(' | '),
          matchedRecordsCount: matchedRecords.length,
          material: materialPath
        });
      } else {
        // 模式2：基于ASR字幕索引（原有逻辑）
        let minStart = Infinity;
        let maxEnd = -Infinity;
        const selectedTexts: string[] = [];

        for (const index of mapping.subtitleIndices) {
          if (index < 0 || index >= records.length) {
            console.warn(`[SubtitleModeProcessor] 跳过无效索引: ${index}`);
            continue;
          }

          const record = records[index];
          const startTime = record.start / 1000;  // 毫秒→秒
          const endTime = record.end / 1000;

          console.log('[SubtitleModeProcessor] 处理ASR记录:', {
            index,
            text: record.text,
            start: record.start,
            end: record.end,
            startTime,
            endTime
          });

          minStart = Math.min(minStart, startTime);
          maxEnd = Math.max(maxEnd, endTime);
          selectedTexts.push(record.text);
        }

        if (minStart === Infinity || maxEnd === -Infinity) {
          console.warn('[SubtitleModeProcessor] 跳过无效映射（无有效字幕索引）');
          continue;
        }

        const duration = maxEnd - minStart;

        console.log('[SubtitleModeProcessor] 计算ASR时间范围:', {
          minStart,
          maxEnd,
          duration,
          selectedIndices: mapping.subtitleIndices
        });

        if (duration <= 0) {
          console.error('[SubtitleModeProcessor] ⚠️ ASR模式 duration 为负数或零，跳过此映射');
          continue;
        }

        // 获取素材信息
        let materialPath: string;
        let materialDuration: number;

        // 🆕 支持三种素材选择模式
        const selectionMode = mapping.selectionMode || 'specified';

        if (selectionMode === 'specified') {
          // 指定素材模式（原有逻辑）
          materialPath = mapping.materialPath;
          if (mapping.isImage) {
            materialDuration = duration;
          } else {
            materialDuration = await MaterialManager.getVideoDuration(materialPath);
          }
        } else {
          // 随机或顺序模式（从素材文件夹选择）
          if (!mapping.materialFolderPath) {
            console.warn('[SubtitleModeProcessor] 跳过映射：随机/顺序模式下未配置素材文件夹');
            continue;
          }

          const material = await MaterialManager.selectMaterialUnified(
            selectionMode,
            mapping.materialFolderPath,
            undefined
          );

          materialPath = material.path;
          materialDuration = material.duration;
        }

        // 生成替换点
        replacements.push({
          startTime: minStart,
          duration: duration,
          materialPath: materialPath,
          materialDuration: materialDuration,
          materialStartOffset: 0,
          reason: `字幕模式(ASR): "${selectedTexts.join(' ')}"`,
          displayMode: mapping.displayMode ?? 'fullscreen',
          pipPosition: mapping.pipPosition ?? 'bottom-right',
          pipSizePercent: mapping.pipSizePercent ?? 30,
          pipScaleMode: mapping.pipScaleMode ?? 'fit',
          isImage: mapping.isImage,
          originalVideoMinimized: mapping.originalVideoMinimized
        });

        console.log('[SubtitleModeProcessor] 添加替换点(ASR):', {
          startTime: minStart.toFixed(2),
          duration: duration.toFixed(2),
          subtitles: selectedTexts.join(' | '),
          material: materialPath
        });
      }
    }

    // 按时间排序
    return replacements.sort((a, b) => a.startTime - b.startTime);
  }
}
