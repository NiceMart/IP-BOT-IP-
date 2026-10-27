<script setup lang="ts">
import {onMounted, ref} from "vue";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import TaskLogButton from "../../../components/common/TaskLogButton.vue";
import TextTruncateView from "../../../components/TextTruncateView.vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import TaskBizStatus from "../../../components/common/TaskBizStatus.vue";
import {useCheckAll} from "../../../components/common/check-all";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {usePaginate} from "../../../hooks/paginate";
import {useTaskChangeRefresh} from "../../../hooks/task";
import SoundGenerateFormViewBody from "./SoundGenerateFormViewBody.vue";
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import ServerTaskResultParam from "../../../components/Server/ServerTaskResultParam.vue";
import TaskContinueAction from "../../../components/Server/TaskContinueAction.vue";
import {useTaskStore} from "../../../store/modules/task";
import {Message} from "@arco-design/web-vue";
import {IconDelete} from "@arco-design/web-vue/es/icon";
import {Dialog} from "../../../lib/dialog"; // Added import

const taskStore = useTaskStore();
const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

const doRefresh = async () => {
    const memoryTasks = taskStore.records.filter(r => r.biz === "SoundGenerate");
    const dbTasks = await TaskService.list("SoundGenerate");

    const allTasks = dbTasks.map(dbTask => {
        const memTask = memoryTasks.find(t => t.bizId === dbTask.id);
        if (memTask && (memTask.status === "running" || memTask.status === "querying")) {
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

// 🔧 强制删除卡住的任务
const forceKillTask = async (taskId: string) => {
    Dialog.confirm('确定要强制删除这个任务吗？此操作无法撤销。', '强制删除').then(async () => { 
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

useTaskChangeRefresh("SoundGenerate", () => {
    doRefresh();
});

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
            
            <div class="space-y-4 pb-20"> <!-- Added padding bottom for scrolling -->
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
                            <SoundGenerateFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>
                        <div class="mt-4">
                            <div class="text-display rounded-lg p-3">
                                <TextTruncateView :text="r.modelConfig.text"/>
                            </div>
                        </div>
                        <div class="pt-4" v-if="r.result && r.result.url">
                            <!-- 🔧 添加唯一key，确保组件正确重新创建，防止复用导致的加载问题 -->
                            <AudioPlayer :key="`audio-${r.id}`" show-wave :url="'file://' + r.result.url"/>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <TaskLogButton :record="r"/>
                                <TaskDownloadAction :record="r"/>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r" @update="doRefresh"/>
                                <TaskContinueAction :record="r" @update="doRefresh"/>
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
        </div>
        <div v-else class="sound-empty" role="status"><div class="sound-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" stroke-linecap="round"/></svg></div><h2>还没有合成任务</h2><p>在左侧输入文案并选择声音，即可开始合成。</p><span>完成的任务和音频会显示在这里</span></div>
    </div>
</template>

<style scoped>
.text-display {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(168, 85, 247, 0.15);
    color: #e2e8f0;
}
</style>
