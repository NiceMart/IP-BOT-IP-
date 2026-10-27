// @ts-nocheck
/**
 * 字幕生成服务类型定义
 * 用于新的字幕生成系统 ZimuShengcheng
 */

import type { SubtitleStyle } from '@/pages/Video/components/SubtitleStyleSelector.vue';
import type { KeywordGroup, EffectType } from '@/types/smartSubtitle';

// ==================== 配置接口 ====================

/**
 * 关键词组的位置配置
 * 用于为不同类型的关键词（重点词、描述词等）单独设置显示坐标
 */
export interface KeywordGroupPositionConfig {
  groupName: string;           // 关键词组名称（如"重点词"、"描述词"）
  effectX?: number;            // 特效字幕X坐标（0-100%，可选）
  effectY?: number;            // 特效字幕Y坐标（0-100%，可选）
  safeDistance?: number;       // 避让时的安全距离（像素值，可选）
}

/**
 * 字幕避让配置
 */
export interface AvoidanceConfig {
  safeDistance: number;        // 全局安全距离（像素，默认20）
  preferDirection: 'right' | 'top';  // 优先避让方向（默认'right'）
}

/**
 * 字幕生成主配置
 */
export interface ZimuConfig {
  videoPath: string;              // 视频文件路径
  videoWidth: number;             // 视频宽度（分辨率）
  videoHeight: number;            // 视频高度（分辨率）
  userText: string;               // 用户输入的初始文案（用于修正）`r`n  skipTextCorrection?: boolean;   // 已是最终切段结果时，跳过文本校正
  skipTextCorrection?: boolean;   // 已是最终切段结果时，跳过文本校正
  funasrSegments: FunasrSegment[]; // FUNASR识别结果（带时间戳）
  subtitleStyle: SubtitleStyle;   // 基础字幕样式
  keywordGroups: KeywordGroup[];  // 关键词分组配置
  keywordRenderMode?: 'floating' | 'inline-emphasis';
  fontDir: string;                // 自定义字体目录
  outputPath: string;             // 输出视频路径
  minSubtitleDuration?: number;   // 🔧 修复：字幕最小显示时长（秒），如果字幕时长小于此值则延长至此值
  normalSubtitleX?: number;       // 普通字幕水平位置（0-100%）
  normalSubtitleY?: number;       // 普通字幕垂直位置（0-100%）
  effectSubtitleX?: number;       // 特效字幕水平位置（0-100%，作为默认值）
  effectSubtitleY?: number;       // 特效字幕垂直位置（0-100%，作为默认值）
  disableSmartLayout?: boolean;   // 禁用智能布局，使用固定位置

  // 🆕 新增：按关键词组配置位置
  keywordGroupPositions?: KeywordGroupPositionConfig[]; // 关键词组位置配置列表
  avoidanceConfig?: AvoidanceConfig;  // 避让配置

  // 🆕 音效系统配置
  keywordRenderMode?: 'floating' | 'inline-emphasis';
  soundEffectSettings?: {
    enabled: boolean;                 // 是否启用音效
    masterVolume?: number;            // 主音量 0-1，默认 0.7
    mixMode?: 'overlay' | 'replace';  // 叠加或替换原音频
  };

  // ✨ 标题字幕配置
  titleSubtitleConfig?: any;  // TitleSubtitleConfig类型，避免循环依赖
  videoDuration?: number;      // 视频总时长(秒)，用于标题字幕显示

  // 🆕 新增：画中画混剪配置
  videoMixCutSettings?: any;   // 画中画配置对象（VideoMixCutConfig类型）
}

/**
 * FUNASR识别结果片段
 */
export interface FunasrSegment {
  text: string;                   // 识别的文本
  start: number;                  // 开始时间（秒）
  end: number;                    // 结束时间（秒）
  words?: WordTimestamp[];        // 词级时间戳（可选）
  timestamp?: number[][];         // 字级时间戳（可选）
}

/**
 * 词级时间戳
 */
export interface WordTimestamp {
  word: string;                   // 词
  start: number;                  // 开始时间（秒）
  end: number;                    // 结束时间（秒）
  confidence?: number;            // 置信度（0-1）
}

