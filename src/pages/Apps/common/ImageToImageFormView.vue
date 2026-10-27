<script setup lang="ts">
import ImageToImageFormViewBody from "./ImageToImageFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">
            图生图配置
        </div>
        <div>
            <ImageToImageFormViewBody :data="data" />
        </div>
    </div>
</template>
