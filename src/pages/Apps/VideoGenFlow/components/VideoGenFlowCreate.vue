<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Dialog } from "../../../../lib/dialog";
import { StorageUtil } from "../../../../lib/storage";
import { PermissionService } from "../../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import SoundGenerateForm from "../../../Sound/components/SoundGenerateForm.vue";
import VideoGenForm from "../../../Video/components/VideoGenForm.vue";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(null);
const videoGenForm = ref<InstanceType<typeof VideoGenForm> | null>(null);

const formData = ref({
    text: "",
});

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenFlowCreate.formData");
    formData.value.text = old.text || "";
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("VideoGenFlowCreate.formData", value);
    },
    {
        deep: true,
    }
);

const doSubmit = async () => {
    const videoGenValue = await videoGenForm.value?.getValue();
    if (!videoGenValue) {
        return;
    }
    let soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    const record: TaskRecord = {
        biz: "VideoGenFlow",
        title: await $mapi.file.textToName(formData.value.text),
        serverName: videoGenValue.serverName,
        serverTitle: videoGenValue.serverTitle,
        serverVersion: videoGenValue.serverVersion,
        modelConfig: {
            videoTemplateId: videoGenValue.videoTemplateId,
            videoTemplateName: videoGenValue.videoTemplateName,
            videoTemplateUrl: videoGenValue.videoTemplateUrl,
            soundGenerate: soundGenerateValue,
            text: formData.value.text,
        },
        param: videoGenValue.param,
    };
    if (!(await PermissionService.checkForTask("VideoGenFlow", record))) {
        return;
    }
    // console.log('VideoGenFlow.submit',JSON.stringify(record))
    const id = await TaskService.submit(record);
    Dialog.tipSuccess("任务已经提交成功，等待视频生成完成");
    formData.value.text = "";
    emit("submitted");
};

const emit = defineEmits({
    submitted: () => true,
});
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <VideoGenForm ref="videoGenForm" />
        <SoundGenerateForm ref="soundGenerateForm" />
        <div class="mb-4">
            <a-textarea
                v-model="formData.text"
                :auto-size="{minRows: 2}"
                :placeholder="'输入语音内容开始生成视频'"
            ></a-textarea>
        </div>
        <div>
            <a-button class="mr-2" type="primary" @click="doSubmit">
                开始生成视频
            </a-button>
        </div>
    </div>
</template>
