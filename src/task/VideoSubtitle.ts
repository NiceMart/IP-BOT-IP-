// @ts-nocheck
import { DataService } from "../service/DataService";
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { TaskBiz } from "../store/modules/task";
import { DrawtextUtils } from "../lib/subtitle/DrawtextUtils";
import { DrawtextGenerator } from "../lib/subtitle/DrawtextGenerator";

const serverStore = useServerStore();

export const VideoSubtitle: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        const { record, server, serverInfo } = await serverStore.prepareForTask(bizId, bizParam);

        const modelConfig: VideoSubtitleModelConfigType = record.modelConfig;
        const videoFile = modelConfig.video;
        const srtFile = modelConfig.srtFile;
        const customText = modelConfig.customText;
        const subtitleStyle = modelConfig.subtitleStyle;
        const keywordStyle = modelConfig.keywordStyle;
        const keywordMarkers = modelConfig.keywordMarkers || [];
        const keywordGroups = modelConfig.keywordGroups || [];  // 新增：关键词分组信息
        const funasrSegments = modelConfig.funasrSegments || [];  // FUNASR识别的段落数据（方式1）
        const useVolumeDetect = modelConfig.useVolumeDetect || false;  // 🆕 是否使用本地音量检测（方式2）
        const volumeDetectText = modelConfig.volumeDetectText || '';  // 🆕 音量检测使用的文本内容

        // ==================== 关键步骤0: 样式验证 ====================
        // 定义样式校验函数
        const validateSubtitleStyle = (style: any): { valid: boolean; errors: string[] } => {
            const errors: string[] = [];

            if (!style || typeof style !== 'object') {
                errors.push('样式对象不存在或不是有效对象');
                return { valid: false, errors };
            }

            const requiredFields = ['fontColor', 'fontName', 'fontSize'];
            for (const field of requiredFields) {
                if (!style[field]) {
                    errors.push(`缺少必需字段: ${field}`);
                }
            }

            return { valid: errors.length === 0, errors };
        };

        // 定义默认样式
        const defaultSubtitleStyle = {
            id: 'default',
            name: '默认样式',
            description: '系统默认样式',
            preview: '示例',
            fontName: 'Microsoft YaHei Bold',
            fontSize: 48,
            fontColor: '#FFFFFF',
            outlineColor: '#000000',
            outlineWidth: 3,
            shadowOffset: 2,
            backgroundColor: 'transparent',
            backgroundOpacity: 0,
            position: 'bottom' as const,
            alignment: 'center' as const
        };

        // 调试日志:检查样式参数是否正确传递
        console.log('[VideoSubtitle] 收到的样式参数:', {
            subtitleStyle: subtitleStyle,
            hasStyle: !!subtitleStyle,
            fontColor: subtitleStyle?.fontColor,
            fontName: subtitleStyle?.fontName,
            fontSize: subtitleStyle?.fontSize,
            keywordStyle: keywordStyle,
            hasKeywordMarkers: keywordMarkers.length > 0,
            markerCount: keywordMarkers.length
        });

        // 验证样式有效性
        const styleValidation = validateSubtitleStyle(subtitleStyle);
        if (!styleValidation.valid) {
            console.error('[VideoSubtitle] ❌ 样式验证失败:', styleValidation.errors);
            console.warn('[VideoSubtitle] 使用默认样式替代');
            // @ts-ignore
            (modelConfig.subtitleStyle as any) = defaultSubtitleStyle;
        } else {
            console.log('[VideoSubtitle] ✅ 样式验证通过');
        }

        if (!videoFile) {
            throw new Error("VideoFileEmpty");
        }

        // 🆕 支持方式2：本地音量检测，需要提供文本内容
        if (useVolumeDetect && !volumeDetectText) {
            throw new Error("VolumeDetectTextEmpty");
        }

        if (!useVolumeDetect && !srtFile && !customText && funasrSegments.length === 0) {
            throw new Error("SubtitleSourceEmpty");
        }

        // Create output video path with consistent naming
        const videoName = window.$mapi.file.pathToName(videoFile, true);
        const videoBaseName = window.$mapi.file.pathToName(videoFile, false); // 不带扩展名
        const videoExt = window.$mapi.file.pathToName(videoFile, true).split('.').pop(); // 获取扩展名

        // 使用hubFile保存到output目录，便于用户查找
        const outputPath = await window.$mapi.file.hubFile(videoExt || 'mp4', {
            saveGroup: 'video',
            savePathParam: { name: `subtitle_${videoBaseName}` }
        });

        // Process subtitles with word timing and time adjustment
        // 统一对所有字幕数据进行处理（包括FUNASR、SRT、自定义文本、本地音量检测）
        // 如果有FUNASR数据，则使用基于FUNASR的智能分组和时间分配
        console.log('[VideoSubtitle] ✅ 字幕系统改进版本已加载 - 支持FUNASR智能分组、本地音量检测、特效字幕位置智能分配、自定义字体');

        let subtitleData: any[] = [];
        let processedSubtitles: any[] = [];

        // 🆕 ========== 方式2：本地音量检测 + 文案内容 ==========
        if (useVolumeDetect && volumeDetectText) {
            console.log('[VideoSubtitle] 使用本地音量检测方式，文案长度:', volumeDetectText.length);

            try {
                // 从视频或音频文件中提取音频（如果是视频文件，FFmpeg会自动提取音频）
                const audioPath = videoFile;  // 可以直接使用视频文件

                // 1. 检测音频中的声音片段
                console.log('[VideoSubtitle] 开始音量检测...');
                const volumeResult = await (window as any).$mapi.aliyun.audio.detectVolume({
                    audioPath,
                    config: {
                        silenceThreshold: -40,  // 静音阈值 -40dB
                        minSilenceDuration: 0.5, // 最小静音时长 0.5s
                        minSoundDuration: 0.3    // 最小有声时长 0.3s
                    }
                });

                if (!volumeResult.success || !volumeResult.segments || volumeResult.segments.length === 0) {
                    throw new Error(`音量检测失败: ${volumeResult.error || '未检测到声音片段'}`);
                }

                console.log(`[VideoSubtitle] ✅ 音量检测完成，检测到 ${volumeResult.segments.length} 个声音片段`);
                console.log('[VideoSubtitle] 声音片段详情:', volumeResult.segments.map((s: any, i: number) =>
                    `片段${i + 1}: ${s.startTime.toFixed(2)}s - ${s.endTime.toFixed(2)}s (${s.duration.toFixed(2)}s)`
                ).join(' | '));

                // 2. 将文案内容按照音频片段分配时间
                console.log('[VideoSubtitle] 开始分配文本时间...');
                const textResult = await (window as any).$mapi.aliyun.audio.allocateText({
                    text: volumeDetectText,
                    segments: volumeResult.segments
                });

                if (!textResult.success || !textResult.subtitles) {
                    throw new Error(`文本时间分配失败: ${textResult.error || '未知错误'}`);
                }

                console.log(`[VideoSubtitle] ✅ 文本时间分配完成，生成 ${textResult.subtitles.length} 条字幕`);

                // 转换为标准字幕格式并处理
                subtitleData = textResult.subtitles;
                processedSubtitles = processSubtitles(subtitleData, modelConfig.param, undefined);

                console.log('[VideoSubtitle] ✅ 本地音量检测方式处理完成');

            } catch (error: any) {
                console.error('[VideoSubtitle] 本地音量检测失败:', error);
                throw new Error(`本地音量检测失败: ${error.message}`);
            }
        }
        // ========== 方式1：FUNASR在线识别 ==========
        else if (funasrSegments.length > 0) {
            // FUNASR数据优先处理
            console.log('[VideoSubtitle] 检测到FUNASR数据，使用智能分组...');

            // 检查是否有字级时间点（timestamp字段）
            let hasCharLevelTiming = false;
            let charLevelTimestamps: any[] = [];

            for (const segment of funasrSegments) {
                if (segment.timestamp && Array.isArray(segment.timestamp) && segment.timestamp.length > 0) {
                    hasCharLevelTiming = true;
                    charLevelTimestamps.push(...segment.timestamp.map((t: number[]) => ({
                        start: t[0],
                        end: t[1]
                    })));
                }
            }

            if (hasCharLevelTiming && charLevelTimestamps.length > 0) {
                // 有字级时间点，使用分组分配
                console.log('[VideoSubtitle] 检测到字级时间点，共', charLevelTimestamps.length, '个字，开始分组...');
                const allText = funasrSegments.map((s: any) => s.text || '').join('');
                const grouped = groupAndAllocateSubtitles(allText, charLevelTimestamps, 8, 2, 0.2);
                console.log('[VideoSubtitle] ✅ FUNASR字幕分组完成，共', grouped.length, '组');

                // 🔧 【关键修复】对FUNASR分组结果也应用分批显示逻辑
                // 检查是否有分组文本过长，需要进一步拆分成批次
                const maxCharsPerBatch = 14; // 每批最多14个字符（2行 x 7字符）
                const needsBatching = grouped.some(subtitle => {
                    const charCount = (subtitle.text || '').length;
                    return charCount > maxCharsPerBatch;
                });

                if (needsBatching) {
                    console.log('[VideoSubtitle] ⚠️ FUNASR分组中检测到过长字幕，启用分批显示逻辑');
                    const batchedSubtitles: any[] = [];
                    let batchIndex = 1;

                    for (const subtitle of grouped) {
                        const text = subtitle.text || '';
                        const charCount = text.length;

                        if (charCount <= maxCharsPerBatch) {
                            // 字幕长度正常，直接添加
                            batchedSubtitles.push({
                                ...subtitle,
                                index: batchIndex++,
                                start: subtitle.startTime,
                                end: subtitle.endTime,
                                _skipOptimizeLayout: true  // 标记已分批，避免ZimuShengcheng再次拆分
                            });
                        } else {
                            // 字幕过长，拆分成多个批次
                            const batches = splitTextIntoBatches(text, maxCharsPerBatch);
                            const totalDuration = subtitle.endTime - subtitle.startTime;
                            const durationPerBatch = totalDuration / batches.length;

                            console.log(`[VideoSubtitle] FUNASR拆分字幕: "${text}" (${charCount}字) -> ${batches.length}批`);

                            batches.forEach((batchText, batchIdx) => {
                                const batchStartTime = subtitle.startTime + (batchIdx * durationPerBatch);
                                const batchEndTime = batchStartTime + durationPerBatch;

                                // 为批次生成 words 时间信息
                                const batchChars = batchText.split('');
                                const batchWords = batchChars.filter(c => c.trim().length > 0);
                                const batchDuration = batchEndTime - batchStartTime;
                                let cumulativeTime = batchStartTime;
                                const wordsWithTiming = batchWords.map((word, idx) => {
                                    const wordDuration = batchDuration / batchWords.length;
                                    const wordStart = cumulativeTime;
                                    const wordEnd = cumulativeTime + wordDuration;
                                    cumulativeTime = wordEnd;

                                    return {
                                        word,
                                        start: wordStart,
                                        end: wordEnd,
                                        position: (idx / batchWords.length) * 100
                                    };
                                });

                                batchedSubtitles.push({
                                    ...subtitle,
                                    index: batchIndex++,
                                    text: batchText,
                                    startTime: batchStartTime,
                                    endTime: batchEndTime,
                                    start: batchStartTime,  // ZimuShengcheng.ts 使用 start/end 字段
                                    end: batchEndTime,
                                    words: wordsWithTiming,
                                    lines: [batchText],  // 强制单行，避免再次拆分
                                    originalText: text,
                                    batchInfo: {
                                        batchIndex: batchIdx + 1,
                                        totalBatches: batches.length
                                    },
                                    _skipOptimizeLayout: true  // 🔧 【关键】标记已分批
                                });

                                console.log(`  FUNASR批次${batchIdx + 1}/${batches.length}: "${batchText}" (${batchStartTime.toFixed(2)}s - ${batchEndTime.toFixed(2)}s)`);
                            });
                        }
                    }

                    processedSubtitles = batchedSubtitles;
                    console.log(`[VideoSubtitle] ✅ FUNASR分批处理完成，总字幕数: ${processedSubtitles.length}`);
                } else {
                    // 不需要分批，但仍需添加兼容字段和标记
                    processedSubtitles = grouped.map(subtitle => ({
                        ...subtitle,
                        start: subtitle.startTime,
                        end: subtitle.endTime,
                        lines: subtitle.lines || [subtitle.text],
                        _skipOptimizeLayout: true  // 避免二次拆分
                    }));
                }
            } else {
                // 无字级时间点，使用句级时间点
                console.log('[VideoSubtitle] 未检测到字级时间点，使用句级时间点');
                subtitleData = funasrSegments.map((seg: any, index: number) => ({
                    index: index + 1,
                    startTime: seg.start,
                    endTime: seg.end,
                    text: seg.text,
                    words: seg.words || []
                }));
                processedSubtitles = processSubtitles(subtitleData, modelConfig.param, undefined);
            }
        } else if (srtFile) {
            // Parse SRT file
            console.log('[VideoSubtitle] 使用SRT文件处理字幕');
            subtitleData = await parseSrtFile(srtFile);
            processedSubtitles = processSubtitles(subtitleData, modelConfig.param, undefined);
        } else if (customText) {
            // Create subtitle from custom text (simple line-based subtitles)
            console.log('[VideoSubtitle] 使用自定义文本处理字幕');
            subtitleData = createSubtitleFromText(customText);
            processedSubtitles = processSubtitles(subtitleData, modelConfig.param, undefined);
        }

        try {
            // Apply subtitles to video using FFmpeg
            await applySubtitlesToVideo(
                videoFile,
                outputPath,
                processedSubtitles,
                subtitleStyle,
                keywordStyle,
                keywordMarkers,
                keywordGroups
            );

            // 🔧 关键修复：必须保存 jobResult 到数据库，否则 successFunc 中查询不到结果
            // 注意：这里只保存 jobResult，不更新 status，status 会在 successFunc 中更新
            const jobResult = {
                type: "success",
                data: {
                    video: videoFile,
                    subtitlePath: outputPath,
                    subtitles: processedSubtitles,
                    fontStyle: modelConfig.param
                }
            };

            try {
                // 🔧 保存 jobResult 和 status（确保 UI 可以立即看到任务已完成）
                // 这里更新的是中间状态，successFunc 会最后确认并保存 result
                await TaskService.update(bizId, {
                    status: "success",
                    jobResult: jobResult,
                });
                console.log(`[VideoSubtitle.runFunc] ✅ jobResult 已保存到数据库，status=success`);
            } catch (e) {
                console.error(`[VideoSubtitle.runFunc] ❌ 保存 jobResult 失败: ${e}`);
            }

            // ✅ 必须返回字符串 "success"，而不是对象
            return "success";
        } catch (error: any) {
            throw new Error(`VideoSubtitle failed: ${error.message}`);
        }
    },
    successFunc: async (bizId, bizParam) => {
        console.log(`[VideoSubtitle.successFunc] 开始处理字幕生成完成，bizId=${bizId}`);
        const { record } = await serverStore.prepareForTask(bizId, bizParam);
        console.log(`[VideoSubtitle.successFunc] 从数据库获取任务记录完成`);

        // 🔧 诊断：打印 jobResult 的完整内容
        if (!record.jobResult) {
            console.error(`[VideoSubtitle.successFunc] ❌ 致命错误：jobResult为空或未定义！`);
            console.error(`[VideoSubtitle.successFunc] 完整record:`, JSON.stringify(record, null, 2));
            throw new Error("jobResult not found");
        }
        console.log(`[VideoSubtitle.successFunc] jobResult 结构:`, JSON.stringify(record.jobResult, null, 2));

        // 🔧 确保 jobResult.data 不为空
        if (!record.jobResult.data) {
            console.error(`[VideoSubtitle.successFunc] ❌ 致命错误：jobResult.data为空！`);
            throw new Error("jobResult.data not found");
        }

        await TaskService.update(bizId, {
            status: "success",
            endTime: Date.now(),
            result: record.jobResult.data
        });

        console.log(`[VideoSubtitle.successFunc] ✅ 数据库更新完成`);
        try { const _u = JSON.parse(localStorage.getItem('auth_user') || '{}'); window.require('electron').ipcRenderer.invoke('auth:reportGeneration', { userId: _u.id, type: 'subtitle', detail: '字幕合成' }); } catch(e) {}
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};

