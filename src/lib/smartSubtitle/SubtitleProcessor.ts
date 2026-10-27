/**
 * 主编排器 - SubtitleProcessor
 * 协调所有子模块，编排完整的字幕处理流程
 */

import { textLayoutEngine, TextLayoutEngine } from './TextLayoutEngine';
import { batchDisplayManager, BatchDisplayManager, BatchDisplayOptions } from './BatchDisplayManager';
import { vocabularyClassifier, VocabularyClassifier } from './VocabularyClassifier';
import { effectMappingManager, EffectMappingManager } from './EffectMappingManager';
import { animationTimingManager, AnimationTimingManager } from './AnimationTimingManager';
import { screenAdaptationManager, ScreenAdaptationManager } from './ScreenAdaptationManager';
import {
  ProcessedSubtitle,
  SubtitleProcessConfig,
  ScreenConfig,
  TextLayout,
  TextBatch,
  VocabularyClassificationResult,
  WordEffectAssignment,
  AnimationTimeline,
  AnalysisStatistics
} from '../../types/smartSubtitle';

/**
 * 主编排器 - 调度所有处理模块
 */
export class SubtitleProcessor {
  private textLayoutEngine: TextLayoutEngine;
  private batchDisplayManager: BatchDisplayManager;
  private vocabularyClassifier: VocabularyClassifier;
  private effectMappingManager: EffectMappingManager;
  private animationTimingManager: AnimationTimingManager;
  private screenAdaptationManager: ScreenAdaptationManager;

  constructor() {
    this.textLayoutEngine = textLayoutEngine;
    this.batchDisplayManager = batchDisplayManager;
    this.vocabularyClassifier = vocabularyClassifier;
    this.effectMappingManager = effectMappingManager;
    this.animationTimingManager = animationTimingManager;
    this.screenAdaptationManager = screenAdaptationManager;
  }

  /**
   * 主处理入口：完整的字幕处理流程
   */
  async processSubtitle(text: string, config: SubtitleProcessConfig): Promise<ProcessedSubtitle> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: 屏幕适配
      console.log('[SubtitleProcessor] Step 1: 屏幕适配...');
      const screenConfig = this.screenAdaptationManager.getScreenConfig({
        screenWidth: config.screenWidth,
        screenHeight: config.screenHeight,
        customConfig: {
          fontSize: config.fontSize,
          maxCharsPerLine: config.maxCharsPerLine,
          maxLines: config.maxLines
        }
      });

      // 验证屏幕配置
      const screenValidation = this.screenAdaptationManager.validateScreenConfig(screenConfig);
      if (!screenValidation.valid) {
        warnings.push(...screenValidation.errors);
      }

      // Step 2: 智能排版
      console.log('[SubtitleProcessor] Step 2: 智能排版...');
      const layout = this.textLayoutEngine.calculateLayout(text, {
        screenConfig,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily
      });

      if (layout.exceedsScreen) {
        warnings.push('文本超出屏幕高度，需要分批展示');
      }

      // Step 3: AI词汇分类
      console.log('[SubtitleProcessor] Step 3: AI词汇分类...');
      const classification = await this.vocabularyClassifier.classify(text);

      // 验证分类结果
      const classificationValidation = this.vocabularyClassifier.validateClassification(classification);
      if (!classificationValidation.valid) {
        warnings.push(...classificationValidation.issues);
      }

      // Step 4: 分批展示
      console.log('[SubtitleProcessor] Step 4: 分批展示...');
      const batchOptions: BatchDisplayOptions = {
        readabilityFactor: config.readabilityFactor || 1.0,
        preferredBatchSize: 15,
        totalSoundDuration: config.screenWidth // 这里应该是实际的音频时长
      };

      const batchConfig = this.batchDisplayManager.calculateBatchConfig(text, batchOptions);
      const batches = batchConfig.batches;

      // Step 5: 特效推荐
      console.log('[SubtitleProcessor] Step 5: 特效推荐...');
      const effectMappingResult = this.effectMappingManager.getRecommendations(
        classification.words
      );

      // 转换为WordEffectAssignment数组
      const effectAssignments = effectMappingResult.assignments;

      if (effectMappingResult.conflicts.length > 0) {
        warnings.push(`检测到 ${effectMappingResult.conflicts.length} 个特效冲突`);
      }

      // Step 6: 动画时间线
      console.log('[SubtitleProcessor] Step 6: 动画时间线...');

      // 准备word-effects对
      const wordEffects = effectAssignments.map(assignment => ({
        word: assignment.word,
        effects: assignment.selectedEffects
      }));

