import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { Log } from "../log/main";
import { getPythonPath } from "../../lib/python-util";
import { getFFmpegExecutablePath, resourceExists } from "../../lib/resource-path";
import { getPythonScriptPath } from "../../lib/resource-path";
import { getFFmpegPath } from "../shell";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { spawnPython } from "../../lib/python-spawn-util";

// ES 模块中定义 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * FUNASR语音识别模块
 * 使用FUNASR模型进行语音识别，生成带时间戳的字幕
 */

export interface FunasrWord {
    word: string;
    start: number;  // 开始时间（秒）
    end: number;    // 结束时间（秒）
    confidence?: number;  // 置信度（可选）
}

export interface FunasrSegment {
    text: string;
    start: number;
    end: number;
    words: FunasrWord[];
}

export interface FunasrResult {
    segments: FunasrSegment[];
    language: string;
    duration: number;
}

/**
 * 使用FUNASR模型识别音频生成字幕
 * @param audioPath 音频文件路径
 * @param options 识别选项
 */
export async function recognizeAudioWithFunasr(
    audioPath: string,
    options?: {
        language?: string;  // 语言：zh（中文）、en（英文）
        modelPath?: string;  // FUNASR模型路径（可选）
        enableWordTimestamp?: boolean;  // 是否启用词级时间戳
    }
): Promise<FunasrResult> {
    try {
        Log.info("funasr.recognizeAudio", { audioPath, options });

        // 默认选项
        const config = {
            language: options?.language || 'zh',
            enableWordTimestamp: options?.enableWordTimestamp !== false,
            modelPath: options?.modelPath
        };

        // TODO: 这里需要根据实际的FUNASR部署方式调用
        // 方式1：调用FUNASR HTTP API（推荐）
        // 方式2：调用FUNASR Python命令行
        // 方式3：使用FUNASR Electron Native模块

        // 示例：使用HTTP API调用FUNASR服务
        const result = await callFunasrHttpApi(audioPath, config);

        Log.info("funasr.recognizeAudio.success", {
            segmentCount: result.segments.length,
            duration: result.duration
        });

        return result;

    } catch (error) {
        Log.error("funasr.recognizeAudio.error", error);
        throw new Error(`FUNASR识别失败: ${error?.message || error}`);
    }
}

/**
 * 调用FUNASR HTTP API或备用方案
 * 支持多种后端：本地FUNASR API、Python脚本、系统语音识别等
 */
