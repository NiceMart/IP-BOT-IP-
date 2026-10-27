/**
 * 抖音内容解析器 - 优化版
 * 特点：
 * 1. 不需要打开浏览器
 * 2. 支持抖音分享链接格式解析
 * 3. 智能提取视频文案、链接、话题标签
 */

interface DouyinContent {
  videoUrl: string;          // 提取的视频链接
  description: string;       // 视频文案
  hashtags: string[];        // 话题标签
  rawText: string;          // 原始文本
}

interface ParseResult {
  success: boolean;
  content?: DouyinContent;
  error?: string;
}

class DouyinContentParser {
  private static readonly DIRECT_VIDEO_PATTERN = /https?:\/\/[^\s"'<>]+?\.(mp4|mov|m4v|webm|avi|mkv)(\?[^\s"'<>]*)?/i;
  /**
   * 从混杂文本中提取抖音内容
   * 支持格式：
   * 1. 纯链接：https://v.douyin.com/HjUnkVdzqU/
   * 2. 分享格式：文案 + 链接 + 说明文字
   * 3. 富文本：包含话题标签、emoji等
   */
  static parseContent(input: string): ParseResult {
    try {
      const raw = input.trim();

      if (!raw) {
        return {
          success: false,
          error: '输入内容为空'
        };
      }

      // 1. 提取视频URL
      const videoUrl = this.extractVideoUrl(raw);
      if (!videoUrl) {
        return {
          success: false,
          error: '未找到有效的抖音视频链接'
        };
      }

      // 2. 提取视频文案（从文本中去掉URL和说明文字后的内容）
      const description = this.extractDescription(raw, videoUrl);

      // 3. 提取话题标签
      const hashtags = this.extractHashtags(raw);

      return {
        success: true,
        content: {
          videoUrl,
          description,
          hashtags,
          rawText: raw
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `解析失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 提取视频URL
   * 支持多种格式：
   * - https://v.douyin.com/HjUnkVdzqU/
   * - https://www.douyin.com/video/7123456789
   * - https://iesdouyin.com/...
   */
  private static extractVideoUrl(text: string): string | null {
    const directVideoMatch = text.match(this.DIRECT_VIDEO_PATTERN);
    if (directVideoMatch?.[0]) {
      return directVideoMatch[0];
    }

    // 多种URL模式
    const patterns = [
      // 短链接格式：https://v.douyin.com/HjUnkVdzqU/
      /https:\/\/v\.douyin\.com\/[\w_\-@]+\/?/i,
      // www格式：https://www.douyin.com/video/7123456789
      /https:\/\/(?:www\.)?douyin\.com\/(?:video|modal)\/\d+/i,
      // iesdouyin格式
      /https:\/\/iesdouyin\.com\/(?:share\/video|video)\/\d+/i,
      // 简化版本（不带https）
      /v\.douyin\.com\/[\w_\-@]+/i,
      /douyin\.com\/(?:video|modal)\/\d+/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let url = match[0];
        // 补充 https:// 前缀（如果缺失）
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        // 确保以斜杠结尾（短链接）或不重复（标准链接）
        return url;
      }
    }

    return null;
  }

  static isDirectVideoUrl(url: string): boolean {
    return this.DIRECT_VIDEO_PATTERN.test(url.trim());
  }

  /**
   * 提取视频文案
   * 规则：
   * 1. 从第一个非whitespace字符开始
   * 2. 到URL出现前的所有文本
   * 3. 去掉尾部的"复制此链接"等说明文字
   */
  private static extractDescription(text: string, videoUrl: string): string {
    // 找到URL在文本中的位置
    const urlIndex = text.indexOf(videoUrl);

    let descriptionText = '';
    if (urlIndex > 0) {
      // URL前面的文本可能是文案
      descriptionText = text.substring(0, urlIndex).trim();
    } else {
      // 如果找不到完整URL，尝试提取URL后的内容
      // 这种情况很少，但作为后备方案
      const descriptionMatch = text.match(/^([^h]*?)(?:https?:\/\/|$)/);
      if (descriptionMatch && descriptionMatch[1]) {
        descriptionText = descriptionMatch[1].trim();
      }
    }

    // 清理文案中可能存在的噪音
    descriptionText = this.cleanDescription(descriptionText);

    return descriptionText;
  }

  /**
   * 清理文案中的噪音
   * 1. 去掉行号标记（2.05 03/10 等）
   * 2. 去掉乱码和特殊前缀
   * 3. 保留正常内容
   */
  private static cleanDescription(text: string): string {
    if (!text) return '';

    // 去掉开头的时间戳或版本号（如 "2.05 03/10"）
    let cleaned = text.replace(/^[\d\s\.\/]+/, '').trim();

    // 去掉开头的乱码或特殊字符（如 "i@p.Qx rRX:/" 这样的）
    // 如果开头包含太多特殊字符和数字的混合，说明是乱码
    const startMatch = cleaned.match(/^[^\u4e00-\u9fff\w\s]*(.*)$/);
    if (startMatch && startMatch[1]) {
      // 如果清理后还有内容，就用清理后的
      const potential = startMatch[1].trim();
      if (potential.length > 0) {
        cleaned = potential;
      }
    }

    // 如果清理后发现全是特殊字符或数字，返回空
    if (/^[\W_]+$/.test(cleaned)) {
      return '';
    }

    return cleaned;
  }

  /**
   * 提取话题标签
   * 支持：#话题、#话题名、@用户 等格式
   */
  private static extractHashtags(text: string): string[] {
    const hashtags: string[] = [];

    // 匹配 #话题 格式（包括中英文）
    const hashtagPattern = /#[\w\u4e00-\u9fff_]+/g;
    const matches = text.match(hashtagPattern);

    if (matches) {
      // 去重并返回
      hashtags.push(...Array.from(new Set(matches)));
    }

    return hashtags;
  }

  /**
   * 提取视频ID（用于后续处理）
   */
  static extractVideoId(videoUrl: string): string | null {
    // 短链接格式：v.douyin.com/HjUnkVdzqU/ -> HjUnkVdzqU
    const shortMatch = videoUrl.match(/v\.douyin\.com\/([\w_\-@]+)/i);
    if (shortMatch) {
      return shortMatch[1];
    }

    // 标准链接格式：/video/7123456789 -> 7123456789
    const standardMatch = videoUrl.match(/\/(?:video|modal)\/(\d+)/i);
    if (standardMatch) {
      return standardMatch[1];
    }

    return null;
  }

  /**
   * 为文案生成一个合理的标题
   * 规则：从文案中截取第一句话，或前N个字符
   */
  static generateTitleFromDescription(description: string, maxLength: number = 30): string {
    if (!description) {
      return '分享精彩内容';
    }

    // 尝试找到第一个句号、问号或感叹号
    const sentenceEnd = description.match(/[。！？\n]/);
    let title = '';

    if (sentenceEnd) {
      title = description.substring(0, sentenceEnd.index).trim();
    } else {
      title = description;
    }

    // 限制长度
    if (title.length > maxLength) {
      title = title.substring(0, maxLength) + '...';
    }

    return title || '精彩分享';
  }
}

export { DouyinContentParser, DouyinContent, ParseResult };
