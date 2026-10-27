/**
 * 视频混剪功能 - 核心类型定义
 */

// 混剪模式枚举
export type MixCutMode = 'fixed' | 'keyword' | 'subtitle';
export type SelectionMode = 'random' | 'sequential' | 'specified';

// 混剪显示模式枚举
export type MixCutDisplayMode = 'pip' | 'fullscreen';
// pip: 画中画模式 - 素材缩小后叠加在原视频上
// fullscreen: 全屏替换模式 - 素材全屏覆盖原视频画面,但保留原视频声音

// 画中画位置
export type PipPosition =
  | 'top-left'      // 左上角
  | 'top-center'    // 顶部居中
  | 'top-right'     // 右上角
  | 'center-left'   // 左侧居中
  | 'center'        // 正中间
  | 'center-right'  // 右侧居中
  | 'bottom-left'   // 左下角
  | 'bottom-center' // 底部居中
  | 'bottom-right'; // 右下角

// 画中画缩放模式 - 处理宽高比不匹配
export type PipScaleMode =
  | 'fit'      // 保持比例 + 黑边（推荐，不损失内容）
  | 'fill'     // 保持比例 + 裁剪（无黑边，可能切掉边角）
  | 'stretch'; // 强制拉伸（可能变形）

// 🆕 原视频形状（用于全屏替换模式下的小窗口显示）
export type OriginalVideoShape = 'square' | 'circle';

// 🆕 原视频小窗口位置（简化版，5个常用位置）
export type OriginalVideoPosition =
  | 'top-left'      // 左上角
  | 'top-right'     // 右上角
  | 'bottom-left'   // 左下角
  | 'bottom-right'  // 右下角
  | 'center';       // 正中间

// 🆕 原视频最小化配置（仅在 displayMode='fullscreen' 时有效）
export interface OriginalVideoMinimizedConfig {
  enabled: boolean;                      // 是否启用原视频最小化
  shape: OriginalVideoShape;             // 形状：方形/圆形
  position: OriginalVideoPosition;       // 位置（5选1）
  sizePercent: number;                   // 尺寸占比（10-50，默认25）
}


// 时间范围配置
export interface TimeRangeConfig {
  durationMin: number;
  durationMax: number;
}

// 🔧 修复：固定模式配置 - 支持画中画自定义
export interface FixedPositionConfig {
  enabled: boolean;
  timeRange: TimeRangeConfig;
  materialFolderPath: string;
  selectionMode?: SelectionMode;        // 🆕 素材选择模式：'random' | 'sequential' | 'specified'
  specifiedMaterialPath?: string;       // 🆕 指定素材文件路径（当 selectionMode='specified' 时使用）
  // 画中画配置（仅在 displayMode = 'pip' 时有效）
  displayMode?: MixCutDisplayMode;  // 显示模式：'pip' 或 'fullscreen'
  pipPosition?: PipPosition;         // 画中画位置（默认 'bottom-right'）
  pipSizePercent?: number;           // 画中画尺寸百分比（默认 30）
  pipScaleMode?: PipScaleMode;       // 缩放模式（默认 'fit'）
  // 🆕 原视频最小化配置（仅在 displayMode='fullscreen' 时使用）
  originalVideoMinimized?: OriginalVideoMinimizedConfig;
}


export interface FixedModeConfig {
  enabled: boolean;
  opening: FixedPositionConfig;
  middle: FixedPositionConfig;
  ending: FixedPositionConfig;
}

// 关键词模式配置
export interface KeywordGroupMixCutConfig {
  groupId: string;
  groupName: string;
  enabled: boolean;                      // 是否启用该分组（控制是否触发素材）
  materialFolderPath: string;
  durationMin: number;
  durationMax: number;
  selectionMode: SelectionMode;
  specifiedMaterialPath?: string;        // 🆕 指定素材文件路径（当 selectionMode='specified' 时使用）
  // 画中画配置（与固定模式保持一致）
  displayMode?: MixCutDisplayMode;      // 显示模式：'pip' 或 'fullscreen'（默认 'fullscreen'）
  pipPosition?: PipPosition;             // 画中画位置（默认 'bottom-right'）
  pipSizePercent?: number;               // 画中画尺寸百分比（默认 30）
  pipScaleMode?: PipScaleMode;           // 缩放模式（默认 'fit'）
  // 🆕 原视频最小化配置（仅在 displayMode='fullscreen' 时使用）
  originalVideoMinimized?: OriginalVideoMinimizedConfig;
}


export interface KeywordModeConfig {
  enabled: boolean;
  groups: KeywordGroupMixCutConfig[];
}

// 字幕-素材映射关系
export interface SubtitleMaterialMapping {
  subtitleIndices: number[];        // 字幕索引数组（支持多选）
  materialPath: string;             // 素材文件路径（当 selectionMode='specified' 时使用）
  isImage: boolean;                 // 是否为图片
  selectionMode?: SelectionMode;    // 🆕 素材选择模式：'random' | 'sequential' | 'specified'（默认 'specified'）
  materialFolderPath?: string;      // 🆕 素材文件夹路径（当 selectionMode='random'/'sequential' 时使用）
  displayMode?: MixCutDisplayMode;  // 显示模式（pip/fullscreen）
  pipPosition?: PipPosition;        // 画中画位置
  pipSizePercent?: number;          // 画中画尺寸百分比
  pipScaleMode?: PipScaleMode;      // 缩放模式
  originalVideoMinimized?: OriginalVideoMinimizedConfig;
}

// 字幕模式配置
export interface SubtitleModeConfig {
  enabled: boolean;
  mappings: SubtitleMaterialMapping[];
}

// 混剪配置
export interface VideoMixCutConfig {
  enabled: boolean;
  mode: MixCutMode;
  displayMode?: MixCutDisplayMode;  // 🔧 已废弃：改为在片头/片中/片尾各自设置 displayMode
  fixedModeConfig: FixedModeConfig;
  keywordModeConfig: KeywordModeConfig;
  subtitleModeConfig: SubtitleModeConfig;  // 🆕 字幕模式配置
  originalVideoPath?: string;
  subtitleFilePath?: string;
  videoResolution?: { width: number; height: number };
  outputPath?: string;
  records?: any[];  // 🆕 从步骤2传递的ASR数据
}

// 素材信息和替换点
export interface Material {
  path: string;
  name: string;
  duration: number;
  isImage?: boolean;  // 是否为图片素材（图片=静态，视频=动态）
}

export interface MaterialReplacement {
  startTime: number;
  duration: number;
  materialPath: string;
  materialDuration: number;
  materialStartOffset: number;
  reason: string;
  // 🔧 新增：每个素材的自定义配置
  displayMode?: MixCutDisplayMode;
  pipPosition?: PipPosition;
  pipSizePercent?: number;
  pipScaleMode?: PipScaleMode;
  isImage?: boolean;  // 是否为图片素材
  // 🆕 原视频最小化配置（仅在 displayMode='fullscreen' 时使用）
  originalVideoMinimized?: OriginalVideoMinimizedConfig;
}


// 字幕和关键词相关
export interface SubtitleSegment {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface KeywordItem {
  keyword: string;
  enabled?: boolean;
}

export interface KeywordGroup {
  id: string;
  name: string;
  description?: string;
  keywords?: KeywordItem[] | string[];
}

// 处理结果
export interface VideoMixCutResult {
  success: boolean;
  outputPath?: string;
  replacements?: MaterialReplacement[];
  message?: string;
}
