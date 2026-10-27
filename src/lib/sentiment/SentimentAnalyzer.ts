// 情感分析器 - 集成智谱AI和本地词典
import { SENTIMENT_LEXICON, analyzeBatch as analyzeLexiconBatch } from './lexicon';
import {
    getSystemPrompt,
    getUserPrompt,
    parseAIResponse,
    validateResult,
    mergeWithLexicon,
    type SentimentAnalysisResult
} from './prompts';
import { useModelStore } from '../../module/Model/store/model';

/**
 * 情感分析配置
 */
export interface SentimentAnalyzerConfig {
    useAI: boolean;              // 是否使用AI分析
    providerId?: string;         // 模型提供商ID（如'zhipu'）
    modelId?: string;            // 模型ID（如'glm-4-flash'）
    fallbackToLexicon: boolean;  // AI失败时是否回退到词典
    cacheResults: boolean;       // 是否缓存结果
}

/**
 * 分析模式
 */
export type AnalysisMode = 'ai-only' | 'lexicon-only' | 'hybrid';

/**
 * 情感分析器类
 */
export class SentimentAnalyzer {
    private config: SentimentAnalyzerConfig;
    private cache: Map<string, SentimentAnalysisResult>;
    private modelStore: ReturnType<typeof useModelStore>;

    constructor(config?: Partial<SentimentAnalyzerConfig>) {
        this.config = {
            useAI: true,
            providerId: 'zhipu',
            modelId: 'glm-4-flash',
            fallbackToLexicon: true,
            cacheResults: true,
            ...config
        };
        this.cache = new Map();
        this.modelStore = useModelStore();
    }

    /**
     * 分析单个句子的情感
     */
    async analyze(text: string, mode: AnalysisMode = 'hybrid'): Promise<SentimentAnalysisResult> {
        // 检查缓存
        if (this.config.cacheResults && this.cache.has(text)) {
            return this.cache.get(text)!;
        }

        let result: SentimentAnalysisResult | null = null;

        try {
            switch (mode) {
                case 'ai-only':
                    result = await this.analyzeWithAI(text);
                    break;
                case 'lexicon-only':
                    result = this.analyzeWithLexicon(text);
                    break;
                case 'hybrid':
                default:
                    result = await this.analyzeHybrid(text);
                    break;
            }

            if (result && this.config.cacheResults) {
                this.cache.set(text, result);
            }

            return result || this.getFallbackResult(text);
        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            return this.getFallbackResult(text);
        }
    }

    /**
     * 批量分析多个句子
     */
    async analyzeBatch(texts: string[], mode: AnalysisMode = 'hybrid'): Promise<SentimentAnalysisResult[]> {
        const results: SentimentAnalysisResult[] = [];
        
        for (const text of texts) {
            const result = await this.analyze(text, mode);
            results.push(result);
        }
        
        return results;
    }

    /**
     * 使用AI分析（智谱AI）
     */
    private async analyzeWithAI(text: string): Promise<SentimentAnalysisResult | null> {
        if (!this.config.useAI || !this.config.providerId || !this.config.modelId) {
            return null;
        }

        try {
            const systemPrompt = getSystemPrompt();
            const userPrompt = getUserPrompt(text);
            
            // 调用模型API
            const response = await this.modelStore.chat(
                this.config.providerId,
                this.config.modelId,
                `${systemPrompt}\n\n${userPrompt}`,
                { loading: false }
            );

            if (response.code !== 0 || !response.data || !response.data.content) {
                console.error('AI analysis failed:', response.msg);
                return null;
            }

            // 解析AI返回结果
            const result = parseAIResponse(response.data.content);
            
            if (!result || !validateResult(result)) {
                console.error('Invalid AI response format');
                return null;
            }

            return result;
        } catch (error) {
            console.error('AI analysis error:', error);
            return null;
        }
    }

