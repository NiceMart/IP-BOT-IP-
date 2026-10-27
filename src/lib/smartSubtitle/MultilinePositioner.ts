/**
 * 多行字幕位置管理器 - MultilinePositioner
 * 负责计算普通字幕和动态字幕的位置，处理位置冲突
 */

/**
 * 字幕位置信息
 */
export interface SubtitlePosition {
  x: number;        // 水平位置
  y: number;        // 垂直位置（距离顶部）
  width: number;    // 宽度
  height: number;   // 高度
}

/**
 * 位置冲突检测结果
 */
export interface PositionConflict {
  hasConflict: boolean;
  overlapArea?: number;
  overlapPercentage?: number;
}

/**
 * 位置调整方案
 */
export interface PositionAdjustment {
  action: 'stay' | 'moveUp' | 'moveDown' | 'nextFrame' | 'compress';
  newPosition?: SubtitlePosition;
  delay?: number;
  reason: string;
}

/**
 * 多行字幕位置管理器
 */
export class MultilinePositioner {
  private screenWidth: number;
  private screenHeight: number;
  private safeMarginTop: number;
  private safeMarginBottom: number;

  constructor(screenWidth: number, screenHeight: number, safeMarginTop = 15, safeMarginBottom = 15) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.safeMarginTop = (screenHeight * safeMarginTop) / 100;
    this.safeMarginBottom = (screenHeight * safeMarginBottom) / 100;
  }

  /**
   * 检测两个字幕是否有垂直重叠
   */
  detectConflict(normalPos: SubtitlePosition, effectPos: SubtitlePosition): PositionConflict {
    // 检查垂直方向是否重叠
    const normalBottom = normalPos.y + normalPos.height;
    const effectBottom = effectPos.y + effectPos.height;

    const overlapTop = Math.max(normalPos.y, effectPos.y);
    const overlapBottom = Math.min(normalBottom, effectBottom);

    if (overlapTop < overlapBottom) {
      // 有重叠
      const overlapArea = overlapBottom - overlapTop;
      const normalArea = normalPos.height;
      const overlapPercentage = (overlapArea / normalArea) * 100;

      return {
        hasConflict: true,
        overlapArea,
        overlapPercentage
      };
    }

    return {
      hasConflict: false
    };
  }

  /**
   * 计算最优的位置调整方案
   */
  calculateAdjustment(
    normalPos: SubtitlePosition,
    effectPos: SubtitlePosition,
    availableFrames: number = 2
  ): PositionAdjustment {
    // 首先检测是否有冲突
    const conflict = this.detectConflict(normalPos, effectPos);

    if (!conflict.hasConflict) {
      return {
        action: 'stay',
        newPosition: effectPos,
        reason: '无位置冲突，保持当前位置'
      };
    }

    // 冲突严重程度判断
    const isSevereConflict = (conflict.overlapPercentage || 0) > 50;

    if (!isSevereConflict) {
      // 轻微重叠，尝试向上移动动态字幕
      return this.tryMoveUpEffect(normalPos, effectPos);
    }

    // 严重冲突，尝试向上移动
    const moveUpResult = this.tryMoveUpEffect(normalPos, effectPos);
    if (moveUpResult.action !== 'moveUp') {
      // 如果无法向上移动，尝试延迟到下一帧
      return {
        action: 'nextFrame',
        delay: 100,
        reason: '位置冲突严重，将字幕延迟到下一帧显示'
      };
    }

    return moveUpResult;
  }

  /**
   * 尝试将动态字幕向上移动以避免冲突
   */
  private tryMoveUpEffect(normalPos: SubtitlePosition, effectPos: SubtitlePosition): PositionAdjustment {
    const minSafeDistance = 10; // 最小安全距离（像素）
    const targetY = normalPos.y - effectPos.height - minSafeDistance;

    // 检查是否超出安全区域
    if (targetY < this.safeMarginTop) {
      return {
        action: 'nextFrame',
        delay: 100,
        reason: '无法向上移动：会超出屏幕上方安全区域'
      };
    }

    const newPosition: SubtitlePosition = {
      x: effectPos.x,
      y: targetY,
      width: effectPos.width,
      height: effectPos.height
    };

    // 验证新位置是否解决了冲突
    const newConflict = this.detectConflict(normalPos, newPosition);
    if (!newConflict.hasConflict) {
      return {
        action: 'moveUp',
        newPosition,
        reason: `动态字幕已向上移动 ${effectPos.y - targetY}px，冲突已解决`
      };
    }

    // 冲突未能完全解决
    return {
      action: 'nextFrame',
      delay: 100,
      reason: '向上移动后仍有冲突，将字幕延迟到下一帧'
    };
  }

  /**
   * 计算字幕应该显示在第几行
   */
  calculateLineNumber(subtitleCount: number, currentSubtitleIndex: number): number {
    // 如果只有一行字幕，显示在底部
    if (subtitleCount === 1) {
      return 1;
    }

    // 如果有多行字幕，检查是否超过2行限制
    if (subtitleCount > 2) {
      // 超过2行限制，需要使用分批显示
      // 第一个字幕在底部，其他字幕在下一帧
      return currentSubtitleIndex === 0 ? 1 : 0; // 0表示下一帧
    }

    // 2行或更少：从底部向上排列
    return subtitleCount - currentSubtitleIndex;
  }

  /**
   * 获取字幕应该显示的Y坐标
   */
  getSubtitleYPosition(lineNumber: number, subtitleHeight: number): number {
    if (lineNumber === 0) {
      return -1; // 特殊值表示下一帧
    }

    // 从底部开始计算
    const bottomPadding = this.safeMarginBottom;
    const baseLine = this.screenHeight - bottomPadding;

    // 使用相对行间距（字幕高度的20%），最小10px，最大30px
    const lineSpacing = Math.max(10, Math.min(30, subtitleHeight * 0.2));

    // 每行从下到上排列
    return baseLine - lineNumber * (subtitleHeight + lineSpacing);
  }

  /**
   * 验证位置是否在屏幕范围内
   */
  isPositionValid(pos: SubtitlePosition): boolean {
    return (
      pos.x >= 0 &&
      pos.x + pos.width <= this.screenWidth &&
      pos.y >= this.safeMarginTop &&
      pos.y + pos.height <= this.screenHeight - this.safeMarginBottom
    );
  }

  /**
   * 计算两个字幕之间的间距
   */
  calculateGap(pos1: SubtitlePosition, pos2: SubtitlePosition): number {
    if (pos1.y + pos1.height <= pos2.y) {
      // pos1在pos2上方
      return pos2.y - (pos1.y + pos1.height);
    } else if (pos2.y + pos2.height <= pos1.y) {
      // pos2在pos1上方
      return pos1.y - (pos2.y + pos2.height);
    }

    // 有重叠
    return 0;
  }

  /**
   * 计算多个字幕的最优排列
   */
  calculateOptimalLayout(
    subtitles: Array<{ height: number; content: string }>,
    preferredLineCount: number = 2
  ): Array<{ lineNumber: number; y: number }> {
    const result: Array<{ lineNumber: number; y: number }> = [];
    const availableHeight = this.screenHeight - this.safeMarginTop - this.safeMarginBottom;

    // 使用动态行间距而不是固定的10px
    const calculateSpacing = (height: number) => Math.max(10, Math.min(30, height * 0.2));

    // 计算所需的总高度
    const totalHeight = subtitles.reduce((sum, s) => sum + s.height + calculateSpacing(s.height), 0);

    // 如果能在指定行数内显示
    if (totalHeight <= availableHeight && subtitles.length <= preferredLineCount) {
      // 正常排列
      let currentY = this.screenHeight - this.safeMarginBottom - subtitles[0].height;

      for (const subtitle of subtitles) {
        result.push({
          lineNumber: result.length + 1,
          y: currentY
        });
        currentY -= subtitle.height + calculateSpacing(subtitle.height);
      }
    } else {
      // 需要分批显示或压缩
      let lineNumber = 0;
      for (const subtitle of subtitles) {
        if (lineNumber >= preferredLineCount) {
          // 超过行数限制，标记为下一帧
          result.push({
            lineNumber: 0,
            y: -1
          });
        } else {
          result.push({
            lineNumber: lineNumber + 1,
            y: this.getSubtitleYPosition(lineNumber + 1, subtitle.height)
          });
          lineNumber++;
        }
      }
    }

    return result;
  }

  /**
   * 计算多个字幕从左到右的水平布局（用于特效字幕）
   * 当多个特效字幕同时出现时，从左到右排列它们
   */
  calculateHorizontalLayout(
    subtitles: Array<{ width: number; height: number; content: string }>,
    centerY: number,
    spacing: number = 20,
    maxWidth?: number
  ): Array<{ x: number; y: number; width: number; height: number; exceeds: boolean }> {
    const result: Array<{ x: number; y: number; width: number; height: number; exceeds: boolean }> = [];

    // 如果没有指定最大宽度，使用屏幕宽度
    if (!maxWidth) {
      maxWidth = this.screenWidth;
    }

    const safeMarginLeft = (this.screenWidth * 10) / 100;  // 左边距
    const safeMarginRight = (this.screenWidth * 10) / 100; // 右边距
    const availableWidth = maxWidth - safeMarginLeft - safeMarginRight;

    // 计算所需的总宽度
    const totalWidth = subtitles.reduce((sum, s) => sum + s.width + spacing, 0) - spacing;

    // 如果能在一行内显示，直接排列
    if (totalWidth <= availableWidth) {
      // 居中对齐
      const leftPadding = safeMarginLeft + (availableWidth - totalWidth) / 2;
      let currentX = leftPadding;

      for (const subtitle of subtitles) {
        result.push({
          x: currentX,
          y: centerY - subtitle.height / 2,
          width: subtitle.width,
          height: subtitle.height,
          exceeds: false
        });
        currentX += subtitle.width + spacing;
      }
    } else {
      // 无法在一行内显示，需要缩小字幕或分行
      console.warn(
        `[MultilinePositioner] 特效字幕总宽度 ${totalWidth.toFixed(0)}px 超出可用宽度 ${availableWidth.toFixed(0)}px, ` +
        `进行压缩处理`
      );

      // 计算缩放因子
      const scaleFactor = availableWidth / totalWidth;
      let currentX = safeMarginLeft;

      for (const subtitle of subtitles) {
        const scaledWidth = subtitle.width * scaleFactor;
        const scaledHeight = subtitle.height * scaleFactor;

        result.push({
          x: currentX,
          y: centerY - scaledHeight / 2,
          width: scaledWidth,
          height: scaledHeight,
          exceeds: true
        });
        currentX += scaledWidth + spacing * scaleFactor;
      }
    }

    return result;
  }

  /**
   * 检测多个字幕是否有水平重叠
   */
  detectHorizontalConflict(positions: SubtitlePosition[]): boolean {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];

        // 检查水平方向是否重叠
        const rightEdge1 = pos1.x + pos1.width;
        const rightEdge2 = pos2.x + pos2.width;

        const overlapLeft = Math.max(pos1.x, pos2.x);
        const overlapRight = Math.min(rightEdge1, rightEdge2);

        if (overlapLeft < overlapRight) {
          // 有水平重叠
          console.warn(
            `[MultilinePositioner] 检测到水平重叠: ` +
            `字幕1 [${pos1.x.toFixed(0)}, ${rightEdge1.toFixed(0)}], ` +
            `字幕2 [${pos2.x.toFixed(0)}, ${rightEdge2.toFixed(0)}]`
          );
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * 导出单例实例
 */
export const multilinePositioner = new MultilinePositioner(1920, 1080);
