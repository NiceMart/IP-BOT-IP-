<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {$t} from "../../../lang";
import SubtitleStyleSelector from "./SubtitleStyleSelector.vue";
import KeywordEffectSelector from "./KeywordEffectSelector.vue";
import KeywordMarker from "./KeywordMarker.vue";

const emit = defineEmits<{
    (e: "update:modelValue", value: VideoBGMModelConfigType): void;
}>();

const props = defineProps<{
    modelValue: VideoBGMModelConfigType;
}>();

const config = computed<VideoBGMModelConfigType>({
    get: () => props.modelValue,
    set: (val) => emit("update:modelValue", val),
});

// Ensure param exists
if (!config.value.param) {
    config.value.param = {
        bgmVolume: 0.3,
        fadeIn: 2.0,
        fadeOut: 2.0,
        mixType: "standard",
        bgmDuration: 0
    };
}

// 字幕相关状态
const subtitleStyleSelector = ref<InstanceType<typeof SubtitleStyleSelector>>();
const keywordEffectSelector = ref<InstanceType<typeof KeywordEffectSelector>>();
const keywordMarker = ref<InstanceType<typeof KeywordMarker>>();

const enableSubtitle = ref(false);
const srtFile = ref("");
const customText = ref("");
const useFunasr = ref(false);
const funasrGenerating = ref(false);
const funasrSegments = ref<any[]>([]);
const funasrLanguage = ref('zh');

const enableKeywordEffects = ref(false);
const enableKeywords = ref(false);
const keywordsExtracting = ref(false);
const extractedKeywords = ref<any[]>([]);
const keywordMarkers = ref<any[]>([]);

// Watch for changes and emit
watch(config, (newVal) => {
    emit("update:modelValue", newVal);
}, { deep: true });

// File selection handlers
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

const selectBgmFile = async () => {
    const file = await window.$mapi.file.open({
        title: $t("选择背景音乐"),
        filters: [
            {
                name: $t("音频文件"),
                extensions: ["mp3", "wav", "ogg", "flac", "aac", "m4a"],
            },
        ],
    });

    if (file) {
        config.value.bgm = file;
    }
};

const selectSrtFile = async () => {
    const file = await window.$mapi.file.open({
        title: $t("选择SRT字幕文件"),
        filters: [
            {
                name: $t("字幕文件"),
                extensions: ["srt", "vtt"],
            },
        ],
    });

    if (file) {
        srtFile.value = file;
    }
};

// FUNASR字幕生成
const generateFunasrSubtitle = async () => {
    if (!config.value.video) {
        window.$message.error($t("请先选择视频文件"));
        return;
    }

    funasrGenerating.value = true;
    try {
        const result = await window.$mapi.ipAgent.generateFunasrSubtitle({
            videoPath: config.value.video,
            language: funasrLanguage.value,
            maxCharsPerLine: 20
        });

        if (result.success) {
            srtFile.value = result.srtPath;
            funasrSegments.value = result.segments;
            window.$message.success($t("FUNASR字幕生成成功"));
        } else {
            window.$message.error(result.message || $t("FUNASR字幕生成失败"));
        }
    } catch (error: any) {
        window.$message.error($t("FUNASR字幕生成失败: ") + (error.message || error));
    } finally {
        funasrGenerating.value = false;
    }
};

// 识别关键词
const extractKeywords = async () => {
    if (!srtFile.value && !customText.value) {
        window.$message.error($t("请先生成或上传字幕"));
        return;
    }

    // 获取字幕文本
    let subtitleText = '';
    if (srtFile.value) {
        try {
            const content = await window.$mapi.file.read(srtFile.value, {isDataPath: false});
            // 从SRT中提取纯文本
            subtitleText = content.replace(/\d+\n/g, '').replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '');
        } catch (error) {
            window.$message.error($t("读取字幕文件失败"));
            return;
        }
    } else {
        subtitleText = customText.value;
    }

    keywordsExtracting.value = true;
    try {
        // TODO: 需要从设置中获取AI模型配置
        const modelConfig = {
            providerId: 'openai',
            modelId: 'gpt-3.5-turbo',
            apiUrl: 'https://api.openai.com/v1/chat/completions',
            apiKey: process.env.OPENAI_API_KEY || ''
        };

        const result = await window.$mapi.ipAgent.extractKeywords({
            subtitleText,
            modelConfig
        });

        if (result.success) {
            extractedKeywords.value = result.keywords;
            window.$message.success($t(`识别到 ${result.keywords.length} 个关键词`));

            // 自动生成关键词标记
            if (keywordMarker.value) {
                keywordMarker.value.autoGenerateMarkers();
            }
        } else {
            window.$message.error(result.message || $t("关键词识别失败"));
        }
    } catch (error: any) {
        window.$message.error($t("关键词识别失败: ") + (error.message || error));
    } finally {
        keywordsExtracting.value = false;
    }
};

