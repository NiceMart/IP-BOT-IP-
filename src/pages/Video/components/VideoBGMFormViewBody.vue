<script setup lang="ts">
import {VideoBGMModelConfigType} from "../../../declarations/app";

defineProps<{
    data: VideoBGMModelConfigType;
}>();
</script>

<template>
    <div class="flex flex-wrap gap-1">
        <div class="rounded-md bg-gray-200 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("视频") }}: </span>
            {{ data.video ? $t("已选择") : $t("未选择") }}
        </div>
        <div class="rounded-md bg-gray-200 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("背景音乐") }}: </span>
            {{ data.bgm ? $t("已选择") : $t("未选择") }}
        </div>
        <div class="rounded-md bg-blue-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("BGM音量") }}: </span>
            {{ data.param.bgmVolume }}
        </div>
        <div v-if="data.param.fadeIn > 0" class="rounded-md bg-blue-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("淡入时长") }}: </span>
            {{ data.param.fadeIn }}{{ $t("秒") }}
        </div>
        <div v-if="data.param.fadeOut > 0" class="rounded-md bg-blue-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("淡出时长") }}: </span>
            {{ data.param.fadeOut }}{{ $t("秒") }}
        </div>
        <div class="rounded-md bg-green-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("混合方式") }}: </span>
            {{ data.param.mixType }}
        </div>
    </div>
</template>