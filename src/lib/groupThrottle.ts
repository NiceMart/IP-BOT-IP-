/**
 * 按key分组的throttle函数，支持leading和trailing调用。
 * @param fn 要限流的函数，第一个参数为key，后续为原函数参数
 * @param wait 等待时间（毫秒）
 * @param options 配置选项
 * @returns 包装后的函数，第一个参数为key，后续为原函数参数
 */
export function groupThrottle<T extends any[], R>(
  fn: (key: string, ...args: T) => R,
  wait: number,
  options?: { leading?: boolean; trailing?: boolean }
): (key: string, ...args: T) => R | undefined {
  const { leading = true, trailing = true } = options || {};
  const cache = new Map<
    string,
    {
      lastCall: number;
      timer: NodeJS.Timeout | null;
      lastArgs: T;
      lastThis: any;
      lastResult?: R;
      lastKey: string;
    }
  >();

  return function (this: any, key: string, ...args: T): R | undefined {
    const now = Date.now();
    let entry = cache.get(key);

    if (!entry) {
      entry = {
        lastCall: 0,
        timer: null,
        lastArgs: args,
        lastThis: this,
        lastKey: key,
      };
      cache.set(key, entry);
    }

    const remaining = wait - (now - entry.lastCall);

    // 如果是第一次调用或等待时间已过
    if (remaining <= 0 || entry.lastCall === 0) {
      if (leading) {
        // 清除之前的trailing定时器
        if (entry.timer) {
          clearTimeout(entry.timer);
          entry.timer = null;
        }
        // 执行函数
        const result = fn.apply(this, [key, ...args]);
        entry.lastCall = now;
        entry.lastKey = key;
        entry.lastArgs = args;
        entry.lastThis = this;
        entry.lastResult = result;
        return result;
      } else {
        entry.lastCall = now;
      }
    }

    // 设置trailing调用
    if (trailing && !entry.timer) {
      entry.timer = setTimeout(() => {
        const result = fn.apply(entry!.lastThis, [entry!.lastKey, ...entry!.lastArgs]);
        // 执行后清理缓存，避免内存泄漏
        cache.delete(key);
      }, remaining > 0 ? remaining : wait);
    }

    // 返回上次的结果（如果是leading调用）
    return entry.lastResult;
  };
}