// Parse SRT file to extract subtitle data
const parseSrtFile = async (srtPath: string): Promise<any[]> => {
    const srtContent = await window.$mapi.file.read(srtPath);
    const lines = srtContent.split('\n');
    const subtitles = [];

    let currentSubtitle = null;
    let index = 0;

    for (const line of lines) {
        if (line.trim() === '') {
            if (currentSubtitle) {
                subtitles.push(currentSubtitle);
                currentSubtitle = null;
            }
            continue;
        }

        if (line.includes('-->')) {
            // Time line
            if (!currentSubtitle) {
                currentSubtitle = {
                    index: ++index,
                    startTime: 0,
                    endTime: 0,
                    text: '',
                    words: []
                };
            }

            const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s-->\s+(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
            if (timeMatch) {
                const [, startH, startM, startS, startMs, endH, endM, endS, endMs] = timeMatch;
                currentSubtitle.startTime = parseInt(startH) * 3600 + parseInt(startM) * 60 + parseInt(startS) + parseInt(startMs) / 1000;
                currentSubtitle.endTime = parseInt(endH) * 3600 + parseInt(endM) * 60 + parseInt(endS) + parseInt(endMs) / 1000;
            }
        } else if (currentSubtitle) {
            // Text line
            currentSubtitle.text += line + ' ';
        }
    }

    // Add last subtitle if exists
    if (currentSubtitle) {
        subtitles.push(currentSubtitle);
    }

    return subtitles;
};

// Create subtitle from custom text
// 参考 HD_HUMAN 项目的字幕处理逻辑
const createSubtitleFromText = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const subtitles = [];

    // 计算显示长度（中文字符算1，英文字母算0.5）
    const calculateDisplayLength = (text: string): number => {
        let length = 0;
        for (const char of text) {
            if (/[\u4e00-\u9fff]/.test(char)) {
                length += 1;  // 中文字符
            } else if (/[a-zA-Z]/.test(char)) {
                length += 0.5;  // 英文字母
            }
        }
        return length;
    };

    // 计算字符数（中文字符和英文字母）
    const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
            if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
                count += 1;
            }
        }
        return count;
    };

    // 如果每行太长，需要进一步分割
    const maxDisplayLength = 30;  // 参考 HD_HUMAN：每行最大显示长度
    const processedLines: string[] = [];

    for (const line of lines) {
        const lineLength = calculateDisplayLength(line);
        if (lineLength <= maxDisplayLength) {
            processedLines.push(line.trim());
        } else {
            // 长行需要分割
            // 按标点符号和空格分割
            const words = line.split(/(\s+|[，、；,;])/).filter(w => w.trim());
            let currentSegment = '';
            let currentLength = 0;

            for (const word of words) {
                const wordLength = calculateDisplayLength(word);
                if (currentLength + wordLength > maxDisplayLength && currentSegment) {
                    processedLines.push(currentSegment.trim());
                    currentSegment = '';
                    currentLength = 0;
                }
                currentSegment += word;
                currentLength += wordLength;
            }
            if (currentSegment.trim()) {
                processedLines.push(currentSegment.trim());
            }
        }
    }

    // 假设总时长，按字符比例分配时间
    const estimatedDuration = processedLines.length * 3; // 每段约3秒
    const totalChars = processedLines.reduce((sum, line) => sum + calculateCharCount(line), 0);
    let cumulativeTime = 0;

    processedLines.forEach((line, index) => {
        const charCount = calculateCharCount(line);
        const timeRatio = totalChars > 0 ? charCount / totalChars : 1 / processedLines.length;
        const duration = estimatedDuration * timeRatio;
        const startTime = cumulativeTime;
        const endTime = cumulativeTime + duration;

        subtitles.push({
            index: index + 1,
            startTime,
            endTime,
            text: line,
            words: []
        });

        cumulativeTime = endTime;
    });

    return subtitles;
};

