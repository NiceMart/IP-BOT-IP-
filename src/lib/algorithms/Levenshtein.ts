/**
 * Levenshtein距离算法
 * 用于文案对比和错别字修正
 */

import type {
  FunasrSegment,
  CorrectedSegment,
  MatchResult,
  Alignment
} from '@/service/ZimuShengcheng.types';

export class LevenshteinMatcher {
  private static readonly DEFAULT_CHAR_DURATION_MS = 150;

  private static readonly TIME_GAP_SPLIT_THRESHOLD_MS = 500;

  /**
   * 计算两个字符串之间的Levenshtein距离（编辑距离）
   * @param s1 字符串1
   * @param s2 字符串2
   * @returns 编辑距离
   */
  static distance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // 创建距离矩阵
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // 动态规划计算
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,           // 删除
          dp[i][j - 1] + 1,           // 插入
          dp[i - 1][j - 1] + cost     // 替换
        );
      }
    }

    return dp[m][n];
  }

  /**
   * 计算相似度（0-1之间）
   * @param s1 字符串1
   * @param s2 字符串2
   * @returns 相似度
   */
  static similarity(s1: string, s2: string): number {
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const dist = this.distance(s1, s2);
    return 1 - (dist / maxLen);
  }

  /**
   * 找到最佳匹配位置和对齐方式
   * @param userText 用户输入的文本
   * @param asrText ASR识别的文本
   * @returns 匹配结果
   */
  static findBestMatch(userText: string, asrText: string): MatchResult {
    const m = userText.length;
    const n = asrText.length;

    // 构建距离矩阵
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // 构建回溯路径矩阵
    const path: string[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(''));

    // 初始化
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
      path[i][0] = 'delete';
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
      path[0][j] = 'insert';
    }

    // 动态规划填表
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = userText[i - 1] === asrText[j - 1] ? 0 : 1;

        const deleteOp = dp[i - 1][j] + 1;
        const insertOp = dp[i][j - 1] + 1;
        const replaceOp = dp[i - 1][j - 1] + cost;

        const minOp = Math.min(deleteOp, insertOp, replaceOp);
        dp[i][j] = minOp;

        if (minOp === deleteOp) {
          path[i][j] = 'delete';
        } else if (minOp === insertOp) {
          path[i][j] = 'insert';
        } else if (cost === 0) {
          path[i][j] = 'match';
        } else {
          path[i][j] = 'replace';
        }
      }
    }

    // 回溯获取对齐结果
    const alignments = this.backtrace(userText, asrText, dp, path);
    const distance = dp[m][n];
    const similarity = 1 - (distance / Math.max(m, n));

    return {
      alignments,
      distance,
      similarity
    };
  }

  /**
   * 回溯算法，获取字符对齐序列
   * @private
   */
  private static backtrace(
    userText: string,
    asrText: string,
    dp: number[][],
    path: string[][]
  ): Alignment[] {
    const alignments: Alignment[] = [];
    let i = userText.length;
    let j = asrText.length;

    while (i > 0 || j > 0) {
      const operation = path[i][j];

      if (operation === 'match') {
        alignments.unshift({
          userChar: userText[i - 1],
          asrChar: asrText[j - 1],
          operation: 'match',
          userIndex: i - 1,
          asrIndex: j - 1
        });
        i--;
        j--;
      } else if (operation === 'replace') {
        alignments.unshift({
          userChar: userText[i - 1],
          asrChar: asrText[j - 1],
          operation: 'replace',
          userIndex: i - 1,
          asrIndex: j - 1
        });
        i--;
        j--;
      } else if (operation === 'delete') {
        alignments.unshift({
          userChar: userText[i - 1],
          asrChar: '',
          operation: 'delete',
          userIndex: i - 1,
          asrIndex: j
        });
        i--;
      } else if (operation === 'insert') {
        alignments.unshift({
          userChar: '',
          asrChar: asrText[j - 1],
          operation: 'insert',
          userIndex: i,
          asrIndex: j - 1
        });
        j--;
      }
    }

    return alignments;
  }

  /**
   * 修正ASR识别结果，替换为用户输入的正确文案
   * @param userText 用户输入的正确文案
   * @param asrSegments ASR识别的分段结果（带时间戳）
   * @returns 修正后的分段结果
   */
  static correctText(
    userText: string,
    asrSegments: FunasrSegment[]
  ): CorrectedSegment[] {
    // 1. 拼接所有ASR文本
    const asrFullText = asrSegments.map(seg => seg.text).join('');

    // 2. 找到最佳匹配和对齐
    const matchResult = this.findBestMatch(userText, asrFullText);

    console.log('[Levenshtein] 文案对比结果:', {
      userText,
      asrFullText,
      distance: matchResult.distance,
      similarity: matchResult.similarity,
      alignments: matchResult.alignments.length
    });

    // 3. 构建字符到时间戳的映射
    const asrCharTimeMap = this.buildCharTimeMap(asrSegments);

    // 4. 根据对齐结果，将修正后的文本映射到时间戳
    const correctedSegments = this.mapToTimestamps(
      matchResult.alignments,
      asrSegments,
      asrCharTimeMap,
      userText
    );

    return correctedSegments;
  }

  /**
   * 构建ASR字符到时间戳的映射
   * @private
   */
  private static buildCharTimeMap(
    asrSegments: FunasrSegment[]
  ): Map<number, { start: number; end: number; segment: FunasrSegment }> {
    const map = new Map();
    let charIndex = 0;

    for (const segment of asrSegments) {
      const charTimings = this.buildSegmentCharTimings(segment);

      for (const timing of charTimings) {
        map.set(charIndex, { ...timing, segment });
        charIndex++;
      }
    }

    return map;
  }

  private static buildSegmentCharTimings(
    segment: FunasrSegment
  ): Array<{ start: number; end: number }> {
    const text = segment.text || '';
    const segmentLength = text.length;
    if (segmentLength === 0) {
      return [];
    }

    const fallbackCharDuration = (segment.end - segment.start) / Math.max(segmentLength, 1);
    const fallbackTimings = Array.from({ length: segmentLength }, (_, index) => ({
      start: segment.start + index * fallbackCharDuration,
      end: segment.start + (index + 1) * fallbackCharDuration
    }));

    const words = Array.isArray(segment.words) ? segment.words : [];
    if (words.length === 0) {
      return fallbackTimings;
    }

    const preciseTimings: Array<{ start: number; end: number } | null> = Array(segmentLength).fill(null);
    let searchStart = 0;

    for (const word of words) {
      const wordText = String(word?.word ?? '');
      const wordStart = Number(word?.start);
      const wordEnd = Number(word?.end);
      if (!wordText || !Number.isFinite(wordStart) || !Number.isFinite(wordEnd) || wordEnd <= wordStart) {
        continue;
      }

      const wordIndex = text.indexOf(wordText, searchStart);
      if (wordIndex === -1) {
        continue;
      }

      const wordCharDuration = (wordEnd - wordStart) / Math.max(wordText.length, 1);
      for (let i = 0; i < wordText.length && wordIndex + i < preciseTimings.length; i++) {
        preciseTimings[wordIndex + i] = {
          start: wordStart + i * wordCharDuration,
          end: wordStart + (i + 1) * wordCharDuration
        };
      }

      searchStart = wordIndex + wordText.length;
    }

    return preciseTimings.map((timing, index) => timing || fallbackTimings[index]);
  }

  /**
   * 将对齐结果映射到时间戳
   * @private
   */
  private static mapToTimestamps(
    alignments: Alignment[],
    asrSegments: FunasrSegment[],
    charTimeMap: Map<number, any>,
    userText: string
  ): CorrectedSegment[] {
    const correctedSegments: CorrectedSegment[] = [];
    let currentText = '';
    let currentOriginalText = '';
    let startTime = 0;
    let endTime = 0;
    let corrected = false;
    let firstChar = true;
    let currentCharTimings: Array<{ start: number; end: number }> = [];

    // 🔧 默认单字时长（毫秒），用于推算缺失时间
    const DEFAULT_CHAR_DURATION = this.DEFAULT_CHAR_DURATION_MS;

    for (let i = 0; i < alignments.length; i++) {
      const align = alignments[i];

      // 获取时间信息
      let charTime = null;
      if (align.asrIndex !== -1 && charTimeMap.has(align.asrIndex)) {
        charTime = charTimeMap.get(align.asrIndex);
      }

      // 🔧 关键修复：先判断是否是标点符号
      const isPunctuation = align.userChar && /[，。！？、；：\u201C\u201D\"「」『』（）【】《》,.!?;:\'\"]/.test(align.userChar);

      // 累积文本（跳过标点符号）
      if (align.operation === 'match' || align.operation === 'replace') {
        // useChar来自用户输入，asrChar来自ASR结果
        if (!isPunctuation) {
          currentText += align.userChar;
          currentOriginalText += align.asrChar;
          if (charTime) {
            currentCharTimings.push({
              start: charTime.start,
              end: charTime.end
            });
          }
        }

        if (align.operation === 'replace') {
          corrected = true;
        }

        if (charTime) {
          if (firstChar) {
            startTime = charTime.start;
            firstChar = false;
          }
          endTime = charTime.end;
        }
      } else if (align.operation === 'insert') {
        // ASR多识别了字符（用户文本里没有），只更新时间，不添加文本
        if (charTime) {
          if (firstChar) {
            startTime = charTime.start;
            firstChar = false;
          }
          endTime = charTime.end;
        }
      } else if (align.operation === 'delete') {
        // 用户文本有但ASR没识别到（ASR缺失）
        // 🔧 关键修复：这种情况下需要保留用户文本，并手动推算时间

        if (!isPunctuation) {
          currentText += align.userChar;
          const syntheticStart = firstChar ? startTime : endTime;

          // 如果这里没有对应的时间（因为ASR没识别到），我们需要"撑开"时间
          // 如果还没开始计时（即该句开头就缺失），使用上一个结束时间作为开始
          if (firstChar) {
            // 如果是第一句第一个字就缺失，startTime默认为0或沿用上一个
            // 这里维持原状，startTime在初始化时为0或上一句end
            startTime = syntheticStart;
            firstChar = false;
          }

          // 增加推算时间，避免所有缺失文字挤在同一个时间点
          // 只有在没有有效 charTime 的情况下才手动增加
          if (!charTime) {
            endTime = syntheticStart + DEFAULT_CHAR_DURATION;
            currentCharTimings.push({
              start: syntheticStart,
              end: endTime
            });
          }
        }
        corrected = true;
      }

      // 判断是否需要切分段落（遇到标点或时间间隔较大）
      const isEnd = i === alignments.length - 1;
      const nextTimeGap = i < alignments.length - 1 &&
        charTime &&
        charTimeMap.has(alignments[i + 1].asrIndex) &&
        (charTimeMap.get(alignments[i + 1].asrIndex).start - endTime) > this.TIME_GAP_SPLIT_THRESHOLD_MS;

      if ((isEnd || isPunctuation || nextTimeGap) && currentText.length > 0) {
        // 🔧 确保至少有一定的持续时间
        if (endTime <= startTime) {
          endTime = startTime + (currentText.length * DEFAULT_CHAR_DURATION);
        }

        correctedSegments.push({
          text: currentText,
          originalText: currentOriginalText,
          start: startTime,
          end: endTime,
          corrected,
          confidence: corrected ? 0.8 : 1.0,
          charTimings: currentCharTimings
        });

        // 重置，为下一句做准备
        // 下一句的开始时间默认接在这个结束之后（如果后续有真实时间会覆盖）
        startTime = endTime;
        currentText = '';
        currentOriginalText = '';
        corrected = false;
        firstChar = true;
        currentCharTimings = [];
      }
    }

    // 处理剩余文本（防止漏掉最后一段没有标点的情况）
    if (currentText.length > 0) {
      // 🔧 确保时间正确
      if (endTime <= startTime) {
        endTime = startTime + (currentText.length * DEFAULT_CHAR_DURATION);
      }

      correctedSegments.push({
        text: currentText,
        originalText: currentOriginalText,
        start: startTime,
        end: endTime,
        corrected,
        confidence: corrected ? 0.8 : 1.0,
        charTimings: currentCharTimings
      });
    }

    console.log('[Levenshtein] 修正后的段落:', correctedSegments.length, '段');

    return correctedSegments;
  }

  /**
   * 批量相似度检测
   * @param userText 用户文本
   * @param candidates 候选文本列表
   * @returns 排序后的候选列表（按相似度降序）
   */
  static findClosestMatches(
    userText: string,
    candidates: string[]
  ): Array<{ text: string; similarity: number; distance: number }> {
    const results = candidates.map(candidate => ({
      text: candidate,
      similarity: this.similarity(userText, candidate),
      distance: this.distance(userText, candidate)
    }));

    // 按相似度降序排序
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 检查两个字符串是否足够相似（相似度阈值）
   * @param s1 字符串1
   * @param s2 字符串2
   * @param threshold 阈值（默认0.7）
   * @returns 是否相似
   */
  static isSimilar(s1: string, s2: string, threshold: number = 0.7): boolean {
    return this.similarity(s1, s2) >= threshold;
  }
}

/**
 * 快速字符串相似度比较（用于关键词匹配）
 */
export class FastMatcher {
  /**
   * Jaro-Winkler相似度（比Levenshtein更快）
   * 适合用于关键词快速匹配
   */
  static jaroWinklerSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // 找匹配字符
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, s2.length);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // 计算转置
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) / 3;

    // Winkler bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  /**
   * 子串包含检查（忽略大小写）
   */
  static contains(text: string, keyword: string): boolean {
    return text.toLowerCase().includes(keyword.toLowerCase());
  }

  /**
   * 模糊匹配（允许1-2个字符差异）
   */
  static fuzzyMatch(text: string, keyword: string, maxDiff: number = 2): boolean {
    const distance = LevenshteinMatcher.distance(text, keyword);
    return distance <= maxDiff;
  }
}
