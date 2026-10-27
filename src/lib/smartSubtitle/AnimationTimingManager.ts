/**
 * 动画时长管理器 - AnimationTimingManager
 * 建立动画时间线，检测和解决动画冲突
 */

import {
  AnimationConflict,
  AnimationTimeline,
  AnimationTimelineEvent,
  ConflictType,
  ConflictResolution,
  EffectConfig,
  ClassifiedWord
} from '../../types/smartSubtitle';

export interface AnimationTimingOptions {
  maxConcurrentEffects?: number;  // 最多并行特效数
  minTransitionTime?: number;     // 最小过渡时间 (ms)
  overlapThreshold?: number;      // 重叠阈值 (0-1)
}

/**
 * 动画时长管理器
 */
export class AnimationTimingManager {
  private static readonly DEFAULT_MAX_CONCURRENT = 3;
  private static readonly DEFAULT_MIN_TRANSITION = 100;
  private static readonly DEFAULT_OVERLAP_THRESHOLD = 0.3; // 30%

  /**
   * 构建完整的动画时间线
   */
  buildAnimationTimeline(
    words: ClassifiedWord[],
    wordEffects: Array<{ word: ClassifiedWord; effects: EffectConfig[] }>,
    options: AnimationTimingOptions = {}
  ): AnimationTimeline {
    const startTime = performance.now();

    // 1. 生成初始事件
    const events = this.generateTimelineEvents(wordEffects);

    // 2. 检测冲突
    const conflicts = this.detectConflicts(events, options);

    // 3. 解决冲突
    const resolutions = this.resolveConflicts(events, conflicts, options);

    // 4. 应用解决方案
    this.applyResolutions(events, resolutions);

    // 5. 计算总时长
    const totalDuration = events.length > 0
      ? Math.max(...events.map(e => e.effect.delay + e.effect.duration))
      : 0;

    const processingTime = performance.now() - startTime;
    console.log(`[AnimationTimingManager] 时间线构建耗时: ${processingTime.toFixed(2)}ms`);

    return {
      events,
      conflicts,
      resolutions,
      totalDuration
    };
  }

  /**
   * 生成时间线事件
   */
  private generateTimelineEvents(
    wordEffects: Array<{ word: ClassifiedWord; effects: EffectConfig[] }>
  ): AnimationTimelineEvent[] {
    const events: AnimationTimelineEvent[] = [];
    let wordIndex = 0;

    for (const { word, effects } of wordEffects) {
      let eventStartTime = 0;

      for (const effect of effects) {
        // 开始事件
        events.push({
          time: eventStartTime + effect.delay,
          wordIndex,
          effect,
          action: 'start'
        });

        // 结束事件
        events.push({
          time: eventStartTime + effect.delay + effect.duration,
          wordIndex,
          effect,
          action: 'end'
        });

        eventStartTime += effect.duration + 100; // 100ms间隔
      }

      wordIndex++;
    }

    // 按时间排序
    events.sort((a, b) => a.time - b.time);

    return events;
  }

  /**
   * 检测动画冲突
   */
  private detectConflicts(
    events: AnimationTimelineEvent[],
    options: AnimationTimingOptions
  ): AnimationConflict[] {
    const conflicts: AnimationConflict[] = [];
    const maxConcurrent = options.maxConcurrentEffects || AnimationTimingManager.DEFAULT_MAX_CONCURRENT;
    const minTransition = options.minTransitionTime || AnimationTimingManager.DEFAULT_MIN_TRANSITION;
    const overlapThreshold = options.overlapThreshold || AnimationTimingManager.DEFAULT_OVERLAP_THRESHOLD;

    // 1. 检测并行特效过多
    const timelineMap = new Map<number, AnimationTimelineEvent[]>();

    for (const event of events) {
      if (!timelineMap.has(event.time)) {
        timelineMap.set(event.time, []);
      }
      timelineMap.get(event.time)!.push(event);
    }

    // 统计每个时刻的活跃特效
    let currentActive: Map<number, EffectConfig> = new Map();

    for (let time = 0; time <= Math.max(...events.map(e => e.time)); time += 50) {
      const activeAtTime: EffectConfig[] = [];

      for (const event of events) {
        if (event.action === 'start' && event.time <= time) {
          const endTime = event.time + event.effect.duration;
          if (endTime >= time) {
            activeAtTime.push(event.effect);
          }
        }
      }

      if (activeAtTime.length > maxConcurrent) {
        conflicts.push({
          type: ConflictType.OVERLAP,
          severity: 'high',
          description: `时间 ${time}ms 有 ${activeAtTime.length} 个并行特效，超过限制 ${maxConcurrent}`,
          affectedWords: [],
          overlapPercentage: (activeAtTime.length / maxConcurrent) * 100
        });
      }
    }

    // 2. 检测过快过渡
    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i];
      const next = events[i + 1];

