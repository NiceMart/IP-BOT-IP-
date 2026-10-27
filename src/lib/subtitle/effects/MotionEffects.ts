/**
 * 位移动画特效生成器
 */

import { BaseEffectGenerator } from './EffectGenerator';
import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import { ExpressionHelper } from './types';
import { DrawtextGenerator } from '../DrawtextGenerator';
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * 滑入特效基类
 */
abstract class SlideEffectBase extends BaseEffectGenerator {
  // 子类需要实现此方法返回自己的方向
  protected abstract getDirection(): 'up' | 'down' | 'left' | 'right';

  protected getDirectionConfig(
    ctx: { subtitle: ArrangedSubtitle; start: number; end: number; duration: number; params: EffectParams },
    custom: any
  ): { x: string; y: string } {
    return { x: '', y: '' };
  }

  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    // 使用子类指定的方向，而不是 params 中的方向
    const direction = this.getDirection();
    const speed = ctx.params.speed || 1.0;
    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用字幕时长
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const transition = Math.min(effectDuration * 0.4, 0.8) / speed;

    // 调试日志
    console.log(`[SlideEffect] 🎯 特效时长计算详情:`, {
      effectId: this.constructor.name,
      paramsDurationMs: params?.duration,
      paramsDurationSec: params?.duration ? params.duration / 1000 : 'undefined',
      ctxDuration: ctx.duration,
      effectDuration,
      transition,
      speed,
      // 显示最终的表达式会是什么样子
      transitionTime: transition,
      totalEffectTime: effectDuration
    });

    // 【新增】关键诊断：显示当前使用的字幕位置
    console.log(`[SlideEffect] 🎯 字幕位置信息:`, {
      subtitleText: ctx.subtitle.text.substring(0, 20),
      position: {
        x: ctx.subtitle.position.x,
        y: ctx.subtitle.position.y,
        alignment: ctx.subtitle.position.alignment
      },
      direction
    });

    const start = ctx.start;

    // 根据方向调整默认距离
    let distance = ctx.params?.custom?.distance ?? 100;
    if (direction === 'left' || direction === 'right') {
      distance = ctx.params?.custom?.distance ?? 800;
    }

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;

    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case 'up':
        // 向上滑入：从下方进入
        startY = centerY + distance;
        endY = centerY;
        // 🔧 修复：水平位置保持不变（由SmartLayoutManager分配的左/中/右位置）
        // X轴不动画，始终保持centerX
        break;
      case 'down':
        // 向下滑入：从上方进入
        startY = centerY - distance;
        endY = centerY;
        // 🔧 修复：水平位置保持不变
        break;
      case 'left':
        // 向左滑入：从右侧进入
        startX = centerX + distance;
        endX = centerX;
        // 🔧 重要：这个方向也应该只在X轴动画，Y轴保持不变
        break;
      case 'right':
        // 向右滑入：从左侧进入
        startX = centerX - distance;
        endX = centerX;
        // 🔧 重要：这个方向也应该只在X轴动画，Y轴保持不变
        break;
    }

    // 【新增】关键诊断：显示计算的动画起终点
    console.log(`[SlideEffect] 🎯 动画起终点:`, {
      startX,
      endX,
      startY,
      endY,
      direction,
      centerX,
      centerY,
      distance
    });

    // 生成平滑过渡表达式
    // 🔧 关键修复：确保startX和endX始终相同（对于上/下方向），防止不必要的水平动画
    // 或者确保只有指定方向的轴才动画，其他轴保持不变
    const xExpr = startX === endX
      ? `${centerX}-(text_w/2)` // X轴不动画：直接使用最终位置
      : `if(lt((t-${start}),${transition}),(${startX}-(text_w/2))+(${endX}-${startX})*(t-${start})/${transition},${endX}-(text_w/2))`; // X轴动画

    const yExpr = startY === endY
      ? `${centerY}` // Y轴不动画：直接使用最终位置
      : `if(lt((t-${start}),${transition}),${startY}+(${endY}-${startY})*(t-${start})/${transition},${endY})`; // Y轴动画

    // 【新增】关键诊断：显示最终生成的表达式
    console.log(`[SlideEffect] 🎯 动画表达式（前100字）:`, {
      xExpr: xExpr.substring(0, 100),
      yExpr: yExpr.substring(0, 100),
      startX_equals_endX: startX === endX,
      startY_equals_endY: startY === endY
    });

    const config = this.buildDrawtextConfig(ctx, { x: xExpr, y: yExpr });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 向上滑入特效
 */
export class SlideUpEffect extends SlideEffectBase {
  protected getDirection(): 'up' | 'down' | 'left' | 'right' {
    return 'up';
  }
}

/**
 * 向下滑入特效
 */
export class SlideDownEffect extends SlideEffectBase {
  protected getDirection(): 'up' | 'down' | 'left' | 'right' {
    return 'down';
  }
}

/**
 * 向左滑入特效
 */
export class SlideLeftEffect extends SlideEffectBase {
  protected getDirection(): 'up' | 'down' | 'left' | 'right' {
    return 'left';
  }
}

/**
 * 向右滑入特效
 */
export class SlideRightEffect extends SlideEffectBase {
  protected getDirection(): 'up' | 'down' | 'left' | 'right' {
    return 'right';
  }
}

/**
 * 弹性飞入特效
 * 从上方飞入，只弹一次，然后停止
 */
export class FlyInEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const start = ctx.start;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;
    const baseFontSize = ctx.subtitle.style.fontSize;

    // 动画持续时间：0.5秒
    const animDuration = 0.5 / speed;

    // 从上方飞入的距离
    const startOffsetY = -120;

    const relTime = `(t-${start})`;
    // 归一化进度 0->1，动画结束后保持1
    const rawProgress = `min(${relTime}/${animDuration},1)`;

    // 简单的缓出效果：快速减速到达目标位置，不回弹
    // 使用二次缓出: 1 - (1-t)^2
    const easeOutProgress = `(1-pow(1-${rawProgress},2))`;

    // Y轴位移：从-120px到0
    const yOffset = `${startOffsetY}*(1-${easeOutProgress})`;
    const yExpr = `${centerY}+${yOffset}-(text_h/2)`;

    // 缩放：从0.5到1.0
    const scaleExpr = `0.5+0.5*${easeOutProgress}`;
    const fontSizeExpr = `${baseFontSize}*(${scaleExpr})`;

    // 透明度：从0到1
    const alphaExpr = `min(${rawProgress}*2,1)`;

    // 🔧 修复：X轴保持不变（不动画），直接使用分配的水平位置（左/中/右）
    // 这样由SmartLayoutManager分配的左中右位置不会被动画覆盖
    const xExpr = `${centerX}-(text_w/2)`;

    const config = this.buildDrawtextConfig(ctx, {
      x: xExpr,
      y: yExpr,
      fontsize: fontSizeExpr,
      alpha: alphaExpr
    });
    return (DrawtextGenerator as any).generateBasic(config);
  }
}
