/**
 * 智能字幕处理服务
 * 在 VideoIPAgent.vue 中使用
 */

import { subtitleProcessor } from '../lib/smartSubtitle/SubtitleProcessor';
import { keywordGroupManager } from '../lib/smartSubtitle/KeywordGroupManager';
import type { SubtitleProcessConfig, ProcessedSubtitle, KeywordGroup } from '../types/smartSubtitle';

/**
 * 处理智能字幕
 */
export async function processSmartSubtitle(
  text: string,
  config: SubtitleProcessConfig
): Promise<ProcessedSubtitle> {
  try {
    console.log('[SmartSubtitleService] 开始处理智能字幕');
    console.log('[SmartSubtitleService] 文本:', text);
    console.log('[SmartSubtitleService] 配置:', config);

    // 调用主处理器
    const result = await subtitleProcessor.processSubtitle(text, config);

    console.log('[SmartSubtitleService] 处理完成');
    console.log('[SmartSubtitleService] 排版行数:', result.layout.lineCount);
    console.log('[SmartSubtitleService] 分类词汇:', result.classification.statistics.totalWords);
    console.log('[SmartSubtitleService] 分批数量:', result.batches.length);
    console.log('[SmartSubtitleService] 总特效数:', result.effectAssignments.length);
    console.log('[SmartSubtitleService] 处理耗时:', result.processingTime.toFixed(2), 'ms');

    return result;
  } catch (error) {
    console.error('[SmartSubtitleService] 处理失败:', error);
    throw error;
  }
}

/**
 * 快速处理智能字幕（不使用AI）
 */
export function processSmartSubtitleQuick(
  text: string,
  config: SubtitleProcessConfig
): ProcessedSubtitle {
  try {
    console.log('[SmartSubtitleService] 快速处理字幕...');

    const result = subtitleProcessor.processQuick(text, config);

    console.log('[SmartSubtitleService] 快速处理完成');
    console.log('[SmartSubtitleService] 耗时:', result.processingTime.toFixed(2), 'ms');

    return result;
  } catch (error) {
    console.error('[SmartSubtitleService] 快速处理失败:', error);
    throw error;
  }
}

/**
 * 获取推荐配置
 */
export function getRecommendedConfig(
  screenWidth: number,
  screenHeight: number
): SubtitleProcessConfig {
  return subtitleProcessor.getRecommendedConfig(screenWidth, screenHeight);
}

/**
 * 验证处理结果
 */
export function validateResult(result: ProcessedSubtitle): {
  valid: boolean;
  issues: string[];
} {
  return subtitleProcessor.validateResult(result);
}

/**
 * 导出结果为JSON
 */
export function exportResultAsJSON(result: ProcessedSubtitle): string {
  return subtitleProcessor.exportAsJSON(result);
}

/**
 * 生成处理统计报告
 */
export function generateStatisticsReport(result: ProcessedSubtitle): string {
  const stats = {
    文本长度: result.originalText.length,
    排版行数: result.layout.lineCount,
    分类词汇: result.classification.statistics.totalWords,
    分批数量: result.batches.length,
    总特效数: result.effectAssignments.length,
    动画冲突: result.animationTimeline.conflicts.length,
    总时长: `${result.totalDuration}ms`,
    处理耗时: `${result.processingTime.toFixed(2)}ms`,
    是否有效: result.isValid ? '✓' : '✗',
    警告数: result.warnings.length,
    错误数: result.errors.length
  };

  let report = '=== 智能字幕处理统计报告 ===\n\n';

  for (const [key, value] of Object.entries(stats)) {
    report += `${key}: ${value}\n`;
  }

  if (result.warnings.length > 0) {
    report += '\n=== 警告信息 ===\n';
    result.warnings.forEach(w => {
      report += `⚠️ ${w}\n`;
    });
  }

  if (result.errors.length > 0) {
    report += '\n=== 错误信息 ===\n';
    result.errors.forEach(e => {
      report += `❌ ${e}\n`;
    });
  }

  return report;
}

/**
 * 生成字幕摘要（用于UI显示）
 */
