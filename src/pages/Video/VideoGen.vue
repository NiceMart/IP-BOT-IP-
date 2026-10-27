<script setup lang="ts">
import {onMounted, ref} from "vue";
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
import TaskLogButton from "../../components/common/TaskLogButton.vue";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {usePaginate} from "../../hooks/paginate";
import {useTaskChangeRefresh} from "../../hooks/task";
import {useTaskStore} from "../../store/modules/task";
import VideoGenCreate from "./components/VideoGenCreate.vue";
import VideoGenFormViewBody from "./components/VideoGenFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import TextTruncateView from "../../components/TextTruncateView.vue";

const videoGenCreate = ref<InstanceType<typeof VideoGenCreate> | null>(null);
const taskStore = useTaskStore();

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoGen", () => {
    doRefresh();
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    const memoryTasks = taskStore.records.filter(r => r.biz === "VideoGen");
    const dbTasks = await TaskService.list("VideoGen");

    const allTasks = dbTasks.map(dbTask => {
        const memTask = memoryTasks.find(t => t.bizId === String(dbTask.id));
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

const onTaskSubmitted = async () => {
    await new Promise(r => setTimeout(r, 100));
    await doRefresh();
};
</script>

<template>
    <div class="video-gen-page">
        <!-- 页面头部 -->
        <div class="page-header">
            <div class="header-left">
                <div class="page-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="header-text">
                    <h1 class="page-title">数字人合成</h1>
                    <p class="page-desc">支持音频驱动实现口型替换</p>
                </div>
            </div>
        </div>

        <!-- 创建表单 -->
        <VideoGenCreate ref="videoGenCreate" @submitted="onTaskSubmitted"/>

        <!-- 任务列表 -->
        <div v-if="records.length > 0" class="task-list">
            <!-- 批量操作栏 -->
            <div class="batch-bar">
                <label class="select-all" @click="onCheckAll">
                    <div class="checkbox" :class="{ checked: isAllChecked, indeterminate: isIndeterminate }">
                        <svg v-if="isAllChecked" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <svg v-else-if="isIndeterminate" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 12h12"/>
                        </svg>
                    </div>
                    <span>全选</span>
                </label>
                <div class="batch-actions">
                    <TaskBatchDeleteAction :records="checkRecords" @update="doRefresh"/>
                    <TaskBatchDownloadAction :records="checkRecords"/>
                </div>
                <a-pagination
                    v-model:current="page"
                    :total="records.length"
                    :page-size="10"
                    show-total
                    simple
                />
            </div>

            <!-- 任务卡片 -->
            <div v-for="r in recordsForPage" :key="r.id" class="task-card">
                <div class="task-header">
                    <div class="task-checkbox">
                        <div class="checkbox" :class="{ checked: r['_check'] }" @click="r['_check'] = !r['_check']">
                            <svg v-if="r['_check']" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="task-title">
                        <TaskTitleField
                            :record="r"
                            @title-click="r['_check'] = !r['_check']"
                            @update="v => (r.title = v)"
                        />
                    </div>
                    <div class="task-meta">
                        <TaskDuration :start="r.startTime" :end="r.endTime"/>
                        <TaskBizStatus :status="r.status" :status-msg="r.statusMsg"/>
                    </div>
                </div>

                <div class="task-body">
                    <div class="task-info">
                        <div class="info-section">
                            <ServerNameVersion :record="r"/>
                            <VideoGenFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>
                        <div class="audio-section" v-if="r.modelConfig.soundType === 'soundGenerate'">
                            <div class="audio-tag">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                声音合成
                            </div>
                            <div class="audio-text">
                                <TextTruncateView :text="r.modelConfig.soundGenerateText"/>
                            </div>
                        </div>
                        <div class="audio-section" v-if="r.modelConfig.soundType === 'soundCustom'">
                            <div class="audio-tag">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                本地文件
                            </div>
                            <AudioPlayer v-if="r.modelConfig.soundCustomFile" :url="`file://${r.modelConfig.soundCustomFile}`"/>
                        </div>
                    </div>
                    <div class="task-preview" v-if="r.result.url">
                        <VideoPlayer :key="`video-${r.id}`" :url="'file://' + r.result.url"/>
                    </div>
                </div>

                <div class="task-footer">
                    <div class="task-time">
                        <timeago :datetime="r['createdAt'] * 1000"/>
                    </div>
                    <div class="task-actions">
                        <TaskLogButton :record="r"/>
                        <TaskDownloadAction :record="r"/>
                        <TaskDeleteAction :record="r" @update="doRefresh"/>
                        <TaskCancelAction :record="r" @update="doRefresh"/>
                    </div>
                </div>
            </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
            <div class="empty-visual">
                <div class="empty-circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="empty-ring"></div>
            </div>
            <div class="empty-title">暂无合成任务</div>
            <div class="empty-desc">点击上方按钮创建新的数字人视频</div>
        </div>
    </div>
</template>

<style scoped>
.video-gen-page {
    padding: 20px 28px;
    min-height: 100%;
    background: transparent;
}

/* 页面头部 */
.page-header {
    margin-bottom: 24px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.page-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.page-icon svg {
    width: 26px;
    height: 26px;
    color: #fff;
}

.page-title {
    font-size: 20px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0;
}

.page-desc {
    font-size: 12px;
    color: #64748b;
    margin: 4px 0 0;
}

/* 批量操作栏 */
.batch-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    margin-bottom: 16px;
}

.select-all {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #94a3b8;
    font-size: 13px;
}

.checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.checkbox svg {
    width: 12px;
    height: 12px;
    color: #fff;
}

.checkbox:hover {
    border-color: rgba(236, 72, 153, 0.5);
}

.checkbox.checked {
    background: #ec4899;
    border-color: #ec4899;
}

.checkbox.indeterminate {
    background: #ec4899;
    border-color: #ec4899;
}

.batch-actions {
    display: flex;
    gap: 8px;
    flex: 1;
}

/* 任务卡片 */
.task-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.task-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 18px;
    transition: all 0.25s ease;
}

.task-card:hover {
    border-color: rgba(236, 72, 153, 0.3);
}

.task-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
}

