import { systemVoices } from '../../../src/pages/Sound/config/systemVoices';
import { synthesizeSpeech } from './cosyvoice';
import { Log } from '../log/main';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

/**
 * 系统默认音色列表（与前端保持一致）
 */
const SYSTEM_VOICES = systemVoices;

const LEGACY_SYSTEM_VOICE_FILES = [
    'sys_longanyang.mp3',
    'sys_longanhuan.mp3',
    'sys_longanrou_v3.mp3',
    'sys_longhan_v3.mp3',
    'sys_longhuhu_v3.mp3',
];

/**
 * 获取预缓存目录路径
 */
export function getPreCacheDir(): string {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, 'voice-preview-cache', 'cosyvoice-v3');

    // 确保目录存在
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    return cacheDir;
}

/**
 * 获取指定音色的预缓存文件路径
 */
export function getPreCachedVoicePath(voiceId: string): string | null {
    const cacheDir = getPreCacheDir();
    const filePath = path.join(cacheDir, `${voiceId}.wav`);

    if (fs.existsSync(filePath)) {
        return filePath;
    }

    return null;
}

export function clearLegacyPreCacheFiles(): void {
    const cacheDir = getPreCacheDir();

    for (const file of LEGACY_SYSTEM_VOICE_FILES) {
        const filePath = path.join(cacheDir, file);
        if (!fs.existsSync(filePath)) {
            continue;
        }

        try {
            fs.unlinkSync(filePath);
            Log.info('voicePreCache.legacyCleared', { filePath });
        } catch (error: any) {
            Log.error('voicePreCache.legacyClearError', { filePath, error: error.message });
        }
    }
}

/**
 * 检查所有默认音色是否已缓存
 */
export function isAllVoicesCached(): boolean {
    return SYSTEM_VOICES.every(voice => {
        const cachedPath = getPreCachedVoicePath(voice.id);
        return cachedPath !== null;
    });
}

/**
 * 预生成所有默认音色的试听音频
 * @param apiKey 阿里云API Key
 * @param force 是否强制重新生成（即使已存在）
 */
export async function preCacheSystemVoices(apiKey: string, force: boolean = false): Promise<void> {
    if (!apiKey) {
        Log.warn('voicePreCache.preCacheSystemVoices', '缺少阿里云API Key，跳过预缓存');
        return;
    }

    Log.info('voicePreCache.preCacheSystemVoices.start', {
        totalVoices: SYSTEM_VOICES.length,
        force
    });

    const cacheDir = getPreCacheDir();
    let cachedCount = 0;
    let generatedCount = 0;
    let errorCount = 0;

    for (const voice of SYSTEM_VOICES) {
        try {
            const filePath = path.join(cacheDir, `${voice.id}.wav`);

            // 如果文件已存在且不强制重新生成，则跳过
            if (!force && fs.existsSync(filePath)) {
                cachedCount++;
                Log.info('voicePreCache.alreadyCached', {
                    voiceId: voice.id,
                    title: voice.title,
                    filePath
                });
                continue;
            }

            // 生成试听文本
            const previewText = `你好，我是${voice.title.split('（')[0]}，很高兴为您服务。`;

            Log.info('voicePreCache.generating', {
                voiceId: voice.id,
                title: voice.title,
                text: previewText
            });

            // 调用阿里云API生成音频
            const result = await synthesizeSpeech(previewText, {
                apiKey: apiKey,
                model: 'cosyvoice-v3-flash',
                voice: voice.aliyunVoiceId,
                format: 'wav',
                sampleRate: 24000,
                outputPath: filePath
            });

            if (result.success && result.audioPath) {
                generatedCount++;
                Log.info('voicePreCache.generated', {
                    voiceId: voice.id,
                    title: voice.title,
                    audioPath: result.audioPath,
                    fileSize: fs.existsSync(result.audioPath) ? fs.statSync(result.audioPath).size : 0
                });
            } else {
                errorCount++;
                Log.error('voicePreCache.generateFailed', {
                    voiceId: voice.id,
                    title: voice.title,
                    error: result.error
                });
            }

            // 添加短暂延迟，避免API请求过快
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
            errorCount++;
            Log.error('voicePreCache.error', {
                voiceId: voice.id,
                title: voice.title,
                error: error.message
            });
        }
    }

    Log.info('voicePreCache.preCacheSystemVoices.complete', {
        total: SYSTEM_VOICES.length,
        alreadyCached: cachedCount,
        generated: generatedCount,
        errors: errorCount
    });
}

