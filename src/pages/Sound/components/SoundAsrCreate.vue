<script setup lang="ts">
// @ts-nocheck
import {ref} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import SoundAsrForm from "./SoundAsrForm.vue";
import FileSelector from "../../../components/common/FileSelector.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const formData = ref({
    audio: "",
});

const onSelectAudioFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("选择音频/视频文件"),
            filters: [
                {name: t("音频文件"), extensions: ["mp3", "wav"]},
                {name: t("视频文件"), extensions: ["mp4", "avi", "mov", "mkv"]}
            ],
        });

        if (filePath) {
            formData.value.audio = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("文件选择失败"));
    }
};

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
        const value = await soundAsrForm.value?.getValue();
        if (!value) {
            return;
        }

        // 验证输入
        if (!formData.value.audio) {
            Dialog.tipError(t("请选择音频/视频文件"));
            return;
        }

        // Generate task title
        const taskTitle = window.$mapi.file.pathToName(formData.value.audio, false);

        const record: TaskRecord = {
            biz: "SoundAsr",
            title: taskTitle,
            serverName: value.serverName || "online",
            serverTitle: value.serverTitle || "在线模型",
            serverVersion: value.serverVersion || "1.0",
            modelConfig: {
                type: value.type,
                modelType: value.modelType,
                serverKey: value.serverKey,
                onlineModelId: value.onlineModelId,
                param: value.param,
                audio: formData.value.audio,
            },
            param: {},
        };

        // 只对本地模型进行权限检查
        if (value.modelType === "local") {
            if (!(await PermissionService.checkForTask(value.type, record))) {
                return;
            }
        }

        await TaskService.submit(record);

        // Reset form
        formData.value.audio = "";

        emit("submitted");
        Dialog.tipSuccess(t("语音识别任务已提交"));
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div :class="simpleMode ? 'bg-[#141414] border border-[#333] rounded-xl' : 'glass-card rounded-lg overflow-hidden'">
        <div v-if="!simpleMode" class="glass-card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white;">02</div>
                <h3 class="text-base font-semibold" style="color: #e2e8f0;">{{ t("文件识别") }}</h3>
            </div>
        </div>

        <div class="p-4">
            <!-- 文件选择 -->
            <div class="mb-4 flex items-start">
                <div class="mr-1 pt-1">
                    <a-tooltip :content="$t('音频/视频文件')" mini>
                        <i class="iconfont icon-sound" style="color: #94a3b8;"></i>
                    </a-tooltip>
                </div>
                <div class="flex-grow">
                    <FileSelector :extensions="['mp3', 'wav', 'flac', 'aac', 'mp4', 'avi', 'mov', 'mkv']" v-model="formData.audio" />
                </div>
            </div>

            <!-- 模型配置 -->
            <SoundAsrForm ref="soundAsrForm" />

            <!-- 提交按钮 -->
            <div class="flex mt-4">
                <a-button class="mr-2" type="primary" @click="doSubmit" :loading="isSubmitting">
                    <i class="iconfont icon-submit mr-2"></i>
                    {{ t("开始识别") }}
                </a-button>
            </div>
        </div>
    </div>
</template>
