<script setup lang="ts">
// @ts-nocheck
import {t} from "../../lang";
import {doOpenFile} from "./util";

const props = defineProps<{
    modelValue: string;
}>();
const emit = defineEmits<{
    "update:modelValue": [string];
}>();
const onSelectAudioFile = async () => {
    const result = await doOpenFile({extensions: ['mp4']})
    if (result) {
        emit("update:modelValue", result);
    }
};
</script>

<template>
    <a-tooltip v-if="modelValue" :content="modelValue" mini>
        <div
            class="flex-grow text-sm text-black rounded-lg leading-7 min-w-64 px-3 min-h-7 border border-gray-500 cursor-default select-none"
        >
            <icon-file/>
            {{ modelValue.split("/").pop() || modelValue.split("\\").pop() }}
        </div>
    </a-tooltip>
    <a-button @click="onSelectAudioFile" class="flex-grow w-64">
        <i class="iconfont icon-upload mr-2"></i>
        {{ modelValue ? t("重新选择") : t("选择视频文件") }}({{ t("支持MP4格式") }})
    </a-button>
</template>

