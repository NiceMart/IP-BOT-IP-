import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import WebSocket from 'ws';
import logger from '../log/main';
import { synthesizeSpeechRealtime } from './cosyvoiceRealtime';
import { Apps } from '../app/index';

/**
 * 在线 TTS（千问 Qwen TTS）客户端
 */

export interface CosyVoiceConfig {
    apiKey: string;
    model: string;
    voice: string;
    format?: string;
    sampleRate?: number;
    rate?: number;
    volume?: number;
    pitch?: number;
    instruction?: string;
    language_hints?: string;
    language?: string;
    emotion?: string;
    outputPath?: string;
}

export interface CosyVoiceResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    requestId?: string;
}

const QWEN_TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

function getOutputFormat(outputPath: string, configFormat?: string): 'wav' | 'mp3' {
    const ext = path.extname(outputPath).toLowerCase();
    if (ext === '.wav') return 'wav';
    if (ext === '.mp3') return 'mp3';
    if ((configFormat || '').toLowerCase() === 'wav') return 'wav';
    return 'mp3';
}

function detectAudioFormat(
    buffer: Buffer,
    contentType?: string,
    fallback: 'wav' | 'mp3' = 'mp3'
): 'wav' | 'mp3' {
    const normalizedType = (contentType || '').toLowerCase();
    if (normalizedType.includes('wav') || normalizedType.includes('wave')) return 'wav';
    if (normalizedType.includes('mpeg') || normalizedType.includes('mp3')) return 'mp3';

    if (buffer.length >= 12) {
        const riff = buffer.toString('ascii', 0, 4);
        const wave = buffer.toString('ascii', 8, 12);
        if (riff === 'RIFF' && wave === 'WAVE') return 'wav';
    }

    if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return 'mp3';
    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';

    return fallback;
}

async function transcodeAudioFile(
    inputPath: string,
    outputPath: string,
    targetFormat: 'wav' | 'mp3'
): Promise<void> {
    const args = targetFormat === 'wav'
        ? ['-y', '-i', inputPath, '-c:a', 'pcm_s16le', outputPath]
        : ['-y', '-i', inputPath, '-c:a', 'libmp3lame', '-b:a', '128k', outputPath];

    await Apps.spawnBinary('ffmpeg', args, {
        shell: false,
    });
}

async function writeAudioBufferAsTargetFormat(
    audioBuffer: Buffer,
    outputPath: string,
    targetFormat: 'wav' | 'mp3',
    contentType?: string
): Promise<void> {
    const sourceFormat = detectAudioFormat(audioBuffer, contentType, targetFormat);
    if (sourceFormat === targetFormat) {
        fs.writeFileSync(outputPath, audioBuffer);
        return;
    }

    const parsedOutput = path.parse(outputPath);
    const tempInputPath = path.join(
        parsedOutput.dir,
        `${parsedOutput.name}_source_${Date.now()}${Math.random().toString(36).slice(2, 8)}.${sourceFormat}`
    );

    fs.writeFileSync(tempInputPath, audioBuffer);
    try {
        await transcodeAudioFile(tempInputPath, outputPath, targetFormat);
    } finally {
        try { fs.unlinkSync(tempInputPath); } catch (_error) { /* ignore */ }
    }
}

/**
 * 将长文本按自然断句分割为不超过 maxLen 的段落
 * qwen3-tts-vc 限制每次最多600（含 instructions），保守设为300
 * 普通 qwen3-tts 模型可适当放宽
 */
function splitTextForTTS(text: string, maxLen: number = 300): string[] {
    if (text.length <= maxLen) return [text];

    const segments: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            segments.push(remaining);
            break;
        }
        // 在 maxLen 范围内找最后一个自然断句点
        const chunk = remaining.slice(0, maxLen);
        let splitIdx = -1;
        // 优先按句号/问号/感叹号分割
        for (const sep of ['。', '！', '？', '!', '?', '；', ';', '\n']) {
            const idx = chunk.lastIndexOf(sep);
            if (idx > maxLen * 0.3) { splitIdx = idx + 1; break; }
        }
        // 其次按逗号/顿号分割
        if (splitIdx === -1) {
            for (const sep of ['，', ',', '、', '：', ':']) {
                const idx = chunk.lastIndexOf(sep);
                if (idx > maxLen * 0.3) { splitIdx = idx + 1; break; }
            }
        }
        // 实在找不到就硬切
        if (splitIdx === -1) splitIdx = maxLen;

        segments.push(remaining.slice(0, splitIdx).trim());
        remaining = remaining.slice(splitIdx).trim();
    }

    return segments.filter(s => s.length > 0);
}

