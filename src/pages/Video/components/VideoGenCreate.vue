<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {StorageUtil} from "../../../lib/storage";
import {TimeUtil} from "../../../lib/util";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";
import {StorageService} from "../../../service/StorageService";
import SoundPromptSelector from "../../Sound/components/SoundPromptSelector.vue";
import {systemVoiceMapCosyvoice} from "../../Sound/config/systemVoices";
import {useModelStore} from "../../../module/Model/store/model";
import { getSystemConfigSync } from "../../../service/systemConfig";
import VideoGenForm from "./VideoGenForm.vue";

const videoGenForm = ref<InstanceType<typeof VideoGenForm> | null>(null);
const modelStore = useModelStore();

const modelConfig = ref(null);
const formData = ref({
    soundType: "soundGenerate",
    soundPromptId: 0,  // 音色ID（支持系统音色字符串ID或用户音色数字ID）
    soundText: "",      // 合成文本
    soundCustomFile: "",
});

const videoTemplateRecords = ref<VideoTemplateRecord[]>([]);

onMounted(() => {
    const old = StorageUtil.getObject("VideoGenCreate.formData");
    formData.value.soundType = old.soundType || "soundGenerate";
    formData.value.soundPromptId = old.soundPromptId || 0;
    formData.value.soundText = old.soundText || "";
    formData.value.soundCustomFile = old.soundCustomFile || "";
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("VideoGenCreate.formData", value);
    },
    {
        deep: true,
    }
);

// 合成音频函数
const synthesizeAudio = async (promptId: number | string, text: string): Promise<string> => {
    try {
        let voiceId = '';
        
        // 🎯 步骤1：获取音色配置
        if (typeof promptId === 'string' && promptId.startsWith('sys_')) {
            // 系统默认音色 - 使用统一音色映射
            voiceId = systemVoiceMapCosyvoice[promptId] || 'longanhuan';
        } else {
            // 用户自定义音色 - 从数据库获取
            const record = await StorageService.get(promptId as number);
            if (record && record.content && record.content.aliyunVoiceId) {
                voiceId = record.content.aliyunVoiceId;
            } else {
                voiceId = 'longanhuan'; // 兜底使用默认音色
            }
        }
        
        // 🎯 步骤2：获取阿里云API Key
        await modelStore.refreshBuildIn();
        const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
        const apiKey = dashscopeProvider?.data?.apiKey || getSystemConfigSync().aliyun_bailian_api_key;
        
        // 🎯 步骤3：调用TTS服务合成音频
        const result = await (window as any).$mapi.aliyun.cosyvoice.synthesize({
            text: text,
            config: {
                apiKey: apiKey,
                model: 'qwen3-tts-flash',
                voice: voiceId,
                format: 'mp3',
                sampleRate: 22050,
            }
        });
        
        if (!result.success || !result.audioPath) {
            throw new Error(result.error || t("音频合成失败"));
        }
        
        return result.audioPath;
    } catch (error: any) {
        throw new Error(t("音频合成失败") + ": " + error.message);
    }
};

const doSubmit = async () => {
    const videoGenValue = await videoGenForm.value?.getValue();
    if (!videoGenValue) {
        return;
    }
    
    let audioFilePath: string | null = null;
    
    if (formData.value.soundType === "soundGenerate") {
        // 验证音色和文本
        if (!formData.value.soundPromptId) {
            Dialog.tipError(t("请选择音色"));
            return;
        }
        if (!formData.value.soundText || formData.value.soundText.trim() === "") {
            Dialog.tipError(t("请输入要合成的文本"));
            return;
        }
        
        // 调用TTS服务合成音频
        Dialog.loadingOn(t("正在合成音频..."));
        try {
            audioFilePath = await synthesizeAudio(
                formData.value.soundPromptId,
                formData.value.soundText
            );
        } catch (error: any) {
            Dialog.loadingOff();
            Dialog.tipError(error.message);
            return;
        }
        Dialog.loadingOff();
        
    } else if (formData.value.soundType === "soundCustom") {
        audioFilePath = formData.value.soundCustomFile;
        if (!audioFilePath) {
            Dialog.tipError(t("请选择声音文件"));
            return;
        }
    } else {
        Dialog.tipError("unknown soundType");
        return;
    }
    
    const record: TaskRecord = {
        biz: "VideoGen",
        title: await window.$mapi.file.textToName(videoGenValue.videoTemplateName + "_" + TimeUtil.datetimeString()),
        serverName: videoGenValue.serverName,
        serverTitle: videoGenValue.serverTitle,
        serverVersion: videoGenValue.serverVersion,
        modelConfig: {
            videoTemplateId: videoGenValue.videoTemplateId,
            videoTemplateName: videoGenValue.videoTemplateName,
            videoTemplateUrl: videoGenValue.videoTemplateUrl,
            soundType: formData.value.soundType,
            soundPromptId: formData.value.soundPromptId,
            soundText: formData.value.soundText,
            soundAudioFile: audioFilePath,  // 合成或选择的音频文件
            // 保持兼容性
            soundGenerateText: formData.value.soundText,
            soundCustomFile: formData.value.soundType === "soundCustom" ? audioFilePath : "",
        },
        param: videoGenValue.param,
    };
    if (!(await PermissionService.checkForTask("VideoGen", record))) {
        return;
    }
    const id = await TaskService.submit(record);
    Dialog.tipSuccess(t("任务已经提交成功，等待视频生成完成"));
    emit("submitted");
};

