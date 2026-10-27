<script setup lang="ts">
import {ref, reactive} from "vue";
import {t} from "../../../lang";

const paramForm = reactive({
    magnitudeThresholdRatio: 0.02,
    durationThreshold: 0.5,
    failureToleranceRatio: 0.1,
    spaceOnEdges: 0.1,
    silencePartSpeed: null as number | null,
    minLoudPartDuration: -1,
    cut: "silent",
    codec: "",
    bitrate: ""
});

const getValue = () => {
    return {
        type: "VideoProcess",
        serverKey: "JumpCutter",
        serverName: "JumpCutter智能剪辑",
        serverVersion: "1.0.0",
        param: paramForm,
    };
};
</script>

<template>
    <div class="space-y-4">
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("静音检测参数") }}</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("静音阈值比例") }} ({{ t("默认") }}: 0.02)
                    </label>
                    <a-input-number 
                        v-model="paramForm.magnitudeThresholdRatio" 
                        :min="0.001" 
                        :max="0.1" 
                        :step="0.001"
                        :precision="3"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("音频信号值低于最大值的比例将被视为静音") }}
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("静音持续时间阈值") }} ({{ t("默认") }}: 0.5s)
                    </label>
                    <a-input-number 
                        v-model="paramForm.durationThreshold" 
                        :min="0.1" 
                        :max="5" 
                        :step="0.1"
                        :precision="1"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("静音部分达到此秒数才会被裁剪") }}
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("失败容错比例") }} ({{ t("默认") }}: 0.1)
                    </label>
                    <a-input-number 
                        v-model="paramForm.failureToleranceRatio" 
                        :min="0" 
                        :max="0.5" 
                        :step="0.01"
                        :precision="2"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("静音部分中允许非静音信号的比例") }}
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("边缘保留时间") }} ({{ t("默认") }}: 0.1s)
                    </label>
                    <a-input-number 
                        v-model="paramForm.spaceOnEdges" 
                        :min="0" 
                        :max="1" 
                        :step="0.05"
                        :precision="2"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("裁剪静音部分时在边缘保留的时间") }}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="space-y-2">
            <h4 class="font-medium">{{ t("处理选项") }}</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("静音部分处理方式") }}
                    </label>
                    <a-select v-model="paramForm.cut" class="w-full">
                        <a-option value="silent">{{ t("裁剪静音部分") }}</a-option>
                        <a-option value="voiced">{{ t("裁剪有声部分") }}</a-option>
                        <a-option value="both">{{ t("同时生成静音和有声两部分") }}</a-option>
                    </a-select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("静音部分加速") }} ({{ t("可选") }})
                    </label>
                    <a-input-number 
                        v-model="paramForm.silencePartSpeed" 
                        :min="2" 
                        :max="20" 
                        :step="1"
                        :placeholder="t('留空则直接裁剪')"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("不裁剪静音部分而是加速播放") }}
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("最短有声片段") }} ({{ t("默认") }}: -1)
                    </label>
                    <a-input-number 
                        v-model="paramForm.minLoudPartDuration" 
                        :min="-1" 
                        :max="10" 
                        :step="0.1"
                        :precision="1"
                        class="w-full"
                    />
                    <div class="text-xs text-gray-500 mt-1">
                        {{ t("小于此时长的有声部分也会被裁剪，-1表示不限制") }}
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        {{ t("视频编码") }}
                    </label>
                    <a-input 
                        v-model="paramForm.codec" 
                        :placeholder="t('留空使用默认编码')"
                        class="w-full"
                    />
                </div>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("视频比特率") }}
                </label>
                <a-input 
                    v-model="paramForm.bitrate" 
                    :placeholder="t('例如: 2000k')"
                    class="w-full"
                />
            </div>
        </div>
    </div>
</template>