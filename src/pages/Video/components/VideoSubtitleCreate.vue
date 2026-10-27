<script setup lang="ts">
import {ref, reactive} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import VideoSubtitleForm from "./VideoSubtitleForm.vue";
import VideoSelector from "../../../components/common/VideoSelector.vue";
import SubtitleStyleSelector from "./SubtitleStyleSelector.vue";
import KeywordEffectSelector from "./KeywordEffectSelector.vue";
import KeywordMarker from "./KeywordMarker.vue";
import {useSettingStore} from "../../../store/modules/setting";  // 🆕 导入设置store

const setting = useSettingStore();  // 🆕 获取设置

const emit = defineEmits<{
    submitted: [];
}>();

const videoSubtitleForm = ref<InstanceType<typeof VideoSubtitleForm>>();
const subtitleStyleSelector = ref<InstanceType<typeof SubtitleStyleSelector>>();
const keywordEffectSelector = ref<InstanceType<typeof KeywordEffectSelector>>();
const keywordMarker = ref<InstanceType<typeof KeywordMarker>>();

const formData = reactive({
    video: "",
    srtFile: "",
    customText: "",
    useFunasr: false,  // 是否使用FUNASR自动识别
    language: 'zh',    // 语言选择
    enableKeywordEffects: false,  // 是否启用关键词特效(总开关)
    enableKeywords: false,  // 是否启用关键词识别(展开选项)
});

// FUNASR识别状态
const funasrGenerating = ref(false);
const funasrSegments = ref<any[]>([]);

// 关键词识别状态
const keywordsExtracting = ref(false);
const extractedKeywords = ref<any[]>([]);

// 关键词标记
const keywordMarkers = ref<any[]>([]);

const onSelectVideoFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("选择视频文件"),
            filters: [{name: t("视频文件"), extensions: ["mp4", "avi", "mov", "mkv"]}],
        });

        if (filePath) {
            formData.video = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("文件选择失败"));
    }
};

const onSelectSrtFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("选择SRT字幕文件"),
            filters: [{name: t("字幕文件"), extensions: ["srt", "vtt"]}],
        });

        if (filePath) {
            formData.srtFile = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("文件选择失败"));
    }
};

// 使用FUNASR生成字幕
const generateFunasrSubtitle = async () => {
    if (!formData.video) {
        Dialog.tipError(t("请先选择视频文件"));
        return;
    }

    funasrGenerating.value = true;
    try {
        const result = await window.$mapi.ipAgent.generateFunasrSubtitle({
            videoPath: formData.video,
            language: formData.language,
            maxCharsPerLine: 20
        });

        if (result.success) {
            formData.srtFile = result.srtPath;
            funasrSegments.value = result.segments;
            Dialog.tipSuccess(t("FUNASR字幕生成成功"));
        } else {
            Dialog.tipError(result.message || t("FUNASR字幕生成失败"));
        }
    } catch (error: any) {
        Dialog.tipError(t("FUNASR字幕生成失败: ") + (error.message || error));
    } finally {
        funasrGenerating.value = false;
    }
};

// 识别关键词
const extractKeywords = async () => {
    if (!formData.srtFile && !formData.customText) {
        Dialog.tipError(t("请先生成或上传字幕"));
        return;
    }

    // 获取字幕文本
    let subtitleText = '';
    if (formData.srtFile) {
        try {
            const content = await window.$mapi.file.read(formData.srtFile, {isDataPath: false});
            // 从SRT中提取纯文本
            subtitleText = content.replace(/\d+\n/g, '').replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '');
        } catch (error) {
            Dialog.tipError(t("读取字幕文件失败"));
            return;
        }
    } else {
        subtitleText = formData.customText;
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
            Dialog.tipSuccess(t(`识别到 ${result.keywords.length} 个关键词`));

            // 自动生成关键词标记
            if (keywordMarker.value) {
                keywordMarker.value.autoGenerateMarkers();
            }
        } else {
            Dialog.tipError(result.message || t("关键词识别失败"));
        }
    } catch (error: any) {
        Dialog.tipError(t("关键词识别失败: ") + (error.message || error));
    } finally {
        keywordsExtracting.value = false;
    }
};

