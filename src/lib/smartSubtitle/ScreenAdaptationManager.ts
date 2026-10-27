/**
 * 屏幕适配管理器 - ScreenAdaptationManager
 * 识别屏幕尺寸和比例，生成自适应的配置参数
 */

import {
  ScreenConfig,
  ScreenProfile,
  ScreenAdaptationOptions,
  SafeMargin
} from '../../types/smartSubtitle';

/**
 * 屏幕适配管理器
 */
export class ScreenAdaptationManager {
  /**
   * 预定义的屏幕配置档案
   */
  private static readonly SCREEN_PROFILES: ScreenProfile[] = [
    {
      name: '16:9-1920x1080',
      description: 'Full HD (1920x1080)',
      aspectRatio: '16:9',
      config: {
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        fontSize: 48,
        maxCharsPerLine: 18,
        maxLines: 3,
        safeMargin: {
          top: 15,
          bottom: 15,
          left: 10,
          right: 10
        }
      }
    },
    {
      name: '21:9-3440x1440',
      description: 'Ultrawide (3440x1440)',
      aspectRatio: '21:9',
      config: {
        width: 3440,
        height: 1440,
        aspectRatio: '21:9',
        fontSize: 56,
        maxCharsPerLine: 28,
        maxLines: 2,
        safeMargin: {
          top: 12,
          bottom: 12,
          left: 8,
          right: 8
        }
      }
    },
    {
      name: '4:3-1024x768',
      description: 'Standard (1024x768)',
      aspectRatio: '4:3',
      config: {
        width: 1024,
        height: 768,
        aspectRatio: '4:3',
        fontSize: 32,
        maxCharsPerLine: 12,
        maxLines: 4,
        safeMargin: {
          top: 20,
          bottom: 20,
          left: 12,
          right: 12
        }
      }
    },
    {
      name: '16:10-1680x1050',
      description: 'WSXGA (1680x1050)',
      aspectRatio: '16:10',
      config: {
        width: 1680,
        height: 1050,
        aspectRatio: '16:10',
        fontSize: 44,
        maxCharsPerLine: 16,
        maxLines: 3,
        safeMargin: {
          top: 15,
          bottom: 15,
          left: 10,
          right: 10
        }
      }
    },
    {
      name: '3:2-1440x960',
      description: '3:2 aspect (1440x960)',
      aspectRatio: '3:2',
      config: {
        width: 1440,
        height: 960,
        aspectRatio: '3:2',
        fontSize: 42,
        maxCharsPerLine: 15,
        maxLines: 3,
        safeMargin: {
          top: 16,
          bottom: 16,
          left: 10,
          right: 10
        }
      }
    }
  ];

  /**
   * 获取屏幕配置
   */
  getScreenConfig(options: ScreenAdaptationOptions): ScreenConfig {
    // 1. 如果提供了自定义配置，先检查
    if (options.customConfig) {
      return this.mergeConfig(
        this.detectScreenProfile(options.screenWidth, options.screenHeight).config,
        options.customConfig
      );
    }

    // 2. 自动检测屏幕配置
    const detectedProfile = this.detectScreenProfile(options.screenWidth, options.screenHeight);
    return detectedProfile.config;
  }

  /**
   * 检测屏幕档案
   */
  private detectScreenProfile(width: number, height: number): ScreenProfile {
    const aspectRatio = this.calculateAspectRatio(width, height);

    // 精确匹配
    const exactMatch = ScreenAdaptationManager.SCREEN_PROFILES.find(
      p => p.config.width === width && p.config.height === height
    );

    if (exactMatch) {
      return exactMatch;
    }

    // 宽高比匹配
    const ratioMatch = ScreenAdaptationManager.SCREEN_PROFILES.find(
      p => this.isSimilarRatio(p.aspectRatio, aspectRatio)
    );

    if (ratioMatch) {
      return this.scaleProfileToSize(ratioMatch, width, height);
    }

    // 面积最接近
    const areaMatch = this.findClosestByArea(width, height);
    if (areaMatch) {
      return this.scaleProfileToSize(areaMatch, width, height);
    }

    // 默认配置
    return this.generateDefaultProfile(width, height);
  }