async function callFunasrHttpApi(
    audioPath: string,
    config: any
): Promise<FunasrResult> {
    // 首先尝试本地FUNASR API
    const funasrApiUrl = process.env.FUNASR_API_URL || 'http://localhost:10095/api/v1/recognize';

    try {
        Log.info("funasr.httpApi.attempting", { funasrApiUrl, audioPath });

        // 检查音频文件是否存在
        if (!fs.existsSync(audioPath)) {
            throw new Error(`音频文件不存在: ${audioPath}`);
        }

        // 读取音频文件
        const audioBuffer = fs.readFileSync(audioPath);
        const audioBase64 = audioBuffer.toString('base64');

        Log.info("funasr.httpApi.audioLoaded", {
            audioSize: audioBuffer.length,
            audioBase64Length: audioBase64.length
        });

        // 调用FUNASR API，使用AbortController实现超时
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60秒超时

        try {
            Log.info("funasr.httpApi.sending", {
                url: funasrApiUrl,
                bodySize: JSON.stringify({
                    audio: audioBase64,
                    language: config.language,
                    enable_word_timestamp: config.enableWordTimestamp
                }).length
            });

            const response = await fetch(funasrApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audio: audioBase64,
                    language: config.language,
                    enable_word_timestamp: config.enableWordTimestamp
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            Log.info("funasr.httpApi.response", {
                status: response.status,
                statusText: response.statusText
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`FUNASR API返回错误: ${response.status} ${response.statusText}, 响应: ${errorText.substring(0, 200)}`);
            }

            const data = await response.json();

            // 解析FUNASR响应，转换为标准格式
            Log.info("funasr.httpApi.success", {
                segmentCount: data.segments?.length || 1
            });
            return parseFunasrResponse(data);
        } catch (fetchError: any) {
            clearTimeout(timeout);

            Log.info("funasr.httpApi.fetchError", {
                name: fetchError.name,
                message: fetchError.message,
                cause: fetchError.cause?.message
            });

            if (fetchError.name === 'AbortError') {
                throw new Error("FUNASR API请求超时（60秒）");
            }

            // 如果是网络错误，提供更详细的诊断信息
            if (fetchError.message.includes('fetch failed') || fetchError.code === 'ECONNREFUSED') {
                throw new Error(
                    `无法连接到FUNASR API: ${funasrApiUrl}\n` +
                    `请确保FUNASR服务已启动。\n` +
                    `Docker 启动命令: docker run -p 10095:10095 alibaba-pai/funasr:latest\n` +
                    `或设置环境变量: FUNASR_API_URL=http://你的FUNASR地址:10095/api/v1/recognize`
                );
            }

            throw fetchError;
        }

    } catch (error) {
        Log.info("funasr.httpApi.failed", {
            error: error?.message,
            apiUrl: process.env.FUNASR_API_URL || 'http://localhost:10095/api/v1/recognize',
            hasEnv: !!process.env.FUNASR_API_URL
        });

        // 尝试使用Python脚本进行本地语音识别
        try {
            Log.info("funasr.pythonScript.attempting", {
                pythonScript: getPythonScriptPath('funasr_recognize.py'),
                pythonPath: getPythonPath()
            });
            return await callFunasrPythonScript(audioPath, config);
        } catch (pythonError) {
            Log.info("funasr.python.failed", {
                error: pythonError?.message,
                pythonPath: getPythonPath()
            });

            // 如果都失败，抛出错误让用户知道语音识别失败
            throw new Error(
                `语音识别失败: FUNASR API和本地Python脚本都不可用。\n` +
                `\n请选择以下任意方案:\n` +
                `\n方案1 - 使用Docker部署FUNASR:\n` +
                `  docker run -p 10095:10095 alibaba-pai/funasr:latest\n` +
                `\n方案2 - 安装FUNASR Python库:\n` +
                `  pip install funasr torch torchaudio\n` +
                `\n方案3 - 安装Google Speech Recognition备用库:\n` +
                `  pip install SpeechRecognition pydub\n` +
                `\n详细错误:\n` +
                `  HTTP API错误: ${error?.message || error}\n` +
                `  Python脚本错误: ${pythonError?.message || pythonError}`
            );
        }
    }
}

/**
 * 使用Python脚本调用FUNASR（备用方案）
 */
async function callFunasrPythonScript(
    audioPath: string,
    config: any
): Promise<FunasrResult> {
    // 调用Python脚本进行语音识别
    // 使用统一的资源路径工具，自动处理开发和生产环境
    let pythonScript = getPythonScriptPath('funasr_recognize.py');

    // 【修复】如果在默认位置找不到脚本，尝试在源码目录查找（开发环境）
    if (!fs.existsSync(pythonScript)) {
        const sourcePath = path.join(process.cwd(), 'electron', 'mapi', 'ipAgent', 'python', 'funasr_recognize.py');
        if (fs.existsSync(sourcePath)) {
            pythonScript = sourcePath;
            Log.info("funasr.pythonScript.foundInSource", { pythonScript });
        }
    }

    Log.info("funasr.pythonScript.starting", {
        pythonScript,
        audioPath,
        language: config.language || 'zh'
    });

    if (!fs.existsSync(pythonScript)) {
        const errorMsg = `语音识别脚本不存在: ${pythonScript}`;
        Log.error("funasr.pythonScript.notFound", { pythonScript });
        throw new Error(errorMsg);
    }

    if (!fs.existsSync(audioPath)) {
        const errorMsg = `音频文件不存在: ${audioPath}`;
        Log.error("funasr.pythonScript.audioNotFound", { audioPath });
        throw new Error(errorMsg);
    }

    try {
        // 使用统一的 Python 调用工具（支持中文路径）
        const stdout = await spawnPython([
            pythonScript,
            '--audio', audioPath,
            '--language', config.language || 'zh',
            '--enable-word-timestamp', config.enableWordTimestamp ? '1' : '0'
        ], {
            timeout: 120000, // 120秒超时
            addFFmpegToPath: true
        });

        // 解析 JSON 输出
        let jsonStr = stdout.trim();
        if (!jsonStr.startsWith('{')) {
            const jsonStart = jsonStr.indexOf('{');
            if (jsonStart !== -1) {
                jsonStr = jsonStr.substring(jsonStart);
                let braceCount = 0;
                let jsonEnd = 0;
                for (let i = 0; i < jsonStr.length; i++) {
                    if (jsonStr[i] === '{') braceCount++;
                    if (jsonStr[i] === '}') braceCount--;
                    if (braceCount === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
                if (jsonEnd > 0) {
                    jsonStr = jsonStr.substring(0, jsonEnd);
                }
            }
        }

        Log.info("funasr.pythonScript.parsing", {
            extractedJsonLength: jsonStr.length,
            jsonStart: jsonStr.substring(0, 50)
        });

        const result = JSON.parse(jsonStr);
        if (result.success === false) {
            throw new Error(result.error || "未知错误");
        }

        Log.info("funasr.pythonScript.success", {
            segments: result.segments?.length || 0,
            language: result.language
        });

        return result;
    } catch (error: any) {
        const errorMsg = `Python脚本执行失败: ${error.message}`;
        Log.error("funasr.pythonScript.error", { error: error.message });
        throw new Error(errorMsg);
    }
}

/**
 * 解析FUNASR API响应
 */
function parseFunasrResponse(data: any): FunasrResult {
    // 根据实际FUNASR API响应格式解析
    // 这里假设返回格式类似Whisper
    const segments: FunasrSegment[] = data.segments?.map((seg: any) => ({
        text: seg.text || seg.sentence,
        start: seg.start || seg.begin_time / 1000,
        end: seg.end || seg.end_time / 1000,
        words: seg.words?.map((w: any) => ({
            word: w.word || w.text,
            start: w.start || w.begin_time / 1000,
            end: w.end || w.end_time / 1000,
            confidence: w.confidence
        })) || []
    })) || [];

    return {
        segments,
        language: data.language || 'zh',
        duration: data.duration || segments[segments.length - 1]?.end || 0
    };
}

/**
 * 生成Mock数据（开发测试用）
 */
function generateMockFunasrResult(audioPath: string): FunasrResult {
    Log.info("funasr.generateMockData", { audioPath });

    // 模拟生成一些测试数据
    const mockSegments: FunasrSegment[] = [
        {
            text: "欢迎使用FUNASR语音识别功能",
            start: 0,
            end: 3,
            words: [
                { word: "欢迎", start: 0, end: 0.5, confidence: 0.95 },
                { word: "使用", start: 0.5, end: 1.0, confidence: 0.92 },
                { word: "FUNASR", start: 1.0, end: 2.0, confidence: 0.88 },
                { word: "语音", start: 2.0, end: 2.5, confidence: 0.93 },
                { word: "识别", start: 2.5, end: 2.8, confidence: 0.91 },
                { word: "功能", start: 2.8, end: 3.0, confidence: 0.94 }
            ]
        },
        {
            text: "这个功能可以自动生成精确的字幕时间轴",
            start: 3.5,
            end: 7,
            words: [
                { word: "这个", start: 3.5, end: 3.8, confidence: 0.96 },
                { word: "功能", start: 3.8, end: 4.2, confidence: 0.93 },
                { word: "可以", start: 4.2, end: 4.6, confidence: 0.95 },
                { word: "自动", start: 4.6, end: 5.0, confidence: 0.94 },
                { word: "生成", start: 5.0, end: 5.4, confidence: 0.92 },
                { word: "精确的", start: 5.4, end: 6.0, confidence: 0.90 },
                { word: "字幕", start: 6.0, end: 6.5, confidence: 0.95 },
                { word: "时间轴", start: 6.5, end: 7.0, confidence: 0.93 }
            ]
        }
    ];

    return {
        segments: mockSegments,
        language: 'zh',
        duration: 7.0
    };
}

/**
 * 使用浏览器自动化下载抖音视频（绕过直接下载限制）
 * @param videoUrl 抖音视频URL
 * @param downloadPath 下载保存路径
 */
export async function downloadDouyinVideoWithBrowser(
    videoUrl: string,
    downloadPath: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        Log.info("funasr.downloadDouyinVideo.browser", { videoUrl, downloadPath });

        // 启动无头浏览器下载视频
        const browserArgs = [
            '--headless',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        const browserProcess = spawn('node', [
            path.join(__dirname, 'browser', 'douyin-downloader.js'),
            '--url', videoUrl,
            '--output', downloadPath,
            '--timeout', '60000'
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        browserProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        browserProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        browserProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout);
                    if (result.success && result.videoPath) {
                        Log.info("funasr.downloadDouyinVideo.success", { videoPath: result.videoPath });
                        resolve(result.videoPath);
                    } else {
                        reject(new Error(result.error || '浏览器下载失败'));
                    }
                } catch (parseError) {
                    reject(new Error(`浏览器下载返回无效结果: ${parseError?.message}`));
                }
            } else {
                reject(new Error(`浏览器下载进程失败 (代码${code}): ${stderr}`));
            }
        });

        browserProcess.on('error', (err) => {
            reject(new Error(`启动浏览器下载失败: ${err.message}`));
        });

        // 设置超时
        setTimeout(() => {
            browserProcess.kill();
            reject(new Error('浏览器下载超时（60秒）'));
        }, 60000);
    });
}

