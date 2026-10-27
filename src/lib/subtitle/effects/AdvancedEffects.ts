/**
 * 高级特效生成器
 */

import { BaseEffectGenerator } from './EffectGenerator';
import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';
import type { EffectParams } from './EffectLibrary';
import { ExpressionHelper } from './types';
import { DrawtextGenerator } from '../DrawtextGenerator';
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * HSV 转 RGB 辅助函数
 */
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

/**
 * 彩虹渐变特效
 * 与预览一致：颜色平滑循环变化，2秒一个周期，不闪烁
 * 预览 CSS: 0% { color: #ff0000; } 16.66% { color: #ff8800; } ... 100% { color: #ff0000; }
 * 使用重叠的三角波alpha实现平滑颜色过渡
 */
export class RainbowEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string[] {
    const ctx = this.createContext(subtitle, fontfile, params);
    const speed = ctx.params.speed || 1.0;
    const start = ctx.start;

    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用默认的2.0秒
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const cycleDuration = Math.min(effectDuration, 2.0) / speed;
    const relTime = `(t-${start})`;
    const cyclePos = `mod(${relTime},${cycleDuration})`;

    // 6色循环
    const segDur = cycleDuration / 6;

    // 彩虹6色（与预览CSS一致）
    const colors = [
      { color: '0xFF0000', seg: 0 },  // 红
      { color: '0xFF8800', seg: 1 },  // 橙
      { color: '0xFFFF00', seg: 2 },  // 黄
      { color: '0x00FF00', seg: 3 },  // 绿
      { color: '0x0088FF', seg: 4 },  // 青
      { color: '0x8800FF', seg: 5 },  // 紫
    ];

    const commands: string[] = [];

    // 为每个颜色创建一层
    // 使用重叠的三角波确保颜色平滑过渡，不会有间隙导致闪烁
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      const segCenter = (c.seg + 0.5) * segDur;  // 颜色段的中心点

      // alpha 表达式：以 segCenter 为中心的三角波
      // 从前一段的中点开始淡入，到后一段的中点淡出
      // 这样相邻颜色会重叠，实现平滑过渡
      // 范围：segCenter - segDur 到 segCenter + segDur
      const fadeStart = segCenter - segDur;
      const fadeEnd = segCenter + segDur;

      // 处理循环边界（第一个和最后一个颜色的过渡）
      let alphaExpr: string;
      if (i === 0) {
        // 红色：需要处理周期结束到开始的过渡
        alphaExpr = `if(lt(${cyclePos},${segDur}),1-abs(${cyclePos}-${segCenter})/${segDur},if(gt(${cyclePos},${cycleDuration - segDur}),1-abs(${cyclePos}-${cycleDuration}-${segCenter})/${segDur},0))`;
      } else {
        // 其他颜色：标准三角波
        alphaExpr = `if(lt(${cyclePos},${fadeStart}),0,if(lt(${cyclePos},${segCenter}),(${cyclePos}-${fadeStart})/${segDur},if(lt(${cyclePos},${fadeEnd}),1-(${cyclePos}-${segCenter})/${segDur},0)))`;
      }

      const config = this.buildDrawtextConfig(ctx, {
        fontcolor: c.color,
        alpha: alphaExpr
      });

      commands.push((DrawtextGenerator as any).generateBasic(config));
    }

    return commands;
  }
}

/**
 * 粒子爆炸特效
 */
