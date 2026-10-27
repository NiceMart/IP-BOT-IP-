<script setup lang="ts">
import { ref } from "vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import SoundGenerateForm from "../../../Sound/components/SoundGenerateForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const formData = ref({
    text: "",
});
const {clearDraft} = dataAutoSaveDraft("LongTextTtsCreate.formData", formData.value);

const doSubmit = async () => {
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    if (!formData.value.text.trim()) {
        Dialog.tipError("请输入长文本");
        return;
    }
    const taskTitle = formData.value.text.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "LongTextTts",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            text: formData.value.text,
            soundGenerate: soundGenerateValue,
        },
        param: {},
    };
    await TaskService.submit(record);
    formData.value.text = "";
    emit("submitted");
    Dialog.tipSuccess("任务已提交");
    clearDraft();
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4">
            <div class="mb-2 font-bold">{{ "长文本" }}</div>
            <a-textarea
                v-model="formData.text"
                :placeholder="'请输入要转换为音频的长文本'"
                :auto-size="{ minRows: 6, maxRows: 20 }"
            />
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
