<script setup lang="ts">
// @ts-nocheck
import {onMounted, onBeforeUnmount, ref} from "vue";
import AudioPlayer from "../../components/common/AudioPlayer.vue";
import {useCheckAll} from "../../components/common/check-all";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../components/Server/TaskTitleField.vue";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {usePaginate} from "../../hooks/paginate";
import {useTaskChangeRefresh} from "../../hooks/task";
import {useTaskStore} from "../../store/modules/task";
import VideoAsrCreate from "./components/VideoAsrCreate.vue";
import VideoAsrFormViewBody from "./components/VideoAsrFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import TextTruncateView from "../../components/TextTruncateView.vue";

const videoAsrCreate = ref<InstanceType<typeof VideoAsrCreate> | null>(null);
const taskStore = useTaskStore();

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoAsr", () => {
    setTimeout(doRefresh, 1000);
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    // 🔧 核心修复：用 bizId 匹配任务
    const memoryTasks = taskStore.records.filter(r => r.biz === "VideoAsr");
    const dbTasks = await TaskService.list("VideoAsr");

    const allTasks = dbTasks.map(dbTask => {
        const memTask = memoryTasks.find(t => t.bizId === dbTask.id);
        if (memTask) {
            return {
                ...dbTask,
                status: memTask.status,
                statusMsg: memTask.msg,
            };
        }
        return dbTask;
    });

    records.value = mergeCheck(allTasks);
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("视频转文字") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("提取视频中的语音内容，支持识别后编辑/下载文本/字幕文件") }}</div>
            </div>
            <div class="flex items-center">
                <a-tooltip v-if="0" :content="$t('清空历史')" position="right" mini>
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-delete/>
                        </template>
                    </a-button>
                </a-tooltip>
            </div>
        </div>
        <div>
            <VideoAsrCreate ref="videoAsrCreate" @submitted="doRefresh"/>
            <div v-if="records.length > 0">
                <div class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg flex items-center">
                    <div class="flex-grow flex items-center">
                        <div class="mr-3">
                            <a-checkbox
                                :model-value="isAllChecked"
                                :indeterminate="isIndeterminate"
                                @change="onCheckAll"
                            >
                                {{ $t("全选") }}
                            </a-checkbox>
                        </div>
                        <TaskBatchDeleteAction :records="checkRecords" @update="doRefresh"/>
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
                    <div class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg">
                        <div class="flex items-center gap-1">
                            <div class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2">
                                <div class="mr-2 h-8 pt-0.5">
                                    <a-checkbox v-model="r['_check']"/>
                                </div>
                                <div class="">
                                    <TaskTitleField
                                        :record="r"
                                        @title-click="r['_check'] = !r['_check']"
                                        @update="v => (r.title = v)"
                                    />
                                </div>
                            </div>
                            <div class="flex-grow"></div>
                            <TaskDuration :start="r.startTime" :end="r.endTime"/>
                            <TaskBizStatus :status="r.status" :status-msg="r.statusMsg"/>
                        </div>
                        <div class="mt-3 flex gap-1 flex-wrap">
                            <ServerNameVersion :record="r"/>
                            <VideoAsrFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div v-if="r.result && r.result.transcript" class="mt-3">
                            <div class="bg-gray-100 rounded-lg p-2">
                                <TextTruncateView :text="r.result.transcript"/>
                            </div>
                        </div>

                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <a-tooltip v-if="r.result && r.result.transcript" :content="$t('复制文本')" mini>
                                    <a-button class="mr-2" @click="$mapi.clipboard.writeText(r.result.transcript)" title="复制识别结果">
                                        <template #icon>
                                            <icon-copy/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip v-if="r.result && r.result.transcript" :content="$t('下载')" mini>
                                    <a-dropdown-button
                                        @click="$mapi.file.downloadFile(r.result.transcript, `${r.title || 'video-asr-result'}.txt`)"
                                        class="mr-2"
                                    >
                                        <icon-download/>
                                        <template #icon>
                                            <icon-down/>
                                        </template>
                                        <template #content>
                                            <a-doption
                                                @click="$mapi.file.downloadFile(r.result.transcript, `${r.title || 'video-asr-result'}.txt`)"
                                            >
                                                {{ $t("下载文本文件") }}
                                            </a-doption>
                                            <a-doption v-if="r.result.srtPath" @click="$mapi.file.downloadFile(r.result.srtPath, `${r.title || 'video-asr-result'}.srt`)">
                                                {{ $t("下载字幕文件") }}
                                            </a-doption>
                                        </template>
                                    </a-dropdown-button>
                                </a-tooltip>
                                <TaskDownloadAction :record="r"/>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r" @update="doRefresh"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('暂无视频转文字任务')"/>
        </div>
    </div>
</template>
