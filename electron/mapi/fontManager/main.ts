import { ipcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { app } from 'electron';
import { getPythonPath } from '../../lib/python-util';
import { getPythonScriptPath } from '../../lib/resource-path';
import { isPackaged } from '../../lib/env';
import { AppEnv } from '../env';
import { spawnPython } from '../../lib/python-spawn-util';

/**
 * 广播字体列表变更事件到所有窗口
 */
function broadcastFontListChanged() {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
        window.webContents.send('fontManager:fontsChanged');
    });
    console.log('[FontManager] Broadcasted font list changed event to', windows.length, 'windows');
}

/**
 * 检测字体类型（中文/英文/混合）
 */
function detectFontType(fontName: string, languages: string[] = []): 'Chinese' | 'English' | 'Mixed' {
    // 中文字体关键词列表
    const chineseKeywords = [
        '中文', '中', '汉', '黑', '宋', '楷', '隶', '篆', '仿',
        '雅黑', '微软', '思源', '猫啃', '墨趣', '古风',
        '骚包', '手写', '毛峰', '张亚玲', '黑方', '朴素',
        'SimHei', 'SimSun', 'FangSong', 'KaiTi', 'Microsoft YaHei',
        'simsun', 'simhei', 'yahei', '胡晓波', '平方',
        '雨晨', '字体', '书法', '装饰', '标题', '毛笔'
    ];

    // 英文字体关键词列表
    const englishKeywords = [
        'Arial', 'Helvetica', 'Times', 'Courier', 'Verdana', 'Georgia',
        'Comic', 'Impact', 'Trebuchet', 'Lucida', 'Palatino',
        'Bodoni', 'Garamond', 'Calibri', 'Consolas', 'Monaco',
        'Roboto', 'Open Sans', 'Lato', 'Raleway', 'Montserrat',
        'Murecho', 'Maoken', 'Dymon', 'Fonte', 'Black', 'Bold',
        'Light', 'Regular', 'Medium', 'SemiBold', 'ExtraLight'
    ];

    const fontNameLower = fontName.toLowerCase();

    // 检查支持的语言
    const supportsChinese = languages.includes('zh-CN') || languages.includes('zh');
    const supportsEnglish = languages.includes('en') || languages.length === 0; // 如果没有指定语言，默认认为支持英文

    // 根据字体名称匹配关键词
    const hasChineseKeyword = chineseKeywords.some(keyword =>
        fontNameLower.includes(keyword.toLowerCase())
    );

    const hasEnglishKeyword = englishKeywords.some(keyword =>
        fontNameLower.includes(keyword.toLowerCase())
    );

    // 判断逻辑
    if (supportsChinese && hasChineseKeyword) {
        return 'Chinese';
    }

    if (supportsChinese && !supportsEnglish) {
        return 'Chinese';
    }

    if (!supportsChinese && supportsEnglish) {
        return 'English';
    }

    // 检查字体名称中是否有中文字符
    const chineseCharMatch = fontName.match(/[\u4e00-\u9fff]/);
    if (chineseCharMatch) {
        return 'Chinese';
    }

    // 根据关键词判断
    if (hasChineseKeyword) {
        return 'Chinese';
    }

    if (hasEnglishKeyword) {
        return 'English';
    }

    // 默认判断：如果语言列表中包含中文，则为中文字体
    if (supportsChinese) {
        return 'Chinese';
    }

    return 'English'; // 默认为英文字体
}

/**
 * 获取应用根目录（支持ASAR打包和非打包环境）
 */
function getAppRoot(): string {
    // 优先使用 APP_ROOT 环境变量（在 env-main.ts 中设置）
    if (process.env.APP_ROOT) {
        return process.env.APP_ROOT;
    }
    // 回退方案：使用 resources 路径（生产环境）
    if (process.resourcesPath) {
        return process.resourcesPath;
    }
    // 最后回退：使用当前工作目录
    return process.cwd();
}

/**
 * 获取 ziti 目录路径（考虑ASAR打包）
 */
