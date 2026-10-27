<script setup lang="ts">
import VideoGenFormViewBody from "./VideoGenFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-2">
        <div class="font-bold mb-2">
            {{ $t("语音识别配置") }}
        </div>
        <div>
            <VideoGenFormViewBody :data="data" />
        </div>
    </div>
</template>
