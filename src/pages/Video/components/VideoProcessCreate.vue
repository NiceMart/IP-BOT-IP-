<script setup lang="ts">
// @ts-nocheck
import {ref} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import VideoProcessForm from "./VideoProcessForm.vue";
import VideoSelector from "../../../components/common/VideoSelector.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const videoProcessForm = ref<InstanceType<typeof VideoProcessForm>>();
const formData = ref({
    video: "",
});

const onSelectVideoFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("选择视频文件"),
            filters: [{name: t("视频文件"), extensions: ["mp4", "avi", "mov", "mkv"]}],
        });

        if (filePath) {
            formData.value.video = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("文件选择失败"));
    }
};

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
        const value = await videoProcessForm.value?.getValue();
        if (!value) {
            return;
        }

        if (!formData.value.video) {
            Dialog.tipError(t("请选择视频文件"));
            return;
        }

        // Generate task title from video filename
        const taskTitle = window.$mapi.file.pathToName(formData.value.video, false);

        const record: TaskRecord = {
            biz: "VideoProcess",
            title: taskTitle,
            serverName: "JumpCutter", // Using a fixed server name for this functionality
            serverTitle: t("JumpCutter智能剪辑"),
            serverVersion: "1.0.0",
            modelConfig: {
                type: "VideoProcess",
                serverKey: "JumpCutter",
                param: value.param,
                video: formData.value.video,
            },
            param: {},
        };

        if (!(await PermissionService.checkForTask(value.type, record))) {
            return;
        }

        await TaskService.submit(record);

        // Reset form
        formData.value.video = "";

        emit("submitted");
        Dialog.tipSuccess(t("智能剪辑任务已提交"));
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="mr-1 pt-1">
                <a-tooltip :content="$t('视频文件')" mini>
                    <i class="iconfont icon-video"></i>
                </a-tooltip>
            </div>
            <div>
                <VideoSelector v-model="formData.video" />
            </div>
        </div>
        <VideoProcessForm ref="videoProcessForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit" :loading="isSubmitting">
                <i class="iconfont icon-scissors mr-2"></i>
                {{ t("开始剪辑") }}
            </a-button>
        </div>
    </div>
</template>
