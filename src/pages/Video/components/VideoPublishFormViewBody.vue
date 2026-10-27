<script setup lang="ts">
import {VideoPublishModelConfigType} from "../../../declarations/app";

defineProps<{
    data: VideoPublishModelConfigType;
}>();
</script>

<template>
    <div class="flex flex-wrap gap-1">
        <div class="rounded-md bg-gray-200 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("视频") }}: </span>
            {{ data.video ? $t("已选择") : $t("未选择") }}
        </div>
        <div v-for="workflow in data.workflows" :key="workflow" class="rounded-md bg-blue-100 px-3 py-1 text-sm">
            {{ $t(getWorkflowName(workflow)) }}
        </div>
        <div v-if="data.publishConfig" class="rounded-md bg-green-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("发布平台") }}: </span>
            {{ data.publishConfig.platform }}
        </div>
        <div class="rounded-md bg-purple-100 px-3 py-1 text-sm">
            <span class="text-gray-500">{{ $t("输出格式") }}: </span>
            {{ data.param.outputFormat }}
        </div>
    </div>
</template>

<script lang="ts">
const getWorkflowName = (workflow: string): string => {
    const workflowNames: Record<string, string> = {
        "subtitle": "字幕制作",
        "publish": "一键发布"
    };
    return workflowNames[workflow] || workflow;
};
</script>