      const animationTimeline = this.animationTimingManager.buildAnimationTimeline(
        classification.words,
        wordEffects,
        {
          maxConcurrentEffects: 3,
          minTransitionTime: 100,
          overlapThreshold: 0.3
        }
      );

      if (animationTimeline.conflicts.length > 0) {
        warnings.push(`检测到 ${animationTimeline.conflicts.length} 个动画冲突`);
      }

      // Step 7: 计算总时长
      console.log('[SubtitleProcessor] Step 7: 计算总时长...');
      const totalDuration = Math.max(
        batchConfig.totalDuration,
        animationTimeline.totalDuration
      );

      // Step 8: 生成结果
      console.log('[SubtitleProcessor] Step 8: 生成结果...');
      const processingTime = performance.now() - startTime;

      // 确定显示模式：如果有特效分配，则仅显示特效字幕
      const hasEffects = effectAssignments.length > 0 &&
                         effectAssignments.some(a => a.selectedEffects.length > 0);
      const displayMode: 'normal' | 'effectOnly' | 'both' = hasEffects ? 'effectOnly' : 'normal';

      const result: ProcessedSubtitle = {
        originalText: text,
        layout,
        classification,
        batches,
        effectAssignments,
        animationTimeline,
        screenConfig,
        totalDuration,
        processingTime,
        displayMode,
        isValid: errors.length === 0,
        warnings,
        errors
      };

      console.log(`[SubtitleProcessor] 处理完成，耗时: ${processingTime.toFixed(2)}ms`);
      console.log(`[SubtitleProcessor] 显示模式: ${displayMode}, 有特效: ${hasEffects}`);
      this.logProcessingStatistics(result);

      return result;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      errors.push(`处理失败: ${error instanceof Error ? error.message : String(error)}`);

