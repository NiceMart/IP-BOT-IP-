<template>
    <a-button
        size="mini"
        type="text"
        @click="showLogModal"
    >
        <template #icon>
            <icon-file-audio />
        </template>
        {{ $t("日志") }}
    </a-button>

    <a-modal
        v-model:visible="visible"
        :title="$t('任务日志') + ' - ' + (record.title || 'Task #' + record.id)"
        width="80%"
        :footer="false"
        @cancel="visible = false"
    >
        <div style="max-height: 70vh; overflow-y: auto;">
            <TaskLogViewer
                v-if="visible"
                :taskId="record.id"
                :autoRefresh="isTaskRunning"
                :refreshInterval="2000"
            />
        </div>
    </a-modal>
</template>

<script setup lang="ts">
import {ref, computed} from "vue";
import TaskLogViewer from "./TaskLogViewer.vue";
import {TaskRecord} from "../../service/TaskService";

const props = defineProps<{
    record: TaskRecord;
}>();

const visible = ref(false);

// 判断任务是否正在运行
const isTaskRunning = computed(() => {
    return props.record.status === "running" ||
           props.record.status === "queue" ||
           props.record.status === "wait";
});

const showLogModal = () => {
    visible.value = true;
};
</script>

<style scoped>
/* 自定义样式 */
</style>
