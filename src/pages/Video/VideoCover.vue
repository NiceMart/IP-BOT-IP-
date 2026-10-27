<script setup lang="ts">
import {onMounted, ref, computed, watch} from "vue";
import {useCheckAll} from "../../components/common/check-all";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
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
import VideoCoverCreate from "./components/VideoCoverCreate.vue";
import VideoCoverFormViewBody from "./components/VideoCoverFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import VideoCoverPreviewDialog from "./components/VideoCoverPreviewDialog.vue";

// 🔧 图片懒加载状态管理
const lazyLoadedImages = ref<Set<string>>(new Set());

const videoCoverCreate = ref<InstanceType<typeof VideoCoverCreate> | null>(null);

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoCover", () => {
    setTimeout(doRefresh, 1000);
});

onMounted(() => {
    doRefresh();
    // 🔧 设置 Intersection Observer 用于图片懒加载
    setupLazyLoadObserver();
});

const doRefresh = async () => {
    records.value = mergeCheck(await TaskService.list("VideoCover"));
    // 刷新后清空已加载图片缓存，重新开始观察
    lazyLoadedImages.value.clear();
};

// 🔧 图片懒加载处理
const setupLazyLoadObserver = () => {
    // 延迟一点时间，确保 DOM 已经渲染
    setTimeout(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    const src = img.getAttribute('data-src');
                    if (src && !lazyLoadedImages.value.has(src)) {
                        img.src = src;
                        lazyLoadedImages.value.add(src);
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            // 提前 100px 开始加载
            rootMargin: '100px'
        });

        // 观察所有需要懒加载的图片
        document.querySelectorAll('img[data-src]').forEach(img => {
            observer.observe(img);
        });
    }, 100);
};

// 🔧 监听分页变化，重新设置懒加载观察
watch(() => page.value, () => {
    setTimeout(setupLazyLoadObserver, 50);
});

// Preview cover image
const showPreviewDialog = ref(false);
const previewCoverData = ref<any>(null);

const loadPreview = (record: TaskRecord) => {
    previewCoverData.value = record.result;
    showPreviewDialog.value = true;
};

// Close preview dialog
const closePreviewDialog = () => {
    showPreviewDialog.value = false;
    previewCoverData.value = null;
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("封面自动生成") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("智能抽取视频关键帧，添加特效文字，自动生成精美封面") }}</div>
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
            <VideoCoverCreate ref="videoCoverCreate" @submitted="doRefresh"/>
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
                            <VideoCoverFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div class="pt-4">
                            <div v-if="r.result && r.result.coverImage" class="mb-4">
                                <div class="flex flex-wrap items-center gap-4">
                                    <div class="rounded-lg overflow-hidden shadow-md border-2 border-gray-200">
                                        <!-- 🔧 使用 data-src 实现图片懒加载，避免一次性加载所有图片 -->
                                        <img
                                            :data-src="'file://' + r.result.coverImage"
                                            :alt="$t('生成的封面')"
                                            class="w-48 h-auto object-contain bg-gray-100"
                                            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23f3f4f6' width='192' height='144'/%3E%3C/svg%3E"
                                        />
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-medium mb-2">{{ $t("封面详情") }}</h4>
                                        <div class="text-sm text-gray-600 space-y-1">
                                            <div v-if="r.result.timePoint">
                                                <span>{{ $t("截图时间点") }}: </span>
                                                <span class="font-mono">{{ r.result.timePoint.toFixed(2) }}{{ $t("秒") }}</span>
                                            </div>
                                            <div v-if="r.result.width && r.result.height">
                                                <span>{{ $t("图片尺寸") }}: </span>
                                                <span class="font-mono">{{ r.result.width }} × {{ r.result.height }}</span>
                                            </div>
                                            <div v-if="r.result.textOverlay">
                                                <span>{{ $t("叠加文字") }}: </span>
                                                <span>{{ r.result.textOverlay }}</span>
                                            </div>
                                            <div v-if="r.result.originalVideo">
                                                <span>{{ $t("来源视频") }}: </span>
                                                <span class="truncate max-w-xs inline-block">{{ r.result.originalVideo.split('/').pop() }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pt-4 flex">
                            <div class="flex-grow"></div>
                            <div class="flex-shrink-0 ml-8">
                                <a-tooltip v-if="r.result && r.result.coverImage" :content="$t('预览封面')" mini>
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
                                <a-tooltip v-if="r.result && r.result.stats" :content="$t('生成信息')" mini>
                                    <a-button class="mr-2" title="生成信息">
                                        <template #icon>
                                            <icon-info-circle/>
                                        </template>
                                        {{ $t("已生成") }}
                                    </a-button>
                                </a-tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('暂无封面生成任务')"/>
        </div>
    </div>
    
    <!-- Preview Dialog -->
    <VideoCoverPreviewDialog 
        v-if="showPreviewDialog" 
        :visible="showPreviewDialog" 
        :data="previewCoverData"
        @update:visible="showPreviewDialog = $event"
        @close="closePreviewDialog"
    />
</template>