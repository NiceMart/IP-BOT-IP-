<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {$t} from "../../../lang";

const emit = defineEmits<{
    (e: "update:modelValue", value: VideoPublishModelConfigType): void;
}>();

const props = defineProps<{
    modelValue: VideoPublishModelConfigType;
}>();

const config = computed<VideoPublishModelConfigType>({
    get: () => props.modelValue,
    set: (val) => emit("update:modelValue", val),
});

// Initialize config with defaults if missing
if (!config.value.workflows) {
    config.value.workflows = ["subtitle"];
}

if (!config.value.param) {
    config.value.param = {
        outputFormat: "mp4",
        videoQuality: "high",
        preserveOriginal: true
    };
}

if (!config.value.videoSubtitleConfig) {
    config.value.videoSubtitleConfig = {
        param: {
            fontFamily: "Arial",
            fontSize: 32,
            fontColor: "#FFFFFF",
            highlightColor: "#FFFF00",
            backgroundColor: true,
            backgroundColorOpacity: 80,
            position: "bottom",
            maxWidth: 80,
            wordHighlight: true,
            animationType: "fade-in",
            customCss: ""
        }
    };
}

if (!config.value.publishConfig) {
    config.value.publishConfig = {
        platform: "local",
        title: "",
        description: "",
        tags: [],
        visibility: "public",
        scheduled: false,
        publishTime: ""
    };
}

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

// Workflow management
const availableWorkflows = [
    { key: "subtitle", name: $t("字幕制作"), description: $t("生成精美字幕，支持高亮和动画") },
    { key: "publish", name: $t("一键发布"), description: $t("将视频发布到指定平台") }
];

const toggleWorkflow = (key: string) => {
    const index = config.value.workflows.indexOf(key);
    if (index > -1) {
        config.value.workflows.splice(index, 1);
    } else {
        config.value.workflows.push(key);
    }
};

// Tag management
const tagInput = ref("");
const addTag = () => {
    if (tagInput.value.trim() && !config.value.publishConfig.tags.includes(tagInput.value.trim())) {
        config.value.publishConfig.tags.push(tagInput.value.trim());
        tagInput.value = "";
    }
};

const removeTag = (index: number) => {
    config.value.publishConfig.tags.splice(index, 1);
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

        <!-- Workflow Selection -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("工作流程")
                }}</label>
                <a-tooltip :content="$t('选择要执行的自动化工作流程，将按顺序执行')" mini>
                    <icon-question-circle class="ml-1 text-gray-400" />
                </a-tooltip>
            </div>
            <div class="space-y-3">
                <div v-for="workflow in availableWorkflows" :key="workflow.key" class="flex items-start p-3 border rounded-md">
                    <a-checkbox
                        :model-value="config.workflows.includes(workflow.key)"
                        @change="toggleWorkflow(workflow.key)"
                    />
                    <div class="ml-3 flex-grow">
                        <div class="font-medium">{{ workflow.name }}</div>
                        <div class="text-sm text-gray-500">{{ workflow.description }}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Publish Configuration (if publish workflow is enabled) -->
        <div v-if="config.workflows.includes('publish')">
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("发布配置")
                }}</label>
            </div>
            <div class="space-y-4 p-4 border rounded-md bg-gray-50">
                <!-- Platform -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm font-medium text-gray-700">{{
                            $t("发布平台")
                        }}</label>
                    </div>
                    <a-select v-model="config.publishConfig.platform" class="w-full">
                        <a-option value="local">{{ $t("本地保存") }}</a-option>
                        <a-option value="youtube">{{ $t("YouTube") }}</a-option>
                        <a-option value="bilibili">{{ $t("哔哩哔哩") }}</a-option>
                        <a-option value="douyin">{{ $t("抖音") }}</a-option>
                        <a-option value="xiaohongshu">{{ $t("小红书") }}</a-option>
                    </a-select>
                </div>

                <!-- Title -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm font-medium text-gray-700">{{
                            $t("视频标题")
                        }}</label>
                    </div>
                    <a-input
                        v-model="config.publishConfig.title"
                        :placeholder="$t('请输入视频标题')"
                    />
                </div>

                <!-- Description -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm font-medium text-gray-700">{{
                            $t("视频描述")
                        }}</label>
                    </div>
                    <a-textarea
                        v-model="config.publishConfig.description"
                        :placeholder="$t('请输入视频描述')"
                        :auto-size="{ minRows: 3, maxRows: 5 }"
                    />
                </div>

                <!-- Tags -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm font-medium text-gray-700">{{
                            $t("标签")
                        }}</label>
                    </div>
                    <div class="space-y-2">
                        <div class="flex items-center gap-2">
                            <a-input
                                v-model="tagInput"
                                :placeholder="$t('输入标签后按回车添加')"
                                @press-enter="addTag"
                            />
                            <a-button @click="addTag">{{ $t("添加") }}</a-button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <a-tag
                                v-for="(tag, index) in config.publishConfig.tags"
                                :key="index"
                                closable
                                @close="removeTag(index)"
                            >
                                {{ tag }}
                            </a-tag>
                        </div>
                    </div>
                </div>

                <!-- Visibility -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm font-medium text-gray-700">{{
                            $t("可见性")
                        }}</label>
                    </div>
                    <a-radio-group v-model="config.publishConfig.visibility">
                        <a-radio value="public">{{ $t("公开") }}</a-radio>
                        <a-radio value="unlisted">{{ $t("不公开") }}</a-radio>
                        <a-radio value="private">{{ $t("私密") }}</a-radio>
                    </a-radio-group>
                </div>

                <!-- Schedule -->
                <div>
                    <a-checkbox v-model="config.publishConfig.scheduled">
                        {{ $t("定时发布") }}
                    </a-checkbox>
                    <div v-if="config.publishConfig.scheduled" class="mt-2">
                        <a-date-picker
                            v-model="config.publishConfig.publishTime"
                            style="width: 100%"
                            format="YYYY-MM-DD HH:mm:ss"
                            show-time
                            :placeholder="$t('选择发布时间')"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Output Settings -->
        <div>
            <div class="mb-2 flex items-center">
                <label class="text-sm font-medium text-gray-700">{{
                    $t("输出设置")
                }}</label>
            </div>
            <div class="space-y-3">
                <!-- Output Format -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm text-gray-600">{{
                            $t("输出格式")
                        }}</label>
                    </div>
                    <a-select v-model="config.param.outputFormat" class="w-full">
                        <a-option value="mp4">MP4</a-option>
                        <a-option value="mov">MOV</a-option>
                        <a-option value="avi">AVI</a-option>
                        <a-option value="mkv">MKV</a-option>
                    </a-select>
                </div>

                <!-- Video Quality -->
                <div>
                    <div class="mb-2 flex items-center">
                        <label class="text-sm text-gray-600">{{
                            $t("视频质量")
                        }}</label>
                    </div>
                    <a-select v-model="config.param.videoQuality" class="w-full">
                        <a-option value="low">{{ $t("低质量") }}</a-option>
                        <a-option value="medium">{{ $t("中等质量") }}</a-option>
                        <a-option value="high">{{ $t("高质量") }}</a-option>
                        <a-option value="ultra">{{ $t("极高质量") }}</a-option>
                    </a-select>
                </div>

                <!-- Preserve Original -->
                <div>
                    <a-checkbox v-model="config.param.preserveOriginal">
                        {{ $t("保留原始视频") }}
                    </a-checkbox>
                    <div class="text-sm text-gray-500 ml-6">
                        {{ $t("在处理完成后保留原始视频文件") }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>