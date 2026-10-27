/**
 * 旋转和翻转特效生成器
 */

import { BaseEffectGenerator } from './EffectGenerator';
import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import { ExpressionHelper } from './types';
import { DrawtextGenerator } from '../DrawtextGenerator';
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * 旋转转动特效
 * 360度连续旋转效果
 * 使用圆周运动的位置表达式模拟旋转
 */
export class SpinEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {} } = ctx.params;
    const speed = ctx.params.speed || 1.0;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;
    // 旋转半径，让文字在圆周上移动
    const radius = custom.radius ?? 25;

    const relTime = `(t-${ctx.start})`;
    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用默认的1.2秒
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const cycleDuration = Math.min(effectDuration * 0.6, 1.2) / speed;

    // 使用 FFmpeg 的 PI 常量和 sin/cos 函数进行圆周运动
    // 角度 = 2 * PI * t / cycleDuration (弧度)
    const angle = `2*PI*${relTime}/${cycleDuration}`;

    // 圆周运动：x = centerX + radius * sin(angle), y = centerY - radius * cos(angle)
    // FFmpeg drawtext 支持 sin 和 cos 函数
    const xExpr = `${centerX}+${radius}*sin(${angle})-(text_w/2)`;
    const yExpr = `${centerY}-${radius}*cos(${angle})`;

    const config = this.buildDrawtextConfig(ctx, {
      x: xExpr,
      y: yExpr
    });

    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 摇摆旋转特效
 * 模拟钟摆摇摆运动：左右倾斜摇摆
 * 由于 FFmpeg drawtext 不支持旋转表达式，使用位置偏移模拟摇摆效果
 */
export class SwingEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {} } = ctx.params;
    const speed = this.applySpeed(1, ctx.params.speed || 1.0);
    const intensity = ctx.params?.intensity || 1.0;

    const relTime = `(t-${ctx.start})`;
    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用默认的1.0秒
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const cycleDuration = Math.min(effectDuration * 0.5, 1.0) / speed;

    // 使用锯齿波创建左右摇摆效果
    // 预览是 rotate(-5deg) 到 rotate(5deg)
    // 我们用水平位置偏移来模拟，摇摆幅度 30-50 像素
    const swingAmount = 40 * intensity;

    // 周期进度：0->1 循环
    const cycleProgress = `mod(${relTime}/${cycleDuration},1)`;

    // 创建平滑的左右摆动：-1 到 1 到 -1
    // 使用三角波：0-0.5 从 -1 到 1，0.5-1 从 1 到 -1
    const swingWave = `if(lt(${cycleProgress},0.5),${cycleProgress}*4-1,3-${cycleProgress}*4)`;

    // X 方向偏移，模拟摇摆
    const xOffset = `${swingAmount}*${swingWave}`;

    // Y 方向轻微上下（模拟钟摆弧线）
    const yOffset = `5*abs(${swingWave})`;

    const config = this.buildDrawtextConfig(ctx, {
      x: `${ctx.subtitle.position.x}-(text_w/2)+${xOffset}`,
      y: `${ctx.subtitle.position.y}+${yOffset}`
    });

    return (DrawtextGenerator as any).generateBasic(config);
  }
}
