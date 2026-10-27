/**
 * 词汇分类器 - VocabularyClassifier
 * 扩展SentimentAnalyzer，使用智谱AI进行词汇分类（不只是情感分析）
 */

import {
  ClassifiedWord,
  VocabularyCategory,
  Sentiment,
  VocabularyClassificationResult
} from '../../types/smartSubtitle';

/**
 * 本地词汇数据库
 */
interface VocabularyDatabaseEntry {
  word: string;
  category: VocabularyCategory;
  sentiment?: Sentiment;
  emotionIntensity?: number;
  specialType?: string;
}

/**
 * 词汇分类器配置
 */
export interface VocabularyClassifierOptions {
  useAI?: boolean;              // 是否使用AI
  providerId?: string;          // 模型提供商
  modelId?: string;             // 模型ID
  fallbackToLexicon?: boolean;  // AI失败时回退到本地词典
  cacheResults?: boolean;       // 缓存结果
}

/**
 * 词汇分类器
 */
export class VocabularyClassifier {
  private options: VocabularyClassificationOptions;
  private cache: Map<string, ClassifiedWord[]> = new Map();
  private vocabularyDatabase: VocabularyDatabaseEntry[] = [];

  constructor(options: VocabularyClassifierOptions = {}) {
    this.options = {
      useAI: true,
      providerId: 'zhipu',
      modelId: 'glm-4-flash',
      fallbackToLexicon: true,
      cacheResults: true,
      ...options
    };

    this.initializeVocabularyDatabase();
  }

  /**
   * 初始化本地词汇数据库
   */
  private initializeVocabularyDatabase(): void {
    // 关键词（成语、固定搭配）
    const keywords: VocabularyDatabaseEntry[] = [
      { word: '出类拔萃', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9 },
      { word: '如火如荼', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '众志成城', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9 },
      { word: '厚积薄发', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '不负韶华', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9 },
      { word: '砥砺前行', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '破浪前行', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.8 },
      { word: '乘风破浪', category: VocabularyCategory.KEYWORD, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9 },
      { word: '人工智能', category: VocabularyCategory.KEYWORD },
      { word: '机器学习', category: VocabularyCategory.KEYWORD },
      { word: '深度学习', category: VocabularyCategory.KEYWORD },
      { word: '神经网络', category: VocabularyCategory.KEYWORD },
      { word: '大数据', category: VocabularyCategory.KEYWORD },
      { word: '云计算', category: VocabularyCategory.KEYWORD },
      { word: '物联网', category: VocabularyCategory.KEYWORD },
      { word: '区块链', category: VocabularyCategory.KEYWORD },
    ];

    // 行动词
    const actionVerbs: VocabularyDatabaseEntry[] = [
      { word: '跑', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '跳', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '飞', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '冲', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '奔', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '冲刺', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '奔跑', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '飞速', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
      { word: '猛冲', category: VocabularyCategory.ACTION, specialType: 'ACTION' },
    ];

    // 描述词
    const descriptionWords: VocabularyDatabaseEntry[] = [
      { word: '闪亮', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.8 },
      { word: '轻柔', category: VocabularyCategory.DESCRIPTION },
      { word: '温暖', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.7 },
      { word: '美丽', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '优雅', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.8 },
      { word: '壮观', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '宏伟', category: VocabularyCategory.DESCRIPTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85 },
      { word: '广阔', category: VocabularyCategory.DESCRIPTION },
    ];

    // 情感词
    const emotionWords: VocabularyDatabaseEntry[] = [
      { word: '开心', category: VocabularyCategory.EMOTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9, specialType: 'EMOTION' },
      { word: '惊喜', category: VocabularyCategory.EMOTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85, specialType: 'EMOTION' },
      { word: '感动', category: VocabularyCategory.EMOTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.8, specialType: 'EMOTION' },
      { word: '恐惧', category: VocabularyCategory.EMOTION, sentiment: Sentiment.NEGATIVE, emotionIntensity: 0.8, specialType: 'EMOTION' },
      { word: '伤心', category: VocabularyCategory.EMOTION, sentiment: Sentiment.NEGATIVE, emotionIntensity: 0.85, specialType: 'EMOTION' },
      { word: '失望', category: VocabularyCategory.EMOTION, sentiment: Sentiment.NEGATIVE, emotionIntensity: 0.75, specialType: 'EMOTION' },
      { word: '愤怒', category: VocabularyCategory.EMOTION, sentiment: Sentiment.NEGATIVE, emotionIntensity: 0.9, specialType: 'EMOTION' },
      { word: '兴奋', category: VocabularyCategory.EMOTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.9, specialType: 'EMOTION' },
      { word: '喜悦', category: VocabularyCategory.EMOTION, sentiment: Sentiment.POSITIVE, emotionIntensity: 0.85, specialType: 'EMOTION' },
    ];

    this.vocabularyDatabase = [
      ...keywords,
      ...actionVerbs,
      ...descriptionWords,
      ...emotionWords
    ];
  }

  /**
   * 主入口：对文本进行词汇分类
   */
  async classify(text: string): Promise<VocabularyClassificationResult> {
    // 1. 检查缓存
    if (this.options.cacheResults && this.cache.has(text)) {
      console.log(`[VocabularyClassifier] 从缓存返回结果: ${text}`);
      const cached = this.cache.get(text)!;
      return {
        words: cached,
        statistics: this.calculateStatistics(cached)
      };
    }

    // 2. 分词
    const tokens = this.tokenize(text);

    // 3. 分类
    let classifiedWords: ClassifiedWord[];

    if (this.options.useAI) {
      try {
        classifiedWords = await this.classifyWithAI(text, tokens);
      } catch (error) {
        console.error('[VocabularyClassifier] AI分类失败:', error);

        if (this.options.fallbackToLexicon) {
          classifiedWords = this.classifyWithLexicon(tokens);
        } else {
          throw error;
        }
      }
    } else {
      classifiedWords = this.classifyWithLexicon(tokens);
    }

    // 4. 缓存结果
    if (this.options.cacheResults) {
      this.cache.set(text, classifiedWords);
    }

    // 5. 生成统计信息
    const statistics = this.calculateStatistics(classifiedWords);

    return {
      words: classifiedWords,
      statistics
    };
  }

  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 简单的字符级分词（实际应该使用专业的分词库）
    const tokens: string[] = [];
    let currentToken = '';

    for (const char of text) {
      if (/[\u4e00-\u9fff]/.test(char)) {
        // 中文字符单独成词
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = '';
        }
        tokens.push(char);
      } else if (/[a-zA-Z]/.test(char)) {
        // 英文字符累积
        currentToken += char;
      } else {
        // 其他字符（空格、标点等）作为分隔符
        if (currentToken) {
          tokens.push(currentToken);
          currentToken = '';
        }
      }
    }

