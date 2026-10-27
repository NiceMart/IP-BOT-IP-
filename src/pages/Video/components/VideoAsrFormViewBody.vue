<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
    data: VideoAsrModelConfigType;
}>();

const videoFileName = computed(() => {
    if (!props.data.video) return "";
    return window.$mapi.file.pathToName(props.data.video, false);
});
</script>

<template>
    <div>
        <div v-if="props.data.video" class="flex items-center">
            <div class="text-gray-500 text-sm">{{ $t("视频文件") }}：</div>
            <a-tag class="rounded-lg ml-2">
                <i class="iconfont icon-file mr-1"></i>
                {{ videoFileName }}
            </a-tag>
        </div>
    </div>
</template>