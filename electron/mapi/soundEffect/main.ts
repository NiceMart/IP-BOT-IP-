/**
 * 音效系统 - 后端 IPC 处理器
 */

import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import StorageMain from '../storage/main';
import { SoundEffectDb } from '../db/soundEffectDb';
import { getAllBuiltinEffects, getBuiltinEffect, generateFFmpegCommand, getBuiltinEffectFilePath } from './builtinEffects';
import shellApi from '../shell/index';

let db: any = null;
let soundEffectDb: SoundEffectDb | null = null;

/**
 * 初始化数据库连接
 */
export function initSoundEffectDb(dbInstance: any) {
  db = dbInstance;
  soundEffectDb = new SoundEffectDb(db);
}

/**
 * 初始化系统内置音效
 */
export async function initBuiltinSoundEffects() {
  if (!soundEffectDb) {
    console.warn('[SoundEffect] 数据库未初始化，跳过内置音效初始化');
    return;
  }

  try {
    console.log('[SoundEffect] 开始初始化系统内置音效...');

    // 先清除旧的系统音效数据，确保同步最新的音效列表
    await soundEffectDb.clearBuiltinEffects();
    console.log('[SoundEffect] 已清除旧的系统音效数据');

    const effects = getAllBuiltinEffects();

    for (const effect of effects) {
      try {
        const record = {
          id: effect.id as string,
          name: effect.name,
          description: effect.description,
          category: effect.category,
          type: effect.id,
          audio_source: null,  // 使用预置音效文件，不需要合成配置
          volume: effect.defaultParams.volume || 0.7,
          duration: 0.5,  // 默认时长
          metadata: JSON.stringify(effect.defaultParams),
          created_at: Date.now(),
          updated_at: Date.now(),
          is_system: 1
        };

        await soundEffectDb.saveBuiltinEffect(record);
        console.log(`[SoundEffect] ✅ 初始化音效: ${effect.name}`);
      } catch (error) {
        console.warn(`[SoundEffect] ⚠️ 初始化音效失败: ${effect.name}`, error);
      }
    }

    console.log(`[SoundEffect] ✅ 系统内置音效初始化完成，共 ${effects.length} 个音效`);
  } catch (error) {
    console.error('[SoundEffect] ❌ 初始化音效系统失败:', error);
  }
}

// ==================== IPC 事件处理 ====================

/**
 * 获取所有内置音效
 */
ipcMain.handle('soundEffect:getBuiltinEffects', async (event) => {
  try {
    if (!soundEffectDb) {
      // 如果数据库未初始化，从库中获取
      return getAllBuiltinEffects();
    }

    const effects = await soundEffectDb.getBuiltinEffects();
    return effects.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category,
      defaultParams: e.metadata ? JSON.parse(e.metadata) : {}
    }));
  } catch (error) {
    console.error('[SoundEffect] 获取内置音效失败:', error);
    return getAllBuiltinEffects();
  }
});

/**
 * 🆕 获取所有音效（内置 + 用户自定义）
 * 用户音效会合并到列表中，并标记为自定义
 */
ipcMain.handle('soundEffect:getAllEffects', async (event) => {
  try {
    // 1. 获取内置音效
    let builtinEffects: any[] = [];
    if (soundEffectDb) {
      const effects = await soundEffectDb.getBuiltinEffects();
      builtinEffects = effects.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        category: e.category,
        isCustom: false,
        defaultParams: e.metadata ? JSON.parse(e.metadata) : {}
      }));
    } else {
      builtinEffects = getAllBuiltinEffects().map(e => ({
        ...e,
        isCustom: false
      }));
    }

    // 2. 获取用户自定义音效
    let userEffects: any[] = [];
    if (soundEffectDb) {
      const effects = await soundEffectDb.getUserEffects();
      userEffects = effects.map((e) => ({
        id: e.id,  // 已经是 user_xxx 格式
        name: `🎵 ${e.name}`,  // 添加标识
        description: e.description || '自定义音效',
        category: 'custom',
        isCustom: true,
        filePath: e.file_path,
        fileSize: e.file_size
      }));
    }

    // 3. 合并列表：内置在前，用户在后
    const allEffects = [...builtinEffects, ...userEffects];

    console.log(`[SoundEffect] 获取所有音效: ${builtinEffects.length} 个内置 + ${userEffects.length} 个自定义`);

    return allEffects;
  } catch (error) {
    console.error('[SoundEffect] 获取所有音效失败:', error);
    return getAllBuiltinEffects().map(e => ({ ...e, isCustom: false }));
  }
});

/**
 * 获取所有用户自定义音效
 */
ipcMain.handle('soundEffect:getUserEffects', async (event) => {
  try {
    if (!soundEffectDb) {
      return [];
    }

    const effects = await soundEffectDb.getUserEffects();
    return effects.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      filePath: e.file_path,
      duration: e.duration,
      fileSize: e.file_size,
      createdAt: e.created_at,
      category: 'custom'
    }));
  } catch (error) {
    console.error('[SoundEffect] 获取用户音效失败:', error);
    return [];
  }
});