/**
 * 将长文本智能拆分成多个批次
 * 优先在标点符号处拆分，避免在词语中间断开
 */
const splitTextIntoBatches = (text: string, maxCharsPerBatch: number): string[] => {
    const batches: string[] = [];
    const punctuations = ['。', '！', '？', '，', '、', ',', '.', '!', '?', ';', '；'];

    let currentBatch = '';
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        currentBatch += char;

        // 检查是否达到批次长度限制
        if (currentBatch.length >= maxCharsPerBatch) {
            // 尝试在标点符号处拆分
            let foundPunctuation = false;

            // 向后查找最近的标点符号（最多再读5个字符）
            for (let j = 0; j < 5 && i + j + 1 < text.length; j++) {
                const nextChar = text[i + j + 1];
                if (punctuations.includes(nextChar)) {
                    // 找到标点符号，包含它后拆分
                    currentBatch += nextChar;
                    i += j + 1;
                    foundPunctuation = true;
                    break;
                }
            }

            // 如果没找到标点符号，就直接拆分
            if (!foundPunctuation) {
                // 向前查找最近的标点符号（回退最多5个字符）
                for (let j = 1; j <= 5 && j <= currentBatch.length; j++) {
                    const prevChar = currentBatch[currentBatch.length - j];
                    if (punctuations.includes(prevChar)) {
                        // 找到了标点符号，在此处拆分
                        const splitIndex = currentBatch.length - j + 1;
                        batches.push(currentBatch.substring(0, splitIndex));
                        currentBatch = currentBatch.substring(splitIndex);
                        foundPunctuation = true;
                        break;
                    }
                }
            }

            if (foundPunctuation) {
                batches.push(currentBatch.trim());
                currentBatch = '';
            } else {
                // 实在找不到标点，就在当前位置强制拆分
                batches.push(currentBatch.trim());
                currentBatch = '';
            }
        }

        i++;
    }

    // 添加最后一个批次
    if (currentBatch.trim()) {
        batches.push(currentBatch.trim());
    }

    return batches.filter(b => b.length > 0);
};

