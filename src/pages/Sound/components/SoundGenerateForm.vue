<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { StorageService } from "../../../service/StorageService";
import { useModelStore } from "../../../module/Model/store/model";
import { getSystemConfigSync } from "../../../service/systemConfig";
import {systemVoiceMapCosyvoice, isVoiceSupportInstruct} from "../config/systemVoices";
import SoundPromptDialog from "./SoundPromptDialog.vue";
import SoundPromptSelector from "./SoundPromptSelector.vue";

const modelStore = useModelStore();

// ==================== TTS 模型配置（与 VideoIPAgent 保持一致） ====================
interface TtsModelConfig {
    id: string;
    name: string;
    model: string;
    speedRange: { min: number; max: number; step: number };
    emotions: string[];
    supportsClone: boolean;
    description: string;
}

const ttsModelConfigs: TtsModelConfig[] = [
    {
        id: 'aliyun-cosyvoice',
        name: 'V1 阿里云 CosyVoice',
        model: 'cosyvoice-v3-flash',
        speedRange: { min: 0.5, max: 2.0, step: 0.1 },
        emotions: ['开心', '悲伤', '愤怒', '恐惧', '惊讶', '厌恶'],
        supportsClone: true,
        description: '阿里云 CosyVoice，中文效果优秀，支持语速调整（0.5-2.0），支持情绪表达（instruction 指令控制）'
    },
    {
        id: 'cosyvoiceV2',
        name: 'T1 多模态语音模型',
        model: 'cosyvoice-v3.5-plus',
        speedRange: { min: 0.5, max: 2.0, step: 0.1 },
        emotions: ['开心', '悲伤', '愤怒', '恐惧', '惊讶', '厌恶'],
        supportsClone: true,
        description: 'T1多模态语音模型：基于CosyVoice v3.5-plus，81种丰富音色，支持音调/语速精细调节，多语言/方言支持，效果更自然'
    }
];

const currentTtsModelConfig = computed(() => {
    return ttsModelConfigs.find(m => m.id === formData.value.onlineTtsModel) || ttsModelConfigs[1];
});

const emotionOptions = computed(() => {
    return [
        { value: '自动', label: '自动' },
        { value: '开心', label: '开心' },
        { value: '悲伤', label: '悲伤' },
        { value: '愤怒', label: '愤怒' },
        { value: '恐惧', label: '恐惧' },
        { value: '惊讶', label: '惊讶' },
        { value: '厌恶', label: '厌恶' }
    ];
});

const speedRange = computed(() => {
    const config = ttsModelConfigs.find(m => m.id === formData.value.onlineTtsModel);
    return config ? config.speedRange : { min: 0.5, max: 2.0, step: 0.1 };
});

const resolveAliyunTtsModelByVoiceId = (voiceId?: string) => {
    if (!voiceId) {
        return "cosyvoice-v3-flash";
    }

    if (voiceId.startsWith("qwen-tts-vc-")) {
        return "qwen3-tts-vc-2026-01-22";
    }

    // CosyVoice v3/v2 音色ID
    if (voiceId.startsWith('long') || voiceId.startsWith('loong')) {
        return 'cosyvoice-v3-flash';
    }

    return "cosyvoice-v3-flash";
};

const formData = ref({
    type: "AliyunTts" as string,
    // 在线TTS模型选择（支持内置或服务端推送）
    onlineTtsModel: "cosyvoiceV2" as string,
    aliyunPromptId: 0 as number | string,
    audioSpeed: 1.0 as number,
    audioEmotion: "自动" as string,
});

// 阿里云API Key（从模型设置读取）
const aliyunApiKey = ref("");

// 加载阿里云API Key
const loadAliyunApiKey = async () => {
    await modelStore.refreshBuildIn();
    const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
    if (dashscopeProvider && dashscopeProvider.data.apiKey) {
        aliyunApiKey.value = dashscopeProvider.data.apiKey;
    } else {
        aliyunApiKey.value = "";
    }
};