export async function synthesizeSpeech(
    text: string,
    config: CosyVoiceConfig
): Promise<CosyVoiceResult> {
    logger.info('[QwenTTS] 开始语音合成', {
        model: config.model,
        voice: config.voice,
        instruction: config.instruction,
        language: config.language,
        language_hints: config.language_hints,
        textLength: text.length,
    });

    try {
        // ✅ 关键修复：长文本自动分段（避免 "Range of input length should be [0, 600]" 错误）
        // VC 模型（声音克隆）的限制更严格，API 可能将 text + instructions 合并计算
        const instructionLen = config.instruction ? config.instruction.length : 0;
        const isVcModel = config.model?.includes('-vc') || config.model?.includes('_vc');
        // VC 模型更保守（200字），普通模型 300 字，减去 instruction 长度
        const baseMaxLen = isVcModel ? 200 : 300;
        const effectiveMaxLen = Math.max(100, baseMaxLen - instructionLen);
        const segments = splitTextForTTS(text, effectiveMaxLen);
        logger.info(`[QwenTTS] 文本分段: ${segments.length}段, 各段长度: [${segments.map(s => s.length).join(', ')}]`, {
            isVcModel, instructionLen, effectiveMaxLen
        });

        // 准备输出路径
        let outputPath: string;
        if (config.outputPath) {
            const requestedDir = path.dirname(config.outputPath);
            try {
                if (!fs.existsSync(requestedDir)) {
                    fs.mkdirSync(requestedDir, { recursive: true });
                }
                outputPath = config.outputPath;
            } catch (mkdirErr: any) {
                // 指定的输出路径无法创建（如盘符不存在、路径无效等），回退到默认临时目录
                logger.warn(`[QwenTTS] 无法创建输出目录 ${requestedDir}: ${mkdirErr.message}，回退到默认临时目录`);
                const fallbackDir = path.join(app.getPath('userData'), 'temp', 'tts');
                if (!fs.existsSync(fallbackDir)) {
                    fs.mkdirSync(fallbackDir, { recursive: true });
                }
                const ext = path.extname(config.outputPath) || ((config.format || '').toLowerCase() === 'wav' ? '.wav' : '.mp3');
                outputPath = path.join(fallbackDir, `qwen_tts_${Date.now()}${ext}`);
            }
        } else {
            const outputDir = path.join(app.getPath('userData'), 'temp', 'tts');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const defaultExt = (config.format || '').toLowerCase() === 'wav' ? 'wav' : 'mp3';
            outputPath = path.join(outputDir, `qwen_tts_${Date.now()}.${defaultExt}`);
        }

        const outputFormat = getOutputFormat(outputPath, config.format);

        // 如果只有一段，直接合成
        if (segments.length === 1) {
            return await synthesizeOneSegment(segments[0], config, outputPath);
        }

        // 多段：逐段合成，然后拼接 WAV
        const segmentPaths: string[] = [];
        const parsedOutput = path.parse(outputPath);
        for (let i = 0; i < segments.length; i++) {
            const segPath = path.join(
                parsedOutput.dir,
                `${parsedOutput.name}_seg${i}${parsedOutput.ext || (outputFormat === 'wav' ? '.wav' : '.mp3')}`
            );
            logger.info(`[QwenTTS] 合成第 ${i + 1}/${segments.length} 段 (${segments[i].length}字)...`);
            const segResult = await synthesizeOneSegment(segments[i], config, segPath);
            if (!segResult.success) {
                return segResult; // 任一段失败则返回错误
            }
            segmentPaths.push(segPath);
        }

        // 拼接所有段的 WAV 文件（简单拼接 PCM 数据）
        try {
            await concatAudioFiles(segmentPaths, outputPath, outputFormat);
            // 清理临时分段文件
            for (const p of segmentPaths) {
                try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
            }
            logger.info('[QwenTTS] 多段音频拼接完成', { outputPath, segments: segments.length });
        } catch (concatError) {
            // 拼接失败则使用第一段
            logger.error('[QwenTTS] 音频拼接失败，使用第一段', concatError);
            if (segmentPaths.length > 0 && fs.existsSync(segmentPaths[0])) {
                fs.copyFileSync(segmentPaths[0], outputPath);
            }
        }

        return {
            success: true,
            audioPath: outputPath,
        };

    } catch (error: any) {
        logger.error('[QwenTTS] 语音合成失败', error.response?.data || error.message || error);
        return {
            success: false,
            error: error.response?.data?.message || error.message || '语音合成失败',
        };
    }
}

/**
 * 合成单段文本
 */
async function synthesizeOneSegment(
    text: string,
    config: CosyVoiceConfig,
    outputPath: string
): Promise<CosyVoiceResult> {
    // CosyVoice uses SpeechSynthesizer, never the Qwen multimodal endpoint.
    if (config.model?.startsWith('cosyvoice-')) {
        return synthesizeSpeechRealtime({
            ...config, text, outputPath,
            format: getOutputFormat(outputPath, config.format),
            language: config.language || config.language_hints,
        });
    }
    const instrLen = config.instruction ? config.instruction.length : 0;
    const outputFormat = getOutputFormat(outputPath, config.format);
    logger.info(`[QwenTTS] synthesizeOneSegment: textLen=${text.length}, instructionLen=${instrLen}, totalLen=${text.length + instrLen}, model=${config.model}`);

    const response = await axios.post(
        QWEN_TTS_URL,
        {
            model: config.model,
            input: {
                text,
                voice: config.voice,
                ...(mapLanguageType(config.language_hints || config.language)
                    ? { language_type: mapLanguageType(config.language_hints || config.language) }
                    : {}),
                ...(config.instruction ? { instructions: config.instruction, optimize_instructions: true } : {}),
            },
        },
        {
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 600000,
        }
    );

    const audioUrl = response.data?.output?.audio?.url;
    const requestId = response.data?.request_id;
    if (!audioUrl) {
        return {
            success: false,
            error: response.data?.message || '未获取到音频 URL',
            requestId,
        };
    }

    const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 600000,
    });
    await writeAudioBufferAsTargetFormat(
        Buffer.from(audioResponse.data),
        outputPath,
        outputFormat,
        audioResponse.headers?.['content-type']
    );

    logger.info('[QwenTTS] 单段音频已保存', { outputPath, requestId, textLen: text.length });
    return {
        success: true,
        audioPath: outputPath,
        requestId,
    };
}

/**
 * 拼接多个 WAV 文件（假设格式相同：都是 PCM WAV）
 */
