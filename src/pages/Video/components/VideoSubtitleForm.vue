<script setup lang="ts">
import {ref, reactive} from "vue";
import {t} from "../../../lang";

// Font family options
const fontFamilies = [
    { value: "Arial", label: "Arial" },
    { value: "Helvetica", label: "Helvetica" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Georgia", label: "Georgia" },
    { value: "Verdana", label: "Verdana" },
    { value: "Courier New", label: "Courier New" },
    { value: "Microsoft YaHei", label: "微软雅黑" },
    { value: "SimHei", label: "黑体" },
    { value: "SimSun", label: "宋体" },
    { value: "KaiTi", label: "楷体" }
];

// Subtitle positioning options
const positions = [
    { value: "bottom", label: "底部" },
    { value: "center", label: "居中" },
    { value: "top", label: "顶部" }
];

const paramForm = reactive({
    fontFamily: "Arial",
    fontSize: 24,
    fontColor: "#FFFFFF",
    highlightColor: "#FFD700",
    backgroundColor: false,
    backgroundColorOpacity: 0.7,
    position: "bottom",
    maxWidth: 80,
    wordHighlight: true,
    animationType: "fade",
    customCss: ""
});

const getValue = () => {
    return {
        type: "VideoSubtitle",
        serverKey: "SubtitleEngine",
        serverName: "高亮字幕引擎",
        serverVersion: "1.0.0",
        param: paramForm,
    };
};

defineExpose({
    getValue
});
</script>

<template>
    <div class="space-y-4">
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("字体设置") }}</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("字体") }}
                    </label>
                    <a-select v-model="paramForm.fontFamily" class="w-full">
                        <a-option v-for="font in fontFamilies" :key="font.value" :value="font.value">
                            {{ font.label }}
                        </a-option>
                    </a-select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("字号大小") }} (px)
                    </label>
                    <a-input-number 
                        v-model="paramForm.fontSize" 
                        :min="12" 
                        :max="48" 
                        :step="1"
                        class="w-full"
                    />
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("文字颜色") }}
                    </label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="paramForm.fontColor" />
                        <a-input 
                            v-model="paramForm.fontColor" 
                            placeholder="#FFFFFF"
                            class="flex-grow"
                        />
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("高亮颜色") }}
                    </label>
                    <div class="flex items-center gap-2">
                        <a-color-picker v-model="paramForm.highlightColor" />
                        <a-input 
                            v-model="paramForm.highlightColor" 
                            placeholder="#FFD700"
                            class="flex-grow"
                        />
                    </div>
                </div>
            </div>
        </div>
        
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("背景设置") }}</h4>
            
            <div class="flex items-center mb-2">
                <a-checkbox v-model="paramForm.backgroundColor">
                    {{ t("启用背景") }}
                </a-checkbox>
                <div v-if="paramForm.backgroundColor" class="ml-4">
                    <label class="text-sm text-gray-700 mr-2">
                        {{ t("透明度") }}: {{ Math.round(paramForm.backgroundColorOpacity * 100) }}%
                    </label>
                    <a-slider 
                        v-model="paramForm.backgroundColorOpacity"
                        :min="0" 
                        :max="1" 
                        :step="0.1"
                        style="width: 200px"
                    />
                </div>
            </div>
        </div>
        
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("位置设置") }}</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("字幕位置") }}
                    </label>
                    <a-select v-model="paramForm.position" class="w-full">
                        <a-option v-for="pos in positions" :key="pos.value" :value="pos.value">
                            {{ pos.label }}
                        </a-option>
                    </a-select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("最大宽度") }} (%)
                    </label>
                    <a-input-number 
                        v-model="paramForm.maxWidth" 
                        :min="50" 
                        :max="100" 
                        :step="5"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("字幕宽度占视频宽度的百分比") }}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("高亮设置") }}</h4>
            
            <div class="mb-2">
                <a-checkbox v-model="paramForm.wordHighlight">
                    {{ t("启用词语高亮") }}
                </a-checkbox>
                <div class="text-xs text-gray-500 ml-4">
                    {{ t("根据语音时间轴逐词高亮显示") }}
                </div>
            </div>
            
            <div v-if="paramForm.wordHighlight">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("高亮动画") }}
                </label>
                <a-select v-model="paramForm.animationType" class="w-full">
                    <a-option value="fade">{{ t("淡入淡出") }}</a-option>
                    <a-option value="scale">{{ t("缩放") }}</a-option>
                    <a-option value="underline">{{ t("下划线") }}</a-option>
                    <a-option value="none">{{ t("无动画") }}</a-option>
                </a-select>
            </div>
        </div>
        
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("高级设置") }}</h4>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("自定义CSS") }} ({{ t("可选") }})
                </label>
                <a-textarea 
                    v-model="paramForm.customCss"
                    :placeholder="t('输入自定义CSS代码，会覆盖上述设置')"
                    :auto-size="{ minRows: 3, maxRows: 5 }"
                    class="w-full font-mono text-sm"
                />
                <div class="text-xs text-gray-500 mt-1">
                    {{ t("高级用户可以使用自定义CSS精确控制字幕外观") }}
                </div>
            </div>
        </div>
    </div>
</template>