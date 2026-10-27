/**
 * 字幕特效库
 * 定义所有可用的字幕特效及其参数配置
 */

export interface EffectParams {
  // 基础参数
  intensity?: number;      // 强度 0-1，默认 0.8
  duration?: number;       // 持续时间（秒），默认使用字幕时长
  speed?: number;          // 速度倍数 0.5-3.0，默认 1.0
  delay?: number;          // 延迟（秒），默认 0

  // 方向参数（适用于位移特效）
  direction?: 'up' | 'down' | 'left' | 'right';

  // 颜色参数（适用于颜色特效）
  colors?: string[];       // 颜色数组

  // 特效特定参数
  custom?: Record<string, any>;
}

export interface EffectMetadata {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'motion' | 'rotation' | 'visual' | 'advanced';
  defaultParams: EffectParams;
  supportedParams: string[]; // 支持的参数列表
}

/**
 * 特效库定义
 */
export const EFFECT_LIBRARY: Record<string, EffectMetadata> = {
  // ==================== 基础动画特效 ====================
  'zoom-in': {
    id: 'zoom-in',
    name: '缩放弹出',
    description: '从0.3倍到1.2倍的弹性弹出效果，适合强调关键词',
    category: 'basic',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { minScale: 0.3, maxScale: 1.2, bounce: true }
    },
    supportedParams: ['intensity', 'speed', 'custom.minScale', 'custom.maxScale', 'custom.bounce']
  },
  'bounce': {
    id: 'bounce',
    name: '弹跳反弹',
    description: '垂直弹跳效果，带重力衰减，适合活泼风格',
    category: 'basic',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { bounceCount: 3, gravity: 0.8 }
    },
    supportedParams: ['intensity', 'speed', 'custom.bounceCount', 'custom.gravity']
  },
  'fade': {
    id: 'fade',
    name: '淡入淡出',
    description: '透明度渐变效果，支持自定义淡入淡出时长',
    category: 'basic',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { fadeIn: 0.3, fadeOut: 0.3 }
    },
    supportedParams: ['intensity', 'speed', 'custom.fadeIn', 'custom.fadeOut']
  },
  'flash': {
    id: 'flash',
    name: '闪烁高亮',
    description: '颜色闪烁效果，可配置闪烁次数和颜色',
    category: 'basic',
    defaultParams: {
      intensity: 0.9,
      speed: 1.0,
      colors: ['#FFFFFF', '#FFD700'],
      custom: { flashCount: 3 }
    },
    supportedParams: ['intensity', 'speed', 'colors', 'custom.flashCount']
  },

  // ==================== 位移动画特效 ====================
  'slide-up': {
    id: 'slide-up',
    name: '向上滑入',
    description: '从下方滑入，带缓动效果',
    category: 'motion',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      direction: 'up',
      custom: { distance: 100, easing: 'easeOut' }
    },
    supportedParams: ['intensity', 'speed', 'direction', 'custom.distance', 'custom.easing']
  },
  'slide-down': {
    id: 'slide-down',
    name: '向下滑入',
    description: '从上方滑入，带缓动效果',
    category: 'motion',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      direction: 'down',
      custom: { distance: 100, easing: 'easeOut' }
    },
    supportedParams: ['intensity', 'speed', 'direction', 'custom.distance', 'custom.easing']
  },
  'slide-left': {
    id: 'slide-left',
    name: '向左滑入',
    description: '从右侧滑入，带缓动效果',
    category: 'motion',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      direction: 'left',
      custom: { distance: 200, easing: 'easeOut' }
    },
    supportedParams: ['intensity', 'speed', 'direction', 'custom.distance', 'custom.easing']
  },
  'slide-right': {
    id: 'slide-right',
    name: '向右滑入',
    description: '从左侧滑入，带缓动效果',
    category: 'motion',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      direction: 'right',
      custom: { distance: 200, easing: 'easeOut' }
    },
    supportedParams: ['intensity', 'speed', 'direction', 'custom.distance', 'custom.easing']
  },
  'fly-in': {
    id: 'fly-in',
    name: '弹性飞入',
    description: '从屏幕外飞入，带弹性回弹效果',
    category: 'motion',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      direction: 'up',
      custom: { distance: 300, elasticity: 0.6 }
    },
    supportedParams: ['intensity', 'speed', 'direction', 'custom.distance', 'custom.elasticity']
  },

  // ==================== 旋转和翻转特效 ====================
  'spin': {
    id: 'spin',
    name: '旋转转动',
    description: '360度连续旋转，可配置转速和方向',
    category: 'rotation',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { rotations: 2, clockwise: true }
    },
    supportedParams: ['intensity', 'speed', 'custom.rotations', 'custom.clockwise']
  },
  'swing': {
    id: 'swing',
    name: '摇摆旋转',
    description: '左右摇摆效果，模拟钟摆运动',
    category: 'rotation',
    defaultParams: {
      intensity: 0.7,
      speed: 1.0,
      custom: { angle: 15, damping: 0.9 }
    },
    supportedParams: ['intensity', 'speed', 'custom.angle', 'custom.damping']
  },

  // ==================== 视觉增强特效 ====================
  'glow': {
    id: 'glow',
    name: '发光闪烁',
    description: '外发光效果，可配置光晕大小和颜色',
    category: 'visual',
    defaultParams: {
      intensity: 0.7,
      speed: 1.0,
      custom: { glowSize: 10, glowColor: '#FFD700', pulse: true }
    },
    supportedParams: ['intensity', 'speed', 'custom.glowSize', 'custom.glowColor', 'custom.pulse']
  },
  'shake': {
    id: 'shake',
    name: '抖动震颤',
    description: '随机抖动效果，可配置强度',
    category: 'visual',
    defaultParams: {
      intensity: 0.7,
      speed: 1.0,
      custom: { shakeAmount: 5, frequency: 10 }
    },
    supportedParams: ['intensity', 'speed', 'custom.shakeAmount', 'custom.frequency']
  },
  'intense-flash': {
    id: 'intense-flash',
    name: '强力闪烁',
    description: '多层叠加的强力发光闪烁效果',
    category: 'visual',
    defaultParams: {
      intensity: 0.9,
      speed: 1.0,
      custom: { flashSpeed: 5 }
    },
    supportedParams: ['intensity', 'speed', 'custom.flashSpeed']
  },
  'wave': {
    id: 'wave',
    name: '波浪浮动',
    description: '垂直波浪运动，适合动态感强的场景',
    category: 'visual',
    defaultParams: {
      intensity: 0.7,
      speed: 1.0,
      custom: { amplitude: 20, frequency: 2 }
    },
    supportedParams: ['intensity', 'speed', 'custom.amplitude', 'custom.frequency']
  },
  'breathe': {
    id: 'breathe',
    name: '呼吸效果',
    description: '大小和透明度周期性变化，模拟呼吸',
    category: 'visual',
    defaultParams: {
      intensity: 0.6,
      speed: 1.0,
      custom: { breathSpeed: 1.5, sizeVariation: 0.1 }
    },
    supportedParams: ['intensity', 'speed', 'custom.breathSpeed', 'custom.sizeVariation']
  },

  // ==================== 高级特效 ====================
  'rainbow': {
    id: 'rainbow',
    name: '彩虹渐变',
    description: '颜色循环变化，呈现彩虹效果',
    category: 'advanced',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { cycleSpeed: 2, saturation: 1.0 }
    },
    supportedParams: ['intensity', 'speed', 'custom.cycleSpeed', 'custom.saturation']
  },
  'particle-burst': {
    id: 'particle-burst',
    name: '粒子爆炸',
    description: '文字分解成粒子向外扩散（需要多个drawtext实例）',
    category: 'advanced',
    defaultParams: {
      intensity: 0.9,
      speed: 1.0,
      custom: { particleCount: 12, spread: 200 }
    },
    supportedParams: ['intensity', 'speed', 'custom.particleCount', 'custom.spread']
  },
  'electric': {
    id: 'electric',
    name: '电击效果',
    description: '快速抖动+颜色闪烁，模拟电击效果',
    category: 'advanced',
    defaultParams: {
      intensity: 0.9,
      speed: 1.5,
      colors: ['#FFFFFF', '#00FFFF'],
      custom: { shakeAmount: 10, flashSpeed: 8 }
    },
    supportedParams: ['intensity', 'speed', 'colors', 'custom.shakeAmount', 'custom.flashSpeed']
  },
  'heartbeat': {
    id: 'heartbeat',
    name: '心跳脉冲',
    description: '模拟心跳的缩放节奏',
    category: 'advanced',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: { beats: 2, beatPattern: [0.1, 0.3, 0.5] }
    },
    supportedParams: ['intensity', 'speed', 'custom.beats', 'custom.beatPattern']
  },

  // ==================== 满屏弹幕特效 ====================
  'danmaku': {
    id: 'danmaku',
    name: '弹幕满屏',
    description: '关键词在屏幕多个位置快速涌现散落，形成刷屏效果',
    category: 'advanced',
    defaultParams: {
      intensity: 0.8,
      speed: 1.0,
      custom: {
        copyCount: 30,          // 副本数量（增加到30，更密集的刷屏效果）
        sizeMin: 0.4,           // 最小尺寸比例
        sizeMax: 0.9,           // 最大尺寸比例
        suffix: '+1'            // 后缀文字（如 +1, ！等）
      }
    },
    supportedParams: ['intensity', 'speed', 'custom.copyCount', 'custom.sizeMin', 'custom.sizeMax', 'custom.suffix']
  }
};

/**
 * 获取特效元数据
 */
export function getEffectMetadata(effectId: string): EffectMetadata | null {
  return EFFECT_LIBRARY[effectId] || null;
}

/**
 * 获取所有特效列表
 */
export function getAllEffects(): EffectMetadata[] {
  return Object.values(EFFECT_LIBRARY);
}

/**
 * 按分类获取特效
 */
export function getEffectsByCategory(category: EffectMetadata['category']): EffectMetadata[] {
  return getAllEffects().filter(effect => effect.category === category);
}

/**
 * 合并默认参数和用户参数
 */
export function mergeEffectParams(effectId: string, userParams?: EffectParams): EffectParams {
  const metadata = getEffectMetadata(effectId);
  if (!metadata) {
    return userParams || {};
  }

  const merged: EffectParams = {
    ...metadata.defaultParams,
    ...userParams,
    custom: {
      ...metadata.defaultParams.custom,
      ...userParams?.custom
    }
  };

  return merged;
}













