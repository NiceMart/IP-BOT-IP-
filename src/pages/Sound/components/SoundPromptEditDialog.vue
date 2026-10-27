<script setup lang="ts">
import {ref, computed} from "vue";
import { IconInfoCircle, IconUpload, IconThunderbolt } from "@arco-design/web-vue/es/icon";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import {AudioUtil} from "../../../lib/audio";
import WebFileSelectButton from "../../../components/common/WebFileSelectButton.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {StorageService} from "../../../service/StorageService";
import {DataService} from "../../../service/DataService";
import {useModelStore} from "../../../module/Model/store/model";
import { getSystemConfigSync } from "../../../service/systemConfig";
import {GlobalEvent} from "../../../lib/event";
// 🔧 在渲染进程中访问 ipcRenderer (已通过 preload 暴露)
const { ipcRenderer } = window.require('electron');

const visible = ref(false);
const audioPlayer = ref<InstanceType<typeof AudioPlayer>>();

const enrolling = ref(false);
const modelStore = useModelStore();

const formData = ref({
    name: "",
    promptWav: "",
    promptText: "",
    aliyunVoiceId: "",
});

const editId = ref<number | null>(null);

const add = () => {
    editId.value = null;
    formData.value.name = "";
    formData.value.promptWav = "";
    formData.value.promptText = "";
    formData.value.aliyunVoiceId = "";
    visible.value = true;
};

const edit = (record: any) => {
    editId.value = record.id;
    formData.value.name = record.title;
    formData.value.promptWav = record.content.url;
    formData.value.promptText = record.content.promptText;
    formData.value.aliyunVoiceId = record.content.aliyunVoiceId || "";
    visible.value = true;
    // 延迟设置音频，等待组件渲染
    setTimeout(() => {
        if (record.content.url) {
            // 这里假设audioPlayer有加载URL的方法，或者只是显示。
            // 目前AudioPlayer似乎主要用于录制或显示buffer。
            // 如果是文件路径，可能需要setRecordFromFile的变体或直接通过url播放
            // 但AudioPlayer作为编辑器，最好能加载文件。
            // 简化处理：编辑时暂不自动加载音频波形，用户可重新上传。
            // 或者如果AudioPlayer支持url prop... 它确实支持 :url
        }
    }, 100);
};

// 🔧 处理音色ID显示 - UI隐藏提供商前缀，内部仍保留完整ID
const VOICE_ID_PREFIXES = ['qwen-tts-vc-', 'cosyvoice-v3-flash-', 'cosyvoice-v3.5-plus-'];

const stripVoiceIdPrefix = (voiceId: string) => {
    if (!voiceId) return '';
    const prefix = VOICE_ID_PREFIXES.find(item => voiceId.startsWith(item));
    return prefix ? voiceId.slice(prefix.length) : voiceId;
};

const restoreVoiceIdPrefix = (displayValue: string, currentValue: string) => {
    if (!displayValue) return '';
    if (VOICE_ID_PREFIXES.some(prefix => displayValue.startsWith(prefix))) {
        return displayValue;
    }
    const currentPrefix = VOICE_ID_PREFIXES.find(prefix => currentValue?.startsWith(prefix));
    return currentPrefix ? `${currentPrefix}${displayValue}` : displayValue;
};

const displayVoiceId = computed({
    get: () => stripVoiceIdPrefix(formData.value.aliyunVoiceId || ''),
    set: (value: string) => {
        formData.value.aliyunVoiceId = restoreVoiceIdPrefix(value || '', formData.value.aliyunVoiceId || '');
    }
});

// 选择音频文件
const onSelectFile = async (file: File) => {
    try {
        await audioPlayer.value?.setRecordFromFile(file);
        // 保存文件路径供后续使用
        formData.value.promptWav = file.name; // 临时存储，实际保存时会转换
    } catch (error) {
        console.error('加载音频文件失败:', error);
        Dialog.tipError(t("加载音频文件失败"));
    }
};