async function concatWavFiles(inputPaths: string[], outputPath: string): Promise<void> {
    if (inputPaths.length === 0) throw new Error('无输入文件');
    if (inputPaths.length === 1) {
        fs.copyFileSync(inputPaths[0], outputPath);
        return;
    }

    // 读取第一个文件的 WAV 头（44字节）
    const firstFile = fs.readFileSync(inputPaths[0]);
    const headerSize = 44;
    const header = Buffer.from(firstFile.buffer, 0, headerSize);

    // 收集所有 PCM 数据（跳过 WAV 头）
    const pcmBuffers: Buffer[] = [];
    let totalPcmSize = 0;
    for (const p of inputPaths) {
        const buf = fs.readFileSync(p);
        const pcm = buf.slice(headerSize);
        pcmBuffers.push(pcm);
        totalPcmSize += pcm.length;
    }

    // 更新 WAV 头中的文件大小字段
    const newHeader = Buffer.from(header);
    newHeader.writeUInt32LE(totalPcmSize + headerSize - 8, 4);  // ChunkSize
    newHeader.writeUInt32LE(totalPcmSize, 40);                   // Subchunk2Size

    // 写入文件
    const outputBuf = Buffer.concat([newHeader, ...pcmBuffers]);
    fs.writeFileSync(outputPath, outputBuf);
}

async function concatMp3Files(inputPaths: string[], outputPath: string): Promise<void> {
    const concatListPath = path.join(
        path.dirname(outputPath),
        `concat_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`
    );
    const concatList = inputPaths
        .map(filePath => {
            const normalized = filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
            return `file '${normalized}'`;
        })
        .join('\n');

    fs.writeFileSync(concatListPath, concatList, 'utf-8');
    try {
        await Apps.spawnBinary('ffmpeg', [
            '-y',
            '-f', 'concat',
            '-safe', '0',
            '-i', concatListPath,
            '-c:a', 'libmp3lame',
            '-b:a', '128k',
            outputPath,
        ], {
            shell: false,
        });
    } finally {
        try { fs.unlinkSync(concatListPath); } catch (_error) { /* ignore */ }
    }
}

async function concatAudioFiles(
    inputPaths: string[],
    outputPath: string,
    format: 'wav' | 'mp3'
): Promise<void> {
    if (format === 'wav') {
        await concatWavFiles(inputPaths, outputPath);
        return;
    }

    await concatMp3Files(inputPaths, outputPath);
}

export function getAvailableVoices(model: string): Array<{ id: string; name: string; desc: string }> {
    if (model.startsWith('qwen3-tts') || model.startsWith('qwen-tts')) {
        return [
            { id: 'Cherry', name: '芊悦', desc: '普通话，女声，通用播报' },
            { id: 'Serena', name: '苏瑶', desc: '普通话，女声，温柔自然' },
            { id: 'Ethan', name: '晨煦', desc: '普通话，男声，稳重清晰' },
            { id: 'Jada', name: '上海-阿珍', desc: '上海话，女声，方言播报' },
            { id: 'Dylan', name: '北京-晓东', desc: '北京话，男声，方言播报' },
            { id: 'Li', name: '南京-老李', desc: '南京话，男声，方言播报' },
            { id: 'Marcus', name: '陕西-秦川', desc: '陕西话，男声，方言播报' },
            { id: 'Roy', name: '闽南-阿杰', desc: '闽南语，男声，方言播报' },
            { id: 'Peter', name: '天津-李彼得', desc: '天津话，男声，方言播报' },
            { id: 'Sunny', name: '四川-晴儿', desc: '四川话，女声，方言播报' },
            { id: 'Eric', name: '四川-程川', desc: '四川话，男声，方言播报' },
            { id: 'Rocky', name: '粤语-阿强', desc: '粤语，男声，方言播报' },
            { id: 'Kiki', name: '粤语-阿清', desc: '粤语，女声，方言播报' },
        ];
    }

    return [];
}

export function getInstructionForLanguage(language: string): string | undefined {
    if (!language || language === '中文' || language === '中文（普通话）') {
        return undefined;
    }

    const dialectMap: Record<string, string> = {
        '上海话': '请用上海话表达。',
        '北京话': '请用北京话表达。',
        '四川话': '请用四川话表达。',
        '南京话': '请用南京话表达。',
        '陕西话': '请用陕西话表达。',
        '闽南话': '请用闽南话表达。',
        '天津话': '请用天津话表达。',
        '粤语': '请用粤语表达。',
        '广东话': '请用粤语表达。',
    };
    if (dialectMap[language]) {
        return dialectMap[language];
    }

    const languageMap: Record<string, string> = {
        '英语': 'Please speak in English.',
        '德语': 'Please speak in German.',
        '意大利语': 'Please speak in Italian.',
        '葡萄牙语': 'Please speak in Portuguese.',
        '西班牙语': 'Please speak in Spanish.',
        '日语': 'Please speak in Japanese.',
        '韩语': 'Please speak in Korean.',
        '法语': 'Please speak in French.',
        '俄语': 'Please speak in Russian.',
    };

    return languageMap[language];
}

function mapLanguageType(language?: string): string | undefined {
    const languageMap: Record<string, string> = {
        '中文': 'Chinese',
        '中文（普通话）': 'Chinese',
        'Chinese': 'Chinese',
        '英语': 'English',
        'English': 'English',
        '德语': 'German',
        'German': 'German',
        '意大利语': 'Italian',
        'Italian': 'Italian',
        '葡萄牙语': 'Portuguese',
        'Portuguese': 'Portuguese',
        '西班牙语': 'Spanish',
        'Spanish': 'Spanish',
        '日语': 'Japanese',
        'Japanese': 'Japanese',
        '韩语': 'Korean',
        'Korean': 'Korean',
        '法语': 'French',
        'French': 'French',
        '俄语': 'Russian',
        'Russian': 'Russian',
    };

    return language ? languageMap[language] : undefined;
}

