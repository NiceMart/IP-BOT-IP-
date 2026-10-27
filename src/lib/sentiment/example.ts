// 情感字幕系统 - 快速开始示例

import { SentimentAnalyzer } from './SentimentAnalyzer';
import { EffectGenerator, TimeFormatter } from './EffectGenerator';
import type { SentimentAnalysisResult } from './prompts';

/**
 * 示例1：基础使用 - 分析单个句子
 */
export async function example1_BasicAnalysis() {
    console.log('=== 示例1：基础情感分析 ===');
    
    // 创建分析器
    const analyzer = new SentimentAnalyzer({
        useAI: true,
        providerId: 'zhipu',
        modelId: 'glm-4-flash',
        fallbackToLexicon: true
    });

    // 分析句子
    const text = '这个产品真的太棒了！';
    const result = await analyzer.analyze(text);

    console.log('输入文本:', text);
    console.log('分析结果:', JSON.stringify(result, null, 2));
    console.log('整体情感:', result.overallSentiment);
    console.log('情感强度:', result.overallIntensity);
    
    return result;
}

/**
 * 示例2：生成ASS字幕
 */
export async function example2_GenerateSubtitle() {
    console.log('\n=== 示例2：生成ASS字幕 ===');
    
    const analyzer = new SentimentAnalyzer();
    const effectGen = new EffectGenerator();

    // 分析文本
    const text = '这个产品真的太棒了！';
    const result = await analyzer.analyze(text);

    // 生成字幕行
    const subtitleLine = effectGen.generateSubtitleLine(
        result,
        '0:00:01.00',
        '0:00:03.00',
        'Default'
    );

    console.log('字幕行:', subtitleLine);
    
    return subtitleLine;
}

/**
 * 示例3：完整ASS文件生成
 */
export async function example3_GenerateASSFile() {
    console.log('\n=== 示例3：生成完整ASS文件 ===');
    
    const analyzer = new SentimentAnalyzer();
    const effectGen = new EffectGenerator();

    // 模拟多个句子
    const sentences = [
        { text: '大家好，欢迎观看本期视频', start: 1.0, end: 3.5 },
        { text: '今天给大家带来一个超级棒的产品', start: 3.5, end: 6.0 },
        { text: '但是价格有点贵', start: 6.0, end: 7.5 },
        { text: '总体来说还是非常值得购买的', start: 7.5, end: 10.0 }
    ];

    // 生成ASS文件头部
    let assContent = effectGen.generateASSHeader(1920, 1080);

    // 分析并生成每个句子的字幕
    for (const sentence of sentences) {
        const result = await analyzer.analyze(sentence.text);
        const startTime = TimeFormatter.secondsToASS(sentence.start);
        const endTime = TimeFormatter.secondsToASS(sentence.end);
        const line = effectGen.generateSubtitleLine(result, startTime, endTime);
        assContent += line + '\n';
    }

    console.log('ASS文件内容:');
    console.log(assContent);
    
    return assContent;
}

/**
 * 示例4：批量分析
 */
export async function example4_BatchAnalysis() {
    console.log('\n=== 示例4：批量分析 ===');
    
    const analyzer = new SentimentAnalyzer();

    const texts = [
        '这个产品真的太棒了',
        '质量很差，不推荐购买',
        '价格适中，性价比不错',
        '非常满意，强烈推荐'
    ];

    const results = await analyzer.analyzeBatch(texts);

    results.forEach((result, index) => {
        console.log(`\n句子${index + 1}: ${texts[index]}`);
        console.log(`情感: ${result.overallSentiment}`);
        console.log(`强度: ${result.overallIntensity.toFixed(2)}`);
        console.log(`词语数: ${result.words.length}`);
    });

    return results;
}

/**
 * 示例5：自定义配置
 */
export async function example5_CustomConfig() {
    console.log('\n=== 示例5：自定义配置 ===');
    
    // 自定义颜色配置
    const effectGen = new EffectGenerator({
        colors: {
            positive: '&H00FF00&',    // 绿色
            negative: '&HFF0000&',    // 蓝色改为纯红色
            neutral: '&HCCCCCC&',     // 灰色
            emphasis: '&HFFFF00&',    // 纯黄色
            action: '&HFF8800&',      // 橙色
            emotion: '&HFF00FF&'      // 粉色
        },
        intensity: {
            minScale: 1.0,
            maxScale: 1.5,            // 更大的缩放
            minAlpha: 0,
            maxAlpha: 255,
            minBlur: 0,
            maxBlur: 3                // 更强的模糊
        },
        enableGlow: true,
        enableAnimation: true,
        animationDuration: 500        // 更长的动画时间
    });

    const analyzer = new SentimentAnalyzer();
    const result = await analyzer.analyze('这真是太棒了！');
    const line = effectGen.generateSubtitleLine(result, '0:00:01.00', '0:00:03.00');

    console.log('自定义配置的字幕:', line);
    
    return line;
}

/**
 * 示例6：仅使用本地词典（不调用AI）
 */
export async function example6_LexiconOnly() {
    console.log('\n=== 示例6：仅使用本地词典 ===');
    
    const analyzer = new SentimentAnalyzer({
        useAI: false,  // 关闭AI
        fallbackToLexicon: true
    });

    const text = '这个产品非常好，质量优秀，价格合理';
    const result = await analyzer.analyze(text, 'lexicon-only');

    console.log('输入:', text);
    console.log('结果:', JSON.stringify(result, null, 2));
    
    return result;
}

