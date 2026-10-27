/**
 * 智能字幕系统 - 核心类型定义
 * 包含所有处理步骤的输入/输出类型
 */

// =====================================================
// 1. 屏幕和排版相关类型
// =====================================================

/**
 * 安全边距配置
 */
export interface SafeMargin {
  top: number;      // 上边距百分比 (0-50)
  bottom: number;   // 下边距百分比 (0-50)
  left: number;     // 左边距百分比 (0-30)
  right: number;    // 右边距百分比 (0-30)
}

/**
 * 屏幕配置
 */
export interface ScreenConfig {
  width: number;           // 屏幕宽度 (px)
  height: number;          // 屏幕高度 (px)
  aspectRatio: string;     // 宽高比 (如 "16:9")
  fontSize: number;        // 推荐字体大小
  maxCharsPerLine: number; // 每行最大字符数
  maxLines: number;        // 最多行数
  safeMargin: SafeMargin;  // 安全边距
}

/**
 * 单个词的布局信息
 */
export interface LayoutWord {
  text: string;
  width: number;    // 显示宽度 (px)
  height: number;   // 显示高度 (px)
  x: number;        // 行内位置
}

/**
 * 单行布局信息
 */
export interface LayoutLine {
  text: string;
  words: LayoutWord[];
  width: number;    // 行宽度
  height: number;   // 行高度
  exceeds: boolean; // 是否超出屏幕宽度
}

/**
 * 完整的文本布局结果
 */
export interface TextLayout {
  originalText: string;
  lines: LayoutLine[];
  totalWidth: number;  // 最宽行的宽度
  totalHeight: number; // 所有行的总高度
  exceedsScreen: boolean; // 是否超出屏幕高度
  lineCount: number;
}

// =====================================================
// 2. 文本分批相关类型
// =====================================================

/**
 * 单个文本批次
 */
export interface TextBatch {
  content: string;           // 批次内容
  index: number;             // 批次索引
  totalBatches: number;      // 总批次数
  duration: number;          // 显示时长 (ms)
  displayInterval: number;   // 与下一批的间隔 (ms)
  startTime?: number;        // 起始时间 (ms)
  endTime?: number;          // 结束时间 (ms)
}

/**
 * 分批策略
 */
export enum BatchStrategy {
  SINGLE = 'single',       // 一次展示 (< 20字)
  MULTI = 'multi',         // 多批展示 (20-40字)
  LONG = 'long'            // 长文本展示 (> 40字)
}

/**
 * 分批配置结果
 */
export interface BatchConfig {
  strategy: BatchStrategy;
  batches: TextBatch[];
  totalDuration: number;   // 所有批次的总时长
  readabilityFactor: number; // 可读性因子 (0.5-2.0)
}

// =====================================================
// 3. 词汇分类相关类型
// =====================================================

/**
 * 词汇分类类型
 */
export enum VocabularyCategory {
  KEYWORD = 'keyword',           // 关键词/成语
  ACTION = 'action',             // 行动词
  DESCRIPTION = 'description',   // 描述词
  EMOTION = 'emotion',           // 情感词
  NEUTRAL = 'neutral'            // 中性词
}

/**
 * 情感极性
 */
export enum Sentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

/**
 * 单个分类的词汇
 */
export interface ClassifiedWord {
  text: string;
  category: VocabularyCategory;
  subcategory?: string;        // 细分类别 (如：成语、俗语)
  confidence: number;          // 分类置信度 (0-1)
  sentiment?: Sentiment;       // 情感极性
  emotionIntensity?: number;   // 情感强度 (0-1)
  specialType?: string;        // 特殊类型 (ACTION, EMOTION, EMPHASIS等)
}

/**
 * 词汇分类结果
 */
export interface VocabularyClassificationResult {
  words: ClassifiedWord[];
  statistics: {
    totalWords: number;
    categoryDistribution: Record<VocabularyCategory, number>;
    sentimentDistribution: Record<Sentiment, number>;
  };
}

// =====================================================
// 4. 特效相关类型
// =====================================================

/**
 * 特效类型
 */
export enum EffectType {
  // 基础特效
  PULSE_SCALE = 'pulse-scale',       // 脉冲缩放
  COLOR_FLASH = 'color-flash',       // 颜色闪烁
  SLIDE_IN_UP = 'slide-in-up',       // 向上滑入
  MOTION_BLUR = 'motion-blur',       // 运动模糊
  HEART_PULSE = 'heart-pulse',       // 心跳脉冲
  SHAKE_EMOTION = 'shake-emotion',   // 情感抖动
  FADE_IN_SMOOTH = 'fade-in-smooth', // 平滑淡入
  GRADIENT_REVEAL = 'gradient-reveal', // 渐变显示
  BOUNCE_SPRING = 'bounce-spring',   // 弹簧反弹
  GLOW_EFFECT = 'glow-effect',       // 发光效果


