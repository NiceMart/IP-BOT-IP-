/**
 * 特效库入口文件
 * 注册所有特效生成器
 */

import { effectGeneratorRegistry } from './EffectGenerator';
import { generateEffect } from './EffectGenerator';

// 基础特效
import { ZoomInEffect } from './BasicEffects';
import { BounceEffect } from './BasicEffects';
import { FadeEffect } from './BasicEffects';
import { FlashEffect } from './BasicEffects';

// 位移动画特效
import { SlideUpEffect } from './MotionEffects';
import { SlideDownEffect } from './MotionEffects';
import { SlideLeftEffect } from './MotionEffects';
import { SlideRightEffect } from './MotionEffects';
import { FlyInEffect } from './MotionEffects';

// 旋转和翻转特效
import { SpinEffect } from './RotationEffects';
import { SwingEffect } from './RotationEffects';

// 视觉增强特效
import { GlowEffect } from './VisualEffects';
import { ShakeEffect } from './VisualEffects';
import { WaveEffect } from './VisualEffects';
import { BreatheEffect } from './VisualEffects';
import { IntenseFlashEffect } from './VisualEffects';

// 高级特效
import { RainbowEffect } from './AdvancedEffects';
import { ParticleBurstEffect } from './AdvancedEffects';
import { ElectricEffect } from './AdvancedEffects';
import { HeartbeatEffect } from './AdvancedEffects';
import { DanmakuEffect } from './AdvancedEffects';

// 注册所有特效生成器
effectGeneratorRegistry.register('zoom-in', new ZoomInEffect());
effectGeneratorRegistry.register('bounce', new BounceEffect());
effectGeneratorRegistry.register('fade', new FadeEffect());
effectGeneratorRegistry.register('flash', new FlashEffect());
effectGeneratorRegistry.register('intense-flash', new IntenseFlashEffect());

effectGeneratorRegistry.register('slide-up', new SlideUpEffect());
effectGeneratorRegistry.register('slide-down', new SlideDownEffect());
effectGeneratorRegistry.register('slide-left', new SlideLeftEffect());
effectGeneratorRegistry.register('slide-right', new SlideRightEffect());
effectGeneratorRegistry.register('fly-in', new FlyInEffect());

effectGeneratorRegistry.register('spin', new SpinEffect());
effectGeneratorRegistry.register('swing', new SwingEffect());

effectGeneratorRegistry.register('glow', new GlowEffect());
effectGeneratorRegistry.register('shake', new ShakeEffect());
effectGeneratorRegistry.register('wave', new WaveEffect());
effectGeneratorRegistry.register('breathe', new BreatheEffect());

effectGeneratorRegistry.register('rainbow', new RainbowEffect());
effectGeneratorRegistry.register('particle-burst', new ParticleBurstEffect());
effectGeneratorRegistry.register('electric', new ElectricEffect());
effectGeneratorRegistry.register('heartbeat', new HeartbeatEffect());
effectGeneratorRegistry.register('danmaku', new DanmakuEffect());

// 导出
export { generateEffect, effectGeneratorRegistry } from './EffectGenerator';
export { EFFECT_LIBRARY, getEffectMetadata, getAllEffects, getEffectsByCategory, mergeEffectParams } from './EffectLibrary';
export { ExpressionHelper } from './types';
export type { EffectParams, EffectMetadata } from './EffectLibrary';
export type { IEffectGenerator, EffectContext } from './types';