// ======================== Sambert TTS ========================

/**
 * Sambert 语音合成配置
 */
export interface SambertConfig {
    apiKey: string;
    model: string;          // 音色即模型，如 sambert-zhichu-v1
    format?: 'pcm' | 'wav' | 'mp3';
    sampleRate?: number;    // 48kHz 或 16kHz 取决于音色
    volume?: number;        // 0-100，默认100
    rate?: number;          // 0.5-2.0，默认1.0
    pitch?: number;         // 0.5-2.0，默认1.0
    outputPath?: string;
}

export interface SambertResult {
    success: boolean;
    audioPath?: string;
    error?: string;
    requestId?: string;
}

/**
 * Sambert 可用音色列表
 * 每个音色对应一个独立的 model 参数
 */
export function getSambertVoices(): Array<{ model: string; name: string; desc: string; sampleRate: number }> {
    return [
        // ===== 中文+英文，48kHz =====
        { model: 'sambert-zhinan-v1', name: '知楠', desc: '广告男声', sampleRate: 48000 },
        { model: 'sambert-zhiqi-v1', name: '知琪', desc: '温柔女声', sampleRate: 48000 },
        { model: 'sambert-zhichu-v1', name: '知厨', desc: '舌尖男声/新闻播报', sampleRate: 48000 },
        { model: 'sambert-zhide-v1', name: '知德', desc: '新闻男声', sampleRate: 48000 },
        { model: 'sambert-zhijia-v1', name: '知佳', desc: '标准女声/新闻播报', sampleRate: 48000 },
        { model: 'sambert-zhiru-v1', name: '知茹', desc: '新闻女声', sampleRate: 48000 },
        { model: 'sambert-zhiqian-v1', name: '知倩', desc: '资讯女声/配音解说', sampleRate: 48000 },
        { model: 'sambert-zhixiang-v1', name: '知祥', desc: '磁性男声/配音解说', sampleRate: 48000 },
        { model: 'sambert-zhiwei-v1', name: '知薇', desc: '萝莉女声', sampleRate: 48000 },
        // ===== 中文+英文，16kHz =====
        { model: 'sambert-zhihao-v1', name: '知浩', desc: '咨询男声', sampleRate: 16000 },
        { model: 'sambert-zhijing-v1', name: '知婧', desc: '严厉女声', sampleRate: 16000 },
        { model: 'sambert-zhiming-v1', name: '知茗', desc: '诙谐男声', sampleRate: 16000 },
        { model: 'sambert-zhimo-v1', name: '知墨', desc: '情感男声', sampleRate: 16000 },
        { model: 'sambert-zhina-v1', name: '知娜', desc: '浙普女声', sampleRate: 16000 },
        { model: 'sambert-zhishu-v1', name: '知树', desc: '资讯男声', sampleRate: 16000 },
        { model: 'sambert-zhistella-v1', name: '知莎', desc: '知性女声', sampleRate: 16000 },
        { model: 'sambert-zhiting-v1', name: '知婷', desc: '电台女声', sampleRate: 16000 },
        { model: 'sambert-zhixiao-v1', name: '知笑', desc: '资讯女声', sampleRate: 16000 },
        { model: 'sambert-zhiya-v1', name: '知雅', desc: '严厉女声', sampleRate: 16000 },
        { model: 'sambert-zhiye-v1', name: '知晔', desc: '青年男声', sampleRate: 16000 },
        { model: 'sambert-zhiying-v1', name: '知颖', desc: '软萌童声', sampleRate: 16000 },
        { model: 'sambert-zhiyuan-v1', name: '知媛', desc: '知心姐姐', sampleRate: 16000 },
        { model: 'sambert-zhiyue-v1', name: '知悦', desc: '温柔女声/客服', sampleRate: 16000 },
        { model: 'sambert-zhigui-v1', name: '知柜', desc: '直播女声', sampleRate: 16000 },
        { model: 'sambert-zhishuo-v1', name: '知硕', desc: '自然男声/数字人', sampleRate: 16000 },
        { model: 'sambert-zhimiao-emo-v1', name: '知妙(多情感)', desc: '多情感女声', sampleRate: 16000 },
        { model: 'sambert-zhimao-v1', name: '知猫', desc: '直播女声', sampleRate: 16000 },
        { model: 'sambert-zhilun-v1', name: '知伦', desc: '悬疑解说', sampleRate: 16000 },
        { model: 'sambert-zhifei-v1', name: '知飞', desc: '激昂解说', sampleRate: 16000 },
        { model: 'sambert-zhida-v1', name: '知达', desc: '标准男声/新闻播报', sampleRate: 16000 },
    ];
}

/**
 * 根据 model 获取音色的默认采样率
 */
function getSambertSampleRate(model: string): number {
    const voice = getSambertVoices().find(v => v.model === model);
    return voice?.sampleRate || 16000;
}

const SAMBERT_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference';

/**
 * Sambert 语音合成（WebSocket 方式）
 * 支持最长 1 万字符，无需分段
 */
