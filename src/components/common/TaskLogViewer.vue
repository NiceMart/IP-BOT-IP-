<template>
    <div class="task-log-viewer">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <h4 class="text-sm font-medium">{{ $t("任务日志") }}</h4>
                <a-badge :count="logs.length" :max-count="999" />
            </div>
            <div class="flex items-center gap-2">
                <!-- 日志级别筛选 -->
                <a-select v-model="filterLevel" size="mini" style="width: 100px" @change="onFilterChange">
                    <a-option value="all">{{ $t("全部") }}</a-option>
                    <a-option value="info">{{ $t("信息") }}</a-option>
                    <a-option value="warn">{{ $t("警告") }}</a-option>
                    <a-option value="error">{{ $t("错误") }}</a-option>
                    <a-option value="debug">{{ $t("调试") }}</a-option>
                </a-select>

                <!-- 刷新按钮 -->
                <a-button size="mini" @click="refresh">
                    <template #icon>
                        <icon-refresh :spin="loading" />
                    </template>
                </a-button>

                <!-- 清空日志按钮 -->
                <a-popconfirm
                    :content="$t('确认清空所有日志？')"
                    @ok="clearLogs"
                >
                    <a-button size="mini" type="outline" status="danger">
                        <template #icon>
                            <icon-delete />
                        </template>
                    </a-button>
                </a-popconfirm>

                <!-- 自动刷新开关 -->
                <a-tooltip :content="autoRefresh ? $t('关闭自动刷新') : $t('开启自动刷新')">
                    <a-switch
                        v-model="autoRefresh"
                        size="small"
                        @change="onAutoRefreshChange"
                    />
                </a-tooltip>
            </div>
        </div>

        <!-- 进度条 -->
        <div v-if="latestProgress !== null" class="mb-3">
            <a-progress
                :percent="latestProgress"
                :status="latestProgress === 100 ? 'success' : 'normal'"
            />
        </div>

        <!-- 日志列表 -->
        <div class="log-list bg-gray-900 rounded-lg p-3 text-xs font-mono" style="max-height: 400px; overflow-y: auto;">
            <div v-if="loading && logs.length === 0" class="text-center text-gray-400 py-4">
                <icon-loading class="animate-spin inline-block" />
                <span class="ml-2">{{ $t("加载中...") }}</span>
            </div>

            <div v-else-if="filteredLogs.length === 0" class="text-center text-gray-500 py-4">
                <icon-empty />
                <div class="mt-2">{{ $t("暂无日志") }}</div>
            </div>

            <div v-else>
                <div
                    v-for="(log, index) in filteredLogs"
                    :key="log.id || index"
                    class="log-item mb-2 pb-2 border-b border-gray-700 last:border-0"
                >
                    <div class="flex items-start gap-2">
                        <!-- 时间戳 -->
                        <span class="text-gray-500 whitespace-nowrap">
                            {{ formatTime(log.timestamp) }}
                        </span>

                        <!-- 日志级别 -->
                        <span
                            class="px-1.5 py-0.5 rounded text-white font-bold whitespace-nowrap"
                            :class="getLevelClass(log.level)"
                        >
                            {{ getLevelText(log.level) }}
                        </span>

                        <!-- 进程信息 -->
                        <span v-if="log.processName" class="text-blue-400 whitespace-nowrap">
                            [{{ log.processName }}]
                        </span>

                        <!-- 进度 -->
                        <span v-if="log.progress !== null && log.progress !== undefined" class="text-green-400 whitespace-nowrap">
                            {{ log.progress }}%
                        </span>

                        <!-- 日志消息 -->
                        <span
                            class="flex-1"
                            :class="{
                                'text-white': log.level === 'info',
                                'text-yellow-300': log.level === 'warn',
                                'text-red-300': log.level === 'error',
                                'text-gray-400': log.level === 'debug'
                            }"
                        >
                            {{ log.message }}
                        </span>
                    </div>

                    <!-- 文件路径 -->
                    <div v-if="log.processPath" class="text-gray-600 ml-2 mt-1 text-xs truncate">
                        {{ log.processPath }}
                    </div>

                    <!-- 元数据 -->
                    <div v-if="log.metadata" class="ml-2 mt-1">
                        <!-- 对于error和warn级别,默认展开元数据 -->
                        <div
                            v-if="log.level === 'error' || log.level === 'warn' || showMetadata"
                            class="bg-gray-800 rounded p-2 text-xs text-gray-300 overflow-x-auto"
                        >
                            <div v-if="typeof log.metadata === 'object'">
                                <div v-for="(value, key) in log.metadata" :key="key" class="mb-1">
                                    <span class="text-blue-300">{{ key }}:</span>
                                    <span class="ml-2" :class="{
                                        'text-red-300': String(key) === 'error',
                                        'text-yellow-300': String(key) === 'hint',
                                        'text-gray-300': String(key) !== 'error' && String(key) !== 'hint'
                                    }">
                                        {{ typeof value === 'object' ? JSON.stringify(value, null, 2) : value }}
                                    </span>
                                </div>
                            </div>
                            <pre v-else>{{ JSON.stringify(log.metadata, null, 2) }}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 统计信息 -->
        <div class="mt-2 flex items-center justify-between text-xs text-gray-500">
            <div>
                {{ $t("共") }} {{ filteredLogs.length }} {{ $t("条日志") }}
            </div>
            <div class="flex items-center gap-3">
                <span v-if="errorCount > 0" class="text-red-500">
                    <icon-exclamation-circle-fill /> {{ errorCount }} {{ $t("错误") }}
                </span>
                <span v-if="warnCount > 0" class="text-yellow-500">
                    <icon-exclamation-circle /> {{ warnCount }} {{ $t("警告") }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted, onBeforeUnmount, watch} from "vue";