function getZitiDir(): string {
    if (isPackaged) {
        // 生产环境：优先使用 AppEnv.resourceBundleRoot
        if (AppEnv.resourceBundleRoot && fs.existsSync(AppEnv.resourceBundleRoot)) {
            const bundlePath = path.join(AppEnv.resourceBundleRoot, 'ziti');
            if (fs.existsSync(bundlePath)) {
                console.log('[FontManager] 使用 AppEnv.resourceBundleRoot:', bundlePath);
                return bundlePath;
            }
        }

        // 回退：通过 process.resourcesPath 计算
        if (process.resourcesPath) {
            const installRoot = path.dirname(process.resourcesPath);
            const bundlePath = path.join(installRoot, 'resources-bundles', 'ziti');
            if (fs.existsSync(bundlePath)) {
                console.log('[FontManager] 使用 process.resourcesPath:', bundlePath);
                return bundlePath;
            }
        }

        // 回退：app.asar.unpacked/ziti
        const appRoot = getAppRoot();
        const asarUnpackedPath = path.join(appRoot, 'app.asar.unpacked', 'ziti');
        if (fs.existsSync(asarUnpackedPath)) {
            console.log('[FontManager] 使用 app.asar.unpacked:', asarUnpackedPath);
            return asarUnpackedPath;
        }

        // 最后回退：返回默认路径
        const fallbackRoot = process.resourcesPath ? path.dirname(process.resourcesPath) : getAppRoot();
        console.warn('[FontManager] 所有 ziti 路径都不存在，返回默认路径');
        return path.join(fallbackRoot, 'resources-bundles', 'ziti');
    } else {
        // 开发环境：ziti 在项目根目录
        const appRoot = getAppRoot();
        return path.join(appRoot, 'ziti');
    }
}

const FONTS_DIR = path.join(app.getPath('userData'), 'fonts', 'custom');
const METADATA_FILE = path.join(FONTS_DIR, 'fonts_metadata.json');

// 确保字体目录存在
fs.ensureDirSync(FONTS_DIR);

/**
 * 扫描 ziti 目录获取字体
 */
function scanZitiFonts(): any[] {
    const zitiDir = getZitiDir();
    const fonts: any[] = [];

    console.log('[FontManager] 扫描ziti目录:', zitiDir);

    // 字体名称映射表（英文文件名 -> 中文显示名）
    const fontNameMap: Record<string, string> = {
        'Dymon-ShouXieTi': 'Dymon手写体',
        'MaokenAssortedSans': '猫啃杂糅体',
        'MaokenAssortedSans-Lite': '猫啃杂糅体 Lite',
        'Murecho-Black': 'Murecho 黑体',
        'Murecho-Bold': 'Murecho 粗体',
        'Murecho-ExtraBold': 'Murecho 特粗体',
        'Murecho-ExtraLight': 'Murecho 特细体',
        'Murecho-Light': 'Murecho 细体',
        'Murecho-Medium': 'Murecho 中等',
        'Murecho-Regular': 'Murecho 常规',
        'Murecho-SemiBold': 'Murecho 半粗体',
        'Murecho-Thin': 'Murecho 纤细体',
        'けいなん丸ポップ体JP': 'けいなん丸ポップ体',
        '墨趣古风体': '墨趣古风体',
        '平方张亚玲黑方体': '平方张亚玲黑方体',
        '胡晓波骚包体2.0': '胡晓波骚包体'
    };

    // 字体类型映射表
    const fontTypeMap: Record<string, 'Chinese' | 'English' | 'Mixed'> = {
        'Dymon-ShouXieTi': 'English',
        'MaokenAssortedSans': 'Mixed',
        'MaokenAssortedSans-Lite': 'Mixed',
        'Murecho-Black': 'English',
        'Murecho-Bold': 'English',
        'Murecho-ExtraBold': 'English',
        'Murecho-ExtraLight': 'English',
        'Murecho-Light': 'English',
        'Murecho-Medium': 'English',
        'Murecho-Regular': 'English',
        'Murecho-SemiBold': 'English',
        'Murecho-Thin': 'English',
        'けいなん丸ポップ体JP': 'English',
        '墨趣古风体': 'Chinese',
        '平方张亚玲黑方体': 'Chinese',
        '胡晓波骚包体2.0': 'Chinese'
    };

    try {
        if (!fs.existsSync(zitiDir)) {
            console.log('[FontManager] ziti directory not found:', zitiDir);
            return [];
        }

        const files = fs.readdirSync(zitiDir);
        const fontExtensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];

        files.forEach(file => {
            const ext = path.extname(file).toLowerCase();
            if (fontExtensions.includes(ext)) {
                const name = path.basename(file, ext);
                // 使用映射表获取中文名称，如果没有映射则使用原文件名
                const displayName = fontNameMap[name] || name;

                // 使用映射表获取字体类型，如果没有则自动检测
                const fontType = fontTypeMap[name] || detectFontType(name, ['zh-CN', 'ja', 'en']);

                fonts.push({
                    value: name,
                    label: displayName,
                    source: 'ziti',
                    fontType: fontType,
                    category: 'sans-serif',
                    languages: ['zh-CN', 'ja', 'en'],
                    path: path.join(zitiDir, file),
                    // 🔧 新增：国际字体标志（ziti字体通常不是国际字体）
                    isInternational: false
                });
            }
        });

        console.log('[FontManager] Scanned ziti fonts:', fonts.length);
    } catch (error) {
        console.error('[FontManager] Error scanning ziti:', error);
    }

    return fonts;
}

