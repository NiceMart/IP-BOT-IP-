// @ts-nocheck
import type { DrawtextConfig } from '@/service/ZimuShengcheng.types';

/**
 * Drawtext生成工具类
 * 用于解决循环依赖问题
 */
export class DrawtextUtils {
    /**
     * 转义路径
     * 1. 替换反斜杠为正斜杠
     * 2. 转义冒号
     * 3. 处理Windows盘符
     */
    static escapePath(path: string): string {
        if (!path) return '';

        // 统一使用正斜杠
        let normalizedPath = path.replace(/\\/g, '/');

        // 检查是否是 Windows 盘符路径（如 C:/ 或 D:/）
        // 对于FFmpeg drawtext filter，需要转义冒号
        // 使用单引号包裹路径，并转义路径中的冒号
        const driveMatch = normalizedPath.match(/^([A-Za-z]):\//);
        if (driveMatch) {
            const driveLetter = driveMatch[1].toUpperCase();
            // 转义冒号：C:/path -> C\\:/path
            // 在 filter_complex 文件中，\\ 会被解析为 \，然后 \: 会被解析为 :
            normalizedPath = `${driveLetter}\\\\:${normalizedPath.substring(2)}`;
        } else if (normalizedPath.startsWith('/') && !normalizedPath.startsWith('//')) {
            // 处理缺少盘符的 Windows 路径
            // 某些情况下（如自定义安装目录、打包环境）路径可能丢失盘符
            // 变成 /Users/... 或 /path/to/file 格式
            // 在 Windows 上，这种路径应该添加 C: 前缀
            normalizedPath = `C\\\\:${normalizedPath}`;
            console.warn(`[DrawtextUtils.escapePath] 检测到缺少盘符的路径，已添加 C: 前缀: ${path} -> ${normalizedPath}`);
        }

        return normalizedPath;
    }

    /**
     * 转义文本内容
     */
    static escapeText(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/:/g, '\\:')
            .replace(/\n/g, ' ');
    }

    /**
     * 将十六进制颜色转换为drawtext格式（0xRRGGBB）
     */
    static convertHexToDrawtext(hexColor: string): string {
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
     * 生成基础drawtext命令
     * @param config drawtext配置
     * @returns drawtext命令字符串
     */
    static generateBasic(config: DrawtextConfig): string {
        const parts: string[] = [];

        // FFmpeg drawtext 路径格式：转义冒号，不使用单引号（避免 Windows 命令行解析问题）
        parts.push(`fontfile=${this.escapePath(config.fontfile)}`);
        parts.push(`text='${this.escapeText(config.text)}'`);
        parts.push(`x='${config.x}'`);
        parts.push(`y='${config.y}'`);

        // 如果 fontsize 包含表达式字符（如 + - * / ( ) sin cos PI），则需要用引号包裹
        const fontsizeStr = String(config.fontsize);
        if (/[+\-*/()PI]|sin|cos|min|max|abs/.test(fontsizeStr)) {
            parts.push(`fontsize='${fontsizeStr}'`);
        } else {
            parts.push(`fontsize=${fontsizeStr}`);
        }
        parts.push(`fontcolor=${config.fontcolor}`);

        // borderw 不支持表达式，如果是表达式则只取固定值
        const borderwStr = String(config.borderw);
        if (/[+\-*/()a-z]/i.test(borderwStr)) {
            // 是表达式，提取第一个数字作为固定值
            const match = borderwStr.match(/\d+/);
            parts.push(`borderw=${match ? match[0] : 3}`);
        } else {
            parts.push(`borderw=${borderwStr}`);
        }

        parts.push(`bordercolor=${config.bordercolor}`);
        parts.push(`enable='${config.enable}'`);

        if (config.alpha) {
            parts.push(`alpha='${config.alpha}'`);
        }

        // 注意：angle 参数在部分 FFmpeg 版本中可能不支持
        // 如果 FFmpeg 支持 angle，可以在 overrides 中传入
        if (config.angle !== undefined) {
            parts.push(`angle=${config.angle}`);
        }

        if (config.shadowcolor) {
            parts.push(`shadowcolor=${config.shadowcolor}`);
            parts.push(`shadowx=${config.shadowx || 2}`);
            parts.push(`shadowy=${config.shadowy || 2}`);
        }

        return `drawtext=${parts.join(':')}`;
    }
}