/**
 * 示例7：混合模式（AI + 词典）
 */
export async function example7_HybridMode() {
    console.log('\n=== 示例7：混合模式 ===');
    
    const analyzer = new SentimentAnalyzer({
        useAI: true,
        fallbackToLexicon: true
    });

    const text = '虽然价格有点贵，但是质量真的很好';
    const result = await analyzer.analyze(text, 'hybrid');

    console.log('输入:', text);
    console.log('混合模式结果:');
    result.words.forEach(word => {
        console.log(`  ${word.text}: ${word.sentiment} (${word.intensity.toFixed(2)}) ${word.specialType || ''}`);
    });
    
    return result;
}

/**
 * 示例8：缓存管理
 */
export async function example8_CacheManagement() {
    console.log('\n=== 示例8：缓存管理 ===');
    
    const analyzer = new SentimentAnalyzer({
        cacheResults: true
    });

    // 第一次分析（会调用AI）
    console.log('第一次分析...');
    const start1 = Date.now();
    await analyzer.analyze('这个产品真的太棒了');
    const time1 = Date.now() - start1;
    console.log(`耗时: ${time1}ms`);

    // 第二次分析相同文本（从缓存读取）
    console.log('\n第二次分析相同文本...');
    const start2 = Date.now();
    await analyzer.analyze('这个产品真的太棒了');
    const time2 = Date.now() - start2;
    console.log(`耗时: ${time2}ms`);

    // 查看缓存统计
    const stats = analyzer.getCacheStats();
    console.log('\n缓存统计:', stats);

    // 清除缓存
    analyzer.clearCache();
    console.log('缓存已清除');
}

/**
 * 示例9：预热缓存
 */
export async function example9_WarmupCache() {
    console.log('\n=== 示例9：预热缓存 ===');
    
    const analyzer = new SentimentAnalyzer();

    // 常用语句
    const commonPhrases = [
        '大家好',
        '欢迎观看',
        '感谢支持',
        '点赞关注',
        '下期再见'
    ];

    // 预热缓存
    await analyzer.warmupCache(commonPhrases);

    // 现在使用这些短语会很快
    const result = await analyzer.analyze('大家好');
    console.log('预热后的分析结果:', result.overallSentiment);
}

/**
 * 示例10：完整工作流程（模拟真实场景）
 */
export async function example10_CompleteWorkflow() {
    console.log('\n=== 示例10：完整工作流程 ===');
    
    // 1. 初始化
    const analyzer = new SentimentAnalyzer({
        useAI: true,
        providerId: 'zhipu',
        modelId: 'glm-4-flash',
        fallbackToLexicon: true,
        cacheResults: true
    });

    const effectGen = new EffectGenerator({
        enableGlow: true,
        enableAnimation: true
    });

    // 2. 模拟ASR识别结果
    const asrResult = {
        sentences: [
            {
                text: '大家好，我是主播小明',
                words: [
                    { word: '大家好', start: 0.5, end: 1.2 },
                    { word: '我是', start: 1.2, end: 1.5 },
                    { word: '主播', start: 1.5, end: 1.9 },
                    { word: '小明', start: 1.9, end: 2.3 }
                ]
            },
            {
                text: '今天给大家带来一个超级棒的产品',
                words: [
                    { word: '今天', start: 2.5, end: 2.9 },
                    { word: '给', start: 2.9, end: 3.0 },
                    { word: '大家', start: 3.0, end: 3.3 },
                    { word: '带来', start: 3.3, end: 3.7 },
                    { word: '一个', start: 3.7, end: 3.9 },
                    { word: '超级', start: 3.9, end: 4.3 },
                    { word: '棒', start: 4.3, end: 4.6 },
                    { word: '的', start: 4.6, end: 4.7 },
                    { word: '产品', start: 4.7, end: 5.2 }
                ]
            }
        ]
    };

    // 3. 生成ASS文件
    let assContent = effectGen.generateASSHeader(1920, 1080);

    for (const sentence of asrResult.sentences) {
        // 情感分析
        const analysis = await analyzer.analyze(sentence.text);
        
        // 时间转换
        const startTime = TimeFormatter.secondsToASS(sentence.words[0].start);
        const endTime = TimeFormatter.secondsToASS(sentence.words[sentence.words.length - 1].end);
        
        // 生成字幕行
        const line = effectGen.generateSubtitleLine(analysis, startTime, endTime);
        assContent += line + '\n';
        
        console.log(`\n句子: ${sentence.text}`);
        console.log(`时间: ${startTime} -> ${endTime}`);
        console.log(`情感: ${analysis.overallSentiment} (${analysis.overallIntensity.toFixed(2)})`);
    }

    console.log('\n=== 生成的ASS文件 ===');
    console.log(assContent);

    return assContent;
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   情感字幕系统 - 示例演示              ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        await example1_BasicAnalysis();
        await example2_GenerateSubtitle();
        await example3_GenerateASSFile();
        await example4_BatchAnalysis();
        await example5_CustomConfig();
        await example6_LexiconOnly();
        await example7_HybridMode();
        await example8_CacheManagement();
        await example9_WarmupCache();
        await example10_CompleteWorkflow();

        console.log('\n✅ 所有示例运行完成！');
    } catch (error) {
        console.error('\n❌ 示例运行出错:', error);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    runAllExamples().then(() => {
        console.log('\n程序结束');
        process.exit(0);
    });
}