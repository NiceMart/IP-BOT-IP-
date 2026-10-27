// ASS字幕特效生成器
// 根据情感分析结果生成ASS特效标签

import type { SentimentAnalysisResult } from './prompts';

/**
 * 颜色配置
 */
export interface ColorConfig {
    positive: string;      // 正面情感颜色（如：&H00FF00& 绿色）
    negative: string;      // 负面情感颜色（如：&H0000FF& 红色）
    neutral: string;       // 中性颜色（如：&HFFFFFF& 白色）
    emphasis: string;      // 强调色（如：&H00FFFF& 黄色）
    action: string;        // 动作色（如：&HFF8800& 橙色）
    emotion: string;       // 情感色（如：&HFF00FF& 粉色）
}

/**
 * 特效强度配置
 */
export interface EffectIntensityConfig {
    minScale: number;      // 最小缩放（如：0.8）
    maxScale: number;      // 最大缩放（如：1.5）
    minAlpha: number;      // 最小透明度（如：0）
    maxAlpha: number;      // 最大透明度（如：255）
    minBlur: number;       // 最小模糊（如：0）
    maxBlur: number;       // 最大模糊（如：3）
}

/**
 * ASS特效生成器配置
 */
export interface EffectGeneratorConfig {
    colors: ColorConfig;
    intensity: EffectIntensityConfig;
    enableGlow: boolean;           // 是否启用发光效果
    enableShadow: boolean;         // 是否启用阴影
    enableAnimation: boolean;      // 是否启用动画
    animationDuration: number;     // 动画持续时间（毫秒）
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: EffectGeneratorConfig = {
    colors: {
        positive: '&H00FF00&',    // 绿色（ABGR: 00=Alpha, FF=Blue, 00=Green, 00=Red）
        negative: '&H0000FF&',    // 红色（ABGR: 00=Alpha, 00=Blue, 00=Green, FF=Red）
        neutral: '&HFFFFFF&',     // 白色（ABGR: 00=Alpha, FF=Blue, FF=Green, FF=Red）
        emphasis: '&H00FFFF&',    // 黄色（ABGR: 00=Alpha, FF=Blue, FF=Green, 00=Red）
        action: '&H0088FF&',      // 橙色（ABGR: 00=Alpha, 88=Blue, FF=Green, 00=Red）
        emotion: '&HFF00FF&'      // 粉色（ABGR: 00=Alpha, FF=Blue, 00=Green, FF=Red）
    },
    intensity: {
        minScale: 0.9,
        maxScale: 1.3,
        minAlpha: 0,
        maxAlpha: 255,
        minBlur: 0,
        maxBlur: 2
    },
    enableGlow: true,
    enableShadow: true,
    enableAnimation: true,
    animationDuration: 300
};

/**
 * ASS特效生成器类
 */
export class EffectGenerator {
    private config: EffectGeneratorConfig;

    constructor(config?: Partial<EffectGeneratorConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            colors: { ...DEFAULT_CONFIG.colors, ...config?.colors },
            intensity: { ...DEFAULT_CONFIG.intensity, ...config?.intensity }
        };
    }