export async function sambertSynthesizeSpeech(
    text: string,
    config: SambertConfig
): Promise<SambertResult> {
    logger.info('[SambertTTS] 开始语音合成', {
        model: config.model,
        textLength: text.length,
        format: config.format,
        rate: config.rate,
        pitch: config.pitch,
    });

    try {
        // 准备输出路径
        let outputPath: string;
        if (config.outputPath) {
            const requestedDir = path.dirname(config.outputPath);
            try {
                if (!fs.existsSync(requestedDir)) {
                    fs.mkdirSync(requestedDir, { recursive: true });
                }
                outputPath = config.outputPath;
            } catch (mkdirErr: any) {
                // 指定的输出路径无法创建（如盘符不存在、路径无效等），回退到默认临时目录
                logger.warn(`[SambertTTS] 无法创建输出目录 ${requestedDir}: ${mkdirErr.message}，回退到默认临时目录`);
                const fallbackDir = path.join(app.getPath('userData'), 'temp', 'tts');
                if (!fs.existsSync(fallbackDir)) {
                    fs.mkdirSync(fallbackDir, { recursive: true });
                }
                const ext = path.extname(config.outputPath) || ((config.format || '').toLowerCase() === 'wav' ? '.wav' : '.mp3');
                outputPath = path.join(fallbackDir, `sambert_tts_${Date.now()}${ext}`);
            }
        } else {
            const outputDir = path.join(app.getPath('userData'), 'temp', 'tts');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const defaultExt = (config.format || '').toLowerCase() === 'wav' ? 'wav' : 'mp3';
            outputPath = path.join(outputDir, `sambert_tts_${Date.now()}.${defaultExt}`);
        }

        const targetSampleRate = config.sampleRate || getSambertSampleRate(config.model);
        const targetFormat = config.format || (outputPath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3');

        // 通过 WebSocket 合成
        const audioBuffer = await callSambertWebSocket(text, config, targetFormat, targetSampleRate);

        // 写入文件
        const outputFormat = getOutputFormat(outputPath, config.format);
        await writeAudioBufferAsTargetFormat(audioBuffer, outputPath, outputFormat);

        logger.info('[SambertTTS] 语音合成成功', { outputPath, audioSize: audioBuffer.length });
        return {
            success: true,
            audioPath: outputPath,
        };

    } catch (error: any) {
        logger.error('[SambertTTS] 语音合成失败', error.message || error);
        return {
            success: false,
            error: error.message || 'Sambert语音合成失败',
        };
    }
}

/**
 * WebSocket 调用 Sambert 合成
 */
async function callSambertWebSocket(
    text: string,
    config: SambertConfig,
    format: string,
    sampleRate: number
): Promise<Buffer> {
    const crypto = await import('crypto');

    const taskId = crypto.randomUUID();

    return new Promise<Buffer>((resolve, reject) => {
        const ws = new WebSocket(`${SAMBERT_WS_URL}`, {
            headers: {
                'Authorization': `bearer ${config.apiKey}`,
                'X-DashScope-DataInspection': 'enable',
            },
        });

        const audioChunks: Buffer[] = [];
        let hasError = false;
        let errorMsg = '';

        ws.on('open', () => {
            logger.info('[SambertTTS] WebSocket 连接已建立', { taskId });

            // 发送 run-task 指令
            const runTaskMsg = {
                header: {
                    action: 'run-task',
                    task_id: taskId,
                    streaming: 'out',
                },
                payload: {
                    model: config.model,
                    task_group: 'audio',
                    task: 'tts',
                    function: 'SpeechSynthesizer',
                    input: {
                        text: text,
                    },
                    parameters: {
                        text_type: 'PlainText',
                        format: format,
                        sample_rate: sampleRate,
                        volume: config.volume ?? 100,
                        rate: config.rate ?? 1.0,
                        pitch: config.pitch ?? 1.0,
                    },
                },
            };

            ws.send(JSON.stringify(runTaskMsg));
        });

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.header?.event === 'task-failed') {
                    hasError = true;
                    errorMsg = msg.header?.error_message || msg.header?.status_message || 'Sambert合成任务失败';
                    logger.error('[SambertTTS] 任务失败', { errorMsg, code: msg.header?.error_code });
                    ws.close();
                    return;
                }

                // 音频数据
                if (msg.header?.event === 'result-generated' && msg.payload?.audio) {
                    const audioStr = msg.payload.audio;
                    if (audioStr) {
                        audioChunks.push(Buffer.from(audioStr, 'base64'));
                    }
                }

                // 任务完成
                if (msg.header?.event === 'task-finished' || msg.header?.status_text === 'synthesized completely') {
                    logger.info('[SambertTTS] 合成完成', {
                        chunks: audioChunks.length,
                        taskId: msg.header?.task_id,
                    });
                    ws.close();
                }
            } catch (parseErr) {
                // 有些二进制帧可能不是 JSON，忽略
                logger.warn('[SambertTTS] 解析消息异常，可能是二进制音频帧', parseErr);
            }
        });

        ws.on('close', () => {
            if (hasError) {
                reject(new Error(errorMsg));
            } else if (audioChunks.length === 0) {
                reject(new Error('Sambert合成未返回音频数据'));
            } else {
                resolve(Buffer.concat(audioChunks));
            }
        });

        ws.on('error', (err: Error) => {
            logger.error('[SambertTTS] WebSocket 错误', err);
            reject(new Error(`WebSocket连接失败: ${err.message}`));
        });

        // 10分钟超时
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                reject(new Error('Sambert语音合成超时'));
            }
        }, 600000);
    });
}

// ======================== CosyVoice V2 TTS ========================

const COSYVOICE_V2_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';

/**
 * T1多模态语音模型配置（基于CosyVoice V2 API / SpeechSynthesizer端点）
 */
