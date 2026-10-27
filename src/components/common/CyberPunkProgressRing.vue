<template>
  <div class="cyberpunk-progress-container" :style="containerStyle">
    <canvas
      ref="canvasRef"
      :width="size"
      :height="size"
      class="cyberpunk-canvas"
    ></canvas>
    <div class="progress-overlay">
      <!-- 能量核心图标 - 替代百分比数字 -->
      <div class="energy-core">
        <div class="core-ring ring-outer"></div>
        <div class="core-ring ring-middle"></div>
        <div class="core-ring ring-inner"></div>
        <div class="core-center"></div>
      </div>
      <div class="progress-label" v-if="label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

interface Props {
  progress?: number; // 0-100
  size?: number; // 圆圈大小，默认 240
  label?: string; // 可选的标签文字
  lineWidth?: number; // 进度环宽度，默认 4
  error?: boolean; // 是否错误状态
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  size: 240,
  label: '',
  lineWidth: 4,
  error: false
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
let particles: VortexParticle[] = [];
let trails: TrailPoint[] = [];
let rotationAngle = 0;
let time = 0;
let lastFrameTime = 0; // 用于帧率控制
const targetFPS = 30; // 目标帧率降至30fps，减少CPU占用
const frameInterval = 1000 / targetFPS;

// 赛博朋克配色
const colors = computed(() => {
  if (props.error) {
    return {
      primary: '#ef4444',
      secondary: '#f87171',
      accent: '#ef4444',
      glow: '#ef4444'
    };
  }
  return {
    primary: '#f97316',
    secondary: '#f472b6',
    accent: '#c084fc',
    glow: '#f97316'
  };
});

const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}));

// 轨迹点
interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

// 旋涡粒子类
class VortexParticle {
  angle: number; // 当前角度
  radius: number; // 当前半径
  targetRadius: number; // 目标半径
  speed: number; // 旋转速度
  radialSpeed: number; // 径向速度（向心）
  size: number; // 粒子大小
  color: string; // 粒子颜色
  opacity: number; // 透明度
  pulsePhase: number; // 脉冲相位
  layer: number; // 层级（0=外层, 1=中层, 2=内层）
  trail: TrailPoint[]; // 轨迹点数组

  constructor(angle: number, initialRadius: number, layer: number, colorPalette: typeof colors.value) {
    this.angle = angle;
    this.radius = initialRadius;
    this.targetRadius = initialRadius * 0.3; // 最终汇聚到30%半径
    this.layer = layer;
    
    // 根据层级设置不同的速度（增强旋转速度，更酷的转圈效果）
    const layerSpeeds = [0.08, 0.06, 0.04];  // 原来是 [0.03, 0.02, 0.015] - 增加2-3倍速度
    const layerRadialSpeeds = [0.5, 0.3, 0.2];
    const layerSizes = [5, 4, 3];  // 原来是 [4, 3, 2] - 增加粒子大小
    
    this.speed = layerSpeeds[layer] + Math.random() * 0.01;
    this.radialSpeed = layerRadialSpeeds[layer] * (0.5 + Math.random() * 0.5);
    this.size = layerSizes[layer] + Math.random() * 1;
    
    // 根据角度选择颜色
    const colorArray = [colorPalette.primary, colorPalette.secondary, colorPalette.accent];
    this.color = colorArray[Math.floor((angle / (Math.PI * 2)) * colorArray.length) % colorArray.length];
    
    this.opacity = 0.7 + Math.random() * 0.3;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.trail = [];
  }

  update(progress: number, time: number) {
    // 旋转
    this.angle += this.speed;
    
    // 根据进度向中心移动
    const progressFactor = progress / 100;
    const currentTargetRadius = this.targetRadius + (this.radius - this.targetRadius) * (1 - progressFactor);
    
    // 径向移动（向心）
    if (this.radius > currentTargetRadius) {
      this.radius -= this.radialSpeed * progressFactor;
      if (this.radius < currentTargetRadius) {
        this.radius = currentTargetRadius;
      }
    }
    
    // 脉冲效果
    this.pulsePhase += 0.15;
    const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
    this.opacity = (0.5 + pulse * 0.5) * progressFactor;
    
    // 添加轨迹点
    const x = props.size / 2 + Math.cos(this.angle) * this.radius;
    const y = props.size / 2 + Math.sin(this.angle) * this.radius;
    
    this.trail.push({
      x,
      y,
      opacity: this.opacity * 0.6,
      color: this.color,
      size: this.size * 0.8,
      life: 1,
      maxLife: 20 + Math.random() * 10
    });
    
    // 限制轨迹长度
    if (this.trail.length > 15) {
      this.trail.shift();
    }
    
    // 更新轨迹点生命周期
    this.trail.forEach(point => {
      point.life -= 1 / point.maxLife;
      point.opacity *= 0.95;
    });
    
    // 移除死亡的轨迹点
    this.trail = this.trail.filter(point => point.life > 0 && point.opacity > 0.01);
  }

  draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number) {
    const x = centerX + Math.cos(this.angle) * this.radius;
    const y = centerY + Math.sin(this.angle) * this.radius;

    // 绘制轨迹
    if (this.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3;
      
      ctx.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const point = this.trail[i];
        const alpha = point.opacity * (i / this.trail.length);
        ctx.globalAlpha = alpha * 0.4;
        
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 绘制粒子（增强发光效果）
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;

    // 多层发光效果
    ctx.shadowBlur = 30;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(x, y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // 中层光晕
    ctx.shadowBlur = 50;
    ctx.globalAlpha = this.opacity * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, this.size * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 外层光晕
    ctx.shadowBlur = 40;
    ctx.globalAlpha = this.opacity * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, this.size * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 初始化粒子
const initParticles = () => {
  particles = [];
  const centerX = props.size / 2;
  const centerY = props.size / 2;
  const maxRadius = props.size * 0.4;
  
  const colorPalette = colors.value;
  
  // 外层粒子（16个）
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * 2 / 16) * i + Math.random() * 0.2;
    const radius = maxRadius + (Math.random() - 0.5) * 10;
    particles.push(new VortexParticle(angle, radius, 0, colorPalette));
  }
  
  // 中层粒子（12个）
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
    const radius = maxRadius * 0.7 + (Math.random() - 0.5) * 8;
    particles.push(new VortexParticle(angle, radius, 1, colorPalette));
  }
  
  // 内层粒子（8个）
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.4;
    const radius = maxRadius * 0.5 + (Math.random() - 0.5) * 6;
    particles.push(new VortexParticle(angle, radius, 2, colorPalette));
  }
};

// 绘制函数（优化：帧率控制，降低CPU占用）
const draw = (currentTime: number = 0) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  // 帧率控制：只在达到目标帧间隔时才渲染
  if (currentTime - lastFrameTime < frameInterval) {
    animationFrameId = requestAnimationFrame(draw);
    return;
  }
  lastFrameTime = currentTime;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const centerX = props.size / 2;
  const centerY = props.size / 2;
  const maxRadius = props.size * 0.4;

  // 清空画布
  ctx.clearRect(0, 0, props.size, props.size);

  time += frameInterval / 1000; // 根据实际帧间隔更新时间

  // 绘制背景轨道（半透明，增强发光效果）
  ctx.save();
  ctx.strokeStyle = props.error
    ? 'rgba(255, 0, 102, 0.3)'
    : 'rgba(0, 255, 255, 0.3)';
  ctx.lineWidth = 3;  // 增加线宽
  ctx.shadowBlur = 15;  // 添加发光
  ctx.shadowColor = props.error ? 'rgba(255, 0, 102, 0.5)' : 'rgba(0, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 绘制进度旋涡环
  if (props.progress > 0) {
    const progressRad = (props.progress / 100) * Math.PI * 2;
    
    // 绘制多层进度环
    for (let layer = 0; layer < 3; layer++) {
      const layerRadius = maxRadius * (1 - layer * 0.15);
      const layerProgress = Math.max(0, props.progress - layer * 10);
      const layerProgressRad = (layerProgress / 100) * Math.PI * 2;
      
      if (layerProgressRad > 0) {
        ctx.save();
        
        // 创建渐变
        const gradient = ctx.createLinearGradient(
          centerX - layerRadius,
          centerY - layerRadius,
          centerX + layerRadius,
          centerY + layerRadius
        );
        gradient.addColorStop(0, colors.value.primary);
        gradient.addColorStop(0.5, colors.value.secondary);
        gradient.addColorStop(1, colors.value.accent);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = props.lineWidth - layer + 1;  // 增加线宽，更粗更显眼
        ctx.lineCap = 'round';
        ctx.shadowBlur = 40 - layer * 8;  // 增加发光模糊强度（原来20-15-10，现在40-32-24）
        ctx.shadowColor = colors.value.glow;
        ctx.globalAlpha = 0.8 + layer * 0.15;  // 增加透明度，更亮（原来0.6-0.8，现在0.8-0.95）
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, layerRadius, -Math.PI / 2, -Math.PI / 2 + layerProgressRad);
        ctx.stroke();
        
        ctx.restore();
      }
    }
  }

  // 更新并绘制粒子
  rotationAngle += 0.01;
  const activeParticleCount = Math.floor((props.progress / 100) * particles.length) || particles.length;
  
  // 按层级绘制（从内到外，确保内层在上）
  const layers = [[], [], []];
  particles.forEach((particle, index) => {
    if (index < activeParticleCount) {
      particle.update(props.progress, time);
      layers[particle.layer].push(particle);
    }
  });
  
  // 从内层到外层绘制
  for (let layer = 2; layer >= 0; layer--) {
    layers[layer].forEach(particle => {
      particle.draw(ctx, centerX, centerY);
    });
  }

  // 绘制中心点（增强发光和脉冲效果）
  ctx.save();
  ctx.fillStyle = colors.value.primary;
  ctx.shadowBlur = 40;  // 增加发光强度
  ctx.shadowColor = colors.value.glow;
  ctx.globalAlpha = 0.9 + Math.sin(time * 3) * 0.15;  // 增加整体亮度和脉冲幅度
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6 + Math.sin(time * 4) * 3, 0, Math.PI * 2);  // 增加大小和脉冲幅度
  ctx.fill();

  // 中心点中层光晕
  ctx.fillStyle = colors.value.secondary;
  ctx.shadowBlur = 25;
  ctx.globalAlpha = 0.6 + Math.sin(time * 5) * 0.2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 8 + Math.sin(time * 3.5) * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // 中心点内层高光
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ffffff';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 绘制连接线（从中心到激活的粒子，增强可见性）
  if (props.progress > 0) {
    ctx.save();
    ctx.strokeStyle = colors.value.primary;
    ctx.lineWidth = 1;  // 增加线宽，更显眼
    ctx.globalAlpha = 0.25;  // 增加透明度，更可见
    ctx.shadowBlur = 10;  // 添加发光
    ctx.shadowColor = colors.value.primary;
    
    particles.slice(0, activeParticleCount).forEach(particle => {
      const x = centerX + Math.cos(particle.angle) * particle.radius;
      const y = centerY + Math.sin(particle.angle) * particle.radius;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });
    ctx.restore();
  }

  animationFrameId = requestAnimationFrame(draw);
};

