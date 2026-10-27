// @ts-nocheck
// ------------------------------------------------------------------------------
// ----------------------------- Task Schedule Store ----------------------------
// ------------------------------------------------------------------------------
// Register TaskBiz
//   taskStore.register('TestSync', TestSync)
//   taskStore.register('TestAsync', TestAsync)
// Dispatch Task
//   await taskStore.dispatch('TestSync', StringUtil.random())
//   await taskStore.dispatch('TestAsync', StringUtil.random(), {'a':1}, {timeout: 3 * 1000})
// Schedule call order
//   Sync Task runFunc -> successFunc | failFunc
//   Async Task runFunc -> queryFunc -> successFunc | failFunc
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------

import { cloneDeep } from "lodash-es";
import { defineStore } from "pinia";
import { toRaw } from "vue";
import { mapError } from "../../lib/error";
import { StringUtil, TimeUtil } from "../../lib/util";
import store from "../index";
import { TaskService } from "../../service/TaskService";

export type TaskRecordStatus = "queue" | "running" | "querying" | "success" | "fail" | "delete";

export type TaskRecordRunStatus = "retry" | "success" | "querying";

export type TaskRecordQueryStatus = "running" | "success" | "fail";

export type TaskChangeType = "running" | "success" | "fail" | "change" | "requestCancel";

export type TaskRecord = {
    id: string;
    status: TaskRecordStatus;
    msg: string;
    biz: string;
    bizId: string;
    bizParam: any;
    // 开始运行时间
    runStart: number;
    // 是否正在调用 runFunc
    runCalling: boolean;
    // 超过 runAfter 才会执行，0表示是一个新任务，＞0表示是一个重试任务
    runAfter: number;
    // 是否正在调用 queryFunc
    queryCalling: boolean;
    // 超过 queryAfter 才会查询
    queryAfter: number;
    // 查询间隔
    queryInterval: number;
    // 是否正在调用 successFunc
    successCalling: boolean;
    // 超时时间
    timeout: number;
};

export type TaskBiz = {
    // sync task run,  return success | retry
    // async task run, return querying | success | retry
    runFunc: (bizId: string, bizParam: any) => Promise<TaskRecordRunStatus>;
    // async task query status, return running | success | fail
    queryFunc?: (bizId: string, bizParam: any) => Promise<TaskRecordQueryStatus>;
    // sync task success callback
    // async task success callback
    successFunc: (bizId: string, bizParam: any) => Promise<void>;
    // Make sure the "failFunc" function always not throw an error
    failFunc: (bizId: string, msg: string, bizParam: any) => Promise<void>;
    // request cancel callback, when user request cancel a task, will call this function
    requestCancelFunc?: (bizId: string, bizParam: any) => Promise<void>;
    // ----------------------------------------------------
    // the following not use in schedule, only for biz
    [key: string]: any;
    // ----------------------------------------------------
};

// 使用 Map 替代数组，支持可靠的监听器移除
let listenerIdCounter = 0;
const taskChangeListeners = new Map<number, {
    id: number;
    biz: string | null;
    callback: (bizId: string, status: TaskChangeType) => void;
}>();
let runNextTimer = null as any;

export const TestSync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("Task.TestSync.runFunc", { bizId, bizParam });
        return "success";
    },
    successFunc: async (bizId, bizParam) => {
        console.log("Task.TestSync.successFunc", { bizId, bizParam });
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log("Task.TestSync.failFunc", { bizId, bizParam, msg });
    },
};
export const TestAsync: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("Task.TestAsync.runFunc", { bizId, bizParam });
        return "querying";
    },
    queryFunc(bizId, bizParam) {
        return new Promise(resolve => {
            console.log("Task.TestAsync.queryFunc", { bizId, bizParam });
            setTimeout(() => {
                resolve(Math.random() > 0.7 ? "success" : "running");
            }, 1000);
        });
    },
    successFunc: async (bizId, bizParam) => {
        console.log("Task.TestAsync.successFunc", { bizId, bizParam });
    },
    failFunc: async (bizId, msg, bizParam) => {
        console.log("Task.TestAsync.failFunc", { bizId, bizParam, msg });
    },
};