export interface CosyVoiceV2Config {
    apiKey: string;
    model?: string;             // 默认 cosyvoice-v3.5-plus
    voice: string;              // 系统音色ID 或 复刻音色ID
    format?: 'mp3' | 'wav' | 'pcm' | 'opus';
    sampleRate?: number;        // 8000/16000/22050/24000/44100/48000
    volume?: number;            // 0-100，默认100
    rate?: number;              // 0.5-2.0，默认1.0
    pitch?: number;             // 0.5-2.0，默认1.0
    language_hints?: string[];  // 目标语言提示：zh/en/fr/de/ja/ko/ru/pt/th/id/vi
    outputPath?: string;
}

export interface CosyVoiceV2Result {
    success: boolean;
    audioPath?: string;
    error?: string;
    requestId?: string;
}

/**
 * CosyVoice V2 系统音色列表（完整81个，按官方文档分类）
 * 来源：https://help.aliyun.com/zh/model-studio/cosyvoice-voice-list
 */
export function getCosyVoiceV2Voices(): Array<{ voice: string; name: string; desc: string }> {
    return [
        // === 电话销售 ===
        { voice: 'longyingxiao', name: '龙应笑', desc: '清甜推销女' },
        // === 短视频配音 ===
        { voice: 'longjiqi', name: '龙机器', desc: '呆萌机器人' },
        { voice: 'longhouge', name: '龙猴哥', desc: '经典猴哥' },
        { voice: 'longjixin', name: '龙机心', desc: '毒舌心机女' },
        { voice: 'longanyue', name: '龙安粤', desc: '欢脱粤语男' },
        { voice: 'longshange', name: '龙陕哥', desc: '原味陕北男' },
        { voice: 'longanmin', name: '龙安敏', desc: '甜美闽南女' },
        { voice: 'longdaiyu', name: '龙黛玉', desc: '娇率才女音' },
        { voice: 'longgaoseng', name: '龙高僧', desc: '得道高僧音' },
        // === 语音助手 ===
        { voice: 'longanli', name: '龙安莉', desc: '利落从容女' },
        { voice: 'longanlang', name: '龙安朗', desc: '清爽利落男' },
        { voice: 'longanwen', name: '龙安温', desc: '优雅知性女' },
        { voice: 'longanyun', name: '龙安昀', desc: '居家暖男' },
        { voice: 'longyumi_v2', name: 'YUMI', desc: '正经青年女' },
        { voice: 'longxiaochun_v2', name: '龙小淳', desc: '知性积极女' },
        { voice: 'longxiaoxia_v2', name: '龙小夏', desc: '沉稳权威女' },
        // === 有声书 ===
        { voice: 'longyichen', name: '龙逸尘', desc: '洒脱活力男' },
        { voice: 'longwanjun', name: '龙婉君', desc: '细腻柔声女' },
        { voice: 'longlaobo', name: '龙老伯', desc: '沧桑岁月爷' },
        { voice: 'longlaoyi', name: '龙老姨', desc: '烟火从容阿姨' },
        { voice: 'longbaizhi', name: '龙白芷', desc: '睿气旁白女' },
        { voice: 'longsanshu', name: '龙三叔', desc: '沉稳质感男' },
        { voice: 'longxiu_v2', name: '龙修', desc: '博才说书男' },
        { voice: 'longmiao_v2', name: '龙妙', desc: '抑扬顿挫女' },
        { voice: 'longyue_v2', name: '龙悦', desc: '温暖磁性女' },
        { voice: 'longnan_v2', name: '龙楠', desc: '睿智青年男' },
        { voice: 'longyuan_v2', name: '龙媛', desc: '温暖治愈女' },
        // === 社交陪伴 ===
        { voice: 'longanqin', name: '龙安亲', desc: '亲和活泼女' },
        { voice: 'longanya', name: '龙安雅', desc: '高雅气质女' },
        { voice: 'longanshuo', name: '龙安朔', desc: '干净清爽男' },
        { voice: 'longanling', name: '龙安灵', desc: '思维灵动女' },
        { voice: 'longanzhi', name: '龙安智', desc: '睿智轻熟男' },
        { voice: 'longanrou', name: '龙安柔', desc: '温柔闺蜜女' },
        { voice: 'longqiang_v2', name: '龙嫱', desc: '浪漫风情女' },
        { voice: 'longhan_v2', name: '龙寒', desc: '温暖痴情男' },
        { voice: 'longxing_v2', name: '龙星', desc: '温婉邻家女' },
        { voice: 'longhua_v2', name: '龙华', desc: '元气甜美女' },
        { voice: 'longwan_v2', name: '龙婉', desc: '积极知性女' },
        { voice: 'longcheng_v2', name: '龙橙', desc: '智慧青年男' },
        { voice: 'longfeifei_v2', name: '龙菲菲', desc: '甜美娇气女' },
        { voice: 'longxiaocheng_v2', name: '龙小诚', desc: '磁性低音男' },
        { voice: 'longzhe_v2', name: '龙哲', desc: '呆板大暖男' },
        { voice: 'longyan_v2', name: '龙颜', desc: '温暖春风女' },
        { voice: 'longtian_v2', name: '龙天', desc: '磁性理智男' },
        { voice: 'longze_v2', name: '龙泽', desc: '温暖元气男' },
        { voice: 'longshao_v2', name: '龙邵', desc: '积极向上男' },
        { voice: 'longhao_v2', name: '龙浩', desc: '多情忧郁男' },
        { voice: 'kabuleshen_v2', name: '龙深', desc: '实力歌手男' },
        // === 童声（标杆） ===
        { voice: 'longhuhu', name: '龙呼呼', desc: '天真烂漫女童' },
        // === 童声 ===
        { voice: 'longjielidou_v2', name: '龙杰力豆', desc: '阳光顽皮男' },
        { voice: 'longling_v2', name: '龙铃', desc: '稚气呆板女' },
        { voice: 'longke_v2', name: '龙可', desc: '懵懂乖乖女' },
        { voice: 'longxian_v2', name: '龙仙', desc: '豪放可爱女' },
        // === 消费电子-教育培训 ===
        { voice: 'longanpei', name: '龙安培', desc: '青少年教师女' },
        // === 消费电子-儿童陪伴 ===
        { voice: 'longwangwang', name: '龙汪汪', desc: '台湾少年音' },
        { voice: 'longpaopao', name: '龙泡泡', desc: '飞天泡泡音' },
        // === 消费电子-儿童有声书 ===
        { voice: 'longshanshan', name: '龙闪闪', desc: '戏剧化童声' },
        { voice: 'longniuniu', name: '龙牛牛', desc: '阳光男童声' },
        // === 客服 ===
        { voice: 'longyingmu', name: '龙应沐', desc: '优雅知性女' },
        { voice: 'longyingxun', name: '龙应询', desc: '年轻青涩男' },
        { voice: 'longyingcui', name: '龙应催', desc: '严肃催收男' },
        { voice: 'longyingda', name: '龙应答', desc: '开朗高音女' },
        { voice: 'longyingjing', name: '龙应静', desc: '低调冷静女' },
        { voice: 'longyingyan', name: '龙应严', desc: '义正严辞女' },
        { voice: 'longyingtian', name: '龙应甜', desc: '温柔甜美女' },
        { voice: 'longyingbing', name: '龙应冰', desc: '尖锐强势女' },
        { voice: 'longyingtao', name: '龙应桃', desc: '温柔淡定女' },
        { voice: 'longyingling', name: '龙应聆', desc: '温和共情女' },
        // === 直播带货 ===
        { voice: 'longanran', name: '龙安燃', desc: '活泼质感女' },
        { voice: 'longanxuan', name: '龙安宣', desc: '经典直播女' },
        { voice: 'longanchong', name: '龙安冲', desc: '激情推销男' },
        { voice: 'longanping', name: '龙安萍', desc: '高亢直播女' },
        // === 方言 ===
        { voice: 'longlaotie_v2', name: '龙老铁', desc: '东北直率男' },
        { voice: 'longjiayi_v2', name: '龙嘉怡', desc: '知性粤语女' },
        { voice: 'longtao_v2', name: '龙桃', desc: '积极粤语女' },
        // === 诗词朗诵 ===
        { voice: 'longfei_v2', name: '龙飞', desc: '热血磁性男' },
        { voice: 'libai_v2', name: '李白', desc: '古代诗仙男' },
        { voice: 'longjin_v2', name: '龙津', desc: '优雅温润男' },
        // === 新闻播报 ===
        { voice: 'longshu_v2', name: '龙书', desc: '沉稳青年男' },
        { voice: 'loongbella_v2', name: 'Bella2.0', desc: '精准干练女' },
        { voice: 'longshuo_v2', name: '龙硕', desc: '博才干练男' },
        { voice: 'longxiaobai_v2', name: '龙小白', desc: '沉稳播报女' },
        { voice: 'longjing_v2', name: '龙婧', desc: '典型播音女' },
        { voice: 'loongstella_v2', name: 'loongstella', desc: '飒爽利落女' },
        // === 出海-英语(英式) ===
        { voice: 'loongeva_v2', name: 'Eva', desc: '知性英文女(英式)' },
        { voice: 'loongbrian_v2', name: 'Brian', desc: '沉稳英文男(英式)' },
        { voice: 'loongluna_v2', name: 'Luna', desc: '英式英文女' },
        { voice: 'loongluca_v2', name: 'Luca', desc: '英式英文男' },
        { voice: 'loongemily_v2', name: 'Emily', desc: '英式英文女' },
        { voice: 'loongeric_v2', name: 'Eric', desc: '英式英文男' },
        // === 出海-英语(美式) ===
        { voice: 'loongabby_v2', name: 'Abby', desc: '美式英文女' },
        { voice: 'loongannie_v2', name: 'Annie', desc: '美式英文女' },
        { voice: 'loongandy_v2', name: 'Andy', desc: '美式英文男' },
        { voice: 'loongava_v2', name: 'Ava', desc: '美式英文女' },
        { voice: 'loongbeth_v2', name: 'Beth', desc: '美式英文女' },
        { voice: 'loongbetty_v2', name: 'Betty', desc: '美式英文女' },
        { voice: 'loongcindy_v2', name: 'Cindy', desc: '美式英文女' },
        { voice: 'loongcally_v2', name: 'Cally', desc: '美式英文女' },
        { voice: 'loongdavid_v2', name: 'David', desc: '美式英文男' },
        { voice: 'loongdonna_v2', name: 'Donna', desc: '美式英文女' },
        // === 出海-日语 ===
        { voice: 'loongyuuna_v2', name: 'Yuuna', desc: '元气霓虹女' },
        { voice: 'loongyuuma_v2', name: 'Yuuma', desc: '干练霓虹男' },
        { voice: 'loongtomoka_v2', name: 'Tomoka', desc: '日语女' },
        { voice: 'loongtomoya_v2', name: 'Tomoya', desc: '日语男' },
        // === 出海-韩语 ===
        { voice: 'loongjihun_v2', name: 'Jihun', desc: '阳光韩国男' },
        { voice: 'loongkyong_v2', name: 'Kyong', desc: '韩语女' },
    ];
}

