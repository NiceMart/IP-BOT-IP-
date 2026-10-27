<script setup lang="ts">
// @ts-nocheck
import {onMounted, ref, computed} from "vue";
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
import VideoBGMCreate from "./components/VideoBGMCreate.vue";
import VideoBGMFormViewBody from "./components/VideoBGMFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import {useTaskStore} from "../../store/modules/task";

const videoBGMCreate = ref<InstanceType<typeof VideoBGMCreate> | null>(null);
const taskStore = useTaskStore();

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoBGM", () => {
    doRefresh();
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    console.log('[VideoBGM.doRefresh] 🔄 开始刷新任务列表...');

    // 🔧 核心修复：同时检查内存和数据库的任务状态
    const memoryTasks = taskStore.records.filter(r => r.biz === "VideoBGM");
    const dbTasks = await TaskService.list("VideoBGM");

    console.log(`[VideoBGM.doRefresh] 内存任务数: ${memoryTasks.length}, 数据库任务数: ${dbTasks.length}`);

    // 用 bizId 匹配任务（bizId 是数据库 id）
    const allTasks = dbTasks.map(dbTask => {
        const memTask = memoryTasks.find(t => t.bizId === dbTask.id);

        console.log(`[VideoBGM.doRefresh] 处理任务 ${dbTask.id}: 数据库状态=${dbTask.status}, 内存状态=${memTask?.status || '无'}, result=${dbTask.result ? 'yes' : 'no'}`);

        // 关键逻辑：
        // 1. 如果任务已完成（success/fail），使用数据库的完整数据（包括result）
        // 2. 如果任务还在运行（running/querying），使用内存的最新状态
        // 3. 如果数据库显示success且有result，直接显示（不受内存影响）
        if (memTask && (memTask.status === "running" || memTask.status === "querying")) {
            // 任务还在运行，用内存的实时状态，但保留数据库中的其他数据
            console.log(`[VideoBGM.doRefresh] → 使用内存状态: ${memTask.status}`);
            return {
                ...dbTask,
                status: memTask.status,
                statusMsg: memTask.msg,
            };
        }

        // 🔧 关键修复：始终显示数据库中的数据
        // 包括已完成的任务（success/fail），即使内存中已被清理
        console.log(`[VideoBGM.doRefresh] → 使用数据库状态: ${dbTask.status}`);
        return dbTask;
    });

    records.value = mergeCheck(allTasks);
    console.log(`[VideoBGM.doRefresh] ✅ 刷新完成，显示 ${records.value.length} 个任务`);
};

// Preview audio with original video
const previewMixture = ref<any>(null);
const showPreview = ref(false);

const loadPreview = (record: TaskRecord) => {
    previewMixture.value = record.result;
    showPreview.value = true;
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("BGM智能匹配") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("智能匹配背景音乐，自动混合音频，提升视频情感体验") }}</div>
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
            <VideoBGMCreate ref="videoBGMCreate" @submitted="doRefresh"/>
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
                            <VideoBGMFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div class="pt-4 flex">
                            <div class="flex-grow">
                                <div v-if="r.result && r.result.originalVideo" class="mb-2">
                                    <a-tag class="rounded-lg">
                                        <icon-video/>
                                        {{ $t("原始视频") }}
                                    </a-tag>
                                </div>
                                <div v-if="r.result && r.result.mixedVideo" class="mb-2">
                                    <div class="flex-grow">
                                        <div class="p-2 rounded shadow bg-gray-300">
                                            <div class="w-48 h-48">
                                                <VideoPlayer :url="'file://' + r.result.mixedVideo"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-shrink-0 ml-8">
                                <a-tooltip v-if="r.result && r.result.mixedVideo" :content="$t('预览混音效果')" mini>
                                    <a-button class="mr-2" @click="loadPreview(r)" title="预览">
                                        <template #icon>
                                            <icon-eye/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <TaskDownloadAction :record="r"/>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r" @update="doRefresh"/>
                            </div>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <a-tooltip v-if="r.result && r.result.stats" :content="$t('混音信息')" mini>
                                    <a-button class="mr-2" title="混音信息">
                                        <template #icon>
                                            <icon-music/>
                                        </template>
                                        {{ r.result.stats.audioFadeIn ? $t("淡入") : "" }}
                                        {{ r.result.stats.matchScore ? $t("匹配度") + ": " + r.result.stats.matchScore : "" }}
                                    </a-button>
                                </a-tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('暂无BGM混音任务')"/>
        </div>
    </div>
    
    <!-- Audio Preview Modal -->
    <a-modal v-model:visible="showPreview" :title="$t('混音预览')" width="80%" :footer="false">
        <div v-if="previewMixture" class="bg-gray-100 rounded-lg p-4">
            <div v-if="previewMixture.originalVideo" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("原始视频音频") }}</h4>
                <AudioPlayer :url="'file://' + previewMixture.originalVideoAudio" />
            </div>
            
            <div v-if="previewMixture.bgmAudio" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("选择的BGM") }}</h4>
                <AudioPlayer :url="'file://' + previewMixture.bgmAudio" />
            </div>
            
            <div v-if="previewMixture.mixedVideo" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("混合结果") }}</h4>
                <VideoPlayer :url="'file://' + previewMixture.mixedVideo" />
            </div>
        </div>
    </a-modal>
</template>
