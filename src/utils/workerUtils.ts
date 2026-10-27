// Web Worker 工具类
// @ts-nocheck
export class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Array<{
    id: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = [];
  private busyWorkers = new Set<Worker>();
  private workerIdCounter = 0;

  constructor(private workerScript: string, private poolSize = 2) {
    this.initWorkers();
  }

  private initWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(new URL(this.workerScript, import.meta.url), {
        type: 'module'
      });

      worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(worker, event.data);
      });

      worker.addEventListener('error', (error) => {
        this.handleWorkerError(worker, error);
      });

      this.workers.push(worker);
    }
  }

  private handleWorkerMessage(worker: Worker, result: any) {
    // 查找对应的任务
    const taskIndex = this.taskQueue.findIndex(t => t.id === result.id);
    if (taskIndex > -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      task.resolve(result.data);
    }

    // 标记 worker 为空闲
    this.busyWorkers.delete(worker);
    this.processQueue();
  }

  private handleWorkerError(worker: Worker, error: ErrorEvent) {
    // 查找对应的任务
    const taskIndex = this.taskQueue.findIndex(t => {
      // 简化处理，实际应该更精确
      return true;
    });

    if (taskIndex > -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      task.reject(error);
    }

    // 标记 worker 为空闲
    this.busyWorkers.delete(worker);
    this.processQueue();
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return;

    // 查找空闲的 worker
    const availableWorker = this.workers.find(w => !this.busyWorkers.has(w));
    if (!availableWorker) return;

    // 取出第一个任务
    const task = this.taskQueue.shift();
    if (!task) return;

    // 标记 worker 为忙碌
    this.busyWorkers.add(availableWorker);

    // 发送任务
    availableWorker.postMessage({
      id: task.id,
      ...task.data
    });
  }

  // 执行任务
  execute<T>(data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const task = {
        id: `task_${++this.workerIdCounter}_${Date.now()}`,
        data,
        resolve,
        reject
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  // 销毁所有 workers
  destroy() {
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers = [];
    this.busyWorkers.clear();
    this.taskQueue = [];
  }
}

// 文字布局计算 Worker Pool
export const textLayoutWorkerPool = new WorkerPool(
  '/src/workers/textLayout.worker.ts',
  2 // 2个 worker 线程
);

// 便捷方法
export async function calculateTextLayout(config: {
  text: string;
  fontSize: number;
  fontFamily: string;
  maxWidth: number;
  maxHeight: number;
  direction?: 'horizontal' | 'vertical';
  charSpacing?: number;
  lineSpacing?: number;
}) {
  return await textLayoutWorkerPool.execute(config);
}

// 通用 Worker 装饰器
export function useWorker<T extends any[], R>(
  workerPool: WorkerPool,
  timeout = 5000
) {
  return (...args: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Worker task timeout'));
      }, timeout);

      workerPool.execute(args[0])
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };
}

// Worker 任务缓存
export class WorkerTaskCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxAge = 60000; // 1分钟缓存

  private generateKey(data: any): string {
    return JSON.stringify(data);
  }

  get(data: any): any | null {
    const key = this.generateKey(data);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(data: any, result: any): void {
    const key = this.generateKey(data);
    this.cache.set(key, {
      data: result,
      timestamp: Date.now()
    });

    // 限制缓存大小
    if (this.cache.size > 100) {
      // 删除最旧的缓存
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// 带缓存的文字布局计算
export const textLayoutCache = new WorkerTaskCache();

export async function calculateTextLayoutCached(config: any) {
  // 尝试从缓存获取
  const cached = textLayoutCache.get(config);
  if (cached) {
    return cached;
  }

  // 计算结果
  const result = await calculateTextLayout(config);

  // 缓存结果
  textLayoutCache.set(config, result);

  return result;
}