/**
 * 将FUNASR识别结果转换为SRT格式
 */
export function funasrResultToSrt(result: FunasrResult, options?: {
    maxCharsPerLine?: number;
    maxLinesPerSubtitle?: number;
}): string {
    const config = {
        maxCharsPerLine: options?.maxCharsPerLine || 20,
        maxLinesPerSubtitle: options?.maxLinesPerSubtitle || 2
    };

    let srtContent = '';
    let index = 1;

    for (const segment of result.segments) {
        // 将长句子分割成多行
        const lines = splitTextIntoLines(segment.text, config.maxCharsPerLine);
        const linesForSubtitle: string[] = [];

        for (let i = 0; i < lines.length; i += config.maxLinesPerSubtitle) {
            const subtitleLines = lines.slice(i, i + config.maxLinesPerSubtitle);
            const subtitleText = subtitleLines.join('\n');

            // 计算该字幕段的时间（按比例分配）
            const ratio = i / lines.length;
            const nextRatio = Math.min((i + config.maxLinesPerSubtitle) / lines.length, 1);
            const duration = segment.end - segment.start;
            const start = segment.start + duration * ratio;
            const end = segment.start + duration * nextRatio;

            srtContent += `${index}\n`;
            srtContent += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
            srtContent += `${subtitleText}\n\n`;
            index++;
        }
    }

    return srtContent;
}