/**
 * 获取预置字体
 */
function getBundledFonts(): any[] {
    const appRoot = getAppRoot();
    const metadataFile = path.join(appRoot, 'fonts', 'bundled', 'fonts_metadata.json');

    try {
        if (!fs.existsSync(metadataFile)) {
            console.log('[FontManager] Bundled fonts metadata not found');
            return [];
        }

        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
        const fonts = (metadata.fonts || []).map((font: any) => {
            const languages = font.languages || [];
            const fontType = font.fontType || detectFontType(font.family, languages);

            return {
                value: font.family,
                label: font.display_name || font.family,
                source: 'bundled',
                fontType: fontType,
                category: font.category || 'sans-serif',
                languages: languages,
                // 🔧 关键修复：传递 isInternational 标志
                isInternational: font.isInternational || false,
                supportsCyrillic: font.supportsCyrillic || false,
                supportsHangul: font.supportsHangul || false,
                supportsKana: font.supportsKana || false
            };
        });

        console.log('[FontManager] Bundled fonts:', fonts.length);
        return fonts;
    } catch (error) {
        console.error('[FontManager] Error reading bundled fonts:', error);
        return [];
    }
}

/**
 * 获取系统字体（Windows）
 */
function getSystemFonts(): any[] {
    const fonts: any[] = [];

    try {
        if (process.platform === 'win32') {
            const systemFonts = [
                { file: 'simhei.ttf', family: 'SimHei', label: '黑体', fontType: 'Chinese' as const, isInternational: false },
                { file: 'simsun.ttc', family: 'SimSun', label: '宋体', fontType: 'Chinese' as const, isInternational: false },
                { file: 'msyh.ttc', family: 'Microsoft YaHei', label: '微软雅黑', fontType: 'Chinese' as const, isInternational: false },
                { file: 'arial.ttf', family: 'Arial', label: 'Arial', fontType: 'English' as const, isInternational: false },
                { file: 'times.ttf', family: 'Times New Roman', label: 'Times New Roman', fontType: 'English' as const, isInternational: false },
            ];

            const fontDir = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Fonts');
            systemFonts.forEach(({ file, family, label, fontType, isInternational, languages }) => {
                const fontPath = path.join(fontDir, file);
                if (fs.existsSync(fontPath)) {
                    fonts.push({
                        value: family,
                        label: label,
                        source: 'system',
                        fontType: fontType,
                        category: 'sans-serif',
                        languages: languages || [],
                        isInternational: isInternational || false
                    });
                }
            });
        } else if (process.platform === 'darwin') {
            const macFonts = [
                { file: 'PingFang.ttc', family: 'PingFang SC', label: '苹方-简', fontType: 'Chinese' as const, isInternational: false },
                { file: 'STHeiti Light.ttc', family: 'STHeiti', label: '华文黑体', fontType: 'Chinese' as const, isInternational: false },
                { file: 'STSong.ttf', family: 'STSong', label: '华文宋体', fontType: 'Chinese' as const, isInternational: false },
                { file: 'Arial.ttf', family: 'Arial', label: 'Arial', fontType: 'English' as const, isInternational: false },
                { file: 'Times.ttf', family: 'Times New Roman', label: 'Times New Roman', fontType: 'English' as const, isInternational: false },
                { file: 'Helvetica.ttc', family: 'Helvetica', label: 'Helvetica', fontType: 'English' as const, isInternational: false },
            ];
            const macFontDirs = ['/System/Library/Fonts', '/Library/Fonts', path.join(require('os').homedir(), 'Library', 'Fonts')];
            for (const { file, family, label, fontType, isInternational, languages } of macFonts) {
                for (const dir of macFontDirs) {
                    const fontPath = path.join(dir, file);
                    if (fs.existsSync(fontPath)) {
                        fonts.push({
                            value: family, label, source: 'system', fontType,
                            category: 'sans-serif', languages: languages || [],
                            isInternational: isInternational || false
                        });
                        break;
                    }
                }
            }
        } else {
            const linuxFonts = [
                { file: 'NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC', label: 'Noto Sans CJK SC', fontType: 'Chinese' as const, isInternational: false },
                { file: 'WenQuanYiMicroHei.ttf', family: 'WenQuanYi Micro Hei', label: '文泉驿微米黑', fontType: 'Chinese' as const, isInternational: false },
            ];
            const linuxFontDirs = ['/usr/share/fonts', '/usr/local/share/fonts'];
            for (const { file, family, label, fontType, isInternational, languages } of linuxFonts) {
                for (const dir of linuxFontDirs) {
                    const fontPath = path.join(dir, file);
                    if (fs.existsSync(fontPath)) {
                        fonts.push({
                            value: family, label, source: 'system', fontType,
                            category: 'sans-serif', languages: languages || [],
                            isInternational: isInternational || false
                        });
                        break;
                    }
                }
            }
        }

        console.log('[FontManager] System fonts:', fonts.length);
    } catch (error) {
        console.error('[FontManager] Error scanning system fonts:', error);
    }

    return fonts;
}

