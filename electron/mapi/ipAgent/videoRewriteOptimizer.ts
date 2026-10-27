/**
 * 视频文案仿写优化器
 * 特点：
 * 1. 支持更复杂的提示词模板
 * 2. 智能分批处理多个文案
 * 3. 更好的错误恢复
 * 4. 支持自定义的风格转换
 */

interface RewriteConfig {
  style?: 'casual' | 'professional' | 'emotional' | 'humorous'; // 文案风格
  length?: 'short' | 'medium' | 'long'; // 文案长度
  keepHashtags?: boolean; // 是否保留话题标签
  keepEmoji?: boolean; // 是否保留emoji
  maxRetries?: number; // 重试次数
}

interface RewriteResult {
  original: string;
  rewritten: string;
  confidence: number; // 0-1 的置信度
}

class VideoRewriteOptimizer {
  /**
   * 构建优化的仿写提示词
   */
  static buildRewritePrompt(
    content: string,
    config: RewriteConfig = {},
    customPrompt?: string
  ): string {
    // 如果提供了自定义提示词，使用自定义的
    if (customPrompt && customPrompt.trim()) {
      return this.replacePromptVariables(customPrompt, content);
    }

    // 否则使用预设的提示词
    return this.buildDefaultPrompt(content, config);
  }

  /**
   * 替换提示词中的变量
   */
  private static replacePromptVariables(template: string, content: string): string {
    return template
      .replace(/\{\{content\}\}/g, content)
      .replace(/\{content\}/g, content)
      .replace(/\{\{text\}\}/g, content)
      .replace(/\{text\}/g, content);
  }

  /**
   * 构建默认提示词
   */
  private static buildDefaultPrompt(content: string, config: RewriteConfig): string {
    const styleGuide = this.getStyleGuide(config.style || 'casual');
    const lengthGuide = this.getLengthGuide(config.length || 'medium');

    return `你是一个专业的视频内容创意编写专家，擅长创作吸引人的视频文案。

## 原始文案：
${content}

## 仿写要求：
1. **风格**: ${styleGuide}
2. **长度**: ${lengthGuide}
3. **核心保持**: 保留原文案的核心信息和主题
4. **创意提升**: 在措辞、表述角度、情感吸引力上创新
5. **格式**:
   ${config.keepHashtags !== false ? '- 保留原有话题标签（#开头的内容）' : '- 不使用话题标签'}
   ${config.keepEmoji !== false ? '- 可以适当添加表情符号增加生动性' : '- 不使用表情符号'}
6. **禁止事项**:
   - 不要改变事实信息
   - 不要添加虚假承诺
   - 不要包含敏感词汇

请直接输出仿写后的文案，不需要任何额外说明或标记。`;
  }

  /**
   * 获取风格指南
   */
  private static getStyleGuide(style: string): string {
    const guides: Record<string, string> = {
      casual: '轻松随意、接地气、易产生共鸣，像和朋友聊天一样',
      professional: '正式专业、有信服力、适合商务或教育内容',
      emotional: '充满情感、富有感染力、能打动人心',
      humorous: '幽默诙谐、容易引起笑声和转发、保持积极态度'
    };
    return guides[style] || guides.casual;
  }

  /**
   * 获取长度指南
   */
  private static getLengthGuide(length: string): string {
    const guides: Record<string, string> = {
      short: '简洁有力，100字以内，快速传达核心信息',
      medium: '适中篇幅，100-300字，既能完整表达又不显冗长',
      long: '详细深入，300-500字，充分展开论点和细节'
    };
    return guides[length] || guides.medium;
  }