export class ParticleBurstEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string[] {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {} } = ctx.params;
    const particleCount = custom.particleCount ?? 12;
    const spread = this.applyIntensity(custom.spread ?? 200, ctx.params.intensity);
    const speed = this.applySpeed(1, ctx.params.speed || 1.0);

    const commands: string[] = [];
    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;
    const angleStep = (Math.PI * 2) / particleCount;

    for (let i = 0; i < particleCount; i++) {
      const angle = i * angleStep;
      const particleText = ctx.subtitle.text.length > 0
        ? ctx.subtitle.text[i % ctx.subtitle.text.length]
        : ctx.subtitle.text;

      const relTime = ExpressionHelper.relativeTime(ctx.start);
      const progress = `if(lt(${relTime},${ctx.duration}/${speed}),${relTime}/${ctx.duration}*${speed},1)`;
      const distance = `${spread}*${progress}`;

      const xExpr = `${centerX}+${distance}*cos(${angle})`;
      const yExpr = `${centerY}+${distance}*sin(${angle})`;
      const alphaExpr = `1-${progress}`;

      const particleConfig = this.buildDrawtextConfig(ctx, {
        text: particleText,
        x: xExpr,
        y: yExpr,
        fontsize: ctx.subtitle.style.fontSize,
        alpha: alphaExpr
      });

      commands.push((DrawtextGenerator as any).generateBasic(particleConfig));
    }

    return commands;
  }
}

/**
 * 电击效果
 */
export class ElectricEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {}, colors = [] } = ctx.params;
    const flashSpeed = this.applySpeed(custom.flashSpeed ?? 8, ctx.params.speed || 1.0);

    const shakeAmount = this.applyIntensity(custom.shakeAmount ?? 5, ctx.params.intensity);
    const xOffset = `${shakeAmount}*sin(${flashSpeed * 5}*PI*(t-${ctx.start}))`;
    const yOffset = `${shakeAmount}*sin(${flashSpeed * 3}*PI*(t-${ctx.start}))`;

    const flash = ExpressionHelper.pulse(flashSpeed * 2, ctx.start);
    const alphaExpr = `0.5+0.5*${flash}`;

    let fontcolor = this.convertHexToDrawtext(ctx.subtitle.style.fontColor);
    if (colors.length >= 2) {
      const colorCycle = ExpressionHelper.pulse(flashSpeed, ctx.start);
      const color1 = this.convertHexToDrawtext(colors[0]);
      const color2 = this.convertHexToDrawtext(colors[1]);
      fontcolor = `if(gt(${colorCycle},0.5),${color1},${color2})`;
    }

    const config = this.buildDrawtextConfig(ctx, {
      x: `${ctx.subtitle.position.x}-(text_w/2)+${xOffset}`,
      y: `${ctx.subtitle.position.y}+${yOffset}`,
      fontcolor,
      alpha: alphaExpr
    });

    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 心跳脉冲特效
 * 模拟真实心跳的双峰节奏：快速跳动两次，然后短暂停顿
 * 预览效果：明显的缩放跳动 + 上下位移
 */