// 处理关键词标记变化
const onMarkersChange = (markers: any[]) => {
    keywordMarkers.value = markers;
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

        <!-- BGM File Selection -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("背景音乐")
                }}</label>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex-grow">
                    <div class="flex items-center p-3 border border-gray-300 rounded-md bg-gray-50">
                        <div class="flex-grow truncate">
                            {{
                                config.bgm
                                    ? config.bgm.split(/[/\\]/).pop()
                                    : $t("未选择背景音乐")
                            }}
                        </div>
                        <a-button type="primary" @click="selectBgmFile">
                            {{ $t("选择BGM") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>

        <!-- BGM Volume -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("BGM音量")
                }}</label>
                <a-tooltip :content="$t('背景音乐的音量大小，0-1之间，0表示静音，1表示最大音量')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-3">
                <a-slider
                    v-model="config.param.bgmVolume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    :show-tooltip="true"
                    :format-tooltip="(value) => `${(value * 100).toFixed(0)}%`"
                    class="flex-grow"
                />
                <div class="w-16 text-right">{{ (config.param.bgmVolume * 100).toFixed(0) }}%</div>
            </div>
        </div>

        <!-- Fade In -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("淡入时长")
                }}</label>
                <a-tooltip :content="$t('背景音乐开始时的淡入时长，单位为秒，0表示不淡入')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-3">
                <a-slider
                    v-model="config.param.fadeIn"
                    :min="0"
                    :max="10"
                    :step="0.5"
                    :show-tooltip="true"
                    :format-tooltip="(value) => `${value}s`"
                    class="flex-grow"
                />
                <div class="w-16 text-right">{{ config.param.fadeIn }}s</div>
            </div>
        </div>

        <!-- Fade Out -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("淡出时长")
                }}</label>
                <a-tooltip :content="$t('背景音乐结束时的淡出时长，单位为秒，0表示不淡出')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-3">
                <a-slider
                    v-model="config.param.fadeOut"
                    :min="0"
                    :max="10"
                    :step="0.5"
                    :show-tooltip="true"
                    :format-tooltip="(value) => `${value}s`"
                    class="flex-grow"
                />
                <div class="w-16 text-right">{{ config.param.fadeOut }}s</div>
            </div>
        </div>

        <!-- Mix Type -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("混合方式")
                }}</label>
            </div>
            <a-radio-group v-model="config.param.mixType" class="w-full">
                <div class="mb-2">
                    <a-radio value="standard">{{ $t("标准混合") }}</a-radio>
                    <div class="ml-6 text-sm text-gray-500">
                        {{ $t("保持原音频和背景音乐的标准混合效果") }}
                    </div>
                </div>
                <div class="mb-2">
                    <a-radio value="ducking">{{ $t("闪避效果") }}</a-radio>
                    <div class="ml-6 text-sm text-gray-500">
                        {{ $t("原音频出现时，背景音乐音量自动降低") }}
                    </div>
                </div>
                <div>
                    <a-radio value="replace">{{ $t("替换原音频") }}</a-radio>
                    <div class="ml-6 text-sm text-gray-500">
                        {{ $t("仅使用背景音乐，完全替换原音频") }}
                    </div>
                </div>
            </a-radio-group>
        </div>

        <!-- 字幕功能区域 -->
        <div class="border-t pt-6 mt-6">
            <div class="mb-4 flex items-center">
                <a-checkbox v-model="enableSubtitle">
                    <h4 class="font-medium">添加字幕</h4>
                </a-checkbox>
            </div>

            <div v-if="enableSubtitle" class="space-y-4 ml-6">
                <!-- 字幕来源 -->
                <div class="p-4 bg-gray-50 rounded-lg border">
                    <h5 class="font-medium mb-3">字幕来源</h5>

                    <!-- FUNASR自动识别 -->
                    <div class="mb-3">
                        <a-checkbox v-model="useFunasr">
                            使用 FUNASR 自动语音识别
                        </a-checkbox>
                        <div class="text-xs text-gray-500 ml-6 mt-1">
                            基于FUNASR模型自动识别语音生成字幕，精准同步无偏移
                        </div>
                    </div>

                    <div v-if="useFunasr" class="ml-6 mb-3">
                        <div class="flex items-center gap-3">
                            <a-select v-model="funasrLanguage" class="w-32" size="small">
                                <a-option value="zh">中文</a-option>
                                <a-option value="en">English</a-option>
                            </a-select>

                            <a-button
                                type="primary"
                                size="small"
                                @click="generateFunasrSubtitle"
                                :loading="funasrGenerating"
                            >
                                <template #icon><icon-robot /></template>
                                {{ funasrGenerating ? '识别中...' : '开始识别' }}
                            </a-button>

                            <span v-if="srtFile && funasrSegments.length > 0" class="text-xs text-green-600">
                                ✓ 已生成 {{ funasrSegments.length }} 个字幕段落
                            </span>
                        </div>
                    </div>

                    <!-- 上传SRT文件 -->
                    <div v-if="!useFunasr" class="mb-3 flex items-center">
                        <div class="mr-2 text-gray-400">或</div>
                        <div class="flex-grow">
                            <a-button class="w-full" size="small" @click="selectSrtFile">
                                <template #icon>
                                    <icon-file />
                                </template>
                                {{ srtFile ? srtFile.split(/[/\\]/).pop() : $t("上传SRT字幕文件") }}
                            </a-button>
                        </div>
                    </div>

                    <!-- 自定义文本 -->
                    <div v-if="!useFunasr" class="mb-3">
                        <div class="flex items-center mb-2">
                            <div class="mr-2 text-gray-400">或</div>
                            <div class="flex-grow text-gray-500 text-xs">直接输入字幕内容</div>
                        </div>
                        <a-textarea
                            v-model="customText"
                            :placeholder="$t('请输入字幕内容，每行一条字幕')"
                            :auto-size="{ minRows: 3, maxRows: 6 }"
                            class="w-full"
                            size="small"
                        />
                    </div>
                </div>

                <!-- 字幕样式选择 -->
                <div>
                    <h5 class="font-medium mb-3">基础字幕样式</h5>
                    <SubtitleStyleSelector ref="subtitleStyleSelector" />
                </div>

                <!-- 关键词识别与特效 -->
                <div class="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex-1">
                            <div class="flex items-center gap-3">
                                <a-checkbox v-model="enableKeywordEffects">
                                    <h5 class="font-medium">关键词智能识别与特效</h5>
                                </a-checkbox>
                                <a-tag v-if="!enableKeywordEffects" color="gray" size="small">未启用</a-tag>
                                <a-tag v-else color="blue" size="small">已启用</a-tag>
                            </div>
                            <div class="text-xs text-gray-600 mt-1 ml-6">
                                勾选后启用关键词特效功能，AI自动识别字幕中的关键词并添加醒目的放大特效
                            </div>
                        </div>
                        <a-switch
                            v-model="enableKeywords"
                            :disabled="!enableKeywordEffects"
                            size="small"
                        />
                    </div>

                    <div v-if="enableKeywordEffects && enableKeywords" class="mt-4 space-y-4">
                        <!-- 关键词自动识别说明 -->
                        <div class="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                            <icon-info-circle class="text-blue-500" />
                            <span class="text-xs text-blue-700">
                                关键词将根据字幕内容自动识别和匹配，生成视频时会自动应用特效
                            </span>
                        </div>

                        <!-- 关键词特效选择器 -->
                        <div>
                            <KeywordEffectSelector ref="keywordEffectSelector" />
                        </div>

                        <!-- 关键词标记管理 -->
                        <div v-if="extractedKeywords.length > 0">
                            <KeywordMarker
                                ref="keywordMarker"
                                :keywords="extractedKeywords"
                                :subtitle-segments="funasrSegments"
                                @markers-change="onMarkersChange"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>