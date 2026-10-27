/**
 * 分批展示管理器 - BatchDisplayManager
 * 根据文本长度和屏幕容量决定分批策略
 */

import {
  TextBatch,
  BatchStrategy,
  BatchConfig
} from '../../types/smartSubtitle';

export interface BatchDisplayOptions {
  readabilityFactor?: number;  // 0.5-2.0，默认1.0
  preferredBatchSize?: number; // 优选批次大小
  totalSoundDuration?: number; // 音频总时长 (ms)
}

/**
 * 分批展示管理器
 */
export class BatchDisplayManager {
  /**
   * 默认配置
   */
  private static readonly DEFAULT_MIN_BATCH_SIZE = 10;
  private static readonly DEFAULT_MAX_BATCH_SIZE = 20;
  private static readonly DEFAULT_MIN_DURATION = 500;
  private static readonly DEFAULT_MAX_DURATION = 3000;
  private static readonly DEFAULT_BATCH_INTERVAL = 300;

  /**
   * 计算文本的分批方案
   */
  calculateBatchConfig(
    text: string,
    options: BatchDisplayOptions = {}
  ): BatchConfig {
    const startTime = performance.now();

    // 1. 确定分批策略
    const textLength = text.length;
    const strategy = this.determineBatchStrategy(textLength);

    // 2. 生成批次
    const batches = this.generateBatches(text, strategy, options);

    // 3. 计算总时长
    const totalDuration = batches.reduce((sum, batch) => {
      return sum + batch.duration + batch.displayInterval;
    }, 0);

    const processingTime = performance.now() - startTime;
    console.log(`[BatchDisplayManager] 分批计算耗时: ${processingTime.toFixed(2)}ms`);

    return {
      strategy,
      batches,
      totalDuration,
      readabilityFactor: options.readabilityFactor || 1.0
    };
  }

  /**
   * 判断分批策略
   */
  private determineBatchStrategy(textLength: number): BatchStrategy {
    if (textLength < 20) {
      return BatchStrategy.SINGLE;
    } else if (textLength < 40) {
      return BatchStrategy.MULTI;
    } else {
      return BatchStrategy.LONG;
    }
  }

  /**
   * 生成批次数组
   */
  private generateBatches(
    text: string,
    strategy: BatchStrategy,
    options: BatchDisplayOptions
  ): TextBatch[] {
    const batches: TextBatch[] = [];

    switch (strategy) {
      case BatchStrategy.SINGLE:
        return this.generateSingleBatch(text, options);

      case BatchStrategy.MULTI:
        return this.generateMultiBatches(text, 2, options);

      case BatchStrategy.LONG:
        return this.generateLongBatches(text, options);

      default:
        return this.generateMultiBatches(text, 2, options);
    }
  }

  /**
   * 生成单批次（短文本）
   * 策略：一次性展示，动画时长基于字数
   */
  private generateSingleBatch(
    text: string,
    options: BatchDisplayOptions
  ): TextBatch[] {
    const readabilityFactor = options.readabilityFactor || 1.0;

    // 计算动画时长：字数 * 60ms，限制在100-2000ms
    const baseDuration = text.length * 60 * readabilityFactor;
    const duration = Math.max(100, Math.min(2000, baseDuration));

    return [
      {
        content: text,
        index: 0,
        totalBatches: 1,
        duration,
        displayInterval: 0,
        startTime: 0,
        endTime: duration
      }
    ];
  }

  /**
   * 生成多批次（中等文本）
   */
  private generateMultiBatches(
    text: string,
    defaultBatchCount: number,
    options: BatchDisplayOptions
  ): TextBatch[] {
    const batches: TextBatch[] = [];
    const readabilityFactor = options.readabilityFactor || 1.0;

    // 按标点符号分割文本
    const segments = this.splitByPunctuation(text);
    const actualBatchCount = Math.max(1, Math.min(segments.length, defaultBatchCount + 1));

    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const baseDuration = segment.length * 60 * readabilityFactor;
      const duration = Math.max(500, Math.min(1500, baseDuration));

      const batch: TextBatch = {
        content: segment,
        index: i,
        totalBatches: segments.length,
        duration,
        displayInterval: i < segments.length - 1 ? 500 : 0,
        startTime: currentTime,
        endTime: currentTime + duration
      };

      batches.push(batch);
      currentTime += duration + batch.displayInterval;
    }

