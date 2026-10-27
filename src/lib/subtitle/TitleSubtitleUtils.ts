/**
 * 标题字幕工具函数
 * 用于处理标题的自动换行、样式生成等功能
 */

import type { TitleSubtitleConfig, TitleSubtitleLine } from '@/types/smartSubtitle';

/**
 * 按字符数自动分割标题为多行
 * @param title 完整标题文本
 * @param maxCharsPerLine 每行最大字符数
 * @param maxLines 最大行数限制（默认5行）
 * @returns 分割后的行数组
 */
export function splitTitleIntoLines(
  title: string,
  maxCharsPerLine: number,
  maxLines: number = 5
): string[] {
  if (!title || title.trim().length === 0) {
    return [];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const char of title) {
    // 检查是否达到最大行数
    if (lines.length >= maxLines - 1 && currentLine.length >= maxCharsPerLine) {
      // 达到最大行数，剩余内容截断并添加省略号
      lines.push(currentLine + '...');
      console.warn(`[TitleSubtitleUtils] 标题过长，已截断至${maxLines}行`);
      break;
    }

    if (currentLine.length >= maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine += char;
    }
  }

  if (currentLine.length > 0 && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * 根据配置生成完整的标题字幕行配置
 * @param config 标题字幕配置
 * @param videoWidth 视频宽度（用于屏幕适配）
 * @param videoHeight 视频高度（用于屏幕适配）
 * @returns 完整的行配置数组
 */
export function generateTitleLines(
  config: TitleSubtitleConfig,
  videoWidth: number,
  videoHeight: number
): TitleSubtitleLine[] {
  const textLines = splitTitleIntoLines(
    config.sourceTitle,
    config.maxCharsPerLine,
    config.maxLines
  );

  if (textLines.length === 0) {
    return [];
  }

  // 屏幕适配：检查是否超出屏幕上半部分
  const estimatedHeightPercent = textLines.length * config.lineSpacingPercent + config.topMarginPercent;
  let adjustedLineSpacing = config.lineSpacingPercent;

  if (estimatedHeightPercent > 40) { // 不超过屏幕上半部分（40%）
    adjustedLineSpacing = (40 - config.topMarginPercent) / textLines.length;
    console.warn(
      `[TitleSubtitleUtils] 标题字幕过多，自动调整行间距: ${config.lineSpacingPercent}% -> ${adjustedLineSpacing.toFixed(1)}%`
    );
  }

  return textLines.map((text, index) => {
    // 如果已有该行配置，保留样式；否则使用默认样式
    const existingLine = config.lines[index];
    const yOffsetPercent = config.topMarginPercent + (index * adjustedLineSpacing);

    // 获取字体名称（确保使用 existingLine 中的 fontName，如果存在的话）
    const fontName = existingLine?.fontName || 'Microsoft YaHei Bold';
    // ✅ 修复：优先使用 existingLine 中已有的 fontPath，只有没有时才重新获取
    // 这样可以保留用户在 UI 中选择字体时异步获取的正确路径
    const fontPath = existingLine?.fontPath || getFontPath(fontName);

    return existingLine ? {
      ...existingLine,
      text,
      fontName,
      fontPath,  // ✅ 现在优先使用原有的 fontPath
      yOffsetPercent
    } : {
      text,
      fontName,
      fontPath,
      fontSize: 56,
      fontColor: '#FFFFFF',
      backgroundColor: 'transparent',
      backgroundOpacity: 0,
      outlineColor: '#000000',
      outlineWidth: 3,
      shadowColor: '#000000',
      shadowOffset: 2,
      yOffsetPercent,
      alignment: 'center',
      xOffsetPercent: 50,
      maxWidthPercent: 72
    };
  });
}

/**
 * 获取字体完整路径
 * 只使用项目 ziti/ 目录下的字体，不使用系统字体
 * @param fontName 字体名称
 * @returns 字体文件完整路径
 */
export function getFontPath(fontName: string): string {
  try {
    // 查询字体管理器获取完整路径
    const fontInfo = (window as any).$mapi?.fontManager?.getFontByName?.(fontName);
    if (fontInfo && fontInfo.path) {
      return fontInfo.path;
    }
  } catch (error) {
    console.warn(`[TitleSubtitleUtils] 获取字体路径失败: ${fontName}`, error);
  }

  // 回退到 ziti 目录下的默认字体
  // 不使用系统字体
  const defaultFont = 'C:/aigcpanel-main/ziti/微软雅黑.ttf';
  console.warn(`[TitleSubtitleUtils] 未找到字体 ${fontName}，使用默认字体: ${defaultFont}`);
  return defaultFont;
}

/**
 * 获取默认的标题字幕配置
 * @returns 默认配置
 */
export function getDefaultTitleSubtitleConfig(): TitleSubtitleConfig {
  return {
    enabled: false,
    sourceTitle: '',
    maxCharsPerLine: 15,
    maxLines: 5,
    lineSpacingPercent: 7,
    topMarginPercent: 5,
    lines: [],
    startTime: 0,
    fadeInDuration: 0,
    fadeOutDuration: 0
  };
}
