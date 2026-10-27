<script setup lang="ts">
import {ref} from "vue";
import {dataAutoSaveDraft} from "../../../../components/common/util";
import {Dialog} from "../../../../lib/dialog";
import {TaskRecord, TaskService} from "../../../../service/TaskService";
import ImageToImageForm from "../../common/ImageToImageForm.vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import ImagePreviewBox from "../../../../components/common/ImagePreviewBox.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const imageToImageForm = ref<InstanceType<typeof ImageToImageForm>>();
const formData = ref({
    image: "",
    prompt: "",
});
const {clearDraft} = dataAutoSaveDraft("ImageToImageCreate.formData", formData.value);

const doSubmit = async () => {
    const imageToImageValue = await imageToImageForm.value?.getValue();
    if (!imageToImageValue) {
        return;
    }
    if (!formData.value.image) {
        Dialog.tipError("请选择图像");
        return;
    }
    if (!formData.value.prompt.trim()) {
        Dialog.tipError("请输入提示");
        return;
    }
    const taskTitle = formData.value.prompt.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "ImageToImage",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            image: formData.value.image,
            prompt: formData.value.prompt,
            imageToImage: imageToImageValue,
        },
        param: {},
    };
    await TaskService.submit(record);
    formData.value.image = "";
    formData.value.prompt = "";
    emit("submitted");
    Dialog.tipSuccess("任务已提交");
    clearDraft();
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="pt-1 w-5">
                <a-tooltip :content="'输入图像'" mini>
                    <icon-video-camera/>
                </a-tooltip>
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <FileSelector :extensions="['png', 'jpg', 'jpeg']" v-model="formData.image"/>
                </div>
                <div v-if="formData.image" class="mt-2">
                    <ImagePreviewBox :url="formData.image"/>
                </div>
            </div>
        </div>
        <ImageToImageForm ref="imageToImageForm"/>
        <div class="mb-4">
            <a-textarea
                v-model="formData.prompt"
                :placeholder="'请输入生成图像的提示'"
                :auto-size="{ minRows: 2, maxRows: 10 }"
            />
        </div>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i class="iconfont icon-submit mr-2"></i>
                {{ "提交任务" }}
            </a-button>
        </div>
    </div>
</template>
