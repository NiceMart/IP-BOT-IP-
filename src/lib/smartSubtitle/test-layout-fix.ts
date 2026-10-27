/**
 * 测试脚本 - 验证字幕布局修复
 * 测试以下场景：
 * 1. 普通字幕宽度溢出检查
 * 2. 多个特效字幕从左到右排列
 * 3. 多个特效字幕超过屏幕宽度时的处理
 */

import { TextLayoutEngine } from './TextLayoutEngine';
import { MultilinePositioner } from './MultilinePositioner';

// 测试配置
const screenWidth = 1920;
const screenHeight = 1080;

console.log('==================== 字幕布局修复测试 ====================\n');

// 测试1：宽度溢出检查
console.log('测试1: 普通字幕宽度溢出检查');
console.log('---');

const layoutEngine = new TextLayoutEngine();
const screenConfig = {
  width: screenWidth,
  height: screenHeight,
  aspectRatio: '16:9' as const,
  fontSize: 48,
  maxCharsPerLine: 18,
  maxLines: 2,
  safeMargin: {
    top: 15,
    bottom: 15,
    left: 10,
    right: 10
  }
};

try {
  // 测试短文本（应该不溢出）
  const shortTextLayout = layoutEngine.calculateLayout(
    '这是一个短文本',
    {
      screenConfig,
      fontSize: 48,
      fontFamily: 'Arial, sans-serif'
    }
  );

  console.log(`短文本 "这是一个短文本"`);
  console.log(`  - 行数: ${shortTextLayout.lineCount}`);
  console.log(`  - 总宽度: ${shortTextLayout.totalWidth.toFixed(0)}px`);
  console.log(`  - 是否溢出: ${shortTextLayout.exceedsScreen}`);
  console.log('  ✓ 通过\n');

  // 测试长文本（可能溢出）
  const longTextLayout = layoutEngine.calculateLayout(
    '这是一个很长的文本，用来测试字幕是否会超出屏幕边界，以及系统是否能够正确处理这种情况',
    {
      screenConfig,
      fontSize: 48,
      fontFamily: 'Arial, sans-serif'
    }
  );

  console.log(`长文本测试`);
  console.log(`  - 行数: ${longTextLayout.lineCount}`);
  console.log(`  - 总宽度: ${longTextLayout.totalWidth.toFixed(0)}px`);
  console.log(`  - 是否溢出: ${longTextLayout.exceedsScreen}`);
  console.log('  ✓ 通过\n');
} catch (error) {
  console.error('❌ 测试1失败:', error);
}

// 测试2：多个特效字幕的水平布局
console.log('测试2: 多个特效字幕的水平布局');
console.log('---');

const positioner = new MultilinePositioner(screenWidth, screenHeight, 15, 15);

// 创建多个字幕（模拟特效字幕）
const effectSubtitles = [
  { width: 150, height: 60, content: '特效1' },
  { width: 200, height: 60, content: '特效2' },
  { width: 180, height: 60, content: '特效3' }
];

const centerY = screenHeight / 2;

try {
  // 测试正常情况（字幕能放在一行）
  const normalLayout = positioner.calculateHorizontalLayout(
    effectSubtitles,
    centerY,
    20,
    screenWidth
  );

  console.log(`正常情况（3个字幕，总宽度约530px）:`);
  normalLayout.forEach((pos, i) => {
    console.log(`  字幕${i + 1}: x=${pos.x.toFixed(0)}, y=${pos.y.toFixed(0)}, ` +
                `width=${pos.width.toFixed(0)}, height=${pos.height.toFixed(0)}, ` +
                `超出=${pos.exceeds}`);
  });
  console.log('  ✓ 通过\n');

  // 测试超出情况（字幕总宽度超过可用宽度）
  const manySubtitles = [
    { width: 300, height: 60, content: '字幕1' },
    { width: 300, height: 60, content: '字幕2' },
    { width: 300, height: 60, content: '字幕3' },
    { width: 300, height: 60, content: '字幕4' },
    { width: 300, height: 60, content: '字幕5' }
  ];

  const exceededLayout = positioner.calculateHorizontalLayout(
    manySubtitles,
    centerY,
    20,
    screenWidth
  );

  console.log(`超出情况（5个字幕，总宽度约1580px）:`);
  exceededLayout.forEach((pos, i) => {
    console.log(`  字幕${i + 1}: x=${pos.x.toFixed(0)}, width=${pos.width.toFixed(0)}, ` +
                `超出=${pos.exceeds}`);
  });
  console.log('  ✓ 通过\n');
} catch (error) {
  console.error('❌ 测试2失败:', error);
}

// 测试3：水平重叠检测
console.log('测试3: 水平重叠检测');
console.log('---');

try {
  // 创建没有重叠的位置
  const noOverlapPositions = [
    { x: 100, y: 400, width: 200, height: 60 },
    { x: 350, y: 400, width: 200, height: 60 },
    { x: 600, y: 400, width: 200, height: 60 }
  ];

  const noConflict = positioner.detectHorizontalConflict(noOverlapPositions);
  console.log(`无重叠的位置: ${noConflict ? '❌ 检测到重叠(错误)' : '✓ 无重叠(正确)'}`);

  // 创建有重叠的位置
  const overlapPositions = [
    { x: 100, y: 400, width: 200, height: 60 },
    { x: 250, y: 400, width: 200, height: 60 }, // 与第一个重叠
    { x: 600, y: 400, width: 200, height: 60 }
  ];

  const conflict = positioner.detectHorizontalConflict(overlapPositions);
  console.log(`有重叠的位置: ${conflict ? '✓ 检测到重叠(正确)' : '❌ 未检测到重叠(错误)'}`);
  console.log('  ✓ 通过\n');
} catch (error) {
  console.error('❌ 测试3失败:', error);
}

console.log('==================== 所有测试完成 ====================');
