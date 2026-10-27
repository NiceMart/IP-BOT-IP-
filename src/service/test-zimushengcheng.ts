/**
 * 单元测试：ZimuShengcheng的各个组件
 */

import { LevenshteinMatcher } from '@/lib/algorithms/Levenshtein';
import { ASSGenerator } from '@/lib/subtitle/ASSGenerator';
import { DrawtextGenerator } from '@/lib/subtitle/DrawtextGenerator';

// 测试数据
const testUserText = "这是测试文案，包含关键词";
const testAsrSegments = [
  { text: "这是测试文案", start: 0, end: 2, words: [] },
  { text: "包含关键词", start: 2, end: 4, words: [] }
];

console.log('\n=== 测试1: Levenshtein文案修正 ===');
try {
  const corrected = LevenshteinMatcher.correctText(testUserText, testAsrSegments);
  console.log('成功: 文案修正成功');
  console.log('  修正后的段数:', corrected.length);
  corrected.forEach((seg: any, idx: number) => {
    console.log(`  [${idx}] "${seg.text}" (${seg.start}s - ${seg.end}s, 修正:${seg.corrected})`);
  });
} catch (error: any) {
  console.error('失败: 文案修正失败:', error.message);
}

console.log('\n=== 测试2: ASS颜色转换 ===');
try {
  const assColor = ASSGenerator.convertColorToASS('#FFFFFF', 1);
  console.log('成功: 颜色转换成功');
  console.log('  #FFFFFF(完全不透明) ->', assColor);

  const assColorTransparent = ASSGenerator.convertColorToASS('#000000', 0);
  console.log('  #000000(完全透明) ->', assColorTransparent);
} catch (error: any) {
  console.error('失败: 颜色转换失败:', error.message);
}

console.log('\n=== 测试3: ASS样式生成 ===');
try {
  const testStyle = {
    fontName: 'Microsoft YaHei Bold',
    fontSize: 48,
    fontColor: '#FFFFFF',
    outlineColor: '#000000',
    outlineWidth: 3,
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    shadowOffset: 2
  };

  const assStyleConfig = ASSGenerator.convertRenderStyleToASS('TestStyle', testStyle, 1080);
  console.log('成功: ASS样式生成成功');
  console.log('  样式名称:', assStyleConfig.name);
  console.log('  字体:', assStyleConfig.fontname);
  console.log('  大小:', assStyleConfig.fontsize);
} catch (error: any) {
  console.error('失败: ASS样式生成失败:', error.message);
}

console.log('\n=== 测试4: drawtext命令生成 ===');
try {
  const drawtextCmd = DrawtextGenerator.generateBasic({
    fontfile: 'C:/Windows/Fonts/msyhbd.ttc',
    text: '测试字幕',
    x: 960,
    y: 1000,
    fontsize: 48,
    fontcolor: '0xFFFFFF',
    borderw: 3,
    bordercolor: '0x000000',
    enable: 'between(t,0,2)'
  });

  console.log('成功: drawtext命令生成成功');
  console.log('  命令长度:', drawtextCmd.length);
} catch (error: any) {
  console.error('失败: drawtext命令生成失败:', error.message);
}

console.log('\n测试完成');