const doOneKeyEnroll = async () => {
    if (!formData.value.name) {
        Dialog.tipError(t("请先输入音色名称"));
        return;
    }
    
    // 1. 获取音频路径
    let audioPath = formData.value.promptWav;
    const audioBuffer = audioPlayer.value?.getAudioBuffer();
    
    // 如果有新的录音/编辑但还没保存，先保存为临时文件
    if (audioBuffer) {
        try {
             const duration = AudioUtil.audioBufferDuration(audioBuffer);
             if (duration < 6 || duration > 60) { // 阿里云限制6~60s
                 Dialog.tipError(t("复刻音频时长需在 6~60 秒之间"));
                 return;
             }
             const wav = AudioUtil.audioBufferToWav(audioBuffer);
             audioPath = await DataService.saveBuffer("wav", wav);
             formData.value.promptWav = audioPath; // 临时保存供后续使用
        } catch (e: any) {
            console.error("[音色克隆] 处理音频失败:", e);
            const errMsg = e?.message || e?.toString() || "";
            // 识别常见错误并给出友好提示
            if (errMsg.includes('ENOENT') || errMsg.includes('no such file')) {
                Dialog.tipError(t("文件存储路径无效，请在设置中检查文件存储路径是否存在"));
            } else {
                Dialog.tipError(t("处理音频失败") + ": " + errMsg);
            }
            return;
        }
    } else if (!audioPath) {
        Dialog.tipError(t("请先录制或上传音频"));
        return;
    }

    // 2. 获取 API Key 和 OSS 配置
    await modelStore.refreshBuildIn();
    const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
    // 🔧 如果用户没配置，使用内置的硬编码 API Key
    const apiKey = dashscopeProvider?.data?.apiKey || getSystemConfigSync().aliyun_bailian_api_key;
    // 获取 OSS 配置（复刻需要上传音频到 OSS 获取公网 URL）
    // 优先从 builtInAliyun 提供商获取（含系统配置的 OSS），再从系统配置兜底
    const builtInAliyunProvider = modelStore.providers.find(p => p.id === 'builtInAliyun');
    const sysCfg = getSystemConfigSync();
    const ossConfig = (builtInAliyunProvider?.data?.ossAccessKeyId || sysCfg.aliyun_oss_access_key_id) ? {
        ossAccessKeyId: builtInAliyunProvider?.data?.ossAccessKeyId || sysCfg.aliyun_oss_access_key_id,
        ossAccessKeySecret: builtInAliyunProvider?.data?.ossAccessKeySecret || sysCfg.aliyun_oss_access_key_secret,
        ossBucket: builtInAliyunProvider?.data?.ossBucket || sysCfg.aliyun_oss_bucket,
        ossRegion: builtInAliyunProvider?.data?.ossRegion || sysCfg.aliyun_oss_region
    } : null;

    // 3. 调用 API
    try {
        enrolling.value = true;
        Dialog.loadingOn(t("正在上传音频并复刻，请稍候..."));
        
        // 调用 IPC（传入 OSS 配置用于上传音频）
        const result = await ipcRenderer.invoke('aliyun:cosyvoice:enroll', {
            apiKey: apiKey,
            audioPath: audioPath,
            name: formData.value.name,
            ossConfig: ossConfig
        });
        
        Dialog.loadingOff();
        
        if (result.success && result.voiceId) {
            // 成功！保存完整的ID（不去掉前缀）
            formData.value.aliyunVoiceId = result.voiceId;
            Dialog.tipSuccess(t("复刻成功！音色ID 已自动填入"));
        } else {
            Dialog.tipError(t("复刻失败: ") + (result.error || "未知错误"));
        }
    } catch (error: any) {
        Dialog.loadingOff();
        Dialog.tipError(t("调用复刻服务异常: ") + error.message);
    } finally {
        enrolling.value = false;
    }
};

