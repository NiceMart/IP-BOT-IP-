<script setup lang="ts">
import { onMounted, ref } from "vue";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import ToggleButton from "../../../components/common/ToggleButton.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { usePaginate } from "../../../hooks/paginate";
import { useTaskChangeRefresh } from "../../../hooks/task";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import { TaskChangeType } from "../../../store/modules/task";
import Steps from "../common/Steps.vue";
import SoundReplaceCreate from "./components/SoundReplaceCreate.vue";
import SoundReplaceItem from "./components/SoundReplaceItem.vue";

const {page, records, recordsForPage} = usePaginate<TaskRecord>({
    pageSize: 10,
});

useTaskChangeRefresh("SoundReplace", (
    bizId: string,
    type: TaskChangeType
) => {
    doRefresh();
});

const {
    mergeCheck,
    isIndeterminate,
    isAllChecked,
    onCheckAll,
    checkRecords,
} = useCheckAll({
    records: recordsForPage,
});

const stepsVisible = ref(false);

onMounted(async () => {
    await doRefresh();
});

const doRefresh = async () => {
    const rawRecords = await TaskService.list("SoundReplace");
    records.value = mergeCheck(rawRecords);
};
</script>

<template>
    <div class="p-5">
        <div class="app-header mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">声音替换</div>
                <div class="text-gray-400 ml-3">使用新声音替换已有视频的声音</div>
            </div>
            <ToggleButton v-model="stepsVisible"/>
        </div>
        <Steps v-if="stepsVisible" :steps="[
            {key: 1, label: '提取音频并识别', description: '选择包含需要替换声音的视频文件'},
            {key: 2, label: '确认文字', description: '检查并确认识别出的文本内容'},
            {key: 3, label: '声音合成替换', description: '设置声音合成模型参数，生成新的语音'},
        ]"/>
        <div>
            <SoundReplaceCreate @submitted="doRefresh"/>
            <div v-if="records.length > 0">
                <div class="rounded-xl shadow border p-4 mt-4 mb-4 hover:shadow-lg flex items-center">
                    <div class="flex-grow flex items-center">
                        <div class="mr-3">
                            <a-checkbox
                                :model-value="isAllChecked"
                                :indeterminate="isIndeterminate"
                                @change="onCheckAll">
                                全选
                            </a-checkbox>
                        </div>
                        <TaskBatchDeleteAction
                            :records="checkRecords"
                            @update="doRefresh"
                        />
                        <TaskBatchDownloadAction :records="checkRecords"/>
                    </div>
                    <div>
                        <a-pagination
                            v-model:current="page"
                            :total="records.length"
                            :page-size="10"
                            show-total
                            simple
                        />
                    </div>
                </div>
                <div v-for="r in recordsForPage" :key="r.id">
                    <SoundReplaceItem
                        :record="r"
                        :dialog="false"
                        :on-refresh="doRefresh"
                    />
                </div>
            </div>
            <m-empty v-else/>
        </div>
    </div>
</template>
