/**
 * 智能排版引擎 - TextLayoutEngine
 * 负责根据屏幕配置和字体参数计算最优的文本布局
 */

import {
  ScreenConfig,
  TextLayout,
  LayoutLine,
  LayoutWord,
  TextLayoutOptions,
  FontMetrics,
  ValidationResult,
  SafeMargin
} from '../../types/smartSubtitle';

/**
 * 字体度量工具
 * 使用Canvas API精确计算文字宽度和高度
 */
class FontMetricsCalculator {
  private canvas: OffscreenCanvas | HTMLCanvasElement;
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private cache: Map<string, FontMetrics> = new Map();

  constructor() {
    // 服务端环境中，创建canvas
    try {
      this.canvas = new OffscreenCanvas(1024, 512);
      this.ctx = this.canvas.getContext('2d')!;
    } catch {
      // 降级方案：如果OffscreenCanvas不可用，创建DOM canvas
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d')!;
    }
  }

  /**
   * 计算文本的字体度量
   */
  measureText(text: string, fontFamily: string, fontSize: number): FontMetrics {
    const cacheKey = `${text}_${fontFamily}_${fontSize}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = this.ctx.measureText(text);

    // 检测是否为多语言字符（CJK、韩文、日文等）
    const hasMultilingualChars = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);

    // 多语言字体需要更大的行高倍数（1.4-1.5），普通字体使用1.2
    const lineHeightMultiplier = hasMultilingualChars ? 1.5 : 1.2;

    const result: FontMetrics = {
      width: metrics.width,
      height: fontSize,
      ascent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
      descent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
      lineHeight: fontSize * lineHeightMultiplier
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 计算单个字符的宽度
   */
  measureCharWidth(char: string, fontFamily: string, fontSize: number): number {
    return this.measureText(char, fontFamily, fontSize).width;
  }

  /**
   * 判断文本是否为中文字符
   */
  isChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
  }

  /**
   * 计算显示长度（中文=1，英文=0.5）
   */
  calculateDisplayLength(text: string): number {
    let length = 0;
    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        length += 1;  // 中文字符
      } else if (/[a-zA-Z]/.test(char)) {
        length += 0.5;  // 英文字母
      }
    }
    return length;
  }
}

/**
 * 智能排版引擎核心类
 */
export class TextLayoutEngine {
  private metricsCalculator: FontMetricsCalculator;
  private keywordDatabase: Set<string>;
  private punctuations = ['，', '。', '！', '？', '；', '：', ',', '.', '!', '?', ';', ':'];

  constructor() {
    this.metricsCalculator = new FontMetricsCalculator();
    this.keywordDatabase = new Set();
    this.initializeKeywordDatabase();
  }

  /**
   * 初始化关键词数据库（常见成语、固定搭配）
   */
  private initializeKeywordDatabase(): void {
    const keywords = [
      // 成语
      '出类拔萃', '如火如荼', '众志成城', '厚积薄发',
      '不负韶华', '砥砺前行', '破浪前行', '乘风破浪',
      // 固定搭配
      '人工智能', '机器学习', '深度学习', '神经网络',
      '大数据', '云计算', '物联网', '区块链',
      // 添加更多内容
    ];
    keywords.forEach(k => this.keywordDatabase.add(k));
  }

  /**
   * 主入口：计算文本布局（支持2行硬限制）
   */
  calculateLayout(
    text: string,
    options: TextLayoutOptions
  ): TextLayout {
    const startTime = performance.now();

    // 1. 验证输入
    const validation = this.validateInput(text, options);
    if (!validation.isValid) {
      throw new Error(`输入验证失败: ${validation.errors.join(', ')}`);
    }

    // 2. 如果启用2行硬限制，使用优先级排版方法
    if (options.enforceMaxLines === true) {
      const layout = this.calculateLayoutWithHardLimit(text, options);
      const processingTime = performance.now() - startTime;
      console.log(`[TextLayoutEngine] 排版耗时(硬限制): ${processingTime.toFixed(2)}ms`);
      return layout;
    }

    // 3. 计算屏幕容量（可用宽度和高度）
    const screenCapacity = this.calculateScreenCapacity(options.screenConfig);

    // 4. 智能换行
    const lines = this.smartLineBreak(
      text,
      options.fontSize,
      options.fontFamily,
      screenCapacity.maxWidth,
      screenCapacity.maxChars
    );

    // 5. 检测是否超出屏幕
    const exceedsScreen = lines.length > options.screenConfig.maxLines;
    if (exceedsScreen) {
      // 如果超出，需要分批展示
    }

    // 6. 构建布局结果
    const layout = this.buildLayout(
      text,
      lines,
      options.fontSize,
      options.fontFamily,
      screenCapacity.maxHeight,
      exceedsScreen,
      screenCapacity.maxWidth
    );

    const processingTime = performance.now() - startTime;
    console.log(`[TextLayoutEngine] 排版耗时: ${processingTime.toFixed(2)}ms`);

    return layout;
  }

  /**
   * 2行硬限制排版 - 自动缩小字体直到不超过最大行数
   * 最大行数硬限制为2行
   */
  private calculateLayoutWithHardLimit(
    text: string,
    options: TextLayoutOptions
  ): TextLayout {
    const screenCapacity = this.calculateScreenCapacity(options.screenConfig);
    const maxLinesLimit = 2; // 硬限制为2行
    const minFontSize = 24; // 最小字体大小
    const fontSizeStep = 2; // 每次缩小2px

    let currentFontSize = options.fontSize;
    let lines: string[] = [];
    let iterationCount = 0;
    const maxIterations = (options.fontSize - minFontSize) / fontSizeStep + 5;

    // 循环缩小字体直到不超过2行
    while (iterationCount < maxIterations) {
      lines = this.smartLineBreak(
        text,
        currentFontSize,
        options.fontFamily,
        screenCapacity.maxWidth,
        screenCapacity.maxChars
      );

      // 检查是否满足条件
      if (lines.length <= maxLinesLimit) {
        // 成功！布局不超过2行
        const layout = this.buildLayout(
          text,
          lines,
          currentFontSize,
          options.fontFamily,
          screenCapacity.maxHeight,
          false,
          screenCapacity.maxWidth
        );

        // 记录是否进行了字体缩放
        if (currentFontSize < options.fontSize) {
          console.warn(
            `[TextLayoutEngine] 字体已缩小: ${options.fontSize}px -> ${currentFontSize}px, ` +
            `行数: ${lines.length}`
          );
        }

        return layout;
      }

      // 继续缩小字体
      currentFontSize -= fontSizeStep;
      iterationCount++;

      if (currentFontSize < minFontSize) {
        // 无法继续缩小，使用压缩策略
        console.warn(
          `[TextLayoutEngine] 字体已达最小值${minFontSize}px，仍超过2行，` +
          `应用文本压缩策略`
        );
        return this.calculateLayoutWithCompression(
          text,
          options,
          minFontSize,
          screenCapacity,
          maxLinesLimit
        );
      }
    }

    // 超时降级方案
    console.error(`[TextLayoutEngine] 排版算法超时，返回最后结果`);
    return this.buildLayout(
      text,
      lines,
      currentFontSize,
      options.fontFamily,
      screenCapacity.maxHeight,
      true,
      screenCapacity.maxWidth
    );
  }

  /**
   * 文本压缩策略 - 当字体已达最小值仍无法满足2行限制时
   * 采用省略号截断的方式
   */
  private calculateLayoutWithCompression(
    text: string,
    options: TextLayoutOptions,
    fontSize: number,
    screenCapacity: { maxWidth: number; maxHeight: number; maxChars: number },
    maxLines: number
  ): TextLayout {
    const truncationSuffix = '...';
    let truncatedText = text;
    let lines: string[] = [];

    // 二分查找最长的可显示文本
    let left = 0;
    let right = text.length;

    while (left < right) {
      const mid = Math.ceil((left + right) / 2);
      const candidate = text.substring(0, mid) + truncationSuffix;

      const candidateLines = this.smartLineBreak(
        candidate,
        fontSize,
        options.fontFamily,
        screenCapacity.maxWidth,
        screenCapacity.maxChars
      );

      if (candidateLines.length <= maxLines) {
        left = mid;
        truncatedText = candidate;
      } else {
        right = mid - 1;
      }
    }

    lines = this.smartLineBreak(
      truncatedText,
      fontSize,
      options.fontFamily,
      screenCapacity.maxWidth,
      screenCapacity.maxChars
    );

    console.warn(
      `[TextLayoutEngine] 文本已被压缩: "${text}" -> "${truncatedText}", ` +
      `行数: ${lines.length}`
    );

    return this.buildLayout(
      truncatedText,
      lines,
      fontSize,
      options.fontFamily,
      screenCapacity.maxHeight,
      false,
      screenCapacity.maxWidth
    );
  }

  /**
   * 智能换行算法 - 贪心算法+关键词保护
   */
  private smartLineBreak(
    text: string,
    fontSize: number,
    fontFamily: string,
    maxWidth: number,
    maxChars: number
  ): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let currentLineWidth = 0;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const charWidth = this.metricsCalculator.measureCharWidth(char, fontFamily, fontSize);

      // 检查是否可以继续添加
      const wouldExceed = currentLineWidth + charWidth > maxWidth;
      const isPunctuation = this.punctuations.includes(char);
      const isNearMaxChars = currentLine.length >= maxChars * 0.8;

      if (wouldExceed || (isPunctuation && isNearMaxChars)) {
        // 需要换行
        if (currentLine) {
          // 优先在标点符号后换行
          if (isPunctuation) {
            currentLine += char;
            lines.push(currentLine);
            currentLine = '';
            currentLineWidth = 0;
            i++;
          } else {
            // 避免单字独占一行
            const lastChar = currentLine[currentLine.length - 1];
            if (this.isSingleCharWord(lastChar) && currentLine.length > 1) {
              // 把最后一个字移到下一行
              lines.push(currentLine.slice(0, -1));
              currentLine = lastChar + char;
              currentLineWidth = this.metricsCalculator.measureCharWidth(lastChar, fontFamily, fontSize) +
                                 charWidth;
              i++;
            } else {
              lines.push(currentLine);
              currentLine = char;
              currentLineWidth = charWidth;
              i++;
            }
          }
        } else {
          // 当前行为空，必须添加至少一个字符
          currentLine = char;
          currentLineWidth = charWidth;
          i++;
        }
      } else {
        // 继续添加到当前行
        currentLine += char;
        currentLineWidth += charWidth;
        i++;
      }
    }

    // 添加最后一行
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * 计算屏幕容量
   */
  private calculateScreenCapacity(screenConfig: ScreenConfig): {
    maxWidth: number;
    maxHeight: number;
    maxChars: number;
  } {
    const margin = screenConfig.safeMargin;

    // 计算可用宽度（减去安全边距）
    const availableWidth = screenConfig.width * (1 - margin.left / 100 - margin.right / 100);

    // 计算可用高度（减去安全边距）
    const availableHeight = screenConfig.height * (1 - margin.top / 100 - margin.bottom / 100);

    return {
      maxWidth: availableWidth,
      maxHeight: availableHeight,
      maxChars: screenConfig.maxCharsPerLine
    };
  }

  /**
   * 构建布局结果
   */
  private buildLayout(
    originalText: string,
    lines: string[],
    fontSize: number,
    fontFamily: string,
    maxHeight: number,
    exceedsScreen: boolean,
    maxWidth?: number
  ): TextLayout {
    const layoutLines: LayoutLine[] = [];
    let totalWidth = 0;
    let totalHeight = 0;
    let exceedsWidth = false;

    for (const lineText of lines) {
      const layoutLine = this.buildLayoutLine(lineText, fontSize, fontFamily);
      layoutLines.push(layoutLine);

      totalWidth = Math.max(totalWidth, layoutLine.width);
      totalHeight += layoutLine.height;

      // 检查行宽度是否超出最大宽度
      if (maxWidth && layoutLine.width > maxWidth) {
        exceedsWidth = true;
        console.warn(`[TextLayoutEngine] 第 ${layoutLines.length} 行宽度超出限制: ${layoutLine.width.toFixed(0)}px > ${maxWidth.toFixed(0)}px`);
      }
    }

    return {
      originalText,
      lines: layoutLines,
      totalWidth,
      totalHeight,
      exceedsScreen: exceedsScreen || totalHeight > maxHeight || exceedsWidth,
      lineCount: layoutLines.length
    };
  }

  /**
   * 构建单行布局
   */
  private buildLayoutLine(
    text: string,
    fontSize: number,
    fontFamily: string
  ): LayoutLine {
    const words: LayoutWord[] = [];
    let totalWidth = 0;
    let x = 0;
    let maxLineHeight = 0;

    for (const char of text) {
      const metrics = this.metricsCalculator.measureText(char, fontFamily, fontSize);
      words.push({
        text: char,
        width: metrics.width,
        height: metrics.height,
        x
      });
      x += metrics.width;
      totalWidth += metrics.width;
      // 使用实际计算的行高（已考虑多语言字符）
      maxLineHeight = Math.max(maxLineHeight, metrics.lineHeight);
    }

    return {
      text,
      words,
      width: totalWidth,
      height: maxLineHeight || fontSize * 1.2,  // 使用动态计算的行高
      exceeds: false  // 宽度检查已在 buildLayout 中进行
    };
  }

  /**
   * 验证输入
   */
  private validateInput(text: string, options: TextLayoutOptions): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!text || text.length === 0) {
      errors.push('文本不能为空');
    }

    if (!options.screenConfig || options.screenConfig.width <= 0) {
      errors.push('屏幕宽度必须大于0');
    }

    if (options.fontSize <= 0) {
      errors.push('字体大小必须大于0');
    }

    if (!options.fontFamily) {
      warnings.push('未指定字体，使用默认字体');
      options.fontFamily = 'Arial, sans-serif';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: []
    };
  }

  /**
   * 判断是否为需要保护的单字
   */
  private isSingleCharWord(char: string): boolean {
    const singleChars = new Set(['的', '了', '吗', '呢', '啊', '哦', '呀', '啦']);
    return singleChars.has(char);
  }

  /**
   * 检查文本是否包含关键词
   */
  hasKeywords(text: string): boolean {
    for (const keyword of this.keywordDatabase) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取关键词列表
   */
  getKeywords(text: string): string[] {
    const keywords: string[] = [];
    for (const keyword of this.keywordDatabase) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }
    return keywords;
  }

  /**
   * 添加自定义关键词
   */
  addKeyword(keyword: string): void {
    this.keywordDatabase.add(keyword);
  }

  /**
   * 批量添加关键词
   */
  addKeywords(keywords: string[]): void {
    keywords.forEach(k => this.keywordDatabase.add(k));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.metricsCalculator.clearCache();
  }
}

/**
 * 导出单例实例
 */
export const textLayoutEngine = new TextLayoutEngine();
