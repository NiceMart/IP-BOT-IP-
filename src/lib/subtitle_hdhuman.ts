/**
 * 字幕处理工具 - 参考 HD_HUMAN 项目的字幕逻辑
 * 提供更智能的文本分割、时间轴分配和样式处理
 */

import {AudioRecord} from "./ffmpeg";

export interface SubtitleEntry {
    start: number;  // 开始时间（毫秒）
    end: number;    // 结束时间（毫秒）
    text: string;   // 字幕文本
    words?: Array<{
        word: string;
        start: number;
        end: number;
    }>;  // 词级时间（可选）
}

/**
 * 计算文本的有效显示长度
 * 中文字符算1，英文字母算0.5，数字和标点不算长度
 */
export function calculateDisplayLength(text: string): number {
    let length = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
            // 中文字符
            length += 1;
        } else if (/[a-zA-Z]/.test(char)) {
            // 英文字母
            length += 0.5;
        }
        // 数字、标点和空格不算长度
    }
    return length;
}

/**
 * 计算文本的字符数（中文字符和英文字母）
 */
export function calculateCharCount(text: string): number {
    let count = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
            count += 1;
        }
    }
    return count;
}

/**
 * 按字符分割长单词（如果单个词超过行长度限制）
 */
function splitWordByChar(word: string, lineLimit: number): string[] {
    const parts: string[] = [];
    let current = '';
    let currentLength = 0;

    for (const char of word) {
        let charLen = 0;
        if (/[\u4e00-\u9fff]/.test(char)) {
            charLen = 1;
        } else if (/[a-zA-Z]/.test(char)) {
            charLen = 0.5;
        }

        if (currentLength + charLen > lineLimit) {
            if (current) {
                parts.push(current);
                current = '';
                currentLength = 0;
            }
            current += char;
            currentLength += charLen;
        } else {
            current += char;
            currentLength += charLen;
        }
    }

    if (current) {
        parts.push(current);
    }

    return parts;
}

/**
 * 按单词分割文本段落（考虑中英文混合）
 */
function splitPartByWords(part: string, lineLimit: number): string[] {
    // 将文本按空格和标点符号分割成单词
    const words = part.split(/(\s+|[,，。！？、；])/).filter(w => w.trim());
    const subParts: string[] = [];
    let current = '';
    let currentLength = 0;

    for (const word of words) {
        if (!word.trim()) {
            // 空格或标点，添加到当前行
            current += word;
            continue;
        }

        const wordLength = calculateDisplayLength(word);

        if (wordLength > lineLimit) {
            // 单词本身超过限制，按字符分割
            const charParts = splitWordByChar(word, lineLimit);
            for (const charPart of charParts) {
                const charLength = calculateDisplayLength(charPart);
                if (currentLength + charLength > lineLimit) {
                    if (current) {
                        subParts.push(current.trim());
                        current = '';
                        currentLength = 0;
                    }
                }
                current += charPart;
                currentLength += charLength;
            }
        } else {
            // 正常处理单词
            if (currentLength + wordLength > lineLimit) {
                if (current) {
                    subParts.push(current.trim());
                    current = '';
                    currentLength = 0;
                }
            }
            if (current) {
                current += word;
            } else {
                current = word;
            }
            currentLength += wordLength;
        }
    }

    if (current.trim()) {
        subParts.push(current.trim());
    }

    return subParts;
}

/**
 * 智能分割字幕文本
 * 参考 HD_HUMAN 项目的处理逻辑
 * 
 * @param records 音频记录数组
 * @param options 配置选项
 * @returns 分割后的字幕记录数组
 */
