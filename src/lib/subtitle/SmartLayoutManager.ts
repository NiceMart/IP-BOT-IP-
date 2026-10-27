/**
 * 智能字幕布局管理器
 * 负责判断特效字幕和普通字幕的位置分配，避免重叠和遮挡
 */

import type { ArrangedSubtitle } from '@/service/ZimuShengcheng.types';

export interface Position {
  x: number;
  y: number;
  alignment: 'left' | 'center' | 'right';
}

export interface LayoutResult {
  position: Position;
  strategy: 'horizontal' | 'vertical' | 'separate';
  reason: string;
}

export class SmartLayoutManager {
  private screenWidth: number;
  private screenHeight: number;
  private horizontalMargin: number;
  private verticalMargin: number;

  // 动画时长阈值（秒）：超过此值，特效字幕单独放置
  private readonly LONG_ANIMATION_THRESHOLD = 5.0;

  // 安全距离系数：特效字幕字体大小 * 此系数 = 最小安全距离
  private readonly SAFE_DISTANCE_FACTOR = 0.5;

  constructor(
    screenWidth: number = 1920,
    screenHeight: number = 1080,
    horizontalMargin: number = 100,
    verticalMargin: number = 100
  ) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.horizontalMargin = horizontalMargin;
    this.verticalMargin = verticalMargin;
  }

  /**
   * 计算字幕文本的像素宽度
   * 考虑中文字符和英文字母的宽度差异
   * 🔧 改进：添加安全系数，防止字幕超出屏幕
   */
  calculateSubtitleWidth(text: string, fontSize: number): number {
    let width = 0;
    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        // 中文字符：宽度 ≈ fontSize * 0.9
        width += fontSize * 0.9;
      } else if (/[a-zA-Z]/.test(char)) {
        // 英文字母：宽度 ≈ fontSize * 0.5
        width += fontSize * 0.5;
      } else if (/[0-9]/.test(char)) {
        // 数字：宽度 ≈ fontSize * 0.5
        width += fontSize * 0.5;
      } else {
        // 其他字符（标点等）：宽度 ≈ fontSize * 0.3
        width += fontSize * 0.3;
      }
    }
    // 🔧 修复：安全系数应该较小（1.05），太大会导致字幕宽度高估
    // 这会导致计算的minX/maxX范围太窄，最终让所有字幕都被推到右边
    return width * 1.05;
  }

  /**
   * 计算字幕高度（考虑行高）
   */
  calculateSubtitleHeight(fontSize: number, lineCount: number = 1): number {
    const lineHeight = fontSize * 1.5;
    return lineHeight * lineCount;
  }

  /**
   * 判断特效字幕动画是否过长
   */
  isLongAnimation(subtitle: ArrangedSubtitle): boolean {
    if (!subtitle.animationConfig) {
      return false;
    }

    // 获取实际的动画时长（毫秒）
    const durationMs = subtitle.animationConfig.duration ||
      subtitle.animationConfig.parameters?.duration ||
      0;

    // 转换为秒进行比较
    const durationSeconds = durationMs / 1000;

    return durationSeconds > this.LONG_ANIMATION_THRESHOLD;
  }

  /**
   * 计算最小安全距离
   * 特效字幕通常更大，需要更多空间
   */
  calculateSafeDistance(effectFontSize: number): number {
    return effectFontSize * this.SAFE_DISTANCE_FACTOR;
  }

  /**
   * 判断是否可以水平排列（同一行显示）
   */
  canPlaceHorizontally(
    normalSubtitle: ArrangedSubtitle,
    effectSubtitle: ArrangedSubtitle
  ): boolean {
    // 计算字幕宽度
    const normalWidth = this.calculateSubtitleWidth(
      normalSubtitle.text,
      normalSubtitle.style.fontSize
    );
    const effectWidth = this.calculateSubtitleWidth(
      effectSubtitle.text,
      effectSubtitle.style.fontSize
    );

    // 计算安全距离
    const safeDistance = this.calculateSafeDistance(effectSubtitle.style.fontSize);

    // 计算所需总宽度
    const requiredWidth = normalWidth + safeDistance + effectWidth;

    // 可用宽度（屏幕宽度 - 左右边距）
    const availableWidth = this.screenWidth - this.horizontalMargin * 2;

    // 判断是否足够
    const canFit = requiredWidth <= availableWidth;

    console.log(`[SmartLayoutManager] 水平排列判断:`, {
      normalWidth,
      effectWidth,
      safeDistance,
      requiredWidth,
      availableWidth,
      canFit
    });

    return canFit;
  }

  /**
   * 计算水平排列的位置
   */
  calculateHorizontalPosition(
    normalSubtitle: ArrangedSubtitle,
    effectSubtitle: ArrangedSubtitle
  ): Position {
    const normalWidth = this.calculateSubtitleWidth(
      normalSubtitle.text,
      normalSubtitle.style.fontSize
    );
    const effectWidth = this.calculateSubtitleWidth(
      effectSubtitle.text,
      effectSubtitle.style.fontSize
    );
    const safeDistance = this.calculateSafeDistance(effectSubtitle.style.fontSize);

    // 普通字幕居中
    const normalCenterX = this.screenWidth / 2;
    const normalStartX = normalCenterX - normalWidth / 2;
    const normalEndX = normalStartX + normalWidth;

    // 特效字幕在普通字幕右侧
    const effectStartX = normalEndX + safeDistance;
    const effectCenterX = effectStartX + effectWidth / 2;

    // 检查是否会超出屏幕右边界
    const effectEndX = effectCenterX + effectWidth / 2;
    if (effectEndX > this.screenWidth - this.horizontalMargin) {
      // 超出边界，改为放在普通字幕左侧
      const effectEndXLeft = normalStartX - safeDistance;
      const effectCenterXLeft = effectEndXLeft - effectWidth / 2;

      return {
        x: effectCenterXLeft,
        y: normalSubtitle.position.y, // 同一行，Y坐标相同
        alignment: 'center'
      };
    }

    return {
      x: effectCenterX,
      y: normalSubtitle.position.y, // 同一行，Y坐标相同
      alignment: 'center'
    };
  }

  /**
   * 计算垂直排列的位置（特效在上方）
   */
  calculateVerticalPosition(
    normalSubtitle: ArrangedSubtitle,
    effectSubtitle: ArrangedSubtitle
  ): Position {
    // 特效字幕显示在普通字幕上方
    const effectHeight = this.calculateSubtitleHeight(
      effectSubtitle.style.fontSize
    );
    const verticalGap = effectSubtitle.style.fontSize * 0.5; // 垂直间距

    const effectY = normalSubtitle.position.y - effectHeight - verticalGap;

    // 确保不超出屏幕顶部
    const minY = this.verticalMargin + effectHeight / 2;
    const finalY = Math.max(minY, effectY);

    return {
      x: this.screenWidth / 2, // 居中
      y: finalY,
      alignment: 'center'
    };
  }

  /**
   * 计算单独放置的位置（屏幕其他位置）
   * 🔧 修改为基于普通字幕位置，优先选择离普通字幕最近的位置
   * 优先选择：普通字幕上方 > 右侧 > 左侧 > 上方中央
   */
  calculateSeparatePosition(
    normalSubtitle: ArrangedSubtitle,
    effectSubtitle: ArrangedSubtitle,
    occupiedPositions: Array<{ x: number; y: number; width: number; height: number }> = []
  ): Position {
    const effectWidth = this.calculateSubtitleWidth(
      effectSubtitle.text,
      effectSubtitle.style.fontSize
    );
    const effectHeight = this.calculateSubtitleHeight(
      effectSubtitle.style.fontSize
    );

    // 获取普通字幕的位置信息
    const normalY = normalSubtitle.position.y;
    const normalHeight = this.calculateSubtitleHeight(normalSubtitle.style.fontSize);
    const verticalGap = effectSubtitle.style.fontSize * 0.5;

    // 候选位置列表（按优先级排序）
    // 🔧 新策略：优先靠近普通字幕，而不是屏幕其他位置
    const candidates: Array<{ x: number; y: number; alignment: 'left' | 'center' | 'right' }> = [
      // 1. 普通字幕正上方（优先级最高）
      {
        x: this.screenWidth / 2,
        y: normalY - normalHeight / 2 - effectHeight - verticalGap,
        alignment: 'center'
      },
      // 2. 右侧区域（靠近普通字幕水平线，y=normalY）
      {
        x: this.screenWidth - this.horizontalMargin - effectWidth / 2,
        y: normalY,
        alignment: 'right'
      },
      // 3. 左侧区域（靠近普通字幕水平线，y=normalY）
      {
        x: this.horizontalMargin + effectWidth / 2,
        y: normalY,
        alignment: 'left'
      },
      // 4. 上方偏左（离普通字幕中等距离）
      {
        x: this.screenWidth / 3,
        y: normalY - 150,
        alignment: 'center'
      },
      // 5. 上方偏右（离普通字幕中等距离）
      {
        x: this.screenWidth * 2 / 3,
        y: normalY - 150,
        alignment: 'center'
      }
    ];

    // 检查每个候选位置是否与已占用位置重叠
    for (const candidate of candidates) {
      const hasCollision = occupiedPositions.some(occupied => {
        const candidateLeft = candidate.x - effectWidth / 2;
        const candidateRight = candidate.x + effectWidth / 2;
        const candidateTop = candidate.y - effectHeight / 2;
        const candidateBottom = candidate.y + effectHeight / 2;

        const occupiedLeft = occupied.x - occupied.width / 2;
        const occupiedRight = occupied.x + occupied.width / 2;
        const occupiedTop = occupied.y - occupied.height / 2;
        const occupiedBottom = occupied.y + occupied.height / 2;

        // 检查是否重叠
        return !(
          candidateRight < occupiedLeft ||
          candidateLeft > occupiedRight ||
          candidateBottom < occupiedTop ||
          candidateTop > occupiedBottom
        );
      });

      if (!hasCollision) {
        return candidate;
      }
    }

    // 如果所有候选位置都重叠，使用第一个（右侧）
    return candidates[0];
  }

  /**
   * 智能计算特效字幕的最优位置
   * @param normalSubtitle 普通字幕
   * @param effectSubtitle 特效字幕
   * @param occupiedPositions 已占用的位置（用于碰撞检测）
   * @returns 布局结果
   */
  calculateOptimalPosition(
    normalSubtitle: ArrangedSubtitle,
    effectSubtitle: ArrangedSubtitle,
    occupiedPositions: Array<{ x: number; y: number; width: number; height: number }> = []
  ): LayoutResult {
    // 规则1：如果动画时长过长，单独放置
    if (this.isLongAnimation(effectSubtitle)) {
      // 🔧 更新：传入normalSubtitle，使特效靠近普通字幕
      const position = this.calculateSeparatePosition(normalSubtitle, effectSubtitle, occupiedPositions);
      return {
        position,
        strategy: 'separate',
        reason: `动画时长过长（${(effectSubtitle.end - effectSubtitle.start).toFixed(2)}秒），单独放置`
      };
    }

    // 规则2：判断是否可以水平排列
    if (this.canPlaceHorizontally(normalSubtitle, effectSubtitle)) {
      const position = this.calculateHorizontalPosition(normalSubtitle, effectSubtitle);

      // 检查水平排列是否会与已占用位置重叠
      const effectWidth = this.calculateSubtitleWidth(
        effectSubtitle.text,
        effectSubtitle.style.fontSize
      );
      const effectHeight = this.calculateSubtitleHeight(
        effectSubtitle.style.fontSize
      );

      const hasCollision = occupiedPositions.some(occupied => {
        const effectLeft = position.x - effectWidth / 2;
        const effectRight = position.x + effectWidth / 2;
        const effectTop = position.y - effectHeight / 2;
        const effectBottom = position.y + effectHeight / 2;

        const occupiedLeft = occupied.x - occupied.width / 2;
        const occupiedRight = occupied.x + occupied.width / 2;
        const occupiedTop = occupied.y - occupied.height / 2;
        const occupiedBottom = occupied.y + occupied.height / 2;

        return !(
          effectRight < occupiedLeft ||
          effectLeft > occupiedRight ||
          effectBottom < occupiedTop ||
          effectTop > occupiedBottom
        );
      });

      if (!hasCollision) {
        return {
          position,
          strategy: 'horizontal',
          reason: '空间足够，水平排列（特效在普通字幕右侧）'
        };
      }
    }

    // 规则3：垂直排列（特效在上方）
    const verticalPosition = this.calculateVerticalPosition(normalSubtitle, effectSubtitle);

    // 检查垂直排列是否会与已占用位置重叠
    const effectWidth = this.calculateSubtitleWidth(
      effectSubtitle.text,
      effectSubtitle.style.fontSize
    );
    const effectHeight = this.calculateSubtitleHeight(
      effectSubtitle.style.fontSize
    );

    const hasVerticalCollision = occupiedPositions.some(occupied => {
      const effectLeft = verticalPosition.x - effectWidth / 2;
      const effectRight = verticalPosition.x + effectWidth / 2;
      const effectTop = verticalPosition.y - effectHeight / 2;
      const effectBottom = verticalPosition.y + effectHeight / 2;

      const occupiedLeft = occupied.x - occupied.width / 2;
      const occupiedRight = occupied.x + occupied.width / 2;
      const occupiedTop = occupied.y - occupied.height / 2;
      const occupiedBottom = occupied.y + occupied.height / 2;

      return !(
        effectRight < occupiedLeft ||
        effectLeft > occupiedRight ||
        effectBottom < occupiedTop ||
        effectTop > occupiedBottom
      );
    });

    if (!hasVerticalCollision) {
      return {
        position: verticalPosition,
        strategy: 'vertical',
        reason: '水平空间不足，垂直排列（特效在普通字幕上方）'
      };
    }

    // 规则4：如果垂直排列也重叠，单独放置
    // 🔧 更新：传入normalSubtitle，使特效靠近普通字幕
    const separatePosition = this.calculateSeparatePosition(normalSubtitle, effectSubtitle, occupiedPositions);
    return {
      position: separatePosition,
      strategy: 'separate',
      reason: '垂直排列也会重叠，单独放置到屏幕其他位置'
    };
  }

  /**
   * 批量处理字幕布局
   * 【完整模式】对特效字幕进行智能布局，避免重叠
   */
  arrangeSubtitlesByTime(
    subtitles: ArrangedSubtitle[]
  ): ArrangedSubtitle[] {
    console.log('[SmartLayoutManager] 完整模式：开始智能布局，字幕数量:', subtitles.length);

    // 统计字幕类型
    const normalCount = subtitles.filter(s => s.type === 'normal').length;
    const effectCount = subtitles.filter(s => s.type === 'effect_complex').length;
    const simpleEffectCount = subtitles.filter(s => s.type === 'effect_simple').length;

    console.log('[SmartLayoutManager] 字幕统计:', {
      total: subtitles.length,
      normal: normalCount,
      effect_complex: effectCount,
      effect_simple: simpleEffectCount
    });

    // 按时间排序
    const sorted = [...subtitles].sort((a, b) => a.start - b.start);

    // 已占用的位置列表（用于碰撞检测）
    const occupiedPositions: Array<{ x: number; y: number; width: number; height: number; end: number }> = [];

    // 处理后的字幕列表
    const result: ArrangedSubtitle[] = [];

    for (const subtitle of sorted) {
      // 清理已过期的占用位置
      const currentTime = subtitle.start;
      const activePositions = occupiedPositions.filter(pos => pos.end > currentTime);
      occupiedPositions.length = 0;
      occupiedPositions.push(...activePositions);

      if (subtitle.type === 'normal') {
        // 普通字幕：保持原位置
        result.push(subtitle);

        // 记录占用位置
        const width = this.calculateSubtitleWidth(subtitle.text, subtitle.style.fontSize);
        const height = this.calculateSubtitleHeight(subtitle.style.fontSize);
        occupiedPositions.push({
          x: subtitle.position.x,
          y: subtitle.position.y,
          width,
          height,
          end: subtitle.end
        });
      } else if (subtitle.type === 'effect_complex' || subtitle.type === 'effect_simple') {
        // 特效字幕：智能计算位置
        const effectWidth = this.calculateSubtitleWidth(subtitle.text, subtitle.style.fontSize);
        const effectHeight = this.calculateSubtitleHeight(subtitle.style.fontSize);

        // 找到同时间段的普通字幕
        const overlappingNormal = result.find(s =>
          s.type === 'normal' &&
          s.start <= subtitle.end &&
          s.end >= subtitle.start
        );

        let newPosition = subtitle.position;
        let strategy = 'original';

        if (overlappingNormal) {
          // 有重叠的普通字幕，计算最优位置
          const layoutResult = this.calculateOptimalPosition(
            overlappingNormal,
            subtitle,
            activePositions.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height }))
          );
          newPosition = layoutResult.position;
          strategy = layoutResult.strategy;

          console.log(`[SmartLayoutManager] 特效字幕 "${subtitle.text}" 布局:`, {
            strategy,
            reason: layoutResult.reason,
            position: newPosition
          });
        } else {
          // 没有重叠的普通字幕，检查是否与其他特效字幕重叠
          const hasCollision = activePositions.some(occupied => {
            const effectLeft = subtitle.position.x - effectWidth / 2;
            const effectRight = subtitle.position.x + effectWidth / 2;
            const effectTop = subtitle.position.y - effectHeight / 2;
            const effectBottom = subtitle.position.y + effectHeight / 2;

            const occupiedLeft = occupied.x - occupied.width / 2;
            const occupiedRight = occupied.x + occupied.width / 2;
            const occupiedTop = occupied.y - occupied.height / 2;
            const occupiedBottom = occupied.y + occupied.height / 2;

            return !(
              effectRight < occupiedLeft ||
              effectLeft > occupiedRight ||
              effectBottom < occupiedTop ||
              effectTop > occupiedBottom
            );
          });

          if (hasCollision) {
            // 重新计算位置
            // 🔧 修复：当没有overlappingNormal时，创建虚拟普通字幕以供单独放置使用
            // 使用当前特效字幕下方作为虚拟普通字幕位置
            const virtualNormalSubtitle: ArrangedSubtitle = {
              ...subtitle,
              position: {
                x: this.screenWidth / 2,
                y: this.screenHeight * 0.9, // 屏幕底部
                alignment: 'center'
              }
            };

            newPosition = this.calculateSeparatePosition(
              virtualNormalSubtitle,
              subtitle,
              activePositions.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height }))
            );
            strategy = 'separate';

            console.log(`[SmartLayoutManager] 特效字幕 "${subtitle.text}" 避免重叠:`, {
              strategy,
              newPosition
            });
          }
        }

        // 创建新的字幕对象，更新位置
        const updatedSubtitle: ArrangedSubtitle = {
          ...subtitle,
          position: newPosition
        };

        result.push(updatedSubtitle);

        // 记录占用位置
        occupiedPositions.push({
          x: newPosition.x,
          y: newPosition.y,
          width: effectWidth,
          height: effectHeight,
          end: subtitle.end
        });
      } else {
        // 其他类型：直接保留
        result.push(subtitle);
      }
    }

    console.log('[SmartLayoutManager] 布局完成，结果数量:', result.length);

    return result;
  }

  /**
 * 处理特效字幕的碰撞和分散布局
 * 🔧 新策略:
 * 1. 同时显示的字幕从左到右线性排列
 * 2. 不同时显示的字幕左右交替分布
 * @param subtitles 所有字幕
 * @param config 配置参数
 * @returns 调整后的字幕列表
 */
  resolveEffectSubtitleCollisions(
    subtitles: ArrangedSubtitle[],
    config: any  // 完整的 ZimuConfig
  ): ArrangedSubtitle[] {
    console.log('[SmartLayoutManager] 🆕 新策略: 按KeywordGroup分组，同组内智能避让');

    // 筛选特效字幕
    const effectSubtitles = subtitles.filter(s =>
      s.type === 'effect_complex' || s.type === 'effect_simple'
    );

    if (effectSubtitles.length === 0) {
      console.log('[SmartLayoutManager] 💡 没有特效字幕，直接返回');
      return subtitles;
    }

    // 🆕 按 KeywordGroup 分组（而不是按时间分组）
    const normalSubtitles = subtitles.filter(s => s.type === 'normal');
    const groupedByKeyword = new Map<string, ArrangedSubtitle[]>();

    effectSubtitles.forEach(sub => {
      const groupName = (sub as any).keywordGroup || 'default';
      if (!groupedByKeyword.has(groupName)) {
        groupedByKeyword.set(groupName, []);
      }
      groupedByKeyword.get(groupName)!.push(sub);
    });

    console.log('[SmartLayoutManager] 按KeywordGroup分组数量:', groupedByKeyword.size);

    const safeDistance = config.avoidanceConfig?.safeDistance || 20;

    // 🆕 处理每个 KeywordGroup
    for (const [groupName, groupSubtitles] of groupedByKeyword) {
      if (groupSubtitles.length === 0) continue;

      // 按时间排序
      const sorted = [...groupSubtitles].sort((a, b) => a.start - b.start);

      console.log(`[SmartLayoutManager] 🔍 处理Group "${groupName}", 字幕数: ${sorted.length}`);
      console.log(`[SmartLayoutManager] 📋 组内字幕详情:`, sorted.map(s => ({
        text: s.text.substring(0, 10),
        start: s.start.toFixed(2),
        end: s.end.toFixed(2),
        effectiveEnd: s.effectiveEnd?.toFixed(2) || 'N/A',
        x: s.position.x.toFixed(0),
        y: s.position.y.toFixed(0)
      })));

      // 🆕 处理每个字幕
      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];

        if (i === 0) {
          // 第一个字幕，使用配置的坐标（已在 createAnimatedEffectSubtitle 中设置）
          // 确保位置有效
          this.ensureInBounds(current, config);
          console.log(`[SmartLayoutManager] ✅ 首个字幕 "${current.text}" 保持原位置: (${current.position.x.toFixed(0)}, ${current.position.y.toFixed(0)})`);
        } else {
          // 检测与前一个字幕的时间重叠
          const previous = sorted[i - 1];

          // 🔍 调试：输出时间重叠检测详情
          const prevEnd = previous.effectiveEnd ?? previous.end;
          const currEnd = current.effectiveEnd ?? current.end;
          const isOverlap = previous.start < currEnd && current.start < prevEnd;

          console.log(`[SmartLayoutManager] 🕐 时间重叠检测:`, {
            prev: `"${previous.text.substring(0, 8)}" [${previous.start.toFixed(2)}-${prevEnd.toFixed(2)}]`,
            curr: `"${current.text.substring(0, 8)}" [${current.start.toFixed(2)}-${currEnd.toFixed(2)}]`,
            '条件1(prev.start < curr.end)': `${previous.start.toFixed(2)} < ${currEnd.toFixed(2)} = ${previous.start < currEnd}`,
            '条件2(curr.start < prev.end)': `${current.start.toFixed(2)} < ${prevEnd.toFixed(2)} = ${current.start < prevEnd}`,
            '结果': isOverlap ? '⚠️ 重叠!' : '✅ 无重叠'
          });

          if (this.isTimeOverlap(previous, current)) {
            // 有时间重叠，执行避让
            console.log(`[SmartLayoutManager] 🚨 Group "${groupName}" 检测到时间重叠，执行避让!`);
            console.log(`[SmartLayoutManager] 避让配置:`, {
              safeDistance,
              preferDirection: config.avoidanceConfig?.preferDirection || 'right',
              videoWidth: config.videoWidth
            });

            const avoidancePos = this.calculateAvoidancePosition(current, previous, config, safeDistance);
            console.log(`[SmartLayoutManager] 📍 避让结果: "${current.text}" 从 (${current.position.x.toFixed(0)}, ${current.position.y.toFixed(0)}) 移动到 (${avoidancePos.x.toFixed(0)}, ${avoidancePos.y.toFixed(0)})`);

            current.position.x = avoidancePos.x;
            current.position.y = avoidancePos.y;
          } else {
            // 无时间重叠，保持配置的位置
            console.log(`[SmartLayoutManager] ✅ Group "${groupName}" 无时间重叠: "${current.text}" 保持原位置`);
            this.ensureInBounds(current, config);
          }
        }
      }
    }

    // 返回普通字幕 + 调整后的特效字幕
    console.log('[SmartLayoutManager] 🎉 布局完成');
    return subtitles;
  }

  /**
   * 按时间重叠分组
   * @param subtitles 特效字幕列表
   * @returns 分组后的字幕列表
   */
  private groupByTimeOverlap(subtitles: ArrangedSubtitle[]): ArrangedSubtitle[][] {
    if (subtitles.length === 0) return [];

    // 🔧 添加时间容限：如果两个字幕相隔太近，也应该被分组到一起排列
    // 这样可以避免多个字幕因为极小的时间差而都被单独放在中心
    const timeBuffer = 5.0; // 5秒时间容限：如果间隔 < 5秒就应该分组到一起排列
    // 这样可以捕捉快速连续的特效字幕（比如"火星移民、SpaceX、IPO"）

    const sorted = [...subtitles].sort((a, b) => a.start - b.start);
    const groups: ArrangedSubtitle[][] = [];
    let currentGroup: ArrangedSubtitle[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const subtitle = sorted[i];

      // 🔧 关键改进：根据动画时长来判断是否需要分组
      // 计算每个字幕的"有效占用时间" = start + 动画时长（如果有）
      // 注意：start/end 都是毫秒单位，animationDuration 也是毫秒
      const getEffectiveEnd = (s: ArrangedSubtitle): number => {
        const animationDuration = s.animationConfig?.duration || s.animationConfig?.parameters?.duration || 0; // 保持毫秒单位
        return Math.max(s.end, s.start + animationDuration); // 取字幕结束或动画结束的较大值
      };

      // 获取当前分组中所有字幕的有效占用时间范围
      const groupStart = currentGroup[0].start;
      const groupEffectiveEnd = Math.max(...currentGroup.map(getEffectiveEnd));

      // 检查新字幕是否与分组有冲突（考虑动画时长）
      const newSubtitleEffectiveEnd = getEffectiveEnd(subtitle);
      const hasOverlap = subtitle.start < groupEffectiveEnd && newSubtitleEffectiveEnd > groupStart;

      // 如果有重叠（包括动画时间的重叠），就分组
      if (hasOverlap) {
        currentGroup.push(subtitle);
      } else {
        // 开始新的分组
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [subtitle];
      }
    }

    // 加入最后一个分组
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // 🔧 诊断：输出分组详情，包括动画时长
    const getEffectiveEnd = (s: ArrangedSubtitle): number => {
      const animationDuration = (s.animationConfig?.duration || s.animationConfig?.parameters?.duration || 0) / 1000;
      return Math.max(s.end, s.start + animationDuration);
    };

    console.log('[SmartLayoutManager.groupByTimeOverlap] 分组结果 (考虑动画时长):', {
      totalSubtitles: subtitles.length,
      groupCount: groups.length,
      groups: groups.map((group, idx) => ({
        groupIndex: idx,
        count: group.length,
        texts: group.map(s => s.text.substring(0, 15)).join(' | '),
        timeRange: `${group[0].start.toFixed(2)}-${Math.max(...group.map(s => s.end)).toFixed(2)}`,
        effectiveRange: `${group[0].start.toFixed(2)}-${Math.max(...group.map(getEffectiveEnd)).toFixed(2)}`,
        details: group.map(s => ({
          text: s.text.substring(0, 15),
          start: s.start.toFixed(2),
          animationMs: (s.animationConfig?.duration || s.animationConfig?.parameters?.duration || 0),
          effectiveEnd: getEffectiveEnd(s).toFixed(2)
        }))
      }))
    });

    return groups;
  }

  /**
   * 判断两个字幕是否在时间上重叠
   * 考虑effectiveEnd（包括动画时长的实际结束时间）
   * @private
   */
  private isTimeOverlap(sub1: ArrangedSubtitle, sub2: ArrangedSubtitle): boolean {
    // 获取实际结束时间（考虑effectiveEnd）
    const sub1End = sub1.effectiveEnd ?? sub1.end;
    const sub2End = sub2.effectiveEnd ?? sub2.end;

    // 判断两个时间段是否重叠
    // 🔧 修复：使用 <= 代替 <，这样边界相等时也算重叠
    // 例如：字幕A结束于5.0秒，字幕B开始于5.0秒 → 应该避让
    return sub1.start <= sub2End && sub2.start <= sub1End;
  }

  /**
   * 计算避让位置
   * 当字幕发生碰撞时，根据配置的优先方向和可用空间选择新位置
   * @private
   */
  private calculateAvoidancePosition(
    current: ArrangedSubtitle,
    previous: ArrangedSubtitle,
    config: any,
    safeDistance: number
  ): Position {
    const baseX = current.position.x;
    const baseY = current.position.y;

    // 获取当前字幕的尺寸（如果没有计算过，使用默认值）
    const currentWidth = current.width || 100;
    const currentHeight = current.height || 50;

    const previousWidth = previous.width || 100;
    const previousHeight = previous.height || 50;

    // 获取优先避让方向
    const preferDirection = config.avoidanceConfig?.preferDirection || 'right';

    // 检查右侧是否有足够空间
    const rightRequiredX = previous.position.x + previousWidth + safeDistance;
    const rightAvailable = rightRequiredX + currentWidth < config.videoWidth;

    // 检查上方是否有足够空间
    const topRequiredY = previous.position.y - previousHeight - safeDistance;
    const topAvailable = topRequiredY > safeDistance;

    let newX = baseX;
    let newY = baseY;

    if (preferDirection === 'right') {
      // 优先往右避让
      if (rightAvailable) {
        newX = rightRequiredX;
        console.log(`[SmartLayoutManager] 往右避让: "${current.text}" -> x=${newX.toFixed(0)}`);
      } else if (topAvailable) {
        // 右侧不足，尝试上方
        newY = topRequiredY;
        console.log(`[SmartLayoutManager] 右侧不足，往上避让: "${current.text}" -> y=${newY.toFixed(0)}`);
      } else {
        // 两个方向都不行，往下避让
        newY = previous.position.y + previousHeight + safeDistance;
        console.log(`[SmartLayoutManager] 上右都不足，往下避让: "${current.text}" -> y=${newY.toFixed(0)}`);
      }
    } else {
      // 优先往上避让 (preferDirection === 'top')
      if (topAvailable) {
        newY = topRequiredY;
        console.log(`[SmartLayoutManager] 往上避让: "${current.text}" -> y=${newY.toFixed(0)}`);
      } else if (rightAvailable) {
        // 上方不足，尝试右侧
        newX = rightRequiredX;
        console.log(`[SmartLayoutManager] 上方不足，往右避让: "${current.text}" -> x=${newX.toFixed(0)}`);
      } else {
        // 两个方向都不行，往下避让
        newY = previous.position.y + previousHeight + safeDistance;
        console.log(`[SmartLayoutManager] 上右都不足，往下避让: "${current.text}" -> y=${newY.toFixed(0)}`);
      }
    }

    return {
      x: newX,
      y: newY,
      alignment: current.position.alignment || 'center'
    };
  }

  /**
   * 确保字幕在屏幕范围内
   * @private
   */
  private ensureInBounds(subtitle: ArrangedSubtitle, config: any): void {
    const width = subtitle.width || 100;
    const height = subtitle.height || 50;

    // 获取安全边界
    const minX = width / 2;
    const maxX = config.videoWidth - width / 2;
    const minY = height / 2;
    const maxY = config.videoHeight - height / 2;

    // 调整X坐标
    if (subtitle.position.x < minX) {
      console.warn(`[SmartLayoutManager] 字幕 "${subtitle.text}" X坐标超出左边界，修正: ${subtitle.position.x.toFixed(0)} -> ${minX.toFixed(0)}`);
      subtitle.position.x = minX;
    } else if (subtitle.position.x > maxX) {
      console.warn(`[SmartLayoutManager] 字幕 "${subtitle.text}" X坐标超出右边界，修正: ${subtitle.position.x.toFixed(0)} -> ${maxX.toFixed(0)}`);
      subtitle.position.x = maxX;
    }

    // 调整Y坐标
    if (subtitle.position.y < minY) {
      console.warn(`[SmartLayoutManager] 字幕 "${subtitle.text}" Y坐标超出顶部边界，修正: ${subtitle.position.y.toFixed(0)} -> ${minY.toFixed(0)}`);
      subtitle.position.y = minY;
    } else if (subtitle.position.y > maxY) {
      console.warn(`[SmartLayoutManager] 字幕 "${subtitle.text}" Y坐标超出底部边界，修正: ${subtitle.position.y.toFixed(0)} -> ${maxY.toFixed(0)}`);
      subtitle.position.y = maxY;
    }
  }

}

