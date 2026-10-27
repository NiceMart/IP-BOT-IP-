/**
 * 智能字幕系统 - 完整使用示例
 * 演示如何在VideoIPAgent中集成和使用所有功能
 */

import { subtitleProcessor } from '@/lib/smartSubtitle/SubtitleProcessor';
import {
  processSmartSubtitle,
  processSmartSubtitleQuick,
  getRecommendedConfig,
  validateResult,
  generateSubtitleSummary,
  generateStatisticsReport
} from '@/service/SmartSubtitleService';
import type { SubtitleProcessConfig, ProcessedSubtitle } from '@/types/smartSubtitle';

// ===== 使用示例 1: 基础处理流程 =====
async function example1_BasicProcessing() {
  console.log('=== 示例 1: 基础处理流程 ===\n');

  const text = '这是一个出类拔萃的，令人惊喜的表演';

  const config: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    readabilityFactor: 1.0,
    enableEffects: true,
    enableAI: true,
    subtitlePosition: 'bottom',
    subtitleAlignment: 'center'
  };

  try {
    // 处理字幕
    const result = await processSmartSubtitle(text, config);

    // 输出摘要
    const summary = generateSubtitleSummary(result);
    console.log('处理结果摘要:', summary);

    // 验证结果
    const validation = validateResult(result);
    console.log('验证结果:', validation.valid ? '✓ 有效' : '✗ 无效');
    if (!validation.valid) {
      validation.issues.forEach(issue => console.log('  - ' + issue));
    }

    // 输出详细报告
    console.log('\n' + generateStatisticsReport(result));

    return result;
  } catch (error) {
    console.error('处理失败:', error);
  }
}

// ===== 使用示例 2: 快速处理（无AI分类） =====
async function example2_QuickProcessing() {
  console.log('\n=== 示例 2: 快速处理（无AI分类） ===\n');

  const text = '这是一个简单的字幕文本';

  const config: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif'
  };

  try {
    const result = processSmartSubtitleQuick(text, config);

    console.log('快速处理耗时:', result.processingTime.toFixed(2), 'ms');
    console.log('排版行数:', result.layout.lineCount);
    console.log('分批数量:', result.batches.length);

    return result;
  } catch (error) {
    console.error('快速处理失败:', error);
  }
}

// ===== 使用示例 3: 不同屏幕尺寸 =====
async function example3_DifferentScreenSizes() {
  console.log('\n=== 示例 3: 不同屏幕尺寸自适配 ===\n');

  const text = '屏幕适配测试文本';

  const screenSizes = [
    { name: 'Full HD', width: 1920, height: 1080 },
    { name: 'Ultrawide', width: 3440, height: 1440 },
    { name: 'Standard', width: 1024, height: 768 }
  ];

  for (const screen of screenSizes) {
    console.log(`\n处理屏幕: ${screen.name} (${screen.width}x${screen.height})`);

    // 获取推荐配置
    const config = getRecommendedConfig(screen.width, screen.height);

    console.log('推荐配置:');
    console.log('  字体大小:', config.fontSize);
    console.log('  每行字数:', config.maxCharsPerLine);
    console.log('  最多行数:', config.maxLines);

    // 处理字幕
    const result = processSmartSubtitleQuick(text, config);
    console.log('排版结果: ' + result.layout.lineCount + ' 行');
  }
}

// ===== 使用示例 4: 调整可读性因子 =====
async function example4_ReadabilityFactor() {
  console.log('\n=== 示例 4: 可读性因子调整 ===\n');

  const text = '这是一个中等长度的字幕文本，用来演示可读性因子的影响';

  const baseConfig: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    enableAI: false
  };

  const factors = [0.5, 1.0, 2.0]; // 快速、正常、慢速

  for (const factor of factors) {
    console.log(`\n可读性因子: ${factor}x`);

    const config = { ...baseConfig, readabilityFactor: factor };
    const result = processSmartSubtitleQuick(text, config);

    console.log('分批数:', result.batches.length);
    console.log('总时长:', result.totalDuration, 'ms');

    if (result.batches.length > 0) {
      const avgDuration = result.batches.reduce((sum, b) => sum + b.duration, 0) / result.batches.length;
      console.log('平均批次时长:', avgDuration.toFixed(0), 'ms');
    }
  }
}

// ===== 使用示例 5: 关键词保护 =====
async function example5_KeywordProtection() {
  console.log('\n=== 示例 5: 关键词保护 ===\n');

  const text = '人工智能和机器学习正在改变世界';

  const config: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    enableAI: false
  };

  // 添加自定义关键词
  const { textLayoutEngine } = require('@/lib/smartSubtitle/TextLayoutEngine');
  textLayoutEngine.addKeywords(['人工智能', '机器学习', '深度学习']);

  const result = processSmartSubtitleQuick(text, config);

  console.log('文本:', text);
  console.log('排版结果:');
  result.layout.lines.forEach((line, idx) => {
    console.log(`  行${idx + 1}: ${line.text}`);
  });

  // 输出摘要
  console.log('\n' + generateSubtitleSummary(result));
}