.task-checkbox {
    flex-shrink: 0;
}

.task-title {
    flex: 1;
    min-width: 0;
}

.task-meta {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
}

.task-body {
    display: flex;
    gap: 20px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    margin-bottom: 14px;
}

.task-info {
    flex: 1;
    min-width: 0;
}

.info-section {
    margin-bottom: 12px;
}

.audio-section {
    margin-bottom: 10px;
}

.audio-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 8px;
}

.audio-tag svg {
    width: 14px;
    height: 14px;
}

.audio-text {
    font-size: 12px;
    color: #e2e8f0;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
}

.task-preview {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
    border-radius: 10px;
    overflow: hidden;
    background: #000;
}

.task-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.task-time {
    font-size: 12px;
    color: #64748b;
}

.task-actions {
    display: flex;
    gap: 8px;
}

/* 空状态 */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80px 20px;
    text-align: center;
}

.empty-visual {
    position: relative;
    width: 120px;
    height: 120px;
    margin-bottom: 24px;
}

.empty-circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 70px;
    height: 70px;
    background: rgba(236, 72, 153, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-circle svg {
    width: 36px;
    height: 36px;
    color: #ec4899;
}

.empty-ring {
    position: absolute;
    inset: 0;
    border: 1px solid rgba(236, 72, 153, 0.2);
    border-radius: 50%;
    animation: pulse-ring 2s ease-out infinite;
}

@keyframes pulse-ring {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    100% {
        transform: scale(1.4);
        opacity: 0;
    }
}

.empty-title {
    font-size: 18px;
    font-weight: 600;
    color: #f1f5f9;
    margin-bottom: 8px;
}

.empty-desc {
    font-size: 13px;
    color: #64748b;
}

/* 深色主题修复 */
:deep(.arco-checkbox-label) {
    color: #e2e8f0;
}

:deep(.arco-btn) {
    background: rgba(255, 255, 255, 0.05) !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    color: #e2e8f0 !important;
}

:deep(.arco-btn:hover) {
    background: rgba(255, 255, 255, 0.1) !important;
    color: #ffffff !important;
}

:deep(.arco-btn-primary) {
    background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%) !important;
    border: none !important;
    color: #ffffff !important;
}

:deep(.arco-btn-primary:hover) {
    background: linear-gradient(135deg, #db2777 0%, #ec4899 100%) !important;
}
</style>
