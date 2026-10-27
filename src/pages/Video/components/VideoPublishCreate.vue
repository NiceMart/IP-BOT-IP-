<script setup lang="ts">
import {ref, computed, onMounted} from "vue";
import {$t} from "../../../lang";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import VideoPublishForm from "./VideoPublishForm.vue";
import {TaskService} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {VideoPublishModelConfigType} from "../../../declarations/app";

const serverStore = useServerStore();
const emit = defineEmits<{
    (e: "submitted"): void;
}>();

const config = ref<VideoPublishModelConfigType>({
    video: "",
    bgmFile: "",
    type: "VideoPublish",
    serverKey: "",
    workflows: ["process", "subtitle"],
    videoAsrConfig: {
        param: {}
    },
    videoProcessConfig: {
        param: {
            magnitudeThresholdRatio: 0.015,
            durationThreshold: 0.3,
            failureToleranceRatio: 0.3,
            spaceOnEdges: 0.1,
            silencePartSpeed: 1.5,
            minLoudPartDuration: -1,
            cut: "-1",
            codec: "libx264",
            bitrate: "2000k"
        }
    },
    videoSubtitleConfig: {
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
    },
    videoBgmConfig: {
        param: {
            bgmVolume: 0.3,
            fadeIn: 2.0,
            fadeOut: 2.0,
            mixType: "standard",
            bgmDuration: 0
        }
    },
    videoCoverConfig: {
        param: {
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
        }
    },
    publishConfig: {
        platform: "local",
        title: "",
        description: "",
        tags: [],
        visibility: "public",
        scheduled: false,
        publishTime: ""
    },
    param: {
        outputFormat: "mp4",
        videoQuality: "high",
        preserveOriginal: true
    }
});

const show = ref(false);
const serverVersion = ref("");
const title = ref("");
const isSubmitting = ref(false);

onMounted(() => {
    reset();
});

const reset = () => {
    config.value = {
        video: "",
        bgmFile: "",
        type: "VideoPublish",
        serverKey: "",
        workflows: ["process", "subtitle"],
        videoAsrConfig: {
            param: {}
        },
        videoProcessConfig: {
            param: {
                magnitudeThresholdRatio: 0.015,
                durationThreshold: 0.3,
                failureToleranceRatio: 0.3,
                spaceOnEdges: 0.1,
                silencePartSpeed: 1.5,
                minLoudPartDuration: -1,
                cut: "-1",
                codec: "libx264",
                bitrate: "2000k"
            }
        },
        videoSubtitleConfig: {
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
        },
        videoBgmConfig: {
            param: {
                bgmVolume: 0.3,
                fadeIn: 2.0,
                fadeOut: 2.0,
                mixType: "standard",
                bgmDuration: 0
            }
        },
        videoCoverConfig: {
            param: {
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
            }
        },
        publishConfig: {
            platform: "local",
            title: "",
            description: "",
            tags: [],
            visibility: "public",
            scheduled: false,
            publishTime: ""
        },
        param: {
            outputFormat: "mp4",
            videoQuality: "high",
            preserveOriginal: true
        }
    };
    title.value = $t("一键发布");
    serverVersion.value = "";
};

const submit = async () => {
    if (isSubmitting.value) return;
    if (!config.value.video) {
        window.$message.error($t("请选择视频文件"));
        return;
    }
    if (config.value.workflows.length === 0) {
        window.$message.error($t("请至少选择一个工作流程"));
        return;
    }
    if (config.value.workflows.includes("bgm") && !config.value.bgmFile) {
        window.$message.error($t("选择BGM工作流程时必须指定背景音乐文件"));
        return;
    }

    isSubmitting.value = true;
    try {
        await TaskService.create(
            title.value,
            "VideoPublish",
            {
                ...config.value,
                serverKey: config.value.serverKey || "local",
            },
            {},
        );
        emit("submitted");
        show.value = false;
        reset();
    } catch (e) {
        console.error(e);
    } finally {
        isSubmitting.value = false;
    }
};

const canSubmit = computed(() => {
    return config.value.video && config.value.workflows.length > 0 && !isSubmitting.value;
});
</script>

<template>
    <div class="rounded-xl shadow border p-4 hover:shadow-lg">
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="text-lg font-semibold">{{ $t("创建一键发布任务") }}</div>
            </div>
            <div>
                <a-button v-if="show" @click="show = false">
                    {{ $t("收起") }}
                </a-button>
                <a-button v-else type="primary" @click="show = true">
                    {{ $t("创建任务") }}
                </a-button>
            </div>
        </div>

        <div v-if="show" class="space-y-4">
            <!-- Server Selection -->
            <div>
                <div class="mb-2 flex items-center">
                    <label class="text-sm font-medium text-gray-700">{{
                        $t("处理引擎")
                    }}</label>
                    <a-tooltip :content="$t('选择用于视频发布流水线的处理引擎')" mini>
                        <icon-question-circle class="ml-1 text-gray-400" />
                    </a-tooltip>
                </div>
                <ServerSelector
                    v-model="config.serverKey"
                    v-model:version="serverVersion"
                    task-type="VideoPublish"
                />
            </div>

            <!-- Title -->
            <div>
                <div class="mb-2 flex items-center">
                    <label class="text-sm font-medium text-gray-700">{{
                        $t("任务名称")
                    }}</label>
                </div>
                <TaskTitleField v-model="title" :placeholder="$t('一键发布')" />
            </div>

            <!-- Form -->
            <div>
                <VideoPublishForm v-model="config" />
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end space-x-2 pt-4 border-t">
                <a-button @click="reset">{{ $t("重置") }}</a-button>
                <a-button
                    type="primary"
                    :loading="isSubmitting"
                    :disabled="!canSubmit"
                    @click="submit"
                >
                    {{ $t("提交任务") }}
                </a-button>
            </div>
        </div>
    </div>
</template>