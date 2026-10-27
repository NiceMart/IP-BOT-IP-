<script setup lang="ts">
import {VideoCoverModelConfigType} from "../../../declarations/app";

defineProps<{
    data: VideoCoverModelConfigType;
}>();
</script>

<template>
    <div class="flex flex-wrap gap-1">
        <div class="rounded-md bg-gray-200 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("视频") }}: </span>
            {{ data.video ? $t("已选择") : $t("未选择") }}
        </div>
        <div class="rounded-md bg-blue-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("截图时间") }}: </span>
            {{ data.param.timePointType === "random" ? $t("随机") : data.param.customTimePoint + $t("秒") }}
        </div>
        <div v-if="data.param.textOverlay" class="rounded-md bg-green-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("文字") }}: </span>
            {{ data.param.textOverlay }}
        </div>
        <div v-if="data.param.fontSize" class="rounded-md bg-purple-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("字号") }}: </span>
            {{ data.param.fontSize }}px
        </div>
        <div class="rounded-md bg-yellow-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("位置") }}: </span>
            {{ $t(data.param.position) }}
        </div>
        <div v-if="data.param.effectType" class="rounded-md bg-orange-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("特效") }}: </span>
            {{ $t(data.param.effectType) }}
        </div>
    </div>
</template>