/**
 * 将文本按最大字符数分割成多行
 * 优化：遇到标点符号（，。！？等）时立即换行，使字幕更清晰
 */
function splitTextIntoLines(text: string, maxCharsPerLine: number): string[] {
    const lines: string[] = [];
    let currentLine = '';

    // 定义换行标点符号：遇到这些标点立即换行
    // 中文标点：，。！？、；：等
    // 英文标点：,.!?;:等
    const lineBreakPunct = /[，。！？、；：,\.!\?;:]/;

    // 按字符遍历文本
    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // 将字符添加到当前行
        currentLine += char;

        // 计算当前行长度（中文字符算1，英文字符算0.5）
        const lineLength = calculateLineLengthFunasr(currentLine);

        // 情况1: 遇到换行标点符号，立即换行（保留标点符号）
        if (lineBreakPunct.test(char)) {
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
            }
            currentLine = '';
        }
        // 情况2: 当前行达到最大长度限制，换行
        else if (lineLength >= maxCharsPerLine) {
            // 尝试在最后一个标点符号处分割
            let lastPunctIndex = -1;
            for (let j = currentLine.length - 2; j >= 0; j--) {
                if (lineBreakPunct.test(currentLine[j])) {
                    lastPunctIndex = j;
                    break;
                }
            }

            if (lastPunctIndex >= 0) {
                // 在标点符号后分割（包含标点符号）
                const beforePunct = currentLine.substring(0, lastPunctIndex + 1);
                const afterPunct = currentLine.substring(lastPunctIndex + 1);

                if (beforePunct.trim()) {
                    lines.push(beforePunct.trim());
                }
                currentLine = afterPunct;
            } else {
                // 没有找到合适的标点符号，在当前字符前强制分割
                const lineToAdd = currentLine.slice(0, -1);
                if (lineToAdd.trim()) {
                    lines.push(lineToAdd.trim());
                }
                currentLine = char;
            }
        }
    }

    // 添加最后一行
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }

    // 过滤掉空行
    const filteredLines = lines.filter(line => line.trim().length > 0);

    return filteredLines.length > 0 ? filteredLines : [text];
}

