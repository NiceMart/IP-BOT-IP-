<script setup lang="ts">
import {ref} from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import {dataAutoSaveDraft} from "../../../../components/common/util";
import {Dialog} from "../../../../lib/dialog";
import {TaskRecord, TaskService} from "../../../../service/TaskService";
import SoundGenerateForm from "../../../Sound/components/SoundGenerateForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const formData = ref({
    srt: "",
});
const {clearDraft} = dataAutoSaveDraft("SubtitleTtsCreate.formData", formData.value);

const doSubmit = async () => {
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    if (!formData.value.srt) {
        Dialog.tipError("请选择SRT字幕文件");
        return;
    }
    const taskTitle = $mapi.file.pathToName(formData.value.srt, false);
    const record: TaskRecord = {
        biz: "SubtitleTts",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            srt: formData.value.srt,
            soundGenerate: soundGenerateValue,
        },
        param: {},
    };
    await TaskService.submit(record);
    formData.value.srt = "";
    emit("submitted");
    Dialog.tipSuccess("任务已提交");
    clearDraft();
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="pt-1 w-5">
                <a-tooltip :content="'SRT字幕文件'" mini>
                    <icon-file />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector :extensions="['srt']" v-model="formData.srt"/>
            </div>
        </div>
        <SoundGenerateForm ref="soundGenerateForm"/>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i class="iconfont icon-submit mr-2"></i>
                {{ "提交任务" }}
            </a-button>
        </div>
    </div>
</template>
