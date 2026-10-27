/**
 * 日志管理工具
 * 用于控制台日志的开关和管理，防止日志过多导致性能问题
 */

// 从环境变量或配置中获取日志级别
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// 日志级别
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

// 默认配置：生产环境只显示错误，开发环境显示所有
const DEFAULT_LOG_LEVEL = isProduction ? LogLevel.ERROR : LogLevel.DEBUG;

class Logger {
    private level: LogLevel = DEFAULT_LOG_LEVEL;
    private enabled: boolean = true;

    // 最大日志缓存数量，防止内存泄漏
    private maxCacheSize: number = 1000;
    private cache: Array<{time: number, level: string, args: any[]}> = [];

    constructor() {
        // 生产环境默认关闭日志
        if (isProduction) {
            this.enabled = false;
        }

        // 从localStorage读取用户设置
        this.loadSettings();
    }

    private loadSettings() {
        try {
            const savedLevel = localStorage.getItem('log_level');
            const savedEnabled = localStorage.getItem('log_enabled');

            if (savedLevel !== null) {
                this.level = parseInt(savedLevel);
            }
            if (savedEnabled !== null) {
                this.enabled = savedEnabled === 'true';
            }
        } catch (e) {
            // localStorage可能被禁用
        }
    }

    /**
     * 设置日志级别
     */
    setLevel(level: LogLevel) {
        this.level = level;
        try {
            localStorage.setItem('log_level', level.toString());
        } catch (e) {
            // ignore
        }
    }

    /**
     * 启用/禁用日志
     */
    setEnabled(enabled: boolean) {
        this.enabled = enabled;
        try {
            localStorage.setItem('log_enabled', enabled.toString());
        } catch (e) {
            // ignore
        }
    }

    /**
     * 获取当前日志级别
     */
    getLevel(): LogLevel {
        return this.level;
    }

    /**
     * 判断是否启用
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    private addToCache(level: string, args: any[]) {
        if (this.cache.length >= this.maxCacheSize) {
            // 移除最早的日志
            this.cache.shift();
        }
        this.cache.push({
            time: Date.now(),
            level,
            args: [...args]
        });
    }

    /**
     * 获取缓存的日志
     */
    getCache() {
        return this.cache;
    }

    /**
     * 清空日志缓存
     */
    clearCache() {
        this.cache = [];
    }

    /**
     * Debug级别日志
     */
    debug(...args: any[]) {
        if (!this.enabled || this.level > LogLevel.DEBUG) return;
        console.log('[DEBUG]', ...args);
        this.addToCache('DEBUG', args);
    }

    /**
     * Info级别日志
     */
    info(...args: any[]) {
        if (!this.enabled || this.level > LogLevel.INFO) return;
        console.info('[INFO]', ...args);
        this.addToCache('INFO', args);
    }

    /**
     * Log级别日志（等同于info）
     */
    log(...args: any[]) {
        this.info(...args);
    }

    /**
     * Warn级别日志
     */
    warn(...args: any[]) {
        if (!this.enabled || this.level > LogLevel.WARN) return;
        console.warn('[WARN]', ...args);
        this.addToCache('WARN', args);
    }

    /**
     * Error级别日志
     */
    error(...args: any[]) {
        if (!this.enabled || this.level > LogLevel.ERROR) return;
        console.error('[ERROR]', ...args);
        this.addToCache('ERROR', args);
    }

    /**
     * 分组开始
     */
    group(...args: any[]) {
        if (!this.enabled || this.level > LogLevel.DEBUG) return;
        console.group(...args);
    }

    /**
     * 分组结束
     */
    groupEnd() {
        if (!this.enabled || this.level > LogLevel.DEBUG) return;
        console.groupEnd();
    }
}

// 导出单例
export const logger = new Logger();

// 导出便捷方法
export const log = logger.log.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const group = logger.group.bind(logger);
export const groupEnd = logger.groupEnd.bind(logger);

// 导出到window对象，方便在控制台中调试
if (typeof window !== 'undefined') {
    (window as any).__logger = logger;
    (window as any).__enableLog = () => logger.setEnabled(true);
    (window as any).__disableLog = () => logger.setEnabled(false);
    (window as any).__setLogLevel = (level: LogLevel) => logger.setLevel(level);
}