    /**
     * 为单个词语生成ASS特效标签
     */
    generateWordEffect(
        word: {
            text: string;
            sentiment: 'positive' | 'negative' | 'neutral';
            intensity: number;
            specialType?: string;
        },
        isLastWord: boolean = false
    ): string {
        const tags: string[] = [];

        // 1. 颜色标签（ASS格式）
        const color = this.getColor(word.sentiment, word.specialType);
        tags.push(`\\c${color}`);

        // 2. 缩放标签（根据情感强度）
        if (word.intensity > 0.5) {
            const scale = this.calculateScale(word.intensity);
            tags.push(`\\fscx${scale}`);
            tags.push(`\\fscy${scale}`);
        }

        // 3. 发光效果（强调词和高强度词）
        if (this.config.enableGlow && (word.specialType === 'EMPHASIS' || word.intensity > 0.8)) {
            const blur = this.calculateBlur(word.intensity);
            tags.push(`\\blur${blur}`);
            tags.push(`\\bord3`); // 边框宽度
        }

        // 4. 特殊类型效果
        if (word.specialType) {
            const specialTags = this.getSpecialTypeTags(word.specialType, word.intensity);
            tags.push(...specialTags);
        }

        // 5. 动画效果
        if (this.config.enableAnimation && word.intensity > 0.6) {
            const animTags = this.generateAnimation(word);
            tags.push(...animTags);
        }

        // 只在有特效标签时才添加标签，并且不在最后一个词后添加重置标签
        if (tags.length > 0) {
            return `{${tags.join('')}}${word.text}{\\r}`;
        } else {
            return word.text;
        }
    }

    /**
     * 为整个句子生成ASS字幕行
     */
    generateSubtitleLine(
        result: SentimentAnalysisResult,
        startTime: string,
        endTime: string,
        style: string = 'Default'
    ): string {
        const words = result.words.map((word, index) =>
            this.generateWordEffect(word, index === result.words.length - 1)
        );
        const text = words.join('');
        
        return `Dialogue: 0,${startTime},${endTime},${style},,0,0,0,,${text}`;
    }

    /**
     * 批量生成字幕行
     */
    generateSubtitleLines(
        results: Array<{
            analysis: SentimentAnalysisResult;
            startTime: string;
            endTime: string;
        }>,
        style: string = 'Default'
    ): string[] {
        return results.map(item => 
            this.generateSubtitleLine(item.analysis, item.startTime, item.endTime, style)
        );
    }

    /**
     * 获取颜色
     */
    private getColor(sentiment: string, specialType?: string): string {
        // 特殊类型优先
        if (specialType) {
            switch (specialType) {
                case 'EMPHASIS':
                    return this.config.colors.emphasis;
                case 'ACTION':
                    return this.config.colors.action;
                case 'EMOTION':
                    return this.config.colors.emotion;
                case 'SUPERLATIVE':
                    return this.config.colors.emphasis;
            }
        }

        // 情感颜色
        switch (sentiment) {
            case 'positive':
                return this.config.colors.positive;
            case 'negative':
                return this.config.colors.negative;
            default:
                return this.config.colors.neutral;
        }
    }

    /**
     * 计算缩放比例
     */
    private calculateScale(intensity: number): number {
        const { minScale, maxScale } = this.config.intensity;
        const scale = minScale + (maxScale - minScale) * intensity;
        return Math.round(scale * 100); // ASS使用百分比
    }

    /**
     * 计算模糊度
     */
    private calculateBlur(intensity: number): number {
        const { minBlur, maxBlur } = this.config.intensity;
        return minBlur + (maxBlur - minBlur) * intensity;
    }

    /**
     * 获取特殊类型标签
     */
    private getSpecialTypeTags(specialType: string, intensity: number): string[] {
        const tags: string[] = [];

        switch (specialType) {
            case 'ACTION':
                // 动作词：加粗 + 倾斜
                tags.push('\\b1');  // 加粗
                tags.push('\\i1');  // 倾斜
                break;

            case 'EMOTION':
                // 情感词：渐变色
                tags.push('\\3c&HFF00FF&');  // 边框颜色
                tags.push('\\bord2');
                break;

            case 'EMPHASIS':
                // 强调词：发光 + 加粗
                tags.push('\\b1');
                tags.push('\\bord3');
                break;

            case 'QUESTION':
                // 疑问词：下划线
                tags.push('\\u1');
                break;

            case 'TRANSITION':
                // 转折词：下划线
                tags.push('\\u1');
                break;

            case 'SUPERLATIVE':
                // 最高级：彩虹渐变 + 最大缩放
                tags.push('\\c&H00FFFF&');  // 黄色
                tags.push(`\\fscx${this.config.intensity.maxScale * 100}`);
                tags.push(`\\fscy${this.config.intensity.maxScale * 100}`);
                tags.push('\\b1');
                tags.push('\\bord3');
                break;
        }

        return tags;
    }

