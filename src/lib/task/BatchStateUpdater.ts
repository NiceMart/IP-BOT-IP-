/**
 * 批量状态更新器
 *
 * 将多个状态更新批量处理成单次UI更新，使用requestIdleCallback在浏览器空闲时执行，
 * 避免频繁更新导致UI卡顿。
 *
 * 使用场景：
 * - 一键智能工作流中频繁的进度更新
 * - 批量任务状态同步
 * - 任何需要高频率更新UI的场景
 */
export class BatchStateUpdater {
    private pendingUpdates: Map<string, any> = new Map();
    private updateScheduled = false;
    private callback: (updates: Map<string, any>) => void;

    constructor(callback: (updates: Map<string, any>) => void) {
        this.callback = callback;
    }

    /**
     * 将更新加入队列
     * @param key 更新键（如 'step', 'progress'）
     * @param value 更新值
     */
    queueUpdate(key: string, value: any): void {
        this.pendingUpdates.set(key, value);

        if (!this.updateScheduled) {
            this.scheduleFlush();
        }
    }

    /**
     * 调度刷新 - 使用requestIdleCallback在浏览器空闲时执行
     */
    private scheduleFlush(): void {
        this.updateScheduled = true;

        // 优先使用requestIdleCallback（浏览器空闲时执行）
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                this.flushUpdates();
            });
        } else {
            // 降级方案：使用setTimeout模拟（约60fps）
            setTimeout(() => {
                this.flushUpdates();
            }, 16);
        }
    }

    /**
     * 刷新所有待处理的更新
     */
    private flushUpdates(): void {
        if (this.pendingUpdates.size > 0) {
            console.log(`[BatchStateUpdater] 批量刷新 ${this.pendingUpdates.size} 个更新`);

            // 创建副本传递给回调，避免外部修改影响内部状态
            this.callback(new Map(this.pendingUpdates));

            // 清空待处理更新
            this.pendingUpdates.clear();
        }

        this.updateScheduled = false;
    }

    /**
     * 强制立即刷新所有更新（不等待空闲时间）
     * 适用于关键更新需要立即反映到UI的场景
     */
    forceFlush(): void {
        if (this.updateScheduled) {
            this.flushUpdates();
        }
    }

    /**
     * 清空所有待处理的更新（不执行回调）
     */
    clear(): void {
        this.pendingUpdates.clear();
        this.updateScheduled = false;
    }

    /**
     * 获取当前待处理更新的数量
     */
    get pendingCount(): number {
        return this.pendingUpdates.size;
    }
}