// 🔧 字体缓存，避免频繁扫描文件系统
let fontCache: { success: boolean; data?: any[]; message?: string } | null = null;
let fontCacheTime = 0;
const FONT_CACHE_TTL = 30000; // 缓存 30 秒

/**
 * 获取所有可用字体（Node.js 实现，不依赖 Python）
 * 🔧 添加缓存机制，避免频繁扫描导致 CPU 100%
 */
export async function getAllFonts() {
    try {
        // 检查缓存是否有效
        const now = Date.now();
        if (fontCache && (now - fontCacheTime) < FONT_CACHE_TTL) {
            // console.log('[FontManager] Using cached fonts');
            return fontCache;
        }

        console.log('[FontManager] Getting all fonts (Node.js implementation)');

        // 合并所有字体源
        const allFonts = [
            ...getBundledFonts(),
            ...scanZitiFonts(),
            ...getSystemFonts()
        ];

        // 去重（按 value）
        const seen = new Set();
        const uniqueFonts = allFonts.filter(font => {
            if (seen.has(font.value)) {
                return false;
            }
            seen.add(font.value);
            return true;
        });

        console.log('[FontManager] Total unique fonts:', uniqueFonts.length);

        // 更新缓存
        fontCache = {
            success: true,
            data: uniqueFonts
        };
        fontCacheTime = now;

        return fontCache;
    } catch (error: any) {
        console.error('[FontManager] Exception:', error);
        return {
            success: false,
            message: error.message || '获取字体列表失败'
        };
    }
}

/**
 * 清除字体缓存（在上传/删除字体后调用）
 */
