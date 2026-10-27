// @ts-nocheck
/**
 * FFmpeg drawtext命令生成器
 * 用于生成复杂的动画特效字幕
 */

import type {
  DrawtextConfig,
  ParticleConfig,
  WaveConfig,
  ArrangedSubtitle
} from '@/service/ZimuShengcheng.types';
import { generateEffect } from './effects';
import type { EffectParams } from './effects/EffectLibrary';
import { DrawtextUtils } from './DrawtextUtils';
import { getFontPath } from './TitleSubtitleUtils';

export interface StickerConfig {
  path: string;
  x: string | number;
  y: string | number;
  w?: number; // 目标宽度 (用于缩放)
  h?: number; // 目标高度
  startTime: number;
  endTime: number;
  opacity?: number;
}

export interface ArcTextConfig {
  text: string;
  centerX: number;
  centerY: number;
  radius: number;
  angleRange: number; // 弧度范围 (例如 Math.PI / 3)
  startTime: number;
  duration: number;
  fontsize: number;
  fontcolor: string;
}

export class DrawtextGenerator {
  private static clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private static estimateDisplayUnits(text: string): number {
    let units = 0;

    for (const char of text) {
      if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) {
        units += 1;
      } else if (/[\u0400-\u04ff]/.test(char)) {
        units += 0.72;
      } else if (/[A-Z]/.test(char)) {
        units += 0.72;
      } else if (/[a-z0-9]/.test(char)) {
        units += 0.58;
      } else if (/\s/.test(char)) {
        units += 0.32;
      } else {
        units += 0.42;
      }
    }