const refresh = async (type: "videoTemplate") => {
    if (type === "videoTemplate") {
        videoTemplateRecords.value = await VideoTemplateService.list();
    }
};

const doSoundCustomSelect = async () => {
    const path = await window.$mapi.file.openFile({
        filters: [
            {name: "*.wav", extensions: ["wav"]},
            {name: "*.mp3", extensions: ["mp3"]},
        ],
    });
    if (!path) {
        return;
    }
    formData.value.soundCustomFile = path;
};

const fileName = (fullPath: string) => {
    return fullPath.replace(/\\/g, "/").split("/").pop() || "";
};

const emit = defineEmits({
    submitted: () => true,
});

defineExpose({
    refresh,
});
</script>

<template>
    <div class="video-gen-card rounded-xl shadow-lg border p-5">
        <VideoGenForm ref="videoGenForm" />
        <div class="section-title font-bold mb-3 text-lg">
            <icon-settings class="mr-1" />
            {{ $t("声音配置") }}
        </div>
        <div class="mb-4">
            <div class="mb-3">
                <a-radio-group v-model="formData.soundType">
                    <a-radio value="soundGenerate">
                        <i class="iconfont icon-sound-generate mr-1"></i>
                        {{ $t("声音合成") }}
                    </a-radio>
                    <a-radio value="soundCustom">
                        <icon-file class="mr-1" />
                        {{ $t("本地文件") }}
                    </a-radio>
                </a-radio-group>
            </div>

            <!-- 声音合成模式：音色选择 + 文本输入 -->
            <div v-if="formData.soundType === 'soundGenerate'">
                <div>
                    <div class="label-text mb-2 text-sm">
                        <i class="iconfont icon-sound mr-1"></i>
                        {{ $t("选择音色") }}
                    </div>
                    <SoundPromptSelector v-model="formData.soundPromptId" class="dark-input-override" />
                </div>
                <div>
                    <div class="label-text mb-2 text-sm">
                        <icon-edit class="mr-1" />
                        {{ $t("合成文本") }}
                    </div>
                    <a-textarea
                        v-model="formData.soundText"
                        :placeholder="$t('请输入要合成的文本内容')"
                        :auto-size="{ minRows: 3, maxRows: 8 }"
                        show-word-limit
                        :max-length="500"
                        class="custom-dark-textarea"
                    />
                </div>
            </div>

            <!-- 本地文件模式 -->
            <div v-if="formData.soundType === 'soundCustom'">
                <a-button @click="doSoundCustomSelect">
                    <template #icon>
                        <icon-folder-add />
                    </template>
                    <div v-if="formData.soundCustomFile">
                        {{ fileName(formData.soundCustomFile) }}
                    </div>
                    <div v-else>{{ $t("选择本地文件") }}</div>
                </a-button>
            </div>
        </div>

        <div class="pt-4 border-t border-gray-700">
            <a-button class="mr-2" type="primary" size="large" @click="doSubmit">
                <template #icon>
                    <icon-play-arrow />
                </template>
                {{ $t("开始生成视频") }}
            </a-button>
            <ServerContentInfoAction :config="modelConfig as any" func="videoGen" />
        </div>
    </div>
</template>

<style scoped>
.video-gen-card {
    background-color: #141414;
    border: 1px solid #333;
    box-shadow: none;
}

.section-title {
    color: #ffffff;
    border-bottom: 1px solid #333;
    padding-bottom: 8px;
    font-size: 16px;
    font-weight: 600;
}

.label-text {
    color: #9ca3af;
    font-weight: 500;
}

:deep(.custom-dark-textarea) {
    background-color: #1a1a1a !important;
    border-color: #333 !important;
    color: #e5e7eb !important;
}

:deep(.custom-dark-textarea:hover),
:deep(.custom-dark-textarea:focus) {
    border-color: #4b5563 !important;
}

:deep(.arco-textarea-wrapper) {
    background-color: #1a1a1a;
    border-color: #333;
}

:deep(.arco-btn) {
    color: #e5e7eb;
    background: #2a2a2a;
    border-color: #4b5563;
}

:deep(.arco-radio-label) {
    color: #e5e7eb;
}

:deep(.arco-radio-checked .arco-radio-label) {
    color: #fff;
}
</style>