    /**
     * 生成动画标签
     */
    private generateAnimation(word: {
        text: string;
        sentiment: string;
        intensity: number;
        specialType?: string;
    }): string[] {
        const tags: string[] = [];
        const duration = this.config.animationDuration;

        // 根据特殊类型选择动画（简化动画，避免FFmpeg兼容性问题）
        switch (word.specialType) {
            case 'ACTION':
                // 弹跳动画：使用缩放
                tags.push(`\\t(0,${duration},\\fscx110\\fscy110)`);
                break;

            case 'EMOTION':
                // 脉冲动画：使用模糊
                tags.push(`\\t(0,${duration},\\blur1.5)`);
                break;

            case 'EMPHASIS':
                // 发光效果：增加边框
                tags.push(`\\t(0,${duration},\\bord4)`);
                break;

            case 'SUPERLATIVE':
                // 最高级：最大缩放
                tags.push(`\\t(0,${duration},\\fscx120\\fscy120)`);
                break;

            default:
                // 默认：轻微缩放
                if (word.intensity > 0.7) {
                    tags.push(`\\t(0,${duration},\\fscx105\\fscy105)`);
                }
        }

        return tags;
    }

    /**
     * 生成完整的ASS样式定义
     * Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
     * Alignment: 1=左下, 2=中下, 3=右下, 4=左中, 5=居中, 6=右中, 7=左上, 8=中上, 9=右上
     */
    generateStyleDefinition(
        styleName: string = 'Default',
        fontSize: number = 48,
        fontName: string = 'Microsoft YaHei',
        primaryColor: string = '&H00FFFFFF&',
        outlineColor: string = '&H00000000&',
        backColor: string = '&H80000000&',
        bold: number = 0,
        outline: number = 2,
        shadow: number = 1,
        alignment: number = 2,
        marginV: number = 50,
        marginL: number = 60,
        marginR: number = 60
    ): string {
        // ASS样式格式说明：
        // PrimaryColour: 主颜色（文字颜色），ABGR格式
        // SecondaryColour: 次要颜色（卡拉OK效果用）
        // OutlineColour: 边框颜色
        // BackColour: 阴影/背景颜色
        // Bold: 0=正常, -1=加粗
        // Outline: 边框宽度（像素）
        // Shadow: 阴影距离（像素）
        // Alignment: 对齐方式（小键盘布局）
        // MarginL/MarginR: 左右边距（像素），防止字幕超出屏幕
        // MarginV: 垂直边距（像素）
        
        return `Style: ${styleName},${fontName},${fontSize},${primaryColor},&H000000FF&,${outlineColor},${backColor},${bold},0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},${marginL},${marginR},${marginV},1`;
    }

    /**
     * 生成ASS文件头部
     */
    generateASSHeader(videoWidth: number = 1920, videoHeight: number = 1080, template: string = 'auto', customColors?: {primary?: string, outline?: string, back?: string}): string {
        const header = `[Script Info]
; Script generated by Sentiment Subtitle System
Title: Sentiment Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;
        
        // 根据模板生成不同的样式，支持自定义颜色
        return header + this.getTemplateStyle(template, customColors) + `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    }
    
