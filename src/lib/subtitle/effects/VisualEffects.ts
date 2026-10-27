/**
 * 视觉增强特效生成器
 */

import { BaseEffectGenerator } from './EffectGenerator';
import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import { ExpressionHelper } from './types';
import { DrawtextUtils } from '../DrawtextUtils';
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * 发光闪烁特效
 * 简化版：使用缩放 + 透明度脉冲来模拟发光效果
 * 预览：缩放 + 发光脉冲效果
 * 注意：FFmpeg borderw 不支持表达式，使用固定边框
 */
export class GlowEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const glowSize = ctx.params?.custom?.glowSize ?? 6;
    const speed = ctx.params.speed || 1.0;
    const intensity = ctx.params?.intensity || 0.8;
    const start = ctx.start;

    const baseFontSize = ctx.subtitle.style.fontSize;
    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用默认的0.8秒
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const cycleDuration = Math.min(effectDuration * 0.4, 0.8) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})/${cycleDuration}`;

    // 缩放效果：1.0 -> 1.05 -> 1.0（与预览一致）
    const scaleMax = 1.0 + 0.05 * intensity;
    const scaleExpr = `1+(${scaleMax}-1)*(1-abs(2*${cyclePos}-1))`;
    const fontSizeExpr = `${baseFontSize}*(${scaleExpr})`;

    // 透明度脉冲：0.8 -> 1.0 -> 0.8，模拟发光强度变化
    const alphaExpr = `0.8+0.2*(1-abs(2*${cyclePos}-1))`;

    // 使用固定边框宽度（FFmpeg borderw 不支持表达式）
    const config = this.buildDrawtextConfig(ctx, {
      fontsize: fontSizeExpr,
      borderw: glowSize,
      alpha: alphaExpr,
      x: `${centerX}-(text_w/2)`,
      y: `${centerY}-(text_h/2)`
    });

    return DrawtextUtils.generateBasic(config);
  }
}

/**
 * 抖动震颤特效
 */
export class ShakeEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const intensity = ctx.params?.intensity || 1.0;
    const shakeAmount = intensity * (ctx.params?.custom?.shakeAmount ?? 15);
    const frequency = ctx.params.speed || 1.5;
    const customFreq = ctx.params?.custom?.frequency ?? 15;
    const start = ctx.start;

    // 创建更强烈的抖动效果
    const time = `(t-${start})*${frequency}`;

    // 使用多个频率组合，创建更不规则的抖动
    const xOffset1 = `${shakeAmount}*(0.5-abs(mod(${time}*${customFreq},1)-0.5))*2-1`;
    const xOffset2 = `${shakeAmount * 0.5}*(0.5-abs(mod(${time}*${customFreq * 0.7},1)-0.5))*2-1`;
    const xOffset = `(${xOffset1}+${xOffset2})*1.5`;
    const yOffset1 = `${shakeAmount}*(0.5-abs(mod(${time}*${customFreq * 1.3},1)-0.5))*2-1`;
    const yOffset2 = `${shakeAmount * 0.3}*(0.5-abs(mod(${time}*${customFreq * 0.5},1)-0.5))*2-1`;
    const yOffset = `(${yOffset1}+${yOffset2})*1.2`;

    // 添加轻微的旋转效果（通过位置偏移模拟）
    const rotOffset = `${shakeAmount * 0.2}*(0.5-abs(mod(${time}*${customFreq * 2},1)-0.5))*2-1`;

    const config = this.buildDrawtextConfig(ctx, {
      x: `${ctx.subtitle.position.x}-(text_w/2)+${xOffset}+${rotOffset}`,
      y: `${ctx.subtitle.position.y}+${yOffset}`
    });

    return DrawtextUtils.generateBasic(config);
  }
}

/**
 * 波浪浮动特效
 */
export class WaveEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const amplitude = ctx.params?.intensity || 0.8;
    const distance = (ctx.params?.custom?.amplitude ?? 20) * amplitude;
    const frequency = ctx.params.speed || 1.0;
    const customFreq = ctx.params?.custom?.frequency ?? 2;
    const start = ctx.start;

    // 垂直波浪运动：使用锯齿波替代 sin 函数
    const time = `(t-${start})*${customFreq * frequency}`;
    const yExpr = `${ctx.subtitle.position.y}+${distance}*(0.5-abs(mod(${time},1)-0.5))*2-1`;

    // fontsize 参数在 FFmpeg drawtext 中不支持表达式，使用固定大小
    const config = this.buildDrawtextConfig(ctx, {
      y: yExpr
    });

    return DrawtextUtils.generateBasic(config);
  }
}

/**
 * 呼吸效果
 * 透明度周期性变化，模拟呼吸效果
 */
export class BreatheEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const breathSpeed = ctx.params?.speed || 1.0;
    const customSpeed = ctx.params?.custom?.breathSpeed ?? 0.8;
    const intensity = ctx.params?.intensity || 0.8;
    const start = ctx.start;

    // 呼吸节奏：使用更缓慢的锯齿波，范围 0.3-1.0
    const time = `(t-${start})*${customSpeed * breathSpeed}`;
    const alphaExpr = `0.3+0.7*(0.5-abs(mod(${time},2)-0.5))`;

    // 位置也轻微变化，模拟呼吸时的起伏
    const centerY = ctx.subtitle.position.y;
    const yVariation = 5 * intensity;
    const yExpr = `${centerY}+${yVariation}*(0.5-abs(mod(${time},2)-0.5))`;

    const config = this.buildDrawtextConfig(ctx, {
      alpha: alphaExpr,
      y: yExpr
    });

    return DrawtextUtils.generateBasic(config);
  }
}

/**
 * 强力闪烁特效
 * 使用多层叠加模拟强烈的发光模糊效果
 * 修正：
 * 1. 增加透明度以解决"看不到"的问题
 * 2. 逐字闪烁，实现"从左到右有层次感"
 */
export class IntenseFlashEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string[] {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const start = ctx.start;
    const commands: string[] = [];

    // 逐字处理逻辑
    const chars = subtitle.text.split('');
    // 🔧 修复：确保 fontSize 是数值
    const rawFontSize = subtitle.style.fontSize;
    const sizeNum = parseFloat(String(rawFontSize));
    const fontSize = isNaN(sizeNum) ? 30 : sizeNum;

    // 简单的字符宽度估算 (避免依赖 Canvas)
    // 中文/全角: 1.0 * fontSize, 英文/数字: 0.6 * fontSize
    const charWidths = chars.map(c => {
      return /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(c) ? fontSize : fontSize * 0.6;
    });

    const totalWidth = charWidths.reduce((a, b) => a + b, 0);
    let currentX = subtitle.position.x - totalWidth / 2; // 居中起始X

    chars.forEach((char, index) => {
      const charWidth = charWidths[index];
      const centerX = currentX + charWidth / 2; // 当前字符中心

      // 🔧 修复：每个字符独立闪烁，延迟0.03s
      const waveDelay = index * 0.03;
      // 🔧 降低频率：从8Hz改为4Hz，让闪烁更慢更舒适
      const freq = 4;  // 4Hz 闪烁频率（每秒4次）
      const PI2 = 6.2831853;
      const phase = `((t-${start}-${waveDelay})*${speed}*${freq}*${PI2})`;

      // ✅ 修复：透明度在 [0.4, 1.0] 之间变化，实现从暗到亮的闪烁
      // sin 范围 [-1, 1]，归一化到 [0, 1]，再映射到 [0.4, 1.0]
      const normalizedSin = `(sin(${phase})+1)/2`;
      const alpha = `0.4+0.6*${normalizedSin}`;

      const xExpr = `${centerX}-(text_w/2)`;
      const yExpr = `${subtitle.position.y}-(text_h/2)`;

      // ✅ 单层绘制：使用原始字体颜色和描边，只改变透明度
      commands.push(DrawtextUtils.generateBasic(this.buildDrawtextConfig(ctx, {
        text: char,
        fontcolor: subtitle.style.fontColor, // 使用原始字体颜色
        bordercolor: subtitle.style.outlineColor, // 使用原始描边颜色
        borderw: subtitle.style.outlineWidth, // 使用原始描边宽度
        alpha: alpha, // 通过透明度变化实现闪烁
        x: xExpr,
        y: yExpr
      })));

      currentX += charWidth;
    });

    return commands;
  }
}
