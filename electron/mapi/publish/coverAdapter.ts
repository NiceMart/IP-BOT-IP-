import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { PlatformCoverRequirements, CoverAdaptResult } from './types';
import {Log} from '../log/main';

/**
 * 各平台封面要求
 */
const PLATFORM_REQUIREMENTS: Record<string, PlatformCoverRequirements> = {
    douyin: {
        width: 1080,
        height: 1920,
        ratio: '9:16',
        maxSize: 5000, // 5MB
        format: 'jpg'
    },
    kuaishou: {
        width: 1080,
        height: 1440,
        ratio: '3:4',
        maxSize: 3000,
        format: 'jpg'
    },
    shipin: {
        width: 1280,
        height: 720,
        ratio: '16:9',
        maxSize: 2000,
        format: 'jpg'
    },
    xiaohongshu: {
        width: 1080,
        height: 1440,
        ratio: '3:4',
        maxSize: 5000, // 5MB
        format: 'jpg'
    }
};

export class CoverAdapter {
    /**
     * 智能适配封面到平台要求
     */
    static async adaptCover(params: {
        coverPath: string;
        platform: string;
        outputDir: string;
    }): Promise<CoverAdaptResult> {
        const { coverPath, platform, outputDir } = params;
        const requirements = PLATFORM_REQUIREMENTS[platform];

        if (!requirements) {
            throw new Error(`不支持的平台: ${platform}`);
        }

        // 检查输入文件是否存在
        if (!fs.existsSync(coverPath)) {
            throw new Error(`封面文件不存在: ${coverPath}`);
        }

        const adjustments: string[] = [];

        try {
            // 1. 读取原始图片信息
            const image = sharp(coverPath);
            const metadata = await image.metadata();

            if (!metadata.width || !metadata.height) {
                throw new Error('无法读取图片尺寸信息');
            }

            const originalSize = {
                width: metadata.width,
                height: metadata.height
            };

            Log.info(`原始封面尺寸: ${originalSize.width}x${originalSize.height}`, { platform });

            // 2. 计算目标尺寸和裁剪策略
            const targetRatio = requirements.width / requirements.height;
            const currentRatio = originalSize.width / originalSize.height;

            let processedImage = sharp(coverPath);

            // 3. 处理宽高比不匹配的情况
            // 视频号和抖音都使用contain（保留完整内容），其他平台使用cover（裁剪）
            const usePadding = platform === 'shipin' || platform === 'douyin'; // 视频号和抖音使用填充而不是裁剪

            if (Math.abs(currentRatio - targetRatio) > 0.01) {
                adjustments.push(`调整宽高比从${currentRatio.toFixed(2)}到${targetRatio.toFixed(2)}`);

                if (!usePadding) {
                    // 其他平台：裁剪策略
                    if (currentRatio > targetRatio) {
                        // 原图更宽，需要裁剪左右
                        const newWidth = Math.round(originalSize.height * targetRatio);
                        const left = Math.round((originalSize.width - newWidth) / 2);

                        processedImage = processedImage.extract({
                            left: left,
                            top: 0,
                            width: newWidth,
                            height: originalSize.height
                        });

                        adjustments.push(`裁剪宽度: ${originalSize.width} -> ${newWidth} (居中裁剪)`);
                    } else {
                        // 原图更高，需要裁剪上下
                        const newHeight = Math.round(originalSize.width / targetRatio);
                        const top = Math.round((originalSize.height - newHeight) / 2);

                        processedImage = processedImage.extract({
                            left: 0,
                            top: top,
                            width: originalSize.width,
                            height: newHeight
                        });

                        adjustments.push(`裁剪高度: ${originalSize.height} -> ${newHeight} (居中裁剪)`);
                    }
                } else {
                    // 视频号和抖音：使用填充（添加黑边保留完整内容）
                    adjustments.push(`使用等比例缩放+黑边填充（保留完整图片）`);
                }
            }

            // 4. 调整到目标分辨率
            processedImage = processedImage.resize(requirements.width, requirements.height, {
                fit: usePadding ? 'contain' : 'cover', // 抖音和视频号使用contain保留完整内容，其他使用cover裁剪
                position: 'center',
                background: { r: 0, g: 0, b: 0, alpha: 1 } // 黑色背景
            });

            if (usePadding) {
                adjustments.push(`等比例缩放至: ${requirements.width}x${requirements.height} (添加黑边)`);
            } else {
                adjustments.push(`缩放至: ${requirements.width}x${requirements.height}`);
            }

            // 5. 转换格式并调整质量
            let pipeline: sharp.Sharp;
            if (requirements.format === 'jpg') {
                pipeline = processedImage.jpeg({ quality: 90 });
                adjustments.push('转换为JPEG格式（质量90%）');
            } else if (requirements.format === 'png') {
                pipeline = processedImage.png({ compressionLevel: 9 });
                adjustments.push('转换为PNG格式');
            } else {
                pipeline = processedImage.webp({ quality: 90 });
                adjustments.push('转换为WebP格式（质量90%）');
            }

            // 6. 创建输出目录（如果不存在）
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 7. 保存处理后的图片
            const timestamp = Date.now();
            const adaptedPath = path.join(outputDir, `cover_${platform}_${timestamp}.${requirements.format}`);
            await pipeline.toFile(adaptedPath);

            // 8. 检查文件大小，如果超过限制则降低质量
            let fileSize = fs.statSync(adaptedPath).size / 1024; // KB

            if (fileSize > requirements.maxSize) {
                adjustments.push(`文件过大(${fileSize.toFixed(0)}KB)，压缩至${requirements.maxSize}KB以内`);

                let quality = 80;
                while (fileSize > requirements.maxSize && quality > 50) {
                    quality -= 10;

                    await sharp(coverPath)
                        .resize(requirements.width, requirements.height, {
                            fit: usePadding ? 'contain' : 'cover',
                            position: 'center',
                            background: { r: 0, g: 0, b: 0, alpha: 1 }
                        })
                        .jpeg({ quality })
                        .toFile(adaptedPath);

                    fileSize = fs.statSync(adaptedPath).size / 1024;
                }

                adjustments.push(`最终质量: ${quality}%，文件大小: ${fileSize.toFixed(0)}KB`);
            }

            Log.info(`封面适配完成: ${adaptedPath}`, { platform, adjustments });

            return {
                success: true,
                adaptedPath,
                originalSize,
                adaptedSize: {
                    width: requirements.width,
                    height: requirements.height
                },
                adjustments
            };

        } catch (error) {
            Log.error(`封面适配失败`, { platform, error });
            throw error;
        }
    }

    /**
     * 获取平台预设要求
     */
    static getPlatformRequirements(platform: string): PlatformCoverRequirements | null {
        return PLATFORM_REQUIREMENTS[platform] || null;
    }
}
