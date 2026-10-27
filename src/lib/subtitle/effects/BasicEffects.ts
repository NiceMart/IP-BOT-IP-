/**
 * 基础动画特效生成器
 */

import { BaseEffectGenerator } from './EffectGenerator';
import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import { ExpressionHelper } from './types';
import { DrawtextGenerator } from '../DrawtextGenerator';

/**
 * 缩放弹出特效
 * 从小到大缩放进入，有弹性效果
 * 预览：0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); }
 */
export class ZoomInEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const intensity = ctx.params.intensity || 0.8;
    const start = ctx.start;
    const end = ctx.end;

    // 🔧 修复：使用参数中的 duration，如果有的话，否则计算动态周期
    const effectDuration = params?.duration ? params.duration / 1000 : (end - start); // 转换为秒
    const cycleDuration = (effectDuration / 2.5) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})/${cycleDuration}`;

    const baseFontSize = ctx.subtitle.style.fontSize;
    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    // 缩放效果：1.0 -> 1.15 -> 1.0（与预览一致）
    const maxScale = 1.0 + 0.15 * intensity;
    // 使用三角波：0->0.5 放大，0.5->1 缩小
    const scaleExpr = `1+(${maxScale}-1)*(1-abs(2*${cyclePos}-1))`;
    const fontSizeExpr = `${baseFontSize}*(${scaleExpr})`;

    const config = this.buildDrawtextConfig(ctx, {
      fontsize: fontSizeExpr,
      x: `${centerX}-(text_w/2)`,
      y: `${centerY}-(text_h/2)`
    });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 弹跳反弹特效
 * 从上方弹入，有弹跳效果
 * 预览：0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); }
 */
export class BounceEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const intensity = ctx.params.intensity || 0.8;
    const custom = ctx.params.custom || {};
    const bounceHeight = (custom.height ?? 20) * intensity;
    const start = ctx.start;
    const end = ctx.end;

    // ���� 修复：使用参数中的 duration，如果有的话，否则计算动态周期
    const effectDuration = params?.duration ? params.duration / 1000 : (end - start); // 转换为秒
    const cycleDuration = (effectDuration / 2.5) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})/${cycleDuration}`;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    // Y轴弹跳：使用三角波 0 -> -20 -> 0
    const yOffset = `${bounceHeight}*(1-abs(2*${cyclePos}-1))`;
    const yExpr = `${centerY}-(${yOffset})`;

    const config = this.buildDrawtextConfig(ctx, {
      x: `${centerX}-(text_w/2)`,
      y: yExpr
    });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 淡入淡出特效
 * 使用透明度变化实现淡入淡出
 * 预览：0%, 100% { opacity: 0.4; } 50% { opacity: 1; }
 */
export class FadeEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const intensity = ctx.params.intensity || 0.8;
    const start = ctx.start;
    const end = ctx.end;

    // 🔧 修复：使用参数中的 duration，如果有的话，否则计算动态周期
    const effectDuration = params?.duration ? params.duration / 1000 : (end - start); // 转换为秒
    const cycleDuration = (effectDuration / 2.5) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})/${cycleDuration}`;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    // 透明度变化：0.4 -> 1.0 -> 0.4
    const minAlpha = 0.4 * (1 - intensity * 0.3);
    const alphaExpr = `${minAlpha}+(1-${minAlpha})*(1-abs(2*${cyclePos}-1))`;

    const config = this.buildDrawtextConfig(ctx, {
      x: `${centerX}-(text_w/2)`,
      y: `${centerY}`,
      alpha: alphaExpr
    });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 闪烁高亮特效
 * 周期性闪烁效果
 * 预览：0%, 100% { opacity: 1; } 50% { opacity: 0.2; }
 */
export class FlashEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const intensity = ctx.params.intensity || 0.8;
    const start = ctx.start;
    const end = ctx.end;

    // 🔧 修复：使用参数中的 duration，如果有的话，否则计算动态周期
    const effectDuration = params?.duration ? params.duration / 1000 : (end - start); // 转换为秒
    const cycleDuration = (effectDuration / 2.5) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})/${cycleDuration}`;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    // 透明度变化：1.0 -> 0.2 -> 1.0（与预览一致）
    // 使用三角波实现平滑闪烁
    const minAlpha = 0.2 * (1 - intensity * 0.5);
    const alphaExpr = `${minAlpha}+(1-${minAlpha})*(1-abs(2*${cyclePos}-1))`;

    const config = this.buildDrawtextConfig(ctx, {
      x: `${centerX}-(text_w/2)`,
      y: `${centerY}`,
      alpha: alphaExpr
    });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}
