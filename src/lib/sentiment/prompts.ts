// 情感分析提示词模板
// 用于智谱AI GLM-4模型的情感分析

/**
 * 情感分析结果接口
 */
export interface SentimentAnalysisResult {
    words: Array<{
        text: string;              // 词语文本
        sentiment: 'positive' | 'negative' | 'neutral';  // 情感倾向
        intensity: number;         // 情感强度 0-1
        specialType?: 'ACTION' | 'EMOTION' | 'EMPHASIS' | 'QUESTION' | 'TRANSITION' | 'SUPERLATIVE';
        reason?: string;           // 分析原因（可选）
    }>;
    overallSentiment: 'positive' | 'negative' | 'neutral';  // 整体情感
    overallIntensity: number;      // 整体强度
}

/**
 * 生成情感分析的系统提示词
 */
export function getSystemPrompt(): string {
    return `你是一个专业的中文情感分析专家，擅长分析文本中每个词语的情感倾向和强度。

你的任务是：
1. 将输入的句子分词（按照自然语义分词，不要过度细分）
2. 分析每个词语的情感倾向：positive（正面）、negative（负面）、neutral（中性）
3. 评估情感强度：0-1之间的数值，0表示无情感，1表示极强情感
4. 识别特殊词汇类型：
   - ACTION: 动作词（跑、跳、飞等）
   - EMOTION: 情感词（开心、伤心、愤怒等）
   - EMPHASIS: 强调词（非常、特别、极其等）
   - QUESTION: 疑问词（为什么、怎么、吗等）
   - TRANSITION: 转折词（但是、然而、不过等）
   - SUPERLATIVE: 最高级（最、第一、冠军等）

注意事项：
- 分词要符合中文语义习惯，不要拆分成单字（除非必要）
- 情感强度要准确反映词语的情感程度
- 标点符号不需要分析，直接忽略
- 返回标准JSON格式，不要添加任何额外说明

示例输入：这个产品真的太棒了！
示例输出：
{
  "words": [
    {"text": "这个", "sentiment": "neutral", "intensity": 0.1},
    {"text": "产品", "sentiment": "neutral", "intensity": 0.1},
    {"text": "真的", "sentiment": "neutral", "intensity": 0.1, "specialType": "EMPHASIS"},
    {"text": "太", "sentiment": "neutral", "intensity": 0.1, "specialType": "EMPHASIS"},
    {"text": "棒", "sentiment": "positive", "intensity": 0.8},
    {"text": "了", "sentiment": "neutral", "intensity": 0.1}
  ],
  "overallSentiment": "positive",
  "overallIntensity": 0.85
}`;
}

/**
 * 生成用户提示词
 */
export function getUserPrompt(text: string): string {
    return `请分析以下句子的情感：

${text}

请严格按照JSON格式返回分析结果，不要添加任何其他内容。`;
}

/**
 * 生成批量分析的用户提示词
 */
export function getBatchUserPrompt(sentences: string[]): string {
    const sentencesText = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
    
    return `请分析以下${sentences.length}个句子的情感：

${sentencesText}

请为每个句子返回独立的分析结果，格式如下：
{
  "results": [
    {
      "sentence": "句子1",
      "words": [...],
      "overallSentiment": "positive",
      "overallIntensity": 0.8
    },
    ...
  ]
}

请严格按照JSON格式返回，不要添加任何其他内容。`;
}

/**
 * 解析AI返回的JSON结果
 */
export function parseAIResponse(response: string): SentimentAnalysisResult | null {
    try {
        // 清理可能的markdown代码块标记
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/g, '');
        }
        
        const result = JSON.parse(cleanResponse);
        
        // 验证结果格式
        if (!result.words || !Array.isArray(result.words)) {
            console.error('Invalid AI response: missing words array');
            return null;
        }
        
        // 验证每个词语的格式
        for (const word of result.words) {
            if (!word.text || !word.sentiment || typeof word.intensity !== 'number') {
                console.error('Invalid word format:', word);
                return null;
            }
        }
        
        return result as SentimentAnalysisResult;
    } catch (error) {
        console.error('Failed to parse AI response:', error);
        console.error('Response:', response);
        return null;
    }
}

/**
 * 解析批量分析的AI返回结果
 */
export function parseBatchAIResponse(response: string): SentimentAnalysisResult[] | null {
    try {
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.replace(/```\n?/g, '');
        }
        
        const result = JSON.parse(cleanResponse);
        
        if (!result.results || !Array.isArray(result.results)) {
            console.error('Invalid batch AI response: missing results array');
            return null;
        }
        
        return result.results as SentimentAnalysisResult[];
    } catch (error) {
        console.error('Failed to parse batch AI response:', error);
        return null;
    }
}

/**
 * 生成简化版提示词（用于快速分析）
 */
export function getSimplePrompt(text: string): string {
    return `分析情感（只返回JSON）：${text}`;
}

/**
 * 验证情感分析结果的完整性
 */
export function validateResult(result: SentimentAnalysisResult): boolean {
    if (!result || !result.words || !Array.isArray(result.words)) {
        return false;
    }
    
    if (!result.overallSentiment || !['positive', 'negative', 'neutral'].includes(result.overallSentiment)) {
        return false;
    }
    
    if (typeof result.overallIntensity !== 'number' || result.overallIntensity < 0 || result.overallIntensity > 1) {
        return false;
    }
    
    for (const word of result.words) {
        if (!word.text || !word.sentiment || typeof word.intensity !== 'number') {
            return false;
        }
        
        if (!['positive', 'negative', 'neutral'].includes(word.sentiment)) {
            return false;
        }
        
        if (word.intensity < 0 || word.intensity > 1) {
            return false;
        }
        
        if (word.specialType && !['ACTION', 'EMOTION', 'EMPHASIS', 'QUESTION', 'TRANSITION', 'SUPERLATIVE'].includes(word.specialType)) {
            return false;
        }
    }
    
    return true;
}

/**
 * 合并本地词典和AI分析结果
 */
export function mergeWithLexicon(
    aiResult: SentimentAnalysisResult,
    lexiconResult: Array<{
        text: string;
        sentiment: 'positive' | 'negative' | 'neutral';
        intensity: number;
        specialType?: string;
    }>
): SentimentAnalysisResult {
    // 创建词典映射
    const lexiconMap = new Map(lexiconResult.map(item => [item.text, item]));
    
    // 合并结果（优先使用词典数据，因为更准确）
    const mergedWords = aiResult.words.map(word => {
        const lexiconWord = lexiconMap.get(word.text);
        if (lexiconWord) {
            return {
                ...word,
                sentiment: lexiconWord.sentiment,
                intensity: lexiconWord.intensity,
                specialType: lexiconWord.specialType as any || word.specialType
            };
        }
        return word;
    });
    
    // 重新计算整体情感
    const positiveCount = mergedWords.filter(w => w.sentiment === 'positive').length;
    const negativeCount = mergedWords.filter(w => w.sentiment === 'negative').length;
    const avgIntensity = mergedWords.reduce((sum, w) => sum + w.intensity, 0) / mergedWords.length;
    
    let overallSentiment: 'positive' | 'negative' | 'neutral';
    if (positiveCount > negativeCount) {
        overallSentiment = 'positive';
    } else if (negativeCount > positiveCount) {
        overallSentiment = 'negative';
    } else {
        overallSentiment = 'neutral';
    }
    
    return {
        words: mergedWords,
        overallSentiment,
        overallIntensity: avgIntensity
    };
}