<script setup lang="ts">
import {computed} from "vue";
import {t} from "../../../lang";

const props = defineProps<{
    data: VideoSubtitleModelConfigType;
}>();

const videoFileName = computed(() => {
    if (!props.data.video) return "";
    return window.$mapi.file.pathToName(props.data.video, false);
});

const srtFileName = computed(() => {
    if (!props.data.srtFile) return "";
    return window.$mapi.file.pathToName(props.data.srtFile, false);
});

const getPositionText = (position: string) => {
    const positions = {
        "bottom": t("底部"),
        "center": t("居中"),
        "top": t("顶部")
    };
    return positions[position] || position;
};

const getAnimationTypeText = (animationType: string) => {
    const animationTypes = {
        "fade": t("淡入淡出"),
        "scale": t("缩放"),
        "underline": t("下划线"),
        "none": t("无动画")
    };
    return animationTypes[animationType] || animationType;
};
</script>

<template>
    <div>
        <div v-if="data.video" class="flex items-center mb-2">
            <div class="text-gray-500 text-sm">{{ t("视频文件") }}：</div>
            <a-tag class="rounded-lg ml-2">
                <i class="iconfont icon-video mr-1"></i>
                {{ videoFileName }}
            </a-tag>
        </div>
        
        <div v-if="data.srtFile" class="flex items-center mb-2">
            <div class="text-gray-500 text-sm">{{ t("SRT文件") }}：</div>
            <a-tag class="rounded-lg ml-2">
                <i class="iconfont icon-file-text mr-1"></i>
                {{ srtFileName }}
            </a-tag>
        </div>
        
        <div v-if="data.customText" class="mb-2">
            <div class="text-gray-500 text-sm mb-1">{{ t("自定义文本") }}：</div>
            <div class="bg-gray-100 rounded p-2 text-sm max-h-20 overflow-y-auto">
                {{ data.customText.substring(0, 200) }}{{ data.customText.length > 200 ? '...' : '' }}
            </div>
        </div>
        
        <div v-if="data.param" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("字体") }}:</span>
                <span class="ml-1">{{ data.param.fontFamily }}</span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("字号") }}:</span>
                <span class="ml-1">{{ data.param.fontSize }}px</span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("文字颜色") }}:</span>
                <span class="ml-1 inline-flex items-center">
                    <span class="inline-block w-4 h-4 rounded mr-1" :style="{ backgroundColor: data.param.fontColor }"></span>
                    {{ data.param.fontColor }}
                </span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("高亮颜色") }}:</span>
                <span class="ml-1 inline-flex items-center">
                    <span class="inline-block w-4 h-4 rounded mr-1" :style="{ backgroundColor: data.param.highlightColor }"></span>
                    {{ data.param.highlightColor }}
                </span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("背景") }}:</span>
                <span class="ml-1">{{ data.param.backgroundColor ? t("启用") + ` (${Math.round(data.param.backgroundColorOpacity * 100)}%)` : t("禁用") }}</span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("位置") }}:</span>
                <span class="ml-1">{{ getPositionText(data.param.position) }}</span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("最大宽度") }}:</span>
                <span class="ml-1">{{ data.param.maxWidth }}%</span>
            </div>
            
            <div class="flex items-center">
                <span class="text-gray-500">{{ t("词语高亮") }}:</span>
                <span class="ml-1">{{ data.param.wordHighlight ? t("启用") : t("禁用") }}</span>
            </div>
            
            <div v-if="data.param.wordHighlight" class="flex items-center">
                <span class="text-gray-500">{{ t("高亮动画") }}:</span>
                <span class="ml-1">{{ getAnimationTypeText(data.param.animationType) }}</span>
            </div>
        </div>
    </div>
</template>