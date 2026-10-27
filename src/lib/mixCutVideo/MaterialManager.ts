/**
 * 素材管理器
 */

import type { Material } from './types';
import { ffprobeVideoInfo } from '../ffprobe';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];

export class MaterialManager {
  // 🆕 顺序选择的状态追踪：每个文件夹维护独立的索引
  private static sequentialIndexMap = new Map<string, number>();

  // 🆕 随机选择的历史记录：避免连续重复（每个文件夹独立）
  private static lastRandomSelectionMap = new Map<string, string>();

  /**
   * 扫描素材文件夹（支持视频和图片）
   */
  static async scanMaterialFolder(folderPath: string): Promise<Material[]> {
    if (!folderPath) throw new Error('素材文件夹路径为空');

    try {
      const fileList = await window.$mapi.file.list(folderPath);
      if (!fileList || fileList.length === 0) {
        console.warn('[scanMaterialFolder] 文件夹为空或无法读取:', folderPath);
        return [];
      }

      const materials: Material[] = [];
      let skippedCount = 0;

      for (const fileInfo of fileList) {
        if (fileInfo.isDirectory) continue;

        const isVideo = this.isVideoFile(fileInfo.pathname);
        const isImage = this.isImageFile(fileInfo.pathname);

        if (isVideo || isImage) {
          try {
            let duration: number;

            if (isVideo) {
              // 视频：使用 ffprobe 获取真实时长
              duration = await this.getVideoDuration(fileInfo.pathname);
            } else {
              // 图片：默认 5 秒时长（后续可以被用户配置覆盖）
              duration = 5.0;
              console.log(`[scanMaterialFolder] 图片素材默认时长 5s: ${fileInfo.name}`);
            }

            // 🔧 修复：只添加有效时长的素材
            if (duration > 0) {
              materials.push({
                path: fileInfo.pathname,
                name: fileInfo.name,
                duration,
                isImage  // 标记是否为图片
              });
            } else {
              console.warn(`[scanMaterialFolder] 跳过时长无效的素材: ${fileInfo.name} (时长=${duration})`);
              skippedCount++;
            }
          } catch (e) {
            console.warn(`[scanMaterialFolder] 跳过处理失败的素材: ${fileInfo.name}`, e);
            skippedCount++;
          }
        }
      }

      console.log(`[scanMaterialFolder] 扫描完成: 找到 ${materials.length} 个有效素材 (视频+图片), 跳过 ${skippedCount} 个`);
      return materials;
    } catch (error) {
      throw new Error(`扫描素材文件夹失败: ${(error as any).message}`);
    }
  }