  /**
   * 计算宽高比
   */
  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const w = Math.round(width / divisor);
    const h = Math.round(height / divisor);
    return `${w}:${h}`;
  }

  /**
   * 判断宽高比是否相似
   */
  private isSimilarRatio(ratio1: string, ratio2: string): boolean {
    const [w1, h1] = ratio1.split(':').map(Number);
    const [w2, h2] = ratio2.split(':').map(Number);

    const r1 = w1 / h1;
    const r2 = w2 / h2;

    // 允许 5% 的误差
    return Math.abs(r1 - r2) / r1 < 0.05;
  }

  /**
   * 根据面积查找最接近的配置
   */
  private findClosestByArea(width: number, height: number): ScreenProfile | null {
    const targetArea = width * height;

    let closest = ScreenAdaptationManager.SCREEN_PROFILES[0];
    let minDifference = Math.abs(targetArea - (closest.config.width * closest.config.height));

    for (const profile of ScreenAdaptationManager.SCREEN_PROFILES) {
      const profileArea = profile.config.width * profile.config.height;
      const difference = Math.abs(targetArea - profileArea);

      if (difference < minDifference) {
        minDifference = difference;
        closest = profile;
      }
    }

    return closest;
  }

  /**
   * 缩放档案到指定尺寸
   */
  private scaleProfileToSize(profile: ScreenProfile, width: number, height: number): ScreenProfile {
    const scaleX = width / profile.config.width;
    const scaleY = height / profile.config.height;
    const scale = Math.min(scaleX, scaleY);

    return {
      ...profile,
      config: {
        ...profile.config,
        width,
        height,
        fontSize: Math.round(profile.config.fontSize * scale),
        maxCharsPerLine: Math.round(profile.config.maxCharsPerLine * scaleX)
      }
    };
  }

  /**
   * 生成默认配置
   */
  private generateDefaultProfile(width: number, height: number): ScreenProfile {
    // 计算基于屏幕大小的参数
    const aspectRatio = this.calculateAspectRatio(width, height);
    const screenArea = width * height;

    let fontSize = 32;
    let maxCharsPerLine = 10;
    let maxLines = 3;

    if (screenArea > 2000000) {
      // 大屏幕
      fontSize = 56;
      maxCharsPerLine = 25;
      maxLines = 2;
    } else if (screenArea > 1000000) {
      // 中等屏幕
      fontSize = 44;
      maxCharsPerLine = 16;
      maxLines = 3;
    } else {
      // 小屏幕
      fontSize = 32;
      maxCharsPerLine = 10;
      maxLines = 4;
    }

    // 计算安全边距
    const safeMargin = this.calculateSafeMargin(width, height);

    return {
      name: `custom-${width}x${height}`,
      description: `Custom screen (${width}x${height})`,
      aspectRatio,
      config: {
        width,
        height,
        aspectRatio,
        fontSize,
        maxCharsPerLine,
        maxLines,
        safeMargin
      }
    };
  }

  /**
   * 计算安全边距
   */
  private calculateSafeMargin(width: number, height: number): SafeMargin {
    // 小屏幕需要更大的边距
    const safeMarginPercent = Math.min(20, Math.max(8, 100 / (width / 100)));

    return {
      top: safeMarginPercent,
      bottom: safeMarginPercent,
      left: Math.max(8, safeMarginPercent * 0.8),
      right: Math.max(8, safeMarginPercent * 0.8)
    };
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    baseConfig: ScreenConfig,
    customConfig: Partial<ScreenConfig>
  ): ScreenConfig {
    return {
      ...baseConfig,
      ...customConfig,
      // 确保safeMargin完整合并
      safeMargin: {
        ...baseConfig.safeMargin,
        ...(customConfig.safeMargin || {})
      }
    };
  }

  /**
   * 获取所有预定义的屏幕配置
   */
  getAllProfiles(): ScreenProfile[] {
    return [...ScreenAdaptationManager.SCREEN_PROFILES];
  }

  /**
   * 按名称获取配置
   */
  getProfileByName(name: string): ScreenProfile | undefined {
    return ScreenAdaptationManager.SCREEN_PROFILES.find(p => p.name === name);
  }

  /**
   * 验证屏幕配置的合理性
   */
  validateScreenConfig(config: ScreenConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.width <= 0) {
      errors.push('屏幕宽度必须大于0');
    }

    if (config.height <= 0) {
      errors.push('屏幕高度必须大于0');
    }

    if (config.fontSize <= 0) {
      errors.push('字体大小必须大于0');
    }

    if (config.maxCharsPerLine <= 0) {
      errors.push('每行最大字符数必须大于0');
    }

    if (config.maxLines <= 0) {
      errors.push('最多行数必须大于0');
    }

    // 检查安全边距
    const totalHMargin = config.safeMargin.left + config.safeMargin.right;
    const totalVMargin = config.safeMargin.top + config.safeMargin.bottom;

    if (totalHMargin >= 100) {
      errors.push('左右安全边距总和不能超过100%');
    }

    if (totalVMargin >= 100) {
      errors.push('上下安全边距总和不能超过100%');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取推荐的字体大小范围
   */
  getRecommendedFontSizeRange(screenConfig: ScreenConfig): { min: number; max: number } {
    const screenArea = screenConfig.width * screenConfig.height;
    const baseFontSize = screenConfig.fontSize;

    return {
      min: Math.max(12, Math.round(baseFontSize * 0.5)),
      max: Math.min(120, Math.round(baseFontSize * 2))
    };
  }

  /**
   * 根据屏幕调整字体大小
   */
  adjustFontSize(
    currentFontSize: number,
    screenConfig: ScreenConfig,
    userPreference?: 'smaller' | 'normal' | 'larger'
  ): number {
    const range = this.getRecommendedFontSizeRange(screenConfig);

    switch (userPreference) {
      case 'smaller':
        return Math.max(range.min, Math.round(currentFontSize * 0.8));
      case 'larger':
        return Math.min(range.max, Math.round(currentFontSize * 1.2));
      default:
        return Math.max(range.min, Math.min(range.max, currentFontSize));
    }
  }
}

/**
 * 导出单例实例
 */
export const screenAdaptationManager = new ScreenAdaptationManager();
