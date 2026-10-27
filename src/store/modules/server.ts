// @ts-nocheck
import type {ComputedRef} from "vue";
import {cloneDeep} from "lodash-es";
import {defineStore} from "pinia";
import {computed, ref, toRaw} from "vue";
import {TimeUtil, wait} from "../../lib/util";
import {useTaskStore} from "./task";
// import {useServerCloudStore} from "./serverCloud";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {StorageService} from "../../service/StorageService";
import {TaskService} from "../../service/TaskService";
import {EnumServerStatus, EnumServerType, ServerRecord, ServerRuntime} from "../../types/Server";
import store from "../index";
import {ServerInfo} from "../../../electron/mapi/server/type";

// const serverCloudStore = useServerCloudStore()
const taskStore = useTaskStore();
const serverRuntime = ref<Map<string, ServerRuntime>>(new Map());
const normalizeServerFunctions = (functions: string[] = []) => {
    const mapped = functions.map(f => (f === "speechRecognition" ? "asr" : f));
    return Array.from(new Set(mapped));
};
const createServerStatus = (record: ServerRecord): ComputedRef<EnumServerStatus> => {
    return computed(() => {
        if (record.type === EnumServerType.CLOUD || record.autoStart) {
            return EnumServerStatus.RUNNING;
        }
        return serverRuntime.value?.get(record.key)?.status || EnumServerStatus.STOPPED;
    });
};
const getServerRuntimeComputedValue = (record: ServerRecord): ComputedRef<ServerRuntime> => {
    return computed(() => {
        let defaultStatus = EnumServerStatus.STOPPED;
        if (record.type === EnumServerType.CLOUD || record.autoStart) {
            defaultStatus = EnumServerStatus.RUNNING;
        }
        return (
            serverRuntime.value?.get(record.key) ||
            ({
                status: defaultStatus,
            } as ServerRuntime)
        );
    });
};
const getOrCreateServerRuntime = (record: ServerRecord): ServerRuntime => {
    const value = serverRuntime.value?.get(record.key);
    if (value) {
        return value;
    }
    const defaultValue = {
        status: EnumServerStatus.STOPPED,
        autoStartStatus: EnumServerStatus.STOPPED,
        eventChannelName: undefined,
        logFile: "",
    } as ServerRuntime;
    if (record.type === EnumServerType.CLOUD || record.autoStart) {
        defaultValue.status = EnumServerStatus.RUNNING;
        defaultValue.eventChannelName = createEventChannel(record, defaultValue);
        defaultValue.logFile = `logs/${record.name}_${record.version}_${TimeUtil.dateString()}.log`;
    }
    serverRuntime.value?.set(record.key, defaultValue);
    return serverRuntime.value?.get(record.key) as ServerRuntime;
};
// 清理服务器运行时资源（定时器、事件通道等）
const cleanupServerRuntime = (record: ServerRecord) => {
    const runtime = serverRuntime.value?.get(record.key);
    if (runtime) {
        // 清除 ping 检查定时器
        if (runtime.pingCheckTimer) {
            clearTimeout(runtime.pingCheckTimer);
            runtime.pingCheckTimer = undefined;
        }
        // 销毁事件通道
        if (runtime.eventChannelName && window.__page) {
            try {
                window.__page.destroyChannel(runtime.eventChannelName);
            } catch (e) {
                console.warn('[ServerStore] 销毁事件通道失败:', e);
            }
            runtime.eventChannelName = undefined;
        }
    }
};

const deleteServerRuntime = (record: ServerRecord) => {
    // 先清理资源，再删除
    cleanupServerRuntime(record);
    serverRuntime.value?.delete(record.key);
};

