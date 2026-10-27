/**
 * 统一的特效生成器基类
 */

import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import type { EffectContext } from './types';
import { ExpressionHelper } from './types';
import { DrawtextGenerator } from '../DrawtextGenerator';
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * 基础特效生成器类
 */
export abstract class BaseEffectGenerator {
  /**
   * 生成特效命令
   */
  abstract generate(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    params?: EffectParams
  ): string | string[];

  /**
   * 创建特效上下文
   */
  protected createContext(
    subtitle: ArrangedSubtitle,
    fontfile: string,
    params?: EffectParams
  ): EffectContext {
    const start = subtitle.start;
    // 🔧 修复：如果有 params.duration，使用它来计算 end 时间
    const end = params?.duration ?
      start + params.duration / 1000 : // 将毫秒转换为秒
      subtitle.end;
    const duration = end - start;

    const effectiveParams: EffectParams = {
      intensity: 0.8,
      speed: 1.0,
      delay: 0,
      ...params
    };

    // 🔧 调试日志
    console.log('[EffectGenerator] createContext 时间范围:', {
      subtitleStart: subtitle.start,
      subtitleEnd: subtitle.end,
      subtitleDuration: subtitle.end - subtitle.start,
      paramsDuration: params?.duration,
      finalStart: start,
      finalEnd: end,
      finalDuration: duration
    });

    return {
      subtitle,
      fontfile,
      params: effectiveParams,
      start,
      end,
      duration
    };
  }

  /**
   * 生成基础 drawtext 配置
   */
  protected buildDrawtextConfig(ctx: EffectContext, overrides: Partial<any> = {}) {
    const color = this.convertHexToDrawtext(ctx.subtitle.style.fontColor);
    const borderColor = this.convertHexToDrawtext(ctx.subtitle.style.outlineColor);

    return {
      fontfile: ctx.fontfile,
      text: ctx.subtitle.text,
      x: `${ctx.subtitle.position.x}-(text_w/2)`,
      y: `${ctx.subtitle.position.y}`,
      fontsize: ctx.subtitle.style.fontSize,
      fontcolor: color,
      borderw: ctx.subtitle.style.outlineWidth,
      bordercolor: borderColor,
      enable: `between(t,${ctx.start},${ctx.end})`,
      ...overrides
    };
  }

  /**
   * 转义路径
   */
  protected escapePath(path: string): string {
    return DrawtextGenerator['escapePath'](path);
  }

  /**
   * 转义文本
   */
  protected escapeText(text: string): string {
    return DrawtextGenerator['escapeText'](text);
  }

  /**
   * 转换十六进制颜色
   */
  protected convertHexToDrawtext(hexColor: string): string {
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
   * 应用强度参数
   */
  protected applyIntensity(value: number, intensity: number = 0.8): number {
    return value * intensity;
  }

  /**
   * 应用速度参数
   */
  protected applySpeed(frequency: number, speed: number = 1.0): number {
    return frequency * speed;
  }
}

/**
 * 特效生成器注册表
 */
class EffectGeneratorRegistry {
  private generators: Map<string, BaseEffectGenerator> = new Map();

  register(effectId: string, generator: BaseEffectGenerator) {
    this.generators.set(effectId, generator);
  }

  get(effectId: string): BaseEffectGenerator | null {
    return this.generators.get(effectId) || null;
  }

  has(effectId: string): boolean {
    return this.generators.has(effectId);
  }
}

export const effectGeneratorRegistry = new EffectGeneratorRegistry();

/**
 * 统一的特效生成入口
 */
export function generateEffect(
  effectId: string,
  subtitle: ArrangedSubtitle,
  fontfile: string,
  params?: EffectParams
): string | string[] | null {
  const generator = effectGeneratorRegistry.get(effectId);
  if (!generator) {
    // 🔧 修复：如果找不到特效，返回 null 让调用者处理 fallback
    // 不要直接返回默认样式，否则 DrawtextGenerator 中的旧特效逻辑永远不会被执行
    console.warn(`[EffectGenerator] 未找到特效生成器: ${effectId}，返回 null 以便 fallback`);
    return null;
  }

  return generator.generate(subtitle, fontfile, params);
}
