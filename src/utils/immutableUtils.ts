// @ts-nocheck
import { produce, immerable, Draft } from 'immer';
import { cloneDeep } from 'lodash-es';

// 深拷贝优化工具
export class ImmutableUtils {
  // 使用 immer 进行深拷贝（推荐，性能更好）
  static deepClone<T>(obj: T): T {
    return produce(obj, draft => draft);
  }

  // 使用 immer 进行带更新的深拷贝
  static deepCloneWithUpdate<T>(
    obj: T,
    updater: (draft: Draft<T>) => void | T
  ): T {
    return produce(obj, updater);
  }

  // 对于简单对象，使用结构化克隆（更快）
  static fastClone<T>(obj: T): T {
    try {
      return structuredClone(obj);
    } catch (error) {
      // 降级到 immer
      return this.deepClone(obj);
    }
  }

  // 对于大型对象，使用 lodash 的 cloneDeep
  static safeClone<T>(obj: T): T {
    try {
      return cloneDeep(obj);
    } catch (error) {
      // 最后的降级方案
      return JSON.parse(JSON.stringify(obj));
    }
  }

  // 创建不可变对象
  static freeze<T>(obj: T): Readonly<T> {
    return Object.freeze(this.deepClone(obj));
  }

  // 批量更新（减少重复的深拷贝）
  static batchUpdate<T>(
    obj: T,
    updates: Array<(draft: Draft<T>) => void>
  ): T {
    return produce(obj, draft => {
      updates.forEach(update => update(draft));
    });
  }

  // 带缓存的深拷贝
  private static cloneCache = new WeakMap<any, any>();

  static cachedClone<T>(obj: T): T {
    if (this.cloneCache.has(obj)) {
      return this.cloneCache.get(obj);
    }

    const cloned = this.deepClone(obj);
    this.cloneCache.set(obj, cloned);

    // 清理缓存（避免内存泄漏）
    setTimeout(() => {
      this.cloneCache.delete(obj);
    }, 5000); // 5秒后清理

    return cloned;
  }
}

// React/Vue 专用 Hook
export function useImmutable<T>(initialValue: T) {
  const ref = { current: ImmutableUtils.deepClone(initialValue) };

  const setValue = (updater: T | ((draft: Draft<T>) => void)) => {
    if (typeof updater === 'function') {
      ref.current = produce(ref.current, updater as any);
    } else {
      ref.current = ImmutableUtils.deepClone(updater);
    }
  };

  return [ref.current, setValue] as const;
}

// 导出标记，用于标识可以优化的类
// export { immerable }; // 从immer导出

// 性能对比工具
export class ClonePerformanceTester {
  static test<T>(obj: T, iterations = 1000) {
    const results = {
      structuredClone: 0,
      immer: 0,
      lodash: 0,
      json: 0
    };

    // 测试 structuredClone
    const start1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        structuredClone(obj);
      } catch (e) {}
    }
    results.structuredClone = performance.now() - start1;

    // 测试 immer
    const start2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      ImmutableUtils.deepClone(obj);
    }
    results.immer = performance.now() - start2;

    // 测试 lodash
    const start3 = performance.now();
    for (let i = 0; i < iterations; i++) {
      cloneDeep(obj);
    }
    results.lodash = performance.now() - start3;

    // 测试 JSON
    const start4 = performance.now();
    for (let i = 0; i < iterations; i++) {
      JSON.parse(JSON.stringify(obj));
    }
    results.json = performance.now() - start4;

    return results;
  }
}