const createEventChannel = (server: ServerRecord, serverRuntime?: ServerRuntime) => {
    if (!serverRuntime) {
        serverRuntime = getOrCreateServerRuntime(server);
    }

    // 检查 window.__page 是否可用
    if (!window.__page) {
        console.warn('[ServerStore] window.__page 不可用，无法创建事件通道');
        return undefined as any;
    }

    const eventChannel = window.__page.createChannel(function (channelData) {
        const {type, data} = channelData;
        switch (type) {
            case "success":
                clearTimeout(serverRuntime.pingCheckTimer);
                serverRuntime.status = EnumServerStatus.STOPPED;
                window.__page.destroyChannel(eventChannel);
                updateRunningServerCount().then();
                break;
            case "error":
                clearTimeout(serverRuntime.pingCheckTimer);
                serverRuntime.status = EnumServerStatus.ERROR;
                window.__page.destroyChannel(eventChannel);
                updateRunningServerCount().then();
                break;
            case "starting":
            case "stopping":
            case "stopped":
                break;
            case "action":
                switch (data.type) {
                    case "LoginRequired":
                    case "VipRequired":
                        const msgMap = {
                            LoginRequired: t("请先登录"),
                            VipRequired: t("请先开通会员"),
                        };
                        Dialog.tipError(data.msg || msgMap[data.type]);
                        setTimeout(() => {
                            if (window.$mapi) {
                                window.$mapi.user.open().then();
                            }
                        }, 2000);
                        break;
                }
                break;
            case "liveTalk":
                StorageService.add("LiveTalk", {
                    title: data.title,
                    content: {
                        content: data.content,
                    },
                }).then();
                break;
            case "taskRunning":
            case "taskResult":
            case "taskStatus":
                const {id} = data;
                const {biz, bizId} = serverStoreInstance.parseTaskId(id);
                // console.log('task', {type, biz, bizId, data})
                const taskUpdate = async (bizId: string, data: any) => {
                    const bizer = taskStore.get(biz);
                    if (bizer && bizer.update) {
                        await bizer.update(bizId, data);
                    } else {
                        await TaskService.update(bizId, data);
                    }
                };
                const taskFireRunning = async () => {
                    taskStore.fireChange(
                        {
                            biz,
                            bizId,
                        } as any,
                        "running"
                    );
                };
                if ("taskRunning" === type) {
                    taskUpdate(bizId, {
                        status: "running",
                        startTime: TimeUtil.timestampMS(),
                    }).then(taskFireRunning);
                } else if ("taskResult" === type) {
                    taskUpdate(bizId, {
                        result: data.result,
                    }).then(taskFireRunning);
                }
                break;
            case "taskLog":
                // 处理任务日志
                const {id: taskLogId, type: logType, data: logData, timestamp} = data;
                const {biz: logBiz, bizId: logBizId} = serverStoreInstance.parseTaskId(taskLogId);

                // 解析日志内容，提取有意义的信息
                const lines = (logData || "").split("window.$mapi.").filter((line: string) => line.trim());

                lines.forEach((line: string) => {
                    // 跳过空行
                    if (!line.trim()) return;

                    // 确定日志级别
                    let level: "info" | "warn" | "error" | "debug" = "info";
                    if (logType === "stderr" || line.includes("ERROR") || line.includes("Error")) {
                        level = "error";
                    } else if (line.includes("WARN") || line.includes("Warning")) {
                        level = "warn";
                    }

                    // 提取进度信息
                    let progress: number | undefined;
                    const progressMatch = line.match(/(window.$mapi.+)%window.$mapi./);
                    if (progressMatch) {
                        progress = parseInt(progressMatch[1]);
                    }

                    // 提取进程信息
                    let processName: string | undefined;
                    if (line.includes("[VideoGen]")) {
                        processName = "VideoGen";
                    } else if (line.includes("[SoundClone]") || line.includes("[SoundTts]")) {
                        processName = "AudioGen";
                    } else if (line.includes("GPT") || line.includes("gpt")) {
                        processName = "GPT";
                    } else if (line.includes("bigvgan") || line.includes("BigVGAN")) {
                        processName = "BigVGAN";
                    } else if (line.includes("semantic_codec")) {
                        processName = "SemanticCodec";
                    } else if (line.includes("Result[") || line.includes("LIB.")) {
                        processName = "Server";
                    }

                    // 清理日志消息（移除ANSI颜色代码等）
                    let message = line
                        .replace(/window.$mapi.1bwindow.$mapi.window.$mapi.+m/g, "") // 移除ANSI颜色代码
                        .replace(/^window.$mapi.{4}-window.$mapi.{2}-window.$mapi.{2} window..{2}:window.$mapi.{2}:window.$mapi.{2} - window..+ - /, "") // 移除时间戳前缀
                        .replace(/^Appwindow.$mapi.spawnShellwindow.$mapi.(stdout|stderr) - /, "") // 移除App.spawnShell前缀
                        .trim();

                    // 只记录有意义的日志（过滤掉过短或无用的日志）
                    if (message.length < 5) return;

                    // 异步写入日志到TaskService
                    TaskService.log(logBizId, level, message, {
                        processName,
                        progress,
                        metadata: {
                            logType,
                            timestamp,
                            fullTaskId: taskLogId
                        }
                    }).catch(err => {
                        console.error("Failed to write task log:", err, "bizId:", logBizId);
                    });
                });
                break;
            default:
                console.log("eventChannel.unknown", type, data);
                break;
        }
    });
    return eventChannel;
};

