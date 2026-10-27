// @ts-nocheck
import {TimeUtil} from "../lib/util";

export type TaskLogLevel = "info" | "warn" | "error" | "debug";

export type TaskLogRecord = {
    id?: number;
    taskId: number | string;
    timestamp: number;
    level: TaskLogLevel;
    message: string;
    processName?: string;  // 进程名称
    processPath?: string;  // 文件路径
    progress?: number;     // 进度 0-100
    metadata?: any;        // 其他元数据
    createdAt?: number;
};

export const TaskLogService = {
    tableName() {
        return "data_task_log";
    },

    /**
     * 初始化任务日志表
     */
    async initTable() {
        const maxRetries = 10;
        const retryDelay = 500; // 500ms

        for (let i = 0; i < maxRetries; i++) {
            try {
                await window.$mapi.db.execute(`
                    CREATE TABLE IF NOT EXISTS ${this.tableName()} (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        taskId INTEGER NOT NULL,
                        timestamp INTEGER NOT NULL,
                        level TEXT NOT NULL,
                        message TEXT NOT NULL,
                        processName TEXT,
                        processPath TEXT,
                        progress INTEGER DEFAULT 0,
                        metadata TEXT,
                        createdAt INTEGER NOT NULL
                    )
                `);

                // 创建索引以提升查询性能
                await window.$mapi.db.execute(`
                    CREATE INDEX IF NOT EXISTS idx_task_log_taskId
                    ON ${this.tableName()} (taskId)
                `);

                await window.$mapi.db.execute(`
                    CREATE INDEX IF NOT EXISTS idx_task_log_timestamp
                    ON ${this.tableName()} (timestamp)
                `);

                console.log("TaskLogService: 任务日志表初始化完成");
                return; // 成功则退出
            } catch (error: any) {
                // 检查是否是数据库未初始化错误（可能是字符串或Error对象）
                const errorStr = String(error);
                const errorMessage = error?.message || errorStr;
                const isDbNotInitialized = 
                    errorStr === "DBNotInitialized" || 
                    error === "DBNotInitialized" ||
                    errorMessage?.includes("DBNotInitialized") ||
                    errorMessage?.includes("Error invoking remote method 'db:execute': DBNotInitialized");
                
                if (isDbNotInitialized) {
                    if (i < maxRetries - 1) {
                        // 等待后重试
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    } else {
                        console.error("TaskLogService: 数据库初始化超时，请稍后重试");
                    }
                } else {
                    // 其他错误直接抛出
                    console.error("TaskLogService: 初始化任务日志表失败", error);
                    return;
                }
            }
        }
    },

    /**
     * 编码日志记录
     */
    encodeRecord(record: TaskLogRecord): TaskLogRecord {
        const encoded = {...record};
        if ("metadata" in encoded && encoded.metadata) {
            encoded.metadata = JSON.stringify(encoded.metadata);
        }
        return encoded;
    },

    /**
     * 解码日志记录
     */
    decodeRecord(record: TaskLogRecord): TaskLogRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            metadata: record.metadata ? JSON.parse(record.metadata as any) : null,
        } as TaskLogRecord;
    },

    /**
     * 添加任务日志
     */
    async addLog(log: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">): Promise<number> {
        const record: TaskLogRecord = {
            ...log,
            timestamp: log.timestamp || TimeUtil.timestampMS(),
            createdAt: TimeUtil.timestamp(),
        };

        const encoded = this.encodeRecord(record);

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

        const id = await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields.join(",")})
             VALUES (${placeholders})`,
            values
        );

        return id;
    },

    /**
     * 批量添加日志
     */
    async addLogs(logs: Omit<TaskLogRecord, "id" | "createdAt" | "timestamp">[]): Promise<void> {
        if (!logs || logs.length === 0) {
            return;
        }

        for (const log of logs) {
            await this.addLog(log);
        }
    },

    /**
     * 获取指定任务的所有日志
     */
    async getLogsByTaskId(taskId: number | string): Promise<TaskLogRecord[]> {
        const records: TaskLogRecord[] = await window.$mapi.db.select(
            `SELECT * FROM ${this.tableName()}
             WHERE taskId = ?
             ORDER BY timestamp ASC`,
            [taskId]
        );
        return records.map(this.decodeRecord).filter(r => r !== null) as TaskLogRecord[];
    },

    /**
     * 获取指定任务的最新N条日志
     */
    async getRecentLogs(taskId: number | string, limit: number = 50): Promise<TaskLogRecord[]> {
        const records: TaskLogRecord[] = await window.$mapi.db.select(
            `SELECT * FROM ${this.tableName()}
             WHERE taskId = ?
             ORDER BY timestamp DESC
             LIMIT ?`,
            [taskId, limit]
        );
        return records.map(this.decodeRecord).filter(r => r !== null).reverse() as TaskLogRecord[];
    },

    /**
     * 根据日志级别筛选日志
     */
    async getLogsByLevel(
        taskId: number | string,
        level: TaskLogLevel
    ): Promise<TaskLogRecord[]> {
        const records: TaskLogRecord[] = await window.$mapi.db.select(
            `SELECT * FROM ${this.tableName()}
             WHERE taskId = ? AND level = ?
             ORDER BY timestamp ASC`,
            [taskId, level]
        );
        return records.map(this.decodeRecord).filter(r => r !== null) as TaskLogRecord[];
    },

    /**
     * 删除指定任务的所有日志
     */
    async deleteLogsByTaskId(taskId: number | string): Promise<number> {
        return await window.$mapi.db.execute(
            `DELETE FROM ${this.tableName()}
             WHERE taskId = ?`,
            [taskId]
        );
    },

    /**
     * 删除指定时间之前的日志(清理旧日志)
     */
    async deleteOldLogs(beforeTimestamp: number): Promise<number> {
        return await window.$mapi.db.execute(
            `DELETE FROM ${this.tableName()}
             WHERE timestamp < ?`,
            [beforeTimestamp]
        );
    },

    /**
     * 获取任务的最新进度
     */
    async getLatestProgress(taskId: number | string): Promise<number | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT progress FROM ${this.tableName()}
             WHERE taskId = ? AND progress IS NOT NULL
             ORDER BY timestamp DESC
             LIMIT 1`,
            [taskId]
        );
        return record ? record.progress : null;
    },

    /**
     * 统计任务日志数量
     */
    async count(taskId?: number | string, level?: TaskLogLevel): Promise<number> {
        let sql = `SELECT COUNT(*) as cnt FROM ${this.tableName()}`;
        const params: any[] = [];
        const wheres: string[] = [];

        if (taskId !== undefined) {
            wheres.push("taskId = ?");
            params.push(taskId);
        }

        if (level) {
            wheres.push("level = ?");
            params.push(level);
        }

        if (wheres.length > 0) {
            sql += " WHERE " + wheres.join(" AND ");
        }

        const result = await window.$mapi.db.first(sql, params);
        return result ? result.cnt : 0;
    },
};
