/**
 * 音效系统 - 前端 IPC 调用包装
 */


const soundEffect = {
  /**
   * 获取所有内置音效
   */
  async getBuiltinEffects() {
    try {
      return await ipcRenderer.invoke('soundEffect:getBuiltinEffects');
    } catch (error) {
      console.error('[soundEffect:getBuiltinEffects] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 🆕 获取所有音效（内置 + 用户自定义）
   */
  async getAllEffects() {
    try {
      return await ipcRenderer.invoke('soundEffect:getAllEffects');
    } catch (error) {
      console.error('[soundEffect:getAllEffects] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 获取所有用户自定义音效
   */
  async getUserEffects() {
    try {
      return await ipcRenderer.invoke('soundEffect:getUserEffects');
    } catch (error) {
      console.error('[soundEffect:getUserEffects] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 导入用户音效文件
   */
  async importUserEffect(filePath: string, name: string, description?: string) {
    try {
      return await ipcRenderer.invoke('soundEffect:importUserEffect', {
        filePath,
        name,
        description
      });
    } catch (error) {
      console.error('[soundEffect:importUserEffect] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 删除用户自定义音效
   */
  async deleteUserEffect(effectId: string) {
    try {
      return await ipcRenderer.invoke('soundEffect:deleteUserEffect', effectId);
    } catch (error) {
      console.error('[soundEffect:deleteUserEffect] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 生成音效文件
   */
  async generateEffect(effectId: string, params: any, outputPath: string) {
    try {
      return await ipcRenderer.invoke('soundEffect:generateEffect', {
        effectId,
        params,
        outputPath
      });
    } catch (error) {
      console.error('[soundEffect:generateEffect] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 预览音效
   * @param effectId 音效ID（内置或用户自定义，用户音效使用 user_ 前缀）
   * @param userEffectId 已弃用，保留用于兼容
   */
  async previewEffect(effectId?: string, userEffectId?: string) {
    try {
      // 统一使用 effectId，兼容旧的调用方式
      const id = effectId || userEffectId;
      return await ipcRenderer.invoke('soundEffect:previewEffect', {
        effectId: id
      });
    } catch (error) {
      console.error('[soundEffect:previewEffect] IPC 调用失败:', error);
      throw error;
    }
  },

  /**
   * 🆕 获取音效文件路径（用于视频生成时混音）
   */
  async getFilePath(effectId?: string, userEffectId?: string) {
    try {
      return await ipcRenderer.invoke('soundEffect:getFilePath', {
        effectId,
        userEffectId
      });
    } catch (error) {
      console.error('[soundEffect:getFilePath] IPC 调用失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  },

  /**
   * 🆕 批量获取音效文件路径（用于视频生成时的批量处理）
   */
  async getBatchFilePaths(soundInstances: any[]) {
    try {
      return await ipcRenderer.invoke('soundEffect:getBatchFilePaths', {
        soundInstances
      });
    } catch (error) {
      console.error('[soundEffect:getBatchFilePaths] IPC 调用失败:', error);
      return { success: false, message: `获取失败: ${error}` };
    }
  }
};

export default soundEffect;