export function clearFontCache() {
    fontCache = null;
    fontCacheTime = 0;
    console.log('[FontManager] Font cache cleared');
}

/**
 * 上传自定义字体
 */
export async function uploadFont(params: {
    fileName: string;
    fileData?: number[];
    fileDataBase64?: string;
    displayName: string;
    fontFamily: string;
    category: string;
    languages: string[];
    fontType?: 'Chinese' | 'English' | 'Mixed';
    uploadToZiti?: boolean;
}) {
    try {
        const { fileName, fileData, fileDataBase64, displayName, fontFamily, category, languages, uploadToZiti } = params;

        // 确定保存目录：如果指定上传到ziti，则保存到ziti目录，否则保存到自定义字体目录
        let fontPath: string;
        let saveDir: string;

        if (uploadToZiti) {
            saveDir = getZitiDir();
            fs.ensureDirSync(saveDir);
            fontPath = path.join(saveDir, fileName);
        } else {
            fontPath = path.join(FONTS_DIR, fileName);
        }

        // 支持两种格式：Base64编码或数组
        let buffer: Buffer;
        if (fileDataBase64) {
            console.log('[FontManager] 使用Base64解码, length:', fileDataBase64.length);
            buffer = Buffer.from(fileDataBase64, 'base64');
        } else if (fileData) {
            console.log('[FontManager] 使用数组转换, length:', fileData.length);
            buffer = Buffer.from(fileData);
        } else {
            throw new Error('缺少文件数据');
        }

        console.log('[FontManager] Buffer size:', buffer.length);
        await fs.writeFile(fontPath, buffer);
        console.log('[FontManager] Font file saved to:', fontPath);

        // 只有上传到自定义目录时才需要保存元数据
        if (!uploadToZiti) {
            // 更新元数据
            let metadata: any = { fonts: [] };
            if (await fs.pathExists(METADATA_FILE)) {
                metadata = await fs.readJSON(METADATA_FILE);
            }

            // 自动检测字体类型
            const fontType = params.fontType || detectFontType(fontFamily, languages);

            // 添加新字体信息
            metadata.fonts.push({
                family: fontFamily,
                display_name: displayName,
                path: fileName,
                source: 'custom',
                fontType: fontType,
                category: category,
                languages: languages,
                uploadedAt: new Date().toISOString()
            });

            // 保存元数据
            await fs.writeJSON(METADATA_FILE, metadata, { spaces: 2 });
        }

        // 延迟后广播字体列表变更事件，确保文件已写入磁盘
        setTimeout(() => {
            console.log('[FontManager] Broadcasting font list changed event');
            broadcastFontListChanged();
        }, 200);

        return {
            success: true,
            message: '字体上传成功'
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '上传字体失败'
        };
    }
}

/**
 * 删除自定义字体
 */
export async function deleteFont(fontFamily: string) {
    try {
        // 读取元数据
        if (!await fs.pathExists(METADATA_FILE)) {
            return {
                success: false,
                message: '元数据文件不存在'
            };
        }

        const metadata = await fs.readJSON(METADATA_FILE);
        const fontIndex = metadata.fonts.findIndex((f: any) => f.family === fontFamily && f.source === 'custom');

        if (fontIndex === -1) {
            return {
                success: false,
                message: '字体不存在或不是自定义字体'
            };
        }

        const font = metadata.fonts[fontIndex];
        const fontPath = path.join(FONTS_DIR, font.path);

        // 删除字体文件
        if (await fs.pathExists(fontPath)) {
            await fs.remove(fontPath);
        }

        // 从元数据中移除
        metadata.fonts.splice(fontIndex, 1);
        await fs.writeJSON(METADATA_FILE, metadata, { spaces: 2 });

        // 广播字体列表变更事件
        broadcastFontListChanged();

        return {
            success: true,
            message: '字体删除成功'
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || '删除字体失败'
        };
    }
}

/**
 * 查找字体文件路径
 */
