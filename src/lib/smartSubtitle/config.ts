/**
 * 排版配置 - layoutConfig.ts
 * 包含TextLayoutEngine的默认配置和常用参数
 */

export const LAYOUT_CONFIG = {
  // 默认安全边距（百分比）
  DEFAULT_SAFE_MARGIN: {
    top: 15,
    bottom: 15,
    left: 10,
    right: 10
  },

  // 各屏幕尺寸的推荐配置
  SCREEN_SIZES: {
    mobile: {
      width: 1080,
      height: 1920,
      fontSize: 36,
      maxCharsPerLine: 12,
      maxLines: 4
    },
    tablet: {
      width: 1920,
      height: 1080,
      fontSize: 48,
      maxCharsPerLine: 18,
      maxLines: 3
    },
    desktop: {
      width: 1920,
      height: 1080,
      fontSize: 48,
      maxCharsPerLine: 18,
      maxLines: 3
    },
    ultrawide: {
      width: 3440,
      height: 1440,
      fontSize: 56,
      maxCharsPerLine: 28,
      maxLines: 2
    }
  },

  // 换行优先级
  PUNCTUATION_WEIGHTS: {
    '。': 1.0,  // 句号 - 最优先
    '！': 1.0,
    '？': 1.0,
    '；': 0.9,
    '，': 0.8,  // 逗号 - 次优先
    '.': 1.0,
    '!': 1.0,
    '?': 1.0,
    ';': 0.9,
    ',': 0.8
  },

  // 单字保护列表（避免单独成行）
  SINGLE_CHAR_PROTECT: ['的', '了', '吗', '呢', '啊', '哦', '呀', '啦', '唉', '额'],

  // 最大行长度容差
  MAX_LINE_LENGTH_TOLERANCE: 0.8,

  // 字体度量缓存大小
  FONT_METRICS_CACHE_SIZE: 1000
};

/**
 * 分批配置 - batchConfig.ts
 * 包含BatchDisplayManager的默认配置
 */
export const BATCH_CONFIG = {
  // 短文本阈值（字符数）
  SHORT_TEXT_THRESHOLD: 20,

  // 中等文本阈值
  MEDIUM_TEXT_THRESHOLD: 40,

  // 默认分批策略参数
  STRATEGIES: {
    single: {
      minDuration: 100,
      maxDuration: 2000,
      baseDurationPerChar: 60
    },
    multi: {
      minDuration: 500,
      maxDuration: 1500,
      baseDurationPerChar: 60,
      batchInterval: 500
    },
    long: {
      minDuration: 300,
      maxDuration: 2000,
      baseDurationPerChar: 60,
      batchInterval: 300
    }
  },

  // 批次大小
  BATCH_SIZES: {
    min: 10,
    max: 20,
    default: 15
  },

  // 可读性因子范围
  READABILITY_FACTOR: {
    min: 0.5,
    normal: 1.0,
    max: 2.0
  },

  // 默认批次间隔时间
  DEFAULT_INTERVAL: 300,

  // 最小批次间隔
  MIN_INTERVAL: 100,

  // 最大批次间隔
  MAX_INTERVAL: 1000
};

/**
 * 特效配置 - effectConfig.ts
 * 包含EffectMappingManager的特效配置
 */
export const EFFECT_CONFIG = {
  // 特效持续时间预设（毫秒）
  EFFECT_DURATIONS: {
    'pulse-scale': 600,
    'color-flash': 400,
    'slide-in-up': 500,
    'motion-blur': 400,
    'heart-pulse': 1000,
    'shake-emotion': 600,
    'fade-in-smooth': 800,
    'gradient-reveal': 1000,
    'bounce-spring': 700,
    'glow-effect': 800,
    // 新增特效时长配置
    'particle-burst': 900,      // 粒子爆炸
    'mirror-flip': 800,         // 镜像翻转
    'rainbow-gradient': 1200,   // 彩虹渐变
    'electric-spark': 700,      // 电击效果
    'water-ripple': 1000,       // 水波纹
    'ghost-appear': 1100,       // 幽灵显示
    'fire-effect': 1000,        // 炎火效果
    'ice-freeze': 900           // 冰冻效果
  },

  // 特效强度范围
  INTENSITY: {
    min: 0,
    normal: 0.8,
    max: 1.0
  },

  // 特效延迟
  DELAY: {
    min: 0,
    step: 50,
    max: 1000
  },

  // 最大并行特效数
  MAX_CONCURRENT_EFFECTS: 3,

  // 特效组合兼容性
  COMPATIBLE_PAIRS: [
    ['pulse-scale', 'color-flash'],
    ['slide-in-up', 'motion-blur'],
    ['fade-in-smooth', 'gradient-reveal'],
    ['heart-pulse', 'shake-emotion'],
    ['glow-effect', 'color-flash'],
    // 新增特效兼容性
    ['particle-burst', 'glow-effect'],
    ['mirror-flip', 'rainbow-gradient'],
    ['electric-spark', 'color-flash'],
    ['water-ripple', 'fade-in-smooth'],
    ['ghost-appear', 'fade-in-smooth'],
    ['fire-effect', 'color-flash'],
    ['ice-freeze', 'bounce-spring']
  ],

  // 不兼容的特效对
  INCOMPATIBLE_PAIRS: [
    ['slide-in-up', 'fade-in-smooth'],
    ['pulse-scale', 'bounce-spring'],
    ['motion-blur', 'gradient-reveal'],
    // 新增不兼容配置
    ['fire-effect', 'ice-freeze'],      // 火和冰互斥
    ['particle-burst', 'ghost-appear'], // 粒子爆炸和幽灵显示互斥
    ['mirror-flip', 'shake-emotion'],   // 翻转和抖动互斥
    ['electric-spark', 'water-ripple']  // 电击和水波纹互斥
  ]
};