      if (current.action === 'end' && next.action === 'start') {
        const gap = next.time - current.time;

        if (gap < minTransition) {
          conflicts.push({
            type: ConflictType.RAPID_TRANSITION,
            severity: 'medium',
            description: `特效${current.wordIndex}和${next.wordIndex}之间间隔仅${gap}ms，过快`,
            affectedWords: []
          });
        }
      }
    }

    // 3. 检测不兼容的特效
    const effectCombinations = this.findEffectCombinations(events);

    for (const combo of effectCombinations) {
      if (!this.areEffectsCompatible(combo.effect1, combo.effect2)) {
        conflicts.push({
          type: ConflictType.INCOMPATIBLE_EFFECTS,
          severity: 'medium',
          description: `${combo.effect1.type} 和 ${combo.effect2.type} 不兼容`,
          affectedWords: []
        });
      }
    }

    return conflicts;
  }

  /**
   * 查找特效组合
   */
  private findEffectCombinations(
    events: AnimationTimelineEvent[]
  ): Array<{ effect1: EffectConfig; effect2: EffectConfig }> {
    const combinations: Array<{ effect1: EffectConfig; effect2: EffectConfig }> = [];
    const activeEffects: Map<number, EffectConfig[]> = new Map();

    // 构建每个时刻的活跃特效列表
    for (const event of events) {
      if (event.action === 'start') {
        const endTime = event.time + event.effect.duration;

        for (let time = event.time; time < endTime; time += 50) {
          if (!activeEffects.has(time)) {
            activeEffects.set(time, []);
          }
          activeEffects.get(time)!.push(event.effect);
        }
      }
    }

    // 找出并行的特效组合
    for (const effects of activeEffects.values()) {
      for (let i = 0; i < effects.length - 1; i++) {
        for (let j = i + 1; j < effects.length; j++) {
          combinations.push({
            effect1: effects[i],
            effect2: effects[j]
          });
        }
      }
    }

    return combinations;
  }

  /**
   * 解决冲突
   */
  private resolveConflicts(
    events: AnimationTimelineEvent[],
    conflicts: AnimationConflict[],
    options: AnimationTimingOptions
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = this.createResolution(conflict, options);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * 创建单个冲突的解决方案
   */
  private createResolution(
    conflict: AnimationConflict,
    options: AnimationTimingOptions
  ): ConflictResolution {
    const minTransition = options.minTransitionTime || AnimationTimingManager.DEFAULT_MIN_TRANSITION;

    switch (conflict.type) {
      case ConflictType.OVERLAP:
        // 高重叠：推迟后续特效
        if (conflict.severity === 'high' && conflict.overlapPercentage! > 70) {
          return {
            strategy: 'delay',
            adjustments: []
          };
        }

        // 中等重叠：加速特效
        if (conflict.overlapPercentage! > 30) {
          return {
            strategy: 'accelerate',
            adjustments: []
          };
        }

        // 低重叠：简化特效
        return {
          strategy: 'simplify',
          adjustments: []
        };

      case ConflictType.RAPID_TRANSITION:
        // 过快过渡：推迟后续动画
        return {
          strategy: 'delay',
          adjustments: []
        };

      case ConflictType.INCOMPATIBLE_EFFECTS:
        // 不兼容的特效：移除或替换
        return {
          strategy: 'simplify',
          adjustments: []
        };

      default:
        return {
          strategy: 'delay',
          adjustments: []
        };
    }
  }

  /**
   * 应用解决方案
   */
  private applyResolutions(
    events: AnimationTimelineEvent[],
    resolutions: ConflictResolution[]
  ): void {
    for (const resolution of resolutions) {
      if (resolution.strategy === 'delay') {
        // 推迟后续事件
        let delayAmount = 100;

        for (let i = 0; i < events.length; i++) {
          const event = events[i];

          if (i > 0 && events[i - 1].action === 'end') {
            event.time += delayAmount;
          }
        }
      } else if (resolution.strategy === 'accelerate') {
        // 加速特效（缩短时长）
        for (const event of events) {
          if (event.action === 'start') {
            event.effect.duration *= 0.8; // 缩短到80%
          }
        }
      } else if (resolution.strategy === 'simplify') {
        // 简化特效（移除某些参数）
        for (const event of events) {
          // 移除复杂参数
          if (event.effect.parameters) {
            event.effect.parameters = {};
          }
        }
      }
    }
  }

  /**
   * 检查两个特效是否兼容
   */
  private areEffectsCompatible(effect1: EffectConfig, effect2: EffectConfig): boolean {
    // 同类特效不兼容
    const incompatiblePairs = [
      ['slide-in-up', 'fade-in-smooth'],
      ['pulse-scale', 'bounce-spring'],
      ['motion-blur', 'gradient-reveal']
    ];

    for (const [a, b] of incompatiblePairs) {
      if ((effect1.type === a && effect2.type === b) ||
          (effect1.type === b && effect2.type === a)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算特效之间的时间间隔
   */
  calculateTimeGaps(
    events: AnimationTimelineEvent[]
  ): Array<{ gap: number; fromWord: number; toWord: number }> {
    const gaps: Array<{ gap: number; fromWord: number; toWord: number }> = [];

    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i];

      if (current.action === 'end') {
        // 找到下一个开始事件
        for (let j = i + 1; j < events.length; j++) {
          const next = events[j];

          if (next.action === 'start') {
            const gap = next.time - current.time;
            gaps.push({
              gap,
              fromWord: current.wordIndex,
              toWord: next.wordIndex
            });
            break;
          }
        }
      }
    }

    return gaps;
  }

  /**
   * 优化时间线（合并相近的事件）
   */
  optimizeTimeline(events: AnimationTimelineEvent[], tolerance: number = 50): AnimationTimelineEvent[] {
    if (events.length <= 1) {
      return events;
    }

    const optimized: AnimationTimelineEvent[] = [];
    let prevEvent = events[0];

    for (let i = 1; i < events.length; i++) {
      const currentEvent = events[i];

      // 检查是否可以合并
      if (Math.abs(currentEvent.time - prevEvent.time) <= tolerance &&
          currentEvent.action === 'start' &&
          prevEvent.action === 'end') {
        // 合并：把currentEvent的时间改为prevEvent的结束时间
        currentEvent.time = prevEvent.time + prevEvent.effect.duration;
      }

      optimized.push(currentEvent);
      prevEvent = currentEvent;
    }

    return optimized;
  }

  /**
   * 获取统计信息
   */
  getStatistics(timeline: AnimationTimeline): {
    totalEvents: number;
    totalConflicts: number;
    totalDuration: number;
    avgEffectDuration: number;
    conflictDensity: number;
  } {
    const avgEffectDuration = timeline.events.length > 0
      ? timeline.events
          .filter(e => e.action === 'start')
          .reduce((sum, e) => sum + e.effect.duration, 0) /
        timeline.events.filter(e => e.action === 'start').length
      : 0;

    return {
      totalEvents: timeline.events.length,
      totalConflicts: timeline.conflicts.length,
      totalDuration: timeline.totalDuration,
      avgEffectDuration,
      conflictDensity: timeline.conflicts.length / (timeline.totalDuration / 1000)
    };
  }
}

/**
 * 导出单例实例
 */
export const animationTimingManager = new AnimationTimingManager();