  // 新增扩展特效
  PARTICLE_BURST = 'particle-burst',    // 粒子爆炸
  MIRROR_FLIP = 'mirror-flip',          // 镜像翻转
  RAINBOW_GRADIENT = 'rainbow-gradient', // 彩虹渐变
  ELECTRIC_SPARK = 'electric-spark',    // 电击效果
  WATER_RIPPLE = 'water-ripple',        // 水波纹
  GHOST_APPEAR = 'ghost-appear',        // 幽灵显示
  FIRE_EFFECT = 'fire-effect',          // 炎火效果
  ICE_FREEZE = 'ice-freeze',            // 冰冻效果
  MOTION_BLUR_TRAIL = 'motion-blur-trail', // 🆕 运动模糊拖尾（残影效果）


  // 组合特效
  KEYWORD_COMBO = 'keyword-combo',           // 关键词组合
  ACTION_COMBO = 'action-combo',             // 行动词组合
  EMOTION_COMBO = 'emotion-combo',           // 情感词组合
  DESCRIPTION_COMBO = 'description-combo'    // 描述词组合
}

/**
 * 特效配置
 */
export interface EffectConfig {
  type: EffectType;
  duration: number;        // 动画时长 (ms)
  delay: number;          // 延迟时间 (ms)
  intensity: number;      // 强度 (0-1)
  parameters?: Record<string, any>; // 特定参数
}

/**
 * 词汇和特效的映射
 */
export interface WordEffectAssignment {
  word: ClassifiedWord;
  selectedEffects: EffectConfig[];  // 可能有多个特效
  reason: string;                   // 选择理由
  compatibility: boolean;           // 特效是否兼容
}

/**
 * 特效映射结果
 */
export interface EffectMappingResult {
  assignments: WordEffectAssignment[];
  globalEffects: EffectConfig[];    // 全局特效
  conflicts: string[];              // 特效冲突列表
}

// =====================================================
// 4.5. 关键词分组相关类型
// =====================================================

/**
 * 关键词样式配置
 */
export interface KeywordStyle {
  fontName?: string;
  fontSize: number;
  fontColor: string;          // 16进制颜色
  outlineColor: string;       // 描边颜色
  outlineWidth: number;       // 描边宽度 (0-8px)
  shadowColor?: string;       // 阴影颜色
  shadowBlur?: number;        // 阴影模糊度 (0-20px)
  backgroundColor?: string;   // 背景颜色
  backgroundOpacity?: number; // 背景不透明度 (0-1)
}

/**
 * 关键词项目配置（支持个别词级别的样式和特效）
 */
export interface KeywordItem {
  keyword: string;                                  // 关键词文本
  enabled?: boolean;                                // 是否启用
  effectId?: string;                                // 个别词的特效ID
  effectConfig?: EffectConfig;                      // 个别词的特效配置
  styleOverride?: KeywordStyle;                     // 个别词的样式覆盖
}

/**
 * 关键词分组
 */
