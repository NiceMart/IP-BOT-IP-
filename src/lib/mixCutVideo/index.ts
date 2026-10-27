/**
 * 视频混剪功能 - 主导出
 */

export type {
  MixCutMode,
  SelectionMode,
  TimeRangeConfig,
  FixedPositionConfig,
  FixedModeConfig,
  KeywordGroupMixCutConfig,
  KeywordModeConfig,
  VideoMixCutConfig,
  MaterialReplacement,
  Material,
  SubtitleSegment,
  VideoMixCutResult
} from './types';

export { MaterialManager } from './MaterialManager';
export { FixedModeProcessor } from './FixedModeProcessor';
export { KeywordModeProcessor } from './KeywordModeProcessor';
export { SubtitleModeProcessor } from './SubtitleModeProcessor';
export { FFmpegCommandBuilder } from './FFmpegCommandBuilder';
export { SrtGenerator } from './SrtGenerator';