      return {
        originalText: text,
        layout: { originalText: text, lines: [], totalWidth: 0, totalHeight: 0, exceedsScreen: false, lineCount: 0 },
        classification: { words: [], statistics: { totalWords: 0, categoryDistribution: {} as any, sentimentDistribution: {} as any } },
        batches: [],
        effectAssignments: [],
        animationTimeline: { events: [], conflicts: [], resolutions: [], totalDuration: 0 },
        screenConfig: {} as ScreenConfig,
        totalDuration: 0,
        processingTime,
        displayMode: 'normal',
        isValid: false,
        warnings,
        errors
      };
    }
  }

  /**
   * 快速处理（不使用AI分类）
   */
  processQuick(text: string, config: SubtitleProcessConfig): ProcessedSubtitle {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 屏幕适配
      const screenConfig = this.screenAdaptationManager.getScreenConfig({
        screenWidth: config.screenWidth,
        screenHeight: config.screenHeight
      });

      // 智能排版
      const layout = this.textLayoutEngine.calculateLayout(text, {
        screenConfig,
        fontSize: config.fontSize,
        fontFamily: config.fontFamily
      });

      // 分批展示
      const batchConfig = this.batchDisplayManager.calculateBatchConfig(text);
      const batches = batchConfig.batches;

      const processingTime = performance.now() - startTime;

      return {
        originalText: text,
        layout,
        classification: { words: [], statistics: { totalWords: 0, categoryDistribution: {} as any, sentimentDistribution: {} as any } },
        batches,
        effectAssignments: [],
        animationTimeline: { events: [], conflicts: [], resolutions: [], totalDuration: 0 },
        screenConfig,
        totalDuration: batchConfig.totalDuration,
        processingTime,
        displayMode: 'normal',
        isValid: errors.length === 0,
        warnings,
        errors
      };
    } catch (error) {
      const processingTime = performance.now() - startTime;
      errors.push(`快速处理失败: ${error instanceof Error ? error.message : String(error)}`);

      return {
        originalText: text,
        layout: { originalText: text, lines: [], totalWidth: 0, totalHeight: 0, exceedsScreen: false, lineCount: 0 },
        classification: { words: [], statistics: { totalWords: 0, categoryDistribution: {} as any, sentimentDistribution: {} as any } },
        batches: [],
        effectAssignments: [],
        animationTimeline: { events: [], conflicts: [], resolutions: [], totalDuration: 0 },
        screenConfig: {} as ScreenConfig,
        totalDuration: 0,
        processingTime,
        displayMode: 'normal',
        isValid: false,
        warnings,
        errors
      };
    }
  }

  /**
   * 仅排版处理（快速布局检查）
   */
  processLayoutOnly(text: string, config: SubtitleProcessConfig): TextLayout {
    const screenConfig = this.screenAdaptationManager.getScreenConfig({
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight
    });

    return this.textLayoutEngine.calculateLayout(text, {
      screenConfig,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily
    });
  }

  /**
   * 仅分类处理（词汇分析）
   */
  async processClassificationOnly(text: string): Promise<VocabularyClassificationResult> {
    return this.vocabularyClassifier.classify(text);
  }

  /**
   * 获取处理统计信息
   */
  private getStatistics(result: ProcessedSubtitle): AnalysisStatistics {
    return {
      textLength: result.originalText.length,
      wordCount: result.classification.words.length,
      lineCount: result.layout.lineCount,
      batchCount: result.batches.length,
      totalEffects: result.effectAssignments.reduce((sum, a) => sum + a.selectedEffects.length, 0),
      totalAnimationDuration: result.animationTimeline.totalDuration,
      averageWordLength: result.originalText.length / (result.classification.words.length || 1),
      maxLineLength: Math.max(...result.layout.lines.map(l => l.text.length))
    };
  }

  /**
   * 打印处理统计信息
   */
  private logProcessingStatistics(result: ProcessedSubtitle): void {
    const stats = this.getStatistics(result);

    console.log('[SubtitleProcessor] 处理统计:');
    console.log(`  文本长度: ${stats.textLength} 字符`);
    console.log(`  词汇总数: ${stats.wordCount}`);
    console.log(`  排版行数: ${stats.lineCount}`);
    console.log(`  分批数量: ${stats.batchCount}`);
    console.log(`  特效总数: ${stats.totalEffects}`);
    console.log(`  动画总时长: ${stats.totalAnimationDuration}ms`);
    console.log(`  处理耗时: ${result.processingTime.toFixed(2)}ms`);

    if (result.errors.length > 0) {
      console.error(`  错误数: ${result.errors.length}`);
      result.errors.forEach(e => console.error(`    - ${e}`));
    }

    if (result.warnings.length > 0) {
      console.warn(`  警告数: ${result.warnings.length}`);
      result.warnings.forEach(w => console.warn(`    - ${w}`));
    }
  }

  /**
   * 验证处理结果
   */
  validateResult(result: ProcessedSubtitle): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查文本是否超出屏幕
    if (result.layout.exceedsScreen && result.batches.length === 0) {
      issues.push('文本超出屏幕但未进行分批处理');
    }

    // 检查批次总时长是否合理
    if (result.totalDuration > 60000) {
      issues.push('总时长超过60秒，可能过长');
    }

    // 检查特效是否过多
    if (result.effectAssignments.length > 100) {
      issues.push(`特效数量过多 (${result.effectAssignments.length})，可能影响性能`);
    }

    // 检查动画冲突
    if (result.animationTimeline.conflicts.length > 5) {
      issues.push(`动画冲突过多 (${result.animationTimeline.conflicts.length})，建议优化`);
    }

    return {
      valid: issues.length === 0 && result.isValid,
      issues
    };
  }

  /**
   * 导出处理结果为JSON
   */
  exportAsJSON(result: ProcessedSubtitle): string {
    return JSON.stringify({
      originalText: result.originalText,
      layout: {
        lineCount: result.layout.lineCount,
        totalWidth: result.layout.totalWidth,
        totalHeight: result.layout.totalHeight,
        exceedsScreen: result.layout.exceedsScreen
      },
      classification: {
        totalWords: result.classification.statistics.totalWords,
        categoryDistribution: result.classification.statistics.categoryDistribution,
        sentimentDistribution: result.classification.statistics.sentimentDistribution
      },
      batchCount: result.batches.length,
      totalDuration: result.totalDuration,
      effectCount: result.effectAssignments.length,
      animationConflicts: result.animationTimeline.conflicts.length,
      processingTime: result.processingTime,
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings
    }, null, 2);
  }

  /**
   * 清除所有缓存
   */
  clearAllCaches(): void {
    this.textLayoutEngine.clearCache();
    this.vocabularyClassifier.clearCache();
  }

  /**
   * 获取处理配置的推荐值
   */
  getRecommendedConfig(screenWidth: number, screenHeight: number): SubtitleProcessConfig {
    const screenConfig = this.screenAdaptationManager.getScreenConfig({
      screenWidth,
      screenHeight
    });

    return {
      screenWidth,
      screenHeight,
      fontSize: screenConfig.fontSize,
      fontFamily: 'Arial, sans-serif',
      maxCharsPerLine: screenConfig.maxCharsPerLine,
      maxLines: screenConfig.maxLines,
      readabilityFactor: 1.0,
      enableEffects: true,
      enableAI: true,
      modelId: 'glm-4-flash',
      subtitlePosition: 'bottom',
      subtitleAlignment: 'center'
    };
  }
}

/**
 * 导出单例实例
 */
export const subtitleProcessor = new SubtitleProcessor();
