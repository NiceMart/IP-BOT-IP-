/**
 * 任务事件监听 Hook
 * 用于前端监听任务状态变化，替代轮询
 */

import { onMounted, onUnmounted, ref, Ref } from 'vue';

const ipcRenderer = (window as any).ipcRenderer;

export interface TaskEventListener {
  taskId: string | number;
  onStatusChange?: (status: string, oldStatus?: string) => void;
  onProgressChange?: (progress: number, message?: string) => void;
  onComplete?: (result: any) => void;
  onFailed?: (error: string) => void;
}

export function useTaskEventListener(listeners: TaskEventListener[]) {
  const isListening = ref(false);

  const handleBroadcast = (event: any, payload: any) => {
    const { type, data } = payload;

    // 不是广播消息
    if (type !== 'BROADCAST') return;

    const broadcastType = data?.type;
    const broadcastData = data?.data;

    // 查找匹配的监听器
    for (const listener of listeners) {
      if (broadcastData?.taskId !== listener.taskId) continue;

      switch (broadcastType) {
        case 'TaskStatusChange':
          console.log(`[useTaskEventListener] 任务 ${listener.taskId} 状态变化`, {
            oldStatus: broadcastData.oldStatus,
            newStatus: broadcastData.newStatus
          });
          listener.onStatusChange?.(broadcastData.newStatus, broadcastData.oldStatus);
          break;

        case 'TaskProgressChange':
          console.log(`[useTaskEventListener] 任务 ${listener.taskId} 进度更新`, {
            progress: broadcastData.progress
          });
          listener.onProgressChange?.(broadcastData.progress, broadcastData.message);
          break;

        case 'TaskComplete':
          console.log(`[useTaskEventListener] 任务 ${listener.taskId} 完成`);
          listener.onComplete?.(broadcastData.result);
          break;

        case 'TaskFailed':
          console.log(`[useTaskEventListener] 任务 ${listener.taskId} 失败`);
          listener.onFailed?.(broadcastData.error);
          break;
      }
    }
  };

  onMounted(() => {
    console.log(`[useTaskEventListener] 启动监听 ${listeners.length} 个任务事件`);
    isListening.value = true;
    ipcRenderer.on('MAIN_PROCESS_MESSAGE', handleBroadcast);
  });

  onUnmounted(() => {
    console.log(`[useTaskEventListener] 停止监听任务事件`);
    isListening.value = false;
    ipcRenderer.removeListener('MAIN_PROCESS_MESSAGE', handleBroadcast);
  });

  return {
    isListening
  };
}