/**
 * 清除所有预缓存的音色文件
 */
export function clearPreCache(): void {
    const cacheDir = getPreCacheDir();

    if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        files.forEach(file => {
            const filePath = path.join(cacheDir, file);
            try {
                fs.unlinkSync(filePath);
                Log.info('voicePreCache.cleared', { filePath });
            } catch (error: any) {
                Log.error('voicePreCache.clearError', { filePath, error: error.message });
            }
        });
    }
}

/**
 * 尝试从应用资源目录复制预缓存文件
 * 用于首次启动或升级时，支持开发环境和打包后的环境
 */
export async function copyPreCacheFromResources(): Promise<boolean> {
    try {
        // 尝试找到应用内的预缓存资源目录
        const possibleResourcePaths = [
            // 打包后的应用（electron-builder extraResources）
            path.join(app.getAppPath(), '../voice-preview-cache'),
            path.join(app.getAppPath(), 'voice-preview-cache'),
            // 打包后的应用（asar 格式）
            path.join(app.getAppPath(), 'voice-preview-cache'),
            path.join(app.getAppPath().replace(/\.asar$/, '.asar.unpacked'), 'voice-preview-cache'),
            // 开发环境
            path.join(process.cwd(), 'electron/resources/voice-preview-cache'),
            // 备选路径
            path.join(process.resourcesPath, 'voice-preview-cache'),
            path.join(process.resourcesPath, '../voice-preview-cache'),
        ];

        Log.info('voicePreCache.searchingResources', {
            appPath: app.getAppPath(),
            resourcesPath: process.resourcesPath,
            cwd: process.cwd(),
            possiblePaths: possibleResourcePaths
        });

        for (const resourcePath of possibleResourcePaths) {
            try {
                if (fs.existsSync(resourcePath)) {
                    const files = SYSTEM_VOICES
                        .map(voice => `${voice.id}.wav`)
                        .filter(file => fs.existsSync(path.join(resourcePath, file)));

                    if (files.length === 0) {
                        Log.info('voicePreCache.resourcePathEmpty', {
                            resourcePath,
                            allFiles: fs.readdirSync(resourcePath)
                        });
                        continue;
                    }

                    const targetDir = getPreCacheDir();
                    let copiedCount = 0;

                    for (const file of files) {
                        const sourceFile = path.join(resourcePath, file);
                        const targetFile = path.join(targetDir, file);

                        try {
                            // 只复制不存在的文件，避免覆盖用户后来生成的文件
                            if (!fs.existsSync(targetFile)) {
                                fs.copyFileSync(sourceFile, targetFile);
                                copiedCount++;
                                Log.info('voicePreCache.fileCopied', {
                                    file,
                                    sourceFile,
                                    targetFile,
                                    size: fs.statSync(sourceFile).size
                                });
                            } else {
                                Log.info('voicePreCache.fileSkipped', {
                                    file,
                                    reason: '文件已存在'
                                });
                            }
                        } catch (copyError: any) {
                            Log.error('voicePreCache.copyError', {
                                file,
                                error: copyError.message
                            });
                        }
                    }

                    if (copiedCount > 0 || files.length > 0) {
                        Log.info('voicePreCache.copyFromResourcesComplete', {
                            resourcePath,
                            totalFiles: files.length,
                            copiedCount,
                            targetDir
                        });
                        return true;
                    }
                }
            } catch (pathError: any) {
                Log.debug('voicePreCache.pathCheckError', {
                    resourcePath,
                    error: pathError.message
                });
                continue;
            }
        }

        // 没有找到资源目录，返回 false
        Log.info('voicePreCache.noResourcesFound', {
            message: '未找到预缓存资源文件，将自动生成',
            possiblePaths: possibleResourcePaths
        });
        return false;
    } catch (error: any) {
        Log.error('voicePreCache.copyFromResourcesError', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}