  private static isVideoFile(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  private static isImageFile(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  /**
   * 获取视频时长 - 使用 ffprobe
   * 🔧 修复：使用更可靠的 ffprobeVideoInfo,而不是后端 API
   */
  static async getVideoDuration(videoPath: string): Promise<number> {
    try {
      // 使用 ffprobeVideoInfo 获取视频信息（包括时长）
      const videoInfo = await ffprobeVideoInfo(videoPath);

      if (videoInfo && videoInfo.duration && videoInfo.duration > 0) {
        console.log('[getVideoDuration] 成功获取视频时长:', videoInfo.duration, '秒, 文件:', videoPath);
        return videoInfo.duration;
      } else {
        console.warn('[getVideoDuration] 无法获取有效的视频时长:', videoPath);
        throw new Error('视频时长无效');
      }
    } catch (error) {
      console.error('[getVideoDuration] 获取视频时长失败:', videoPath, error);
      throw new Error(`获取视频时长失败: ${(error as any).message || error}`);
    }
  }

  /**
   * 🆕 从单个文件路径构建 Material 对象
   */
  static async createMaterialFromFile(filePath: string): Promise<Material> {
    if (!filePath) throw new Error('文件路径为空');

    const isVideo = this.isVideoFile(filePath);
    const isImage = this.isImageFile(filePath);

    if (!isVideo && !isImage) {
      throw new Error(`不支持的文件类型: ${filePath}`);
    }

    let duration: number;
    if (isVideo) {
      duration = await this.getVideoDuration(filePath);
    } else {
      duration = 5.0; // 图片默认 5 秒
    }

    if (duration <= 0) {
      throw new Error(`无效的素材时长: ${filePath}`);
    }

    const name = filePath.substring(filePath.lastIndexOf('/') + 1);

    return {
      path: filePath,
      name,
      duration,
      isImage
    };
  }

  /**
   * 🆕 统一素材选择方法 - 支持 random / sequential / specified 三种模式
   */
  static async selectMaterialUnified(
    selectionMode: 'random' | 'sequential' | 'specified',
    folderPath?: string,
    specifiedPath?: string
  ): Promise<Material> {
    if (selectionMode === 'specified') {
      // 指定素材模式
      if (!specifiedPath) {
        throw new Error('指定素材模式下必须提供 specifiedPath');
      }
      return await this.createMaterialFromFile(specifiedPath);
    } else {
      // 随机或顺序模式
      if (!folderPath) {
        throw new Error('随机/顺序模式下必须提供 folderPath');
      }
      return await this.selectMaterial(folderPath, selectionMode);
    }
  }

  /**
   * 选择素材 - 🔧 完全重写，支持真正的顺序和改进的随机选择
   */
  static async selectMaterial(folderPath: string, mode: 'random' | 'sequential'): Promise<Material> {
    const materials = await this.scanMaterialFolder(folderPath);
    if (materials.length === 0) throw new Error(`素材文件夹为空: ${folderPath}`);

    // 按名称排序（确保顺序模式的一致性）
    materials.sort((a, b) => a.name.localeCompare(b.name));

    if (mode === 'sequential') {
      // 🔧 顺序模式：使用循环索引
      let currentIndex = this.sequentialIndexMap.get(folderPath) || 0;

      // 确保索引在有效范围内（防止素材数量变化导致越界）
      if (currentIndex >= materials.length) {
        currentIndex = 0;
      }

      const selectedMaterial = materials[currentIndex];

      // 更新索引，循环到下一个
      const nextIndex = (currentIndex + 1) % materials.length;
      this.sequentialIndexMap.set(folderPath, nextIndex);

      console.log(`[MaterialManager] 顺序选择: 文件夹=${folderPath}, 当前索引=${currentIndex}/${materials.length}, 下次索引=${nextIndex}, 素材=${selectedMaterial.name}`);

      return selectedMaterial;
    } else {
      // 🔧 随机模式：避免连续重复（如果素材数量>1）
      let randomIndex: number;
      const lastSelection = this.lastRandomSelectionMap.get(folderPath);

      if (materials.length > 1) {
        // 有多个素材时，避免选到上次的素材
        do {
          randomIndex = Math.floor(Math.random() * materials.length);
        } while (materials[randomIndex].path === lastSelection);
      } else {
        // 只有一个素材时，直接使用
        randomIndex = 0;
      }

      const selectedMaterial = materials[randomIndex];
      this.lastRandomSelectionMap.set(folderPath, selectedMaterial.path);

      console.log(`[MaterialManager] 随机选择: 文件夹=${folderPath}, 索引=${randomIndex}/${materials.length}, 素材=${selectedMaterial.name}, 上次=${lastSelection ? '(已避免重复)' : '(首次)'}`);

      return selectedMaterial;
    }
  }

  /**
   * 🆕 重置顺序选择的索引（可选，供外部调用）
   */
  static resetSequentialIndex(folderPath?: string): void {
    if (folderPath) {
      this.sequentialIndexMap.delete(folderPath);
      console.log(`[MaterialManager] 已重置文件夹的顺序索引: ${folderPath}`);
    } else {
      this.sequentialIndexMap.clear();
      console.log('[MaterialManager] 已重置所有文件夹的顺序索引');
    }
  }
}
