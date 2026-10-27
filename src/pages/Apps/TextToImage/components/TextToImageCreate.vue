<script setup lang="ts">
import { ref } from "vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import TextToImageForm from "../../common/TextToImageForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const textToImageForm = ref<InstanceType<typeof TextToImageForm>>();
const formData = ref({
    prompt: "",
});
const {clearDraft} = dataAutoSaveDraft("TextToImageCreate.formData", formData.value);

const doSubmit = async () => {
    const textToImageValue = await textToImageForm.value?.getValue();
    if (!textToImageValue) {
        return;
    }
    if (!formData.value.prompt.trim()) {
        Dialog.tipError("请输入文本");
        return;
    }
    const taskTitle = formData.value.prompt.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "TextToImage",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            prompt: formData.value.prompt,
            textToImage: textToImageValue,
        },
        param: {},
    };
    await TaskService.submit(record);
    formData.value.prompt = "";
    emit("submitted");
    Dialog.tipSuccess("任务已提交");
    clearDraft();
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4">
            <div class="mb-2 font-bold">{{ "提示词" }}</div>
            <a-textarea
                v-model="formData.prompt"
                :placeholder="'请输入生成图像的提示'"
                :auto-size="{ minRows: 2, maxRows: 10 }"
            />
        </div>
        <TextToImageForm ref="textToImageForm"/>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i class="iconfont icon-submit mr-2"></i>
                {{ "提交任务" }}
            </a-button>
        </div>
    </div>
</template>