import {TaskLogService, TaskLogRecord} from "../../service/TaskLogService";
import {Message} from "@arco-design/web-vue";

const props = defineProps<{
    taskId: number | string;
    autoRefresh?: boolean;
    refreshInterval?: number; // 自动刷新间隔(ms)
    showMetadata?: boolean;   // 是否显示元数据
}>();

const logs = ref<TaskLogRecord[]>([]);
const loading = ref(false);
const filterLevel = ref<string>("all");
const autoRefresh = ref(props.autoRefresh ?? true);
const latestProgress = ref<number | null>(null);

let refreshTimer: any = null;

// 过滤后的日志
const filteredLogs = computed(() => {
    if (filterLevel.value === "all") {
        return logs.value;
    }
    return logs.value.filter(log => log.level === filterLevel.value);
});

// 错误数量
const errorCount = computed(() => {
    return logs.value.filter(log => log.level === "error").length;
});

// 警告数量
const warnCount = computed(() => {
    return logs.value.filter(log => log.level === "warn").length;
});

// 获取日志级别样式类
const getLevelClass = (level: string) => {
    const classes = {
        info: "bg-blue-500",
        warn: "bg-yellow-500",
        error: "bg-red-500",
        debug: "bg-gray-500"
    };
    return classes[level] || "bg-gray-500";
};

// 获取日志级别文本
const getLevelText = (level: string) => {
    const texts = {
        info: "INFO",
        warn: "WARN",
        error: "ERROR",
        debug: "DEBUG"
    };
    return texts[level] || level.toUpperCase();
};

// 格式化时间
const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const ms = String(date.getMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${seconds}.${ms}`;
};

// 加载日志
const loadLogs = async () => {
    if (!props.taskId) return;

    loading.value = true;
    try {
        const result = await TaskLogService.getLogsByTaskId(props.taskId);
        logs.value = result;

        // 获取最新进度
        const progress = await TaskLogService.getLatestProgress(props.taskId);
        if (progress !== null) {
            latestProgress.value = progress;
        }
    } catch (error) {
        console.error("加载任务日志失败:", error);
        Message.error("加载任务日志失败");
    } finally {
        loading.value = false;
    }
};

// 刷新日志
const refresh = () => {
    loadLogs();
};

// 清空日志
const clearLogs = async () => {
    try {
        await TaskLogService.deleteLogsByTaskId(props.taskId);
        logs.value = [];
        Message.success("日志已清空");
    } catch (error) {
        console.error("清空日志失败:", error);
        Message.error("清空日志失败");
    }
};

// 筛选变化
const onFilterChange = () => {
    // 筛选变化时可以做一些额外操作
};

// 自动刷新开关变化
const onAutoRefreshChange = (value: boolean) => {
    if (value) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
};

// 启动自动刷新
const startAutoRefresh = () => {
    stopAutoRefresh(); // 先停止之前的定时器
    const interval = props.refreshInterval || 3000; // 默认3秒
    refreshTimer = setInterval(() => {
        loadLogs();
    }, interval);
};

// 停止自动刷新
const stopAutoRefresh = () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
};

// 监听taskId变化
watch(() => props.taskId, () => {
    logs.value = [];
    latestProgress.value = null;
    loadLogs();
});

onMounted(() => {
    loadLogs();
    if (autoRefresh.value) {
        startAutoRefresh();
    }
});

onBeforeUnmount(() => {
    stopAutoRefresh();
});
</script>

<style scoped>
.task-log-viewer {
    /* 自定义样式 */
}

.log-list::-webkit-scrollbar {
    width: 6px;
}

.log-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}

.log-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
}

.log-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}
</style>