export interface KeywordGroup {
  id: string;
  name: string;
  description?: string;
  keywords: KeywordItem[];                          // 该组包含的关键词列表（现已支持个别词级特效）
  color?: string;                                   // 分组颜色
  effectId?: string;                                // 分组级关键词特效ID
  styleOverride?: KeywordStyle;                     // 分组级样式覆盖
  effectConfig?: EffectConfig;                      // 分组级特效配置
  styleConfig?: KeywordStyle;                       // 分组级样式配置
  // 🆕 音效相关字段
  soundEffectId?: string;                           // 分组级音效ID
  soundEffectConfig?: {                             // 分组级音效参数
    volume?: number;                                // 音量 0-1
    pitch?: number;                                 // 音调 0.5-2.0
    fadeIn?: number;                                // 淡入（毫秒）
    fadeOut?: number;                               // 淡出（毫秒）
    triggerTime?: 'start' | 'middle' | 'end';       // 触发时机
  };
  // 🆕 贴纸相关字段
  stickerId?: string;                               // 分组级贴纸ID
  stickerConfig?: {                                 // 分组级贴纸配置
    offsetX?: number;                               // X轴偏移
    offsetY?: number;                               // Y轴偏移
    scale?: number;                                 // 缩放比例
    opacity?: number;                               // 透明度
  };
  // 🆕 特效时长配置（每个分组可单独设置）
  effectDuration?: number;                          // 特效动画时长（秒），默认2秒
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 关键词分组查询结果
 */
export interface KeywordGroupQueryResult {
  word: string;
  groupId?: string;
  group?: KeywordGroup;
  matchType: 'exact' | 'partial' | 'none';
}

// =====================================================
// 5. 动画时间线相关类型
// =====================================================

/**
 * 动画冲突类型
 */
export enum ConflictType {
  OVERLAP = 'overlap',           // 动画重叠
  RAPID_TRANSITION = 'rapid_transition', // 过快过渡
  INCOMPATIBLE_EFFECTS = 'incompatible'  // 不兼容的特效
}

/**
 * 动画冲突
 */
export interface AnimationConflict {
  type: ConflictType;
  severity: 'high' | 'medium' | 'low';  // 严重程度
  description: string;
  affectedWords: ClassifiedWord[];
  overlapPercentage?: number;  // 重叠百分比 (0-100)
}

/**
 * 动画冲突解决方案
 */
export interface ConflictResolution {
  strategy: 'delay' | 'accelerate' | 'simplify';
  adjustments: Array<{
    wordIndex: number;
    originalEffect: EffectConfig;
    adjustedEffect: EffectConfig;
  }>;
}

/**
 * 动画时间线事件
 */
export interface AnimationTimelineEvent {
  time: number;           // 时间码 (ms)
  wordIndex: number;
  effect: EffectConfig;
  action: 'start' | 'end' | 'adjust';
}

/**
 * 完整的动画时间线
 */
export interface AnimationTimeline {
  events: AnimationTimelineEvent[];
  conflicts: AnimationConflict[];
  resolutions: ConflictResolution[];
  totalDuration: number;
}

// =====================================================
// 6. 综合处理结果类型
// =====================================================

/**
 * 完整的字幕处理配置
 */
export interface SubtitleProcessConfig {
  // 屏幕配置
  screenWidth: number;
  screenHeight: number;

  // 排版配置
  fontSize: number;
  fontFamily: string;
  maxCharsPerLine?: number;
  maxLines?: number;
  safeMarginPercent?: number;

  // 分批配置
  readabilityFactor?: number;  // 0.5-2.0
  preferredBatchSize?: number;

  // 特效配置
  enableEffects?: boolean;
  effectIntensity?: number;  // 0-1

  // AI配置
  enableAI?: boolean;
  modelId?: string;

  // 其他
  subtitlePosition?: 'top' | 'center' | 'bottom';
  subtitleAlignment?: 'left' | 'center' | 'right';
}

/**
 * 处理后的字幕 - 核心输出对象
 */
export interface ProcessedSubtitle {
  // 原始输入
  originalText: string;

  // 处理结果
  layout: TextLayout;
  classification: VocabularyClassificationResult;
  batches: TextBatch[];
  effectAssignments: WordEffectAssignment[];
  animationTimeline: AnimationTimeline;
  screenConfig: ScreenConfig;

  // 元数据
  totalDuration: number;
  processingTime: number;  // 处理耗时 (ms)

  // 显示模式控制
  displayMode: 'normal' | 'effectOnly' | 'both'; //
  // 'normal': 仅显示普通字幕
  // 'effectOnly': 仅显示特效字幕（触发特效时）
  // 'both': 同时显示普通字幕和特效字幕