export function generateSubtitleSummary(result: ProcessedSubtitle): string {
  const lines = [];

  // 排版信息
  if (result.layout.lineCount > 0) {
    lines.push(`📝 排版: ${result.layout.lineCount}行，宽${result.layout.totalWidth.toFixed(0)}px`);
  }

  // 分类信息
  const categoryDist = result.classification.statistics.categoryDistribution;
  const categories = Object.entries(categoryDist)
    .filter(([_, count]) => count > 0)
    .map(([cat, count]) => `${cat}(${count})`)
    .join(', ');
  if (categories) {
    lines.push(`🏷️  分类: ${categories}`);
  }

  // 分批信息
  if (result.batches.length > 1) {
    const avgDuration = result.batches.reduce((sum, b) => sum + b.duration, 0) / result.batches.length;
    lines.push(`📊 分批: ${result.batches.length}批，平均时长${avgDuration.toFixed(0)}ms`);
  }

  // 特效信息
  if (result.effectAssignments.length > 0) {
    const effectCount = result.effectAssignments.reduce((sum, a) => sum + a.selectedEffects.length, 0);
    lines.push(`✨ 特效: ${effectCount}个`);
  }

  // 动画信息
  if (result.animationTimeline.conflicts.length > 0) {
    lines.push(`⚠️  动画冲突: ${result.animationTimeline.conflicts.length}个`);
  } else {
    lines.push(`✅ 动画冲突: 0个`);
  }

  // 时长信息
  const seconds = result.totalDuration / 1000;
  lines.push(`⏱️  总时长: ${seconds.toFixed(2)}s`);

  return lines.join(' | ');
}

/**
 * 关键词分组持久化相关方法
 */

/**
 * 获取所有关键词分组
 */
export function getAllKeywordGroups(): KeywordGroup[] {
  return keywordGroupManager.getAllGroups();
}

/**
 * 保存或更新关键词分组
 */
export function saveKeywordGroup(group: KeywordGroup): void {
  const existing = keywordGroupManager.getGroup(group.id);
  if (existing) {
    keywordGroupManager.updateGroup(group.id, group);
  } else {
    keywordGroupManager.addGroup(group);
  }
  console.log(`[SmartSubtitleService] 关键词分组已保存: ${group.name}`);
}

/**
 * 删除关键词分组
 */
export function deleteKeywordGroup(groupId: string): boolean {
  return keywordGroupManager.deleteGroup(groupId);
}

/**
 * 查询关键词所属的分组
 */
export function queryKeywordGroup(keyword: string) {
  return keywordGroupManager.queryKeyword(keyword);
}

/**
 * 批量查询关键词所属的分组
 */
export function queryKeywordGroupBatch(keywords: string[]) {
  return keywordGroupManager.queryKeywords(keywords);
}

/**
 * 将关键词分组序列化为JSON字符串（用于保存到数据库）
 */
export function serializeKeywordGroups(): string {
  const groups = keywordGroupManager.getAllGroups();
  return JSON.stringify(groups);
}

/**
 * 从JSON字符串反序列化关键词分组（从数据库加载）
 */
export function deserializeKeywordGroups(jsonStr: string): KeywordGroup[] {
  try {
    const groups = JSON.parse(jsonStr) as KeywordGroup[];
    return groups;
  } catch (error) {
    console.error('[SmartSubtitleService] 反序列化关键词分组失败:', error);
    return [];
  }
}

/**
 * 从JSON字符串加载关键词分组到内存
 */
export function loadKeywordGroupsFromJSON(jsonStr: string): void {
  try {
    const groups = deserializeKeywordGroups(jsonStr);
    keywordGroupManager.clear();
    groups.forEach(group => {
      keywordGroupManager.addGroup(group);
    });
    console.log(`[SmartSubtitleService] 已从JSON加载${groups.length}个关键词分组`);
  } catch (error) {
    console.error('[SmartSubtitleService] 加载关键词分组失败:', error);
  }
}

/**
 * 获取关键词分组统计信息
 */
export function getKeywordGroupStatistics() {
  return keywordGroupManager.getStatistics();
}