// ===== 使用示例 6: 错误处理和验证 =====
async function example6_ErrorHandling() {
  console.log('\n=== 示例 6: 错误处理和验证 ===\n');

  // 测试1: 空文本
  console.log('测试1: 空文本');
  try {
    const config: SubtitleProcessConfig = {
      screenWidth: 1920,
      screenHeight: 1080,
      fontSize: 48,
      fontFamily: 'Arial, sans-serif'
    };
    const result = processSmartSubtitleQuick('', config);
    console.log('✗ 应该抛出错误但没有');
  } catch (error) {
    console.log('✓ 正确捕获错误:', (error as Error).message);
  }

  // 测试2: 无效的屏幕尺寸
  console.log('\n测试2: 无效的屏幕尺寸');
  try {
    const config: SubtitleProcessConfig = {
      screenWidth: 0,
      screenHeight: 1080,
      fontSize: 48,
      fontFamily: 'Arial, sans-serif'
    };
    const result = processSmartSubtitleQuick('测试', config);
    const validation = validateResult(result);
    if (!validation.valid) {
      console.log('✓ 验证失败，错误:');
      validation.issues.forEach(issue => console.log('  -', issue));
    }
  } catch (error) {
    console.log('✓ 捕获错误:', (error as Error).message);
  }
}

// ===== 使用示例 7: 词汇分类和特效推荐 =====
async function example7_VocabularyClassificationAndEffects() {
  console.log('\n=== 示例 7: 词汇分类和特效推荐 ===\n');

  const text = '这个产品真的太棒了，我非常喜欢它!';

  const config: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    enableEffects: true,
    enableAI: true
  };

  try {
    const result = await processSmartSubtitle(text, config);

    // 显示分类结果
    console.log('词汇分类结果:');
    result.classification.words.forEach(word => {
      if (word.category !== 'neutral') {
        console.log(`  "${word.text}" -> ${word.category} (置信度: ${(word.confidence * 100).toFixed(0)}%)`);
      }
    });

    // 显示特效分配
    console.log('\n特效推荐:');
    result.effectAssignments.slice(0, 5).forEach(assignment => {
      console.log(`  "${assignment.word.text}"`);
      assignment.selectedEffects.forEach(effect => {
        console.log(`    -> ${effect.type} (时长: ${effect.duration}ms)`);
      });
    });

    // 显示动画冲突
    if (result.animationTimeline.conflicts.length > 0) {
      console.log('\n动画冲突:');
      result.animationTimeline.conflicts.forEach(conflict => {
        console.log(`  ${conflict.type}: ${conflict.description}`);
      });
    } else {
      console.log('\n✓ 无动画冲突');
    }
  } catch (error) {
    console.error('处理失败:', error);
  }
}

// ===== 使用示例 8: 批量处理 =====
async function example8_BatchProcessing() {
  console.log('\n=== 示例 8: 批量处理 ===\n');

  const texts = [
    '第一个字幕',
    '这是第二个字幕，内容比较长',
    '第三个很长很长很长的字幕文本，用来演示长文本的处理'
  ];

  const config: SubtitleProcessConfig = {
    screenWidth: 1920,
    screenHeight: 1080,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif',
    enableAI: false
  };

  console.log('批量处理' + texts.length + '个字幕...\n');

  const results: ProcessedSubtitle[] = [];

  for (let i = 0; i < texts.length; i++) {
    const result = processSmartSubtitleQuick(texts[i], config);
    results.push(result);

    console.log(`字幕${i + 1}: ${texts[i]}`);
    console.log(`  排版行数: ${result.layout.lineCount}`);
    console.log(`  分批数: ${result.batches.length}`);
    console.log(`  总时长: ${result.totalDuration}ms`);
  }

  // 统计汇总
  console.log('\n统计汇总:');
  console.log('  总字幕数:', results.length);
  console.log('  总排版行数:', results.reduce((sum, r) => sum + r.layout.lineCount, 0));
  console.log('  总分批数:', results.reduce((sum, r) => sum + r.batches.length, 0));
  console.log('  平均耗时:', (results.reduce((sum, r) => sum + r.processingTime, 0) / results.length).toFixed(2), 'ms');
}

// ===== 运行所有示例 =====
export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     智能字幕系统 - 完整使用示例演示                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    await example1_BasicProcessing();
    await example2_QuickProcessing();
    await example3_DifferentScreenSizes();
    await example4_ReadabilityFactor();
    await example5_KeywordProtection();
    await example6_ErrorHandling();
    await example7_VocabularyClassificationAndEffects();
    await example8_BatchProcessing();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              所有示例执行完毕！                         ║');
    console.log('╚════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('执行示例出错:', error);
  }
}

// 如果直接运行此文件，执行所有示例
if (import.meta.hot) {
  runAllExamples();
}