export async function findFontPath(fontFamily: string, fontWeight: number = 400) {
    // ✅ 优先使用 Node.js 直接扫描 ziti 目录（不依赖 Python）
    try {
        const zitiDir = getZitiDir();
        if (fs.existsSync(zitiDir)) {
            const files = fs.readdirSync(zitiDir);
            const fontExtensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];
            
            // 精确匹配：字体名称 = 文件名（不含扩展名）
            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (!fontExtensions.includes(ext)) continue;
                
                const fileName = path.basename(file, ext);
                // 精确匹配或模糊匹配（忽略大小写和空格）
                const fileNameLower = fileName.toLowerCase().replace(/\s+/g, '');
                const fontNameLower = fontFamily.toLowerCase().replace(/\s+/g, '');
                
                if (fileNameLower === fontNameLower || 
                    fileNameLower.includes(fontNameLower) || 
                    fontNameLower.includes(fileNameLower)) {
                    const fontPath = path.join(zitiDir, file);
                    console.log(`[FontManager] 在ziti目录找到字体: ${fontFamily} -> ${fontPath}`);
                    return {
                        success: true,
                        data: fontPath
                    };
                }
            }
        }
    } catch (error: any) {
        console.warn(`[FontManager] ziti目录扫描失败: ${error.message}`);
    }
    
    // ✅ 回退方案：尝试使用 Python 脚本（如果可用）
    // ⚠️ 只使用程序自带的 Python，不依赖系统环境
    try {
        const scriptPath = getPythonScriptPath('find_font.py');

        // 使用统一的 Python 调用工具（支持中文路径）
        const output = await spawnPython([
            scriptPath,
            fontFamily,
            fontWeight.toString()
        ], {
            timeout: 3000  // 3秒超时
        });

        const fontPath = output.trim();
        if (fontPath) {
            console.log(`[FontManager] 通过Python找到字体: ${fontFamily} -> ${fontPath}`);
            return {
                success: true,
                data: fontPath
            };
        } else {
            throw new Error('Python脚本未返回字体路径');
        }
    } catch (error: any) {
        // Python 调用失败，使用系统字体映射
        console.warn(`[FontManager] Python查找字体失败: ${error.message}`);
    }
    
    // ✅ 最后回退：返回 ziti 目录下的默认字体
    // 不使用系统字体，只使用项目自带的字体
    const zitiDir = getZitiDir();
    const defaultFontPath = path.join(zitiDir, '微软雅黑.ttf');

    // 检查默认字体是否存在
    if (fs.existsSync(defaultFontPath)) {
        console.log(`[FontManager] 使用默认字体: ${fontFamily} -> ${defaultFontPath}`);
        return {
            success: true,
            data: defaultFontPath
        };
    }

    // 尝试找到 ziti 目录下的任意字体作为回退
    try {
        if (fs.existsSync(zitiDir)) {
            const files = fs.readdirSync(zitiDir);
            const fontExtensions = ['.ttf', '.otf', '.ttc', '.woff', '.woff2'];
            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (fontExtensions.includes(ext)) {
                    const fallbackPath = path.join(zitiDir, file);
                    console.log(`[FontManager] 使用回退字体: ${fontFamily} -> ${fallbackPath}`);
                    return {
                        success: true,
                        data: fallbackPath
                    };
                }
            }
        }
    } catch (error: any) {
        console.warn(`[FontManager] 查找回退字体失败: ${error.message}`);
    }

    // 最终失败
    console.warn(`[FontManager] 未找到字体: ${fontFamily}，ziti目录: ${zitiDir}`);
    return {
        success: false,
        message: `未找到字体: ${fontFamily}`
    };
}

/**
 * 注册IPC处理器
 */
export function registerFontManagerHandlers() {
    ipcMain.handle('fontManager:getAllFonts', async () => {
        return await getAllFonts();
    });

    ipcMain.handle('fontManager:uploadFont', async (_, params) => {
        return await uploadFont(params);
    });

    ipcMain.handle('fontManager:deleteFont', async (_, fontFamily) => {
        return await deleteFont(fontFamily);
    });

    ipcMain.handle('fontManager:findFontPath', async (_, fontFamily, fontWeight) => {
        return await findFontPath(fontFamily, fontWeight);
    });
}