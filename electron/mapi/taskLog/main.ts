import {ipcMain} from "electron";
import {DBMain} from "../db/main";

export type TaskLogLevel = "info" | "warn" | "error" | "debug";

export type TaskLogRecord = {
    id?: number;
    taskId: number | string;
    timestamp: number;
    level: TaskLogLevel;
    message: string;
    processName?: string;
    processPath?: string;
    progress?: number;
    metadata?: any;
    createdAt?: number;
};

const tableName = "data_task_log";

/**
 * 编码日志记录
 */
const encodeRecord = (record: TaskLogRecord): any => {
    const encoded = {...record};
    if ("metadata" in encoded && encoded.metadata) {
        encoded.metadata = JSON.stringify(encoded.metadata);
    }
    return encoded;
};

/**
 * 添加任务日志（主进程直接调用）
 */
const addLog = async (log: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">): Promise<number> => {
    const now = Date.now();
    const record: TaskLogRecord = {
        ...log,
        timestamp: log.timestamp || now,
        createdAt: Math.floor(now / 1000),
    };

    const encoded = encodeRecord(record);

    const fields = [
        "taskId",
        "timestamp",
        "level",
        "message",
        "processName",
        "processPath",
        "progress",
        "metadata",
        "createdAt",
    ];

    const values = fields.map(f => encoded[f] ?? null);
    const placeholders = fields.map(() => "?").join(",");

    const id = await DBMain.insert(
        `INSERT INTO ${tableName} (${fields.join(",")})
         VALUES (${placeholders})`,
        values
    );

    return id as number;
};

/**
 * 批量添加日志（主进程直接调用）
 */
const addLogs = async (logs: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">[]): Promise<void> => {
    if (!logs || logs.length === 0) {
        return;
    }

    for (const log of logs) {
        await addLog(log);
    }
};

// 注册IPC处理器 - 用于渲染进程调用
ipcMain.handle("taskLog:addLog", async (event, log: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">) => {
    return await addLog(log);
});

ipcMain.handle("taskLog:addLogs", async (event, logs: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">[]) => {
    return await addLogs(logs);
});

export const TaskLogMain = {
    addLog,
    addLogs,
};

export default TaskLogMain;
