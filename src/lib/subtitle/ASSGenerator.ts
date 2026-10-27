// @ts-nocheck
/**
 * ASS字幕文件生成器
 * 生成符合ASS v4+标准的字幕文件
 */

import type {
  ASSFileConfig,
  ASSStyleConfig,
  ASSDialogueEvent,
  ArrangedSubtitle,
  RenderStyle
} from '@/service/ZimuShengcheng.types';

export class ASSGenerator {
  /**
   * 生成完整的ASS字幕文件内容
   * @param events 对话事件列表
   * @param styles 样式配置列表
   * @param config 文件配置
   * @returns ASS文件内容（字符串）
   */
  static generate(
    events: ASSDialogueEvent[],
    styles: ASSStyleConfig[],
    config: ASSFileConfig
  ): string {
    const sections: string[] = [];

    // 1. 脚本信息段
    sections.push(this.generateHeader(config));

    // 2. 样式定义段
    sections.push(this.generateStyles(styles));

    // 3. 事件段
    sections.push(this.generateEvents(events));

    return sections.join('\n\n');
  }

  /**
   * 生成ASS文件头（Script Info）
   */
  static generateHeader(config: ASSFileConfig): string {
    return `[Script Info]
; 由 ZimuShengcheng 自动生成
Title: Generated Subtitle
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${config.width}
PlayResY: ${config.height}
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709`;
  }

  /**
   * 生成样式定义段（V4+ Styles）
   */
  static generateStyles(styles: ASSStyleConfig[]): string {
    const lines: string[] = [];

    lines.push('[V4+ Styles]');
    lines.push('Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding');

    for (const style of styles) {
      lines.push(this.formatStyle(style));
    }

    return lines.join('\n');
  }

  /**
   * 格式化单个样式定义
   */
  static formatStyle(style: ASSStyleConfig): string {
    return `Style: ${style.name},${style.fontname},${style.fontsize},${style.primaryColour},${style.secondaryColour},${style.outlineColour},${style.backColour},${style.bold},${style.italic},0,0,100,100,0,0,${style.borderStyle},${style.outline},${style.shadow},${style.alignment},${style.marginL},${style.marginR},${style.marginV},1`;
  }

  /**
   * 生成事件段（Events）
   */
  static generateEvents(events: ASSDialogueEvent[]): string {
    const lines: string[] = [];

    lines.push('[Events]');
    lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text');

    for (const event of events) {
      lines.push(this.formatDialogue(event));
    }

    return lines.join('\n');
  }

  /**
   * 格式化单个对话事件
   */
  static formatDialogue(event: ASSDialogueEvent): string {
    const marginL = event.marginL !== undefined ? event.marginL : 0;
    const marginR = event.marginR !== undefined ? event.marginR : 0;
    const marginV = event.marginV !== undefined ? event.marginV : 0;
    const effect = event.effect || '';

    return `Dialogue: ${event.layer},${event.start},${event.end},${event.style},,${marginL},${marginR},${marginV},${effect},${event.text}`;
  }

  /**
   * 将秒数转换为ASS时间格式（H:MM:SS.mm）
   * @param seconds 秒数（浮点数）
   * @returns ASS时间格式字符串
   */
  static formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const centiseconds = Math.floor((secs - Math.floor(secs)) * 100);

