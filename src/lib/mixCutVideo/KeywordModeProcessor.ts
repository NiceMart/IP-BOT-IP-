/**
 * 关键词模式处理器
 * 功能：解析字幕文件，匹配关键词，生成素材替换点
 */

import type { KeywordModeConfig, KeywordGroup, MaterialReplacement, SubtitleSegment } from './types';
import { MaterialManager } from './MaterialManager';
import { subtitleParseSrtFile } from '../subtitle';

export class KeywordModeProcessor {
  /**
   * 🆕 处理关键词模式混剪（基于 records 数组）
   * @param records ASR 识别结果数组
   * @param keywordConfig 关键词模式配置
   * @param keywordGroups 关键词分组数据
   * @returns 素材替换点数组，按时间排序
   */
  static async processFromRecords(
    records: any[],
    keywordConfig: KeywordModeConfig,
    keywordGroups: KeywordGroup[]
  ): Promise<MaterialReplacement[]> {
    console.log('[KeywordModeProcessor] 开始处理关键词模式混剪（基于 records）', {
      recordsCount: records.length,
      enabledGroupsCount: keywordConfig.groups.filter(g => g.enabled).length,
      totalKeywordGroups: keywordGroups.length
    });

    // 转换 records 为 SubtitleSegment 格式
    const subtitleSegments: SubtitleSegment[] = records.map((record, index) => ({
      index: index + 1,
      startTime: record.start / 1000,  // 毫秒 -> 秒
      endTime: record.end / 1000,       // 毫秒 -> 秒
      text: record.text
    }));

    console.log('[KeywordModeProcessor] 转换了', subtitleSegments.length, '个字幕段');

    // 🆕 检查字幕数据的时间范围
    if (subtitleSegments.length > 0) {
      const lastSegment = subtitleSegments[subtitleSegments.length - 1];
      console.log('[KeywordModeProcessor] 字幕时间范围:', {
        firstSegmentStart: subtitleSegments[0].startTime.toFixed(2),
        lastSegmentEnd: lastSegment.endTime.toFixed(2),
        totalSegments: subtitleSegments.length
      });
    }

    // 复用现有的处理逻辑
    return await this.processSubtitleSegments(subtitleSegments, keywordConfig, keywordGroups);
  }

  /**
   * 处理关键词模式混剪
   * @param subtitleFilePath 字幕文件路径 (SRT格式)
   * @param keywordConfig 关键词模式配置
   * @param keywordGroups 关键词分组数据（从KeywordGroupService获取）
   * @returns 素材替换点数组，按时间排序
   */
  static async process(
    subtitleFilePath: string,
    keywordConfig: KeywordModeConfig,
    keywordGroups: KeywordGroup[]
  ): Promise<MaterialReplacement[]> {
    console.log('[KeywordModeProcessor] 开始处理关键词模式混剪', {
      subtitleFilePath,
      enabledGroupsCount: keywordConfig.groups.filter(g => g.enabled).length,
      totalKeywordGroups: keywordGroups.length
    });

    // 1. 解析字幕文件
    const srtEntries = await subtitleParseSrtFile(subtitleFilePath);
    console.log(`[KeywordModeProcessor] 解析字幕文件完成，共 ${srtEntries.length} 个字幕段`);

    // 转换为 SubtitleSegment 格式（时间从微秒转为秒）
    const subtitleSegments: SubtitleSegment[] = srtEntries.map((entry, index) => ({
      index: index + 1,
      startTime: entry.start / 1000000,  // 微秒 -> 秒
      endTime: entry.end / 1000000,       // 微秒 -> 秒
      text: entry.text
    }));

    // 复用现有的处理逻辑
    return await this.processSubtitleSegments(subtitleSegments, keywordConfig, keywordGroups);
  }

