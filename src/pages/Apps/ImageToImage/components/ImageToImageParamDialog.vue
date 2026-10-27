<script setup lang="ts">
// @ts-nocheck
import { nextTick, ref } from "vue";
import ImageToImageForm from "../../common/ImageToImageForm.vue";

const imageToImageForm = ref<InstanceType<typeof ImageToImageForm> | null>(null);

const props = defineProps<{
}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            imageToImage: TextToImageParamType,
        }
    ];
}>();
const doSubmit = async () => {
    const imageToImageValue = await imageToImageForm.value?.getValue();
    if (!imageToImageValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        imageToImage: imageToImageValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.imageToImage) {
                imageToImageForm.value?.setValue(data.imageToImage);
            }
        });
    },
});

</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="'图生图设置'"
        width="600px"
        :destroyOnClose="true">
        <template #footer>
            <div class="flex justify-end space-x-2">
                <a-button @click="visible = false">取消</a-button>
                <a-button type="primary" @click="doSubmit">保存</a-button>
            </div>
        </template>
        <div v-if="visible" class="space-y-4 overflow-y-auto" style="max-height: calc(100vh - 10rem)">
            <ImageToImageForm ref="imageToImageForm"/>
        </div>
    </a-modal>
</template>