    return units;
  }

  private static estimateTextWidth(text: string, fontSize: number): number {
    return this.estimateDisplayUnits(text) * fontSize;
  }

  private static fitFontSizeToWidth(
    text: string,
    requestedFontSize: number,
    maxWidth: number,
    minFontSize: number
  ): number {
    const estimatedWidth = this.estimateTextWidth(text, requestedFontSize);
    if (!estimatedWidth || estimatedWidth <= maxWidth) {
      return requestedFontSize;
    }

    const scaledFontSize = Math.floor(requestedFontSize * (maxWidth / estimatedWidth));
    return this.clampNumber(scaledFontSize, minFontSize, requestedFontSize);
  }


  /**
   * 生成贴纸叠加滤镜 (overlay)
   * 注意：这需要调用者正确处理输入流标签 [main][sticker]overlay[out]
   */
  static generateStickerOverlay(config: StickerConfig): string {
    const parts: string[] = [];

    // 基础坐标
    parts.push(`x=${config.x}`);
    parts.push(`y=${config.y}`);

    // 时间控制
    parts.push(`enable='between(t,${config.startTime},${config.endTime})'`);

    // 叠加模式
    // parts.push('format=auto');

    return `overlay=${parts.join(':')}`;
  }

  /**
   * 生成缩放滤镜字符串
   * @param w 目标宽度
   * @param h 目标高度
   */
  static generateScaleFilter(w: number, h: number): string {
    return `scale=${w}:${h}`;
  }

  /**
   * 生成带缩放和透明度的复杂贴纸链
   * 返回: [input_sticker]scale=...[scaled];[main][scaled]overlay=...[out]
   * 这里只返回 overlay 部分的参数字符串，完整的滤镜链需要在 ZimuShengcheng 中构建
   */
  static generateOverlayParams(config: StickerConfig): string {
    return `x=${config.x}:y=${config.y}:enable='between(t,${config.startTime},${config.endTime})'`;
  }
  /**
   * 生成基础drawtext命令
   * @param config drawtext配置
   * @returns drawtext命令字符串
   */
  static generateBasic(config: DrawtextConfig): string {
    const parts: string[] = [];

    // FFmpeg drawtext 路径格式：转义冒号，不使用单引号（避免 Windows 命令行解析问题）
    // fontfile=C\:/Windows/Fonts/msyhbd.ttc
    parts.push(`fontfile=${this.escapePath(config.fontfile)}`);
    parts.push(`text='${this.escapeText(config.text)}'`);
    parts.push(`x='${config.x}'`);
    parts.push(`y='${config.y}'`);
    // 如果 fontsize 包含表达式字符（如 + - * / ( ) sin cos PI），则需要用引号包裹
    const fontsizeStr = String(config.fontsize);
    if (/[+\-*/()PI]|sin|cos|min|max|abs/.test(fontsizeStr)) {
      parts.push(`fontsize='${fontsizeStr}'`);
    } else {
      parts.push(`fontsize=${fontsizeStr}`);
    }
    parts.push(`fontcolor=${config.fontcolor}`);

    // borderw 不支持表达式，如果是表达式则只取固定值
    const borderwStr = String(config.borderw);
    if (/[+\-*/()a-z]/i.test(borderwStr)) {
      // 是表达式，提取第一个数字作为固定值
      const match = borderwStr.match(/\d+/);
      parts.push(`borderw=${match ? match[0] : 3}`);
    } else {
      parts.push(`borderw=${borderwStr}`);
    }

    parts.push(`bordercolor=${config.bordercolor}`);
    parts.push(`enable='${config.enable}'`);

    if (config.alpha) {
      parts.push(`alpha='${config.alpha}'`);
    }

    // 注意：angle 参数在部分 FFmpeg 版本中可能不支持
    // 如果 FFmpeg 支持 angle，可以在 overrides 中传入
    if (config.angle !== undefined) {
      parts.push(`angle=${config.angle}`);
    }

    if (config.shadowcolor) {
      parts.push(`shadowcolor=${config.shadowcolor}`);
      parts.push(`shadowx=${config.shadowx || 2}`);
      parts.push(`shadowy=${config.shadowy || 2}`);
    }

    return `drawtext=${parts.join(':')}`;
  }

  /**
   * 生成多层阴影drawtext命令序列
   * @param config drawtext配置
   * @param shadowLayers 多层阴影数据
   * @returns drawtext命令数组（包括阴影层 + 主文字）
   */
  static generateWithMultipleShadows(config: DrawtextConfig, shadowLayers?: any[]): string[] {
    const commands: string[] = [];

    // 如果有多层阴影，先生成阴影层
    if (shadowLayers && shadowLayers.length > 0) {
      shadowLayers.forEach((layer, index) => {
        if (layer.enabled !== false) {  // 默认启用
          // 生成阴影层（无描边，只有颜色和透明度）
          const parts: string[] = [];

          // 阴影层的位置 = 主文字位置 + 偏移
          const shadowX = typeof config.x === 'string' ? `${config.x}+${layer.offsetX}` : `${config.x + layer.offsetX}`;
          const shadowY = typeof config.y === 'string' ? `${config.y}+${layer.offsetY}` : `${config.y + layer.offsetY}`;

          parts.push(`fontfile=${this.escapePath(config.fontfile)}`);
          parts.push(`text='${this.escapeText(config.text)}'`);
          parts.push(`x='${shadowX}'`);  // ✅ 使用阴影偏移后的位置
          parts.push(`y='${shadowY}'`);  // ✅ 使用阴影偏移后的位置

          const fontsizeStr = String(config.fontsize);
          if (/[+\-*/()PI]|sin|cos|min|max|abs/.test(fontsizeStr)) {
            parts.push(`fontsize='${fontsizeStr}'`);
          } else {
            parts.push(`fontsize=${fontsizeStr}`);
          }

          // 阴影层的颜色：转换hex为rgba格式并应用透明度
          const shadowColor = this.convertHexToDrawtext(layer.color);
          const shadowOpacity = (layer.opacity || 100) / 100;
          parts.push(`fontcolor='${shadowColor}@${shadowOpacity.toFixed(2)}'`);

          // 阴影层无描边
          parts.push(`borderw=0`);
          parts.push(`enable='${config.enable}'`);

          // 阴影的模糊度通过多个相邻的阴影层模拟（如果 blur > 0）
          if (layer.blur && layer.blur > 0) {
            // FFmpeg drawtext 本身不支持 blur，但我们可以使用 shadowx/shadowy 的内置阴影
            // 或者添加 boxblur 过滤器
            parts.push(`shadowcolor=${shadowColor}`);
            parts.push(`shadowx=${Math.min(layer.blur, 5)}`);
            parts.push(`shadowy=${Math.min(layer.blur, 5)}`);
          }

          commands.push(`drawtext=${parts.join(':')}`);
        }
      });
    }

    // 最后添加主文字（包含原始的单层阴影参数）
    commands.push(this.generateBasic(config));

    return commands;
  }

  /**
   * 生成普通字幕的drawtext命令（支持背景透明度和描边）
   * @param config drawtext配置
   * @param backgroundColor 背景颜色（#RRGGBB）
   * @param backgroundOpacity 背景不透明度（0-1，1为完全不透明）
   * @returns drawtext命令字符串
   */
  static generateNormalSubtitle(
    config: DrawtextConfig,
    backgroundColor?: string,
    backgroundOpacity?: number
  ): string {
    const parts: string[] = [];

    // FFmpeg drawtext 路径格式：转义冒号，不使用单引号（避免 Windows 命令行解析问题）
    // fontfile=C\:/Windows/Fonts/msyhbd.ttc
    parts.push(`fontfile=${this.escapePath(config.fontfile)}`);

    // 🔧 【修复】如果有背景，在文本前后添加空格使背景更宽敞
    // 前后各添加4个半角空格，使背景框更明显
    // ZimuShengcheng.ts 中的宽度计算已经考虑了安全系数，不会超出屏幕
    let displayText = config.text;
    if (backgroundColor && backgroundOpacity !== undefined && backgroundOpacity > 0) {
      displayText = `    ${config.text}    `;  // 前后各4个半角空格
    }

    parts.push(`text='${this.escapeText(displayText)}'`);
    parts.push(`x='${config.x}'`);
    parts.push(`y='${config.y}'`);
    // 如果 fontsize 包含表达式字符（如 + - * / ( ) sin cos PI），则需要用引号包裹
    const fontsizeStr2 = String(config.fontsize);
    if (/[+\-*/()PI]|sin|cos|min|max|abs/.test(fontsizeStr2)) {
      parts.push(`fontsize='${fontsizeStr2}'`);
    } else {
      parts.push(`fontsize=${fontsizeStr2}`);
    }
    parts.push(`fontcolor=${config.fontcolor}`);

    // borderw 不支持表达式，如果是表达式则只取固定值
    const borderwStr2 = String(config.borderw);
    if (/[+\-*/()a-z]/i.test(borderwStr2)) {
      const match2 = borderwStr2.match(/\d+/);
      parts.push(`borderw=${match2 ? match2[0] : 3}`);
    } else {
      parts.push(`borderw=${borderwStr2}`);
    }

    parts.push(`bordercolor=${config.bordercolor}`);
    parts.push(`enable='${config.enable}'`);

    // 如果设置了背景颜色和透明度，添加背景框
    let hasBackground = false;
    if (backgroundColor && backgroundOpacity !== undefined) {
      // 【修复】确保背景颜色是有效的十六进制格式
      let bgColorHex = backgroundColor.replace('#', '').toUpperCase();

      // 如果颜色值是 "TRANSPARENT" 或其他无效值，使用黑色
      if (bgColorHex === 'TRANSPARENT' || bgColorHex === '' || !/^[0-9A-F]{6}$/.test(bgColorHex)) {
        bgColorHex = '000000';  // 使用黑色作为默认值
      }

      const bgOpacity = Math.max(0, Math.min(1, backgroundOpacity)); // 确保在0-1范围内

      // 只有透明度大于0时才显示背景框
      if (bgOpacity > 0) {
        parts.push(`box=1`);
        parts.push(`boxcolor=0x${bgColorHex}@${bgOpacity.toFixed(2)}`);
        parts.push(`boxborderw=0`);  // 背景框不需要边框

        hasBackground = true;  // 标记已启用背景
      }
    }

    if (config.alpha) {
      parts.push(`alpha='${config.alpha}'`);
    }

    // 阴影与描边同时透传，保持与实际字幕样式一致
    if (config.shadowcolor) {
      parts.push(`shadowcolor=${config.shadowcolor}`);
      parts.push(`shadowx=${config.shadowx || 2}`);
      parts.push(`shadowy=${config.shadowy || 2}`);
    }

    // 🔧 添加 boxw 和 fix_bounds 参数（用于普通字幕的宽度限制和自动换行）
    // 【修复】当有背景时，不使用 boxw，让背景严格按照文本宽度计算
    // 只有无背景的字幕才使用 boxw 进行宽度限制和自动换行
    if (config.boxw !== undefined && config.boxw > 0 && !hasBackground) {
      parts.push(`boxw=${config.boxw}`);
      if (config.fix_bounds !== undefined && config.fix_bounds > 0) {
        parts.push(`fix_bounds=${config.fix_bounds}`);
      }
    }

    // 【修复】允许在有背景时也使用行间距，以避免多行字幕重叠
    // 使用较小的行间距值（由 ZimuShengcheng.ts 控制）可以平衡背景框大小和字幕间距
    if (config.line_spacing !== undefined && config.line_spacing > 0) {
      parts.push(`line_spacing=${config.line_spacing}`);
    }

    return `drawtext=${parts.join(':')}`;
  }

  /**
   * 生成滑入动画效果
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @param direction 滑入方向
   * @returns drawtext命令
   */
  static generateSlideIn(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    direction: 'up' | 'down' | 'left' | 'right'
  ): string {
    const centerX = subtitle.position.x;
    const centerY = subtitle.position.y;
    const start = subtitle.start;
    const end = subtitle.end;
    const duration = end - start;
    // 🔧 修复：去掉0.8秒的硬编码上限，允许动画时长与字幕显示时长相适应
    // 过渡时长为字幕时长的40%，这样即使字幕显示10秒，动画也会持续4秒
    const transitionDuration = duration * 0.4;

    let xExpr: string;
    let yExpr: string;

    switch (direction) {
      case 'up':
        xExpr = `${centerX}-(text_w/2)`;
        yExpr = `if(lt(t-${start},${transitionDuration}),${centerY}+300-((t-${start})/${transitionDuration})*300,${centerY})`;
        break;
      case 'down':
        xExpr = `${centerX}-(text_w/2)`;
        yExpr = `if(lt(t-${start},${transitionDuration}),${centerY}-300+((t-${start})/${transitionDuration})*300,${centerY})`;
        break;
      case 'left':
        xExpr = `if(lt(t-${start},${transitionDuration}),${centerX}+500-((t-${start})/${transitionDuration})*500,${centerX}-(text_w/2))`;
        yExpr = `${centerY}`;
        break;
      case 'right':
        xExpr = `if(lt(t-${start},${transitionDuration}),${centerX}-500+((t-${start})/${transitionDuration})*500,${centerX}-(text_w/2))`;
        yExpr = `${centerY}`;
        break;
    }

    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: subtitle.style.fontSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成粒子爆炸效果
   * @param config 粒子配置
   * @param fontfile 字体文件路径
   * @returns drawtext命令数组（每个粒子一条命令）
   */
  static generateParticleBurst(
    config: ParticleConfig,
    fontfile: string
  ): string[] {
    const commands: string[] = [];
    const angleStep = (Math.PI * 2) / config.particleCount;

    for (let i = 0; i < config.particleCount; i++) {
      const angle = i * angleStep;
      const speed = config.radius / config.duration;

      // 计算粒子轨迹
      const xExpr = `${config.centerX}+(${speed}*(t-${config.startTime}))*cos(${angle})`;
      const yExpr = `${config.centerY}+(${speed}*(t-${config.startTime}))*sin(${angle})`;

      // 淡出效果
      const alpha = `1-(t-${config.startTime})/${config.duration}`;

      commands.push(this.generateBasic({
        fontfile,
        text: config.text,
        x: xExpr,
        y: yExpr,
        fontsize: config.fontsize,
        fontcolor: config.fontcolor,
        borderw: 2,
        bordercolor: '0x000000',
        enable: `between(t,${config.startTime},${config.startTime + config.duration})`,
        alpha
      }));
    }

    return commands;
  }

  /**
   * 生成波浪效果
   * @param config 波浪配置
   * @param fontfile 字体文件路径
   * @returns drawtext命令
   */
  static generateWave(config: WaveConfig, fontfile: string): string {
    const xExpr = `${config.centerX}-(text_w/2)`;
    // ✅ 修复：使用相对时间 (t - startTime) 而不是全局时间 t
    const yExpr = `${config.baseY}+${config.amplitude}*sin(${config.frequency}*PI*(t-${config.startTime}))`;

    return this.generateBasic({
      fontfile,
      text: config.text,
      x: xExpr,
      y: yExpr,
      fontsize: config.fontsize,
      fontcolor: config.fontcolor,
      borderw: 3,
      bordercolor: '0x000000',
      enable: `between(t,${config.startTime},${config.startTime + config.duration})`
    });
  }

  /**
   * 生成缩放动画效果
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @param scalePattern 缩放模式
   * @returns drawtext命令
   */
  static generateScale(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    scalePattern: 'pulse' | 'bounce' | 'pop'
  ): string {
    const start = subtitle.start;
    const end = subtitle.end;

    const baseSize = subtitle.style.fontSize;
    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    // 【简化】直接显示，不使用 alpha 动画，确保特效立即可见
    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: baseSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成旋转动画效果
   * 【简化】直接显示，确保特效立即可见
   */
  static generateRotate(subtitle: ArrangedSubtitle, fontfile: string): string {
    const start = subtitle.start;
    const end = subtitle.end;
    const baseSize = subtitle.style.fontSize;
    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: baseSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成翻转动画效果
   * 【简化】直接显示，确保特效立即可见
   */
  static generateFlip(subtitle: ArrangedSubtitle, fontfile: string): string {
    const start = subtitle.start;
    const end = subtitle.end;
    const baseSize = subtitle.style.fontSize;
    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: baseSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成淡入淡出效果
   * 【简化】直接显示，确保特效立即可见
   */
  static generateFade(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    fadeInDuration: number = 0.3,
    fadeOutDuration: number = 0.3
  ): string {
    const start = subtitle.start;
    const end = subtitle.end;
    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: subtitle.style.fontSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成抖动效果
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @param intensity 强度（像素）
   * @returns drawtext命令
   */
  static generateShake(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    intensity: number = 5
  ): string {
    const start = subtitle.start;
    const end = subtitle.end;

    // 随机抖动表达式
    const xExpr = `${subtitle.position.x}-(text_w/2)+${intensity}*sin(50*PI*(t-${start}))`;
    const yExpr = `${subtitle.position.y}+${intensity}*cos(50*PI*(t-${start}))`;

    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: subtitle.style.fontSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 生成颜色闪烁特效
   * 【简化】直接显示，确保特效立即可见
   */
  static generateColorFlash(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    flashCount: number = 2
  ): string {
    const start = subtitle.start;
    const end = subtitle.end;
    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    return this.generateBasic({
      fontfile,
      text: subtitle.text,
      x: xExpr,
      y: yExpr,
      fontsize: subtitle.style.fontSize,
      fontcolor: color,
      borderw: subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${start},${end})`
    });
  }

  /**
   * 🔧 新增：生成发光特效
   * @private
   */
  static generateGlow(
    subtitle: ArrangedSubtitle,
    fontfile: string
  ): string {
    const start = subtitle.start;
    const end = subtitle.end;

    const xExpr = `${subtitle.position.x}-(text_w/2)`;
    const yExpr = `${subtitle.position.y}`;
    const color = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

    // 发光效果：增加描边宽度和shadowcolor
    const parts: string[] = [];
    parts.push(`fontfile=${this.escapePath(fontfile)}`);
    parts.push(`text='${this.escapeText(subtitle.text)}'`);
    parts.push(`x='${xExpr}'`);
    parts.push(`y='${yExpr}'`);
    parts.push(`fontsize=${subtitle.style.fontSize}`);
    parts.push(`fontcolor=${color}`);
    parts.push(`borderw=${(subtitle.style.outlineWidth || 1) * 2}`); // 增加描边宽度
    parts.push(`bordercolor=${borderColor}`);
    parts.push(`shadowcolor=0x${color.substring(2)}`); // 添加阴影颜色
    parts.push(`shadowx=2`);
    parts.push(`shadowy=2`);
    parts.push(`enable='between(t,${start},${end})'`);
    return `drawtext=${parts.join(':')}`;
  }

  /**
   * 🆕 生成运动模糊拖尾特效（从小到大缩放+发光）
   * @private
   */
  static generateMotionBlurTrail(
    subtitle: ArrangedSubtitle,
    fontfile: string
  ): string[] {
    const commands: string[] = [];
    const layerCount = 5; // 层数（包含主文字）
    const duration = subtitle.end - subtitle.start;
    const relTime = `(t-${subtitle.start})`;

    // 每层有不同的缩放速度和发光强度
    for (let i = 0; i < layerCount; i++) {
      const layerProgress = i / (layerCount - 1); // 0.0 to 1.0
      const delay = layerProgress * 0.2; // 每层延迟0-0.2秒

      // 缩放动画：从0.3倍到1.2倍，再回到1.0倍
      // progress: 当前层的动画进度（考虑延迟）
      const progress = `max(0,min(1,(${relTime}-${delay})/${duration}))`;

      // 缩放曲线：0.3 -> 1.2 -> 1.0 (先快速放大，再稍微回缩)
      const scaleExpr = `if(lt(${progress},0.5),0.3+(1.2-0.3)*${progress}*2,1.2-(1.2-1.0)*(${progress}-0.5)*2)`;

      // 字体大小随缩放变化
      const fontSizeExpr = `${subtitle.style.fontSize}*${scaleExpr}`;

      // 透明度：越早出现的层越淡
      const alpha = 0.4 + layerProgress * 0.6; // 0.4 to 1.0

      // 发光强度：越大的字越亮
      const glowIntensity = Math.floor(2 + layerProgress * 4); // 2-6px描边

      const xExpr = `${subtitle.position.x}-(text_w/2)`;
      const yExpr = `${subtitle.position.y}-(text_h/2)`;
      const color = this.convertHexToDrawtext(subtitle.style.fontColor);
      const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);

      const parts: string[] = [];
      parts.push(`fontfile=${this.escapePath(fontfile)}`);
      parts.push(`text='${this.escapeText(subtitle.text)}'`);
      parts.push(`x='${xExpr}'`);
      parts.push(`y='${yExpr}'`);
      parts.push(`fontsize='${fontSizeExpr}'`); // 动态字体大小
      parts.push(`fontcolor=${color}`);
      parts.push(`alpha='${alpha}'`); // 渐变透明度
      parts.push(`borderw=${glowIntensity}`); // 发光描边
      parts.push(`bordercolor=${borderColor}`);

      // 添加阴影增强发光效果（仅对后面几层）
      if (i >= layerCount / 2) {
        parts.push(`shadowcolor=${color}`);
        parts.push(`shadowx=0`);
        parts.push(`shadowy=0`);
      }

      parts.push(`enable='between(t,${subtitle.start},${subtitle.end})'`);

      commands.push(`drawtext=${parts.join(':')}`);
    }

    console.log(`[DrawtextGenerator.generateMotionBlurTrail] 生成了 ${commands.length} 层缩放发光效果`);
    return commands;
  }

  /**
   * 🆕 生成弧形文字特效（从下到上扩散，带透明度动画）
   * @private
   */
  static generateArcText(
    config: {
      text: string;
      centerX: number;
      centerY: number;
      radius?: number;
      angleRange?: number;
      startTime: number;
      duration: number;
      fontsize: number;
      fontcolor: string;
    },
    fontfile: string
  ): string[] {
    const {
      text,
      centerX,
      centerY,
      radius = 1500,  // 🚀 大幅增加扩散距离：800 -> 1500，让文字扩散到差不多屏幕外
      angleRange = Math.PI / 1.0, // 🚀 增加扩散角度：150度 -> 180度（半圆），扩散范围更广
      startTime,
      duration,
      fontsize,
      fontcolor
    } = config;

    // 将文字拆分成单个字符
    const chars = text.split('');
    const charCount = chars.length;
    const commands: string[] = [];

    // 计算每个字符的角度
    const angleStep = angleRange / Math.max(charCount - 1, 1);
    const startAngle = -angleRange / 2; // 从左侧开始

    chars.forEach((char, index) => {
      // 计算字符的弧形位置
      const angle = startAngle + index * angleStep;

      // 字符在弧上的静态位置（最终位置）
      const finalX = centerX + radius * Math.sin(angle);
      const finalY = centerY - radius * Math.cos(angle); // 负号使弧形向上凸

      // 🎬 动画参数
      // 🔧 调整：动画时长改为 1.5秒（比0.8秒慢一些，避免扩散太快），同时受限于字幕总时长
      const moveDuration = Math.min(duration, 1.5);

      // 相对时间
      const relTime = `(t-${startTime})`;

      // 🔧 每个字符的延迟（从中间向两边扩散）
      const centerIndex = (charCount - 1) / 2;
      const distanceFromCenter = Math.abs(index - centerIndex);
      // 🔧 增加延迟间隔，让扩散感更强：0.02 -> 0.05
      const staggerDelay = distanceFromCenter * 0.05;

      // 📍 扇形扩散动画进度（0 -> 1）
      const moveProgress = `max(0,min(1,(${relTime}-${staggerDelay})/${moveDuration}))`;

      // 🔧 调整：从中心点（0）扩散到最终半径（100%），距离最大化
      const startRadius = 0;
      const radiusRange = radius - startRadius;
      const currentRadius = `(${startRadius}+${radiusRange}*${moveProgress})`;

      // 沿径向方向的X和Y位置（从小弧形向外扩散）
      const xExpr = `${centerX}+${currentRadius}*${Math.sin(angle)}-(text_w/2)`;
      const yExpr = `${centerY}-${currentRadius}*${Math.cos(angle)}`;

      // 💫 透明度动画：从淡到明显，扩散到边缘再淡
      // 0% - 50%: 随着扩散进度淡入 (0.0 -> 1.0)
      // 50% - 90%: 保持完全可见 (1.0)
      // 90% - 100%: 扩散到最后阶段淡出 (1.0 -> 0.0)

      const fadeInProgress = `min(${moveProgress}*2,1)`; // 前 50% 进度完成淡入 
      const fadeOutThreshold = 0.9;
      const fadeOutProgress = `if(gt(${moveProgress},${fadeOutThreshold}),(1-(${moveProgress}-${fadeOutThreshold})/(1-${fadeOutThreshold})),1)`;

      const alphaExpr = `(${fadeInProgress})*(${fadeOutProgress})`;

      // 生成drawtext命令
      const parts: string[] = [];
      parts.push(`fontfile=${this.escapePath(fontfile)}`);
      parts.push(`text='${this.escapeText(char)}'`);
      parts.push(`x='${xExpr}'`); // 径向X位置
      parts.push(`y='${yExpr}'`); // 径向Y位置
      parts.push(`fontsize=${fontsize}`);
      parts.push(`fontcolor=${fontcolor}`);
      parts.push(`alpha='${alphaExpr}'`); // 透明度动画
      parts.push(`borderw=3`);
      parts.push(`bordercolor=0x000000`);
      parts.push(`enable='between(t,${startTime},${startTime + duration})'`);

      commands.push(`drawtext=${parts.join(':')}`);
    });

    console.log(`[DrawtextGenerator.generateArcText] 生成了 ${commands.length} 个字符的弧形动画`);
    return commands;
  }

  /**
   * 生成满屏倾斜飞行效果
   * 文字从下往上飞，同时有轻微的 X 轴偏移模拟倾斜效果
   * 注意：FFmpeg drawtext 滤镜不支持 angle 参数，因此使用 X 轴偏移来模拟倾斜
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @returns drawtext命令数组
   */
  static generateFlyingTilt(
    subtitle: ArrangedSubtitle,
    fontfile: string
  ): string[] {
    const commands: string[] = [];
    const start = subtitle.start;
    const end = subtitle.end;
    const duration = end - start;

    const text = subtitle.text;
    const fontSize = subtitle.style.fontSize;
    const fontColor = this.convertHexToDrawtext(subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(subtitle.style.outlineColor);
    const borderWidth = subtitle.style.outlineWidth;

    // 不再使用固定视频尺寸，使用 FFmpeg 的 w 和 h 变量
    // 这样可以适应任何视频尺寸（横屏或竖屏）

    // 生成满屏的多个文字（20 个）
    // 每个文字从屏幕随机位置出现，向不同方向漂移
    const copyCount = 20;

    // 飞行时间乘数（让飞行更慢）
    const flyDuration = duration * 1.8;  // 飞行持续时间是字幕时长的 1.8 倍

    for (let i = 0; i < copyCount; i++) {
      // 使用伪随机数生成每个文字的起始位置（覆盖全屏）
      const seed1 = (i * 7919 + 31337) % 1000;
      const seed2 = (i * 5417 + 19937) % 1000;
      const seed3 = (i * 3571 + 11113) % 1000;
      const seed4 = (i * 2741 + 7823) % 1000;

      // 起始位置比例：覆盖整个屏幕（0.05 ~ 0.95）
      const startXRatio = 0.05 + (seed1 / 1000) * 0.9;
      const startYRatio = 0.05 + (seed2 / 1000) * 0.9;

      // 漂移方向比例（继续增大向上飞的幅度）
      const driftXRatio = -0.2 + (seed4 / 1000 - 0.5) * 0.15;   // -0.275 ~ -0.125
      const driftYRatio = -0.45 + (seed4 / 1000 - 0.5) * 0.25;  // -0.575 ~ -0.325（向上飞更远）

      // 结束位置比例
      const endXRatio = startXRatio + driftXRatio;
      const endYRatio = startYRatio + driftYRatio;

      // 字体大小：0.5 ~ 1.3 之间随机（差距更大）
      const sizeScale = 0.5 + (seed3 / 1000) * 0.8;

      // 延迟时间：0 ~ 0.8 秒之间
      const delayFactor = (i / copyCount) * 0.8;

      const effectiveStart = start + delayFactor;
      const effectiveEnd = Math.min(end + 0.5, start + flyDuration);
      const relTime = `(t-${effectiveStart})`;

      // 飞行进度 (0 -> 1)
      const progress = `max(0,min(1,${relTime}/${flyDuration}))`;

      // 使用 FFmpeg 的 w 和 h 变量动态计算位置
      // X轴：从起始比例位置向结束比例位置漂移
      const xExpr = `w*${startXRatio}+(w*${endXRatio}-w*${startXRatio})*(${progress})-(text_w/2)`;

      // Y轴：从起始比例位置向结束比例位置漂移
      const yExpr = `h*${startYRatio}+(h*${endYRatio}-h*${startYRatio})*(${progress})`;

      // 缩放效果：从小变大再变小（模拟远近）
      const scaledFontSize = fontSize * sizeScale;
      const scaleExpr = `${scaledFontSize}*(0.8+0.4*sin(${progress}*PI))`;

      // 透明度：渐入渐出 + 随机基础透明度
      const fadeInEnd = 0.15;
      const fadeOutStart = 0.7;
      // 随机基础透明度：0.3 ~ 1.0（差异更大）
      const seed5 = (i * 1997 + 5003) % 1000;
      const baseAlpha = 0.3 + (seed5 / 1000) * 0.7;
      const alphaExpr = `${baseAlpha}*if(lt(${progress},${fadeInEnd}),${progress}/${fadeInEnd},if(gt(${progress},${fadeOutStart}),1-(${progress}-${fadeOutStart})/(1-${fadeOutStart}),1))`;

      commands.push(this.generateBasic({
        fontfile,
        text: text,
        x: xExpr,
        y: yExpr,
        fontsize: scaleExpr,
        fontcolor: fontColor,
        borderw: borderWidth,
        bordercolor: borderColor,
        enable: `between(t,${effectiveStart},${effectiveEnd})`,
        alpha: alphaExpr
      }));
    }

    console.log(`[DrawtextGenerator.generateFlyingTilt] 生成了 ${commands.length} 个随机位置飞行文字效果（使用动态 w/h）`);
    return commands;
  }

  /**
   * 根据特效类型自动生成对应的drawtext命令
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @param effectType 特效类型
   * @param effectParams 特效参数（可选）
   * @returns drawtext命令（或命令数组）
   */
  static generateByEffectType(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    effectType: string,
    effectParams?: EffectParams
  ): string | string[] {
    // 标准化特效ID（转换为小写，处理各种格式）
    const normalizedEffectType = (effectType || '').toLowerCase().trim();

    // 特效ID映射表（向后兼容）
    const effectIdMap: Record<string, string> = {
      // 大写格式映射
      'zoom_in': 'zoom-in',
      'slide_up': 'slide-up',
      'slide_down': 'slide-down',
      'slide_left': 'slide-left',
      'slide_right': 'slide-right',
      'slide_in_up': 'slide-up',
      'slide_in_down': 'slide-down',
      'slide_in_left': 'slide-left',
      'slide_in_right': 'slide-right',
      'fly_in': 'fly-in',  // 弹性飞入
      'flip_3d': 'flip-3d',
      'flip': 'flip-3d',
      'particle_burst': 'particle-burst',
      'particle': 'particle-burst',
      'color_flash': 'flash',
      'glow_effect': 'glow',
      'shake_emotion': 'shake',
      'fade_in_smooth': 'fade',
      'fade_in': 'fade',
      'gradient_reveal': 'fade',
      'bounce_spring': 'bounce',
      'heart_pulse': 'heartbeat',
      'heart': 'heartbeat',
      'water_ripple': 'wave',
      'ripple': 'wave',
      'rainbow_gradient': 'rainbow',
      'rainbow': 'rainbow',  // 彩虹渐变
      'electric_spark': 'electric',
      'ghost_appear': 'fade',
      'fire_effect': 'flash',
      'ice_freeze': 'fade',
      'keyword_combo': 'zoom-in',
      'action_combo': 'slide-up',
      'emotion_combo': 'heartbeat',
      'description_combo': 'fade',
      'motion_blur': 'slide-up',

      // 保持原有的映射
      'pulse_scale': 'zoom-in',
      'mirror_flip': 'flip-3d',

      // 🆕 修复：Arc Text 映射
      'arc_text': 'ARC_TEXT',
      'arc-text': 'ARC_TEXT',

      //  🔧 修复：Intense Flash 映射（下划线 -> 连字符）
      'intense_flash': 'intense-flash',

      // 🆕 运动模糊拖尾映射
      'motion_blur_trail': 'MOTION_BLUR_TRAIL',
      'ghost_trail': 'GHOST_TRAIL'
    };

    // 获取映射后的特效ID
    let effectId = normalizedEffectType;
    if (effectIdMap[effectId]) {
      effectId = effectIdMap[effectId];
    }

    console.log(`[DrawtextGenerator] 特效映射: "${effectType}" -> "${normalizedEffectType}" -> "${effectId}"`);

    // 优先使用新的特效库
    try {
      console.log(`[DrawtextGenerator] 尝试使用新特效库生成: ${effectId}`);
      const result = generateEffect(effectId, subtitle, fontfile, effectParams);
      if (result) {
        console.log(`[DrawtextGenerator] 特效生成成功: ${effectId}, 结果类型: ${Array.isArray(result) ? 'array' : 'string'}`);
        return result;
      } else {
        console.log(`[DrawtextGenerator] 新特效库返回空: ${effectId}`);
      }
    } catch (error) {
      console.warn(`[DrawtextGenerator] 新特效库生成失败 (${effectId}), 回退到旧实现:`, error);
    }

    // 如果新特效库不支持，回退到旧的实现（保持向后兼容）
    const normalizedEffectTypeUpper = normalizedEffectType.toUpperCase();
    switch (normalizedEffectTypeUpper) {
      // ============ UI effectId 映射 ============
      // 这些是从 KeywordGroupManager.vue 中的 keywordEffects 定义的 effectId
      // 需要转换为对应的特效实现

      // 'zoom-in' -> 'ZOOM_IN' -> 使用 PULSE_SCALE 的缩放效果
      case 'ZOOM_IN':
        return this.generateScale(subtitle, fontfile, 'pulse');

      // 'pulse' -> 'PULSE' -> 脉冲缩放
      case 'PULSE':
        return this.generateScale(subtitle, fontfile, 'pulse');

      // 'bounce' -> 'BOUNCE' -> 弹跳
      case 'BOUNCE':
        return this.generateScale(subtitle, fontfile, 'bounce');

      // 'glow' -> 'GLOW' -> 发光
      case 'GLOW':
        return this.generateGlow(subtitle, fontfile);

      // 'shake' -> 'SHAKE' -> 抖动
      case 'SHAKE':
        return this.generateShake(subtitle, fontfile, 5);

      // 'slide-up' -> 'SLIDE_UP' -> 向上滑入
      case 'SLIDE_UP':
        return this.generateSlideIn(subtitle, fontfile, 'up');

      // 'fade' -> 'FADE' -> 淡入淡出
      case 'FADE':
        return this.generateFade(subtitle, fontfile, 0.5, 0.5);

      // 'spin' -> 'SPIN' -> 旋转
      case 'SPIN':
        return this.generateRotate(subtitle, fontfile);

      // 'wave' -> 'WAVE' -> 波浪
      case 'WAVE':
        return this.generateWave({
          text: subtitle.text,
          centerX: subtitle.position.x,
          baseY: subtitle.position.y,
          startTime: subtitle.start,
          duration: subtitle.end - subtitle.start,
          amplitude: 20,
          frequency: 2,
          fontsize: subtitle.style.fontSize,
          fontcolor: this.convertHexToDrawtext(subtitle.style.fontColor)
        }, fontfile);

      // 'flip' -> 'FLIP' -> 翻转（快速 180 度切换）
      case 'FLIP':
        return this.generateFlip(subtitle, fontfile);

      // 'color-flash' -> 'COLOR_FLASH' -> 颜色闪烁

      // ============ EffectType 枚举值映射 ============
      // 这些是 EffectType 枚举中定义的值

      // 滑入效果
      case 'SLIDE_IN_UP':
        return this.generateSlideIn(subtitle, fontfile, 'up');
      case 'SLIDE_IN_DOWN':
        return this.generateSlideIn(subtitle, fontfile, 'down');
      case 'SLIDE_IN_LEFT':
        return this.generateSlideIn(subtitle, fontfile, 'left');
      case 'SLIDE_IN_RIGHT':
        return this.generateSlideIn(subtitle, fontfile, 'right');

      // 缩放效果
      case 'PULSE_SCALE':
        return this.generateScale(subtitle, fontfile, 'pulse');

      case 'BOUNCE_SPRING':
        return this.generateScale(subtitle, fontfile, 'bounce');

      // 闪烁效果
      case 'COLOR_FLASH':
        return this.generateColorFlash(subtitle, fontfile, 2);

      // 发光效果
      case 'GLOW_EFFECT':
        return this.generateGlow(subtitle, fontfile);

      // 抖动效果
      case 'SHAKE_EMOTION':
        return this.generateShake(subtitle, fontfile, 5);

      // 淡入效果
      case 'FADE_IN_SMOOTH':
      case 'FADE_IN':
        return this.generateFade(subtitle, fontfile, 0.5, 0.5);

      // 心跳效果
      case 'HEART_PULSE':
      case 'HEART':
        return this.generateScale(subtitle, fontfile, 'pulse');

      // 粒子效果
      case 'PARTICLE_BURST':
      case 'PARTICLE':
        return this.generateParticleBurst({
          text: subtitle.text,
          centerX: subtitle.position.x,
          centerY: subtitle.position.y,
          startTime: subtitle.start,
          duration: subtitle.end - subtitle.start,
          particleCount: 12,
          radius: 200,
          fontsize: subtitle.style.fontSize,
          fontcolor: this.convertHexToDrawtext(subtitle.style.fontColor)
        }, fontfile);

      // 波纹效果
      case 'WATER_RIPPLE':
      case 'RIPPLE':
        return this.generateWave({
          text: subtitle.text,
          centerX: subtitle.position.x,
          baseY: subtitle.position.y,
          startTime: subtitle.start,
          duration: subtitle.end - subtitle.start,
          amplitude: 30,
          frequency: 2,
          fontsize: subtitle.style.fontSize,
          fontcolor: this.convertHexToDrawtext(subtitle.style.fontColor)
        }, fontfile);

      // 运动模糊 - 使用带模糊的滑入
      case 'MOTION_BLUR':
        return this.generateSlideIn(subtitle, fontfile, 'up');

      // 🆕 运动模糊拖尾 - 残影效果
      case 'MOTION_BLUR_TRAIL':
      case 'GHOST_TRAIL':
        return this.generateMotionBlurTrail(subtitle, fontfile);

      // 渐变显示 - 使用淡入淡出
      case 'GRADIENT_REVEAL':
        return this.generateFade(subtitle, fontfile, 0, 1);

      // 镜像翻转 - 使用 180 度翻转实现
      case 'MIRROR_FLIP':
        return this.generateFlip(subtitle, fontfile);

      // 彩虹渐变 - 使用多次闪烁实现
      case 'RAINBOW_GRADIENT':
        return this.generateColorFlash(subtitle, fontfile, 5);

      // 电击效果 - 使用强抖动
      case 'ELECTRIC_SPARK':
        return this.generateShake(subtitle, fontfile, 10);

      // 幽灵显示 - 使用淡入效果
      case 'GHOST_APPEAR':
        return this.generateFade(subtitle, fontfile, 0, 1);

      // 炎火效果 - 使用快速闪烁
      case 'FIRE_EFFECT':
        return this.generateColorFlash(subtitle, fontfile, 4);

      // 冰冻效果 - 使用平滑淡入
      case 'ICE_FREEZE':
        return this.generateFade(subtitle, fontfile, 0.5, 0.5);

      // 组合效果
      case 'KEYWORD_COMBO':
      case 'ACTION_COMBO':
      case 'EMOTION_COMBO':
      case 'DESCRIPTION_COMBO':
        return this.generateScale(subtitle, fontfile, 'pulse');

      // 'arc-text' -> 'ARC_TEXT' -> 弧形文字
      case 'ARC_TEXT':
        // 🔧 修复：使用 effectParams.duration（毫秒）而不是硬编码的字幕时长
        const arcDuration = effectParams?.duration
          ? effectParams.duration / 1000  // 从毫秒转换为秒
          : (subtitle.end - subtitle.start); // 回退到字幕时长

        return this.generateArcText({
          text: subtitle.text,
          centerX: subtitle.position.x,
          centerY: subtitle.position.y,
          radius: 350, // 🔧 增加最终半径：200 -> 350，飞的距离更远
          angleRange: Math.PI / 1.0, // 🔧 增加角度范围：150度 -> 180度
          startTime: subtitle.start,
          duration: arcDuration,
          fontsize: subtitle.style.fontSize,
          fontcolor: this.convertHexToDrawtext(subtitle.style.fontColor)
        }, fontfile);

      // ✨ 新增：'flying-tilt' -> 'FLYING_TILT' -> 满屏倾斜飞行
      case 'FLYING_TILT':
      case 'FLYING-TILT':
      case 'FLYING':
        return this.generateFlyingTilt(subtitle, fontfile);

      default:
        console.warn(`[DrawtextGenerator] 未知的特效类型: ${normalizedEffectType}，使用默认样式`);
        return [this.generateBasic({
          fontfile,
          text: subtitle.text,
          x: `${subtitle.position.x}-(text_w/2)`,
          y: `${subtitle.position.y}`,
          fontsize: subtitle.style.fontSize,
          fontcolor: this.convertHexToDrawtext(subtitle.style.fontColor),
          borderw: subtitle.style.outlineWidth,
          bordercolor: this.convertHexToDrawtext(subtitle.style.outlineColor),
          enable: `between(t,${subtitle.start},${subtitle.end})`
        })];
    }
  }

  /**
   * 生成基础drawtext命令（公开方法，供特效库使用）
   */
  static generateBasicPublic(config: DrawtextConfig): string {
    return this.generateBasic(config);
  }

  /**
   * 生成标题字幕的 drawtext 命令
   * 用于在视频顶部显示标题，支持每行独立样式配置
   * @param config 标题字幕配置
   * @param videoWidth 视频宽度
   * @param videoHeight 视频高度
   * @param videoDuration 视频时长（秒）
   * @returns FFmpeg drawtext 命令数组
   */
  static generateTitleSubtitle(
    config: any, // TitleSubtitleConfig 类型
    videoWidth: number,
    videoHeight: number,
    videoDuration: number
  ): string[] {
    if (!config || !config.enabled || !config.lines || config.lines.length === 0) {
      console.log('[DrawtextGenerator.generateTitleSubtitle] 标题字幕未启用或无内容');
      return [];
    }

    console.log(`[DrawtextGenerator.generateTitleSubtitle] 开始生成标题字幕，共 ${config.lines.length} 行`);

    const commands: string[] = [];

    for (const line of config.lines) {
      try {
        const titleText = (line.text || '').trim();
        if (!titleText) {
          continue;
        }

        const hasBackground = line.backgroundColor !== 'transparent' && line.backgroundOpacity > 0;
        const horizontalPadding = Math.max(28, Math.round(videoWidth * 0.06));
        const topPadding = Math.max(24, Math.round(videoHeight * 0.035));
        const bottomPadding = Math.max(36, Math.round(videoHeight * 0.045));
        const alignment = line.alignment || 'center';
        const anchorPercent = line.xOffsetPercent ?? (
          alignment === 'left' ? 16 : alignment === 'right' ? 84 : 50
        );
        const maxWidthPercent = this.clampNumber(
          line.maxWidthPercent ?? (hasBackground ? 62 : 72),
          28,
          90
        );
        const safeTitleWidth = Math.max(
          240,
          Math.floor(videoWidth * (maxWidthPercent / 100))
        );
        const requestedFontSize = Math.max(24, line.fontSize || 56);
        const minFontSize = Math.max(28, Math.floor(requestedFontSize * 0.72));
        const fittedFontSize = this.fitFontSizeToWidth(
          titleText,
          requestedFontSize,
          safeTitleWidth,
          minFontSize
        );
        const outlineWidth = (line.outlineWidth || 0) > 0
          ? Math.max(1, Math.round((line.outlineWidth || 0) * (fittedFontSize / requestedFontSize)))
          : 0;
        const shadowOffset = line.shadowOffset
          ? Math.max(1, Math.round(line.shadowOffset * (fittedFontSize / requestedFontSize)))
          : 0;
        const lineSpacing = Math.max(6, Math.round(fittedFontSize * 0.12));
        const boxPadding = Math.max(14, Math.round(fittedFontSize * 0.22));
        const yPosition = Math.round(videoHeight * line.yOffsetPercent / 100);
        const yExpr = `max(${topPadding},min(${yPosition},h-text_h-${bottomPadding}))`;
        const anchorX = Math.round(videoWidth * (anchorPercent / 100));
        let xExpr = `max(${horizontalPadding},min((w-text_w)/2,w-text_w-${horizontalPadding}))`;
        if (alignment === 'left') {
          xExpr = `max(${horizontalPadding},min(${anchorX},w-text_w-${horizontalPadding}))`;
        } else if (alignment === 'right') {
          xExpr = `max(${horizontalPadding},min(${anchorX}-text_w,w-text_w-${horizontalPadding}))`;
        } else {
          xExpr = `max(${horizontalPadding},min(${anchorX}-(text_w/2),w-text_w-${horizontalPadding}))`;
        }

        // ✅ 确保字体路径存在且有效
        let fontPath = line.fontPath;
        if (!fontPath || fontPath.trim() === '') {
          // 如果 fontPath 不存在，尝试从 fontName 获取
          fontPath = getFontPath(line.fontName || 'Microsoft YaHei Bold');
          console.warn(`[DrawtextGenerator.generateTitleSubtitle] 第 ${config.lines.indexOf(line) + 1} 行字体路径为空，使用 fontName 重新获取: ${fontPath}`);
        }

        const parts: string[] = [];
        parts.push(`fontfile=${this.escapePath(fontPath)}`);
        parts.push(`text='${this.escapeText(titleText)}'`);
        parts.push(`x='${xExpr}'`);
        parts.push(`y='${yExpr}'`);
        parts.push(`fontsize=${fittedFontSize}`);

        // 颜色格式转换：#RRGGBB → 0xRRGGBB
        parts.push(`fontcolor=${line.fontColor.replace('#', '0x')}`);
        parts.push(`borderw=${outlineWidth}`);
        parts.push(`bordercolor=${line.outlineColor.replace('#', '0x')}`);
        parts.push(`fix_bounds=1`);
        parts.push(`line_spacing=${lineSpacing}`);

        // 背景处理
        if (hasBackground) {
          parts.push(`box=1`);
          const bgColorHex = line.backgroundColor.replace('#', '').toUpperCase();
          parts.push(`boxcolor=0x${bgColorHex}@${line.backgroundOpacity.toFixed(2)}`);
          parts.push(`boxborderw=${boxPadding}`);
        }

        // 阴影处理
        if (shadowOffset > 0 && line.shadowColor) {
          parts.push(`shadowcolor=${line.shadowColor.replace('#', '0x')}`);
          parts.push(`shadowx=${shadowOffset}`);
          parts.push(`shadowy=${shadowOffset}`);
        }

        // 时间范围控制
        const startTime = config.startTime || 0;
        const endTime = config.endTime || videoDuration;
        parts.push(`enable='between(t,${startTime},${endTime})'`);

        commands.push(`drawtext=${parts.join(':')}`);
        console.log(`[DrawtextGenerator.generateTitleSubtitle] 生成第 ${commands.length} 行: "${titleText}"`, {
          fittedFontSize,
          safeTitleWidth,
          hasBackground,
          alignment,
          anchorPercent
        });
      } catch (error) {
        console.error(`[DrawtextGenerator.generateTitleSubtitle] 生成行字幕失败:`, error, line);
      }
    }

    console.log(`[DrawtextGenerator.generateTitleSubtitle] 标题字幕生成完成，共 ${commands.length} 条命令`);
    return commands;
  }

  // ==================== 工具方法 ====================

  /**
   * 转义文件路径（用于 FFmpeg filter_complex 文件参数）
   * @private
   */
  private static escapePath(path: string): string {
    if (!path) return '';

    // 统一使用正斜杠
    let normalizedPath = path.replace(/\\/g, '/');

    // 检查是否是 Windows 盘符路径（如 C:/ 或 D:/）
    // 对于FFmpeg drawtext filter，需要转义冒号
    // 注意：因为 filter_complex 参数是写入文件的，只需要单反斜杠转义
    const driveMatch = normalizedPath.match(/^([A-Za-z]):\//);
    if (driveMatch) {
      const driveLetter = driveMatch[1].toUpperCase();
      // 转义冒号：C:/path -> C\\:/path
      // 双反斜杠用于文件中的 filter 参数（与 DrawtextUtils.ts 保持一致）
      normalizedPath = `${driveLetter}\\\\:${normalizedPath.substring(2)}`;
    } else if (normalizedPath.startsWith('/') && !normalizedPath.startsWith('//')) {
      // 处理缺少盘符的 Windows 路径
      // 某些情况下（如自定义安装目录、打包环境）路径可能丢失盘符
      // 变成 /Users/... 或 /path/to/file 格式
      // 在 Windows 上，这种路径应该添加 C: 前缀
      normalizedPath = `C\\:${normalizedPath}`;
      console.warn(`[DrawtextGenerator.escapePath] 检测到缺少盘符的路径，已添加 C: 前缀: ${path} -> ${normalizedPath}`);
    }

    // 转义 FFmpeg filter 语法的特殊字符
    normalizedPath = normalizedPath
      .replace(/'/g, "\\'")      // 单引号
      .replace(/\[/g, "\\[")     // 左方括号
      .replace(/\]/g, "\\]");    // 右方括号

    return normalizedPath;
  }

  /**
   * 转义文本内容
   * @private
   */
  private static escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, ' ');
  }

  /**
   * 将十六进制颜色转换为drawtext格式（0xRRGGBB）
   * @private
   */
  private static convertHexToDrawtext(hexColor: string): string {
    if (!hexColor) return '0xFFFFFF';
    const hex = hexColor.replace('#', '').toUpperCase();
    if (hex.length === 8) {
      return `0x${hex.slice(0, 6)}`;
    }
    if (hex.length === 6) {
      return `0x${hex}`;
    }
    return '0xFFFFFF';
  }

  /**
   * 组合多个drawtext命令为filter_complex（纯drawtext方案）
   * @param commands drawtext命令数组
   * @param assFiles ASS文件路径数组（已废弃，保留参数以兼容，但不使用）
   * @param fontDir 字体目录（已废弃，保留参数以兼容，但不使用）
   * @returns filter_complex字符串
   */
  static buildFilterComplex(
    commands: string[],
    assFiles: string[] = [],
    fontDir?: string,
    inputLabel: string = '[0:v]' // 🆕 支持自定义输入流标签
  ): string {
    console.log('[DrawtextGenerator.buildFilterComplex] 开始构建filter_complex:', {
      drawtextCommandCount: commands?.length || 0,
      assFileCount: assFiles?.length || 0,
      inputLabel: inputLabel,
      note: '纯drawtext方案：使用流标签和分号连接，避免命令行过长'
    });

    // 【纯drawtext方案】不再加载ASS文件
    // 处理空命令列表
    if (!commands || commands.length === 0) {
      console.warn('[DrawtextGenerator.buildFilterComplex] ⚠️ 没有drawtext命令，filter_complex将为空');
      return '';
    }

    // 【关键修复】为多个drawtext过滤器添加流标签以建立正确的连接关系
    // FFmpeg 过滤器图表需要明确的输入/输出流标签
    const filters: string[] = [];

    if (commands.length === 1) {
      // 单个命令：[input]drawtext=...
      filters.push(`${inputLabel}${commands[0]}`);
      console.log(`[DrawtextGenerator.buildFilterComplex] 单个drawtext命令，添加${inputLabel}标签`);
      console.log(`[DrawtextGenerator.buildFilterComplex] 命令长度: ${commands[0].length}字符`);
    } else {
      // 多个命令：[input]drawtext...[out0];[out0]drawtext[out1];...;[outN]drawtext
      console.log(`[DrawtextGenerator.buildFilterComplex] 处理${commands.length}个drawtext命令...`);
      commands.forEach((command, index) => {
        if (index === 0) {
          // 第一个：[input]drawtext=...[out0]
          filters.push(`${inputLabel}${command}[out${index}]`);
          console.log(`[DrawtextGenerator.buildFilterComplex] 命令${index}（第一个）: 长度${command.length}字符，标签:${inputLabel}...[out0]`);
        } else if (index === commands.length - 1) {
          // 最后一个：[outN]drawtext=...（无输出标签，默认输出到视频）
          filters.push(`[out${index - 1}]${command}`);
          console.log(`[DrawtextGenerator.buildFilterComplex] 命令${index}（最后）: 长度${command.length}字符，标签:[out${index - 1}]...`);
        } else {
          // 中间的：[outN]drawtext=...[outN+1]
          filters.push(`[out${index - 1}]${command}[out${index}]`);
          console.log(`[DrawtextGenerator.buildFilterComplex] 命令${index}（中间）: 长度${command.length}字符，标签:[out${index - 1}]...[out${index}]`);
        }
      });
      console.log('[DrawtextGenerator.buildFilterComplex] 多个drawtext命令，已添加流标签连接:', {
        totalCommands: commands.length,
        filterChain: `[0:v]drawtext...[out0];[out0]drawtext...[out1];...;[out${commands.length - 2}]drawtext`
      });
    }

    const result = filters.join(';');
    console.log('[DrawtextGenerator.buildFilterComplex] filter_complex构建完成，长度:', result.length);

    // 【新增调试】打印filter_complex的详细内容，分割显示
    console.log('[DrawtextGenerator.buildFilterComplex] ====== FILTER_COMPLEX 详细内容 ======');
    console.log('[DrawtextGenerator.buildFilterComplex] 总长度:', result.length, '字符');
    console.log('[DrawtextGenerator.buildFilterComplex] 分号数量:', (result.match(/;/g) || []).length, '(应该是', commands.length - 1, ')');

    // 打印每个filter段
    filters.forEach((filter, index) => {
      console.log(`[DrawtextGenerator.buildFilterComplex] Filter${index}: 长度${filter.length}`, filter.substring(0, 100) + (filter.length > 100 ? '...' : ''));
    });

    // 【新增】检查text参数，确保所有字幕都被包含
    console.log('[DrawtextGenerator.buildFilterComplex] ====== 字幕内容验证 ======');
    filters.forEach((filter, index) => {
      const textMatch = filter.match(/text='([^']*?)'/);
      if (textMatch) {
        console.log(`[DrawtextGenerator.buildFilterComplex] Filter${index} 字幕文本: "${textMatch[1]}"`);
      } else {
        console.warn(`[DrawtextGenerator.buildFilterComplex] Filter${index} 未找到text参数!`);
      }
    });

    // 打印前1000字符和后1000字符，看是否有截断
    console.log('[DrawtextGenerator.buildFilterComplex] 前500字符:', result.substring(0, 500));
    console.log('[DrawtextGenerator.buildFilterComplex] 后500字符:', result.substring(Math.max(0, result.length - 500)));
    console.log('[DrawtextGenerator.buildFilterComplex] ====== 末尾调试信息 ======');

    return result;
  }

  /**
   * 构建完整的FFmpeg命令
   * @param inputVideo 输入视频路径
   * @param outputVideo 输出视频路径
   * @param filterComplex filter_complex字符串
   * @returns 完整的FFmpeg命令或特殊标记（当过滤器过长时）
   */
  static buildFFmpegCommand(
    inputVideo: string,
    outputVideo: string,
    filterComplex: string
  ): string {
    // 【修复】始终使用 JSON 长过滤器模式
    // 原因：parseFFmpegCommand 会去掉引号，导致 Windows 路径中的冒号被错误解析
    // 使用 JSON 模式可以直接将 filterComplex 作为 spawn 参数传递，避免引号问题
    // 返回特殊标记，告诉调用者使用 spawn 数组参数方式
    // 格式：__USE_FILTER_FILE__:<filter_content>
    return `__USE_FILTER_FILE__:${filterComplex}`;
  }
}

/**
 * drawtext效果预设
 * 提供常用的效果配置模板
 */
export class DrawtextEffectPresets {
  /**
   * 获取所有支持drawtext的特效类型
   */
  static getSupportedEffects(): string[] {
    return [
      'SLIDE_IN_UP',
      'SLIDE_IN_DOWN',
      'SLIDE_IN_LEFT',
      'SLIDE_IN_RIGHT',
      'PARTICLE_BURST',
      'WATER_RIPPLE',
      'BOUNCE_SPRING',
      'SHAKE_EMOTION',
      'FADE_IN_SMOOTH',
      'WAVE',
      'ARC_TEXT' // 🆕 新增
    ];
  }

  /**
   * 检查特效是否需要使用drawtext（而非ASS）
   */
  static requiresDrawtext(effectType: string): boolean {
    const drawtextOnly = [
      'PARTICLE_BURST',   // 粒子效果（需要多个实例）
      'WATER_RIPPLE',     // 水波纹（复杂数学表达式）
      'FIRE_EFFECT',      // 火焰效果
      'ICE_FREEZE',       // 冰冻效果
      'ELECTRIC_SPARK',   // 电击效果
      'ARC_TEXT'          // 🆕 弧形文字（需要字符拆分）
    ];

    return drawtextOnly.includes(effectType);
  }
}
