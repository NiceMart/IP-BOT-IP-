import { ipcRenderer } from 'electron';

export default {
  /**
   * 上传文件到RunningHub
   */
  async uploadFile(params: { filePath: string; fileType: 'video' | 'audio'; mode?: string }) {
    return await ipcRenderer.invoke('runninghub:uploadFile', params);
  },

  /**
   * 创建云端任务
   */
  async createTask(params: { videoFileName: string; audioFileName: string; mode?: string; text?: string }) {
    return await ipcRenderer.invoke('runninghub:createTask', params);
  },

  /**
   * 查询任务状态
   */
  async queryTask(params: { taskId: string; mode?: string }) {
    return await ipcRenderer.invoke('runninghub:queryTask', params);
  },

  /**
   * 等待任务完成（带轮询）
   */
  async waitForTaskComplete(params: { taskId: string; maxRetries?: number; interval?: number; mode?: string }) {
    return await ipcRenderer.invoke('runninghub:waitForTaskComplete', params);
  },

  async cloudBeautySubmit(params: { videoPath: string; audioPath: string; humanWeight: string }) {
    return await ipcRenderer.invoke('cloudBeauty:submitTask', params);
  },

  async cloudBeautyQueryStatus(params: { taskId: string }) {
    return await ipcRenderer.invoke('cloudBeauty:queryStatus', params);
  }
};