// ==================== 文案修正 ====================

/**
 * 修正后的文本片段
 */
export interface CorrectedSegment {
  charTimings?: Array<{ start: number; end: number }>;
  text: string;                   // 修正后的文本
  originalText: string;           // ASR原始文本
  start: number;                  // 开始时间（秒）
  end: number;                    // 结束时间（秒）
  corrected: boolean;             // 是否被修正
  confidence?: number;            // 修正置信度
}

/**
 * Levenshtein匹配结果
 */
export interface MatchResult {
  alignments: Alignment[];        // 字符对齐结果
  distance: number;               // 编辑距离
  similarity: number;             // 相似度（0-1）
}

/**
 * 字符对齐
 */
export interface Alignment {
  userChar: string;               // 用户文本字符
  asrChar: string;                // ASR文本字符
  operation: 'match' | 'replace' | 'insert' | 'delete'; // 操作类型
  userIndex: number;              // 用户文本索引
  asrIndex: number;               // ASR文本索引
}

// ==================== 关键词匹配 ====================

/**
 * 关键词匹配结果
 */
export interface KeywordMatch {
  keyword: string;                // 关键词文本
  startIndex: number;             // 在文本中的起始索引
  endIndex: number;               // 在文本中的结束索引
  startTime: number;              // 开始时间（秒）
  endTime: number;                // 结束时间（秒）
  groupId: string;                // 所属分组ID
  groupName: string;              // 所属分组名称
  effectType: EffectType;         // 特效类型
  isAnimated: boolean;            // 是否为带动画的特效
  style: KeywordStyle;            // 关键词样式配置
  // 🔧 修复：新增完整的特效配置字段
  effectConfig?: any;             // 特效配置对象（来自关键词分组）
  effectStyle?: KeywordStyle;     // 特效样式（来自关键词分组的styleConfig）
  effectIntensity?: number;       // 特效强度（0-1）
  effectDuration?: number;        // 特效持续时间（毫秒）
  // 🆕 贴纸相关字段
  stickerId?: string;             // 贴纸ID
  stickerConfig?: {               // 贴纸配置
    offsetX?: number;             // X轴偏移
    offsetY?: number;             // Y轴偏移
    scale?: number;               // 缩放比例
    opacity?: number;             // 透明度
  };
}

/**
 * 关键词样式配置
 */
export interface KeywordStyle {
  fontName?: string;              // 字体名称
  fontSize: number;               // 字体大小
  fontColor: string;              // 字体颜色（#RRGGBB）
  outlineColor: string;           // 描边颜色
  outlineWidth: number;           // 描边宽度
  shadowColor?: string;           // 阴影颜色
  shadowBlur?: number;            // 阴影模糊度
  backgroundColor?: string;       // 背景颜色
  backgroundOpacity?: number;     // 背景透明度（0-1）
}

// ==================== 字幕排列 ====================

/**
 * 排列后的字幕
 */
export interface ArrangedSubtitle {
  type: SubtitleType;             // 字幕类型
  text: string;                   // 显示文本
  start: number;                  // 开始时间（秒）
  end: number;                    // 结束时间（秒）
  position: Position;             // 屏幕位置
  style: RenderStyle;             // 渲染样式
  layer: RenderLayer;             // 渲染层
  animationConfig?: AnimationConfig; // 动画配置（如果有）

  // 🆕 新增：用于碰撞检测和避让逻辑
  width?: number;                 // 字幕宽度（像素，估算值）
  height?: number;                // 字幕高度（像素，估算值）
  keywordGroup?: string;          // 关键词组名称（仅特效字幕，用于分组避让）
  effectiveEnd?: number;          // 实际结束时间（秒，考虑动画时长）
}

/**
 * 字幕类型
 */
export type SubtitleType = 'normal' | 'effect_simple' | 'effect_complex';

/**
 * 屏幕位置
 */
export interface Position {
  x: number;                      // X坐标（像素）
  y: number;                      // Y坐标（像素）
  alignment?: 'left' | 'center' | 'right'; // 对齐方式
}

