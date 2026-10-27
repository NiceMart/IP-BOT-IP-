// @ts-nocheck
/**
 * 特效映射管理器 - EffectMappingManager
 * 将词汇分类映射到特效预设，检查兼容性，解决冲突
 * 集成关键词分组查询，优先使用分组特效
 */

import {
  VocabularyCategory,
  ClassifiedWord,
  EffectType,
  EffectConfig,
  WordEffectAssignment,
  EffectMappingResult
} from '../../types/smartSubtitle';
import { keywordGroupManager } from './KeywordGroupManager';

/**
 * 特效映射规则
 */
interface EffectMappingRule {
  category: VocabularyCategory;
  effects: EffectType[];
  reason: string;
}

/**
 * 特效兼容性规则
 */
interface EffectCompatibility {
  effect1: EffectType;
  effect2: EffectType;
  compatible: boolean;
  reason?: string;
}

/**
 * 特效映射管理器
 */
export class EffectMappingManager {
  /**
   * 词汇分类到特效的映射规则
   */
  private static readonly MAPPING_RULES: EffectMappingRule[] = [
    {
      category: VocabularyCategory.KEYWORD,
      effects: [
        EffectType.PULSE_SCALE,
        EffectType.COLOR_FLASH,
        EffectType.GLOW_EFFECT,
        EffectType.KEYWORD_COMBO
      ],
      reason: '关键词需要脉冲缩放和闪烁效果，吸引注意'
    },
    {
      category: VocabularyCategory.ACTION,
      effects: [
        EffectType.SLIDE_IN_UP,
        EffectType.MOTION_BLUR,
        EffectType.BOUNCE_SPRING,
        EffectType.ACTION_COMBO
      ],
      reason: '行动词需要动态效果，展示动作感'
    },
    {
      category: VocabularyCategory.DESCRIPTION,
      effects: [
        EffectType.FADE_IN_SMOOTH,
        EffectType.GRADIENT_REVEAL,
        EffectType.DESCRIPTION_COMBO
      ],
      reason: '描述词使用平滑淡入和渐变显示，优雅展现'
    },
    {
      category: VocabularyCategory.EMOTION,
      effects: [
        EffectType.HEART_PULSE,
        EffectType.SHAKE_EMOTION,
        EffectType.GLOW_EFFECT,
        EffectType.EMOTION_COMBO
      ],
      reason: '情感词用心跳和抖动，表现情感'
    },
    {
      category: VocabularyCategory.NEUTRAL,
      effects: [],
      reason: '中性词不需要特殊效果'
    }
  ];

  /**
   * 特效兼容性矩阵
   */
  private static readonly COMPATIBILITY_MATRIX: EffectCompatibility[] = [
    // 兼容的组合
    {
      effect1: EffectType.PULSE_SCALE,
      effect2: EffectType.COLOR_FLASH,
      compatible: true,
      reason: '缩放+闪烁是常见的组合'
    },
    {
      effect1: EffectType.SLIDE_IN_UP,
      effect2: EffectType.MOTION_BLUR,
      compatible: true,
      reason: '滑入+模糊效果相得益彰'
    },
    {
      effect1: EffectType.FADE_IN_SMOOTH,
      effect2: EffectType.GRADIENT_REVEAL,
      compatible: true,
      reason: '淡入+渐变显示组合顺畅'
    },
    {
      effect1: EffectType.HEART_PULSE,
      effect2: EffectType.GLOW_EFFECT,
      compatible: true,
      reason: '心跳+发光增强情感表现'
    },
    // 不兼容的组合
    {
      effect1: EffectType.SLIDE_IN_UP,
      effect2: EffectType.FADE_IN_SMOOTH,
      compatible: false,
      reason: '滑入和淡入不应同时使用'
    },
    {
      effect1: EffectType.PULSE_SCALE,
      effect2: EffectType.BOUNCE_SPRING,
      compatible: false,
      reason: '两个缩放效果可能冲突'
    }
  ];