    /**
     * 根据模板获取样式定义
     * 每个模板都有自定义的颜色、描边、阴影等效果参数
     * 增加左右边距防止字幕超出屏幕
     */
    private getTemplateStyle(template: string, customColors?: {primary?: string, outline?: string, back?: string}): string {
        // 使用自定义颜色或默认颜色
        const primaryColor = customColors?.primary || '&H00FFFFFF&';
        const outlineColor = customColors?.outline || '&H00000000&';
        const backColor = customColors?.back || '&H80000000&';
        
        switch (template) {
            case 'douyin':
                // 抖音风格：白色文字，黑色粗边框，底部居中，较大字号
                // 左右边距：80px，防止超出屏幕
                return this.generateStyleDefinition('Default', 52, 'Microsoft YaHei Bold', primaryColor, outlineColor, backColor, -1, 3, 0, 2, 60, 80, 80);
            
            case 'kuaishou':
                // 快手风格：白色文字，黑色边框，有阴影，底部居中
                // 左右边距：80px，防止超出屏幕
                return this.generateStyleDefinition('Default', 50, 'Microsoft YaHei Bold', primaryColor, outlineColor, backColor, -1, 2, 2, 2, 70, 80, 80);
            
            case 'minimal':
                // 简约风格：白色文字，细边框，无阴影，底部居中
                // 左右边距：60px，防止超出屏幕
                return this.generateStyleDefinition('Default', 44, 'Arial', primaryColor, customColors?.outline || '&H00333333&', backColor, 0, 1, 0, 2, 40, 60, 60);
            
            case 'rainbow':
                // 彩虹风格：白色文字，彩色边框，有发光效果
                // 左右边距：70px，防止超出屏幕
                return this.generateStyleDefinition('Default', 48, 'Microsoft YaHei', primaryColor, customColors?.outline || '&H00FF6600&', customColors?.back || '&H80FF0000&', 0, 2, 1, 2, 50, 70, 70);
            
            case 'pulse':
                // 脉冲风格：白色文字，较粗边框，强阴影
                // 左右边距：70px，防止超出屏幕
                return this.generateStyleDefinition('Default', 48, 'Microsoft YaHei', primaryColor, outlineColor, backColor, 0, 3, 2, 2, 50, 70, 70);
            
            case 'auto':
            default:
                // 自动/默认风格：白色文字，黑色边框，轻微阴影，底部居中
                // 左右边距：70px，防止超出屏幕
                return this.generateStyleDefinition('Default', 48, 'Microsoft YaHei', primaryColor, outlineColor, backColor, 0, 2, 1, 2, 50, 70, 70);
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<EffectGeneratorConfig>): void {
        this.config = {
            ...this.config,
            ...config,
            colors: { ...this.config.colors, ...config.colors },
            intensity: { ...this.config.intensity, ...config.intensity }
        };
    }

    /**
     * 获取当前配置
     */
    getConfig(): EffectGeneratorConfig {
        return { ...this.config };
    }
    /**
     * RGB颜色转ASS ABGR格式
     * @param rgb RGB格式颜色 (#RRGGBB 或 #AARRGGBB)
     * @returns ASS ABGR格式 (&HAABBGGRR&)
     */
    private rgbToABGR(rgb: string): string {
        // 如果已经是ASS格式，直接返回
        if (rgb.startsWith('&H') && rgb.endsWith('&')) {
            return rgb;
        }
        
        // 移除 # 号
        rgb = rgb.replace('#', '');
        
        // 处理带透明度的颜色 (#AARRGGBB)
        if (rgb.length === 8) {
            const aa = rgb.substring(0, 2);
            const rr = rgb.substring(2, 4);
            const gg = rgb.substring(4, 6);
            const bb = rgb.substring(6, 8);
            return `&H${aa}${bb}${gg}${rr}&`;
        }
        
        // 处理不带透明度的颜色 (#RRGGBB)
        if (rgb.length === 6) {
            const rr = rgb.substring(0, 2);
            const gg = rgb.substring(2, 4);
            const bb = rgb.substring(4, 6);
            return `&H00${bb}${gg}${rr}&`;
        }
        
        // 无效格式，返回白色
        console.warn(`无效的RGB颜色格式: ${rgb}，使用默认白色`);
        return '&H00FFFFFF&';
    }

    /**
     * 生成完整的ASS字幕文件内容
     * @param subtitles 字幕数组，包含分析结果和时间信息
     * @param template 模板名称
     * @param customColors 自定义颜色配置（支持RGB格式如 #FFFFFF 或 ASS格式如 &H00FFFFFF&）
     * @returns 完整的ASS文件内容
     */
    generateASS(
        subtitles: Array<{
            index: number;
            startTime: string;
            endTime: string;
            text: string;
            analysis: SentimentAnalysisResult;
        }>,
        template: string = 'auto',
        customColors?: {primary?: string, outline?: string, back?: string}
    ): string {
        // 转换自定义颜色为ASS格式
        const convertedColors = customColors ? {
            primary: customColors.primary ? this.rgbToABGR(customColors.primary) : undefined,
            outline: customColors.outline ? this.rgbToABGR(customColors.outline) : undefined,
            back: customColors.back ? this.rgbToABGR(customColors.back) : undefined
        } : undefined;
        
        // 生成ASS文件头部（包含模板样式和转换后的颜色）
        let assContent = this.generateASSHeader(1920, 1080, template, convertedColors);
        
        // 生成每一行字幕
        for (const subtitle of subtitles) {
            // 去除标点符号
            const cleanedText = subtitle.text.replace(/[，。！？；：、""''（）《》【】…—·,.!?;:'"()\[\]{}<>]/g, '').trim();
            if (!cleanedText) {
                continue; // 跳过空字幕
            }
            
            const line = this.generateSubtitleLine(
                subtitle.analysis,
                subtitle.startTime,
                subtitle.endTime
            );
            assContent += line + '\n';
        }
        
        return assContent;
    }
}

/**
 * 创建特效生成器实例
 */
export function createEffectGenerator(config?: Partial<EffectGeneratorConfig>): EffectGenerator {
    return new EffectGenerator(config);
}

/**
 * 时间格式转换工具
 */
export class TimeFormatter {
    /**
     * 将秒转换为ASS时间格式 (0:00:00.00)
     */
    static secondsToASS(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const centiseconds = Math.floor((seconds % 1) * 100);

        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    /**
     * 将毫秒转换为ASS时间格式
     */
    static millisecondsToASS(ms: number): string {
        return this.secondsToASS(ms / 1000);
    }

    /**
     * ASS时间格式转换为秒
     */
    static ASSToSeconds(assTime: string): number {
        const parts = assTime.split(':');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secParts = parts[2].split('.');
        const seconds = parseInt(secParts[0]);
        const centiseconds = parseInt(secParts[1] || '0');

        return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }

    /**
     * 将SRT时间格式转换为ASS时间格式
     * SRT格式: 00:00:04,100 (时:分:秒,毫秒)
     * ASS格式: 0:00:04.10 (时:分:秒.百分秒)
     */
    static srtToASS(srtTime: string): string {
        // SRT格式: 00:00:04,100
        // 先替换逗号为点号
        let normalized = srtTime.replace(',', '.');
        
        // 分割时间部分 HH:MM:SS.mmm
        const parts = normalized.split(':');
        if (parts.length !== 3) {
            console.error('Invalid SRT time format:', srtTime);
            return srtTime;
        }
        
        const hours = parseInt(parts[0]);
        const minutes = parts[1]; // 保持两位数格式
        const secAndMs = parts[2].split('.');
        const seconds = secAndMs[0]; // 保持两位数格式
        const milliseconds = secAndMs[1] || '000';
        
        // 转换毫秒为百分秒 (1000ms = 100 centiseconds)
        // 例如: 100ms = 10cs, 500ms = 50cs
        const centiseconds = Math.floor(parseInt(milliseconds) / 10);
        
        // ASS格式: H:MM:SS.cc (小时不补零，分秒补零，百分秒补零)
        return `${hours}:${minutes}:${seconds}.${String(centiseconds).padStart(2, '0')}`;
    }
}