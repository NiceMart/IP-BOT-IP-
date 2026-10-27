// 缓存工具类
interface CacheItem {
  value: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
}

export class CacheManager {
  private cache = new Map<string, CacheItem>();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupTimer: number | null = null;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 300000; // 5分钟
    this.startCleanupTimer();
  }

  // 设置缓存
  set(key: string, value: any, ttl?: number): void {
    // 检查是否超过最大缓存数
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    });
  }

  // 获取缓存
  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 更新命中次数
    item.hits++;
    return item.value;
  }

  // 删除缓存
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
  }

  // 获取缓存大小
  size(): number {
    return this.cache.size;
  }

  // 获取缓存统计
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    items: Array<{ key: string; hits: number; age: number; ttl: number }>;
  } {
    const items = Array.from(this.cache.entries()).map(([key, item]) => ({
      key,
      hits: item.hits,
      age: Date.now() - item.timestamp,
      ttl: item.ttl
    }));

    const totalHits = items.reduce((sum, item) => sum + item.hits, 0);
    const hitRate = totalHits > 0 ? totalHits / (totalHits + items.length) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      items
    };
  }

  // LRU淘汰策略
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 定期清理过期缓存
  private startCleanupTimer(): void {
    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  // 停止清理定时器
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// LRU缓存实现
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 50) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // 重新插入以更新顺序
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的项目
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// 内存缓存管理器
class MemoryCacheManager {
  private static instance: MemoryCacheManager;
  private caches = new Map<string, CacheManager>();

  static getInstance(): MemoryCacheManager {
    if (!MemoryCacheManager.instance) {
      MemoryCacheManager.instance = new MemoryCacheManager();
    }
    return MemoryCacheManager.instance;
  }

  // 获取或创建缓存实例
  getCache(name: string, options?: CacheOptions): CacheManager {
    if (!this.caches.has(name)) {
      this.caches.set(name, new CacheManager(options));
    }
    return this.caches.get(name)!;
  }

  // 清理所有缓存
  clearAll(): void {
    this.caches.forEach(cache => cache.clear());
    this.caches.clear();
  }

  // 获取所有缓存的统计信息
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }
}

// 导出单例
export const memoryCache = MemoryCacheManager.getInstance();

// 会话存储缓存
export class SessionStorageCache {
  private prefix: string;

  constructor(prefix = 'app_cache_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return this.prefix + key;
  }

  set(key: string, value: any, ttl?: number): void {
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || 3600000 // 默认1小时
    };
    sessionStorage.setItem(this.getKey(key), JSON.stringify(item));
  }

  get(key: string): any | null {
    const itemStr = sessionStorage.getItem(this.getKey(key));
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);

      // 检查是否过期
      if (Date.now() - item.timestamp > item.ttl) {
        sessionStorage.removeItem(this.getKey(key));
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    sessionStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// 本地存储缓存
export class LocalStorageCache {
  private prefix: string;

  constructor(prefix = 'app_cache_') {
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return this.prefix + key;
  }

  set(key: string, value: any, ttl?: number): void {
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || 86400000 // 默认24小时
    };
    localStorage.setItem(this.getKey(key), JSON.stringify(item));
  }

  get(key: string): any | null {
    const itemStr = localStorage.getItem(this.getKey(key));
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);

      // 检查是否过期
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(this.getKey(key));
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  delete(key: string): void {
    localStorage.removeItem(this.getKey(key));
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

// 缓存装饰器
export function cached(ttl?: number, keyGenerator?: (...args: any[]) => string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new CacheManager({ defaultTTL: ttl });

    descriptor.value = function (...args: any[]) {
      // 生成缓存键
      const cacheKey = keyGenerator
        ? keyGenerator(...args)
        : `${propertyKey}_${JSON.stringify(args)}`;

      // 尝试从缓存获取
      let result = cache.get(cacheKey);
      if (result === null) {
        // 执行原方法
        result = originalMethod.apply(this, args);
        // 缓存结果
        cache.set(cacheKey, result);
      }

      return result;
    };

    return descriptor;
  };
}

// 请求缓存装饰器
export function cachedRequest(cacheKey: string, ttl = 300000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new LRUCache<string, Promise<any>>(50);

    descriptor.value = async function (...args: any[]) {
      // 尝试从缓存获取
      let promise = cache.get(cacheKey);

      if (!promise) {
        // 创建新的请求 promise
        promise = originalMethod.apply(this, args)
          .finally(() => {
            // 请求完成后从缓存中删除（支持重复请求缓存）
            setTimeout(() => {
              cache.delete(cacheKey);
            }, ttl);
          });

        // 缓存 promise
        cache.set(cacheKey, promise);
      }

      return promise;
    };

    return descriptor;
  };
}

// 默认缓存实例
export const defaultCache = memoryCache.getCache('default');
export const templateCache = memoryCache.getCache('template', { maxSize: 50, defaultTTL: 600000 });
export const fontCache = memoryCache.getCache('font', { maxSize: 100, defaultTTL: 1800000 }); // 30分钟
export const imageCache = memoryCache.getCache('image', { maxSize: 30, defaultTTL: 3600000 }); // 1小时