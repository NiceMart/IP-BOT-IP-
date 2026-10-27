/**
 * RunningHub 云端服务
 * 前端服务层，提供云端合成相关操作
 */

export class RunningHubService {
  /**
   * 上传文件到RunningHub
   * @param filePath 本地文件路径
   * @param fileType 文件类型 (video | audio)
   * @returns 返回文件在服务器上的fileName
   */
  static async uploadFile(filePath: string, fileType: 'video' | 'audio'): Promise<string> {
    const result = await window.$mapi.runninghub.uploadFile({
      filePath,
      fileType
    });

    if (!result.success) {
      throw new Error(result.error || `上传${fileType}文件失败`);
    }

    return result.fileName!;
  }

  /**
   * 创建云端合成任务
   * @param videoFileName 视频文件名
   * @param audioFileName 音频文件名
   * @returns 返回任务ID
   */
  static async createTask(videoFileName: string, audioFileName: string): Promise<string> {
    const result = await window.$mapi.runninghub.createTask({
      videoFileName,
      audioFileName
    });

    if (!result.success) {
      throw new Error(result.error || '创建任务失败');
    }

    return result.taskId!;
  }

  /**
   * 查询任务状态
   * @param taskId 任务ID
   * @returns 返回任务查询结果
   */
  static async queryTask(taskId: string): Promise<any> {
    const result = await window.$mapi.runninghub.queryTask({
      taskId
    });

    if (!result.success) {
      throw new Error(result.error || '查询任务失败');
    }

    return result.result;
  }

  /**
   * 轮询等待任务完成
   * @param taskId 任务ID
   * @param maxRetries 最大重试次数
   * @param interval 查询间隔（毫秒）
   * @returns 返回最终结果
   */
  static async waitForTaskComplete(
    taskId: string,
    maxRetries: number = 120,
    interval: number = 1000
  ): Promise<any> {
    const result = await window.$mapi.runninghub.waitForTaskComplete({
      taskId,
      maxRetries,
      interval
    });

    if (!result.success) {
      throw new Error(result.error || '等待任务完成失败');
    }

    return result.result;
  }
}
