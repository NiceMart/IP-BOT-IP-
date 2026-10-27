import { useTaskStore, TaskChangeType } from '../../store/modules/task';
import { TaskService } from '../../service/TaskService';

export interface TaskStep {
    type: string;
    name: string;
    taskId: string;
    timeout?: number;
    onProgress?: (status: string) => void;
}

export class TaskChainExecutor {
    private taskStore = useTaskStore();

    /**
     * 执行任务链 - 顺序执行多个任务步骤
     */
    async executeChain(steps: TaskStep[]): Promise<void> {
        for (const step of steps) {
            console.log(`[TaskChainExecutor] 开始执行步骤: ${step.name}`);

            if (step.onProgress) {
                step.onProgress('开始执行...');
            }

            await this.waitForTaskEventDriven(
                step.type,
                step.taskId,
                step.timeout || 600000 // 默认10分钟超时
            );

            console.log(`[TaskChainExecutor] 步骤完成: ${step.name}`);

            if (step.onProgress) {
                step.onProgress('已完成');
            }
        }
    }

    /**
     * 事件驱动的任务等待 - 替代轮询机制
     * @param taskType 任务类型（如 SoundGenerate, VideoGen）
     * @param taskId 任务ID（bizId）
     * @param timeout 超时时间（毫秒）
     */
    waitForTaskEventDriven(
        taskType: string,
        taskId: string,
        timeout: number
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            let timeoutId: NodeJS.Timeout;
            let isResolved = false;

            const cleanup = () => {
                this.taskStore.offChange(taskType, listener);
                clearTimeout(timeoutId);
            };

            const safeResolve = () => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    resolve();
                }
            };

            const safeReject = (error: Error) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(error);
                }
            };

            const listener = (bizId: string, changeType: TaskChangeType) => {
                if (bizId === taskId) {
                    console.log(`[TaskChainExecutor] 任务事件: ${taskType}-${bizId}, 类型: ${changeType}`);

                    if (changeType === 'success') {
                        safeResolve();
                    } else if (changeType === 'fail') {
                        safeReject(new Error(`任务 ${taskType} 失败`));
                    }
                }
            };

            // 注册事件监听器
            this.taskStore.onChange(taskType, listener);

            // 🔧 关键修复：在注册监听器后立即检查任务当前状态
            // 防止竞态条件：任务可能在注册监听器前就已完成
            try {
                console.log(`[TaskChainExecutor] 🔍 检查任务当前状态: ${taskType}-${taskId}`);
                const task = await TaskService.get(taskId);

                if (task) {
                    console.log(`[TaskChainExecutor] 任务状态: ${task.status}`);

                    if (task.status === 'success') {
                        console.log(`[TaskChainExecutor] ✓ 任务已完成（状态检查）`);
                        safeResolve();
                        return;
                    } else if (task.status === 'fail') {
                        console.log(`[TaskChainExecutor] ✗ 任务已失败（状态检查）: ${task.statusMsg}`);
                        safeReject(new Error(`任务 ${taskType} 失败: ${task.statusMsg}`));
                        return;
                    }
                } else {
                    console.warn(`[TaskChainExecutor] ⚠️ 找不到任务记录: ${taskId}`);
                }
            } catch (error) {
                console.warn(`[TaskChainExecutor] ⚠️ 检查任务状态失败: ${error}`);
                // 继续等待事件，不中断流程
            }

            // 设置超时
            timeoutId = setTimeout(() => {
                safeReject(new Error(`任务 ${taskType} 超时（${timeout}ms）`));
            }, timeout);
        });
    }

    /**
     * 串行执行平台发布任务
     * @param platforms 平台列表（如 ['douyin', 'kuaishou']）
     * @param videoId 视频ID
     */
    async executePlatformPublishing(
        platforms: string[],
        videoId: string,
        onProgress?: (platform: string, status: string) => void
    ): Promise<void> {
        for (const platform of platforms) {
            console.log(`[TaskChainExecutor] 开始发布到: ${platform}`);

            if (onProgress) {
                onProgress(platform, '发布中...');
            }

            await this.waitForTaskEventDriven(
                `Publish${platform}`,
                videoId,
                300000 // 5分钟超时
            );

            console.log(`[TaskChainExecutor] 发布完成: ${platform}`);

            if (onProgress) {
                onProgress(platform, '已完成');
            }
        }
    }
}
