<script setup lang="ts">
import {IconCopy, IconDown, IconDownload, IconEdit, IconDelete} from "@arco-design/web-vue/es/icon";
import {computed, onMounted, ref} from "vue";
import ServerTaskResultParam from "../../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../../components/Server/TaskDeleteAction.vue";
import TaskDuration from "../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../../components/TextTruncateView.vue";
import TaskBizStatus from "../../../components/common/TaskBizStatus.vue";
import {useCheckAll} from "../../../components/common/check-all";
import {doCopy} from "../../../components/common/util";
import {Dialog} from "../../../lib/dialog";
import {DownloadUtil} from "../../../lib/util";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {usePaginate} from "../../../hooks/paginate";
import {formatSRTTime} from "../../../lib/srt";
import {useTaskChangeRefresh} from "../../../hooks/task";
import SoundAsrRecordsEditDialog from "./SoundAsrRecordsEditDialog.vue";
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import {useTaskStore} from "../../../store/modules/task";
import {Message} from "@arco-design/web-vue";

interface AsrRecord {
    start: number;
    end: number;
    text: string;
}

const taskStore = useTaskStore();
const soundAsrRecordsEditDialog = ref<InstanceType<typeof SoundAsrRecordsEditDialog> | null>(null);
const {page, records, recordsForPage} = usePaginate<TaskRecord>();

useTaskChangeRefresh("SoundAsr", () => {
    doRefresh();
});

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

// 🔧 强制删除卡住的任务
const forceKillTask = async (taskId: number | string) => {
    Dialog.confirm(
        '确定要强制删除这个任务吗？（无法撤销）',
        '强制删除'
    ).then(async () => {
        try {
            taskStore.records = taskStore.records.filter(r => r.id !== taskId);
            await taskStore.sync();
            Message.success('已强制删除任务');
            await doRefresh();
        } catch (error: any) {
            Message.error(`删除失败: ${error.message}`);
        }
    });
};

const doRefresh = async () => {
    const memoryTasks = taskStore.records.filter(r => r.biz === "SoundAsr");
    const dbTasks = await TaskService.list("SoundAsr");

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

    const processedRecords = allTasks.map(record => {
        record.runtime = {
            text: computed(() => {
                if (record.result && record.result.records && Array.isArray(record.result.records)) {
                    return record.result.records.map(r => r.text).join("");
                }
                return "";
            }),
        };
        return record;
    });
    records.value = mergeCheck(processedRecords);
};

const onDownloadResultSubtitle = (record: TaskRecord) => {
    if (record?.result?.records.length) {
        const srtContent = record.result.records
            .map(
                (asrRecord, index) =>
                    `${index + 1}\n${formatSRTTime(asrRecord.start)} --> ${formatSRTTime(asrRecord.end)}\n${
                        asrRecord.text
                    }\n`
            )
            .join("\n");
        DownloadUtil.downloadFile(srtContent, `${record.title || "asr-result"}.srt`);
    }
};
const onEditSave = async (taskId: number, records: AsrRecord[]) => {
    await TaskService.update(taskId, {result: {records}});
    Dialog.tipSuccess("保存成功");
    await doRefresh();
};

onMounted(async () => {
    await doRefresh();
});

defineExpose({
    doRefresh
});
</script>

<template>
    <div class="h-full flex flex-col">
        <div v-if="records.length > 0">
            <div class="bg-[#141414] border border-[#333] rounded-xl p-4 mb-4 flex items-center">
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
            
            <div class="space-y-4 pb-20">
                <div v-for="r in recordsForPage" :key="r.id">
                    <div class="bg-[#141414] border border-[#333] rounded-xl p-4 hover:border-[#555] transition-colors">
                        <div class="flex items-center gap-1">
                            <div class="inline-flex items-start bg-white/5 border border-white/10 rounded-full px-2 leading-8 h-8 mr-2">
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
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div v-if="r.result && r.runtime?.text" class="mt-3">
                            <div class="text-display rounded-lg p-3">
                                <TextTruncateView :text="r.runtime?.text"/>
                            </div>
                        </div>

                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <a-tooltip v-if="r.result && r.runtime?.text" :content="$t('复制文本')" mini>
                                    <a-button class="mr-2" @click="doCopy(r.runtime?.text)" title="复制识别结果">
                                        <template #icon>
                                            <icon-copy/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip v-if="r.result && r.runtime?.text" :content="$t('下载')" mini>
                                    <a-dropdown-button
                                        @click="
                                            DownloadUtil.downloadFile(r.runtime?.text, `${r.title || 'asr-result'}.txt`)
                                        "
                                        class="mr-2"
                                    >
                                        <icon-download/>
                                        <template #icon>
                                            <icon-down/>
                                        </template>
                                        <template #content>
                                            <a-doption
                                                @click="
                                                    DownloadUtil.downloadFile(
                                                        r.runtime?.text,
                                                        `${r.title || 'asr-result'}.txt`
                                                    )
                                                "
                                            >
                                                {{ $t("下载文本文件") }}
                                            </a-doption>
                                            <a-doption @click="onDownloadResultSubtitle(r)">
                                                {{ $t("下载字幕文件") }}
                                            </a-doption>
                                        </template>
                                    </a-dropdown-button>
                                </a-tooltip>
                                <a-tooltip v-if="r.result && r.result.records" :content="$t('编辑')" mini>
                                    <a-button
                                        class="mr-2"
                                        @click="soundAsrRecordsEditDialog?.edit(r.id as number, r.result.records)"
                                        title="编辑识别结果"
                                    >
                                        <template #icon>
                                            <icon-edit/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r" @update="doRefresh"/>
                                <a-tooltip v-if="r.status === 'running'" content="强制删除卡住的任务" position="bottom" mini>
                                    <a-button
                                        type="secondary"
                                        status="warning"
                                        @click="forceKillTask(r.id)"
                                        title="强制删除此任务（不可撤销）"
                                    >
                                        <template #icon>
                                            <icon-delete/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="sound-empty" role="status"><div class="sound-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" stroke-linecap="round"/></svg></div><h2>还没有识别任务</h2><p>在左侧选择音频或视频，即可提取文字。</p><span>完成的任务和音频会显示在这里</span></div>
<SoundAsrRecordsEditDialog ref="soundAsrRecordsEditDialog" @save="onEditSave"/>
    </div>
</template>

<style scoped>
.text-display {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(168, 85, 247, 0.15);
    color: #e2e8f0;
}
</style>