  // 验证信息
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

// =====================================================
// 7. 字体和样式相关类型
// =====================================================

/**
 * 字幕样式配置
 */
export interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  fontColor: string;      // 16进制颜色
  outlineColor: string;   // 16进制颜色
  outlineWidth: number;
  shadowOffset: number;
  backgroundColor: string; // 16进制颜色或 'transparent'
  backgroundOpacity: number; // 0-1
  position: 'bottom' | 'top' | 'center';
  alignment: 'center' | 'left' | 'right';
}

// =====================================================
// 8. 处理选项和结果类型
// =====================================================

/**
 * 文本排版引擎的选项
 */
export interface TextLayoutOptions {
  screenConfig: ScreenConfig;
  fontSize: number;
  fontFamily: string;
  maxCharsPerLine?: number;
  maxLines?: number;
  enforceMaxLines?: boolean; // 是否强制限制为maxLines（如果为true，自动缩小字体以满足限制）
}

/**
 * 屏幕适配的选项
 */
export interface ScreenAdaptationOptions {
  screenWidth: number;
  screenHeight: number;
  customConfig?: Partial<ScreenConfig>;
}

/**
 * 预定义的屏幕配置
 */
export interface ScreenProfile {
  name: string;
  description: string;
  aspectRatio: string;
  config: ScreenConfig;
}

// =====================================================
// 9. 缓存和性能相关类型
// =====================================================

/**
 * 缓存项
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;  // 生存时间 (ms)
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalTime: number;
  layoutTime: number;
  classificationTime: number;
  batchingTime: number;
  effectMappingTime: number;
  animationTime: number;
  memoryUsage: number;
}

// =====================================================
// 10. 工具函数的参数和返回值类型
// =====================================================

/**
 * 字体度量结果
 */
export interface FontMetrics {
  width: number;
  height: number;
  ascent: number;
  descent: number;
  lineHeight: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 分析统计信息
 */
export interface AnalysisStatistics {
  textLength: number;
  wordCount: number;
  lineCount: number;
  batchCount: number;
  totalEffects: number;
  totalAnimationDuration: number;
  averageWordLength: number;
  maxLineLength: number;
}

// =====================================================
// 字幕模板相关类型
// =====================================================

/**
 * 字幕模板
 */
export interface SubtitleTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
  // ✨ 系统模板标识：1=系统模板，0=用户自定义
  is_system?: number;
  config: {
    // 基础字幕设置（普通字幕）
    subtitleStyleId?: string;
    subtitleStyle?: any;
    subtitleFontSizeScale: number;  // 字体大小缩放百分比
    subtitlePosition: 'top' | 'center' | 'bottom';  // 字幕位置

    // 特效开关
    enableKeywordEffects: boolean;
    keywordRenderMode?: 'floating' | 'inline-emphasis';

    // 关键词分组配置（特效字幕）
    keywordGroups: KeywordGroup[];
    keywordGroupsStyles?: any[];

    // 标题字幕配置（NEW!）
    titleSubtitleConfig?: TitleSubtitleConfig;

    // 屏幕和字体配置
    screenWidth: number;
    screenHeight: number;
    fontSize: number;
    fontFamily?: string;
  };
}

// =====================================================
// 标题字幕相关类型
// =====================================================

/**
 * 标题字幕行配置
 * 用于在视频顶部显示标题，每行可单独配置样式
 */
export interface TitleSubtitleLine {
  text: string;                      // 该行文本
  fontName: string;                  // 字体名称
  fontPath: string;                  // 完整字体路径（用于FFmpeg）
  fontSize: number;                  // 字体大小（像素）
  fontColor: string;                 // 文字颜色 (#RRGGBB)
  backgroundColor: string;           // 背景颜色 ('transparent' 或 #RRGGBB)
  backgroundOpacity: number;         // 背景透明度 (0-1)
  outlineColor: string;              // 描边颜色 (#RRGGBB)
  outlineWidth: number;              // 描边宽度 (0-10)
  shadowColor?: string;              // 阴影颜色 (#RRGGBB)
  shadowOffset?: number;             // 阴影偏移（像素）
  yOffsetPercent: number;            // Y坐标百分比 (0-100)，相对于视频高度
  alignment?: 'left' | 'center' | 'right'; // 行内对齐方式
  xOffsetPercent?: number;           // 横向锚点百分比 (0-100)
  maxWidthPercent?: number;          // 最大占宽百分比 (0-100)
}

/**
 * 标题字幕配置
 * 用于配置整个标题字幕系统
 */
export interface TitleSubtitleConfig {
  enabled: boolean;                  // 是否启用标题字幕
  sourceTitle: string;               // 源标题文本（从标题生成结果读取）
  maxCharsPerLine: number;           // 每行最大字符数 (默认 15)
  maxLines: number;                  // 最大行数限制 (默认 5)
  lineSpacingPercent: number;        // 行间距百分比，相对于视频高度 (默认 7%)
  topMarginPercent: number;          // 顶部边距百分比，相对于视频高度 (默认 5%)
  lines: TitleSubtitleLine[];        // 自动分割后的行配置

  // 时间范围控制
  startTime?: number;                // 开始显示时间（秒），默认 0
  endTime?: number;                  // 结束时间（秒），默认视频时长

  // 淡入淡出效果
  fadeInDuration?: number;           // 淡入时长（秒），默认 0
  fadeOutDuration?: number;          // 淡出时长（秒），默认 0
}