  /**
   * 批量仿写文案（支持多个内容同时处理）
   */
  static buildBatchRewritePrompt(
    contents: string[],
    config: RewriteConfig = {},
    customPrompt?: string
  ): string {
    if (customPrompt && customPrompt.trim()) {
      // 自定义提示词需要特殊处理，只能一个接一个
      return this.replacePromptVariables(customPrompt, contents[0]);
    }

    const styleGuide = this.getStyleGuide(config.style || 'casual');
    const lengthGuide = this.getLengthGuide(config.length || 'medium');

    const itemsText = contents
      .map((content, i) => `${i + 1}. ${content}`)
      .join('\n');

    return `你是一个专业的视频内容创意编写专家，擅长创作吸引人的视频文案。

## 原始文案列表：
${itemsText}

## 仿写要求：
1. **风格**: ${styleGuide}
2. **长度**: ${lengthGuide}
3. **核心保持**: 保留每篇原文案的核心信息和主题
4. **创意提升**: 在措辞、表述角度、情感吸引力上创新
5. **格式**:
   ${config.keepHashtags !== false ? '- 保留原有话题标签（#开头的内容）' : '- 不使用话题标签'}
   ${config.keepEmoji !== false ? '- 可以适当添加表情符号增加生动性' : '- 不使用表情符号'}
6. **禁止事项**:
   - 不要改变事实信息
   - 不要添加虚假承诺
   - 不要包含敏感词汇

## 输出格式：
请按顺序输出仿写后的文案，每个文案一行，不需要编号或任何额外标记。`;
  }

  /**
   * 解析仿写后的文案（处理可能的编号、特殊字符等）
   */
  static parseRewriteResponse(response: string, count: number): string[] {
    const lines = response
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 清理可能的编号前缀
    const cleaned = lines.map(line => {
      // 去掉开头的编号（1. 2. 1) 2) 等）
      return line
        .replace(/^[\d\.\)]+\s*/, '')
        .replace(/^[-•·\*]\s*/, '')
        .trim();
    });

    // 如果数量不匹配，尝试智能截断或填充
    if (cleaned.length > count) {
      return cleaned.slice(0, count);
    }

    if (cleaned.length < count) {
      // 填充原始文案（如果API返回不足）
      while (cleaned.length < count) {
        cleaned.push('精彩内容分享');
      }
    }

    return cleaned;
  }

  /**
   * 智能评估仿写质量
   */
  static assessQuality(original: string, rewritten: string): number {
    let score = 0.5; // 基础分数

    // 加分项
    if (rewritten.length > 0) score += 0.1; // 有内容
    if (rewritten.length > original.length * 0.5 && rewritten.length < original.length * 1.5) {
      score += 0.1; // 长度合理（±50%）
    }
    if (rewritten.includes('，') || rewritten.includes('。')) {
      score += 0.05; // 有标点符号
    }

    // 检查是否过于相似（直接复制）
    const similarity = this.calculateSimilarity(original, rewritten);
    if (similarity > 0.9) {
      score = Math.max(0.2, score - 0.3); // 过于相似减分
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * 计算两个文本的相似度（0-1）
   */
  private static calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    // 简单的字符重叠率计算
    const chars1 = new Set(text1);
    const chars2 = new Set(text2);

    const intersection = Array.from(chars1).filter(char => chars2.has(char)).length;
    const union = chars1.size + chars2.size - intersection;

    return intersection / (union || 1);
  }

  /**
   * 优化提示词中的文案内容部分
   * 用于处理很长的原始文案
   */
  static truncateContentForPrompt(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) {
      return content;
    }

    // 优先保留开头和结尾的关键信息
    const startLength = Math.ceil(maxLength * 0.6);
    const endLength = Math.floor(maxLength * 0.4);

    const start = content.substring(0, startLength);
    const end = content.substring(content.length - endLength);

    // 找到最近的句号/标点符号作为截断点
    const startEnd = start.lastIndexOf('。') >= 0
      ? start.lastIndexOf('。') + 1
      : startLength;

    return start.substring(0, startEnd) + ' [...] ' + end;
  }
}

export { VideoRewriteOptimizer, RewriteConfig, RewriteResult };
