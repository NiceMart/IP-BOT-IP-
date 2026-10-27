/**
 * 音效数据库操作模块
 */

import type { DB } from './main';

/**
 * 音效记录（数据库）
 */
export interface SoundEffectRecord {
  id: string;
  name: string;
  description?: string;
  category: string;
  type: string;
  audio_source?: string;
  volume: number;
  duration?: number;
  metadata?: string;
  created_at: number;
  updated_at: number;
  is_system: number;
}

/**
 * 用户自定义音效记录（数据库）
 */
export interface UserSoundEffectRecord {
  id: string;
  name: string;
  description?: string;
  file_path: string;
  duration?: number;
  file_size?: number;
  created_at: number;
  updated_at: number;
}

/**
 * 音效数据库操作类
 */
export class SoundEffectDb {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  // ==================== 内置音效操作 ====================

  /**
   * 获取所有系统内置音效
   */
  async getBuiltinEffects(): Promise<SoundEffectRecord[]> {
    const results = await this.db.select(
      'SELECT * FROM sound_effects WHERE is_system = 1 ORDER BY created_at ASC'
    );
    return results || [];
  }

  /**
   * 清除所有系统内置音效（用于重新初始化）
   */
  async clearBuiltinEffects(): Promise<void> {
    await this.db.execute('DELETE FROM sound_effects WHERE is_system = 1');
    console.log('[SoundEffectDb] 已清除所有系统内置音效');
  }

  /**
   * 根据ID获取音效
   */
  async getSoundEffectById(id: string): Promise<SoundEffectRecord | null> {
    const result = await this.db.first(
      'SELECT * FROM sound_effects WHERE id = ?',
      [id]
    );
    return result || null;
  }

  /**
   * 保存系统音效
   */
  async saveBuiltinEffect(effect: SoundEffectRecord): Promise<void> {
    const existing = await this.getSoundEffectById(effect.id);

    if (existing) {
      // 更新
      await this.db.execute(
        `UPDATE sound_effects SET
          name = ?,
          description = ?,
          category = ?,
          type = ?,
          audio_source = ?,
          volume = ?,
          duration = ?,
          metadata = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          effect.name,
          effect.description || null,
          effect.category,
          effect.type,
          effect.audio_source || null,
          effect.volume,
          effect.duration || null,
          effect.metadata || null,
          Date.now(),
          effect.id
        ]
      );
    } else {
      // 插入
      await this.db.execute(
        `INSERT INTO sound_effects (
          id, name, description, category, type, audio_source,
          volume, duration, metadata, created_at, updated_at, is_system
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          effect.id,
          effect.name,
          effect.description || null,
          effect.category,
          effect.type,
          effect.audio_source || null,
          effect.volume,
          effect.duration || null,
          effect.metadata || null,
          Date.now(),
          Date.now(),
          1
        ]
      );
    }
  }

  // ==================== 用户自定义音效操作 ====================

  /**
   * 获取所有用户自定义音效
   */
  async getUserEffects(): Promise<UserSoundEffectRecord[]> {
    const results = await this.db.select(
      'SELECT * FROM user_sound_effects ORDER BY created_at DESC'
    );
    return results || [];
  }

  /**
   * 根据ID获取用户音效
   */
  async getUserEffectById(id: string): Promise<UserSoundEffectRecord | null> {
    const result = await this.db.first(
      'SELECT * FROM user_sound_effects WHERE id = ?',
      [id]
    );
    return result || null;
  }

  /**
   * 保存用户自定义音效
   */
  async saveUserEffect(effect: UserSoundEffectRecord): Promise<void> {
    const existing = await this.getUserEffectById(effect.id);

    if (existing) {
      // 更新
      await this.db.execute(
        `UPDATE user_sound_effects SET
          name = ?,
          description = ?,
          file_path = ?,
          duration = ?,
          file_size = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          effect.name,
          effect.description || null,
          effect.file_path,
          effect.duration || null,
          effect.file_size || null,
          Date.now(),
          effect.id
        ]
      );
    } else {
      // 插入
      await this.db.execute(
        `INSERT INTO user_sound_effects (
          id, name, description, file_path, duration, file_size,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          effect.id,
          effect.name,
          effect.description || null,
          effect.file_path,
          effect.duration || null,
          effect.file_size || null,
          Date.now(),
          Date.now()
        ]
      );
    }
  }

  /**
   * 删除用户自定义音效
   */
  async deleteUserEffect(id: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM user_sound_effects WHERE id = ?',
      [id]
    );
  }

  /**
   * 检查音效名称是否已存在
   */
  async isNameExists(name: string, excludeId?: string): Promise<boolean> {
    let sql = 'SELECT COUNT(*) as count FROM user_sound_effects WHERE name = ?';
    const params: any[] = [name];

    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }

    const result = await this.db.first(sql, params);
    return result && result.count > 0;
  }
}