/**
 * 动画配置 - animationConfig.ts
 * 包含AnimationTimingManager的配置
 */
export const ANIMATION_CONFIG = {
  // 冲突检测阈值
  CONFLICT_THRESHOLDS: {
    overlap: 0.3,           // 重叠30%以上
    rapidTransition: 100,   // 过渡时间< 100ms
    maxConcurrent: 3        // 最多并行特效数
  },

  // 冲突解决策略优先级
  RESOLUTION_STRATEGIES: {
    high: 'delay',          // 高冲突：推迟
    medium: 'accelerate',   // 中冲突：加速
    low: 'simplify'         // 低冲突：简化
  },

  // 时间线优化参数
  OPTIMIZATION: {
    mergeTolerance: 50,     // 合并容差 (ms)
    minEventGap: 100        // 最小事件间隔
  },

  // 动画性能限制
  PERFORMANCE: {
    maxTotalDuration: 60000,    // 最大总时长 (60秒)
    maxEventsPerTimeline: 1000,  // 最多事件数
    maxEventFiringRate: 100      // 最大每秒事件数
  }
};

/**
 * 屏幕配置 - screenConfig.ts
 * 包含ScreenAdaptationManager的预定义屏幕配置
 */
export const SCREEN_CONFIG = {
  // 预定义的宽高比
  ASPECT_RATIOS: {
    'ultrawide': '21:9',
    'widescreen': '16:9',
    'standard': '4:3',
    'wsxga': '16:10',
    'cinema': '2.39:1'
  },

  // 屏幕分类
  SCREEN_CATEGORIES: {
    mobile: { minWidth: 320, maxWidth: 1080 },
    tablet: { minWidth: 1080, maxWidth: 1920 },
    desktop: { minWidth: 1920, maxWidth: 3440 },
    ultrawide: { minWidth: 3440, maxWidth: 7680 }
  },

  // 字体大小建议
  FONT_SIZE_RANGE: {
    min: 12,
    max: 120,
    step: 2
  },

  // 每行字符数建议范围
  CHARS_PER_LINE: {
    mobile: { min: 8, max: 15 },
    tablet: { min: 12, max: 20 },
    desktop: { min: 16, max: 25 },
    ultrawide: { min: 25, max: 35 }
  }
};

/**
 * 词汇配置 - vocabularyConfig.ts
 * 包含VocabularyClassifier的配置
 */
export const VOCABULARY_CONFIG = {
  // AI模型配置
  AI_MODELS: {
    zhipu: {
      provider: 'zhipu',
      models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
      recommended: 'glm-4-flash'
    }
  },

  // 本地词典更新策略
  LEXICON_UPDATE: {
    autoUpdateInterval: 86400000, // 24小时
    cacheExpiry: 3600000           // 1小时
  },

  // 置信度阈值
  CONFIDENCE: {
    high: 0.85,
    medium: 0.5,
    low: 0.3
  },

  // 缓存配置
  CACHE: {
    maxSize: 10000,
    ttl: 3600000  // 1小时
  }
};

/**
 * 处理配置 - processingConfig.ts
 * 包含SubtitleProcessor的全局配置
 */
export const PROCESSING_CONFIG = {
  // 性能目标
  PERFORMANCE_TARGETS: {
    maxProcessingTime: 2000,      // 最大处理时间 (ms)
    memoryLimit: 100 * 1024 * 1024  // 100MB
  },

  // 默认配置
  DEFAULTS: {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    readabilityFactor: 1.0,
    enableEffects: true,
    enableAI: true,
    subtitlePosition: 'bottom',
    subtitleAlignment: 'center'
  },

  // 验证规则
  VALIDATION: {
    minTextLength: 1,
    maxTextLength: 10000,
    minScreenWidth: 320,
    maxScreenWidth: 7680,
    minScreenHeight: 240,
    maxScreenHeight: 4320
  },

  // 日志级别
  LOG_LEVEL: 'info'  // 'debug' | 'info' | 'warn' | 'error'
};

// 导出所有配置
export const SMART_SUBTITLE_CONFIG = {
  layout: LAYOUT_CONFIG,
  batch: BATCH_CONFIG,
  effect: EFFECT_CONFIG,
  animation: ANIMATION_CONFIG,
  screen: SCREEN_CONFIG,
  vocabulary: VOCABULARY_CONFIG,
  processing: PROCESSING_CONFIG
};

export default SMART_SUBTITLE_CONFIG;
