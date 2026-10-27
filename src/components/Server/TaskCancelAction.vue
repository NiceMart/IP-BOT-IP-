<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {computed} from "vue";
import {useTaskStore} from "../../store/modules/task";

const taskStore = useTaskStore();

const props = defineProps<{
    record: TaskRecord;
}>();

const emit = defineEmits<{
    update: [];
}>();

const doCancel = async () => {
    const record = props.record;
    Dialog.loadingOn(t("正在取消任务"));
    try {
        taskStore.requestCancel(record.biz, record.id as any);
        await sleep(1000);

        // 🔧 确保数据库中的任务状态已更新，然后刷新UI
        const updatedRecord = await TaskService.get(record.id as number);
        if (updatedRecord && updatedRecord.status === 'fail') {
            Dialog.loadingOff();
            Dialog.tipSuccess(t("任务已成功取消"));
            emit('update');
        } else {
            Dialog.loadingOff();
            Dialog.tipSuccess(t("已发送停止请求，请等待运行停止"));
            // 等待一段时间后再刷新，给数据库足够的时间
            setTimeout(() => {
                emit('update');
            }, 2000);
        }
    } catch (e) {
        Dialog.loadingOff();
        Dialog.tipError(t("取消任务失败"));
    }
};
const isCloud = computed(() => {
    return props.record.serverName.startsWith("Cloud");
});
</script>

<template>
    <a-tooltip v-if="!isCloud && (record.status === 'running' || record.status === 'queue')" :content="$t('取消任务')" mini>
        <a-button class="mr-2" type="primary" status="danger" @click="doCancel()">
            <template #icon>
                <icon-record-stop/>
            </template>
        </a-button>
    </a-tooltip>
</template>