  /**
   * 特效配置预设
   */
  private static readonly EFFECT_PRESETS: Record<EffectType, EffectConfig> = {
    [EffectType.PULSE_SCALE]: {
      type: EffectType.PULSE_SCALE,
      duration: 600,
      delay: 0,
      intensity: 0.8,
      parameters: { minScale: 0.9, maxScale: 1.5 }
    },
    [EffectType.COLOR_FLASH]: {
      type: EffectType.COLOR_FLASH,
      duration: 400,
      delay: 0,
      intensity: 0.9,
      parameters: { flashCount: 2 }
    },
    [EffectType.SLIDE_IN_UP]: {
      type: EffectType.SLIDE_IN_UP,
      duration: 500,
      delay: 0,
      intensity: 0.8,
      parameters: { distance: 50 }
    },
    [EffectType.MOTION_BLUR]: {
      type: EffectType.MOTION_BLUR,
      duration: 400,
      delay: 0,
      intensity: 0.6,
      parameters: { blurAmount: 5 }
    },
    [EffectType.HEART_PULSE]: {
      type: EffectType.HEART_PULSE,
      duration: 1000,
      delay: 0,
      intensity: 0.8,
      parameters: { beats: 2 }
    },
    [EffectType.SHAKE_EMOTION]: {
      type: EffectType.SHAKE_EMOTION,
      duration: 600,
      delay: 0,
      intensity: 0.7,
      parameters: { shakeAmount: 3 }
    },
    [EffectType.FADE_IN_SMOOTH]: {
      type: EffectType.FADE_IN_SMOOTH,
      duration: 800,
      delay: 0,
      intensity: 0.8,
      parameters: { easing: 'easeInOut' }
    },
    [EffectType.GRADIENT_REVEAL]: {
      type: EffectType.GRADIENT_REVEAL,
      duration: 1000,
      delay: 0,
      intensity: 0.8,
      parameters: { direction: 'left-to-right' }
    },
    [EffectType.BOUNCE_SPRING]: {
      type: EffectType.BOUNCE_SPRING,
      duration: 700,
      delay: 0,
      intensity: 0.8,
      parameters: { bounces: 2, tension: 0.5 }
    },
    [EffectType.GLOW_EFFECT]: {
      type: EffectType.GLOW_EFFECT,
      duration: 800,
      delay: 0,
      intensity: 0.7,
      parameters: { glowSize: 10, glowColor: '#FFD700' }
    },
    // 组合特效
    [EffectType.KEYWORD_COMBO]: {
      type: EffectType.KEYWORD_COMBO,
      duration: 800,
      delay: 0,
      intensity: 0.85,
      parameters: { components: [EffectType.PULSE_SCALE, EffectType.COLOR_FLASH] }
    },
    [EffectType.ACTION_COMBO]: {
      type: EffectType.ACTION_COMBO,
      duration: 600,
      delay: 0,
      intensity: 0.8,
      parameters: { components: [EffectType.SLIDE_IN_UP, EffectType.MOTION_BLUR] }
    },
    [EffectType.EMOTION_COMBO]: {
      type: EffectType.EMOTION_COMBO,
      duration: 1000,
      delay: 0,
      intensity: 0.85,
      parameters: { components: [EffectType.HEART_PULSE, EffectType.SHAKE_EMOTION] }
    },
    [EffectType.DESCRIPTION_COMBO]: {
      type: EffectType.DESCRIPTION_COMBO,
      duration: 1000,
      delay: 0,
      intensity: 0.8,
      parameters: { components: [EffectType.FADE_IN_SMOOTH, EffectType.GRADIENT_REVEAL] }
    },
    // 新增扩展特效配置
    [EffectType.PARTICLE_BURST]: {
      type: EffectType.PARTICLE_BURST,
      duration: 900,
      delay: 0,
      intensity: 0.8,
      parameters: { particleCount: 20, spread: 360 }
    },
    [EffectType.MIRROR_FLIP]: {
      type: EffectType.MIRROR_FLIP,
      duration: 800,
      delay: 0,
      intensity: 0.8,
      parameters: { axis: 'y', flipAngle: 180 }
    },
    [EffectType.RAINBOW_GRADIENT]: {
      type: EffectType.RAINBOW_GRADIENT,
      duration: 1200,
      delay: 0,
      intensity: 0.85,
      parameters: { colors: ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] }
    },
    [EffectType.ELECTRIC_SPARK]: {
      type: EffectType.ELECTRIC_SPARK,
      duration: 700,
      delay: 0,
      intensity: 0.75,
      parameters: { sparkCount: 10, sparkLength: 20 }
    },
    [EffectType.WATER_RIPPLE]: {
      type: EffectType.WATER_RIPPLE,
      duration: 1000,
      delay: 0,
      intensity: 0.7,
      parameters: { rippleCount: 3, rippleStrength: 5 }
    },
    [EffectType.GHOST_APPEAR]: {
      type: EffectType.GHOST_APPEAR,
      duration: 1100,
      delay: 0,
      intensity: 0.8,
      parameters: { fadeInDuration: 400, fadeOutDuration: 400 }
    },
    [EffectType.FIRE_EFFECT]: {
      type: EffectType.FIRE_EFFECT,
      duration: 1000,
      delay: 0,
      intensity: 0.85,
      parameters: { flameColor: '#FF4500', flameHeight: 15 }
    },
    [EffectType.ICE_FREEZE]: {
      type: EffectType.ICE_FREEZE,
      duration: 900,
      delay: 0,
      intensity: 0.8,
      parameters: { freezeColor: '#87CEEB', iceShards: 8 }
    }
  };

  /**
   * 为分类词汇分配特效
   */
  assignEffects(words: ClassifiedWord[]): EffectMappingResult {
    const assignments: WordEffectAssignment[] = [];
    const conflicts: string[] = [];
    const globalEffects: EffectConfig[] = [];

    for (const word of words) {
      const assignment = this.assignEffectToWord(word);
      assignments.push(assignment);

      // 检查是否有冲突
      if (!assignment.compatibility) {
        conflicts.push(`词语"${word.text}"的特效不兼容`);
      }
    }

    // 检查全局冲突
    const globalConflicts = this.checkGlobalConflicts(assignments);
    conflicts.push(...globalConflicts);

    return {
      assignments,
      globalEffects,
      conflicts
    };
  }

  /**
   * 为单个词汇分配特效
   */
  private assignEffectToWord(word: ClassifiedWord): WordEffectAssignment {
    // 第一步：优先检查关键词分组中的单个词汇级别的特效
    const keywordGroupQuery = keywordGroupManager.queryKeyword(word.text);
    if (keywordGroupQuery.group) {
      // 🔧 优先检查单个关键词项目的特效配置
      const keywordItem = keywordGroupQuery.group.keywords.find(
        k => k.keyword === word.text
      );

      if (keywordItem && keywordItem.effectId) {
        // 使用单个关键词项目的特效ID和配置
        console.log('[EffectMappingManager] 使用单个关键词项目的特效:', {
          keyword: word.text,
          effectId: keywordItem.effectId,
          effectConfig: keywordItem.effectConfig
        });

        const itemEffect = keywordItem.effectConfig || {
          type: this.getEffectTypeFromId(keywordItem.effectId),
          duration: 1000,
          delay: 0,
          intensity: 0.8
        };

        const selectedEffects: EffectConfig[] = [{ ...itemEffect }];

        // 如果词汇有情感强度，调整强度
        if (word.emotionIntensity !== undefined) {
          selectedEffects[0].intensity = word.emotionIntensity;
        }

        return {
          word,
          selectedEffects,
          reason: `来自关键词分组"${keywordGroupQuery.group.name}"中单个词汇"${word.text}"的特效配置`,
          compatibility: true
        };
      }

      // 🔧 如果单个词汇没有特效,尝试使用分组级别的特效配置
      if (keywordGroupQuery.group.effectConfig) {
        console.log('[EffectMappingManager] 使用分组级别的特效:', {
          keyword: word.text,
          groupName: keywordGroupQuery.group.name,
          effectConfig: keywordGroupQuery.group.effectConfig
        });

        const groupEffect = keywordGroupQuery.group.effectConfig;
        const selectedEffects: EffectConfig[] = [{ ...groupEffect }];

        // 如果词汇有情感强度，调整强度
        if (word.emotionIntensity !== undefined) {
          selectedEffects[0].intensity = word.emotionIntensity;
        }

        return {
          word,
          selectedEffects,
          reason: `来自关键词分组"${keywordGroupQuery.group.name}"的分组级特效配置`,
          compatibility: true
        };
      }
    }

    // 第二步：关键词分组中未找到，使用分类规则
    const rule = EffectMappingManager.MAPPING_RULES.find(
      r => r.category === word.category
    );

    if (!rule || rule.effects.length === 0) {
      return {
        word,
        selectedEffects: [],
        reason: '中性词或未找到对应规则',
        compatibility: true
      };
    }

    // 选择主特效
    const primaryEffect = rule.effects[0];
    const primaryConfig = this.getEffectConfig(primaryEffect, word);

    // 如果词汇有情感强度，增加强度参数
    if (word.emotionIntensity !== undefined) {
      primaryConfig.intensity = word.emotionIntensity;
    }

    // 可能的辅助特效
    const secondaryEffect = rule.effects.length > 1 ? rule.effects[1] : null;
    const selectedEffects: EffectConfig[] = [primaryConfig];

    if (secondaryEffect) {
      const compatible = this.checkCompatibility(primaryEffect, secondaryEffect);
      if (compatible) {
        const secondaryConfig = this.getEffectConfig(secondaryEffect, word);
        selectedEffects.push(secondaryConfig);
      }
    }

    return {
      word,
      selectedEffects,
      reason: rule.reason,
      compatibility: true
    };
  }

  /**
   * 获取特效配置
   */
  private getEffectConfig(effectType: EffectType, word?: ClassifiedWord): EffectConfig {
    const preset = { ...EffectMappingManager.EFFECT_PRESETS[effectType] };

    // 根据词汇强度调整参数
    if (word && word.emotionIntensity !== undefined) {
      preset.intensity = word.emotionIntensity;
      preset.duration = Math.max(300, preset.duration * word.emotionIntensity);
    }

    return preset;
  }

  /**
   * 根据effectId获取EffectType（将UI中的effectId映射到EffectType枚举）
   * @param effectId 来自UI的effectId (如 'zoom-in', 'pulse', 'glow' 等)
   * @returns 对应的EffectType
   */
  private getEffectTypeFromId(effectId: string): EffectType {
    // 将UI中的effectId映射到EffectType枚举值
    const idToEffectTypeMap: Record<string, EffectType> = {
      'zoom-in': EffectType.PULSE_SCALE,
      'pulse': EffectType.PULSE_SCALE,
      'pulse-scale': EffectType.PULSE_SCALE,
      'bounce': EffectType.BOUNCE_SPRING,
      'bounce-spring': EffectType.BOUNCE_SPRING,
      'glow': EffectType.GLOW_EFFECT,
      'glow-effect': EffectType.GLOW_EFFECT,
      'shake': EffectType.SHAKE_EMOTION,
      'shake-emotion': EffectType.SHAKE_EMOTION,
      'slide-up': EffectType.SLIDE_IN_UP,
      'slide-in-up': EffectType.SLIDE_IN_UP,
      'fade': EffectType.FADE_IN_SMOOTH,
      'fade-in-smooth': EffectType.FADE_IN_SMOOTH,
      'spin': EffectType.RAINBOW_GRADIENT,
      'wave': EffectType.WATER_RIPPLE,
      'water-ripple': EffectType.WATER_RIPPLE,
      'flip': EffectType.MIRROR_FLIP,
      'mirror-flip': EffectType.MIRROR_FLIP,
      'color-flash': EffectType.COLOR_FLASH,
      'motion-blur': EffectType.MOTION_BLUR,
      'heart-pulse': EffectType.HEART_PULSE,
      'gradient-reveal': EffectType.GRADIENT_REVEAL,
      'particle-burst': EffectType.PARTICLE_BURST,
      'rainbow-gradient': EffectType.RAINBOW_GRADIENT,
      'electric-spark': EffectType.ELECTRIC_SPARK,
      'ghost-appear': EffectType.GHOST_APPEAR,
      'fire-effect': EffectType.FIRE_EFFECT,
      'ice-freeze': EffectType.ICE_FREEZE
    };

    const effectType = idToEffectTypeMap[effectId.toLowerCase()];
    if (!effectType) {
      console.warn(`[EffectMappingManager] 未知的effectId: ${effectId}, 使用默认值 PULSE_SCALE`);
      return EffectType.PULSE_SCALE;
    }

    return effectType;
  }

  /**
   * 检查两个特效是否兼容
   */
  private checkCompatibility(effect1: EffectType, effect2: EffectType): boolean {
    const entry = EffectMappingManager.COMPATIBILITY_MATRIX.find(
      c => (c.effect1 === effect1 && c.effect2 === effect2) ||
           (c.effect1 === effect2 && c.effect2 === effect1)
    );

    if (entry) {
      return entry.compatible;
    }

    // 默认兼容
    return true;
  }

  /**
   * 检查全局冲突
   */
  private checkGlobalConflicts(assignments: WordEffectAssignment[]): string[] {
    const conflicts: string[] = [];

    // 检查同一时间内的特效总数
    let totalEffects = 0;
    for (const assignment of assignments) {
      totalEffects += assignment.selectedEffects.length;
    }

    if (totalEffects > 10) {
      conflicts.push('总特效数量过多，可能影响性能');
    }

    // 检查特效时长冲突
    const effectTimings: Array<{ start: number; end: number; word: string }> = [];

    for (const assignment of assignments) {
      let currentTime = 0;
      for (const effect of assignment.selectedEffects) {
        const end = currentTime + effect.duration;
        effectTimings.push({
          start: currentTime,
          end,
          word: assignment.word.text
        });
        currentTime = end + 100; // 100ms间隔
      }
    }

    // 检查重叠
    for (let i = 0; i < effectTimings.length; i++) {
      for (let j = i + 1; j < effectTimings.length; j++) {
        if (this.hasOverlap(effectTimings[i], effectTimings[j])) {
          conflicts.push(
            `词语"${effectTimings[i].word}"和"${effectTimings[j].word}"的特效时间重叠`
          );
        }
      }
    }

    return conflicts;
  }

  /**
   * 检查两个时间段是否重叠
   */
  private hasOverlap(
    timing1: { start: number; end: number },
    timing2: { start: number; end: number }
  ): boolean {
    return !(timing1.end <= timing2.start || timing2.end <= timing1.start);
  }

  /**
   * 解决特效冲突
   */
  resolveConflicts(assignments: WordEffectAssignment[]): void {
    // 1. 移除不兼容的辅助特效
    for (const assignment of assignments) {
      if (assignment.selectedEffects.length > 1) {
        const primaryEffect = assignment.selectedEffects[0];

        assignment.selectedEffects = assignment.selectedEffects.filter((effect, index) => {
          if (index === 0) return true; // 保留主特效

          const compatible = this.checkCompatibility(primaryEffect.type, effect.type);
          return compatible;
        });
      }
    }

    // 2. 调整时间以避免重叠
    let currentTime = 0;

    for (const assignment of assignments) {
      for (const effect of assignment.selectedEffects) {
        effect.delay = currentTime;
        currentTime += effect.duration + 100; // 100ms间隔
      }
    }
  }

  /**
   * 获取特效推荐
   */
  getRecommendations(words: ClassifiedWord[]): EffectMappingResult {
    // 先分配特效
    const result = this.assignEffects(words);

    // 再解决冲突
    this.resolveConflicts(result.assignments);

    return result;
  }

  /**
   * 自定义特效映射规则
   */
  addCustomRule(
    category: VocabularyCategory,
    effects: EffectType[],
    reason: string
  ): void {
    // 移除已存在的规则
    const index = EffectMappingManager.MAPPING_RULES.findIndex(r => r.category === category);
    if (index >= 0) {
      EffectMappingManager.MAPPING_RULES.splice(index, 1);
    }

    // 添加新规则
    EffectMappingManager.MAPPING_RULES.push({
      category,
      effects,
      reason
    });
  }

  /**
   * 获取特效预设
   */
  getEffectPreset(effectType: EffectType): EffectConfig | undefined {
    return EffectMappingManager.EFFECT_PRESETS[effectType];
  }

  /**
   * 获取所有可用特效
   */
  getAllEffectTypes(): EffectType[] {
    return Object.values(EffectType);
  }

  /**
   * 获取特效描述
   */
  getEffectDescription(effectType: EffectType): string {
    const descriptions: Record<EffectType, string> = {
      [EffectType.PULSE_SCALE]: '脉冲缩放 - 文字放大缩小，产生脉冲感',
      [EffectType.COLOR_FLASH]: '颜色闪烁 - 文字颜色闪烁变化',
      [EffectType.SLIDE_IN_UP]: '向上滑入 - 文字从下方滑入',
      [EffectType.MOTION_BLUR]: '运动模糊 - 文字运动时产生模糊效果',
      [EffectType.HEART_PULSE]: '心跳脉冲 - 心跳般的脉冲效果',
      [EffectType.SHAKE_EMOTION]: '情感抖动 - 文字轻微抖动',
      [EffectType.FADE_IN_SMOOTH]: '平滑淡入 - 文字平滑渐现',
      [EffectType.GRADIENT_REVEAL]: '渐变显示 - 文字以渐变方式显示',
      [EffectType.BOUNCE_SPRING]: '弹簧反弹 - 弹簧般的反弹效果',
      [EffectType.GLOW_EFFECT]: '发光效果 - 文字产生发光效果',
      [EffectType.KEYWORD_COMBO]: '关键词组合 - 脉冲+闪烁组合',
      [EffectType.ACTION_COMBO]: '行动词组合 - 滑入+模糊组合',
      [EffectType.EMOTION_COMBO]: '情感词组合 - 心跳+抖动组合',
      [EffectType.DESCRIPTION_COMBO]: '描述词组合 - 淡入+渐变组合',
      [EffectType.PARTICLE_BURST]: '粒子爆炸 - 文字爆炸成粒子效果',
      [EffectType.MIRROR_FLIP]: '镜像翻转 - 文字镜像翻转显示',
      [EffectType.RAINBOW_GRADIENT]: '彩虹渐变 - 文字显示彩虹渐变色',
      [EffectType.ELECTRIC_SPARK]: '电击效果 - 文字产生电击闪烁',
      [EffectType.WATER_RIPPLE]: '水波纹 - 文字产生水波纹涟漪',
      [EffectType.GHOST_APPEAR]: '幽灵显示 - 文字幽灵般淡出淡入',
      [EffectType.FIRE_EFFECT]: '炎火效果 - 文字产生炎火燃烧效果',
      [EffectType.ICE_FREEZE]: '冰冻效果 - 文字产生冰冻凝结效果'
    };

    return descriptions[effectType] || '未知效果';
  }
}

/**
 * 导出单例实例
 */
export const effectMappingManager = new EffectMappingManager();
