/**
 * 音效库 - 包含所有精选内置音效
 * 使用预置音效文件，无需 FFmpeg 合成
 */

import type { SoundEffectMetadata, SoundEffectType, SoundEffectParams } from '@/types/soundEffect';

/**
 * 内置音效库定义 - 包含所有精选音效
 */
export const BUILTIN_SOUND_EFFECTS: Record<string, SoundEffectMetadata> = {
  // ==================== 基础音效 ====================
  swoosh: {
    id: 'swoosh',
    name: '划过音',
    description: '快速划过的嗖声，适合滑动效果',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 20, fadeOut: 100, triggerTime: 'start' }
  },
  click: {
    id: 'click',
    name: '点击音',
    description: '清脆的鼠标点击声',
    category: 'basic',
    defaultParams: { volume: 0.6, pitch: 1.0, fadeIn: 0, fadeOut: 30, triggerTime: 'start' }
  },
  impact: {
    id: 'impact',
    name: '撞击声',
    description: '有力的撞击声效',
    category: 'basic',
    defaultParams: { volume: 0.8, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },
  punch: {
    id: 'punch',
    name: '打击声',
    description: '拳击打击效果',
    category: 'basic',
    defaultParams: { volume: 0.8, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  whip: {
    id: 'whip',
    name: '鞭子声',
    description: '快速挥动的鞭子声',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 80, triggerTime: 'start' }
  },
  'blow-impact': {
    id: 'blow-impact',
    name: '打击音',
    description: '重击效果声',
    category: 'basic',
    defaultParams: { volume: 0.8, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },
  'arrow-whoosh': {
    id: 'arrow-whoosh',
    name: '箭矢划过',
    description: '箭矢快速飞过的声音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 10, fadeOut: 80, triggerTime: 'start' }
  },

  // ==================== 提示音效 ====================
  'cash-register': {
    id: 'cash-register',
    name: '收银机',
    description: '收银机叮当声',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 150, triggerTime: 'start' }
  },
  airhorn: {
    id: 'airhorn',
    name: '气喇叭',
    description: '响亮的气喇叭声',
    category: 'motion',
    defaultParams: { volume: 0.6, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },
  whistle: {
    id: 'whistle',
    name: '哨子声',
    description: '清脆的哨子声',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },
  gasp: {
    id: 'gasp',
    name: '惊叹声',
    description: '惊叹吸气声效',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },

  // ==================== 特效音效 ====================
  magic: {
    id: 'magic',
    name: '魔法音',
    description: '神奇梦幻的音效，适合魔法效果',
    category: 'advanced',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 50, fadeOut: 200, triggerTime: 'start' }
  },
  'magic-sfx': {
    id: 'magic-sfx',
    name: '魔法特效',
    description: '另一种魔法音效',
    category: 'advanced',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 30, fadeOut: 150, triggerTime: 'start' }
  },
  heartbeat: {
    id: 'heartbeat',
    name: '心跳声',
    description: '有节奏的心跳声',
    category: 'advanced',
    defaultParams: { volume: 0.6, pitch: 1.0, fadeIn: 50, fadeOut: 200, triggerTime: 'start' }
  },

  // 🆕 新增中文音效
  ding: {
    id: 'ding',
    name: '叮',
    description: '清脆的叮声提示音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  ding2: {
    id: 'ding2',
    name: '叮2',
    description: '另一种叮声变体',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  'transition-whoosh': {
    id: 'transition-whoosh',
    name: '呼转场',
    description: '转场过渡的呼声',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 20, fadeOut: 100, triggerTime: 'start' }
  },
  shua: {
    id: 'shua',
    name: '唰',
    description: '快速滑动的唰声',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  bo2: {
    id: 'bo2',
    name: '啵2',
    description: '气泡破裂的啵声',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  bo3: {
    id: 'bo3',
    name: '啵3',
    description: '另一种啵声变体',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  sousou: {
    id: 'sousou',
    name: '嗖嗖',
    description: '快速移动的嗖嗖声',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 10, fadeOut: 80, triggerTime: 'start' }
  },
  popup: {
    id: 'popup',
    name: '弹出',
    description: '元素弹出的提示音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  suspense: {
    id: 'suspense',
    name: '悬疑咚声',
    description: '制造悬念的低沉咚声',
    category: 'advanced',
    defaultParams: { volume: 0.8, pitch: 1.0, fadeIn: 30, fadeOut: 150, triggerTime: 'start' }
  },
  'gun-bolt': {
    id: 'gun-bolt',
    name: '拉栓',
    description: '枪械拉栓的金属声',
    category: 'advanced',
    defaultParams: { volume: 0.8, pitch: 1.0, fadeIn: 0, fadeOut: 80, triggerTime: 'start' }
  },
  spacebar: {
    id: 'spacebar',
    name: '按空格键',
    description: '键盘空格键按下的声音',
    category: 'basic',
    defaultParams: { volume: 0.6, pitch: 1.0, fadeIn: 0, fadeOut: 30, triggerTime: 'start' }
  },
  'cash-sound': {
    id: 'cash-sound',
    name: '收银声',
    description: '收银结算的声音',
    category: 'motion',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 100, triggerTime: 'start' }
  },
  waterdrop1: {
    id: 'waterdrop1',
    name: '水滴1',
    description: '水滴落下的声音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  waterdrop: {
    id: 'waterdrop',
    name: '水滴声',
    description: '水滴的清脆声音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  bubble: {
    id: 'bubble',
    name: '泡泡声',
    description: '气泡冒出的声音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  di: {
    id: 'di',
    name: '滴',
    description: '简短的滴声提示',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 30, triggerTime: 'start' }
  },
  'click-cn': {
    id: 'click-cn',
    name: '点击',
    description: '鼠标点击的声音',
    category: 'basic',
    defaultParams: { volume: 0.6, pitch: 1.0, fadeIn: 0, fadeOut: 30, triggerTime: 'start' }
  },
  electric: {
    id: 'electric',
    name: '电流',
    description: '电流通过的声音效果',
    category: 'advanced',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 20, fadeOut: 100, triggerTime: 'start' }
  },
  'book-flip': {
    id: 'book-flip',
    name: '翻书声',
    description: '翻动书页的声音',
    category: 'basic',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 0, fadeOut: 50, triggerTime: 'start' }
  },
  flashback: {
    id: 'flashback',
    name: '闪回',
    description: '回忆闪回的特效音',
    category: 'advanced',
    defaultParams: { volume: 0.7, pitch: 1.0, fadeIn: 30, fadeOut: 150, triggerTime: 'start' }
  },

  // 无音效
  none: {
    id: 'none',
    name: '无音效',
    description: '不使用音效',
    category: 'basic',
    defaultParams: { volume: 0, pitch: 1.0, fadeIn: 0, fadeOut: 0, triggerTime: 'start' }
  }
};

/**
 * 音效库工具类
 */
export class SoundEffectLibrary {
  /**
   * 获取内置音效定义
   */
  static getBuiltinEffect(effectId: string): SoundEffectMetadata | null {
    return BUILTIN_SOUND_EFFECTS[effectId as SoundEffectType] || null;
  }

  /**
   * 获取所有内置音效列表
   */
  static getAllBuiltinEffects(): SoundEffectMetadata[] {
    return Object.values(BUILTIN_SOUND_EFFECTS).filter(e => e.id !== 'none');
  }

  /**
   * 按分类获取音效
   */
  static getEffectsByCategory(category: 'basic' | 'motion' | 'visual' | 'advanced'): SoundEffectMetadata[] {
    return this.getAllBuiltinEffects().filter(effect => effect.category === category);
  }

  /**
   * 合并用户参数和默认参数
   */
  static mergeParams(effectId: string, userParams?: SoundEffectParams): SoundEffectParams {
    const effect = this.getBuiltinEffect(effectId);
    if (!effect) {
      return userParams || {};
    }

    return {
      ...effect.defaultParams,
      ...userParams
    };
  }
}
