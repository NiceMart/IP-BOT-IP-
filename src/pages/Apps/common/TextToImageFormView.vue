<script setup lang="ts">
import TextToImageFormViewBody from "./TextToImageFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();

defineExpose({});
</script>

<template>
    <div class="mb-1">
        <div class="font-bold mb-2">
            文生图配置
        </div>
        <div class="flex gap-1 flex-wrap">
            <TextToImageFormViewBody :data="data" />
        </div>
    </div>
</template>