/**
 * 导入用户音效文件
 */
ipcMain.handle(
  'soundEffect:importUserEffect',
  async (event, { filePath, name, description }) => {
    console.log(`[SoundEffect] 📥 开始导入用户音效:`, { filePath, name, description });

    try {
      if (!soundEffectDb) {
        console.error('[SoundEffect] ❌ 数据库未初始化');
        return { success: false, message: '数据库未初始化' };
      }

      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error(`[SoundEffect] ❌ 音效文件不存在: ${filePath}`);
        return { success: false, message: '音效文件不存在' };
      }

      // 检查名称是否已存在
      const nameExists = await soundEffectDb.isNameExists(name);
      if (nameExists) {
        console.warn(`[SoundEffect] ⚠️ 音效名称已存在: ${name}`);
        return { success: false, message: '音效名称已存在' };
      }

      // 创建用户音效目录
      const userSoundsDir = StorageMain.getUserSoundsDir();
      console.log(`[SoundEffect] 📁 用户音效目录: ${userSoundsDir}`);

      if (!fs.existsSync(userSoundsDir)) {
        fs.mkdirSync(userSoundsDir, { recursive: true });
        console.log(`[SoundEffect] ✅ 创建用户音效目录成功`);
      }

      // 复制文件到用户目录
      // 使用 user_ 前缀区分用户音效和内置音效
      const effectId = `user_${uuidv4()}`;
      const fileExtension = path.extname(filePath);
      const destPath = path.join(userSoundsDir, `${effectId}${fileExtension}`);

      console.log(`[SoundEffect] 📋 复制文件: ${filePath} -> ${destPath}`);
      fs.copyFileSync(filePath, destPath);
      console.log(`[SoundEffect] ✅ 文件复制成功`);

      // 保存到数据库
      const record = {
        id: effectId,
        name,
        description: description || null,
        file_path: destPath,
        duration: null,
        file_size: fs.statSync(destPath).size,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      console.log(`[SoundEffect] 💾 保存到数据库:`, record);
      await soundEffectDb.saveUserEffect(record);

      console.log(`[SoundEffect] ✅ 导入用户音效成功: ${name} (ID: ${effectId})`);
      return {
        success: true,
        id: effectId,
        message: '音效导入成功'
      };
    } catch (error) {
      console.error('[SoundEffect] ❌ 导入用户音效失败:', error);
      return { success: false, message: `导入失败: ${error}` };
    }
  }
);

/**
 * 删除用户自定义音效
 */
ipcMain.handle('soundEffect:deleteUserEffect', async (event, effectId) => {
  try {
    if (!soundEffectDb) {
      return { success: false, message: '数据库未初始化' };
    }

    const effect = await soundEffectDb.getUserEffectById(effectId);
    if (!effect) {
      return { success: false, message: '音效不存在' };
    }

    // 删除文件
    if (fs.existsSync(effect.file_path)) {
      try {
        fs.unlinkSync(effect.file_path);
      } catch (error) {
        console.warn('[SoundEffect] 删除音效文件失败:', error);
      }
    }

    // 删除数据库记录
    await soundEffectDb.deleteUserEffect(effectId);

    console.log(`[SoundEffect] ✅ 删除用户音效: ${effectId}`);
    return { success: true, message: '音效已删除' };
  } catch (error) {
    console.error('[SoundEffect] 删除用户音效失败:', error);
    return { success: false, message: `删除失败: ${error}` };
  }
});

/**
 * 生成音效文件（使用 FFmpeg 合成）
 */
ipcMain.handle(
  'soundEffect:generateEffect',
  async (event, { effectId, params, outputPath }) => {
    try {
      // 检查是否是内置音效
      const effect = getBuiltinEffect(effectId);
      if (!effect) {
        return {
          success: false,
          error: `未找到音效: ${effectId}`
        };
      }

      // 生成 FFmpeg 命令
      const command = generateFFmpegCommand(
        effectId,
        params,
        outputPath
      );

      console.log(`[SoundEffect] 生成音效命令:`, command);

      // 这里需要调用 FFmpeg 执行命令
      // 暂时返回命令，实际执行由调用方负责
      return {
        success: true,
        ffmpegCommand: command,
        audioFile: outputPath
      };
    } catch (error) {
      console.error('[SoundEffect] 生成音效失败:', error);
      return {
        success: false,
        error: `生成失败: ${error}`
      };
    }
  }
);

/**
 * 预览音效
 * 统一处理：根据 ID 前缀自动判断是用户音效 (user_*) 还是内置音效
 */
