/**
 * 音效系统类型定义
 * 为动态字幕系统提供音效配置和管理
 */

/**
 * 音效类型枚举 - 包含所有精选音效
 */
export enum SoundEffectType {
  // 基础音效
  SWOOSH = 'swoosh',              // 划过音
  CLICK = 'click',                // 点击音
  IMPACT = 'impact',              // 撞击声
  PUNCH = 'punch',                // 打击声
  WHIP = 'whip',                  // 鞭子声
  BLOW_IMPACT = 'blow-impact',    // 打击音
  ARROW_WHOOSH = 'arrow-whoosh',  // 箭矢划过

  // 提示音效
  CASH_REGISTER = 'cash-register',  // 收银机
  AIRHORN = 'airhorn',              // 气喇叭
  WHISTLE = 'whistle',              // 哨子声
  GASP = 'gasp',                    // 惊叹声

  // 特效音效
  MAGIC = 'magic',                // 魔法音
  MAGIC_SFX = 'magic-sfx',        // 魔法特效
  HEARTBEAT = 'heartbeat',        // 心跳声

  // 无音效
  NONE = 'none'
}

/**
 * 音效参数配置
 */
export interface SoundEffectParams {
  volume?: number;                // 音量 0-1，默认 0.7
  pitch?: number;                 // 音调 0.5-2.0，默认 1.0
  fadeIn?: number;                // 淡入时间（毫秒），默认 0
  fadeOut?: number;               // 淡出时间（毫秒），默认 50
  triggerTime?: 'start' | 'middle' | 'end'; // 触发时机，默认 'start'
}

/**
 * 音效配置（用于分组）
 */
export interface SoundEffectConfig {
  soundEffectId: string;          // 音效ID
  enabled: boolean;               // 是否启用
  params?: SoundEffectParams;     // 音效参数
}

/**
 * 音效元数据（库定义）
 */
export interface SoundEffectMetadata {
  id: SoundEffectType | string;
  name: string;
  description: string;
  category: 'basic' | 'motion' | 'visual' | 'advanced';
  defaultParams: SoundEffectParams;
  synthesis?: {
    type: 'sine' | 'square' | 'sawtooth' | 'triangle';
    baseFrequency: number;        // 基础频率 Hz
    duration: number;             // 时长（秒）
    fadeIn: number;               // 淡入（秒）
    fadeOut: number;              // 淡出（秒）
    modulation?: {
      type: 'vibrato' | 'tremolo' | 'sweep';
      rate: number;
      depth: number;
    };
  };
}

/**
 * 用户自定义音效
 */
export interface UserSoundEffect {
  id: string;
  name: string;
  description?: string;
  filePath: string;               // 用户上传的文件路径
  duration: number;               // 时长（秒）
  fileSize: number;               // 文件大小（字节）
  category: 'custom';
  createdAt: number;
  updatedAt: number;
}

/**
 * 音效时间实例（用于生成）
 */
export interface SoundEffectInstance {
  effectId: string;
  params?: SoundEffectParams;
  keyword: string;
  duration: number;               // 时长（毫秒）
  triggerTime: number;            // 触发时间（秒）
}

/**
 * 音效生成结果
 */
export interface SoundEffectGenerationResult {
  success: boolean;
  audioFile?: string;             // 生成的音频文件路径
  ffmpegCommand?: string;         // FFmpeg 命令（如果使用的话）
  error?: string;                 // 错误信息
}

/**
 * 扩展 KeywordGroup 的音效配置
 * 这些字段会被添加到现有的 KeywordGroup 接口中
 */
export interface KeywordGroupSoundConfig {
  soundEffectId?: string;         // 分组级音效ID
  soundEffectConfig?: SoundEffectParams; // 分组级音效参数
}

/**
 * 扩展字幕生成配置的音效设置
 */
export interface SoundEffectSettings {
  enabled: boolean;               // 是否启用音效
  masterVolume: number;           // 主音量 0-1，默认 0.7
  mixMode: 'overlay' | 'replace'; // 'overlay' 叠加到原音频，'replace' 替换原音频
}