/**
 * 渲染样式
 */
export interface RenderStyle {
  fontName: string;               // 字体名称
  fontSize: number;               // 字体大小
  fontColor: string;              // 字体颜色
  outlineColor: string;           // 描边颜色
  outlineWidth: number;           // 描边宽度
  backgroundColor?: string;       // 背景颜色
  backgroundOpacity?: number;     // 背景透明度
  shadowOffset?: number;          // 阴影偏移
  shadowColor?: string;           // 阴影颜色
  shadowBlur?: number;            // 阴影模糊度
}

/**
 * 渲染层
 */
export type RenderLayer = 'ass_normal' | 'ass_effect' | 'drawtext';

/**
 * 动画配置
 */
export interface AnimationConfig {
  type: AnimationType;            // 动画类型
  duration: number;               // 持续时间（毫秒）
  delay: number;                  // 延迟时间（毫秒）
  intensity: number;              // 强度（0-1）
  parameters?: Record<string, any>; // 特定参数
}

/**
 * 动画类型
 */
export type AnimationType =
  | 'scale'         // 缩放
  | 'fade'          // 淡入淡出
  | 'slide'         // 滑动
  | 'bounce'        // 弹跳
  | 'rotate'        // 旋转
  | 'wave'          // 波浪
  | 'particle'      // 粒子
  | 'glow'          // 发光
  | 'shake';        // 抖动

// ==================== ASS生成 ====================

/**
 * ASS文件配置
 */
export interface ASSFileConfig {
  width: number;                  // 视频宽度
  height: number;                 // 视频高度
  fontDir?: string;               // 字体目录
}

/**
 * ASS样式配置
 */
export interface ASSStyleConfig {
  name: string;                   // 样式名称
  fontname: string;               // 字体名称
  fontsize: number;               // 字号
  primaryColour: string;          // 主要颜色（ASS格式：&HAABBGGRR）
  secondaryColour: string;        // 次要颜色
  outlineColour: string;          // 描边颜色
  backColour: string;             // 背景颜色
  bold: number;                   // 粗体（0或1）
  italic: number;                 // 斜体（0或1）
  borderStyle: number;            // 边框样式
  outline: number;                // 描边宽度
  shadow: number;                 // 阴影偏移
  alignment: number;              // 对齐方式（数字键盘布局）
  marginL: number;                // 左边距
  marginR: number;                // 右边距
  marginV: number;                // 垂直边距
  scaleX?: number;                // X轴缩放（百分比）
  scaleY?: number;                // Y轴缩放（百分比）
}

/**
 * ASS对话事件
 */
export interface ASSDialogueEvent {
  layer: number;                  // 层级
  start: string;                  // 开始时间（ASS格式：H:MM:SS.mm）
  end: string;                    // 结束时间
  style: string;                  // 样式名称
  text: string;                   // 显示文本
  effectId?: string; // 特效ID
  effectConfig?: any; // 特效配置
  stickerId?: string; // 🆕 贴纸ID
  stickerConfig?: {   // 🆕 贴纸配置
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    opacity?: number;
  };
  marginL?: number;               // 左边距（覆盖样式）
  marginR?: number;               // 右边距（覆盖样式）
  marginV?: number;               // 垂直边距（覆盖样式）
}

// ==================== drawtext生成 ====================

/**
 * drawtext命令配置
 */
export interface DrawtextConfig {
  fontfile: string;               // 字体文件路径
  text: string;                   // 显示文本
  x: string | number;             // X坐标（支持表达式）
  y: string | number;             // Y坐标（支持表达式）
  fontsize: string | number;      // 字号（支持表达式，如"50*(1+0.2*sin(4*PI*(t-0.1)))"）
  fontcolor: string;              // 字体颜色（0xRRGGBB）
  borderw: number;                // 描边宽度
  bordercolor: string;            // 描边颜色
  enable: string;                 // 启用时间表达式
  alpha?: string;                 // 透明度表达式
  shadowcolor?: string;           // 阴影颜色
  shadowx?: number;               // 阴影X偏移
  shadowy?: number;               // 阴影Y偏移
  // 🔧 新增：宽度限制参数，防止字幕溢出屏幕
  boxw?: number;                  // 文本框宽度（超过此宽度时自动换行）
  line_spacing?: number;          // 行间距
  fix_bounds?: number;            // 是否强制限制文本在指定范围内（0或1）
}