ipcMain.handle(
  'soundEffect:previewEffect',
  async (event, { effectId, userEffectId }) => {
    try {
      // 统一使用 effectId，兼容旧的 userEffectId 参数
      const id = effectId || userEffectId;

      if (!id) {
        return { success: false, message: '需要提供 effectId' };
      }

      console.log(`[SoundEffect] 🎵 预览音效: ${id}`);

      // 根据 ID 前缀判断类型
      if (id.startsWith('user_')) {
        // 用户自定义音效
        if (!soundEffectDb) {
          return { success: false, message: '数据库未初始化' };
        }

        const effect = await soundEffectDb.getUserEffectById(id);
        if (!effect) {
          console.error(`[SoundEffect] ❌ 用户音效不存在: ${id}`);
          return { success: false, message: '音效不存在' };
        }

        if (!effect.file_path || !fs.existsSync(effect.file_path)) {
          console.error(`[SoundEffect] ❌ 音效文件不存在: ${effect.file_path}`);
          return { success: false, message: '音效文件不存在' };
        }

        console.log(`[SoundEffect] ✅ 预览用户音效: ${effect.file_path}`);
        return { success: true, audioPath: effect.file_path };
      } else {
        // 内置音效 - 优先使用预置音效文件
        const effectFilePath = getBuiltinEffectFilePath(id);
        if (effectFilePath) {
          console.log(`[SoundEffect] ✅ 预览内置音效: ${effectFilePath}`);
          return { success: true, audioPath: effectFilePath };
        }

        // 降级到 FFmpeg 合成（当预置文件不存在时）
        console.log('[SoundEffect] 预置音效不存在，降级到 FFmpeg 合成');
        const tempDir = os.tmpdir();
        const tempPath = path.join(
          tempDir,
          `preview_${Date.now()}.wav`
        );

        const command = generateFFmpegCommand(
          id,
          {},
          tempPath
        );

        console.log('[SoundEffect] 预览音效命令:', command);

        try {
          // 解析命令字符串为参数数组
          const args = command
            .replace(/^ffmpeg\s+/, '') // 移除 'ffmpeg' 前缀
            .match(/(?:[^\s"]+|"[^"]*")+/g) // 分割参数，保留引号内的空格
            .map(arg => arg.replace(/^"|"$/g, '')); // 移除参数两端的引号

          console.log('[SoundEffect] FFmpeg 参数:', args);

          // 执行 FFmpeg 命令
          await shellApi.execFFmpegCommand(args);

          console.log('[SoundEffect] 音效文件生成成功:', tempPath);

          // 返回生成的音频文件路径
          return {
            success: true,
            audioPath: tempPath
          };
        } catch (error) {
          console.error('[SoundEffect] FFmpeg 执行失败:', error);
          return {
            success: false,
            message: `音效生成失败: ${error}`
          };
        }
      }
    } catch (error) {
      console.error('[SoundEffect] 预览音效失败:', error);
      return { success: false, message: `预览失败: ${error}` };
    }
  }
);

/**
 * 🆕 获取音效文件路径（用于视频生成时的音效混音）
 * 统一处理：根据 ID 前缀自动判断是用户音效 (user_*) 还是内置音效
 */
ipcMain.handle(
  'soundEffect:getFilePath',
  async (event, { effectId, userEffectId }) => {
    try {
      // 统一使用 effectId，兼容旧的 userEffectId 参数
      const id = effectId || userEffectId;

      if (!id) {
        return { success: false, message: '需要提供 effectId' };
      }

      // 根据 ID 前缀判断类型
      if (id.startsWith('user_')) {
        // 用户自定义音效
        if (!soundEffectDb) {
          return { success: false, message: '数据库未初始化' };
        }

        const effect = await soundEffectDb.getUserEffectById(id);
        if (effect && effect.file_path && fs.existsSync(effect.file_path)) {
          console.log(`[SoundEffect] ✅ 获取用户音效路径: ${id} -> ${effect.file_path}`);
          return {
            success: true,
            filePath: effect.file_path
          };
        }
        return { success: false, message: `用户音效文件不存在: ${id}` };
      } else {
        // 内置音效
        const filePath = getBuiltinEffectFilePath(id);
        if (filePath) {
          console.log(`[SoundEffect] ✅ 获取内置音效路径: ${id} -> ${filePath}`);
          return {
            success: true,
            filePath: filePath
          };
        }
        return { success: false, message: `内置音效文件不存在: ${id}` };
      }
    } catch (error) {
      console.error('[SoundEffect] 获取音效文件路径失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  }
);

/**
 * 🆕 批量获取音效文件路径（用于视频生成时的批量处理）
 */
ipcMain.handle(
  'soundEffect:getBatchFilePaths',
  async (event, { soundInstances }) => {
    try {
      const results: { effectId: string; filePath: string | null; triggerTime: number }[] = [];

      for (const instance of soundInstances) {
        const effectId = instance.effectId;
        const filePath = getBuiltinEffectFilePath(effectId);

        results.push({
          effectId,
          filePath: filePath || null,
          triggerTime: instance.triggerTime
        });

        if (filePath) {
          console.log(`[SoundEffect] 获取音效路径: ${effectId} -> ${filePath}`);
        } else {
          console.warn(`[SoundEffect] 音效文件不存在: ${effectId}`);
        }
      }

      return {
        success: true,
        results
      };
    } catch (error) {
      console.error('[SoundEffect] 批量获取音效路径失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  }
);
