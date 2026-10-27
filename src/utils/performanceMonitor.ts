// 性能监控工具
// @ts-nocheck
interface MetricData {
  timestamp: number;
  duration?: number;
  value?: number;
  type: 'duration' | 'value';
  tags?: Record<string, string>;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics = new Map<string, MetricData[]>();
  private observers: PerformanceObserver[] = [];
  private isRecording = false;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 开始性能监控
  start(): void {
    if (this.isRecording) return;

    this.isRecording = true;

    // 监控长任务
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long-task', entry.duration, {
              name: entry.name,
              startTime: entry.startTime.toString()
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('Long task observation not supported');
      }

      // 监控导航性能
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('page-load', navEntry.loadEventEnd - navEntry.loadEventStart);
            this.recordMetric('dom-interactive', navEntry.domInteractive - navEntry.navigationStart);
            this.recordMetric('first-contentful-paint', navEntry.loadEventStart - navEntry.navigationStart);
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation observation not supported');
      }

      // 监控资源加载
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.recordMetric('resource-load', resourceEntry.responseEnd - resourceEntry.requestStart, {
              url: resourceEntry.name,
              type: this.getResourceType(resourceEntry.name)
            });
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource observation not supported');
      }
    }

    // 监控内存使用（Chrome only）
    if ('memory' in performance) {
      setInterval(() => {
        const mem = (performance as any).memory;
        this.recordMetric('memory-used', mem.usedJSHeapSize);
        this.recordMetric('memory-total', mem.totalJSHeapSize);
        this.recordMetric('memory-limit', mem.jsHeapSizeLimit);
      }, 5000);
    }
  }

  // 停止性能监控
  stop(): void {
    this.isRecording = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  // 记录性能指标
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isRecording) return;

    const metric: MetricData = {
      timestamp: Date.now(),
      value,
      type: 'value',
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // 保留最近100条记录
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // 测量函数执行时间
  measure<T>(name: string, fn: () => T, tags?: Record<string, string>): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.recordMetric(name, duration, tags);

    return result;
  }

  // 异步测量
  async measureAsync<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.recordMetric(name, duration, tags);

    return result;
  }

  // 获取指标统计
  getMetricStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const values = metrics.map(m => m.value || 0).sort((a, b) => a - b);
    const count = values.length;

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: values.reduce((sum, v) => sum + v, 0) / count,
      p50: values[Math.floor(count * 0.5)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)]
    };
  }

  // 获取所有指标名称
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // 清理指标
  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  // 获取资源类型
  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    return 'other';
  }

  // 生成性能报告
  generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: Date.now(),
      metrics: {},
      summary: {
        totalMetrics: this.metrics.size,
        longTaskCount: 0,
        averageLoadTime: 0,
        memoryUsage: 0
      }
    };

    // 收集所有指标
    for (const [name] of this.metrics) {
      const stats = this.getMetricStats(name);
      if (stats) {
        report.metrics[name] = stats;

        // 更新摘要
        if (name === 'long-task') {
          report.summary.longTaskCount = stats.count;
        } else if (name === 'page-load') {
          report.summary.averageLoadTime = stats.avg;
        } else if (name === 'memory-used') {
          report.summary.memoryUsage = stats.avg;
        }
      }
    }

    return report;
  }
}

interface PerformanceReport {
  timestamp: number;
  metrics: Record<string, any>;
  summary: {
    totalMetrics: number;
    longTaskCount: number;
    averageLoadTime: number;
    memoryUsage: number;
  };
}

// Vue 组件性能监控装饰器
export function performanceTrack(name?: string, trackProps = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const monitor = PerformanceMonitor.getInstance();

    descriptor.value = function (...args: any[]) {
      const componentName = name || target.constructor.name;
      const methodName = propertyKey;
      const metricName = `${componentName}.${methodName}`;

      return monitor.measure(metricName, () => {
        return originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}

// Vue 性能监控 Hook
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();

  const trackOperation = <T>(
    operationName: string,
    operation: () => T,
    tags?: Record<string, string>
  ): T => {
    return monitor.measure(
      `${componentName}.${operationName}`,
      operation,
      { ...tags, component: componentName }
    );
  };

  const trackAsyncOperation = async <T>(
    operationName: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> => {
    return monitor.measureAsync(
      `${componentName}.${operationName}`,
      operation,
      { ...tags, component: componentName }
    );
  };

  const recordMetric = (metricName: string, value: number, tags?: Record<string, string>) => {
    monitor.recordMetric(
      `${componentName}.${metricName}`,
      value,
      { ...tags, component: componentName }
    );
  };

  return {
    trackOperation,
    trackAsyncOperation,
    recordMetric,
    getStats: (operationName: string) => monitor.getMetricStats(`${componentName}.${operationName}`),
    getComponentStats: () => {
      const allStats: Record<string, any> = {};
      monitor.getMetricNames().forEach(name => {
        if (name.startsWith(componentName)) {
          const stats = monitor.getMetricStats(name);
          if (stats) {
            allStats[name] = stats;
          }
        }
      });
      return allStats;
    }
  };
}

// 性能警告工具
export class PerformanceWarning {
  private static warnings = new Map<string, number>();

  // 设置警告阈值
  static setThreshold(metricName: string, thresholdMs: number): void {
    this.warnings.set(metricName, thresholdMs);
  }

  // 检查性能警告
  static check(metricName: string, duration: number): void {
    const threshold = this.warnings.get(metricName);
    if (threshold && duration > threshold) {
      console.warn(
        `⚠️ Performance Warning: ${metricName} took ${duration.toFixed(2)}ms ` +
        `(threshold: ${threshold}ms)`
      );
    }
  }

  // 自动装饰器，添加性能警告
  static warnIfSlow(thresholdMs: number, name?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const metricName = name || `${target.constructor.name}.${propertyKey}`;

      PerformanceWarning.setThreshold(metricName, thresholdMs);

      descriptor.value = function (...args: any[]) {
        const start = performance.now();
        const result = originalMethod.apply(this, args);
        const duration = performance.now() - start;

        PerformanceWarning.check(metricName, duration);

        return result;
      };

      return descriptor;
    };
  }
}

// 默认阈值设置
PerformanceWarning.setThreshold('component-render', 16); // 60fps
PerformanceWarning.setThreshold('api-request', 1000); // 1秒
PerformanceWarning.setThreshold('data-processing', 100); // 100ms

// 导出单例
export const performanceMonitor = PerformanceMonitor.getInstance();