    /**
     * 使用本地词典分析
     */
    private analyzeWithLexicon(text: string): SentimentAnalysisResult {
        // 简单分词（按字符和常见分隔符）
        const words = this.simpleTokenize(text);
        
        // 使用词典分析
        const lexiconResults = analyzeLexiconBatch(words);
        
        // 计算整体情感
        const positiveCount = lexiconResults.filter(w => w.sentiment === 'positive').length;
        const negativeCount = lexiconResults.filter(w => w.sentiment === 'negative').length;
        const avgIntensity = lexiconResults.reduce((sum, w) => sum + w.intensity, 0) / lexiconResults.length;
        
        let overallSentiment: 'positive' | 'negative' | 'neutral';
        if (positiveCount > negativeCount) {
            overallSentiment = 'positive';
        } else if (negativeCount > positiveCount) {
            overallSentiment = 'negative';
        } else {
            overallSentiment = 'neutral';
        }

        return {
            words: lexiconResults.map(w => ({
                text: w.text,
                sentiment: w.sentiment,
                intensity: w.intensity,
                specialType: w.specialType as any
            })),
            overallSentiment,
            overallIntensity: avgIntensity
        };
    }

    /**
     * 混合模式分析（AI + 词典）
     */
    private async analyzeHybrid(text: string): Promise<SentimentAnalysisResult | null> {
        // 先尝试AI分析
        const aiResult = await this.analyzeWithAI(text);
        
        if (!aiResult) {
            // AI失败，使用词典
            if (this.config.fallbackToLexicon) {
                return this.analyzeWithLexicon(text);
            }
            return null;
        }

        // AI成功，用词典数据增强
        const words = aiResult.words.map(w => w.text);
        const lexiconResults = analyzeLexiconBatch(words);
        
        // 合并结果（词典数据优先，因为更准确）
        return mergeWithLexicon(aiResult, lexiconResults);
    }

    /**
     * 简单分词（用于词典模式）
     */
    private simpleTokenize(text: string): string[] {
        // 移除标点符号
        const cleanText = text.replace(/[，。！？；：、""''（）《》【】…—\s]/g, ' ');
        
        // 按空格分割
        const words: string[] = [];
        let currentWord = '';
        
        for (const char of cleanText) {
            if (char === ' ') {
                if (currentWord) {
                    words.push(currentWord);
                    currentWord = '';
                }
            } else {
                currentWord += char;
            }
        }
        
        if (currentWord) {
            words.push(currentWord);
        }

        // 尝试匹配词典中的词汇
        const result: string[] = [];
        let i = 0;
        
        while (i < words.length) {
            let matched = false;
            
            // 尝试匹配2-4字的词
            for (let len = 4; len >= 2; len--) {
                if (i + len <= words.length) {
                    const phrase = words.slice(i, i + len).join('');
                    if (SENTIMENT_LEXICON.positive[phrase] || SENTIMENT_LEXICON.negative[phrase]) {
                        result.push(phrase);
                        i += len;
                        matched = true;
                        break;
                    }
                }
            }
            
            if (!matched) {
                result.push(words[i]);
                i++;
            }
        }
        
        return result.filter(w => w.length > 0);
    }

    /**
     * 获取回退结果（当所有分析都失败时）
     */
    private getFallbackResult(text: string): SentimentAnalysisResult {
        return {
            words: [{
                text: text,
                sentiment: 'neutral',
                intensity: 0.1
            }],
            overallSentiment: 'neutral',
            overallIntensity: 0.1
        };
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<SentimentAnalyzerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * 预热缓存（预先分析常用句子）
     */
    async warmupCache(texts: string[]): Promise<void> {
        console.log(`Warming up cache with ${texts.length} texts...`);
        await this.analyzeBatch(texts);
        console.log(`Cache warmed up. Size: ${this.cache.size}`);
    }
}

/**
 * 创建默认情感分析器实例
 */
export function createSentimentAnalyzer(config?: Partial<SentimentAnalyzerConfig>): SentimentAnalyzer {
    return new SentimentAnalyzer(config);
}

/**
 * 全局单例实例（可选）
 */
let globalAnalyzer: SentimentAnalyzer | null = null;

export function getGlobalAnalyzer(): SentimentAnalyzer {
    if (!globalAnalyzer) {
        globalAnalyzer = new SentimentAnalyzer({
            useAI: true,
            providerId: 'zhipu',
            modelId: 'glm-4-flash',
            fallbackToLexicon: true,
            cacheResults: true
        });
    }
    return globalAnalyzer;
}

/**
 * 重置全局分析器
 */
export function resetGlobalAnalyzer(): void {
    globalAnalyzer = null;
}