    return batches;
  }

  /**
   * 生成长批次（长文本）
   * 策略：根据屏幕宽度和可读性因子动态调整
   */
  private generateLongBatches(
    text: string,
    options: BatchDisplayOptions
  ): TextBatch[] {
    const batches: TextBatch[] = [];
    const readabilityFactor = options.readabilityFactor || 1.0;

    // 按标点符号优先分割
    const segments = this.splitByPunctuation(text);

    // 如果单个分段还是太长，再进行细分
    const finalSegments: string[] = [];
    for (const segment of segments) {
      if (segment.length > BatchDisplayManager.DEFAULT_MAX_BATCH_SIZE) {
        // 进一步分割
        finalSegments.push(...this.splitLongSegment(
          segment,
          BatchDisplayManager.DEFAULT_MAX_BATCH_SIZE
        ));
      } else {
        finalSegments.push(segment);
      }
    }

    let currentTime = 0;

    for (let i = 0; i < finalSegments.length; i++) {
      const segment = finalSegments[i];
      const baseDuration = segment.length * 60 * readabilityFactor;
      const duration = Math.max(300, Math.min(2000, baseDuration));

      // 批次间隔随可读性因子变化
      const displayInterval = i < finalSegments.length - 1
        ? Math.max(200, Math.min(800, 300 * readabilityFactor))
        : 0;

      const batch: TextBatch = {
        content: segment,
        index: i,
        totalBatches: finalSegments.length,
        duration,
        displayInterval,
        startTime: currentTime,
        endTime: currentTime + duration
      };

      batches.push(batch);
      currentTime += duration + displayInterval;
    }

    return batches;
  }

  /**
   * 按标点符号分割文本
   */
  private splitByPunctuation(text: string): string[] {
    const segments: string[] = [];
    let currentSegment = '';
    const punctuations = ['。', '！', '？', ',', '.', '!', '?'];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      currentSegment += char;

      if (punctuations.includes(char)) {
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
        }
        currentSegment = '';
      }
    }

    // 添加最后一段
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    // 如果没有标点符号，按固定长度分割
    if (segments.length === 0) {
      return this.splitByLength(text, 20);
    }

    return segments;
  }

  /**
   * 分割过长的分段
   */
  private splitLongSegment(segment: string, maxLength: number): string[] {
    const result: string[] = [];
    let currentSegment = '';

    for (const char of segment) {
      currentSegment += char;

      if (currentSegment.length >= maxLength) {
        result.push(currentSegment);
        currentSegment = '';
      }
    }

    if (currentSegment) {
      result.push(currentSegment);
    }

    return result;
  }

  /**
   * 按长度分割文本
   */
  private splitByLength(text: string, length: number): string[] {
    const result: string[] = [];

    for (let i = 0; i < text.length; i += length) {
      result.push(text.slice(i, i + length));
    }

    return result;
  }

  /**
   * 根据音频时长调整批次
   */
  adjustBatchesByAudioDuration(
    batches: TextBatch[],
    totalAudioDuration: number
  ): TextBatch[] {
    if (batches.length === 0 || totalAudioDuration <= 0) {
      return batches;
    }

    // 计算当前总时长
    const currentTotalDuration = batches.reduce((sum, batch) => {
      return sum + batch.duration + batch.displayInterval;
    }, 0);

    // 计算缩放因子
    const scaleFactor = totalAudioDuration / currentTotalDuration;

    // 如果缩放因子接近1.0，不需要调整
    if (Math.abs(scaleFactor - 1.0) < 0.1) {
      return batches;
    }

    // 调整每个批次的时长
    return batches.map((batch, index) => {
      const newDuration = Math.max(100, batch.duration * scaleFactor);
      const newInterval = index < batches.length - 1
        ? Math.max(50, batch.displayInterval * scaleFactor)
        : 0;

      return {
        ...batch,
        duration: newDuration,
        displayInterval: newInterval
      };
    });
  }

  /**
   * 合并相邻的短批次
   */
  mergeShorBatches(batches: TextBatch[], minDuration: number = 300): TextBatch[] {
    if (batches.length <= 1) {
      return batches;
    }

    const result: TextBatch[] = [];
    let currentBatch = { ...batches[0] };

    for (let i = 1; i < batches.length; i++) {
      const nextBatch = batches[i];

      if (currentBatch.duration < minDuration) {
        // 合并
        currentBatch.content += nextBatch.content;
        currentBatch.duration += nextBatch.duration;
        currentBatch.displayInterval = nextBatch.displayInterval;
      } else {
        // 保存当前批次，开始新批次
        result.push(currentBatch);
        currentBatch = { ...nextBatch };
      }
    }

    result.push(currentBatch);

    // 更新索引和总数
    return result.map((batch, index) => ({
      ...batch,
      index,
      totalBatches: result.length
    }));
  }

  /**
   * 计算最优的可读性因子
   */
  calculateOptimalReadabilityFactor(
    textLength: number,
    screenWidth: number,
    availableTime: number
  ): number {
    // 基础阅读速度：每秒10个字符
    const baseReadSpeed = 10;
    const estimatedTime = textLength / baseReadSpeed;

    // 如果估计时间超过可用时间，降低可读性因子
    if (estimatedTime > availableTime) {
      return Math.max(0.5, availableTime / estimatedTime);
    }

    // 如果有充足时间，提高可读性因子
    if (estimatedTime < availableTime * 0.5) {
      return Math.min(2.0, availableTime / estimatedTime);
    }

    return 1.0;
  }

  /**
   * 获取分批统计信息
   */
  getStatistics(batches: TextBatch[]): {
    totalBatches: number;
    totalDuration: number;
    averageDuration: number;
    averageInterval: number;
    minDuration: number;
    maxDuration: number;
  } {
    if (batches.length === 0) {
      return {
        totalBatches: 0,
        totalDuration: 0,
        averageDuration: 0,
        averageInterval: 0,
        minDuration: 0,
        maxDuration: 0
      };
    }

    const durations = batches.map(b => b.duration);
    const intervals = batches.map(b => b.displayInterval);

    const totalDuration = batches.reduce((sum, b) => sum + b.duration + b.displayInterval, 0);

    return {
      totalBatches: batches.length,
      totalDuration,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      averageInterval: intervals.reduce((a, b) => a + b, 0) / intervals.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }
}

/**
 * 导出单例实例
 */
export const batchDisplayManager = new BatchDisplayManager();