  /**
   * 🆕 核心处理逻辑：基于字幕段数组处理关键词匹配
   * @param subtitleSegments 字幕段数组
   * @param keywordConfig 关键词模式配置
   * @param keywordGroups 关键词分组数据
   * @returns 素材替换点数组
   */
  private static async processSubtitleSegments(
    subtitleSegments: SubtitleSegment[],
    keywordConfig: KeywordModeConfig,
    keywordGroups: KeywordGroup[]
  ): Promise<MaterialReplacement[]> {
    // 🔍 诊断日志：打印前 3 个字幕段
    console.log('[KeywordModeProcessor] 字幕解析诊断（前3段）:', {
      totalSegments: subtitleSegments.length,
      samples: subtitleSegments.slice(0, 3).map(s => ({
        index: s.index,
        startTime: s.startTime.toFixed(3),
        endTime: s.endTime.toFixed(3),
        text: s.text
      }))
    });

    // 2. 构建关键词索引：keyword -> groupId
    const keywordIndex = this.buildKeywordIndex(keywordGroups);
    console.log(`[KeywordModeProcessor] 构建关键词索引完成，共 ${keywordIndex.size} 个关键词`);

    // 3. 遍历字幕段，查找关键词匹配
    const replacements: MaterialReplacement[] = [];

    for (const segment of subtitleSegments) {
      const matchedKeywords = this.findKeywordsInText(segment.text, keywordIndex);

      if (matchedKeywords.length > 0) {
        console.log(`[KeywordModeProcessor] 字幕段 #${segment.index} 匹配到 ${matchedKeywords.length} 个关键词:`, {
          text: segment.text,
          keywords: matchedKeywords.map(m => m.keyword)
        });
      }

      for (const { keyword, groupId, position } of matchedKeywords) {
        // 找到对应的分组配置
        const groupConfig = keywordConfig.groups.find(g => g.groupId === groupId);

        // 🔧 修复：根据 selectionMode 检查不同的素材配置
        if (!groupConfig || !groupConfig.enabled) {
          console.log(`[KeywordModeProcessor] 跳过关键词 "${keyword}"：分组不存在或未启用`, {
            groupId,
            enabled: groupConfig?.enabled
          });
          continue;
        }

        const selectionMode = groupConfig.selectionMode || 'random';
        const hasMaterial = selectionMode === 'specified'
          ? !!groupConfig.specifiedMaterialPath
          : !!groupConfig.materialFolderPath;

        if (!hasMaterial) {
          console.log(`[KeywordModeProcessor] 跳过关键词 "${keyword}"：未配置素材`, {
            groupId,
            selectionMode,
            hasFolder: !!groupConfig.materialFolderPath,
            hasSpecified: !!groupConfig.specifiedMaterialPath
          });
          continue;
        }

        try {
          // 🔧 修复：根据关键词在字幕中的位置，估算实际出现时间
          // 而不是简单地使用字幕段的开始时间
          const segmentDuration = segment.endTime - segment.startTime;
          const textLength = segment.text.length;
          const keywordPositionRatio = position / textLength;  // 关键词位置占比
          const estimatedOffset = segmentDuration * keywordPositionRatio;  // 估算偏移
          const actualStartTime = segment.startTime + estimatedOffset;  // 实际触发时间

          console.log(`[KeywordModeProcessor] 关键词 "${keyword}" 位置估算:`, {
            segmentStart: segment.startTime.toFixed(2),
            segmentEnd: segment.endTime.toFixed(2),
            segmentDuration: segmentDuration.toFixed(2),
            textLength,
            keywordPosition: position,
            positionRatio: (keywordPositionRatio * 100).toFixed(1) + '%',
            estimatedOffset: estimatedOffset.toFixed(2),
            actualStartTime: actualStartTime.toFixed(2)
          });

          // 🆕 使用统一素材选择方法
          const material = await MaterialManager.selectMaterialUnified(
            groupConfig.selectionMode,
            groupConfig.materialFolderPath,
            groupConfig.specifiedMaterialPath
          );

          // 🔧 智能时长计算：
          // - 图片：使用配置的最大时长
          // - 视频：使用视频本身的时长，但不超过配置的最大时长
          let duration: number;
          if (material.isImage) {
            // 图片：直接使用最大时长
            duration = groupConfig.durationMax;
            console.log(`[KeywordModeProcessor] 图片素材，使用配置的最大时长: ${duration.toFixed(2)} 秒`);
          } else {
            // 视频：取视频时长和最大时长中的较小值
            duration = Math.min(material.duration, groupConfig.durationMax);
            console.log(`[KeywordModeProcessor] 视频素材，时长: ${material.duration.toFixed(2)} 秒，最大限制: ${groupConfig.durationMax.toFixed(2)} 秒，实际使用: ${duration.toFixed(2)} 秒`);
          }

          // 生成替换点（使用估算的实际出现时间）
          const replacement: MaterialReplacement = {
            startTime: actualStartTime,        // 🔧 使用估算的实际时间
            duration,                          // 随机时长
            materialPath: material.path,
            materialDuration: material.duration,
            materialStartOffset: 0,
            reason: `关键词: ${keyword} (分组: ${groupConfig.groupName})`,

            // 画中画配置（使用配置或默认值）
            displayMode: groupConfig.displayMode ?? 'fullscreen',
            pipPosition: groupConfig.pipPosition ?? 'bottom-right',
            pipSizePercent: groupConfig.pipSizePercent ?? 30,
            pipScaleMode: groupConfig.pipScaleMode ?? 'fit',
            isImage: material.isImage,
            // 🆕 新增：传递原视频最小化配置
            originalVideoMinimized: groupConfig.originalVideoMinimized
          };

          replacements.push(replacement);

          console.log('[KeywordModeProcessor] 生成替换点:', {
            keyword,
            groupName: groupConfig.groupName,
            startTime: actualStartTime.toFixed(2),  // 🔧 修复：打印实际的 startTime，而不是 segment.startTime
            duration: duration.toFixed(2),
            materialPath: material.path,
            displayMode: replacement.displayMode
          });
        } catch (error) {
          console.error(`[KeywordModeProcessor] 处理关键词 "${keyword}" 时出错:`, error);
          // 继续处理其他关键词
        }
      }
    }

    // 4. 按时间排序（后触发的会覆盖前者，FFmpeg overlay会自动处理）
    replacements.sort((a, b) => a.startTime - b.startTime);

    console.log(`[KeywordModeProcessor] 处理完成，生成 ${replacements.length} 个替换点`);

    return replacements;
  }

