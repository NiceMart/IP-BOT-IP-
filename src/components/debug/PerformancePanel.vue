<template>
  <div class="performance-panel">
    <a-card title="性能监控面板" :bordered="false">
      <template #extra>
        <a-space>
          <a-switch
            v-model="isMonitoring"
            @change="toggleMonitoring"
          >
            {{ isMonitoring ? '监控中' : '已停止' }}
          </a-switch>
          <a-button size="small" @click="generateReport">
            生成报告
          </a-button>
          <a-button size="small" @click="clearMetrics">
            清理数据
          </a-button>
        </a-space>
      </template>

      <!-- 性能概览 -->
      <a-row :gutter="16" class="mb-4">
        <a-col :span="6">
          <a-statistic
            title="平均加载时间"
            :value="summaryStats.averageLoadTime"
            suffix="ms"
            :value-style="{ color: '#3f8600' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="长任务数量"
            :value="summaryStats.longTaskCount"
            :value-style="{ color: summaryStats.longTaskCount > 5 ? '#cf1322' : '#3f8600' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="内存使用"
            :value="formatBytes(summaryStats.memoryUsage)"
            :value-style="{ color: '#1890ff' }"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic
            title="监控指标数"
            :value="summaryStats.totalMetrics"
            :value-style="{ color: '#722ed1' }"
          />
        </a-col>
      </a-row>

      <!-- 性能图表 -->
      <a-tabs v-model:active-key="activeTab">
        <!-- 组件性能 -->
        <a-tab-pane key="components" title="组件性能">
          <a-table
            :columns="componentColumns"
            :data="componentMetrics"
            :pagination="{ pageSize: 10 }"
            size="small"
          >
            <template #renderTime="{ record }">
              <span
                :style="{
                  color: record.avg > 16 ? '#cf1322' : record.avg > 8 ? '#fa8c16' : '#3f8600'
                }"
              >
                {{ record.avg.toFixed(2) }}ms
              </span>
            </template>
            <template #p95="{ record }">
              {{ record.p95.toFixed(2) }}ms
            </template>
          </a-table>
        </a-tab-pane>

        <!-- API性能 -->
        <a-tab-pane key="api" title="API性能">
          <a-table
            :columns="apiColumns"
            :data="apiMetrics"
            :pagination="{ pageSize: 10 }"
            size="small"
          >
            <template #avgTime="{ record }">
              <span
                :style="{
                  color: record.avg > 1000 ? '#cf1322' : record.avg > 500 ? '#fa8c16' : '#3f8600'
                }"
              >
                {{ record.avg.toFixed(2) }}ms
              </span>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 内存使用 -->
        <a-tab-pane key="memory" title="内存使用">
          <div class="memory-chart">
            <canvas ref="memoryChartRef" width="600" height="300"></canvas>
          </div>
        </a-tab-pane>

        <!-- 长任务 -->
        <a-tab-pane key="longtasks" title="长任务">
          <a-table
            :columns="longTaskColumns"
            :data="longTaskMetrics"
            :pagination="{ pageSize: 10 }"
            size="small"
          >
            <template #duration="{ record }">
              <span style="color: #cf1322">
                {{ record.avg.toFixed(2) }}ms
              </span>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 性能报告对话框 -->
    <a-modal
      v-model:visible="reportVisible"
      title="性能报告"
      width="800px"
      :footer="false"
    >
      <pre class="report-content">{{ reportContent }}</pre>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { performanceMonitor, PerformanceWarning } from '../../utils/performanceMonitor';
import { usePerformanceMonitor } from '../../utils/performanceMonitor';

// 响应式数据
const isMonitoring = ref(false);
const activeTab = ref('components');
const reportVisible = ref(false);
const reportContent = ref('');
const memoryChartRef = ref<HTMLCanvasElement>();

// 性能统计
const summaryStats = reactive({
  totalMetrics: 0,
  longTaskCount: 0,
  averageLoadTime: 0,
  memoryUsage: 0
});