/**
 * 粒子效果配置
 */
export interface ParticleConfig {
  text: string;                   // 文本
  centerX: number;                // 中心X坐标
  centerY: number;                // 中心Y坐标
  startTime: number;              // 开始时间（秒）
  duration: number;               // 持续时间（秒）
  particleCount: number;          // 粒子数量
  radius: number;                 // 爆炸半径
  fontsize: number;               // 字号
  fontcolor: string;              // 颜色
}

/**
 * 波浪效果配置
 */
export interface WaveConfig {
  text: string;                   // 文本
  centerX: number;                // 中心X坐标
  baseY: number;                  // 基准Y坐标
  startTime: number;              // 开始时间（秒）
  duration: number;               // 持续时间（秒）
  amplitude: number;              // 振幅
  frequency: number;              // 频率
  fontsize: number;               // 字号
  fontcolor: string;              // 颜色
}

// ==================== 布局计算 ====================

/**
 * 布局约束
 */
export interface LayoutConstraints {
  maxLines: number;               // 最大行数（默认2）
  maxCharsPerLine: number;        // 每行最大字符数（动态计算）
  lineHeight: number;             // 行高（fontSize * 1.5）
  horizontalMargin: number;       // 水平边距
  verticalMargin: number;         // 垂直边距
  effectSpacing: number;          // 特效字幕间距（字符数）
}

/**
 * 字幕行
 */
export interface SubtitleLine {
  subtitles: ArrangedSubtitle[];  // 该行的所有字幕
  startTime: number;              // 行开始时间
  endTime: number;                // 行结束时间
  yPosition: number;              // Y坐标
  totalChars: number;             // 总字符数
}

/**
 * 字幕帧（时间段）
 */
export interface SubtitleFrame {
  lines: SubtitleLine[];          // 该帧的所有行
  startTime: number;              // 帧开始时间
  endTime: number;                // 帧结束时间
}

// ==================== FFmpeg ====================

/**
 * FFmpeg命令构建结果
 */
export interface FFmpegCommand {
  fullCommand: string;            // 完整命令
  filters: string[];              // 滤镜列表
  assFiles: string[];             // ASS文件路径
  tempFiles: string[];            // 临时文件（需要清理）
  // 🆕 音效混音配置
  audioMixConfig?: {
    inputFiles: string[];         // 音效文件路径列表
    mixFilter: string;            // 音频混音滤镜
  } | null;
  stickerInputs?: string[];       // 🆕 贴纸输入参数
}

// ==================== 工具函数返回类型 ====================

/**
 * 颜色转换结果
 */
export interface ColorConversion {
  hex: string;                    // #RRGGBB
  ass: string;                    // &HAABBGGRR
  drawtext: string;               // 0xRRGGBB
}

/**
 * 时间格式转换结果
 */
export interface TimeConversion {
  seconds: number;                // 秒（浮点数）
  assFormat: string;              // ASS格式：H:MM:SS.mm
  drawtextEnable: string;         // drawtext enable表达式
}

// ==================== 生成结果 ====================

/**
 * 字幕生成结果
 */
export interface GenerationResult {
  success: boolean;               // 是否成功
  outputPath?: string;            // 输出文件路径
  srtPath?: string;               // SRT字幕文件路径（用于展示和下载）
  message?: string;               // 消息
  error?: Error;                  // 错误（如果失败）
  statistics?: GenerationStatistics; // 统计信息
}

/**
 * 生成统计信息
 */
export interface GenerationStatistics {
  totalSegments: number;          // 总段数
  correctedCount: number;         // 修正的段数
  keywordCount: number;           // 关键词数量
  normalSubtitles: number;        // 普通字幕数量
  effectSubtitles: number;        // 特效字幕数量
  renderTime: number;             // 渲染时间（秒）
  processingTime: number;         // 总处理时间（秒）
}