  /**
   * 构建关键词索引
   * @param keywordGroups 关键词分组数据
   * @returns Map<关键词, 分组ID>
   */
  private static buildKeywordIndex(keywordGroups: KeywordGroup[]): Map<string, string> {
    const keywordIndex = new Map<string, string>();

    for (const group of keywordGroups) {
      if (!group.keywords || !Array.isArray(group.keywords)) {
        continue;
      }

      for (const keywordItem of group.keywords) {
        // 处理两种格式：KeywordItem[] 或 string[]
        const keyword = typeof keywordItem === 'string'
          ? keywordItem
          : (keywordItem as any).keyword;

        if (keyword && typeof keyword === 'string') {
          keywordIndex.set(keyword, group.id);
        }
      }
    }

    return keywordIndex;
  }

  /**
   * 在文本中查找关键词（精确匹配）
   * @param text 字幕文本
   * @param keywordIndex 关键词索引
   * @returns 匹配到的关键词列表（包含位置信息）
   */
  private static findKeywordsInText(
    text: string,
    keywordIndex: Map<string, string>
  ): Array<{ keyword: string; groupId: string; position: number }> {
    const matches: Array<{ keyword: string; groupId: string; position: number }> = [];

    // 遍历所有关键词，检查是否出现在文本中（精确匹配）
    for (const [keyword, groupId] of keywordIndex) {
      const position = text.indexOf(keyword);
      if (position !== -1) {
        // 🔧 修复：记录关键词在文本中的位置（字符索引）
        matches.push({ keyword, groupId, position });
      }
    }

    return matches;
  }

  /**
   * 在指定范围内生成随机数
   * @param min 最小值
   * @param max 最大值
   * @returns 随机数
   */
  private static randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