/**
 * CosyVoice V2 语言提示映射
 */
function mapLanguageHints(language?: string): string[] | undefined {
    if (!language || language === '中文' || language === '中文（普通话）') {
        return undefined;
    }
    const map: Record<string, string[]> = {
        '英语': ['en'],
        'English': ['en'],
        '法语': ['fr'],
        'French': ['fr'],
        '德语': ['de'],
        'German': ['de'],
        '意大利语': ['it'],
        'Italian': ['it'],
        '葡萄牙语': ['pt'],
        'Portuguese': ['pt'],
        '西班牙语': ['es'],
        'Spanish': ['es'],
        '日语': ['ja'],
        'Japanese': ['ja'],
        '韩语': ['ko'],
        'Korean': ['ko'],
        '俄语': ['ru'],
        'Russian': ['ru'],
        '泰语': ['th'],
        '印尼语': ['id'],
        '越南语': ['vi'],
        '中文': ['zh'],
    };
    return map[language];
}

/**
 * T1多模态语音模型语音合成（基于CosyVoice V2 SpeechSynthesizer API）
 * 使用 cosyvoice-v3.5-plus 模型，支持长文本自动分段，支持音量/语速/音高调节
 */
export async function cosyvoiceV2Synthesize(
    text: string,
    config: CosyVoiceV2Config
): Promise<CosyVoiceV2Result> {
    const modelName = config.model || 'cosyvoice-v3.5-plus';
    logger.info('[CosyVoiceV2] 开始语音合成', {
        model: modelName,
        voice: config.voice,
        textLength: text.length,
        format: config.format,
        rate: config.rate,
        pitch: config.pitch,
    });

    try {
        // 长文本自动分段（cosyvoice-v3.5-plus 单次建议不超过 300 字）
        const segments = splitTextForTTS(text, 300);
        logger.info(`[CosyVoiceV2] 文本分段: ${segments.length}段, 各段长度: [${segments.map(s => s.length).join(', ')}]`);

        // 准备输出路径
        let outputPath: string;
        if (config.outputPath) {
            const requestedDir = path.dirname(config.outputPath);
            try {
                if (!fs.existsSync(requestedDir)) {
                    fs.mkdirSync(requestedDir, { recursive: true });
                }
                outputPath = config.outputPath;
            } catch (mkdirErr: any) {
                logger.warn(`[CosyVoiceV2] 无法创建输出目录 ${requestedDir}: ${mkdirErr.message}，回退到默认临时目录`);
                const fallbackDir = path.join(app.getPath('userData'), 'temp', 'tts');
                if (!fs.existsSync(fallbackDir)) {
                    fs.mkdirSync(fallbackDir, { recursive: true });
                }
                const ext = path.extname(config.outputPath) || ((config.format || '').toLowerCase() === 'wav' ? '.wav' : '.mp3');
                outputPath = path.join(fallbackDir, `cosyvoice_v2_${Date.now()}${ext}`);
            }
        } else {
            const outputDir = path.join(app.getPath('userData'), 'temp', 'tts');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            const defaultExt = (config.format || '').toLowerCase() === 'wav' ? 'wav' : 'mp3';
            outputPath = path.join(outputDir, `cosyvoice_v2_${Date.now()}.${defaultExt}`);
        }

        const outputFormat = getOutputFormat(outputPath, config.format);

        // 如果只有一段，直接合成
        if (segments.length === 1) {
            return await cosyvoiceV2OneSegment(segments[0], config, outputPath, modelName);
        }

        // 多段：逐段合成，然后拼接
        const segmentPaths: string[] = [];
        const parsedOutput = path.parse(outputPath);
        for (let i = 0; i < segments.length; i++) {
            const segPath = path.join(
                parsedOutput.dir,
                `${parsedOutput.name}_seg${i}${parsedOutput.ext || (outputFormat === 'wav' ? '.wav' : '.mp3')}`
            );
            logger.info(`[CosyVoiceV2] 合成第 ${i + 1}/${segments.length} 段 (${segments[i].length}字)...`);
            const segResult = await cosyvoiceV2OneSegment(segments[i], config, segPath, modelName);
            if (!segResult.success) {
                return segResult;
            }
            segmentPaths.push(segPath);
        }

        // 拼接
        try {
            await concatAudioFiles(segmentPaths, outputPath, outputFormat);
            for (const p of segmentPaths) {
                try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
            }
            logger.info('[CosyVoiceV2] 多段音频拼接完成', { outputPath, segments: segments.length });
        } catch (concatError) {
            logger.error('[CosyVoiceV2] 音频拼接失败，使用第一段', concatError);
            if (segmentPaths.length > 0 && fs.existsSync(segmentPaths[0])) {
                fs.copyFileSync(segmentPaths[0], outputPath);
            }
        }

        return {
            success: true,
            audioPath: outputPath,
        };

    } catch (error: any) {
        logger.error('[CosyVoiceV2] 语音合成失败', error.response?.data || error.message || error);
        return {
            success: false,
            error: error.response?.data?.message || error.message || 'CosyVoice V2语音合成失败',
        };
    }
}

/**
 * CosyVoice V2 合成单段文本
 */
async function cosyvoiceV2OneSegment(
    text: string,
    config: CosyVoiceV2Config,
    outputPath: string,
    modelName: string
): Promise<CosyVoiceV2Result> {
    return synthesizeSpeechRealtime({
        apiKey: config.apiKey,
        model: modelName,
        voice: config.voice,
        text,
        outputPath,
        format: getOutputFormat(outputPath, config.format),
        sampleRate: config.sampleRate || 24000,
        volume: config.volume ?? 100,
        rate: config.rate ?? 1,
        pitch: config.pitch ?? 1,
        language: config.language_hints?.[0],
    });
}
