<script setup lang="ts">
import {onMounted, ref, computed} from "vue";
import {useCheckAll} from "../../components/common/check-all";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
import TaskBatchDeleteAction from "../../components/Server/TaskBatchDeleteAction.vue";
import TaskCancelAction from "../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../components/Server/TaskTitleField.vue";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {usePaginate} from "../../hooks/paginate";
import {useTaskChangeRefresh} from "../../hooks/task";
import VideoPublishCreate from "./components/VideoPublishCreate.vue";
import VideoPublishFormViewBody from "./components/VideoPublishFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import AccountManager from "./components/AccountManager.vue";

const videoPublishCreate = ref<InstanceType<typeof VideoPublishCreate> | null>(null);
const showAccountManager = ref(false);

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoPublish", () => {
    setTimeout(doRefresh, 1000);
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    records.value = mergeCheck(await TaskService.list("VideoPublish"));
};

// Preview final video
const previewVideo = ref<any>(null);
const showPreview = ref(false);

const loadPreview = (record: TaskRecord) => {
    previewVideo.value = record.result;
    showPreview.value = true;
};

// Close preview dialog
const closePreview = () => {
    showPreview.value = false;
    previewVideo.value = null;
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("一键发布") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("整合字幕制作功能，一键输出最终视频") }}</div>
            </div>
            <div class="flex items-center gap-2">
                <a-button type="outline" @click="showAccountManager = true">
                    <template #icon><icon-user-group/></template>
                    {{ $t("账号管理") }}
                </a-button>
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
            <VideoPublishCreate ref="videoPublishCreate" @submitted="doRefresh"/>
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
                            <VideoPublishFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div class="pt-4">
                            <div v-if="r.result && r.result.finalVideo" class="mb-4">
                                <div class="rounded-lg overflow-hidden shadow-md border-2 border-gray-200">
                                    <div class="w-full bg-gray-100" style="height: 240px;">
                                        <VideoPlayer :url="'file://' + r.result.finalVideo" />
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4 mt-4">
                                    <div v-if="r.result.videoSubtitleResult" class="rounded-md bg-gray-100 p-3">
                                        <h5 class="font-medium text-sm mb-2">{{ $t("字幕制作") }}</h5>
                                        <p class="text-xs truncate">{{ r.result.videoSubtitleResult.subtitleVideo ? $t("已完成") : $t("未处理") }}</p>
                                    </div>
                                    
                                    <div v-if="r.result.publishResult" class="rounded-md bg-gray-100 p-3">
                                        <h5 class="font-medium text-sm mb-2">{{ $t("发布结果") }}</h5>
                                        <p class="text-xs truncate">{{ r.result.publishResult.platform ? $t("已发布到") + " " + r.result.publishResult.platform : $t("未发布") }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 flex">
                            <div class="flex-grow"></div>
                            <div class="flex-shrink-0 ml-8">
                                <a-tooltip v-if="r.result && r.result.finalVideo" :content="$t('预览最终视频')" mini>
                                    <a-button class="mr-2" @click="loadPreview(r)">
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
                                <a-tooltip v-if="r.result && r.result.publishResult" :content="$t('发布信息')" mini>
                                    <a-button class="mr-2" title="发布信息">
                                        <template #icon>
                                            <icon-share-alt/>
                                        </template>
                                        {{ r.result.publishResult.platform ? $t("已发布") : $t("未发布") }}
                                    </a-button>
                                </a-tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('暂无发布任务')"/>
        </div>
    </div>
    
    <!-- Preview Modal -->
    <a-modal v-model:visible="showPreview" :title="$t('视频预览')" width="80%" :footer="false" @cancel="closePreview">
        <div v-if="previewVideo" class="bg-gray-100 rounded-lg p-4">
            <div v-if="previewVideo.finalVideo" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("最终视频") }}</h4>
                <div class="rounded-lg overflow-hidden shadow-lg">
                    <VideoPlayer :url="'file://' + previewVideo.finalVideo" />
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div v-if="previewVideo.videoSubtitleResult" class="mb-4">
                    <h4 class="font-medium mb-2">{{ $t("字幕结果") }}</h4>
                    <div class="rounded-md p-3 bg-white">
                        <p class="text-sm">{{ $t("字幕样式") }}: {{ previewVideo.videoSubtitleResult.subtitleStyle || $t("默认样式") }}</p>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>

    <!-- 账号管理弹窗 -->
    <a-modal v-model:visible="showAccountManager" :title="$t('平台账号管理')" width="640px" :footer="false">
        <AccountManager />
    </a-modal>
</template>