export class HeartbeatEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {} } = ctx.params;
    const speed = this.applySpeed(1, ctx.params.speed || 1.0);
    const intensity = ctx.params.intensity || 0.8;
    const start = ctx.start;

    const relTime = `(t-${start})`;
    // 🔧 修复：使用参数中的 duration，如果有的话，否则使用默认的1.0秒
    const effectDuration = params?.duration ? params.duration / 1000 : ctx.duration; // 转换为秒
    const beatCycle = Math.min(effectDuration, 1.0) / speed;

    // 心跳模式：双峰
    // 0-0.1: 第一次跳动（快速放大）
    // 0.1-0.2: 第一次收缩
    // 0.2-0.35: 第二次跳动（较小）
    // 0.35-0.5: 第二次收缩
    // 0.5-1.0: 休息期
    const cyclePos = `mod(${relTime},${beatCycle})/${beatCycle}`;

    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;
    const baseFontSize = ctx.subtitle.style.fontSize;

    // 缩放效果：心跳时放大，然后收缩
    // 第一次跳动：1.0 -> 1.25 -> 1.0
    // 第二次跳动：1.0 -> 1.15 -> 1.0
    const scale1Max = 1.0 + 0.25 * intensity;
    const scale2Max = 1.0 + 0.15 * intensity;

    // 缩放表达式（使用线性插值）
    const scaleExpr = `if(lt(${cyclePos},0.1),1+(${scale1Max}-1)*(${cyclePos}/0.1),if(lt(${cyclePos},0.2),${scale1Max}-(${scale1Max}-1)*((${cyclePos}-0.1)/0.1),if(lt(${cyclePos},0.25),1,if(lt(${cyclePos},0.35),1+(${scale2Max}-1)*((${cyclePos}-0.25)/0.1),if(lt(${cyclePos},0.45),${scale2Max}-(${scale2Max}-1)*((${cyclePos}-0.35)/0.1),1)))))`;

    // 字体大小表达式
    const fontSizeExpr = `${baseFontSize}*(${scaleExpr})`;

    // Y轴位移：跳动时轻微上移
    const jumpHeight = 15 * intensity;
    const yOffset = `if(lt(${cyclePos},0.1),${jumpHeight}*(${cyclePos}/0.1),if(lt(${cyclePos},0.2),${jumpHeight}*(1-(${cyclePos}-0.1)/0.1),if(lt(${cyclePos},0.35),${jumpHeight}*0.6*((${cyclePos}-0.25)/0.1),if(lt(${cyclePos},0.45),${jumpHeight}*0.6*(1-(${cyclePos}-0.35)/0.1),0))))`;
    const yExpr = `${centerY}-(${yOffset})`;

    // 透明度变化：增强跳动感
    const alphaExpr = `if(lt(${cyclePos},0.1),0.8+0.2*(${cyclePos}/0.1),if(lt(${cyclePos},0.15),1,if(lt(${cyclePos},0.2),0.85+0.15*((0.2-${cyclePos})/0.05),if(lt(${cyclePos},0.35),0.9,if(lt(${cyclePos},0.4),0.95,0.9)))))`;

    const config = this.buildDrawtextConfig(ctx, {
      fontsize: fontSizeExpr,
      x: `${centerX}-(text_w/2)`,
      y: yExpr,
      alpha: alphaExpr
    });

    return (DrawtextGenerator as any).generateBasic(config);
  }
}

/**
 * 弹幕满屏特效
 * 从中心向外快速爆发，形成刷屏效果
 */