export function subtitleGenerateRecords(
    records: AudioRecord[],
    options?: {
        lineLimit?: number;        // 每行最大显示长度（默认30）
        maxLines?: number;         // 每段字幕最大行数（默认2）
        splitByPunctuation?: boolean; // 是否按标点符号分割（默认true）
    }
): SubtitleEntry[] {
    options = Object.assign({
        lineLimit: 30,
        maxLines: 2,
        splitByPunctuation: true,
    }, options);

    const subtitles: SubtitleEntry[] = [];

    for (const record of records) {
        const text = record.text.trim();
        if (!text) continue;

        // 第一步：按标点符号分割成可读部分
        let readableParts: string[] = [];
        
        if (options.splitByPunctuation) {
            // 按句尾标点（。！？）分割，保留标点
            const parts = text.split(/([。！？\.!\?]+)/);
            for (let i = 0; i < parts.length; i += 2) {
                const part = parts[i];
                const punct = parts[i + 1] || '';
                if (part.trim()) {
                    // 去除句中标点（，、；），只保留句尾标点
                    const cleanPart = part.replace(/[，、；,;]/g, '');
                    readableParts.push(cleanPart + punct);
                }
            }
        } else {
            readableParts = [text];
        }

        // 第二步：将可读部分按行长度限制分割
        const subtitleTexts: string[] = [];
        let currentText = '';
        let currentLength = 0;
        let currentLines = 0;

        for (const part of readableParts) {
            const partLength = calculateDisplayLength(part);

            if (partLength > options.lineLimit) {
                // 段落超过限制，需要进一步分割
                const subParts = splitPartByWords(part, options.lineLimit);
                for (const subPart of subParts) {
                    const subLength = calculateDisplayLength(subPart);
                    if (currentLines >= options.maxLines || 
                        (currentLength + subLength > options.lineLimit && currentLength > 0)) {
                        // 当前行已满，保存并开始新行
                        if (currentText) {
                            subtitleTexts.push(currentText.trim());
                            currentText = '';
                            currentLength = 0;
                            currentLines = 0;
                        }
                    }
                    if (currentText) {
                        currentText += ' ' + subPart;
                    } else {
                        currentText = subPart;
                    }
                    currentLength += subLength;
                    if (currentLines === 0) currentLines = 1;
                }
            } else {
                // 段落未超过限制
                if (currentLines >= options.maxLines || 
                    (currentLength + partLength > options.lineLimit && currentLength > 0)) {
                    // 当前行已满
                    if (currentText) {
                        subtitleTexts.push(currentText.trim());
                        currentText = '';
                        currentLength = 0;
                        currentLines = 0;
                    }
                }
                if (currentText) {
                    currentText += ' ' + part;
                } else {
                    currentText = part;
                }
                currentLength += partLength;
                if (currentLines === 0) currentLines = 1;
            }
        }

        if (currentText.trim()) {
            subtitleTexts.push(currentText.trim());
        }

        // 第三步：按字符比例分配时间
        const totalChars = calculateCharCount(record.text);
        let cumulativeRatio = 0;

        for (const subtitleText of subtitleTexts) {
            const charCount = calculateCharCount(subtitleText);
            const timeRatio = totalChars > 0 ? charCount / totalChars : 1 / subtitleTexts.length;
            
            const start = record.start + (record.end - record.start) * cumulativeRatio;
            const end = record.start + (record.end - record.start) * (cumulativeRatio + timeRatio);

            subtitles.push({
                start: start,
                end: end,
                text: subtitleText
            });

            cumulativeRatio += timeRatio;
        }
    }

    return subtitles;
}

/**
 * 生成SRT格式字幕内容
 */
export function subtitleGenerateSrtContent(
    records: SubtitleEntry[]
): string {
    let subtitleText = '';
    let index = 1;

    const formatMs = (ms: number) => {
        ms = Math.floor(ms);
        const hour = Math.floor(ms / 3600000);
        const minute = Math.floor((ms % 3600000) / 60000);
        const second = Math.floor((ms % 60000) / 1000);
        const millisecond = ms % 1000;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')},${String(millisecond).padStart(3, '0')}`;
    };

    for (const record of records) {
        const start = formatMs(record.start);
        const end = formatMs(record.end);
        subtitleText += `${index}\n${start} --> ${end}\n${record.text}\n\n`;
        index++;
    }

    return subtitleText;
}

/**
 * 解析SRT文件
 */
export async function subtitleParseSrtFile(
    srtFilePath: string
): Promise<SubtitleEntry[]> {
    const content = await window.$mapi.file.read(srtFilePath, {isDataPath: false});
    const entries: SubtitleEntry[] = [];

    // SRT格式解析
    const blocks = content.trim().split('\n\n');

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;

        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) continue;

        const startMs = parseInt(timeMatch[1]) * 3600000 + 
                        parseInt(timeMatch[2]) * 60000 + 
                        parseInt(timeMatch[3]) * 1000 + 
                        parseInt(timeMatch[4]);
        const endMs = parseInt(timeMatch[5]) * 3600000 + 
                      parseInt(timeMatch[6]) * 60000 + 
                      parseInt(timeMatch[7]) * 1000 + 
                      parseInt(timeMatch[8]);
        const text = lines.slice(2).join('\n');

        entries.push({
            start: startMs,
            end: endMs,
            text: text.trim()
        });
    }

    return entries;
}

/**
 * 格式化时间戳为SRT格式 (HH:MM:SS,mmm)
 */
export function formatSRTTime(seconds: number): string {
    const ms = Math.floor(seconds * 1000);
    const hour = Math.floor(ms / 3600000);
    const minute = Math.floor((ms % 3600000) / 60000);
    const second = Math.floor((ms % 60000) / 1000);
    const millisecond = ms % 1000;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')},${String(millisecond).padStart(3, '0')}`;
}

/**
 * 格式化时间戳为ASS格式 (H:MM:SS.cc)
 */
export function formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * 将Hex颜色转换为ASS格式 (&H00BBGGRR&)
 */
export function convertColorToASS(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith('#')) {
        return '&H00FFFFFF&'; // 默认白色
    }

    const hex = hexColor.substring(1);
    if (hex.length !== 6) {
        return '&H00FFFFFF&';
    }

    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);

    // ASS格式是BGR顺序，并且前缀&H00，后缀&
    return `&H00${b}${g}${r}&`;
}
