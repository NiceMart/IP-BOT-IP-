import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import logger from '../log/main';
import { getFFmpegPath, getFFprobePath } from '../shell';

const execFileAsync = promisify(execFile);

/**
 * 音频片段信息
 */
export interface AudioSegment {
    startTime: number;  // 开始时间（秒）
    endTime: number;    // 结束时间（秒）
    duration: number;   // 持续时间（秒）
}

/**
 * 音量检测结果
 */
export interface VolumeDetectResult {
    success: boolean;
    segments: AudioSegment[];  // 有声音的时间段
    totalDuration: number;     // 总时长
    error?: string;
}

/**
 * 音量检测配置
 */
export interface VolumeDetectConfig {
    silenceThreshold: number;  // 静音阈值（dB），默认 -40dB
    minSilenceDuration: number; // 最小静音时长（秒），默认 0.5s
    minSoundDuration: number;   // 最小有声时长（秒），默认 0.3s
}

/**
 * 使用 FFmpeg silencedetect 滤镜检测音频中的声音片段
 */
export async function detectAudioSegments(
    audioOrVideoPath: string,
    config: Partial<VolumeDetectConfig> = {}
): Promise<VolumeDetectResult> {
    const defaultConfig: VolumeDetectConfig = {
        silenceThreshold: -40,
        minSilenceDuration: 0.5,
        minSoundDuration: 0.3
    };

    const finalConfig = { ...defaultConfig, ...config };

    logger.info('[VolumeDetect] 开始音量检测', {
        file: path.basename(audioOrVideoPath),
        config: finalConfig
    });

    try {
        // 先获取总时长
        const duration = await getMediaDuration(audioOrVideoPath);

        if (!duration || isNaN(duration) || duration <= 0) {
            throw new Error(`无效的媒体时长: ${duration}`);
        }

        logger.info(`[VolumeDetect] 媒体总时长: ${duration.toFixed(2)}秒`);

        // 使用 silencedetect 滤镜检测静音段
        // 输出格式: silence_start: 12.345 silence_end: 15.678 | silence_duration: 3.333
        const ffmpegPath = await getFFmpegPath();

        const args = [
            '-i', audioOrVideoPath,
            '-af', `silencedetect=noise=${finalConfig.silenceThreshold}dB:d=${finalConfig.minSilenceDuration}`,
            '-f', 'null',
            '-'
        ];

        logger.info(`[VolumeDetect] FFmpeg 命令: ${ffmpegPath} ${args.join(' ')}`);

        const { stdout, stderr } = await execFileAsync(ffmpegPath, args, {
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        // silencedetect 的输出在 stderr 中
        const output = stderr;

        // 解析静音段
        const silenceSegments = parseSilenceDetectOutput(output);
        logger.info(`[VolumeDetect] 检测到 ${silenceSegments.length} 个静音段`);

        // 从静音段反推有声段
        const soundSegments = invertSilenceToSound(silenceSegments, duration, finalConfig.minSoundDuration);
        logger.info(`[VolumeDetect] 识别到 ${soundSegments.length} 个有声段`);

        // 输出详细信息
        console.log('\n========== 🔊 音量检测结果 ==========');
        console.log(`总时长: ${duration.toFixed(2)}秒`);
        console.log(`检测到的静音段: ${silenceSegments.length}个`);
        silenceSegments.forEach((seg, idx) => {
            console.log(`  静音${idx + 1}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s`);
        });
        console.log(`检测到的有声段: ${soundSegments.length}个`);
        soundSegments.forEach((seg, idx) => {
            logger.info(`[VolumeDetect] 片段${idx + 1}: ${seg.startTime.toFixed(2)}s - ${seg.endTime.toFixed(2)}s (${seg.duration.toFixed(2)}s)`);
            console.log(`  有声${idx + 1}: ${seg.startTime.toFixed(2)}s - ${seg.endTime.toFixed(2)}s (${seg.duration.toFixed(2)}s)`);
        });
        console.log('====================================\n');

        return {
            success: true,
            segments: soundSegments,
            totalDuration: duration
        };

    } catch (error: any) {
        logger.error('[VolumeDetect] 音量检测失败', error);
        console.error('[VolumeDetect] ❌ 音量检测失败:', error);
        console.error('[VolumeDetect] 错误堆栈:', error.stack);
        console.error('[VolumeDetect] 文件路径:', audioOrVideoPath);

        return {
            success: false,
            segments: [],
            totalDuration: 0,
            error: error.message || error.toString()
        };
    }
}

/**
 * 获取媒体文件时长
 */
async function getMediaDuration(filePath: string): Promise<number> {
    const ffprobePath = await getFFprobePath();

    const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath
    ];

    logger.info(`[VolumeDetect] 获取媒体时长: ${filePath}`);
    logger.info(`[VolumeDetect] ffprobe路径: ${ffprobePath}`);

    const { stdout, stderr } = await execFileAsync(ffprobePath, args);

    logger.info(`[VolumeDetect] ffprobe输出: ${stdout.trim()}`);
    if (stderr) {
        logger.warn(`[VolumeDetect] ffprobe错误输出: ${stderr}`);
    }

    const duration = parseFloat(stdout.trim());

    if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
        const errorMsg = `获取媒体时长失败: ffprobe返回了无效值 "${stdout.trim()}"`;
        logger.error(`[VolumeDetect] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    return duration;
}

/**
 * 解析 silencedetect 输出
 */
function parseSilenceDetectOutput(output: string): Array<{ start: number; end: number }> {
    const silenceSegments: Array<{ start: number; end: number }> = [];
    const lines = output.split('\n');

    let currentStart: number | null = null;

    for (const line of lines) {
        // silence_start: 12.345
        const startMatch = line.match(/silence_start:\s+([\d.]+)/);
        if (startMatch) {
            currentStart = parseFloat(startMatch[1]);
        }

        // silence_end: 15.678 | silence_duration: 3.333
        const endMatch = line.match(/silence_end:\s+([\d.]+)/);
        if (endMatch && currentStart !== null) {
            const end = parseFloat(endMatch[1]);
            silenceSegments.push({ start: currentStart, end });
            currentStart = null;
        }
    }

    return silenceSegments;
}

/**
 * 从静音段反推有声段
 */
function invertSilenceToSound(
    silenceSegments: Array<{ start: number; end: number }>,
    totalDuration: number,
    minSoundDuration: number
): AudioSegment[] {
    const soundSegments: AudioSegment[] = [];

    // 如果没有静音段，说明整个音频都有声音
    if (silenceSegments.length === 0) {
        return [{
            startTime: 0,
            endTime: totalDuration,
            duration: totalDuration
        }];
    }

    // 第一个有声段：从 0 到第一个静音段开始
    console.log(`[invertSilenceToSound] 检查第一个有声段: silenceSegments[0].start=${silenceSegments[0].start}, minSoundDuration=${minSoundDuration}`);
    if (silenceSegments[0].start > minSoundDuration) {
        console.log(`[invertSilenceToSound] ✅ 添加第一个有声段: 0.00s - ${silenceSegments[0].start.toFixed(2)}s`);
        soundSegments.push({
            startTime: 0,
            endTime: silenceSegments[0].start,
            duration: silenceSegments[0].start
        });
    } else {
        console.log(`[invertSilenceToSound] ⚠️ 跳过第一个有声段（太短）`);
    }

    // 中间的有声段：从一个静音段结束到下一个静音段开始
    for (let i = 0; i < silenceSegments.length - 1; i++) {
        const start = silenceSegments[i].end;
        const end = silenceSegments[i + 1].start;
        const duration = end - start;

        if (duration >= minSoundDuration) {
            soundSegments.push({
                startTime: start,
                endTime: end,
                duration
            });
        }
    }

    // 最后一个有声段：从最后一个静音段结束到总时长
    const lastSilence = silenceSegments[silenceSegments.length - 1];
    if (totalDuration - lastSilence.end >= minSoundDuration) {
        soundSegments.push({
            startTime: lastSilence.end,
            endTime: totalDuration,
            duration: totalDuration - lastSilence.end
        });
    }

    return soundSegments;
}

/**
 * 将文本按照音频片段自动分配时间
 * @param text 文案内容（支持换行分割）
 * @param segments 音频片段列表
 * @returns 带有时间的字幕数据
 */
export function allocateTextToSegments(
    text: string,
    segments: AudioSegment[]
): Array<{
    index: number;
    text: string;
    startTime: number;
    endTime: number;
}> {
    // 按换行符或句号分割文本
    // 🔧 修复：不使用 \s（会匹配空格），改用 \n（只匹配换行）
    // 这样俄语、英语等语言不会被分割成单个单词
    const lines = text
        .split(/[\n。！？.!?]+/)  // 只按换行符和句号等标点分割
        .map(line => line.trim())
        .filter(line => line.length > 0);

    try {

    logger.info(`[VolumeDetect] 文案内容分割成 ${lines.length} 条，音频片段 ${segments.length} 个`);

    console.log('\n========== 📄 文本分割结果 ==========');
    console.log(`原始文本长度: ${text.length}字符`);
    console.log(`分割后行数: ${lines.length}行`);
    console.log(`音频片段数: ${segments.length}个`);
    console.log('前5行预览:');
    try {
        lines.slice(0, 5).forEach((line, idx) => {
            console.log(`  行${idx + 1}: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);
        });
    } catch (e: any) {
        console.error('前5行预览失败:', e.message);
    }
    console.log('=====================================\n');

    // 🔧 验证segments数据完整性
    console.log('\n========== 🔍 Segments数据验证 ==========');
    const invalidSegments = segments.filter((seg, idx) => {
        const hasStartTime = typeof seg.startTime === 'number' && !isNaN(seg.startTime);
        const hasEndTime = typeof seg.endTime === 'number' && !isNaN(seg.endTime);
        const hasDuration = typeof seg.duration === 'number' && !isNaN(seg.duration);
        if (!hasStartTime || !hasEndTime || !hasDuration) {
            console.error(`⚠️ 片段${idx + 1}数据异常:`, {
                startTime: seg.startTime,
                endTime: seg.endTime,
                duration: seg.duration,
                hasStartTime,
                hasEndTime,
                hasDuration
            });
            return true;
        }
        return false;
    });
    if (invalidSegments.length > 0) {
        throw new Error(`发现${invalidSegments.length}个无效的音频片段`);
    }
    console.log('✅ 所有segments数据验证通过');
    console.log('========================================\n');

    // 如果没有检测到音频片段，平均分配时间
    if (segments.length === 0) {
        logger.warn('[VolumeDetect] 没有检测到音频片段，使用平均时间分配');
        const defaultDuration = 3; // 每行默认 3 秒
        return lines.map((line, index) => ({
            index: index + 1,
            text: line.trim(),
            startTime: index * defaultDuration,
            endTime: (index + 1) * defaultDuration
        }));
    }

    const result: Array<{
        index: number;
        text: string;
        startTime: number;
        endTime: number;
    }> = [];

    // 策略 1: 文本行数和音频片段数接近，一一对应
    if (Math.abs(lines.length - segments.length) <= 2) {
        logger.info('[VolumeDetect] 使用一一对应策略分配字幕');
        console.log(`\n🎯 使用一一对应策略: ${lines.length}行文本 ≈ ${segments.length}个音频片段`);
        lines.forEach((line, index) => {
            const segment = segments[Math.min(index, segments.length - 1)];
            result.push({
                index: index + 1,
                text: line.trim(),
                startTime: segment.startTime,
                endTime: segment.endTime
            });
            console.log(`  行${index + 1} -> 片段${Math.min(index + 1, segments.length)}: ${segment.startTime.toFixed(2)}s - ${segment.endTime.toFixed(2)}s`);
        });
    }
    // 策略 2: 文本行数较少，多个片段合并
    else if (lines.length < segments.length) {
        logger.info('[VolumeDetect] 文本行少，合并音频片段');
        const segmentsPerLine = Math.ceil(segments.length / lines.length);
        console.log(`\n🎯 使用合并策略: ${lines.length}行文本 < ${segments.length}个片段，每行合并${segmentsPerLine}个片段`);

        lines.forEach((line, index) => {
            const startSegmentIdx = index * segmentsPerLine;
            const endSegmentIdx = Math.min(startSegmentIdx + segmentsPerLine, segments.length);

            const firstSegment = segments[startSegmentIdx];
            const lastSegment = segments[endSegmentIdx - 1];

            result.push({
                index: index + 1,
                text: line.trim(),
                startTime: firstSegment.startTime,
                endTime: lastSegment.endTime
            });
            console.log(`  行${index + 1} -> 合并片段${startSegmentIdx + 1}-${endSegmentIdx}: ${firstSegment.startTime.toFixed(2)}s - ${lastSegment.endTime.toFixed(2)}s | "${line.trim().substring(0, 30)}..."`);
        });
    }
    // 策略 3: 文本行数较多，拆分音频片段
    else {
        logger.info('[VolumeDetect] 文本行多，拆分音频片段');
        console.log(`\n🎯 使用拆分策略: ${lines.length}行文本 > ${segments.length}个片段`);
        let currentLineIdx = 0;

        segments.forEach((segment, segIdx) => {
            if (currentLineIdx >= lines.length) return;

            const remainingLines = lines.length - currentLineIdx;
            const remainingSegments = segments.length - segIdx;
            const linesPerSegment = Math.ceil(remainingLines / remainingSegments);
            const duration = segment.duration;
            const durationPerLine = duration / linesPerSegment;

            console.log(`  片段${segIdx + 1}(${segment.startTime.toFixed(2)}s-${segment.endTime.toFixed(2)}s) 拆分成${linesPerSegment}行:`);

            for (let i = 0; i < linesPerSegment && currentLineIdx < lines.length; i++) {
                const startTime = segment.startTime + i * durationPerLine;
                const endTime = segment.startTime + (i + 1) * durationPerLine;
                result.push({
                    index: currentLineIdx + 1,
                    text: lines[currentLineIdx].trim(),
                    startTime: startTime,
                    endTime: endTime
                });
                console.log(`    行${currentLineIdx + 1}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s | "${lines[currentLineIdx].trim().substring(0, 30)}..."`);
                currentLineIdx++;
            }
        });
    }

    logger.info(`[VolumeDetect] 字幕分配完成，共 ${result.length} 条`);

    // 🔧 修复：如果第一条字幕开始时间太晚（超过1秒），强制提前到接近0秒
    // 这样可以避免视频开头长时间没有字幕的问题
    if (result.length > 0 && result[0].startTime > 1.0) {
        const firstDelay = result[0].startTime;
        logger.warn(`[VolumeDetect] ⚠️ 第一条字幕开始时间较晚: ${firstDelay.toFixed(2)}s，调整为0.3s`);
        console.log(`\n⚠️ 第一条字幕开始时间较晚: ${firstDelay.toFixed(2)}s，调整为0.3s`);

        // 将第一条字幕提前到0.3秒开始，保持持续时长不变
        const firstDuration = result[0].endTime - result[0].startTime;
        result[0].startTime = 0.3;
        result[0].endTime = 0.3 + firstDuration;

        logger.info(`[VolumeDetect] ✅ 已调整第一条字幕时间: 0.3s - ${result[0].endTime.toFixed(2)}s`);
        console.log(`✅ 已调整第一条字幕时间: 0.3s - ${result[0].endTime.toFixed(2)}s\n`);
    }

    // 输出字幕时间详情
    console.log('\n========== 📝 字幕时间分配详情 ==========');
    console.log(`总字幕数: ${result.length}条`);
    result.forEach((subtitle, idx) => {
        const preview = subtitle.text.substring(0, 30) + (subtitle.text.length > 30 ? '...' : '');
        console.log(`  字幕${idx + 1}: ${subtitle.startTime.toFixed(2)}s - ${subtitle.endTime.toFixed(2)}s | "${preview}"`);
    });
    console.log('========================================\n');

    return result;
    } catch (error: any) {
        console.error('[VolumeDetect] ❌ 字幕时间分配失败:', error.message);
        console.error('[VolumeDetect] 错误堆栈:', error.stack);
        console.error('[VolumeDetect] 文本长度:', text.length);
        console.error('[VolumeDetect] 文本行数:', lines.length);
        console.error('[VolumeDetect] 音频片段数:', segments.length);
        if (segments.length > 0) {
            console.error('[VolumeDetect] 第一个片段:', segments[0]);
            console.error('[VolumeDetect] 最后一个片段:', segments[segments.length - 1]);
        }

        // 返回降级结果：按行数平均分配时间
        logger.warn('[VolumeDetect] 使用降级方案：平均分配时间');
        return lines.map((line, index) => ({
            index: index + 1,
            text: line,
            startTime: index * 3,
            endTime: (index + 1) * 3
        }));
    }
}