export class DanmakuEffect extends BaseEffectGenerator {
  generate(subtitle: ArrangedSubtitle, fontfile: string, params?: EffectParams): string[] {
    const ctx = this.createContext(subtitle, fontfile, params);
    const { custom = {} } = ctx.params;

    const copyCount = custom.copyCount ?? 30;  // 增加到30，更密集的弹幕效果
    const sizeMin = custom.sizeMin ?? 0.4;
    const sizeMax = custom.sizeMax ?? 0.9;
    const suffix = custom.suffix ?? '+1';

    const commands: string[] = [];
    const baseFontSize = ctx.subtitle.style.fontSize;
    const start = ctx.start;
    // 使用用户设置的动画时长（从 params.duration 获取，单位毫秒转秒）
    const userDuration = params?.duration ? params.duration / 1000 : ctx.duration;
    const duration = Math.max(1.5, Math.min(userDuration, 5));  // 限制在1.5-5秒

    // 视频尺寸和中心点
    const centerX = ctx.subtitle.position.x;
    const centerY = ctx.subtitle.position.y;
    const videoWidth = Math.max(centerX * 2, 1080);
    const videoHeight = Math.max(centerY * 2, 1920);

    // 爆发中心点（使用关键词分组设置的坐标）
    const burstCenterX = centerX;
    const burstCenterY = centerY;
    
    // 初始位置分散范围：在中心点周围创建一个较大的分布区域
    // 使用屏幕尺寸的15-25%作为初始分散半径，让弹幕从不同位置开始
    const initialSpreadRadiusX = videoWidth * 0.2;  // 屏幕宽度的20%
    const initialSpreadRadiusY = videoHeight * 0.15;  // 屏幕高度的15%

    for (let i = 0; i < copyCount; i++) {
      // 随机角度（均匀分布在360度）
      const angleBase = (i / copyCount) * Math.PI * 2;
      const angleOffset = ((i * 7919 + 31337) % 100) / 100 * 0.5 - 0.25;  // ±0.25弧度偏移
      const angle = angleBase + angleOffset;

      // 随机大小
      const sizeRatio = ((i * 5417 + 19937) % 100) / 100;
      const sizeScale = sizeMin + sizeRatio * (sizeMax - sizeMin);
      const fontSize = Math.round(baseFontSize * sizeScale);

      // 随机出现延迟（0-0.2秒，更快）
      const delayRatio = ((i * 3571 + 11113) % 100) / 100;
      const burstDelay = delayRatio * 0.2;

      // 为每个弹幕生成分散的初始位置
      // 使用伪随机数生成器确保每个弹幕有不同的初始位置
      const seedX = (i * 7919 + 31337) % 1000;
      const seedY = (i * 5417 + 19937) % 1000;
      const offsetX = ((seedX / 1000) * 2 - 1) * initialSpreadRadiusX;  // -radius 到 +radius
      const offsetY = ((seedY / 1000) * 2 - 1) * initialSpreadRadiusY;  // -radius 到 +radius
      
      // 每个弹幕的起始位置（在中心点周围分散）
      const startX = burstCenterX + offsetX;
      const startY = burstCenterY + offsetY;

      // 扩散速度（快速向外）
      const speedBase = 280 + ((i * 2347) % 180);  // 280-460 像素/秒
      const speedX = Math.cos(angle) * speedBase;
      const speedY = Math.sin(angle) * speedBase;

      // 重力参数
      const gravity = 400;  // 像素/秒²
      const gravityStartTime = duration * 0.4;  // 40%时间后开始掉落

      const relTime = `(t-${start}-${burstDelay})`;

      // X方向：从分散的起始位置持续向外扩散（速度逐渐减慢）
      const xExpr = `${startX}+(${speedX})*max(0,${relTime})*(1-0.3*min(1,max(0,${relTime})/${duration}))`;

      // Y方向：从分散的起始位置先向外扩散，后半段加入重力向下掉落
      // 前40%时间：正常扩散
      // 后60%时间：加入重力加速度
      const gravityTime = `max(0,${relTime}-${gravityStartTime})`;
      const yExpr = `${startY}+(${speedY})*max(0,${relTime})+(${gravity / 2})*pow(${gravityTime},2)`;

      // 快速缩放（从0到目标大小）
      const scaleInDuration = 0.08;  // 80ms快速放大
      const scaleExpr = `if(lt(${relTime},0),0,if(lt(${relTime},${scaleInDuration}),${relTime}/${scaleInDuration},1))`;
      const fontSizeExpr = `${fontSize}*(${scaleExpr})`;

      // 透明度：快速出现，快速消失
      const fadeInDuration = 0.05;
      const holdEnd = duration * 0.5;  // 50%时间保持
      const alphaExpr = `if(lt(${relTime},0),0,if(lt(${relTime},${fadeInDuration}),${relTime}/${fadeInDuration},if(lt(${relTime},${holdEnd}),1,if(lt(${relTime},${duration}),1-(${relTime}-${holdEnd})/(${duration}-${holdEnd}),0))))`;

      const enableExpr = `between(t,${start + burstDelay},${start + duration + 0.3})`;

      const displayText = ctx.subtitle.text + suffix;

      const config = this.buildDrawtextConfig(ctx, {
        text: displayText,
        fontsize: fontSizeExpr,
        x: xExpr,
        y: yExpr,
        alpha: alphaExpr
      });

      (config as any).enable = enableExpr;

      commands.push((DrawtextGenerator as any).generateBasic(config));
    }

    return commands;
  }
}