// Process subtitles to add word-level timing
// 参考 HD_HUMAN 项目的处理逻辑：按字符比例分配时间
// 新增：支持基于FUNASR的智能字幕分组
const processSubtitles = (subtitles: any[], param: any, funasrSegments?: any[]): any[] => {
    // 如果有FUNASR数据，优先使用智能分组
    if (funasrSegments && funasrSegments.length > 0) {
        const allText = subtitles.map(s => s.text || '').join('');
        const grouped = groupAndAllocateSubtitles(allText, funasrSegments, 8, 2, 0.2);
        console.log('[VideoSubtitle] ✅ 使用FUNASR智能分组，总分组数:', grouped.length);
        console.log('[VideoSubtitle] 分组详情:', grouped.map((g, i) => `${i + 1}. "${g.text}" ${g.startTime.toFixed(2)}s-${g.endTime.toFixed(2)}s`).join(' | '));
        return grouped;
    }

    // 🔧 【新增】即使没有FUNASR数据，也需要对过长的字幕进行分批显示
    // 检测是否有字幕文本过长，如果有则进行分批处理
    const maxCharsPerBatch = 14; // 每批最多14个字符（2行 x 7字符），保守设置避免重叠
    const needsBatching = subtitles.some(subtitle => {
        const charCount = (subtitle.text || '').length;
        return charCount > maxCharsPerBatch;
    });

    if (needsBatching) {
        console.log('[VideoSubtitle] ⚠️ 检测到过长字幕，启用分批显示逻辑');
        // 对每个字幕单独处理，过长的拆分成多个批次
        const batchedSubtitles: any[] = [];
        let batchIndex = 1;

        for (const subtitle of subtitles) {
            const text = subtitle.text || '';
            const charCount = text.length;

            if (charCount <= maxCharsPerBatch) {
                // 字幕长度正常，直接添加
                batchedSubtitles.push({
                    ...subtitle,
                    index: batchIndex++
                });
            } else {
                // 字幕过长，拆分成多个批次
                const batches = splitTextIntoBatches(text, maxCharsPerBatch);
                const totalDuration = subtitle.endTime - subtitle.startTime;
                const durationPerBatch = totalDuration / batches.length;

                console.log(`[VideoSubtitle] 拆分字幕: "${text}" (${charCount}字) -> ${batches.length}批`);

                batches.forEach((batchText, batchIdx) => {
                    const batchStartTime = subtitle.startTime + (batchIdx * durationPerBatch);
                    const batchEndTime = batchStartTime + durationPerBatch;

                    // 为批次生成 words 时间信息
                    const batchChars = batchText.split('');
                    const batchWords = batchChars.filter(c => c.trim().length > 0);
                    const batchDuration = batchEndTime - batchStartTime;
                    let cumulativeTime = batchStartTime;
                    const wordsWithTiming = batchWords.map((word, idx) => {
                        const wordDuration = batchDuration / batchWords.length;
                        const wordStart = cumulativeTime;
                        const wordEnd = cumulativeTime + wordDuration;
                        cumulativeTime = wordEnd;

                        return {
                            word,
                            start: wordStart,
                            end: wordEnd,
                            position: (idx / batchWords.length) * 100
                        };
                    });

                    batchedSubtitles.push({
                        ...subtitle,
                        index: batchIndex++,
                        text: batchText,
                        startTime: batchStartTime,
                        endTime: batchEndTime,
                        start: batchStartTime,  // 🔧 修复：ZimuShengcheng.ts 使用 start/end 字段
                        end: batchEndTime,      // 🔧 修复：添加兼容字段
                        words: wordsWithTiming, // 🔧 添加：为批次生成word-level timing
                        originalText: text, // 保留原始完整文本
                        batchInfo: {
                            batchIndex: batchIdx + 1,
                            totalBatches: batches.length
                        }
                    });

                    console.log(`  批次${batchIdx + 1}/${batches.length}: "${batchText}" (${batchStartTime.toFixed(2)}s - ${batchEndTime.toFixed(2)}s)`);
                });
            }
        }

        // 使用拆分后的字幕替换原始字幕
        subtitles = batchedSubtitles;
        console.log(`[VideoSubtitle] ✅ 分批处理完成，总字幕数: ${subtitles.length}`);

        // 🔧 【关键修复】拆分后的字幕已经包含完整信息，直接返回，不再进行后续处理
        // 避免后续代码覆盖我们设置的时间信息
        return subtitles.map(subtitle => ({
            ...subtitle,
            words: subtitle.words || [],
            lines: [subtitle.text],  // 🔧 强制每个批次只有一行，避免 ZimuShengcheng 再次拆分
            _skipOptimizeLayout: true  // 🔧 【关键】标记此字幕已经分批，不需要 optimizeLayout 再次处理
        }));
    }
    // HD_HUMAN风格：自动调整字幕开始时间，避免视频开头无字幕
    if (subtitles.length > 0) {
        const firstSubtitle = subtitles[0];
        const thresholdStart = Number.POSITIVE_INFINITY; // 保持源时间轴，禁用整轨自动前移
        const targetStart = 0.3; // 目标开始时间（0.3秒，给观众一点反应时间）

        if (firstSubtitle.startTime > thresholdStart) {
            const offset = firstSubtitle.startTime - targetStart;

            console.log('[VideoSubtitle] ========== 字幕时间自动调整 ==========');
            console.log(`[VideoSubtitle] 第一条字幕原始开始时间: ${firstSubtitle.startTime.toFixed(2)}秒`);
            console.log(`[VideoSubtitle] 检测到延迟，将向前调整: ${offset.toFixed(2)}秒`);
            console.log(`[VideoSubtitle] 目标开始时间: ${targetStart.toFixed(2)}秒`);

            // 对所有字幕应用时间偏移
            subtitles = subtitles.map(subtitle => ({
                ...subtitle,
                startTime: Math.max(0, subtitle.startTime - offset),
                endTime: Math.max(0.5, subtitle.endTime - offset)
            }));

            console.log(`[VideoSubtitle] 调整后第一条字幕开始时间: ${subtitles[0].startTime.toFixed(2)}秒`);
            console.log(`[VideoSubtitle] 调整后最后一条字幕结束时间: ${subtitles[subtitles.length - 1].endTime.toFixed(2)}秒`);
            console.log('[VideoSubtitle] ==========================================');
        } else {
            console.log('[VideoSubtitle] ========== 字幕时间检查 ==========');
            console.log('[VideoSubtitle] 字幕时间正常，无需调整');
            console.log(`[VideoSubtitle] 第一条字幕开始时间: ${firstSubtitle.startTime.toFixed(2)}秒`);
            console.log('[VideoSubtitle] ======================================');
        }
    }

    // 计算字符数（中文字符和英文字母）
    const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
            if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
                count += 1;
            }
        }
        return count;
    };

    const processedSubtitles = subtitles.map(subtitle => {
        const text = subtitle.text.trim();
        if (!text) {
            return subtitle;
        }

        // 按字符分割（中文字符和英文字母单独分割）
        const chars: string[] = [];
        for (const char of text) {
            if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
                chars.push(char);
            } else {
                // 标点和空格，附加到上一个字符或单独处理
                if (chars.length > 0) {
                    chars[chars.length - 1] += char;
                } else {
                    chars.push(char);
                }
            }
        }

        // 过滤掉空字符
        const words = chars.filter(word => word.trim().length > 0);
        if (words.length === 0) {
            return subtitle;
        }

        const duration = subtitle.endTime - subtitle.startTime;
        const totalChars = calculateCharCount(text);

        // Create word-level timing (按字符比例分配时间)
        let cumulativeTime = subtitle.startTime;
        const wordsWithTiming = words.map((word, index) => {
            const charCount = calculateCharCount(word);
            const timeRatio = totalChars > 0 ? charCount / totalChars : 1 / words.length;
            const wordDuration = duration * timeRatio;
            const wordStart = cumulativeTime;
            const wordEnd = cumulativeTime + wordDuration;

            cumulativeTime = wordEnd;

            return {
                word,
                start: wordStart,
                end: wordEnd,
                // Calculate position for highlighting
                position: (index / words.length) * 100
            };
        });

        return {
            ...subtitle,
            words: wordsWithTiming,
            // Extract lines for proper display
            lines: extractLines(subtitle.text)
        };
    });

    return processedSubtitles;
};

// Extract lines from subtitle text - supports Chinese and Western languages
// 🔧 修复：按单词边界换行，不拆分单词
const extractLines = (text: string): string[] => {
    const maxLines = 2; // Maximum lines per subtitle
    // 西文每行约 40-50 字符，中文约 20 字符
    const maxCharsPerLine = 45;

    if (!text || text.trim().length === 0) {
        return [];
    }

    // 判断是否主要是中文文本
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const isMostlyChinese = chineseCharCount > text.length * 0.3;

    // 中文文本可以按字符拆分，西文需要按单词拆分
    if (isMostlyChinese) {
        // 中文：按字符拆分，但仍然尊重15字符限制
        const lines: string[] = [];
        let currentLine = '';
        const maxChinese = 20;

        for (const char of text) {
            if (currentLine.length >= maxChinese) {
                lines.push(currentLine);
                currentLine = char;
                if (lines.length >= maxLines) break;
            } else {
                currentLine += char;
            }
        }
        if (currentLine.trim() && lines.length < maxLines) {
            lines.push(currentLine);
        }
        return lines;
    }

    // 西文：按单词边界拆分
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length > maxCharsPerLine && currentLine) {
            // 当前行已满，推入并开始新行
            lines.push(currentLine.trim());
            currentLine = word;

            if (lines.length >= maxLines) {
                break;
            }
        } else {
            currentLine = testLine;
        }
    }

    // 添加最后一行
    if (currentLine.trim() && lines.length < maxLines) {
        lines.push(currentLine.trim());
    }

    console.log('[extractLines] 换行结果:', {
        originalText: text.substring(0, 50) + '...',
        lineCount: lines.length,
        lines: lines.map(l => l.substring(0, 30) + '...')
    });

    return lines;
};