// 模型选项列表（动态：合并内置 + 服务端推送）
const modelOptions = computed(() => {
    const options: { value: string; label: string; isServerPush?: boolean; providerId?: string; providerApiKey?: string; providerApiHost?: string }[] = [
        { value: "cosyvoiceV2", label: "T1 多模态语音模型" },
    ]
    // 从 model store 读取服务端推送的 voice-clone 类型模型
    for (const p of modelStore.providers) {
        if (!p.data.enabled) continue
        if (!p.isServerPush) continue
        for (const m of p.data.models) {
            if (!m.enabled) continue
            if (m.types?.includes('voice-clone')) {
                options.push({
                    value: `server_${p.id}_${m.id}`,
                    label: `${m.name} ☁️`,
                    isServerPush: true,
                    providerId: p.id,
                    providerApiKey: p.data.apiKey,
                    providerApiHost: p.data.apiHost,
                })
            }
        }
    }
    return options
})

// 监听模型切换，重置语速超出范围的情况
watch(() => formData.value.onlineTtsModel, (newModel) => {
    const config = ttsModelConfigs.find(m => m.id === newModel);
    if (config) {
        if (formData.value.audioSpeed < config.speedRange.min || formData.value.audioSpeed > config.speedRange.max) {
            formData.value.audioSpeed = 1.0;
        }
    }
});

onMounted(async () => {
    const old = StorageUtil.getObject("SoundGenerateForm.formData");
    // 🔧 强制将已废弃的 aliyun-cosyvoice (V1) 替换为 cosyvoiceV2 (T1)，避免克隆音色 418 错误
    const savedModel = old.onlineTtsModel || "cosyvoiceV2";
    formData.value.onlineTtsModel = savedModel === 'aliyun-cosyvoice' ? 'cosyvoiceV2' : savedModel;
    formData.value.aliyunPromptId = old.aliyunPromptId || 0;
    formData.value.audioSpeed = old.audioSpeed || 1.0;
    formData.value.audioEmotion = old.audioEmotion || "自动";
    
    // 加载阿里云API Key
    await loadAliyunApiKey();
});
watch(
    () => formData.value,
    async value => {
        StorageUtil.set("SoundGenerateForm.formData", value);
    },
    {
        deep: true,
    }
);

const getValue = async (): Promise<SoundGenerateParamType | undefined> => {
    const data: any = {};
    data.type = "AliyunTts";
    data.onlineTtsModel = formData.value.onlineTtsModel;

    // 获取选择的音色
    if (!formData.value.aliyunPromptId) {
        Dialog.tipError(t("请选择声音音色"));
        return;
    }
    
    data.promptId = formData.value.aliyunPromptId;
    
    // 音色映射已从 config/systemVoices.ts 统一导入
    let voiceId = "longanhuan";
    let promptTitle = "默认音色";
    let isSystemVoice = false;

    let targetModel = 'cosyvoice-v3.5-plus';
    if (typeof formData.value.aliyunPromptId === 'string' && formData.value.aliyunPromptId.startsWith('sys_')) {
        voiceId = systemVoiceMapCosyvoice[formData.value.aliyunPromptId] || "longanhuan";
        promptTitle = `系统音色-${voiceId}`;
        isSystemVoice = true;
        // 系统音色 ID 格式对齐 cosyvoice-v3-flash，必须使用 cosyvoice-v3-flash 模型
        targetModel = 'cosyvoice-v3-flash';
    } else {
        const prompt = await StorageService.get(formData.value.aliyunPromptId as number);
        if (!prompt) {
            Dialog.tipError(t("声音音色不存在"));
            return;
        }
        promptTitle = prompt.title;
        voiceId = prompt.content.aliyunVoiceId || "longanhuan";
        // 使用音色存储的 targetModel（兼容旧音色：默认 cosyvoice-v3.5-plus）
        targetModel = prompt.content?.targetModel || 'cosyvoice-v3.5-plus';
        isSystemVoice = false;
    }
    
    const modelOption = modelOptions.value.find(o => o.value === formData.value.onlineTtsModel);
    const modelLabel = modelOption ? modelOption.label : "T1 多模态语音模型";

    data.serverName = "Aliyun";
    data.serverTitle = modelLabel;
    data.serverVersion = "1.0.0";
    data.promptTitle = promptTitle;

    // V1 阿里云 CosyVoice 模型处理
    if (formData.value.onlineTtsModel === "aliyun-cosyvoice") {
        data.type = "AliyunCosyVoice";
        data.model = "cosyvoice-v3-flash";
        data.voice = voiceId || "longanhuan";
        data.speed = formData.value.audioSpeed;
        data.emotion = formData.value.audioEmotion === '自动' ? undefined : formData.value.audioEmotion;
        return data;
    }
    
    // T1多模态语音模型：使用 CosyVoice V2 API（SpeechSynthesizer端点）
    let v2VoiceId = 'longanhuan';
    if (isSystemVoice) {
        v2VoiceId = systemVoiceMapCosyvoice[formData.value.aliyunPromptId] || 'longanhuan';
    } else {
        v2VoiceId = voiceId;
    }

    // 服务端推送的语音模型
    if (formData.value.onlineTtsModel.startsWith('server_') && modelOption?.isServerPush) {
        data.cosyvoiceV2Config = {
            apiKey: modelOption.providerApiKey || aliyunApiKey.value || getSystemConfigSync().aliyun_bailian_api_key,
            model: targetModel,
            voice: v2VoiceId,
            format: "mp3",
            sampleRate: 24000,
            volume: 100,
            rate: formData.value.audioSpeed,
            pitch: 1.0,
        };
        data.serverName = modelOption.providerId || 'ServerPush';
        return data;
    }

    data.cosyvoiceV2Config = {
        apiKey: aliyunApiKey.value || getSystemConfigSync().aliyun_bailian_api_key,
        model: targetModel,
        voice: v2VoiceId,
        format: "mp3",
        sampleRate: 24000,
        volume: 100,
        rate: formData.value.audioSpeed,
        pitch: 1.0,
    };
    return data;
};

