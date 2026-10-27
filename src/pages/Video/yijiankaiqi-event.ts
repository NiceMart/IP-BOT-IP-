/**
 * 一键智能 - 事件驱动版本
 * 使用事件监听替代轮询，大幅提升性能
 */

// ⚠️ 通过 window.ipcRenderer 访问 IPC
import { TaskService } from '../../service/TaskService';

const ipcRenderer = (window as any).ipcRenderer;

export interface WaitForTaskOptions {
  taskId: string | number;
  timeout?: number;
  fallbackPolling?: boolean; // 是否启用 fallback 轮询
  pollingInterval?: number; // fallback 轮询间隔
  onCancelCheck?: () => boolean;
}

/**
 * 等待任务完成（事件驱动 + fallback 轮询）
 * @returns Promise<任务结果>
 */
export function waitForTaskCompletion<T = any>(
  options: WaitForTaskOptions
): Promise<T> {
  const {
    taskId,
    timeout = 3600000, // 默认 60 分钟 (调整以防止长文案超时)
    fallbackPolling = true,
    pollingInterval = 5000, // fallback 轮询间隔增加到 5 秒
    onCancelCheck
  } = options;

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let timeoutHandle: any = null;
    let pollingHandle: any = null;
    let eventReceived = false;

    console.log(`[waitForTaskCompletion] 开始等待任务 ${taskId}，超时 ${timeout}ms`);

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (pollingHandle) clearInterval(pollingHandle);
      ipcRenderer.removeListener('MAIN_PROCESS_MESSAGE', handleEvent);
    };

    const safeResolve = (result: T) => {
      if (isResolved) return;
      isResolved = true;
      console.log(`[waitForTaskCompletion] 任务 ${taskId} 完成 ${eventReceived ? '(事件)' : '(轮询)'}`);
      cleanup();
      resolve(result);
    };

    const safeReject = (error: Error) => {
      if (isResolved) return;
      isResolved = true;
      console.log(`[waitForTaskCompletion] 任务 ${taskId} 失败:`, error.message);
      cleanup();
      reject(error);
    };

    // 检查取消
    const checkCancel = () => {
      if (onCancelCheck && onCancelCheck()) {
        safeReject(new Error('用户已取消任务'));
        return true;
      }
      return false;
    };

    // 事件处理函数
    const handleEvent = async (event: any, payload: any) => {
      if (isResolved) return;

      const { type, data } = payload;
      if (type !== 'BROADCAST') return;

      const broadcastType = data?.type;
      const broadcastData = data?.data;

      // 检查是否是当前任务的事件
      if (broadcastData?.taskId != taskId) return;

      eventReceived = true;
      console.log(`[waitForTaskCompletion] 收到任务 ${taskId} 事件:`, broadcastType);

      switch (broadcastType) {
        case 'TaskComplete':
        case 'TaskStatusChange':
          if (broadcastData.newStatus === 'success') {
            // ✅ 【关键修复】延迟查询，等待 successFunc 完成文件保存和 result 更新
            // 因为 runFunc 返回 success 后触发事件，但 successFunc 才更新 result
            console.log(`[waitForTaskCompletion] 收到成功事件，等待 successFunc 完成...`);

            const pollForResult = async (retries: number = 0) => {
              if (isResolved) return;
              try {
                const task = await TaskService.get(taskId);
                if (task && task.status === 'success' && task.result && Object.keys(task.result).length > 0) {
                  console.log(`[waitForTaskCompletion] 从数据库查询任务结果 (重试${retries}次):`, task.result);
                  safeResolve(task.result);
                } else if (retries < 10) {
                  console.warn(`[waitForTaskCompletion] result 无效，1秒后重试 (${retries + 1}/10)...`);
                  setTimeout(() => pollForResult(retries + 1), 1000);
                } else {
                  console.warn(`[waitForTaskCompletion] 重试耗尽，使用事件数据`);
                  safeResolve(broadcastData.result || broadcastData);
                }
              } catch (error) {
                console.warn(`[waitForTaskCompletion] 查询任务失败，使用事件数据:`, error);
                safeResolve(broadcastData.result || broadcastData);
              }
            };
            setTimeout(() => pollForResult(0), 500);
          } else if (
            broadcastData.newStatus === 'fail'
          ) {
            safeReject(new Error(broadcastData.statusMsg || '任务失败'));
          }
          break;

        case 'TaskFailed':
          safeReject(new Error(broadcastData.error || '任务失败'));
          break;
      }
    };

    // 注册事件监听
    ipcRenderer.on('MAIN_PROCESS_MESSAGE', handleEvent);

    // Fallback 轮询（防止事件丢失）
    if (fallbackPolling) {
      console.log(`[waitForTaskCompletion] 启动 fallback 轮询，间隔 ${pollingInterval}ms`);

      const poll = async () => {
        if (isResolved || checkCancel()) return;

        try {
          const task = await TaskService.get(taskId);
          if (!task) return;

          // 如果事件已触发，就不再处理轮询结果
          if (eventReceived) {
            console.log(`[waitForTaskCompletion] 事件已触发，忽略轮询结果`);
            return;
          }

          if (task.status === 'success') {
            safeResolve(task.result);
          } else if (
            task.status === 'fail'
          ) {
            safeReject(new Error(task.statusMsg || '任务失败'));
          }
        } catch (error) {
          console.warn(`[waitForTaskCompletion] 轮询查询失败:`, error);
        }
      };

      // 立即执行一次，然后定时执行
      poll();
      pollingHandle = setInterval(poll, pollingInterval);
    }

    // 超时处理
    timeoutHandle = setTimeout(() => {
      safeReject(new Error(`任务超时（${timeout / 1000}秒）`));
    }, timeout);
  });
}
