/**
 * 性能优化工具函数
 * 提供防抖、节流、请求缓存等工具函数
 */

/**
 * 防抖函数 - 延迟执行，在指定时间内重复调用会重置计时器
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * 节流函数 - 指定时间内只执行一次
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300
): (...args: Parameters<T>) => void {
    let lastTime = 0;

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}

/**
 * 简单请求缓存 - 用于缓存 API 请求结果
 */
interface CacheItem<T> {
    data: T;
    timestamp: number;
    expiresIn: number; // 过期时间（毫秒）
}

class RequestCache {
    private cache = new Map<string, CacheItem<any>>();

    /**
     * 获取缓存
     */
    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        // 检查是否过期
        if (Date.now() - item.timestamp > item.expiresIn) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    /**
     * 设置缓存
     */
    set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn,
        });
    }

    /**
     * 删除缓存
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * 带缓存的请求函数
     */
    async cachedRequest<T>(
        key: string,
        request: () => Promise<T>,
        expiresIn: number = 5 * 60 * 1000
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const data = await request();
        this.set(key, data, expiresIn);
        return data;
    }
}

export const requestCache = new RequestCache();

/**
 * 内存缓存（简单实现，适用于小数据）
 */
export class MemoryCache {
    private cache = new Map<string, { value: any; expire: number }>();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(autoCleanupInterval: number = 60000) {
        // 每分钟清理一次过期缓存
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, autoCleanupInterval);
    }

    set(key: string, value: any, ttl: number = 300000): void {
        this.cache.set(key, {
            value,
            expire: Date.now() + ttl,
        });
    }

    get<T>(key: string): T | undefined {
        const item = this.cache.get(key);
        if (!item) return undefined;

        if (Date.now() > item.expire) {
            this.cache.delete(key);
            return undefined;
        }

        return item.value as T;
    }

    has(key: string): boolean {
        const item = this.cache.get(key);
        if (!item) return false;

        if (Date.now() > item.expire) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expire) {
                this.cache.delete(key);
            }
        }
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

/**
 * 懒加载图片
 */
export function lazyLoadImage(img: HTMLImageElement, src: string): void {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        img.src = src;
                        obs.unobserve(img);
                    }
                });
            },
            { rootMargin: '50px' }
        );
        observer.observe(img);
    } else {
        img.src = src;
    }
}

/**
 * 批量懒加载图片
 */
export function lazyLoadImages(selector: string = 'img[data-src]'): void {
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target as HTMLImageElement;
                        img.src = img.dataset.src || '';
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            },
            { rootMargin: '50px' }
        );

        document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
            observer.observe(img);
        });
    }
}

/**
 * 性能监控工具
 */
export class PerformanceMonitor {
    private marks = new Map<string, number>();

    /**
     * 开始计时
     */
    start(label: string): void {
        this.marks.set(label, performance.now());
    }

    /**
     * 结束计时并返回耗时
     */
    end(label: string): number | null {
        const start = this.marks.get(label);
        if (!start) return null;

        const duration = performance.now() - start;
        this.marks.delete(label);
        return duration;
    }

    /**
     * 打印耗时
     */
    log(label: string): void {
        const duration = this.end(label);
        if (duration !== null) {
            console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * 测量函数执行时间
     */
    measure<T>(label: string, fn: () => T): T {
        this.start(label);
        const result = fn();
        this.log(label);
        return result;
    }

    /**
     * 测量异步函数执行时间
     */
    async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        this.start(label);
        const result = await fn();
        this.log(label);
        return result;
    }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * 长任务分割 - 将大任务拆分成小块执行，避免阻塞主线程
 */
export function splitTask<T>(
    items: T[],
    chunkSize: number = 100,
    processor: (chunk: T[]) => void | Promise<void>
): Promise<void> {
    return new Promise((resolve) => {
        let index = 0;

        const processNext = async () => {
            const chunk = items.slice(index, index + chunkSize);
            if (chunk.length === 0) {
                resolve();
                return;
            }

            await processor(chunk);
            index += chunkSize;

            // 使用 setTimeout 让出主线程
            setTimeout(processNext, 0);
        };

        processNext();
    });
}

/**
 * 虚拟滚动辅助 - 计算可视区域
 */
export function calculateVisibleRange(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number
): { start: number; end: number } {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 10;
    const end = Math.min(totalItems, start + visibleCount);

    return { start, end };
}
