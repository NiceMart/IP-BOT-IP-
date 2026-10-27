/**
 * 任务事件系统
 * 用于在任务状态改变时通知前端，避免轮询
 */

import { EventEmitter } from 'events';
import { Events } from './main';

class TaskEventSystem extends EventEmitter {
  private static instance: TaskEventSystem;

  private constructor() {
    super();
    this.setMaxListeners(100); // 防止内存泄漏警告
  }

  static getInstance(): TaskEventSystem {
    if (!TaskEventSystem.instance) {
      TaskEventSystem.instance = new TaskEventSystem();
    }
    return TaskEventSystem.instance;
  }

  /**
   * 任务状态改变时触发
   * @param taskId 任务 ID
   * @param oldStatus 旧状态
   * @param newStatus 新状态
   * @param data 任务完整数据
   */
  emitTaskStatusChange(
    taskId: number | string,
    oldStatus: string | undefined,
    newStatus: string,
    data?: any
  ) {
    console.log(`[TaskEventSystem] 任务 ${taskId} 状态变化: ${oldStatus} → ${newStatus}`);

    // 1. 本地事件（供后端使用）
    this.emit('task:statusChange', {
      taskId,
      oldStatus,
      newStatus,
      timestamp: Date.now(),
      data
    });

    // 2. 广播到前端（供前端 UI 使用）
    Events.broadcast('TaskStatusChange', {
      taskId,
      oldStatus,
      newStatus,
      timestamp: Date.now(),
      ...data
    });

    console.log(`[TaskEventSystem] 已广播任务状态变化事件`);
  }

  /**
   * 任务进度改变时触发
   */
  emitTaskProgressChange(
    taskId: number | string,
    progress: number,
    message?: string
  ) {
    // 广播到前端
    Events.broadcast('TaskProgressChange', {
      taskId,
      progress,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * 任务完成时触发
   */
  emitTaskComplete(
    taskId: number | string,
    result?: any
  ) {
    Events.broadcast('TaskComplete', {
      taskId,
      result,
      timestamp: Date.now()
    });
  }

  /**
   * 任务失败时触发
   */
  emitTaskFailed(
    taskId: number | string,
    error: string
  ) {
    Events.broadcast('TaskFailed', {
      taskId,
      error,
      timestamp: Date.now()
    });
  }
}

export const taskEventSystem = TaskEventSystem.getInstance();

// IPC handlers 供前端调用
import { ipcMain } from 'electron';

ipcMain.handle('task:emitStatusChange', (event, taskId, oldStatus, newStatus, data) => {
  taskEventSystem.emitTaskStatusChange(taskId, oldStatus, newStatus, data);
});

ipcMain.handle('task:emitProgressChange', (event, taskId, progress, message) => {
  taskEventSystem.emitTaskProgressChange(taskId, progress, message);
});

ipcMain.handle('task:emitComplete', (event, taskId, result) => {
  taskEventSystem.emitTaskComplete(taskId, result);
});

ipcMain.handle('task:emitFailed', (event, taskId, error) => {
  taskEventSystem.emitTaskFailed(taskId, error);
});