/**
 * 计算文本行的显示长度
 * 中文字符算1，英文字符算0.5，标点符号算0.5
 */
function calculateLineLengthFunasr(text: string): number {
    let length = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
            // 中文字符
            length += 1;
        } else if (/[a-zA-Z0-9]/.test(char)) {
            // 英文字母和数字
            length += 0.5;
        } else {
            // 标点符号和空格
            length += 0.5;
        }
    }
    return length;
}

/**
 * 格式化SRT时间格式
 * @param seconds 时间（秒）
 * @returns SRT时间格式字符串 (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * 从视频中提取音频（用于FUNASR识别）
 * 注意：FUNASR可以使用44.1kHz立体声音频，识别效果更好
 * @param videoPath 视频文件路径
 * @param outputAudioPath 输出音频路径（可选）
 * @param useHighQuality 是否使用高质量音频（44.1kHz立体声），默认true
 */
export async function extractAudioFromVideo(
    videoPath: string,
    outputAudioPath?: string,
    useHighQuality: boolean = true
): Promise<string> {
    const parsedPath = path.parse(videoPath);
    const audioPath = outputAudioPath || path.join(parsedPath.dir, `${parsedPath.name}_audio.wav`);

    // 使用高质量音频参数：44.1kHz立体声，这样可以保持原始音频质量
    // 大多数现代ASR系统（包括FUNASR）都能处理高质量音频，且识别效果更好
    const sampleRate = useHighQuality ? '44100' : '16000';
    const channels = useHighQuality ? '2' : '1';

    Log.info("funasr.extractAudio", { videoPath, audioPath, sampleRate, channels, useHighQuality });

    return new Promise(async (resolve, reject) => {
        let ffmpegPath: string;
        try {
            // ⚠️ 只使用程序自带的 FFmpeg，不依赖系统环境
            ffmpegPath = await getFFmpegPath();
            Log.info("funasr.extractAudio.usingFFmpeg", { ffmpegPath });
        } catch (error: any) {
            Log.error("funasr.extractAudio.ffmpegPathError", { error: error.message });
            reject(new Error(`无法获取 FFmpeg 路径: ${error.message}`));
            return;
        }

        // 🔧 修复中文路径：规范化路径参数
        const normalizePathForFFmpeg = (filePath: string): string => {
            if (process.platform === 'win32') {
                // Windows 上使用正斜杠，FFmpeg 可以正确处理
                return filePath.replace(/\\/g, '/');
            }
            return filePath;
        };

        // spawn 选项：使用 shell: false 以正确传递参数
        const spawnOptions: any = {
            shell: false
        };

        const ffmpegProcess = spawn(ffmpegPath, [
            '-i', normalizePathForFFmpeg(videoPath),
            '-vn',  // 不包含视频
            '-acodec', 'pcm_s16le',  // PCM编码
            '-ar', sampleRate,  // 采样率：高质量用44.1kHz，低质量用16kHz
            '-ac', channels,  // 声道：高质量用立体声(2)，低质量用单声道(1)
            '-y',  // 覆盖已存在文件
            normalizePathForFFmpeg(audioPath)
        ], spawnOptions);

        let stderrOutput = '';

        ffmpegProcess.stderr.on('data', (data) => {
            stderrOutput += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                Log.info("funasr.extractAudio.success", { audioPath });
                resolve(audioPath);
            } else {
                Log.error("funasr.extractAudio.error", { code, stderr: stderrOutput });
                reject(new Error(`提取音频失败，退出码: ${code}`));
            }
        });

        ffmpegProcess.on('error', (err) => {
            Log.error("funasr.extractAudio.spawnError", err);
            reject(err);
        });
    });
}
