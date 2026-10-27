// @ts-nocheck
import { ref, shallowRef, reactive, shallowReactive, markRaw, readonly, watch, onBeforeUnmount, type ReadonlyRef } from 'vue';
import { isObject, isArray } from 'lodash-es';

// 响应式优化工具类
export class ReactiveOptimization {
  // 为大型对象创建浅层响应式
  static createShallowReactive<T extends object>(obj: T): T {
    return shallowReactive(obj) as T;
  }

  // 为大型数据创建浅层ref
  static createShallowRef<T>(initialValue: T) {
    return shallowRef(initialValue);
  }

  // 标记不需要响应式的数据
  static markNonReactive<T>(obj: T): T {
    return markRaw(obj) as T;
  }

  // 智能选择响应式策略
  static smartReactive<T>(data: T, options?: {
    deep?: boolean;        // 是否深度响应式
    readonly?: boolean;    // 是否只读
    markRaw?: boolean;     // 是否标记为原始数据
  }) {
    const { deep = true, readonly: isReadonly = false, markRaw: shouldMarkRaw = false } = options || {};

    // 如果不是对象，直接返回
    if (!isObject(data) || data === null) {
      return data;
    }

    // 如果要求标记为原始数据
    if (shouldMarkRaw) {
      return markRaw(data);
    }

    // 根据大小和类型选择策略
    const size = this.estimateSize(data);

    if (size > 10000) { // 大对象使用浅层响应式
      const reactive = deep ? reactive(data) : shallowReactive(data);
      return isReadonly ? readonly(reactive) : reactive;
    } else if (size > 1000) { // 中等对象考虑策略
      if (deep && !isArray(data)) {
        const reactiveObj = reactive(data);
        return isReadonly ? readonly(reactiveObj) : reactiveObj;
      } else {
        const refObj = deep ? ref(data) : shallowRef(data);
        return refObj;
      }
    } else { // 小对象正常处理
      const reactive = deep ? reactive(data) : shallowReactive(data);
      return isReadonly ? readonly(reactive) : reactive;
    }
  }

  // 估算对象大小（字节）
  private static estimateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;

    if (typeof obj === 'string') {
      return obj.length * 2; // UTF-16 编码
    }

    if (typeof obj === 'number') {
      return 8; // 64位数字
    }

    if (typeof obj === 'boolean') {
      return 4;
    }

    if (isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.estimateSize(item), 0) + 24; // 数组开销
    }

    if (isObject(obj)) {
      return Object.entries(obj).reduce((sum, [key, value]) => {
        return sum + key.length * 2 + this.estimateSize(value);
      }, 0) + 24; // 对象开销
    }

    return 0;
  }

  // 批量优化响应式数据
  static batchOptimize<T extends Record<string, any>>(
    data: T,
    config?: {
      [K in keyof T]?: {
        deep?: boolean;
        readonly?: boolean;
        markRaw?: boolean;
      };
    }
  ): T {
    const result = {} as T;

    for (const [key, value] of Object.entries(data)) {
      const options = config?.[key as keyof T];
      result[key as keyof T] = this.smartReactive(value, options);
    }

    return result;
  }
}

// 响应式数据 Hook
export function useOptimizedReactive<T extends object>(
  initialValue: T,
  options?: {
    deep?: boolean;
    onDeepAccess?: (path: string) => void;
  }
) {
  const { deep = true, onDeepAccess } = options || {};

  // 创建浅层响应式对象
  const state = shallowReactive(initialValue);

  // 代理深度访问
  const proxy = new Proxy(state, {
    get(target, prop) {
      const value = target[prop as keyof T];

      // 深度访问时的处理
      if (deep && isObject(value) && !value.hasOwnProperty('__v_skip')) {
        onDeepAccess?.(String(prop));
        return reactive(value);
      }

      return value;
    },
    set(target, prop, value) {
      target[prop as keyof T] = value;
      return true;
    }
  });

  return proxy as T;
}

// 缓存优化的 ref
export function useCachedRef<T>(initialValue: T, cacheKey?: string) {
  // 尝试从缓存恢复
  if (cacheKey) {
    const cached = sessionStorage.getItem(`ref_cache_${cacheKey}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        initialValue = parsed.value;
      } catch (e) {
        console.warn('Failed to parse cached ref:', e);
      }
    }
  }

  const refValue = ref(initialValue);

  // 保存到缓存
  const saveToCache = () => {
    if (cacheKey) {
      sessionStorage.setItem(
        `ref_cache_${cacheKey}`,
        JSON.stringify({ value: refValue.value, timestamp: Date.now() })
      );
    }
  };

  // 监听变化
  const unwatch = watch(refValue, saveToCache, { deep: true });

  // 清理函数
  const cleanup = () => {
    unwatch();
    if (cacheKey) {
      sessionStorage.removeItem(`ref_cache_${cacheKey}`);
    }
  };

  return {
    ref: refValue,
    saveToCache,
    cleanup
  };
}

// 防抖的响应式更新
export function useDebouncedReactive<T extends object>(
  initialValue: T,
  delay = 300
) {
  const state = reactive(initialValue);
  const pendingUpdates = new Set<() => void>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const scheduleUpdate = (updateFn: () => void) => {
    pendingUpdates.add(updateFn);

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      pendingUpdates.forEach(fn => fn());
      pendingUpdates.clear();
      timeoutId = null;
    }, delay);
  };

  const updateState = (updater: (state: T) => void) => {
    scheduleUpdate(() => updater(state));
  };

  onBeforeUnmount(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });

  return {
    state: readonly(state) as T,
    updateState
  };
}

// 性能监控的响应式
export function useMonitoredReactive<T extends object>(
  initialValue: T,
  name = 'Reactive'
) {
  const state = reactive(initialValue);
  const accessCount = ref(0);
  const updateCount = ref(0);

  return new Proxy(state, {
    get(target, prop) {
      accessCount.value++;
      if (accessCount.value % 100 === 0) {
        console.log(`[${name}] Access count: ${accessCount.value}`);
      }
      return target[prop as keyof T];
    },
    set(target, prop, value) {
      updateCount.value++;
      if (updateCount.value % 10 === 0) {
        console.log(`[${name}] Update count: ${updateCount.value}`);
      }
      target[prop as keyof T] = value;
      return true;
    }
  }) as T & {
    _metrics: {
      accessCount: ReadonlyRef<number>;
      updateCount: ReadonlyRef<number>;
    };
  };
}
