<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {$t} from "../../../lang";

const emit = defineEmits<{
    (e: "update:modelValue", value: VideoCoverModelConfigType): void;
}>();

const props = defineProps<{
    modelValue: VideoCoverModelConfigType;
}>();

const config = computed<VideoCoverModelConfigType>({
    get: () => props.modelValue,
    set: (val) => emit("update:modelValue", val),
});

// Ensure param exists
if (!config.value.param) {
    config.value.param = {
        timePointType: "random",
        customTimePoint: 10,
        textOverlay: "",
        fontSize: 64,
        fontColor: "white",
        position: "bottom-left",
        backgroundColor: true,
        backgroundOpacity: 70,
        maxWidth: 80,
        effectType: "none",
        quality: 95
    };
}

// Watch for changes and emit
watch(config, (newVal) => {
    emit("update:modelValue", newVal);
}, { deep: true });

// File selection handler
const selectVideoFile = async () => {
    const file = await window.$mapi.file.open({
        title: $t("选择视频文件"),
        filters: [
            {
                name: $t("视频文件"),
                extensions: ["mp4", "avi", "mov", "mkv", "webm", "flv", "wmv"],
            },
        ],
    });
    
    if (file) {
        config.value.video = file;
    }
};
</script>

<template>
    <div class="space-y-6">
        <!-- Video File Selection -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("视频文件")
                }}</label>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex-grow">
                    <div class="flex items-center p-3 border border-gray-300 rounded-md bg-gray-50">
                        <div class="flex-grow truncate">
                            {{
                                config.video
                                    ? config.video.split(/[/\\]/).pop()
                                    : $t("未选择视频文件")
                            }}
                        </div>
                        <a-button type="primary" @click="selectVideoFile">
                            {{ $t("选择视频") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Screenshot Time Point -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("截图时间点")
                }}</label>
                <a-tooltip :content="$t('选择截图的时间点，可以是随机或自定义时间')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <a-radio-group v-model="config.param.timePointType" class="w-full">
                <div class="mb-3">
                    <a-radio value="random">{{ $t("随机时间点") }}</a-radio>
                    <div class="ml-6 text-sm text-gray-500">
                        {{ $t("在视频中随机选择一个时间点作为截图位置") }}
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <a-radio value="custom">{{ $t("自定义时间") }}</a-radio>
                    <div v-if="config.param.timePointType === 'custom'" class="flex items-center gap-2">
                        <a-input-number
                            v-model="config.param.customTimePoint"
                            :min="0"
                            :step="1"
                            :precision="1"
                            style="width: 100px"
                        />
                        <span class="text-gray-500">{{ $t("秒") }}</span>
                    </div>
                </div>
            </a-radio-group>
        </div>

        <!-- Text Overlay -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("叠加文字")
                }}</label>
                <a-tooltip :content="$t('在封面上添加的文字内容，留空表示不添加文字')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <a-input
                v-model="config.param.textOverlay"
                :placeholder="$t('请输入要添加的文字')"
                allow-clear
            />
        </div>

        <!-- Font Size -->
        <div v-if="config.param.textOverlay">
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("字体大小")
                }}</label>
                <a-tooltip :content="$t('设置文字的大小，单位为像素')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-3">
                <a-slider
                    v-model="config.param.fontSize"
                    :min="16"
                    :max="200"
                    :step="2"
                    :show-tooltip="true"
                    :format-tooltip="(value) => `${value}px`"
                    class="flex-grow"
                />
                <div class="w-16 text-right">{{ config.param.fontSize }}px</div>
            </div>
        </div>

        <!-- Font Color -->
        <div v-if="config.param.textOverlay">
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("字体颜色")
                }}</label>
            </div>
            <div class="flex items-center gap-3">
                <a-input v-model="config.param.fontColor" placeholder="white" />
                <div class="flex gap-2">
                    <a-button
                        size="small"
                        @click="config.param.fontColor = 'white'"
                        class="bg-gray-100"
                    >{{ $t("白") }}</a-button>
                    <a-button
                        size="small"
                        @click="config.param.fontColor = 'black'"
                        class="bg-gray-800 text-white"
                    >{{ $t("黑") }}</a-button>
                    <a-button
                        size="small"
                        @click="config.param.fontColor = 'red'"
                        class="bg-red-500 text-white"
                    >{{ $t("红") }}</a-button>
                    <a-button
                        size="small"
                        @click="config.param.fontColor = 'yellow'"
                        class="bg-yellow-400"
                    >{{ $t("黄") }}</a-button>
                    <a-button
                        size="small"
                        @click="config.param.fontColor = 'blue'"
                        class="bg-blue-500 text-white"
                    >{{ $t("蓝") }}</a-button>
                </div>
            </div>
        </div>

        <!-- Text Position -->
        <div v-if="config.param.textOverlay">
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("文字位置")
                }}</label>
                <a-tooltip :content="$t('文字在图片中的位置')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <a-radio-group v-model="config.param.position" class="w-full">
                <div class="grid grid-cols-3 gap-3">
                    <a-radio value="top-left">{{ $t("左上") }}</a-radio>
                    <a-radio value="top-right">{{ $t("右上") }}</a-radio>
                    <a-radio value="center">{{ $t("居中") }}</a-radio>
                    <a-radio value="bottom-left">{{ $t("左下") }}</a-radio>
                    <a-radio value="bottom-right">{{ $t("右下") }}</a-radio>
                </div>
            </a-radio-group>
        </div>

        <!-- Background Settings -->
        <div v-if="config.param.textOverlay">
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("背景设置")
                }}</label>
            </div>
            <div class="space-y-3">
                <a-checkbox v-model="config.param.backgroundColor">
                    {{ $t("显示背景") }}
                </a-checkbox>
                
                <div v-if="config.param.backgroundColor" class="flex items-center gap-3">
                    <label class="text-sm text-gray-600">{{ $t("背景透明度") }}:</label>
                    <a-slider
                        v-model="config.param.backgroundOpacity"
                        :min="10"
                        :max="100"
                        :step="10"
                        :show-tooltip="true"
                        :format-tooltip="(value) => `${value}%`"
                        class="flex-grow"
                    />
                    <div class="w-16 text-right">{{ config.param.backgroundOpacity }}%</div>
                </div>
            </div>
        </div>

        <!-- Effect Type -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("特效类型")
                }}</label>
                <a-tooltip :content="$t('选择应用到封面的视觉特效')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <a-select v-model="config.param.effectType" class="w-full">
                <a-option value="none">{{ $t("无特效") }}</a-option>
                <a-option value="brightness">{{ $t("提亮") }}</a-option>
                <a-option value="contrast">{{ $t("增强对比度") }}</a-option>
                <a-option value="saturation">{{ $t("饱和度增强") }}</a-option>
                <a-option value="blur">{{ $t("轻微模糊") }}</a-option>
                <a-option value="sharpen">{{ $t("锐化") }}</a-option>
                <a-option value="vintage">{{ $t("复古风格") }}</a-option>
            </a-select>
        </div>

        <!-- Quality -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("图片质量")
                }}</label>
                <a-tooltip :content="$t('设置输出图片的质量，1-100之间，数值越高质量越好')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-3">
                <a-slider
                    v-model="config.param.quality"
                    :min="10"
                    :max="100"
                    :step="5"
                    :show-tooltip="true"
                    :format-tooltip="(value) => `${value}%`"
                    class="flex-grow"
                />
                <div class="w-16 text-right">{{ config.param.quality }}%</div>
            </div>
        </div>
    </div>
</template>