const doSave = async () => {
    try {
        if (!formData.value.name) {
            Dialog.tipError(t("请输入名称"));
            return;
        }

        let wav = formData.value.promptWav;
        const audioBuffer = audioPlayer.value?.getAudioBuffer();

        if (audioBuffer) {
            const duration = AudioUtil.audioBufferDuration(audioBuffer);
            if (duration > 60 || duration < 6) {
                Dialog.tipError(t("参考声音需要大于 6s 小于 60s，保证声音清晰可见"));
                return;
            }
            wav = await DataService.saveBuffer("wav", AudioUtil.audioBufferToWav(audioBuffer));
        } else if (!wav) {
            Dialog.tipError(t("请录制声音"));
            return;
        }

        if (!editId.value) {
            const exists = await StorageService.getByTitle("SoundPrompt", formData.value.name);
            if (exists) {
                Dialog.tipError(t("名称重复"));
                return;
            }
        }

        const data = {
            title: formData.value.name,
            content: {
                url: wav,
                promptText: formData.value.promptText,
                aliyunVoiceId: formData.value.aliyunVoiceId,
                targetModel: 'cosyvoice-v3.5-plus',
            },
        };

        if (editId.value) {
            await StorageService.update(editId.value, data);
        } else {
            await StorageService.add("SoundPrompt", data);
        }

        Dialog.tipSuccess(t("保存成功"));
        visible.value = false;
        emit("update");
        
        // 🔧 发布全局事件,通知所有音色选择器刷新
        GlobalEvent.emit('soundPromptUpdated');
        console.log('[SoundPromptEditDialog] 已发布音色更新事件');
    } catch (error: any) {
        Dialog.tipError(t("保存失败: ") + (error?.message || "未知错误"));
    }
};

defineExpose({
    add,
    edit,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ editId ? $t("编辑音色") : $t("添加音色") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSave">
                {{ $t("保存") }}
            </a-button>
        </template>
        <div style="max-height: 60vh">
            <div class="flex">
                <div class="w-1/2 flex-shrink-0 mr-5">
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('名称')" required>
                            <a-input v-model="formData.name" />
                        </a-form-item>
                        <a-form-item :label="$t('参考声音')" required>
                            <div class="w-full">
                                <div class="mb-3">
                                    <a-alert>
                                        {{ $t("参考声音控制在 6～20s，保证声音清晰可见") }}
                                    </a-alert>
                                </div>
                                <div class="mb-3">
                                    <AudioPlayer ref="audioPlayer" show-wave trim-enable record-enable />
                                </div>
                                <div class="mb-3 text-gray-400 flex items-center">
                                    <div class="flex-grow text-sm">
                                        <icon-info-circle />
                                        {{ $t("支持 wav/mp3 格式") }}
                                    </div>
                                    <div>
                                        <WebFileSelectButton @select-file="onSelectFile" accept="audio/wav,audio/mp3">
                                            <a-button>
                                                <template #icon>
                                                    <icon-upload />
                                                </template>
                                                {{ $t("选择声音文件") }}
                                            </a-button>
                                        </WebFileSelectButton>
                                    </div>
                                </div>
                            </div>
                        </a-form-item>
                        <a-form-item :label="$t('参考文字')">
                            <div class="w-full">
                                <div class="mb-3">
                                    <a-input v-model="formData.promptText" />
                                </div>
                                <div class="text-gray-400 text-sm">
                                    <icon-info-circle />
                                    {{ $t("部分模型需要使用，可选填写参考声音的文字内容") }}
                                </div>
                            </div>
                        </a-form-item>
                        <!-- 🔧 新增：音色ID字段 -->
                        <a-form-item :label="$t('音色ID (可选)')">
                            <div class="w-full">
                                <div class="mb-3 flex items-center">
                                    <a-input
                                        v-model="displayVoiceId"
                                        class="flex-grow mr-2"
                                    />
                                    <a-button type="primary" status="success" @click="doOneKeyEnroll" :loading="enrolling">
                                        <template #icon><icon-thunderbolt /></template>
                                        {{ $t("一键复刻") }}
                                    </a-button>
                                </div>
                                <div class="text-gray-400 text-sm">
                                    <icon-info-circle />
                                    {{ $t("仅限复刻音色。如果没有复刻ID，请留空（将使用默认音色）。") }}
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
                <div class="flex-grow">
                    <div class="text-lg font-bold">{{ $t("音色说明") }}</div>
                    <div class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs">
                        <div>{{ $t("1. 请在安静的环境下进行录音，避免噪音干扰") }}</div>
                        <div>{{ $t("2. 请使用标准普通话，吐字清晰，语速适当") }}</div>
                        <div>{{ $t("3. 录音时长控制在 6～20秒 最佳，最多不超过20秒") }}</div>
                        <div>{{ $t("4. 录制完成后先试听看是否达到要求再提交") }}</div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
