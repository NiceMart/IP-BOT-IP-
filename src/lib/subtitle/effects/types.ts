/**
 * 特效相关类型定义
 */

import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';

/**
 * 特效生成器接口
 */
export interface IEffectGenerator {
  /**
   * 生成 FFmpeg drawtext 命令
   * @param subtitle 字幕配置
   * @param fontfile 字体文件路径
   * @param params 特效参数
   * @returns drawtext 命令（字符串或字符串数组）
   */
  generate(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    params?: EffectParams
  ): string | string[];
}

/**
 * 特效生成上下文
 */
export interface EffectContext {
  subtitle: ArrangedSubtitle;
  fontfile: string;
  params: EffectParams;
  start: number;      // 开始时间（秒）
  end: number;        // 结束时间（秒）
  duration: number;   // 持续时间（秒）
}

/**
 * 数学表达式辅助函数
 */
export class ExpressionHelper {
  /**
   * 计算相对时间（从字幕开始的时间）
   */
  static relativeTime(start: number): string {
    return `(t-${start})`;
  }

  /**
   * 生成正弦波表达式
   */
  static sin(frequency: number, start: number, phase: number = 0): string {
    return `sin(${frequency}*PI*${this.relativeTime(start)}+${phase})`;
  }

  /**
   * 生成余弦波表达式
   */
  static cos(frequency: number, start: number, phase: number = 0): string {
    return `cos(${frequency}*PI*${this.relativeTime(start)}+${phase})`;
  }

  /**
   * 生成线性插值
   */
  static lerp(start: number, end: number, duration: number, startTime: number): string {
    const relTime = this.relativeTime(startTime);
    return `${start}+(${end}-${start})*(${relTime}/${duration})`;
  }

  /**
   * 生成缓动函数（easeOut）
   * 注意：使用简化的线性插值而不是 pow() 函数，因为 FFmpeg drawtext 不支持 pow()
   */
  static easeOut(start: number, end: number, duration: number, startTime: number): string {
    const relTime = this.relativeTime(startTime);
    // 使用简单的线性插值替代复杂的缓动函数
    // 原始 easeOut 需要 pow() 和 min() 函数，FFmpeg drawtext 不支持
    // 改为使用 if() 函数限制 progress 在 0-1 之间
    const progress = `if(lt(${relTime},0),0,if(gt(${relTime},${duration}),1,${relTime}/${duration}))`;
    return `${start}+(${end}-${start})*${progress}`;
  }

  /**
   * 生成条件表达式
   */
  static if(condition: string, trueValue: string, falseValue: string): string {
    return `if(${condition},${trueValue},${falseValue})`;
  }

  /**
   * 生成淡入淡出 alpha 表达式
   */
  static fadeInOut(
    startTime: number,
    endTime: number,
    fadeInDuration: number,
    fadeOutDuration: number
  ): string {
    const relTime = this.relativeTime(startTime);
    const duration = endTime - startTime;
    const fadeOutStart = duration - fadeOutDuration;

    return this.if(
      `lt(${relTime},${fadeInDuration})`,
      `(${relTime})/${fadeInDuration}`,
      this.if(
        `gt(${relTime},${fadeOutStart})`,
        `(${duration}-${relTime})/${fadeOutDuration}`,
        '1'
      )
    );
  }

  /**
   * 生成脉冲表达式（0-1范围）
   */
  static pulse(frequency: number, start: number): string {
    return `0.5+0.5*${this.sin(frequency, start)}`;
  }

  /**
   * 生成缩放表达式
   * 注意：这个方法会生成 fontsize 表达式，但 FFmpeg drawtext 的 fontsize 参数不支持复杂表达式
   * 因此建议使用 alpha 参数替代来实现动画效果
   */
  static scale(
    baseSize: number,
    minScale: number,
    maxScale: number,
    frequency: number,
    start: number
  ): string {
    // 注意：FFmpeg drawtext 的 fontsize 参数有严格限制，不支持复杂表达式
    // 改为返回固定大小，动画应该使用 alpha 或 x/y 参数实现
    console.warn('[ExpressionHelper.scale] 警告：fontsize 不支持复杂表达式，建议使用 alpha 参数实现动画');
    return `${baseSize}`;
  }

  /**
   * 生成圆形运动轨迹
   */
  static circularMotion(
    centerX: number,
    centerY: number,
    radius: number,
    frequency: number,
    start: number
  ): { x: string; y: string } {
    const relTime = this.relativeTime(start);
    const angle = `${frequency}*PI*${relTime}`;
    return {
      x: `${centerX}+${radius}*cos(${angle})`,
      y: `${centerY}+${radius}*sin(${angle})`
    };
  }
}