// 创建ASS格式字幕文件
const createASSSubtitle = (subtitles: any[], style: any): string => {
    console.log('[createASSSubtitle] 接收到的完整样式对象:', JSON.stringify(style, null, 2));

    // 设置默认样式
    const defaultStyle = {
        fontName: 'Microsoft YaHei',
        fontSize: 48,
        fontColor: '#FFFFFF',
        outlineColor: '#000000',
        outlineWidth: 2,
        shadowOffset: 0,
        backgroundColor: 'transparent',
        position: 'bottom',
        alignment: 'center'
    };

    const actualStyle = { ...defaultStyle, ...style };

    console.log('[createASSSubtitle] 合并后的样式对象:', JSON.stringify(actualStyle, null, 2));

    // 计算对齐值 - ASS 使用数字键盘布局
    // 7 8 9 (顶部左/中/右)
    // 4 5 6 (中间左/中/右)
    // 1 2 3 (底部左/中/右)
    let alignment = 2; // 默认底部居中
    if (actualStyle.position === 'top') {
        alignment = actualStyle.alignment === 'left' ? 7 : actualStyle.alignment === 'right' ? 9 : 8;
    } else if (actualStyle.position === 'center') {
        alignment = actualStyle.alignment === 'left' ? 4 : actualStyle.alignment === 'right' ? 6 : 5;
    } else { // bottom
        alignment = actualStyle.alignment === 'left' ? 1 : actualStyle.alignment === 'right' ? 3 : 2;
    }

    // 计算边距 - MarginV 对于顶部和底部对齐很重要
    let marginV = 50;
    if (actualStyle.position === 'center') {
        marginV = 0;
    }

    // 转换颜色为ASS格式
    const primaryColor = convertColorToASS(actualStyle.fontColor);
    const outlineColor = convertColorToASS(actualStyle.outlineColor);

    // 处理背景颜色 - 使用 Alpha 通道实现真正的透明效果
    let backColor: string;
    let hasBackground = false;
    if (actualStyle.backgroundColor !== 'transparent' && actualStyle.backgroundOpacity && actualStyle.backgroundOpacity > 0) {
        // 使用指定的背景颜色和透明度（转换百分比为 0-1 范围）
        const bgOpacity = (actualStyle.backgroundOpacity ?? 100) / 100;
        backColor = convertColorToASS(actualStyle.backgroundColor, bgOpacity);
        hasBackground = true;
    } else {
        // 无背景或透明度为 0 时，使用完全透明的背景
        backColor = '&HFFFFFFFF&'; // Alpha = 0xFF 表示完全透明
    }

    // ASS格式的BorderStyle：
    // 1 = 只有描边（Outline），无背景框
    // 3 = 只有背景框（Box），无描边
    // 4 = 既有描边又有背景框
    // 根据是否有背景和描边动态设置
    const hasOutline = actualStyle.outlineWidth && actualStyle.outlineWidth > 0;
    const borderStyle = (hasBackground && hasOutline) ? 4 : (hasBackground ? 3 : 1);

    console.log('[createASSSubtitle] ========== 字幕样式调试 ==========');
    console.log('[createASSSubtitle] 用户选择位置:', actualStyle.position);
    console.log('[createASSSubtitle] ASS Alignment值:', alignment);
    console.log('[createASSSubtitle] ASS MarginV值:', marginV);
    console.log('[createASSSubtitle] 是否有背景:', hasBackground);
    console.log('[createASSSubtitle] BorderStyle:', borderStyle);
    console.log('[createASSSubtitle] BackColour:', backColor);
    console.log('[createASSSubtitle] =====================================');

    // ASS文件头部
    let assContent = `[Script Info]
Title: Generated Subtitle
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${actualStyle.fontName},${actualStyle.fontSize},${primaryColor},&H00FFFFFF,${outlineColor},${backColor},0,0,0,0,100,100,0,0,${borderStyle},${actualStyle.outlineWidth},${actualStyle.shadowOffset},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // 添加字幕事件
    for (const subtitle of subtitles) {
        const start = formatASSTime(subtitle.startTime);
        const end = formatASSTime(subtitle.endTime);

        // 使用已提取的行数限制版本，最多2行
        let text = subtitle.text.trim();
        if (subtitle.lines && subtitle.lines.length > 0) {
            // 使用提取的行，限制为2行最多
            text = subtitle.lines.slice(0, 2).join('\n');
            console.log(`[createASSSubtitle] 字幕 ${subtitle.index}: 原文本 "${subtitle.text}" -> 限制后 "${text}"`);
        } else {
            // 如果没有提取的行，则使用提取函数处理
            const extractedLines = extractLines(text);
            text = extractedLines.length > 0 ? extractedLines.join('\n') : text.substring(0, 40) + '...';
            console.log(`[createASSSubtitle] 字幕 ${subtitle.index}: 动态提取行数 (${extractedLines.length}行)`);
        }

        assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
    }

    return assContent;
};

// Format time for ASS (HH:MM:SS.CS where CS is centiseconds)
const formatASSTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const cs = Math.floor((seconds - Math.floor(seconds)) * 100);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
};

// Apply subtitles to video using FFmpeg
const applySubtitlesToVideo = async (
    videoPath: string,
    outputPath: string,
    subtitles: any[],
    subtitleStyle: any,
    keywordStyle?: any,
    keywordMarkers?: any[],
    keywordGroups?: any[] // 新增参数：关键词分组，用于查找每个marker对应的样式
): Promise<void> => {
    // 创建ASS格式字幕文件而不是SRT，以便更好地控制样式和位置
    const assContent = createASSSubtitle(subtitles, subtitleStyle);
    // 使用视频基础名称作为字幕文件前缀，便于识别对应关系
    const videoBaseName = window.$mapi.file.pathToName(videoPath, false);
    const tempAssPath = await window.$mapi.file.temp("ass", `subtitle_${videoBaseName}`);
    await window.$mapi.file.write(tempAssPath, assContent);

    // 调试：保存一份到项目目录方便查看
    // 调试：保存一份到项目目录方便查看
    // 🔧 修复：使用动态输出目录
    let debugAssPath = 'C:\\aigcpanel-main\\debug_subtitle.ass';
    try {
        if (window.$mapi?.file?.getOutputDir) {
            const outputDir = await window.$mapi.file.getOutputDir();
            debugAssPath = `${outputDir}\\debug_subtitle.ass`;
        }
    } catch (e) {
        console.warn('Get output dir failed, using default');
    }
    console.log('[VideoSubtitle] 准备保存调试文件到:', debugAssPath);
    console.log('[VideoSubtitle] ASS内容长度:', assContent.length);
    console.log('[VideoSubtitle] ASS内容预览:', assContent.substring(0, 500));

    try {
        await window.$mapi.file.write(debugAssPath, assContent);
        console.log('[VideoSubtitle] ===== 调试ASS文件已保存 =====');
        console.log('[VideoSubtitle] 路径:', debugAssPath);
        console.log('[VideoSubtitle] 请打开此文件查看 Style: Default 那一行');
        console.log('[VideoSubtitle] ================================');
    } catch (e: any) {
        console.error('[VideoSubtitle] 保存调试文件失败:', e);
        console.error('[VideoSubtitle] 错误详情:', e.message, e.stack);
    }

    console.log('[VideoSubtitle] 使用ASS字幕文件:', tempAssPath);
    console.log('[VideoSubtitle] 字幕样式:', JSON.stringify(subtitleStyle, null, 2));

    // Build filter complex to combine subtitles and keyword effects
    const hasKeywordEffects = keywordMarkers && keywordMarkers.length > 0 && keywordStyle;

    console.log('[VideoSubtitle] hasKeywordEffects:', hasKeywordEffects);
    console.log('[VideoSubtitle] keywordMarkers:', keywordMarkers);
    console.log('[VideoSubtitle] keywordStyle:', keywordStyle);

    let ffmpegParams: string[];

    if (hasKeywordEffects) {
        // 构建组合滤镜: 字幕 + 关键词特效
        const drawtextFilters: string[] = [];

        // 记录已分配的特效字幕位置，用于碰撞检测
        const allocatedEffectPositions: Array<{ y: number, height: number, keyword: string }> = [];

        for (const marker of keywordMarkers!) {
            if (!marker.enabled) continue;

            const keyword = marker.keyword || '';
            if (!keyword) continue;  // 跳过空关键词

            const timestamp = marker.timestamp || 0;
            const duration = marker.duration || 2.0;
            const endTime = timestamp + duration;
            const posX = marker.position?.x || 50;
            const posY = marker.position?.y || 75;

            // 获取关键词样式 - 优先使用marker所属分组的样式，其次使用统一的keywordStyle，最后使用默认值
            let markerStyle = { fontSize: 72, fontColor: '#FFD700', outlineColor: '#000000', outlineWidth: 3 };

            // 如果marker有groupId，查找对应分组的样式
            if (marker.groupId && keywordGroups && keywordGroups.length > 0) {
                const group = keywordGroups.find((g: any) => g.id === marker.groupId);
                if (group && group.styleOverride) {
                    markerStyle = {
                        fontSize: group.styleOverride.fontSize || 72,
                        fontColor: group.styleOverride.fontColor || '#FFD700',
                        outlineColor: group.styleOverride.outlineColor || '#000000',
                        outlineWidth: group.styleOverride.outlineWidth || 3
                    };
                }
            } else if (keywordStyle) {
                // 没有分组信息，使用统一的keywordStyle
                markerStyle = {
                    fontSize: keywordStyle.fontSize || 72,
                    fontColor: keywordStyle.fontColor || '#FFD700',
                    outlineColor: keywordStyle.outlineColor || '#000000',
                    outlineWidth: keywordStyle.outlineWidth || 3
                };
            }

            const fontSize = markerStyle.fontSize;
            const fontColor = markerStyle.fontColor;
            const outlineColor = markerStyle.outlineColor;
            const outlineWidth = markerStyle.outlineWidth;

            // 新增：支持shadowColor, shadowBlur, effectId, effectDuration, fontName 参数
            const shadowColor = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.shadowColor || '#000000'
                : keywordStyle?.shadowColor || '#000000';
            const shadowBlur = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.shadowBlur || 0
                : keywordStyle?.shadowBlur || 0;
            const effectId = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.effectId || 'none'
                : keywordStyle?.effectId || 'none';
            const effectDuration = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.effectDuration || 2.0
                : keywordStyle?.effectDuration || 2.0;
            const fontName = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.fontName || 'Microsoft YaHei'
                : keywordStyle?.fontName || 'Microsoft YaHei';

            // 获取字体路径 - 优先使用配置中的 fontPath（项目内置字体）
            const rawFontPath = (marker.groupId && keywordGroups)
                ? keywordGroups.find((g: any) => g.id === marker.groupId)?.styleOverride?.fontPath
                : keywordStyle?.fontPath;

            // 使用 DrawtextGenerator.escapePath 转义路径中的冒号
            const fontPath = DrawtextGenerator.escapePath(rawFontPath || 'C:/Windows/Fonts/msyh.ttc');

            // 计算特效字幕的宽度（用于智能位置分配）
            const effectWidth = calculateSubtitleWidth(keyword, fontSize);
            const horizontalGap = fontSize * 0.5;
            const screenWidth = 1920;

            // 假设普通字幕宽度
            const normalSubtitleStartX = (screenWidth * posX / 100) - (effectWidth / 2);
            const normalSubtitleWidth = 400;

            // 应用智能位置分配
            const positionResult = allocateEffectSubtitlePosition(
                normalSubtitleStartX,
                normalSubtitleWidth,
                effectWidth,
                horizontalGap,
                screenWidth
            );

            let finalPosX = posX;
            let finalPosY = posY;

            if (positionResult.moveAbove) {
                // 根据字号动态计算内容高度，而非固定偏移
                const contentHeight = fontSize * 1.2;  // 考虑行间距
                let adjustedY = posY - (contentHeight / 100) * 10;  // 需要转换为百分比

                // 检查与已分配的特效字幕是否重叠
                for (const allocated of allocatedEffectPositions) {
                    const yPercent = (adjustedY / 100) * 1080;  // 假设视频高度1080
                    const allocatedYPixel = (allocated.y / 100) * 1080;
                    const verticalGap = fontSize * 1.2;

                    if (Math.abs(yPercent - allocatedYPixel) < allocated.height + verticalGap) {
                        // 有重叠，继续上移
                        adjustedY = Math.max(5, allocated.y - (fontSize / 1080) * 100);
                    }
                }

                finalPosY = Math.max(5, adjustedY);
                console.log(`[VideoSubtitle] 关键词'${keyword}'位置已上移至上方 (Y: ${finalPosY}%)`);
            } else {
                finalPosX = (positionResult.x / screenWidth) * 100;
                console.log(`[VideoSubtitle] 关键词'${keyword}'位置保持同行 (X: ${finalPosX}%)`);
            }

            // 记录已分配的位置，用于后续碰撞检测
            allocatedEffectPositions.push({
                y: finalPosY,
                height: fontSize,
                keyword: keyword
            });

            // FFmpeg drawtext需要转义特殊字符
            const escapedKeyword = keyword.replace(/'/g, "\\'").replace(/:/g, "\\:");

            // 调试日志: 记录参数转换过程
            console.log(`[VideoSubtitle] 关键词'${keyword}'参数配置:`, {
                fontSize,
                fontColor,
                fontName,
                fontPath,
                shadowColor,
                shadowBlur,
                effectId,
                effectDuration,
                originalPosition: { x: posX, y: posY },
                finalPosition: { x: finalPosX, y: finalPosY }
            });

            // 构建drawtext滤镜
            // 注意: enable表达式中的逗号需要用\转义
            const escapedFontPath = DrawtextGenerator.escapePath(fontPath);
            let filter = `drawtext=` +
                `fontfile=${escapedFontPath}:` +
                `text='${escapedKeyword}':` +
                `fontsize=${fontSize}:` +
                `fontcolor=${hexToRGB(fontColor)}:` +
                `borderw=${outlineWidth}:` +
                `bordercolor=${hexToRGB(outlineColor)}:` +
                `x=(w-text_w)*${finalPosX}/100:` +
                `y=(h-text_h)*${finalPosY}/100:` +
                `enable='between(t\\,${timestamp}\\,${endTime})'`;

            // 添加阴影效果（如果配置了）
            if (shadowBlur > 0) {
                // shadowBlur范围内动态调整阴影偏移
                const shadowOffset = Math.max(1, Math.ceil(shadowBlur / 10));
                filter += `:shadowcolor=${hexToRGB(shadowColor)}:shadowx=${shadowOffset}:shadowy=${shadowOffset}`;
                console.log(`[VideoSubtitle] 关键词'${keyword}'应用阴影效果: blur=${shadowBlur}, offset=${shadowOffset}`);
            }

            drawtextFilters.push(filter);
        }

        if (drawtextFilters.length > 0) {
            // 构建完整的滤镜链: ass -> drawtext1 -> drawtext2 -> ...
            // 使用ass滤镜而不是subtitles，这样可以完全控制样式
            // Windows路径需要转义
            const escapedAssPath = tempAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            const subtitleFilter = `ass='${escapedAssPath}'`;
            const fullFilter = `${subtitleFilter},${drawtextFilters.join(',')}`;

            console.log('[VideoSubtitle] Keyword effects enabled, filter count:', drawtextFilters.length);
            console.log('[VideoSubtitle] Full filter:', fullFilter);

            ffmpegParams = [
                '-i', videoPath,
                '-vf', fullFilter,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '18',
                '-c:a', 'copy',
                '-y', outputPath
            ];

            console.log('[VideoSubtitle] FFmpeg params:', ffmpegParams.join(' '));
        } else {
            // 没有有效的关键词标记,只使用基础字幕
            const escapedAssPath = tempAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            ffmpegParams = [
                '-i', videoPath,
                '-vf', `ass='${escapedAssPath}'`,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '18',
                '-c:a', 'copy',
                '-y', outputPath
            ];
        }
    } else {
        // 只有基础字幕,没有关键词特效
        // 使用drawtext滤镜代替ass，以支持真正的背景透明度
        const drawtextFilter = buildDrawtextFilter(processedSubtitles, subtitleStyle);

        console.log('[VideoSubtitle] Drawtext滤镜已生成:');
        console.log('[VideoSubtitle] 滤镜字符串:', drawtextFilter);
        console.log('[VideoSubtitle] 样式参数:', JSON.stringify(subtitleStyle, null, 2));

        ffmpegParams = [
            '-i', videoPath,
            '-vf', drawtextFilter,
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-c:a', 'copy',
            '-y', outputPath
        ];

        console.log('[VideoSubtitle] FFmpeg完整命令:', ffmpegParams.join(' '));
    }

    await window.$mapi.shell.execFFmpegCommand(ffmpegParams);
};

// Build subtitle filter for FFmpeg based on subtitle style
const buildSubtitleFilter = (srtPath: string, style: any): string[] => {
    if (!style) {
        // 默认样式
        return ['-vf', `subtitles=${srtPath}`];
    }

    // 根据选中的样式构建FFmpeg force_style参数
    const styleParams = [];

    if (style.fontName) {
        styleParams.push(`FontName=${style.fontName}`);
    }

    if (style.fontSize) {
        styleParams.push(`FontSize=${style.fontSize}`);
    }

    if (style.fontColor) {
        // 转换颜色格式: #FFFFFF -> &H00FFFFFF& (ASS格式)
        const assColor = convertColorToASS(style.fontColor);
        styleParams.push(`PrimaryColour=${assColor}`);
    }

    if (style.outlineColor) {
        const assOutlineColor = convertColorToASS(style.outlineColor);
        styleParams.push(`OutlineColour=${assOutlineColor}`);
    }

    if (style.outlineWidth) {
        styleParams.push(`Outline=${style.outlineWidth}`);
    }

    if (style.shadowOffset) {
        styleParams.push(`Shadow=${style.shadowOffset}`);
    }

    // 处理背景颜色 - 使用透明度
    if (style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundOpacity && style.backgroundOpacity > 0) {
        const bgOpacity = (style.backgroundOpacity ?? 100) / 100;
        const assBackColor = convertColorToASS(style.backgroundColor, bgOpacity);
        styleParams.push(`BackColour=${assBackColor}`);
    }

    // 位置对齐 - ASS字幕使用数字键盘布局(1-9)
    let alignment = 2; // 默认底部居中
    let marginV = 50; // 默认边距

    if (style.position === 'top') {
        alignment = style.alignment === 'left' ? 7 : style.alignment === 'right' ? 9 : 8;
        marginV = 50; // 顶部边距 - 从顶部向下的距离
    } else if (style.position === 'center') {
        alignment = style.alignment === 'left' ? 4 : style.alignment === 'right' ? 6 : 5;
        marginV = 0; // 居中时不需要边距
    } else { // bottom
        alignment = style.alignment === 'left' ? 1 : style.alignment === 'right' ? 3 : 2;
        marginV = 50; // 底部边距 - 从底部向上的距离
    }

    console.log(`[buildSubtitleFilter] Position: ${style.position}, Alignment: ${alignment}, MarginV: ${marginV}`);

    styleParams.push(`Alignment=${alignment}`);
    styleParams.push(`MarginV=${marginV}`);

    const forceStyleStr = styleParams.join(',');

    return ['-vf', `subtitles=${srtPath}:force_style='${forceStyleStr}'`];
};

// Build subtitle filter string (for combining with other filters)
const buildSubtitleFilterString = (srtPath: string, style: any): string => {
    console.log('[buildSubtitleFilterString] 输入参数:', { srtPath, style });

    if (!style) {
        console.warn('[buildSubtitleFilterString] 警告: style参数为空,使用默认样式');
        return `subtitles=${srtPath}`;
    }

    // 根据选中的样式构建FFmpeg force_style参数
    const styleParams = [];

    if (style.fontName) {
        styleParams.push(`FontName=${style.fontName}`);
    }

    if (style.fontSize) {
        styleParams.push(`FontSize=${style.fontSize}`);
    }

    if (style.fontColor) {
        const assColor = convertColorToASS(style.fontColor);
        styleParams.push(`PrimaryColour=${assColor}`);
    }

    if (style.outlineColor) {
        const assOutlineColor = convertColorToASS(style.outlineColor);
        styleParams.push(`OutlineColour=${assOutlineColor}`);
    }

    if (style.outlineWidth) {
        styleParams.push(`Outline=${style.outlineWidth}`);
    }

    if (style.shadowOffset) {
        styleParams.push(`Shadow=${style.shadowOffset}`);
    }

    // 处理背景颜色 - 使用透明度
    if (style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundOpacity && style.backgroundOpacity > 0) {
        const bgOpacity = (style.backgroundOpacity ?? 100) / 100;
        const assBackColor = convertColorToASS(style.backgroundColor, bgOpacity);
        styleParams.push(`BackColour=${assBackColor}`);
    }

    // 位置对齐 - ASS字幕使用数字键盘布局(1-9)
    let alignment = 2; // 默认底部居中
    let marginV = 50; // 默认边距

    if (style.position === 'top') {
        alignment = style.alignment === 'left' ? 7 : style.alignment === 'right' ? 9 : 8;
        marginV = 50; // 顶部边距 - 从顶部向下的距离
    } else if (style.position === 'center') {
        alignment = style.alignment === 'left' ? 4 : style.alignment === 'right' ? 6 : 5;
        marginV = 0; // 居中时不需要边距
    } else { // bottom
        alignment = style.alignment === 'left' ? 1 : style.alignment === 'right' ? 3 : 2;
        marginV = 50; // 底部边距 - 从底部向上的距离
    }

    console.log(`[buildSubtitleFilterString] Position: ${style.position}, Alignment: ${alignment}, MarginV: ${marginV}`);

    styleParams.push(`Alignment=${alignment}`);
    styleParams.push(`MarginV=${marginV}`);

    const forceStyleStr = styleParams.join(',');
    const filterString = `subtitles=${srtPath}:force_style='${forceStyleStr}'`;

    console.log('[buildSubtitleFilterString] 生成的filter:', filterString);
    console.log('[buildSubtitleFilterString] 样式参数数量:', styleParams.length);

    return filterString;
};

// 将Hex颜色转换为RGB格式 (用于FFmpeg drawtext)
const hexToRGB = (hex: string): string => {
    if (!hex || !hex.startsWith('#')) {
        return 'white';
    }

    hex = hex.substring(1);
    if (hex.length !== 6) {
        return 'white';
    }

    return `0x${hex}`;  // FFmpeg接受0xRRGGBB格式
};

// 构建drawtext滤镜字符串，支持背景透明度
// drawtext滤镜通过boxcolor参数的@alpha语法支持透明度
const buildDrawtextFilter = (subtitles: any[], style: any): string => {
    if (!subtitles || subtitles.length === 0) {
        console.log('[buildDrawtextFilter] 没有字幕数据');
        return '';
    }

    console.log('[buildDrawtextFilter] 开始构建drawtext滤镜，字幕数量:', subtitles.length);
    console.log('[buildDrawtextFilter] 样式参数:', {
        fontName: style?.fontName,
        fontSize: style?.fontSize,
        fontColor: style?.fontColor,
        backgroundColor: style?.backgroundColor,
        backgroundOpacity: style?.backgroundOpacity,
        position: style?.position
    });

    // 构建多个drawtext滤镜，按时间显示不同的字幕
    const filters: string[] = [];

    // 字体路径 - 需要使用 DrawtextGenerator.escapePath 转义冒号
    const rawFontPath = style?.fontName || 'C:/Windows/Fonts/msyh.ttc';
    const fontPath = DrawtextGenerator.escapePath(rawFontPath);
    const fontSize = style?.fontSize || 48;
    const fontColor = style?.fontColor?.replace('#', '') || 'FFFFFF'; // RGB格式
    const backgroundColor = style?.backgroundColor?.replace('#', '') || '000000';

    // 计算背景透明度 (0-1范围)
    const bgOpacityPercent = (style?.backgroundOpacity ?? 100) / 100;
    const bgOpacity = Math.min(1.0, Math.max(0, bgOpacityPercent));

    console.log('[buildDrawtextFilter] 解析参数:');
    console.log('  - 字体:', fontPath);
    console.log('  - 字号:', fontSize);
    console.log('  - 字色:', fontColor);
    console.log('  - 背景色:', backgroundColor);
    console.log('  - 背景透明度:', bgOpacity, '(从', bgOpacityPercent, '转换)');

    // 位置计算
    const position = style?.position || 'bottom';
    let yExpr = '(h-text_h-50)'; // 默认底部
    if (position === 'top') {
        yExpr = '50';
    } else if (position === 'center') {
        yExpr = '(h-text_h)/2';
    }

    console.log('  - 位置:', position, ', Y表达式:', yExpr);

    // 为每个字幕构建drawtext滤镜
    for (let i = 0; i < subtitles.length; i++) {
        const subtitle = subtitles[i];

        // 使用提取的行数限制，最多2行
        let lines: string[] = [];
        if (subtitle.lines && subtitle.lines.length > 0) {
            lines = subtitle.lines.slice(0, 2);
            console.log(`[buildDrawtextFilter] 字幕${i + 1}: 使用提取的${subtitle.lines.length}行`);
        } else {
            // 如果没有提取的行，则动态提取
            lines = extractLines(subtitle.text);
            console.log(`[buildDrawtextFilter] 字幕${i + 1}: 动态提取${lines.length}行`);
        }

        const startTime = subtitle.startTime || 0;
        const endTime = subtitle.endTime || 10;

        // 获取描边参数
        const outlineWidth = style?.outlineWidth || 2;
        const outlineColor = style?.outlineColor?.replace('#', '') || '000000';

        // 🔧 修复：为每行创建单独的 drawtext 滤镜，设置不同的 y 位置
        const lineHeight = Math.floor(fontSize * 1.3); // 行高 = 字号 * 1.3

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineText = lines[lineIndex].replace(/'/g, "\\'").replace(/:/g, "\\:") || '';
            if (!lineText.trim()) continue;

            // 计算每行的 y 位置
            // 底部对齐时：第一行在上，第二行在下
            // 行间距 = lineHeight
            let lineYExpr: string;
            if (position === 'bottom') {
                // 底部：从底部往上排列
                // 第一行（lineIndex=0）在上面，第二行（lineIndex=1）在下面
                const offsetFromBottom = (lines.length - 1 - lineIndex) * lineHeight + 50;
                lineYExpr = `(h-text_h-${offsetFromBottom})`;
            } else if (position === 'top') {
                // 顶部：从顶部往下排列
                const offsetFromTop = lineIndex * lineHeight + 50;
                lineYExpr = `${offsetFromTop}`;
            } else {
                // 居中
                const totalHeight = lines.length * lineHeight;
                const startY = `(h-${totalHeight})/2`;
                lineYExpr = `${startY}+${lineIndex * lineHeight}`;
            }

            const filter = `drawtext=` +
                `fontfile=${fontPath}:` +
                `text='${lineText}':` +
                `fontsize=${fontSize}:` +
                `fontcolor=0x${fontColor}:` +
                `borderw=${outlineWidth}:` +
                `bordercolor=0x${outlineColor}:` +
                `box=1:` +
                `boxcolor=0x${backgroundColor}@${bgOpacity.toFixed(2)}:` +
                `boxborderw=3:` +
                `x='(w-text_w)/2':` +
                `y='${lineYExpr}':` +
                `enable='between(t\\\\,${startTime}\\\\,${endTime})'`;

            console.log(`[buildDrawtextFilter] 字幕${i + 1} 行${lineIndex + 1}:`, {
                text: lineText.substring(0, 30),
                yExpr: lineYExpr
            });

            filters.push(filter);
        }
    }

    // 合并所有drawtext滤镜
    const result = filters.join(',');
    console.log('[buildDrawtextFilter] 最终滤镜链长度:', result.length);
    console.log('[buildDrawtextFilter] 完成');

    return result;
};

// 转换颜色格式从 #RRGGBB 到 ASS 格式 &HAABBGGRR&
// 支持透明度参数 (0-1)，其中 0 = 完全透明，1 = 完全不透明
const convertColorToASS = (hexColor: string, opacity?: number): string => {
    if (!hexColor || !hexColor.startsWith('#')) {
        return '&H00FFFFFF&'; // 默认白色，完全不透明
    }

    const hex = hexColor.substring(1);
    if (hex.length !== 6) {
        return '&H00FFFFFF&';
    }

    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);

    // 计算 Alpha 值
    // 在 ASS 格式中：0x00 = 完全不透明，0xFF = 完全透明
    // opacity 范围：0 (完全透明) - 1 (完全不透明)
    // 所以 Alpha = (1 - opacity) * 255
    const alpha = opacity !== undefined
        ? Math.round((1 - Math.max(0, Math.min(1, opacity))) * 255)
        : 0; // 默认完全不透明

    const alphaHex = alpha.toString(16).toUpperCase().padStart(2, '0');

    if (opacity !== undefined) {
        console.log(`[convertColorToASS] 颜色: ${hexColor}, 透明度: ${opacity}, Alpha: 0x${alphaHex}`);
    }

    // ASS格式是ABGR顺序 &HAABBGGRR&
    return `&H${alphaHex}${b}${g}${r}&`;
};

// ============ 问题3: 特效字幕参数修复与字体支持 ============
// 计算文本的像素宽度（用于位置智能分配）
const calculateSubtitleWidth = (text: string, fontSize: number): number => {
    let width = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
            // 中文字符 ≈ fontSize * 0.8
            width += fontSize * 0.8;
        } else if (/[a-zA-Z0-9]/.test(char)) {
            // 英文字符 ≈ fontSize * 0.5
            width += fontSize * 0.5;
        } else {
            // 其他字符 ≈ fontSize * 0.3
            width += fontSize * 0.3;
        }
    }
    return width;
};

// ============ 问题2: 特效与普通字幕位置智能分配 ============
// 判断特效字幕是否需要上移到普通字幕上方
const allocateEffectSubtitlePosition = (
    normalSubtitleX: number,
    normalSubtitleWidth: number,
    effectWidth: number,
    horizontalGap: number,
    screenWidth: number
): { x: number; moveAbove: boolean } => {
    const normalEndX = normalSubtitleX + normalSubtitleWidth;
    const availableSpace = screenWidth - normalEndX;
    const requiredSpace = effectWidth + horizontalGap;

    console.log(`[allocateEffectSubtitlePosition] 位置分配计算:`, {
        normalSubtitleX,
        normalSubtitleWidth,
        normalEndX,
        screenWidth,
        availableSpace,
        effectWidth,
        requiredSpace,
        needMoveAbove: availableSpace < requiredSpace
    });

    if (availableSpace >= requiredSpace) {
        // 同一行显示：特效字幕在普通字幕右侧
        return { x: normalEndX + horizontalGap, moveAbove: false };
    } else {
        // 空间不足：特效字幕上移至普通字幕上方
        return { x: normalSubtitleX, moveAbove: true };
    }
};

// ============ 问题1: 字幕分组与时间分配 ============
// 根据FUNASR字级时间点分组和分配时间
const groupAndAllocateSubtitles = (
    content: string,
    funasrData: any[],
    maxCharsPerLine: number = 8,
    maxLines: number = 2,
    minDisplayTime: number = 0.2
): any[] => {
    console.log('[groupAndAllocateSubtitles] 开始字幕分组，内容:', content);
    console.log('[groupAndAllocateSubtitles] FUNASR数据数量:', funasrData.length);

    const maxCharsPerGroup = maxCharsPerLine * maxLines; // 16字
    const result: any[] = [];

    if (funasrData.length === 0) {
        // 没有FUNASR数据，返回原始内容
        console.warn('[groupAndAllocateSubtitles] 警告：FUNASR数据为空，返回原始内容');
        return [{
            index: 1,
            text: content,
            startTime: 0,
            endTime: 5,  // 默认5秒
            words: [],
            lines: extractLines(content)
        }];
    }

    let groupStart = 0;
    let currentStartTime = funasrData[0]?.start || 0;
    let groupIndex = 1;

    while (groupStart < content.length) {
        const groupEnd = Math.min(groupStart + maxCharsPerGroup, content.length);
        const groupText = content.substring(groupStart, groupEnd);

        // 根据FUNASR找到这组文本对应的时间范围
        let groupStartTime = currentStartTime;
        let groupEndTime = funasrData[Math.min(groupEnd, funasrData.length - 1)]?.end ||
            (currentStartTime + 2);

        let displayTime = groupEndTime - groupStartTime;

        // 确保最小显示时长（200ms）
        if (displayTime < minDisplayTime) {
            displayTime = minDisplayTime;
            groupEndTime = groupStartTime + minDisplayTime;
        }

        console.log(`[groupAndAllocateSubtitles] 组${groupIndex}:`, {
            text: groupText,
            charCount: groupText.length,
            timeRange: { start: groupStartTime.toFixed(2), end: groupEndTime.toFixed(2) },
            displayTime: displayTime.toFixed(2)
        });

        // 计算字符数（中文和英文）
        const calculateCharCount = (text: string): number => {
            let count = 0;
            for (const char of text) {
                if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
                    count += 1;
                }
            }
            return count;
        };

        // 生成word-level timing
        const chars = groupText.split('');
        const words = chars.filter(word => word.trim().length > 0);

        let wordsWithTiming: any[] = [];
        if (words.length > 0) {
            const duration = groupEndTime - groupStartTime;
            const totalChars = calculateCharCount(groupText);

            let cumulativeTime = groupStartTime;
            wordsWithTiming = words.map((word, index) => {
                const charCount = calculateCharCount(word);
                const timeRatio = totalChars > 0 ? charCount / totalChars : 1 / words.length;
                const wordDuration = duration * timeRatio;
                const wordStart = cumulativeTime;
                const wordEnd = cumulativeTime + wordDuration;

                cumulativeTime = wordEnd;

                return {
                    word,
                    start: wordStart,
                    end: wordEnd,
                    position: (index / words.length) * 100
                };
            });
        }

        result.push({
            index: groupIndex,
            text: groupText,
            startTime: groupStartTime,
            endTime: groupEndTime,
            words: wordsWithTiming,
            lines: extractLines(groupText)
        });

        groupStart = groupEnd;
        currentStartTime = groupEndTime;
        groupIndex++;
    }

    console.log('[groupAndAllocateSubtitles] 分组完成，共', result.length, '组');
    return result;
};

// Format time for SRT
function formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