// 处理关键词标记变化
const onMarkersChange = (markers: any[]) => {
    keywordMarkers.value = markers;
};

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
        const value = await videoSubtitleForm.value?.getValue();
        if (!value) {
            return;
        }

        if (!formData.video) {
            Dialog.tipError(t("请选择视频文件"));
            return;
        }

        if (!formData.srtFile && !formData.customText) {
            Dialog.tipError(t("请选择SRT字幕文件或输入自定义字幕内容"));
            return;
        }

        // 获取字幕样式
        const subtitleStyle = subtitleStyleSelector.value?.getSelectedStyle();

        console.log('[VideoSubtitleCreate] 获取到的字幕样式:', subtitleStyle);
        console.log('[VideoSubtitleCreate] 字幕位置:', subtitleStyle?.position);

        // 获取关键词特效样式(仅在启用时)
        const keywordStyle = formData.enableKeywordEffects ? keywordEffectSelector.value?.getSelectedStyle() : null;

        // 获取启用的关键词标记(仅在启用时)
        const enabledMarkers = formData.enableKeywordEffects ? (keywordMarker.value?.getEnabledMarkers() || []) : [];

        // Generate task title from video filename
        const taskTitle = window.$mapi.file.pathToName(formData.video, false);

        const record: TaskRecord = {
            biz: "VideoSubtitle",
            title: taskTitle,
            serverName: "SubtitleEngine",
            serverTitle: t("高亮字幕引擎"),
            serverVersion: "2.0.0",
            modelConfig: {
                type: "VideoSubtitle",
                serverKey: "SubtitleEngine",
                param: value.param,
                video: formData.video,
                srtFile: formData.srtFile,
                customText: formData.customText,
                subtitleStyle: subtitleStyle,
                keywordStyle: keywordStyle,
                keywordMarkers: enabledMarkers,
                funasrSegments: funasrSegments.value,
            },
            param: {},
        };

        if (!(await PermissionService.checkForTask(value.type, record))) {
            return;
        }

        await TaskService.submit(record);

        // Reset form
        formData.video = "";
        formData.srtFile = "";
        formData.customText = "";
        formData.useFunasr = false;
        formData.enableKeywordEffects = false;
        formData.enableKeywords = false;
        funasrSegments.value = [];
        extractedKeywords.value = [];
        keywordMarkers.value = [];

        emit("submitted");
        Dialog.tipSuccess(t("字幕制作任务已提交"));
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <!-- 视频选择 -->
        <div class="mb-4 flex items-start">
            <div class="mr-1 pt-1">
                <a-tooltip :content="$t('视频文件')" mini>
                    <i class="iconfont icon-video"></i>
                </a-tooltip>
            </div>
            <div class="flex-grow">
                <VideoSelector v-model="formData.video" />
            </div>
        </div>

        <!-- 字幕源选择 -->
        <div class="mb-4 p-4 bg-gray-50 rounded-lg border">
            <h4 class="font-medium mb-3">字幕来源</h4>

            <!-- FUNASR自动识别 -->
            <div class="mb-3">
                <a-checkbox v-model="formData.useFunasr">
                    使用 FUNASR 自动语音识别
                </a-checkbox>
                <div class="text-xs text-gray-500 ml-6 mt-1">
                    基于FUNASR模型自动识别语音生成字幕，精准同步无偏移
                </div>
            </div>

            <div v-if="formData.useFunasr" class="ml-6 mb-3">
                <div class="flex items-center gap-3">
                    <a-select v-model="formData.language" class="w-32" size="small">
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

                    <span v-if="formData.srtFile && funasrSegments.length > 0" class="text-xs text-green-600">
                        ✓ 已生成 {{ funasrSegments.length }} 个字幕段落
                    </span>
                </div>
            </div>

            <!-- 或者：上传SRT文件 -->
            <div v-if="!formData.useFunasr" class="mb-3 flex items-center">
                <div class="mr-2 text-gray-400">或</div>
                <div class="flex-grow">
                    <a-button class="w-full" size="small" @click="onSelectSrtFile">
                        <template #icon>
                            <icon-file />
                        </template>
                        {{ formData.srtFile ? window.$mapi.file.pathToName(formData.srtFile) : $t("上传SRT字幕文件") }}
                    </a-button>
                </div>
            </div>

            <!-- 或者：自定义文本 -->
            <div v-if="!formData.useFunasr" class="mb-3">
                <div class="flex items-center mb-2">
                    <div class="mr-2 text-gray-400">或</div>
                    <div class="flex-grow text-gray-500 text-xs">直接输入字幕内容</div>
                </div>
                <a-textarea
                    v-model="formData.customText"
                    :placeholder="t('请输入字幕内容，每行一条字幕')"
                    :auto-size="{ minRows: 3, maxRows: 6 }"
                    class="w-full"
                    size="small"
                />
            </div>
        </div>

        <!-- 字幕样式选择 -->
        <div class="mb-4">
            <h4 class="font-medium mb-3">基础字幕样式</h4>
            <SubtitleStyleSelector ref="subtitleStyleSelector" />
        </div>

        <!-- 关键词识别与特效 -->
        <div class="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <div class="flex items-center justify-between mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-3">
                        <a-checkbox v-model="formData.enableKeywordEffects">
                            <h4 class="font-medium">关键词智能识别与特效</h4>
                        </a-checkbox>
                        <a-tag v-if="!formData.enableKeywordEffects" color="gray" size="small">未启用</a-tag>
                        <a-tag v-else color="blue" size="small">已启用</a-tag>
                    </div>
                    <div class="text-xs text-gray-600 mt-1 ml-6">
                        勾选后启用关键词特效功能，AI自动识别字幕中的关键词并添加醒目的放大特效
                    </div>
                </div>
                <a-switch
                    v-model="formData.enableKeywords"
                    :disabled="!formData.enableKeywordEffects"
                    size="small"
                />
            </div>

            <div v-if="formData.enableKeywordEffects && formData.enableKeywords" class="mt-4 space-y-4">
                <!-- 关键词自动识别说明 -->
                <div class="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <icon-info-circle class="text-blue-500" />
                    <span class="text-xs text-blue-700">
                        关键词将根据字幕内容自动识别和匹配,生成视频时会自动应用特效
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

        <!-- 高级设置 -->
        <VideoSubtitleForm ref="videoSubtitleForm" />

        <!-- 提交按钮 -->
        <div class="flex gap-2 mt-6">
            <a-button class="flex-grow" type="primary" size="large" @click="doSubmit" :loading="isSubmitting">
                <i class="iconfont icon-subtitles mr-2"></i>
                {{ t("生成字幕视频") }}
            </a-button>
        </div>
    </div>
</template>

<style scoped>
.iconfont {
    font-size: 16px;
}
</style>