    return `${hours}:${String(minutes).padStart(2, '0')}:${String(Math.floor(secs)).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }

  /**
   * 将十六进制颜色转换为ASS颜色格式（&HAABBGGRR）
   * @param hexColor 十六进制颜色（#RRGGBB）
   * @param opacity 不透明度（0-1，默认1）
   * @returns ASS颜色格式
   */
  static convertColorToASS(hexColor: string, opacity: number = 1): string {
    // 移除#前缀
    const rawHex = hexColor.replace('#', '');
    const hex = rawHex.length === 8 ? rawHex.slice(0, 6) : rawHex;

    // 提取RGB
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);

    // 计算Alpha通道（0=不透明，255=完全透明）
    const alpha = Math.round((1 - opacity) * 255);
    const alphaHex = alpha.toString(16).padStart(2, '0').toUpperCase();

    // ASS格式：&HAABBGGRR（注意BGR顺序）
    return `&H${alphaHex}${b}${g}${r}`;
  }

  /**
   * 将RenderStyle转换为ASSStyleConfig
   * @param name 样式名称
   * @param renderStyle 渲染样式
   * @param videoHeight 视频高度（用于计算位置）
   * @returns ASS样式配置
   */
  static convertRenderStyleToASS(
    name: string,
    renderStyle: RenderStyle,
    videoHeight: number
  ): ASSStyleConfig {
    // 转换颜色
    const primaryColour = this.convertColorToASS(renderStyle.fontColor, 1);
    const outlineColour = this.convertColorToASS(renderStyle.outlineColor, 1);
    const backColour = renderStyle.backgroundColor
      ? this.convertColorToASS(renderStyle.backgroundColor, renderStyle.backgroundOpacity || 0)
      : this.convertColorToASS('#000000', 0);

    // 对齐方式（数字键盘布局，默认底部居中=2）
    const alignment = 2;

    // 垂直边距（底部字幕）
    const marginV = Math.round(videoHeight * 0.1); // 距离底部10%

    return {
      name,
      fontname: renderStyle.fontName,
      fontsize: renderStyle.fontSize,
      primaryColour,
      secondaryColour: primaryColour, // 次要颜色通常与主要颜色相同
      outlineColour,
      backColour,
      bold: 0,
      italic: 0,
      borderStyle: 1, // 1=描边+阴影
      outline: renderStyle.outlineWidth,
      shadow: renderStyle.shadowOffset || 2,
      alignment,
      marginL: 10,
      marginR: 10,
      marginV
    };
  }

  /**
   * 从ArrangedSubtitle生成ASSDialogueEvent
   * @param subtitle 排列后的字幕
   * @param styleName 样式名称
   * @returns ASS对话事件
   */
  static subtitleToDialogue(
    subtitle: ArrangedSubtitle,
    styleName: string
  ): ASSDialogueEvent {
    return {
      layer: subtitle.type === 'normal' ? 0 : 1, // 特效字幕在上层
      start: this.formatTime(subtitle.start),
      end: this.formatTime(subtitle.end),
      style: styleName,
      text: subtitle.text,
      marginL: 0,
      marginR: 0,
      marginV: 0
    };
  }

  /**
   * 生成ASS高级标签命令
   * ASS支持的动画和特效标签
   */
  static generateEffectTags(config: {
    type: 'scale' | 'fade' | 'move' | 'rotate' | 'color';
    params: any;
  }): string {
    const tags: string[] = [];

    switch (config.type) {
      case 'scale':
        // 缩放动画：\fscx<百分比>\fscy<百分比>\t(<开始>,<结束>,\fscx<百分比>\fscy<百分比>)
        const { from, to, duration } = config.params;
        tags.push(`{\\fscx${from}\\fscy${from}\\t(0,${duration},\\fscx${to}\\fscy${to})}`);
        break;

      case 'fade':
        // 淡入淡出：\fad(<淡入时长>,<淡出时长>)
        const { fadeIn, fadeOut } = config.params;
        tags.push(`{\\fad(${fadeIn},${fadeOut})}`);
        break;

      case 'move':
        // 移动：\move(<x1>,<y1>,<x2>,<y2>[,<开始>,<结束>])
        const { x1, y1, x2, y2, start, end } = config.params;
        if (start !== undefined && end !== undefined) {
          tags.push(`{\\move(${x1},${y1},${x2},${y2},${start},${end})}`);
        } else {
          tags.push(`{\\move(${x1},${y1},${x2},${y2})}`);
        }
        break;

      case 'rotate':
        // 旋转：\frz<角度>\t(<开始>,<结束>,\frz<角度>)
        const { fromAngle, toAngle, rotDuration } = config.params;
        tags.push(`{\\frz${fromAngle}\\t(0,${rotDuration},\\frz${toAngle})}`);
        break;

      case 'color':
        // 颜色变化：\c&H<BBGGRR>&\t(<开始>,<结束>,\c&H<BBGGRR>&)
        const { color1, color2, colorDuration } = config.params;
        tags.push(`{\\c${color1}\\t(0,${colorDuration},\\c${color2})}`);
        break;
    }

    return tags.join('');
  }

  /**
   * 生成缩放弹出效果（常用于关键词特效）
   * @param text 文本
   * @param x X坐标
   * @param y Y坐标
   * @param color ASS颜色
   * @returns 带特效标签的文本
   */
  static generateScaleEffect(
    text: string,
    x: number,
    y: number,
    color: string
  ): string {
    // 从50%缩放到150%，然后回到100%
    return `{\\pos(${x},${y})\\fscx50\\fscy50\\t(0,200,\\fscx150\\fscy150)\\t(200,400,\\fscx100\\fscy100)\\c${color}}${text}`;
  }

  /**
   * 生成颜色闪烁效果
   * @param text 文本
   * @param x X坐标
   * @param y Y坐标
   * @param color1 颜色1（ASS格式）
   * @param color2 颜色2（ASS格式）
   * @returns 带特效标签的文本
   */
  static generateColorFlashEffect(
    text: string,
    x: number,
    y: number,
    color1: string,
    color2: string
  ): string {
    return `{\\pos(${x},${y})\\c${color1}\\t(0,200,\\c${color2})\\t(200,400,\\c${color1})}${text}`;
  }

  /**
   * 生成滑入效果
   * @param text 文本
   * @param startX 起始X坐标
   * @param startY 起始Y坐标
   * @param endX 结束X坐标
   * @param endY 结束Y坐标
   * @returns 带特效标签的文本
   */
  static generateSlideEffect(
    text: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): string {
    return `{\\move(${startX},${startY},${endX},${endY})}${text}`;
  }

  /**
   * 生成发光效果（通过阴影模拟）
   * @param text 文本
   * @param x X坐标
   * @param y Y坐标
   * @param glowColor 发光颜色（ASS格式）
   * @returns 带特效标签的文本
   */
  static generateGlowEffect(
    text: string,
    x: number,
    y: number,
    glowColor: string
  ): string {
    // 通过增大阴影和模糊来模拟发光
    return `{\\pos(${x},${y})\\3c${glowColor}\\3a&H00&\\blur5}${text}`;
  }

  /**
   * 将多个字幕批量转换为ASS事件
   * @param subtitles 字幕数组
   * @param normalStyleName 普通字幕样式名
   * @param effectStyleName 特效字幕样式名
   * @returns ASS对话事件数组
   */
  static batchSubtitlesToDialogues(
    subtitles: ArrangedSubtitle[],
    normalStyleName: string,
    effectStyleName: string
  ): ASSDialogueEvent[] {
    return subtitles.map(subtitle => {
      const styleName = subtitle.type === 'normal' ? normalStyleName : effectStyleName;
      return this.subtitleToDialogue(subtitle, styleName);
    });
  }

  /**
   * 保存ASS文件到磁盘（通过window.$mapi）
   * @param content ASS文件内容
   * @param filePath 文件路径
   */
  static async saveToFile(content: string, filePath: string): Promise<void> {
    // 确保使用UTF-8 BOM编码（ASS标准）
    const bom = '\uFEFF';
    const contentWithBOM = bom + content;

    if (typeof window !== 'undefined' && window.$mapi?.file?.saveFile) {
      await window.$mapi.file.saveFile(contentWithBOM, filePath);
    } else {
      // Node.js环境
      const fs = await import('fs');
      const util = await import('util');
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(filePath, contentWithBOM, { encoding: 'utf-8' });
    }

    console.log(`[ASSGenerator] ASS文件已保存: ${filePath}`);
  }
}

/**
 * ASS样式预设
 * 提供常用的样式配置模板
 */
export class ASSStylePresets {
  /**
   * 默认普通字幕样式
   */
  static getNormalStyle(videoHeight: number): ASSStyleConfig {
    return {
      name: 'Normal',
      fontname: 'Microsoft YaHei Bold',
      fontsize: 48,
      primaryColour: '&H00FFFFFF', // 白色
      secondaryColour: '&H000000FF',
      outlineColour: '&H00000000', // 黑色描边
      backColour: '&H80000000',    // 半透明黑色背景
      bold: 0,
      italic: 0,
      borderStyle: 1,
      outline: 3,
      shadow: 2,
      alignment: 2,                // 底部居中
      marginL: 10,
      marginR: 10,
      marginV: Math.round(videoHeight * 0.1)
    };
  }

  /**
   * 金色特效字幕样式
   */
  static getGoldEffectStyle(videoHeight: number): ASSStyleConfig {
    return {
      name: 'GoldEffect',
      fontname: 'Microsoft YaHei Bold',
      fontsize: 72,
      primaryColour: '&H0000D7FF', // 金色（BGR格式）
      secondaryColour: '&H000000FF',
      outlineColour: '&H00008CFF', // 深橙色描边
      backColour: '&H00000000',    // 无背景
      bold: 1,
      italic: 0,
      borderStyle: 1,
      outline: 4,
      shadow: 0,
      alignment: 8,                // 顶部居中
      marginL: 10,
      marginR: 10,
      marginV: Math.round(videoHeight * 0.2)
    };
  }

  /**
   * 蓝色特效字幕样式
   */
  static getBlueEffectStyle(videoHeight: number): ASSStyleConfig {
    return {
      name: 'BlueEffect',
      fontname: 'Microsoft YaHei Bold',
      fontsize: 72,
      primaryColour: '&H00FF8C00', // 蓝色
      secondaryColour: '&H000000FF',
      outlineColour: '&H00FF6B00', // 深蓝色描边
      backColour: '&H00000000',
      bold: 1,
      italic: 0,
      borderStyle: 1,
      outline: 4,
      shadow: 0,
      alignment: 8,
      marginL: 10,
      marginR: 10,
      marginV: Math.round(videoHeight * 0.2)
    };
  }
}