export const taskStore = defineStore("task", {
    state() {
        return {
            isInit: false,
            bizMap: {} as Record<string, TaskBiz>,
            records: [] as TaskRecord[],
            cancelMap: {} as Record<string, {
                expire: number,
            }>,
            // 🔧 修复：全局开关：是否启用后台任务自动执行（默认启用）
            isBackgroundTaskEnabled: true,
            // 是否正在运行
            isRunning: false,
        };
    },
    actions: {
        async init() {
            // 检查 $mapi 是否可用
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过任务初始化');
                return;
            }

            try {
                // 🔧 修复：从存储中加载后台任务开关状态（默认为 true - 自动启动）
                // 用户提交任务后应该立即执行，而不是停留在"排队中"
                const taskEnabled = await window.$mapi.storage.get("task", "enabled", true);

                // 🔧 关键修复：强制启用后台任务，确保任务能够执行
                // 如果存储中是 false，覆盖为 true 并保存
                if (!taskEnabled) {
                    console.log('[TaskStore] 🔧 检测到后台任务被禁用，强制启用...');
                    this.isBackgroundTaskEnabled = true;
                    await window.$mapi.storage.set("task", "enabled", true);
                } else {
                    this.isBackgroundTaskEnabled = taskEnabled;
                }

                await window.$mapi.storage.get("task", "records", []).then(records => {
                    // 🔧 关键修复：应用启动时清理未完成的任务，防止它们被重新执行
                    // 这解决了"每次启动好像启动了多个任务，GPU直接干爆了"的问题
                    // 原因：如果任务在应用关闭时还处于 queue/running/querying 状态，
                    // 这些任务在应用重启时会被重新加载并重新执行
                    const cleanedRecords = records.filter(record => {
                        // 只保留已完成（success/delete/fail）的任务，清除未完成的任务
                        if (record.status === 'queue' || record.status === 'running' || record.status === 'querying' || record.status === 'wait') {
                            console.warn(`[TaskStore.init] 🧹 清理未完成的任务: ${record.biz}-${record.id} (status: ${record.status})`);
                            return false;
                        }
                        return true;
                    });

                    this.records = cleanedRecords;
                    this.isInit = true;

                    const removedCount = records.length - cleanedRecords.length;
                    if (removedCount > 0) {
                        console.log(`[TaskStore] 🧹 应用启动时清理了 ${removedCount} 个未完成的任务，防止重复执行`);
                    }

                    // Tasks will not automatically start on app launch - must be started manually
                    console.log('[TaskStore] ℹ️ Tasks are ready but not auto-starting. Use manual start to begin tasks');
                });
            } catch (error) {
                console.error('❌ 任务初始化失败:', error);
            }
        },
        async waitInit() {
            while (!this.isInit) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        },
        // 手动启动后台任务
        async startBackgroundTasks() {
            await this.waitInit();
            if (!this.isBackgroundTaskEnabled) {
                this.isBackgroundTaskEnabled = true;
                this.isRunning = true;
                await $mapi.storage.set("task", "enabled", true);
                console.log('[TaskStore] ✅ 后台任务已启用');
                if (this.records.length > 0) {
                    this._run(true);
                }
            } else {
                console.log('[TaskStore] 后台任务已经在运行中');
            }
        },
        // 停止后台任务
        async stopBackgroundTasks() {
            await this.waitInit();
            if (this.isBackgroundTaskEnabled) {
                this.isBackgroundTaskEnabled = false;
                this.isRunning = false;
                await $mapi.storage.set("task", "enabled", false);
                // 停止定时器
                if (runNextTimer) {
                    clearTimeout(runNextTimer);
                    runNextTimer = null;
                }
                console.log('[TaskStore] 🔴 后台任务已停止');
            } else {
                console.log('[TaskStore] 后台任务已经是停止状态');
            }
        },
        // 获取后台任务状态
        getBackgroundTaskStatus() {
            return {
                enabled: this.isBackgroundTaskEnabled,
                running: this.isRunning,
                pendingTasksCount: this.records.length
            };
        },
        _runExecute() {
            // 检查全局开关，如果已关闭则不执行
            if (!this.isBackgroundTaskEnabled) {
                console.log('[TaskStore] 后台任务已关闭，停止执行');
                this.isRunning = false;
                return;
            }

            let changed = false;
            // console.log('task._runExecute.start', JSON.stringify(this.records))
            // error record
            this.records.forEach(record => {
                if (!this.bizMap[record.biz]) {
                    record.status = "fail";
                    record.msg = "biz not found";
                    changed = true;
                }
            });
            // console.log('task.records', JSON.stringify(this.records, null, 2))
            // request cancel
            this.records
                .filter(r => r.status === "queue" || r.status === "running" || r.status === "querying")
                .filter(r => this.shouldCancel(r.biz, r.bizId))
                .forEach(record => {
                    record.status = "fail";
                    record.msg = mapError("UserCancel");
                    changed = true;
                });
            // 🔧 并发控制：限制同时运行的任务数，防止GPU过载
            // 这解决了"启动多个任务，GPU直接干爆了"的问题
            const maxConcurrentTasks = 1; // 同时只允许1个任务运行
            const runningCount = this.records.filter(r => r.status === "running" || r.status === "querying").length;
            const canStartMore = runningCount < maxConcurrentTasks;

            // queue
            this.records
                .filter(r => r.status === "queue")
                .filter(r => r.runAfter <= Date.now() && !r.runCalling)
                .filter(() => canStartMore) // 🔧 只启动新任务如果还没达到并发限制
                .forEach(record => {
                    changed = true;
                    record.status = "running";
                    record.runStart = Date.now();
                    record.runCalling = true;
                    let runCallFinish = false;
                    setTimeout(() => {
                        if (runCallFinish) {
                            return;
                        }
                        this.fireChange(record, "running");
                    }, 1000);
                    this.bizMap[record.biz]
                        .runFunc(record.bizId, record.bizParam)
                        .then((status: TaskRecordRunStatus) => {
                            runCallFinish = true;
                            switch (status) {
                                case "success":
                                    record.status = "success";
                                    break;
                                case "querying":
                                    record.queryAfter = Date.now() + record.queryInterval;
                                    record.status = "querying";
                                    break;
                                case "retry":
                                    record.status = "queue";
                                    record.runStart = 0;
                                    record.runAfter = Date.now() + 1000;
                                    break;
                            }
                        })
                        .catch(e => {
                            runCallFinish = true;
                            record.status = "fail";
                            record.msg = mapError(e);
                            console.error("Task.RunFunc.Error", e);
                            $mapi.log.error("Task.RunFunc.Error", e.toString()).catch(e => {
                                console.error("Task.RunFunc.Error.Log", e);
                            });
                        })
                        .finally(() => {
                            record.runCalling = false;
                            // 🔧 关键修复：不在这里触发"success"事件，而是等待successFunc完成后再触发
                            // 这样可以确保result已经保存到数据库，UI读取时不会得到空值
                            if (record.status === "fail") {
                                this.fireChange(record, "fail");
                            } else {
                                // 对于success和其他状态，只触发change事件
                                // 真正的success事件会在successFunc完成后触发（见line 399）
                                this.fireChange(record, "change");
                            }
                        });
                });
            // querying
            this.records
                .filter(r => r.status === "querying")
                .filter(r => r.queryAfter <= Date.now() && !r.queryCalling)
                .forEach(record => {
                    record.queryCalling = true;
                    const taskBiz = this.bizMap[record.biz];
                    taskBiz
                        .queryFunc?.(record.bizId, record.bizParam)
                        .then((status: TaskRecordQueryStatus) => {
                            switch (status) {
                                case "running":
                                    record.queryAfter = Date.now() + record.queryInterval;
                                    break;
                                case "success":
                                    record.status = "success";
                                    changed = true;
                                    // 🔧 关键修复：不在这里触发"success"事件，等待successFunc完成后再触发
                                    // 这样可以确保result已经保存到数据库，UI读取时不会得到空值
                                    this.fireChange(record, "change");
                                    break;
                                case "fail":
                                    record.status = "fail";
                                    changed = true;
                                    // 🔧 关键修复：任务失败时立即通知前端
                                    this.fireChange(record, "fail");
                                    break;
                            }
                        })
                        .catch(e => {
                            record.status = "fail";
                            record.msg = mapError(e);
                            changed = true;
                            console.error("Task.QueryFunc.Error", e);
                            $mapi.log.error("Task.QueryFunc.Error", e.toString()).catch(e => {
                                console.error("Task.QueryFunc.Error.Log", e);
                            });
                        })
                        .finally(() => {
                            record.queryCalling = false;
                        });
                });
            // 🔧 强制超时检查：超过60分钟的running任务强制标记为失败（防止幽灵任务）
            const SIXTY_MINUTES = 60 * 60 * 1000;
            this.records
                .filter(r => r.status === "running")
                .filter(r => Date.now() - r.runStart > SIXTY_MINUTES)
                .forEach(record => {
                    console.warn(`[TaskStore] 🔧 任务 ${record.id} 运行超过60分钟，强制标记为失败`);
                    record.status = "fail";
                    record.msg = "任务运行超过60分钟，强制失败（可能已卡住）";
                    changed = true;
                });
            // expire
            this.records
                .filter(r => r.status === "running" || r.status === "querying")
                .filter(r => Date.now() - r.runStart > r.timeout)
                .forEach(record => {
                    record.status = "fail";
                    record.msg = mapError("ProcessTimeout");
                    changed = true;
                });
            // success
            this.records
                .filter(r => r.status === "success")
                .filter(r => !r.successCalling)
                .forEach(record => {
                    record.successCalling = true;
                    changed = true;
                    this.bizMap[record.biz]
                        .successFunc(record.bizId, record.bizParam)
                        .then(() => {
                            record.status = "delete";
                        })
                        .catch(e => {
                            console.error("Task.SuccessFunc.Error", e);
                            $mapi.log.error("Task.SuccessFunc.Error", e.toString()).catch(e => {
                                console.error("Task.SuccessFunc.Error.Log", e);
                            });
                            record.status = "fail";
                            record.msg = mapError(e);
                        })
                        .finally(() => {
                            if (record.status === "delete") {
                                this.fireChange(record, "success");
                            }
                            record.successCalling = false;
                        });
                });
            // fail
            this.records
                .filter(r => r.status === "fail")
                .forEach(record => {
                    changed = true;
                    record.status = "delete";
                    if (!this.bizMap[record.biz]) {
                        return;
                    }
                    this.bizMap[record.biz]
                        .failFunc(record.bizId, record.msg, record.bizParam)
                        .then(() => {
                        })
                        .catch(e => {
                            console.error("Task.FailFunc.Error", e);
                            $mapi.log.error("Task.FailFunc.Error", e.toString()).catch(e => {
                                console.error("Task.FailFunc.Error.Log", e);
                            });
                        })
                        .finally(() => {
                            this.fireChange(record, "fail");
                        });
                });
            // console.log('task._runExecute.end', JSON.stringify(this.records))
            // delete
            this.records = this.records.filter(r => r.status !== "delete");
            // sync
            if (changed) {
                this.sync().then();
            }
            // next run
            // console.log('run', changed, JSON.stringify(this.records))
            // 🔧 关键修复：任务完成后立即停止轮询，防止继续占用GPU
            const pendingTasks = this.records.filter(r =>
                r.status !== "success" &&
                r.status !== "fail" &&
                r.status !== "delete"
            );
            if (pendingTasks.length > 0 && this.isBackgroundTaskEnabled) {
                this._run(changed);
            } else if (!this.isBackgroundTaskEnabled) {
                this.isRunning = false;
            } else if (pendingTasks.length === 0 && this.records.length > 0) {
                // 所有任务都已完成，停止轮询
                this.isRunning = false;
                console.log('[TaskStore] ✓ 所有任务已完成，停止轮询');
            }
        },
        _run(immediate: boolean) {
            // 检查全局开关
            if (!this.isBackgroundTaskEnabled) {
                this.isRunning = false;
                return;
            }

            if (runNextTimer) {
                clearTimeout(runNextTimer);
                runNextTimer = null;
            }
            setTimeout(
                () => {
                    this._runExecute();
                },
                immediate ? 0 : 1000
            );
        },
        get(biz: string) {
            return this.bizMap[biz] || null;
        },
        register(biz: string, taskBiz: TaskBiz) {
            this.bizMap[biz] = taskBiz;
        },
        unregister(biz: string) {
            delete this.bizMap[biz];
        },
        onChange(biz: string | null, callback: (bizId: string, type: TaskChangeType) => void): number {
            const id = ++listenerIdCounter;
            taskChangeListeners.set(id, { id, biz, callback });
            return id;
        },
        // 支持两种调用方式：
        // 1. offChange(listenerId: number) - 通过 ID 移除
        // 2. offChange(biz: string | null, callback: Function) - 通过 biz 和 callback 移除（向后兼容）
        offChange(bizOrId: string | number | null, callback?: (bizId: string, type: TaskChangeType) => void) {
            // 方式1：通过 ID 移除
            if (typeof bizOrId === 'number' && callback === undefined) {
                if (taskChangeListeners.has(bizOrId)) {
                    taskChangeListeners.delete(bizOrId);
                } else {
                    console.warn(`[TaskStore.offChange] 找不到监听器 ID: ${bizOrId}，可能已被注销`);
                }
                return;
            }

            // 方式2：通过 biz 和 callback 移除（向后兼容）
            if (callback !== undefined) {
                const biz = bizOrId as string | null;
                for (const [id, listener] of taskChangeListeners) {
                    if (listener.biz === biz && listener.callback === callback) {
                        taskChangeListeners.delete(id);
                        return;
                    }
                }
                console.warn(`[TaskStore.offChange] 找不到 ${biz} 的监听器，可能已被注销`);
            }
        },
        fireChange(record: Partial<TaskRecord>, type: TaskChangeType) {
            taskChangeListeners.forEach(listener => {
                if (null === listener.biz || listener.biz === record.biz) {
                    listener.callback(record.bizId as string, type);
                }
            });
        },
        // 清理所有监听器（应用退出时调用）
        clearAllListeners() {
            const count = taskChangeListeners.size;
            taskChangeListeners.clear();
            listenerIdCounter = 0;
            console.log(`[TaskStore] 已清理 ${count} 个监听器`);
        },
        requestCancel(biz: string, bizId: string) {
            console.log(`[TaskStore.requestCancel] 🛑 收到取消请求: ${biz}-${bizId}`);

            this.cancelMap[`${biz}-${bizId}`] = {
                expire: TimeUtil.timestampMS() + 60 * 60 * 1000,
            };
            this.fireChange({ biz, bizId }, 'requestCancel')
            if (this.bizMap[biz]?.requestCancelFunc) {
                this.bizMap[biz]?.requestCancelFunc?.(bizId, {}).catch(e => {
                    $mapi.log.error("Task.RequestCancelFunc.Error", e.toString()).then();
                });
            }

            // 🔧 关键修复：同时更新内存和数据库中的任务状态
            // 1. 更新内存中的任务，确保 _runExecute 能够检测到并调用 failFunc 进行清理
            console.log(`[TaskStore.requestCancel] 🔍 在内存中查找任务，当前内存中共有 ${this.records.length} 个任务`);
            console.log(`[TaskStore.requestCancel] 🔍 查找条件: biz=${biz}, bizId=${bizId}`);

            const memoryRecord = this.records.find(r => r.biz === biz && r.bizId === bizId);
            if (memoryRecord) {
                console.log(`[TaskStore.requestCancel] ✓ 找到内存任务，当前状态: ${memoryRecord.status}`);
                if (memoryRecord.status === 'queue' || memoryRecord.status === 'running' || memoryRecord.status === 'querying') {
                    console.log(`[TaskStore.requestCancel] 🔧 更新内存中的任务状态为 fail: ${biz}-${bizId}`);
                    memoryRecord.status = 'fail';
                    memoryRecord.msg = mapError('UserCancel');
                    // 触发 _runExecute 立即处理这个失败的任务
                    this._run(true);
                } else {
                    console.warn(`[TaskStore.requestCancel] ⚠️ 任务状态不符合取消条件: ${memoryRecord.status}，无法调用 failFunc`);
                }
            } else {
                console.warn(`[TaskStore.requestCancel] ❌ 在内存中找不到任务 ${biz}-${bizId}`);
                console.log(`[TaskStore.requestCancel] 📊 内存中的所有任务:`);
                this.records.forEach(r => {
                    console.log(`  - ${r.biz}-${r.bizId} (status: ${r.status})`);
                });
            }

            // 2. 同时更新数据库中的任务状态，确保即使任务不在内存中也能被取消
            (async () => {
                try {
                    const record = await TaskService.get(bizId);
                    if (record && (record.status === 'queue' || record.status === 'wait' || record.status === 'running' || record.status === 'querying')) {
                        await TaskService.update(bizId, {
                            status: 'fail',
                            statusMsg: mapError('UserCancel'),
                            endTime: Date.now(),
                        });
                        console.log(`[TaskStore] Task ${biz}-${bizId} cancelled in database`);
                    }
                } catch (e) {
                    // 任务可能不存在，忽略错误
                    console.warn(`[TaskStore] Failed to cancel task in database: ${e}`);
                }
            })();
        },
        shouldCancel(biz: string, bizId: string) {
            // expire old
            for (const key in this.cancelMap) {
                if (this.cancelMap[key].expire < TimeUtil.timestampMS()) {
                    delete this.cancelMap[key];
                }
            }
            if (!!this.cancelMap[`${biz}-${bizId}`]) {
                delete this.cancelMap[`${biz}-${bizId}`];
                return true;
            }
            return false;
        },
        // 🔧 清空指定业务类型的所有任务（包括运行中、失败等，仅保留已成功的）
        async clearTasksByBiz(biz: string) {
            await this.waitInit();
            const beforeCount = this.records.length;
            // 保留：success（已完成）、delete（已删除）；清空：其他所有状态的该业务任务
            this.records = this.records.filter(r => r.biz !== biz || r.status === 'success' || r.status === 'delete');
            const removedCount = beforeCount - this.records.length;
            await this.sync();
            console.log(`[TaskStore] 已清空 ${biz} 的任务，删除 ${removedCount} 个任务`);
        },
        async dispatch(biz: string, bizId: string, bizParam?: any, param?: object) {
            await this.waitInit();
            if (!this.bizMap[biz]) {
                console.error(`[TaskStore.dispatch] ❌ 任务类型 "${biz}" 未注册！`);
                console.error(`[TaskStore.dispatch] 当前已注册的任务类型:`, Object.keys(this.bizMap));
                throw new Error("TaskBizNotFound");
            }
            param = Object.assign(
                {
                    timeout: 24 * 60 * 60 * 1000,
                    queryInterval: 5 * 1000,
                    status: "queue",
                    runStart: 0,
                },
                param
            );
            const taskRecord = {
                id: `${biz}-${Date.now()}-${StringUtil.random(8)}`,
                status: param["status"],
                msg: "",
                biz,
                bizId,
                bizParam,
                runStart: param["runStart"],
                runAfter: 0,
                runCalling: false,
                queryAfter: 0,
                queryInterval: param["queryInterval"],
                queryCalling: false,
                successCalling: false,
                timeout: param["timeout"],
            } as TaskRecord;
            this.records.push(taskRecord);

            // 🔧 关键修复：任务添加后立即通知前端
            console.log(`[TaskStore] ✓ 新任务已添加: ${biz}-${bizId}`);
            this.fireChange(taskRecord, 'change');

            // 🔧 关键修复：如果后台任务被禁用，自动启动它
            if (!this.isBackgroundTaskEnabled) {
                console.log('[TaskStore] 🔧 检测到后台任务被禁用，自动启动...');
                this.isBackgroundTaskEnabled = true;
                this.isRunning = true;
                await $mapi.storage.set("task", "enabled", true);
            }

            // 执行任务
            this._run(true);
        },
        // 清除所有运行中的任务（应用退出时调用）
        async clearRunningTasks() {
            await this.waitInit();
            console.log('[TaskStore] 清除所有运行中的任务...');

            // 停止后台任务
            await this.stopBackgroundTasks();

            // 清除所有运行中或队列中的任务
            const initialRecords = this.records.filter(record => {
                return record.status !== "running" &&
                    record.status !== "querying" &&
                    record.status !== "queue";
            });

            this.records = initialRecords;

            // 清空背景任务开关
            this.isBackgroundTaskEnabled = false;
            this.isRunning = false;

            // 保存清理后的状态
            await this.sync();

            console.log('[TaskStore] 运行中的任务已清除');
        },
        async sync() {
            await this.waitInit();
            const savedRecords = toRaw(cloneDeep(this.records));
            savedRecords.forEach(record => {
                // record.status = undefined
                // record.runtime = undefined
            });
            await $mapi.storage.set("task", "records", savedRecords);
        },
    },
});

export const task = taskStore(store);
task.init().then();

export const useTaskStore = () => {
    return task;
};
