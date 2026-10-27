<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {useTaskStore} from "../../store/modules/task";
import {computed} from "vue";

const taskStore = useTaskStore();

const props = defineProps({
    record: {
        type: Object as () => TaskRecord,
        required: true,
    },
});
const emit = defineEmits({
    update: () => true,
});

// 可以删除的任务状态：包括 running（允许强制删除卡住的任务）
const canDelete = computed(() => {
    const deletableStatuses = ['success', 'fail', 'queue', 'wait', 'running'];
    return deletableStatuses.includes(props.record.status || '');
});

const doDelete = async () => {
    const record = props.record;

    // 如果是 running 状态，提示可能会强制删除
    if (record.status === 'running') {
        const confirmed = await new Promise((resolve) => {
            Dialog.confirm(
                t("确定要删除这个运行中的任务吗？"),
                () => resolve(true),
                () => resolve(false)
            );
        });
        if (!confirmed) return;
    }

    // 对于任何状态的任务，都直接从 taskStore.records 中移除
    if (record.status === 'queue' || record.status === 'wait' || record.status === 'running') {
        // 从 taskStore.records 中移除该任务
        const index = taskStore.records.findIndex(r => r.id === record.id);
        if (index !== -1) {
            taskStore.records.splice(index, 1);
            // 同步到存储
            await taskStore.sync();
            Dialog.tipSuccess(t("任务已删除"));
            emit("update");
            return;
        }
    }

    Dialog.loadingOn(t("正在删除"));
    await sleep(500);
    await TaskService.delete(record);
    Dialog.loadingOff();
    emit("update");
};
</script>

<template>
    <a-tooltip :content="$t('删除')" mini>
        <a-button 
            class="mr-2" 
            :disabled="!canDelete" 
            @click="doDelete()"
        >
            <template #icon>
                <icon-delete />
            </template>
        </a-button>
    </a-tooltip>
</template>