const updateRunningServerCount = async () => {
    const count = serverStoreInstance.records.filter(r => {
        return r.type === EnumServerType.LOCAL_DIR && r.status === EnumServerStatus.RUNNING && !r.autoStart;
    }).length;
    if (window.$mapi) {
        await window.$mapi.server.runningServerCount(count);
    }
};

export const serverStore = defineStore("server", {
    state: () => ({
        isReady: false,
        records: [] as ServerRecord[],
    }),
    actions: {
        async waitReady() {
            await wait(() => this.isReady);
            // await serverCloudStore.waitReady()
        },
        async init() {
            // 检查 $mapi 是否可用
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过服务器初始化');
                return;
            }

            try {
                await window.$mapi.storage.get("server", "records", []).then(records => {
                    records.forEach((record: ServerRecord) => {
                        record.functions = normalizeServerFunctions(record.functions);
                        record.status = createServerStatus(record);
                        record.runtime = getServerRuntimeComputedValue(record);
                    });
                    this.records = records.filter((record: ServerRecord) => {
                        return record.type !== EnumServerType.CLOUD;
                    });
                });
                taskStore.onChange(null, (bizId, type) => {
                    if (type === 'requestCancel') {
                        TaskService.get(bizId).then(record => {
                            if (record && record.serverName && record.serverVersion) {
                                this.cancelByNameVersion(record.serverName, record.serverVersion).then();
                            }
                        })
                    }
                })
                await this.refresh();
                this.isReady = true;
            } catch (error) {
                console.error('❌ 服务器初始化失败:', error);
            }
        },
        async refresh() {
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过服务器刷新');
                return;
            }

            try {
                const dirs = await window.$mapi.file.list("model", {
                    isDataPath: true,
                });
                const localRecords: ServerRecord[] = [];
                for (let dir of dirs) {
                    const config = await window.$mapi.file.read(`model/${dir.name}/config.json`, {
                        isDataPath: true,
                    });
                    let json;
                    try {
                        json = JSON.parse(config);
                    } catch (e) {
                        continue;
                    }
                    if (!json) {
                        continue;
                    }
                    localRecords.push({
                        key: this.generateServerKey({
                            name: json.name,
                            version: json.version,
                        } as any),
                        name: json.name || dir.name,
                        title: json.title || dir.name,
                        version: json.version || "1.0.0",
                        type: EnumServerType.LOCAL,
                        functions: normalizeServerFunctions(json.functions || []),
                        localPath: `model/${dir.name}`,
                        settings: json.settings || [],
                        setting: json.setting || {},
                    } as ServerRecord);
                }
                let changed = false;
                for (let lr of localRecords) {
                    const record = this.records.find(record => record.key === lr.key);
                    if (!record) {
                        lr.status = createServerStatus(lr);
                        lr.runtime = getServerRuntimeComputedValue(lr);
                        this.records.unshift(lr as any);
                        changed = true;
                    } else {
                        const normalizedFunctions = normalizeServerFunctions(lr.functions || []);
                        if (JSON.stringify(record.functions || []) !== JSON.stringify(normalizedFunctions)) {
                            record.functions = normalizedFunctions;
                            changed = true;
                        }
                        if (!record.settings && lr.settings) {
                            record.settings = lr.settings;
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    await this.sync();
                }
            } catch (error) {
                console.error('❌ 刷新服务器列表失败:', error);
            }
        },
        async prepareForTask(bizId: string, bizParam: any) {
            const record = await TaskService.get(bizId as any);
            // console.log('SoundTts.runFunc.record', record)
            if (!record) {
                throw "record not found";
            }
            let server: any = null;
            let serverInfo: any = null;
            if (record.serverName && record.serverVersion) {
                server = await this.getByNameVersion(record.serverName, record.serverVersion);
                // console.log('SoundTts.runFunc.server', server)
                if (!server) {
                    throw "server not found";
                }
                serverInfo = await this.serverInfo(server);
            }
            return {
                record,
                server,
                serverInfo,
            };
        },
        generateTaskId(biz: string, bizId: string) {
            return `${biz}_${bizId}`;
        },
        parseTaskId(taskId: string) {
            const parts = taskId.split("_");
            if (parts.length < 2) {
                throw new Error("InvalidTaskId");
            }
            return {
                biz: parts[0],
                bizId: parts.slice(1).join("_"),
            };
        },
        findRecord(server: ServerRecord) {
            return this.records.find(record => record.key === server.key);
        },
        start: async function (server: ServerRecord) {
            const record = this.findRecord(server);
            if (!record) {
                throw "RecordNotFound";
            }
            if (record.status === EnumServerStatus.STOPPED || record.status === EnumServerStatus.ERROR) {
            } else {
                throw "StatusError";
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            serverRuntime.status = EnumServerStatus.STARTING;
            serverRuntime.startTimestampMS = TimeUtil.timestampMS();
            serverRuntime.logFile = `logs/${server.name}_${server.version}_${TimeUtil.dateString()}_${
                serverRuntime.startTimestampMS
            }.log`;
            serverRuntime.eventChannelName = createEventChannel(server);
            const serverInfo = await this.serverInfo(server);
            if (window.$mapi) {
                await window.$mapi.server.start(serverInfo);
            } else {
                throw new Error("$mapi is not available");
            }
            let pingTimeout = 60 * 5 * 1000;
            let pingStart = TimeUtil.timestampMS();
            const pingCheck = () => {
                const now = TimeUtil.timestampMS();
                if (now - pingStart > pingTimeout) {
                    // console.log('ping.timeout')
                    // 清除定时器，防止泄漏
                    if (serverRuntime.pingCheckTimer) {
                        clearTimeout(serverRuntime.pingCheckTimer);
                        serverRuntime.pingCheckTimer = undefined;
                    }
                    serverRuntime.status = EnumServerStatus.ERROR;
                    if (window.$mapi) {
                        window.$mapi.server.stop(serverInfo);
                    }
                    return;
                }
                if (window.$mapi) {
                    window.$mapi.server
                        .ping(serverInfo)
                        .then(success => {
                            if (success) {
                                serverRuntime.status = EnumServerStatus.RUNNING;
                                updateRunningServerCount().then();
                            } else {
                                serverRuntime.pingCheckTimer = setTimeout(pingCheck, 2000);
                            }
                        })
                        .catch(err => {
                            serverRuntime.pingCheckTimer = setTimeout(pingCheck, 2000);
                        });
                } else {
                    serverRuntime.pingCheckTimer = setTimeout(pingCheck, 2000);
                }
            };
            serverRuntime.pingCheckTimer = setTimeout(pingCheck, 2 * 1000);
        },
        async stop(server: ServerRecord) {
            const record = this.findRecord(server);
            if (record?.status === EnumServerStatus.RUNNING) {
            } else {
                throw new Error("StatusError");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            // 清除 ping 检查定时器，防止泄漏
            if (serverRuntime.pingCheckTimer) {
                clearTimeout(serverRuntime.pingCheckTimer);
                serverRuntime.pingCheckTimer = undefined;
            }
            serverRuntime.status = EnumServerStatus.STOPPING;
            const serverInfo = await this.serverInfo(server);
            serverInfo.logFile = serverRuntime.logFile;
            await $mapi.server.stop(serverInfo);
        },
        async cancel(server: ServerRecord) {
            const record = this.findRecord(server);
            if (record?.status === EnumServerStatus.RUNNING) {
            } else {
                throw new Error("StatusError");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            const serverInfo = await this.serverInfo(server);
            serverInfo.logFile = serverRuntime.logFile;
            await $mapi.server.cancel(serverInfo);
        },
        async updateSetting(key: string, setting: any) {
            const record = this.records.find(record => record.key === key);
            if (!record) {
                return;
            }
            record.setting = Object.assign(record.setting || {}, setting);
            await this.sync();
        },
        async delete(server: ServerRecord) {
            const index = this.records.findIndex(record => record.key === server.key);
            if (index === -1) {
                return;
            }
            const record = this.records[index];
            if (
                record.autoStart ||
                record.status === EnumServerStatus.STOPPED ||
                record.status === EnumServerStatus.ERROR
            ) {
            } else {
                if (record.type === EnumServerType.LOCAL_DIR) {
                    throw new Error("StatusError");
                }
            }
            const serverInfo = await this.serverInfo(server);
            if (window.$mapi) {
                window.$mapi.server.deletes(serverInfo).then();
                if (record.type === EnumServerType.LOCAL) {
                    await window.$mapi.file.deletes(record.localPath as string, {
                        isDataPath: true,
                    });
                }
            }
            this.records.splice(index, 1);
            deleteServerRuntime(server);
            await this.sync();
        },
        async add(server: ServerRecord) {
            let record = this.records.find(record => record.key === server.key);
            if (record) {
                return;
            }
            server.functions = normalizeServerFunctions(server.functions);
            server.status = createServerStatus(server);
            server.runtime = getServerRuntimeComputedValue(server);
            this.records.unshift(server);
            await this.sync();
        },
        async sync() {
            const savedRecords = toRaw(cloneDeep(this.records));
            savedRecords.forEach(record => {
                record.status = undefined;
                record.runtime = undefined;
            });
            if (window.$mapi) {
                await window.$mapi.storage.set("server", "records", savedRecords);
            }
        },
        async getByKey(key: string): Promise<ServerRecord | undefined> {
            // if (key.startsWith('Cloud')) {
            //     return serverCloudStore.getByKey(key)
            // }
            return this.records.find(record => record.key === key);
        },
        async getByNameVersion(name: string, version: string): Promise<ServerRecord | undefined> {
            // if (name.startsWith('Cloud')) {
            //     return serverCloudStore.getByNameVersion(name, version)
            // }
            return this.records.find(record => record.name === name && record.version === version);
        },
        async cancelByNameVersion(name: string, version: string) {
            const record = await this.getByNameVersion(name, version);
            if (record) {
                await this.cancel(record);
            }
        },
        generateServerKey(server: ServerRecord) {
            return `${server.name}|${server.version}`;
        },
        async call(
            serverInfo: ServerInfo,
            method: string,
            data: ServerCallFunctionData,
            option?: ServerCallFunctionOption
        ): Promise<ServerCallFunctionResult> {
            await this.callStart(serverInfo);
            const res = await $mapi.server.callFunctionWithException(serverInfo, method, data, option);
            await this.callEnd(serverInfo);
            return res;
        },
        async callStart(serverInfo: ServerInfo) {
            const server = await this.getByNameVersion(serverInfo.name, serverInfo.version);
            if (!server) {
                throw new Error("ServerNotFound");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (server.autoStart) {
                serverRuntime.autoStartStatus = EnumServerStatus.RUNNING;
            }
        },
        async callEnd(serverInfo: ServerInfo) {
            const server = await this.getByNameVersion(serverInfo.name, serverInfo.version);
            if (!server) {
                throw new Error("ServerNotFound");
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (server.autoStart) {
                serverRuntime.autoStartStatus = EnumServerStatus.RUNNING;
                console.log(`[ServerStore.callEnd] 保留常驻本地服务，不再在任务结束后自动停止: ${server.name}`);
                return;

                // 🔧 核心修复：真正停止服务器，释放进程和GPU资源
                // 这解决了"僵尸进程占用GPU导致系统卡死"的问题
                console.log(`[ServerStore.callEnd] 🛑 任务完成，准备停止服务: ${server.name}`);

                try {
                    // ✅ 关键改动：真正调用 stop() 方法
                    // 这会：
                    // 1. 向后端发送停止信号
                    // 2. 后端杀死主进程
                    // 3. 主进程清理所有子进程
                    // 4. 释放 GPU 显存
                    await this.stop(server);

                    console.log(`[ServerStore.callEnd] ✅ 服务已停止: ${server.name} (GPU资源已释放)`);

                    // 🔧 关键修复：强制清理可能残留的子进程（multiprocessing孤儿进程）
                    // 只清理配置的模型路径相关的进程，避免误杀其他Python程序
                    console.log(`[ServerStore.callEnd] 🧹 执行强制子进程清理（基于模型路径）...`);
                    try {
                        // 获取所有配置的模型路径
                        const modelPaths = this.records
                            .filter(record => record.localPath)
                            .map(record => record.localPath.toLowerCase())
                            .filter((path, index, self) => self.indexOf(path) === index); // 去重

                        if (modelPaths.length > 0) {
                            console.log(`[ServerStore.callEnd] 清理目标模型路径数: ${modelPaths.length}`);
                            console.log(`[ServerStore.callEnd] 目标路径: ${modelPaths.join(', ')}`);

                            // 🔧 使用wmic命令 - 更可靠且无转义问题（仅Windows）
                            try {
                                const pidsToKill: string[] = [];

                                const whitelistKeywords = [
                                    'finderliveobs', 'xwechat', 'obs', 'streamlabs',
                                    'douyin', 'tiktok', 'bilibili', 'wechat', 'weixin',
                                    'pycharm', 'vscode', 'jupyter', 'anaconda', 'conda'
                                ];

                                const isWindows = navigator.platform.toLowerCase().includes('win');

                                if (isWindows) {
                                for (const modelPath of modelPaths) {
                                    try {
                                        console.log(`[ServerStore.callEnd] 检查路径: ${modelPath}`);

                                        const escapedPath = modelPath.replace(/\\/g, '\\\\');
                                        const wmicOutput = await $mapi.shell.exec(
                                            `wmic process where "commandline like '%multiprocessing%' and commandline like '%spawn_main%' and commandline like '%${escapedPath}%'" get ProcessId /format:csv`
                                        );

                                        if (wmicOutput && wmicOutput.trim()) {
                                            const lines = wmicOutput.trim().split('\n');
                                            for (const line of lines) {
                                                if (line.includes(',')) {
                                                    const parts = line.split(',');
                                                    const pid = parts[parts.length - 1].trim();
                                                    if (pid && !isNaN(Number(pid)) && !pidsToKill.includes(pid)) {
                                                        try {
                                                            const cmdlineOutput = await $mapi.shell.exec(
                                                                `powershell -Command "Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\" | Select-Object -ExpandProperty CommandLine"`
                                                            );
                                                            const cmdline = (cmdlineOutput || '').toLowerCase();

                                                            const isWhitelisted = whitelistKeywords.some(keyword => cmdline.includes(keyword));
                                                            if (isWhitelisted) {
                                                                console.log(`[ServerStore.callEnd] ⚠️ 跳过白名单进程 PID: ${pid}`);
                                                                continue;
                                                            }

                                                            console.log(`[ServerStore.callEnd] 🎯 找到子进程 PID: ${pid} (路径: ${modelPath})`);
                                                            pidsToKill.push(pid);
                                                        } catch (cmdlineErr) {
                                                            console.warn(`[ServerStore.callEnd] 无法检查 PID ${pid} 的命令行，跳过`);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    } catch (e) {
                                        console.warn(`[ServerStore.callEnd] 检查路径 ${modelPath} 失败: ${e}`);
                                    }
                                }
                                } else {
                                    try {
                                        await $mapi.shell.exec(`pkill -f "multiprocessing.*spawn_main" 2>/dev/null || true`);
                                        console.log(`[ServerStore.callEnd] ✅ macOS/Linux: 已清理 multiprocessing 子进程`);
                                    } catch (e) {
                                        console.warn(`[ServerStore.callEnd] macOS/Linux 进程清理失败: ${e}`);
                                    }
                                }

                                console.log(`[ServerStore.callEnd] 找到匹配路径的子进程数: ${pidsToKill.length}`);

                                if (isWindows && pidsToKill.length > 0) {
                                    console.log(`[ServerStore.callEnd] 要清理的PID: ${pidsToKill.join(', ')}`);
                                    // 步骤2：批量杀死这些进程
                                    const pidStr = pidsToKill.join(',');
                                    await $mapi.shell.exec(
                                        `powershell -Command "Stop-Process -Id ${pidStr} -Force -ErrorAction SilentlyContinue"`
                                    );
                                    console.log(`[ServerStore.callEnd] ✅ 已清理 ${pidsToKill.length} 个子进程`);
                                } else {
                                    console.log(`[ServerStore.callEnd] 没有找到需要清理的子进程`);
                                }

                                // 🔧 注意：GPU深度清理已移至前端各任务完成后统一调用
                                // 在 saveWorkData 等所有数据保存完成后再执行清理，避免过早清理
                            } catch (parseErr: any) {
                                console.warn(`[ServerStore.callEnd] ⚠️ 处理进程列表失败: ${parseErr.message}`);
                            }
                        } else {
                            console.warn(`[ServerStore.callEnd] ⚠️ 未配置模型路径，跳过子进程清理`);
                        }
                    } catch (e: any) {
                        console.warn(`[ServerStore.callEnd] ⚠️ 子进程清理失败: ${e.message}`);
                        // 不影响主流程
                    }
                } catch (e: any) {
                    // ⚠️ 停止失败时的处理
                    console.error(`[ServerStore.callEnd] ❌ 停止服务失败: ${server.name}, 错误: ${e.message}`);

                    // 即使 stop() 失败，也要标记为已停止
                    // 防止服务被再次使用导致进程重复启动
                    serverRuntime.autoStartStatus = EnumServerStatus.STOPPED;
                    serverRuntime.status = EnumServerStatus.STOPPED;

                    // 错误不影响任务流程继续
                    // 但会被记录下来便于调试
                }
            }
        },
        async serverInfo(server: ServerRecord) {
            const result = {
                localPath: "",
                name: server.name,
                version: server.version,
                setting: toRaw(server.setting),
                logFile: "",
                eventChannelName: "",
                config: JSON.parse(JSON.stringify(server)),
            };
            if (server.type === EnumServerType.LOCAL) {
                if (window.$mapi) {
                    result.localPath = await window.$mapi.file.fullPath(server.localPath as string);
                } else {
                    result.localPath = server.localPath as string;
                }
            } else if (server.type === EnumServerType.LOCAL_DIR) {
                result.localPath = server.localPath as string;
            } else if (server.type === EnumServerType.CLOUD) {
                result.localPath = server.localPath as string;
            }
            const serverRuntime = getOrCreateServerRuntime(server);
            if (serverRuntime) {
                result.logFile = serverRuntime.logFile;
                result.eventChannelName = serverRuntime.eventChannelName as string;
            }
            return result as ServerInfo;
        },
    },
});

const serverStoreInstance = serverStore(store);
serverStoreInstance.init().then();

export const useServerStore = () => {
    return serverStoreInstance;
};
