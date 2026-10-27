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
import VideoSubtitleCreate from "./components/VideoSubtitleCreate.vue";
import VideoSubtitleFormViewBody from "./components/VideoSubtitleFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import {useTaskStore} from "../../store/modules/task";

const videoSubtitleCreate = ref<InstanceType<typeof VideoSubtitleCreate> | null>(null);
const taskStore = useTaskStore();

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoSubtitle", () => {
    doRefresh();
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    console.log('[VideoSubtitle.doRefresh] 🔄 开始刷新任务列表...');

    // 🔧 核心修复：同时检查内存和数据库的任务状态
    const memoryTasks = taskStore.records.filter(r => r.biz === "VideoSubtitle");
    const dbTasks = await TaskService.list("VideoSubtitle");

    console.log(`[VideoSubtitle.doRefresh] 内存任务数: ${memoryTasks.length}, 数据库任务数: ${dbTasks.length}`);

    // 用 bizId 匹配任务（bizId 是数据库 id）
    const allTasks = dbTasks.map(dbTask => {
        const memTask = memoryTasks.find(t => t.bizId === dbTask.id);

        console.log(`[VideoSubtitle.doRefresh] 处理任务 ${dbTask.id}: 数据库状态=${dbTask.status}, 内存状态=${memTask?.status || '无'}, result=${dbTask.result ? 'yes' : 'no'}`);

        // 关键逻辑：
        // 1. 如果任务已完成（success/fail），使用数据库的完整数据（包括result）
        // 2. 如果任务还在运行（running/querying），使用内存的最新状态
        // 3. 如果数据库显示success且有result，直接显示（不受内存影响）
        if (memTask && (memTask.status === "running" || memTask.status === "querying")) {
            // 任务还在运行，用内存的实时状态，但保留数据库中的其他数据
            console.log(`[VideoSubtitle.doRefresh] → 使用内存状态: ${memTask.status}`);
            return {
                ...dbTask,
                status: memTask.status,
                statusMsg: memTask.msg,
            };
        }

        // 🔧 关键修复：始终显示数据库中的数据
        // 包括已完成的任务（success/fail），即使内存中已被清理
        console.log(`[VideoSubtitle.doRefresh] → 使用数据库状态: ${dbTask.status}`);
        return dbTask;
    });

    records.value = mergeCheck(allTasks);
    console.log(`[VideoSubtitle.doRefresh] ✅ 刷新完成，显示 ${records.value.length} 个任务`);
};

// Preview subtitle with highlighting
const previewSubtitle = ref<any>(null);
const showPreview = ref(false);

const loadPreview = (record: TaskRecord) => {
    previewSubtitle.value = record.result;
    showPreview.value = true;
};

// Parse subtitle for preview
const subtitleLines = computed(() => {
    if (!previewSubtitle.value || !previewSubtitle.value.subtitles) return [];
    return previewSubtitle.value.subtitles.map((subtitle: any, index: number) => {
        // Calculate position for each word
        const wordsWithPositions = subtitle.words.map((word: any, wordIndex: number) => {
            const position = (wordIndex / subtitle.words.length) * 100; // Simple percentage position
            return {
                text: word.word,
                start: word.start,
                end: word.end,
                highlight: false,
                position
            };
        });
        
        return {
            index,
            startTime: subtitle.startTime,
            endTime: subtitle.endTime,
            text: subtitle.text,
            lines: subtitle.lines || [subtitle.text],
            words: wordsWithPositions
        };
    });
});
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("字幕制作") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("创建高亮字幕，支持时间轴编辑和样式定制") }}</div>
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
            <VideoSubtitleCreate ref="videoSubtitleCreate" @submitted="doRefresh"/>
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
                            <VideoSubtitleFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div class="pt-4 flex">
                            <div class="flex-grow">
                                <div v-if="r.result && r.result.video" class="mb-2">
                                    <a-tag class="rounded-lg">
                                        <icon-video/>
                                        {{ $t("视频文件") }}
                                    </a-tag>
                                </div>
                            </div>
                            <div class="flex-shrink-0 ml-8">
                                <a-tooltip v-if="r.result && r.result.subtitlePath" :content="$t('预览高亮字幕')" mini>
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
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('暂无字幕制作任务')"/>
        </div>
    </div>
    
    <!-- Subtitle Preview Modal -->
    <a-modal v-model:visible="showPreview" :title="$t('字幕预览')" width="80%" :footer="false">
        <div v-if="previewSubtitle" class="subtitle-preview">
            <div class="bg-gray-100 rounded-lg p-4 mb-4">
                <h4 class="font-medium mb-2">{{ $t("字幕样式") }}</h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-500">{{ $t("字体") }}:</span>
                        <span>{{ previewSubtitle.fontStyle?.fontFamily || $t("默认") }}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">{{ $t("字号") }}:</span>
                        <span>{{ previewSubtitle.fontStyle?.fontSize || 24 }}px</span>
                    </div>
                    <div>
                        <span class="text-gray-500">{{ $t("高亮颜色") }}:</span>
                        <span class="inline-block w-4 h-4 ml-1 rounded" :style="{ backgroundColor: previewSubtitle.fontStyle?.highlightColor || '#FFD700' }"></span>
                    </div>
                    <div>
                        <span class="text-gray-500">{{ $t("背景") }}:</span>
                        <span>{{ previewSubtitle.fontStyle?.backgroundColor ? $t("启用") : $t("禁用") }}</span>
                    </div>
                </div>
            </div>
            
            <div class="subtitle-preview-container bg-black rounded-lg overflow-hidden relative" style="height: 300px;">
                <div v-if="previewSubtitle.video" class="absolute inset-0">
                    <VideoPlayer :url="'file://' + previewSubtitle.video" />
                </div>
                
                <div v-if="subtitleLines.length > 0" class="subtitle-overlay absolute bottom-0 left-0 right-0 p-4">
                    <div 
                        v-for="line in subtitleLines" 
                        :key="line.index"
                        class="subtitle-line mb-2 text-center"
                        :style="{
                            fontFamily: previewSubtitle.fontStyle?.fontFamily || 'Arial',
                            fontSize: (previewSubtitle.fontStyle?.fontSize || 24) + 'px',
                            color: '#FFFFFF',
                            textShadow: previewSubtitle.fontStyle?.backgroundColor ? '2px 2px 4px #000000' : '2px 2px 4px rgba(0,0,0,0.8)'
                        }"
                    >
                        <span 
                            v-for="(word, wordIndex) in line.words" 
                            :key="wordIndex"
                            :class="{ 'highlight': word.highlight }"
                            :style="{
                                backgroundColor: word.highlight ? (previewSubtitle.fontStyle?.highlightColor || '#FFD700') : 'transparent',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                marginLeft: wordIndex > 0 ? '4px' : '0'
                            }"
                        >
                            {{ word.text }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>
.subtitle-preview-container {
    position: relative;
}

.subtitle-overlay {
    pointer-events: none;
    z-index: 10;
}

.subtitle-line {
    line-height: 1.4;
}

.highlight {
    transition: all 0.3s ease;
}
</style>