const setValue = (data: Partial<SoundGenerateParamType>) => {
    if ((data as any).onlineTtsModel !== undefined) {
        formData.value.onlineTtsModel = (data as any).onlineTtsModel;
    }
    if ((data as any).aliyunPromptId !== undefined) {
        formData.value.aliyunPromptId = (data as any).aliyunPromptId;
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2 text-gray-200">
            <div class="inline-block w-5">
                <icon-settings />
            </div>
            {{ $t("声音合成配置") }}
        </div>
        <!-- 模型选择（下拉框） -->
        <div class="flex items-center min-h-8 gap-2 mb-2">
            <div class="pt-1 text-gray-200">
                <a-tooltip :content="$t('在线TTS模型')" mini>
                    <i class="iconfont icon-server"></i>
                </a-tooltip>
            </div>
            <div class="flex-1">
                <a-select 
                    v-model="formData.onlineTtsModel" 
                    class="dark-input-override"
                    size="small"
                    :placeholder="modelOptions.length ? $t('选择TTS模型') : '未配置语音模型（请在后台添加）'"
                >
                    <a-option v-for="opt in modelOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                    </a-option>
                </a-select>
            </div>
        </div>
        <!-- 模型说明 -->
        <div class="text-xs text-gray-500 mb-2 ml-6">
            {{ currentTtsModelConfig.description }}
        </div>
        <!-- 语速选择 -->
        <div class="flex items-center min-h-8 gap-2 mb-2">
            <div class="pt-1 text-gray-200">
                <a-tooltip :content="$t('语速')" mini>
                    <i class="iconfont icon-speed"></i>
                </a-tooltip>
            </div>
            <div class="flex-1">
                <a-input-number
                    v-model="formData.audioSpeed"
                    :min="speedRange.min"
                    :max="speedRange.max"
                    :step="speedRange.step"
                    size="small"
                    class="w-full dark-input-override"
                />
            </div>
        </div>
        <!-- 情绪选择 -->
        <div class="flex items-center min-h-8 gap-2 mb-2">
            <div class="pt-1 text-gray-200">
                <a-tooltip :content="$t('情绪')" mini>
                    <i class="iconfont icon-emotion"></i>
                </a-tooltip>
            </div>
            <div class="flex-1">
                <a-select v-model="formData.audioEmotion" size="small" class="w-full dark-input-override">
                    <a-option v-for="opt in emotionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                </a-select>
            </div>
        </div>
        <!-- 音色选择 -->
        <div class="flex items-center min-h-8 gap-2">
            <div class="pt-1 text-gray-200">
                <a-tooltip :content="$t('声音音色')" mini>
                    <i class="iconfont icon-sound-prompt"></i>
                </a-tooltip>
            </div>
            <div class="mr-2 flex items-center w-full">
                <SoundPromptSelector v-model="formData.aliyunPromptId" class="dark-input-override w-full" :ttsModel="formData.onlineTtsModel" />
            </div>
        </div>
    </div>
    <SoundPromptDialog :ttsModel="formData.onlineTtsModel" />
</template>

<style scoped>
::deep(.icon-settings), 
::deep(.icon-server),
::deep(.icon-sound-prompt) {
    color: #e5e7eb !important;
}
</style>
