// Web Worker: 文字布局计算
interface TextLayoutConfig {
  text: string;
  fontSize: number;
  fontFamily: string;
  maxWidth: number;
  maxHeight: number;
  direction: 'horizontal' | 'vertical';
  charSpacing: number;
  lineSpacing: number;
}

interface TextLayoutResult {
  lines: Array<{
    text: string;
    width: number;
    height: number;
    x: number;
    y: number;
  }>;
  totalWidth: number;
  totalHeight: number;
  charCount: number;
  lineCount: number;
}

// 文字测量（近似）
function measureText(text: string, fontSize: number, fontFamily: string): { width: number; height: number } {
  // 这是一个简化的测量，实际应用中可能需要更精确的计算
  const avgCharWidth = fontSize * 0.6; // 平均字符宽度
  const charHeight = fontSize * 1.2; // 字符高度

  return {
    width: text.length * avgCharWidth,
    height: charHeight
  };
}

// 计算文字布局
self.addEventListener('message', (event: MessageEvent<TextLayoutConfig>) => {
  const config = event.data;
  const result = calculateTextLayout(config);

  // 发送结果回主线程
  self.postMessage(result);
});

function calculateTextLayout(config: TextLayoutConfig): TextLayoutResult {
  const {
    text,
    fontSize,
    fontFamily,
    maxWidth,
    maxHeight,
    direction,
    charSpacing,
    lineSpacing
  } = config;

  const lines: TextLayoutResult['lines'] = [];
  let currentX = 0;
  let currentY = 0;
  let totalWidth = 0;
  let totalHeight = 0;

  if (direction === 'horizontal') {
    // 横向布局
    const chars = text.split('');
    let currentLine = '';
    let currentLineWidth = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const charWidth = fontSize * 0.6 + charSpacing;

      if (currentLineWidth + charWidth > maxWidth && currentLine.length > 0) {
        // 保存当前行
        const measure = measureText(currentLine, fontSize, fontFamily);
        lines.push({
          text: currentLine,
          width: measure.width,
          height: measure.height,
          x: 0,
          y: currentY
        });

        totalWidth = Math.max(totalWidth, measure.width);
        currentY += measure.height + lineSpacing;
        totalHeight = currentY;

        // 开始新行
        currentLine = char;
        currentLineWidth = charWidth;
      } else {
        currentLine += char;
        currentLineWidth += charWidth;
      }
    }

    // 保存最后一行
    if (currentLine.length > 0) {
      const measure = measureText(currentLine, fontSize, fontFamily);
      lines.push({
        text: currentLine,
        width: measure.width,
        height: measure.height,
        x: 0,
        y: currentY
      });
      totalWidth = Math.max(totalWidth, measure.width);
      totalHeight = currentY + measure.height;
    }
  } else {
    // 竖向布局
    const chars = text.split('');
    let currentColumn = '';
    let currentColumnHeight = 0;
    let columnX = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const charHeight = fontSize * 1.2 + charSpacing;

      if (currentColumnHeight + charHeight > maxHeight && currentColumn.length > 0) {
        // 保存当前列
        const measure = measureText(currentColumn, fontSize, fontFamily);
        lines.push({
          text: currentColumn,
          width: measure.width,
          height: measure.height,
          x: columnX,
          y: 0
        });

        totalHeight = Math.max(totalHeight, measure.height);
        columnX += measure.width + lineSpacing;
        totalWidth = columnX;

        // 开始新列
        currentColumn = char;
        currentColumnHeight = charHeight;
      } else {
        currentColumn += char;
        currentColumnHeight += charHeight;
      }
    }

    // 保存最后一列
    if (currentColumn.length > 0) {
      const measure = measureText(currentColumn, fontSize, fontFamily);
      lines.push({
        text: currentColumn,
        width: measure.width,
        height: measure.height,
        x: columnX,
        y: 0
      });
      totalHeight = Math.max(totalHeight, measure.height);
      totalWidth = columnX + measure.width;
    }
  }

  return {
    lines,
    totalWidth,
    totalHeight,
    charCount: text.length,
    lineCount: lines.length
  };
}

// 导出类型供外部使用
export type { TextLayoutConfig, TextLayoutResult };