    if (currentToken) {
      tokens.push(currentToken);
    }

    return tokens;
  }

  /**
   * 使用本地词典分类
   */
  private classifyWithLexicon(tokens: string[]): ClassifiedWord[] {
    const classifiedWords: ClassifiedWord[] = [];

    for (const token of tokens) {
      // 在数据库中查找
      const entry = this.vocabularyDatabase.find(e => e.word === token);

      if (entry) {
        classifiedWords.push({
          text: token,
          category: entry.category,
          confidence: 0.9,
          sentiment: entry.sentiment,
          emotionIntensity: entry.emotionIntensity,
          specialType: entry.specialType
        });
      } else {
        // 未找到，标记为中性词
        classifiedWords.push({
          text: token,
          category: VocabularyCategory.NEUTRAL,
          confidence: 0.5,
          sentiment: Sentiment.NEUTRAL,
          emotionIntensity: 0
        });
      }
    }

    return classifiedWords;
  }

  /**
   * 使用AI进行分类
   */
  private async classifyWithAI(text: string, tokens: string[]): Promise<ClassifiedWord[]> {
    // 这里应该调用智谱AI的接口
    // 示例实现：
    console.log(`[VocabularyClassifier] 使用 ${this.options.modelId} 分类: ${text}`);

    // 模拟AI调用（实际应该调用真实API）
    // const response = await callZhipuAPI({...});

    // 暂时使用本地词典作为替代
    return this.classifyWithLexicon(tokens);
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    classifiedWords: ClassifiedWord[]
  ): VocabularyClassificationResult['statistics'] {
    const categoryCount = new Map<VocabularyCategory, number>();
    const sentimentCount = new Map<Sentiment, number>();

    for (const word of classifiedWords) {
      // 计算分类分布
      categoryCount.set(
        word.category,
        (categoryCount.get(word.category) || 0) + 1
      );

      // 计算情感分布
      if (word.sentiment) {
        sentimentCount.set(
          word.sentiment,
          (sentimentCount.get(word.sentiment) || 0) + 1
        );
      }
    }

    // 转换为对象
    const categoryDistribution: Record<VocabularyCategory, number> = {
      [VocabularyCategory.KEYWORD]: categoryCount.get(VocabularyCategory.KEYWORD) || 0,
      [VocabularyCategory.ACTION]: categoryCount.get(VocabularyCategory.ACTION) || 0,
      [VocabularyCategory.DESCRIPTION]: categoryCount.get(VocabularyCategory.DESCRIPTION) || 0,
      [VocabularyCategory.EMOTION]: categoryCount.get(VocabularyCategory.EMOTION) || 0,
      [VocabularyCategory.NEUTRAL]: categoryCount.get(VocabularyCategory.NEUTRAL) || 0
    };

    const sentimentDistribution: Record<Sentiment, number> = {
      [Sentiment.POSITIVE]: sentimentCount.get(Sentiment.POSITIVE) || 0,
      [Sentiment.NEGATIVE]: sentimentCount.get(Sentiment.NEGATIVE) || 0,
      [Sentiment.NEUTRAL]: sentimentCount.get(Sentiment.NEUTRAL) || 0
    };

    return {
      totalWords: classifiedWords.length,
      categoryDistribution,
      sentimentDistribution
    };
  }

  /**
   * 批量分类
   */
  async classifyBatch(texts: string[]): Promise<VocabularyClassificationResult[]> {
    const results: VocabularyClassificationResult[] = [];

    for (const text of texts) {
      const result = await this.classify(text);
      results.push(result);
    }

    return results;
  }

  /**
   * 添加自定义词汇
   */
  addCustomWord(
    word: string,
    category: VocabularyCategory,
    sentiment?: Sentiment,
    emotionIntensity?: number,
    specialType?: string
  ): void {
    // 移除重复的词汇
    this.vocabularyDatabase = this.vocabularyDatabase.filter(e => e.word !== word);

    // 添加新词汇
    this.vocabularyDatabase.push({
      word,
      category,
      sentiment,
      emotionIntensity,
      specialType
    });

    // 清除缓存
    this.cache.clear();
  }

  /**
   * 批量添加自定义词汇
   */
  addCustomWords(words: VocabularyDatabaseEntry[]): void {
    this.vocabularyDatabase.push(...words);
    this.cache.clear();
  }

  /**
   * 获取词汇数据库
   */
  getVocabularyDatabase(): VocabularyDatabaseEntry[] {
    return [...this.vocabularyDatabase];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取分类统计
   */
  getClassificationStats(): {
    totalWords: number;
    categories: Record<VocabularyCategory, number>;
    sentiments: Record<Sentiment, number>;
  } {
    const categories: Record<VocabularyCategory, number> = {
      [VocabularyCategory.KEYWORD]: 0,
      [VocabularyCategory.ACTION]: 0,
      [VocabularyCategory.DESCRIPTION]: 0,
      [VocabularyCategory.EMOTION]: 0,
      [VocabularyCategory.NEUTRAL]: 0
    };

    const sentiments: Record<Sentiment, number> = {
      [Sentiment.POSITIVE]: 0,
      [Sentiment.NEGATIVE]: 0,
      [Sentiment.NEUTRAL]: 0
    };

    for (const entry of this.vocabularyDatabase) {
      categories[entry.category]++;

      if (entry.sentiment) {
        sentiments[entry.sentiment]++;
      }
    }

    return {
      totalWords: this.vocabularyDatabase.length,
      categories,
      sentiments
    };
  }

  /**
   * 验证分类结果的质量
   */
  validateClassification(result: VocabularyClassificationResult): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 检查是否有未分类的词汇过多
    const neutralCount = result.words.filter(w => w.category === VocabularyCategory.NEUTRAL).length;
    const neutralRatio = neutralCount / result.words.length;

    if (neutralRatio > 0.5) {
      issues.push(`未分类词汇过多 (${(neutralRatio * 100).toFixed(1)}%)`);
    }

    // 检查置信度
    const lowConfidenceCount = result.words.filter(w => w.confidence < 0.5).length;

    if (lowConfidenceCount > 0) {
      issues.push(`${lowConfidenceCount} 个词汇置信度过低`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * 导出单例实例（使用推荐配置）
 */
export const vocabularyClassifier = new VocabularyClassifier({
  useAI: true,
  providerId: 'zhipu',
  modelId: 'glm-4-flash',
  fallbackToLexicon: true,
  cacheResults: true
});
