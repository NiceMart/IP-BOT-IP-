<script setup lang="ts">
import {IconCopy, IconDown, IconDownload, IconEdit, IconDelete} from "@arco-design/web-vue/es/icon";
import {computed, onMounted, onBeforeUnmount, ref} from "vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../components/Server/TaskDeleteAction.vue";
import TaskDuration from "../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../components/TextTruncateView.vue";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
import {useCheckAll} from "../../components/common/check-all";
import {doCopy} from "../../components/common/util";
import {Dialog} from "../../lib/dialog";
import {DownloadUtil} from "../../lib/util";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {usePaginate} from "../../hooks/paginate";
import {formatSRTTime} from "../../lib/srt";
import {useTaskChangeRefresh} from "../../hooks/task";
import SoundAsrCreate from "./components/SoundAsrCreate.vue";
import SoundAsrRecordsEditDialog from "./components/SoundAsrRecordsEditDialog.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import {useTaskStore} from "../../store/modules/task";
import {Message} from "@arco-design/web-vue";

interface AsrRecord {
    start: number;
    end: number;
    text: string;
}

const taskStore = useTaskStore();
const soundAsrRecordsEditDialog = ref<InstanceType<typeof SoundAsrRecordsEditDialog> | null>(null);
const clearing = ref(false);

// 🔧 核弹级方案：彻底清空所有任务存储（包括幽灵任务）
const handleNukeAllTasks = async () => {
    $dialog.warning({
        title: '⚠️ 警告：彻底清空所有任务',
        content: '这将删除所有任务记录，包括完成的任务。此操作无法撤销。确定继续吗？',
        okText: '确定清空',
        cancelText: '取消',
        onOk: async () => {
            try {
                // 直接清空 taskStore 中的所有记录
                taskStore.records = taskStore.records.filter(r => r.biz !== 'SoundAsr');
                // 强制同步到存储
                await taskStore.sync();
                Message.success('所有任务已彻底清空');
                await doRefresh();
            } catch (error: any) {
                Message.error(`清空失败: ${error.message}`);
            }
        }
    });
};

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

useTaskChangeRefresh("SoundAsr", () => {
    doRefresh();
});

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

// 🔧 强制删除卡住的任务
const forceKillTask = async (taskId: string) => {
    $dialog.warning({
        title: '强制删除',
        content: '确定要强制删除这个任务吗？（无法撤销）',
        okText: '强制删除',
        cancelText: '取消',
        onOk: async () => {
            try {
                // 从任务列表中直接移除
                taskStore.records = taskStore.records.filter(r => r.id !== taskId);
                await taskStore.sync();
                Message.success('已强制删除任务');
                await doRefresh();
            } catch (error: any) {
                Message.error(`删除失败: ${error.message}`);
            }
        }
    });
};

// 🔧 清空所有SoundAsr任务（包括运行中、队列中、失败的）
const handleClearTasks = async () => {
    const totalCount = records.value.filter(r => r.status !== 'success' && r.status !== 'delete').length;

    if (totalCount === 0) {
        Message.info('没有任务可以清空');
        return;
    }

    $dialog.warning({
        title: '确认清空',
        content: `确定要清空 ${totalCount} 个语音识别任务吗？（包括运行中、队列中、失败的任务，已完成的任务会保留）`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
            clearing.value = true;
            try {
                await taskStore.clearTasksByBiz('SoundAsr');
                Message.success('已清空所有任务');
                await doRefresh();
            } catch (error: any) {
                Message.error(`清空失败: ${error.message}`);
            } finally {
                clearing.value = false;
            }
        }
    });
};

onMounted(async () => {
    await doRefresh();
});


const doRefresh = async () => {
    // 🔧 核心修复：用 bizId 匹配任务
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
</script>

<template>
    <div class="sound-page p-6">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold text-gray-100">{{ $t("语音识别") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("识别音频文件，支持识别后编辑/下载文本/字幕文件") }}</div>
            </div>
            <div class="flex items-center gap-2">
                <a-tooltip :content="`清空所有任务 (${records.filter(r => r.status !== 'success' && r.status !== 'delete').length})`" position="bottom" mini>
                    <a-button
                        class="ml-1"
                        :loading="clearing"
                        @click="handleClearTasks"
                        :disabled="records.filter(r => r.status !== 'success' && r.status !== 'delete').length === 0"
                    >
                        <template #icon>
                            <icon-delete/>
                        </template>
                    </a-button>
                </a-tooltip>
                <a-tooltip content="🔧 彻底清空所有任务（包括已完成）" position="bottom" mini>
                    <a-button
                        status="warning"
                        type="secondary"
                        @click="handleNukeAllTasks"
                        :disabled="records.length === 0"
                        title="核弹选项：彻底清空包括已完成的所有任务"
                    >
                        <template #icon>
                            <icon-delete/>
                        </template>
                    </a-button>
                </a-tooltip>
            </div>
        </div>
        <div>
            <SoundAsrCreate @submitted="doRefresh"/>
            <div v-if="records.length > 0">
                <div class="glass-card p-4 mt-4 flex items-center">
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
                    <div class="glass-card p-4 mt-4">
                        <div class="flex items-center gap-1">
                            <div class="inline-flex items-start bg-opacity-20 bg-blue-500 rounded-full px-2 leading-8 h-8 mr-2">
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
                                        @click="soundAsrRecordsEditDialog?.edit(r.id as any, r.result.records)"
                                        title="编辑识别结果"
                                    >
                                        <template #icon>
                                            <icon-edit/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r" @update="doRefresh"/>
                                <a-tooltip v-if="r.status === 'running' || r.status === 'querying'" content="强制删除卡住的任务" position="bottom" mini>
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
            <m-empty v-else :text="$t('暂无语音识别任务')"/>
        </div>

        <!-- 编辑弹窗 -->
        <SoundAsrRecordsEditDialog ref="soundAsrRecordsEditDialog" @save="onEditSave"/>
    </div>
</template>

<style scoped>
.sound-page {
    /* 背景已在 Container 中设置，这里移除或透明 */
    background: transparent;
    min-height: 100%;
}

.text-display {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(59, 130, 246, 0.15);
    color: #e2e8f0;
}
</style>