// 表格列定义
const componentColumns = [
  { title: '组件', dataIndex: 'name', key: 'name' },
  { title: '调用次数', dataIndex: 'count', key: 'count' },
  { title: '平均时间', dataIndex: 'avg', key: 'avg', slotName: 'renderTime' },
  { title: '最大时间', dataIndex: 'max', key: 'max' },
  { title: 'P95', dataIndex: 'p95', key: 'p95', slotName: 'p95' },
  { title: 'P99', dataIndex: 'p99', key: 'p99' }
];

const apiColumns = [
  { title: 'API', dataIndex: 'name', key: 'name' },
  { title: '调用次数', dataIndex: 'count', key: 'count' },
  { title: '平均时间', dataIndex: 'avg', key: 'avg', slotName: 'avgTime' },
  { title: '最大时间', dataIndex: 'max', key: 'max' },
  { title: '成功率', dataIndex: 'successRate', key: 'successRate' }
];

const longTaskColumns = [
  { title: '任务类型', dataIndex: 'name', key: 'name' },
  { title: '次数', dataIndex: 'count', key: 'count' },
  { title: '平均耗时', dataIndex: 'avg', key: 'avg', slotName: 'duration' },
  { title: '最大耗时', dataIndex: 'max', key: 'max' }
];

// 计算属性
const componentMetrics = computed(() => {
  const metrics = performanceMonitor.getMetricNames()
    .filter(name => name.includes('render') || name.includes('update'))
    .map(name => {
      const stats = performanceMonitor.getMetricStats(name);
      if (!stats) return null;

      return {
        key: name,
        name: name.split('.').pop() || name,
        ...stats
      };
    })
    .filter(Boolean);

  return metrics.sort((a: any, b: any) => b.avg - a.avg);
});

const apiMetrics = computed(() => {
  const metrics = performanceMonitor.getMetricNames()
    .filter(name => name.includes('api') || name.includes('request'))
    .map(name => {
      const stats = performanceMonitor.getMetricStats(name);
      if (!stats) return null;

      return {
        key: name,
        name: name.split('.').pop() || name,
        ...stats,
        successRate: Math.random() * 20 + 80 // 模拟成功率
      };
    })
    .filter(Boolean);

  return metrics.sort((a: any, b: any) => b.avg - a.avg);
});

const longTaskMetrics = computed(() => {
  const stats = performanceMonitor.getMetricStats('long-task');
  if (!stats) return [];

  return [{
    key: 'long-task',
    name: 'Long Task (>50ms)',
    ...stats
  }];
});

// 方法定义
const toggleMonitoring = (value: boolean) => {
  if (value) {
    performanceMonitor.start();
  } else {
    performanceMonitor.stop();
  }
  updateStats();
};

const updateStats = () => {
  const report = performanceMonitor.generateReport();
  Object.assign(summaryStats, report.summary);
};

const generateReport = () => {
  const report = performanceMonitor.generateReport();
  reportContent.value = JSON.stringify(report, null, 2);
  reportVisible.value = true;
};

const clearMetrics = () => {
  performanceMonitor.clearMetrics();
  updateStats();
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const drawMemoryChart = () => {
  if (!memoryChartRef.value) return;

  const ctx = memoryChartRef.value.getContext('2d');
  if (!ctx) return;

  const width = memoryChartRef.value.width;
  const height = memoryChartRef.value.height;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 获取内存数据
  const memoryStats = performanceMonitor.getMetricStats('memory-used');
  if (!memoryStats) return;

  // 绘制简单的柱状图
  ctx.fillStyle = '#1890ff';
  ctx.fillRect(50, height - 100, 100, 80);

  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.fillText('内存使用', 50, height - 10);
};

// 监听数据变化，更新图表
watch(summaryStats, () => {
  nextTick(() => {
    drawMemoryChart();
  });
});

// 生命周期
onMounted(() => {
  isMonitoring.value = true;
  performanceMonitor.start();
  updateStats();

  // 定期更新统计
  const timer = setInterval(updateStats, 5000);

  onBeforeUnmount(() => {
    clearInterval(timer);
    if (isMonitoring.value) {
      performanceMonitor.stop();
    }
  });
});
</script>

<style scoped>
.performance-panel {
  padding: 20px;
}

.mb-4 {
  margin-bottom: 16px;
}

.memory-chart {
  margin-top: 20px;
  text-align: center;
}

.memory-chart canvas {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.report-content {
  max-height: 60vh;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