// 启动动画
const startAnimation = () => {
  if (animationFrameId) return;
  initParticles();
  draw();
};

// 停止动画
const stopAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

// 监听进度和错误状态变化，重新初始化粒子
watch([() => props.progress, () => props.error], () => {
  if (particles.length === 0) {
    initParticles();
  }
}, { immediate: false });

onMounted(() => {
  startAnimation();
});

onUnmounted(() => {
  stopAnimation();
});
</script>

<style scoped>
.cyberpunk-progress-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.cyberpunk-canvas {
  display: block;
  filter: drop-shadow(0 0 20px rgba(249, 115, 22, 0.6)) drop-shadow(0 0 40px rgba(249, 115, 22, 0.3)) drop-shadow(0 0 60px rgba(244, 114, 182, 0.2));
}

.progress-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  z-index: 10;
}

/* 能量核心样式 */
.energy-core {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.core-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid;
  animation: coreRotate 4s linear infinite, corePulse 2s ease-in-out infinite;
}

.ring-outer {
  width: 70px;
  height: 70px;
  border-color: rgba(249, 115, 22, 0.6);
  box-shadow:
    0 0 15px rgba(249, 115, 22, 0.6),
    inset 0 0 15px rgba(249, 115, 22, 0.3);
  animation-duration: 3s;
}

.ring-middle {
  width: 50px;
  height: 50px;
  border-color: rgba(244, 114, 182, 0.6);
  box-shadow:
    0 0 12px rgba(244, 114, 182, 0.6),
    inset 0 0 12px rgba(244, 114, 182, 0.3);
  animation-duration: 4s;
  animation-direction: reverse;
}

.ring-inner {
  width: 30px;
  height: 30px;
  border-color: rgba(192, 132, 252, 0.8);
  box-shadow:
    0 0 10px rgba(192, 132, 252, 0.8),
    inset 0 0 10px rgba(192, 132, 252, 0.4);
  animation-duration: 2s;
}

.core-center {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 255, 255, 1) 0%,
    rgba(249, 115, 22, 0.9) 30%,
    rgba(244, 114, 182, 0.6) 100%
  );
  box-shadow:
    0 0 20px rgba(249, 115, 22, 1),
    0 0 40px rgba(244, 114, 182, 0.8),
    inset 0 0 10px rgba(255, 255, 255, 0.5);
  animation: centerPulse 1.5s ease-in-out infinite;
}

@keyframes coreRotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes corePulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes centerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow:
      0 0 20px rgba(249, 115, 22, 1),
      0 0 40px rgba(244, 114, 182, 0.8),
      inset 0 0 10px rgba(255, 255, 255, 0.5);
  }
  50% {
    transform: scale(1.3);
    box-shadow:
      0 0 30px rgba(249, 115, 22, 1),
      0 0 60px rgba(244, 114, 182, 1),
      0 0 90px rgba(244, 114, 182, 0.6),
      inset 0 0 15px rgba(255, 255, 255, 0.8);
  }
}

.progress-label {
  font-size: 12px;
  color: rgba(249, 115, 22, 0.95);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 500;
  margin-top: 6px;
  text-shadow:
    0 0 8px rgba(249, 115, 22, 0.8),
    0 0 16px rgba(249, 115, 22, 0.5);
  animation: labelGlow 3s ease-in-out infinite;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
}

@keyframes labelGlow {
  0%, 100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}
</style>









