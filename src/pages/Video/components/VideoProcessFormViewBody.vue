<script setup lang="ts">
import {computed} from "vue";
import {t} from "../../../lang";

const props = defineProps<{
    data: VideoProcessModelConfigType;
}>();

const videoFileName = computed(() => {
    if (!props.data.video) return "";
    return window.$mapi.file.pathToName(props.data.video, false);
});

const getCutTypeText = (cutType: string) => {
    const cutTypes = {
        "silent": t("裁剪静音部分"),
        "voiced": t("裁剪有声部分"),
        "both": t("同时生成静音和有声两部分")
    };
    return cutTypes[cutType] || cutType;
};
</script>

<template>
    <div>
        <div v-if="data.video" class="flex items-center mb-2">
            <div class="text-gray-500 text-sm">{{ t("视频文件") }}：</div>
            <a-tag class="rounded-lg ml-2">
                <i class="iconfont icon-file mr-1"></i>
                {{ videoFileName }}
            </a-tag>
        </div>
        
        <div v-if="data.param" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div v-if="data.param.magnitudeThresholdRatio" class="flex items-center">
                <span class="text-gray-500">{{ t("静音阈值比例") }}:</span>
                <span class="ml-1">{{ data.param.magnitudeThresholdRatio }}</span>
            </div>
            
            <div v-if="data.param.durationThreshold" class="flex items-center">
                <span class="text-gray-500">{{ t("静音持续时间阈值") }}:</span>
                <span class="ml-1">{{ data.param.durationThreshold }}s</span>
            </div>
            
            <div v-if="data.param.failureToleranceRatio" class="flex items-center">
                <span class="text-gray-500">{{ t("失败容错比例") }}:</span>
                <span class="ml-1">{{ data.param.failureToleranceRatio }}</span>
            </div>
            
            <div v-if="data.param.spaceOnEdges" class="flex items-center">
                <span class="text-gray-500">{{ t("边缘保留时间") }}:</span>
                <span class="ml-1">{{ data.param.spaceOnEdges }}s</span>
            </div>
            
            <div v-if="data.param.silencePartSpeed" class="flex items-center">
                <span class="text-gray-500">{{ t("静音部分加速") }}:</span>
                <span class="ml-1">{{ data.param.silencePartSpeed }}x</span>
            </div>
            
            <div v-if="data.param.minLoudPartDuration" class="flex items-center">
                <span class="text-gray-500">{{ t("最短有声片段") }}:</span>
                <span class="ml-1">{{ data.param.minLoudPartDuration }}s</span>
            </div>
            
            <div v-if="data.param.cut" class="flex items-center">
                <span class="text-gray-500">{{ t("裁剪模式") }}:</span>
                <span class="ml-1">{{ getCutTypeText(data.param.cut) }}</span>
            </div>
        </div>
    </div>
</template>