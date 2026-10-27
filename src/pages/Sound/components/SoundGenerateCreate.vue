<script setup lang="ts">
import {onMounted, ref} from "vue";
import {StorageUtil} from "../../../lib/storage";
import SoundGenerateForm from "./SoundGenerateForm.vue";
import BatchTextareaInputAction from "../../../components/BatchTextareaInputAction.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {useModelStore} from "../../../module/Model/store/model";
import {getSystemConfigSync} from "../../../service/systemConfig";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const props = defineProps<{
    simpleMode?: boolean;
}>();
const formData = ref({
    text: "",
});

onMounted(async () => {
    const old = StorageUtil.getObject("SoundGenerateCreate.formData");
    formData.value.text = old.text || "";
});

// 情绪 instruction 生成逻辑（V1 AliyunCosyVoice 使用）
const buildEmotionInstruction = (voiceId: string, emotion: string, isSystemVoice: boolean): string => {
    if (!emotion || emotion === '自动') return '';
    
    const emotionMapFixed: Record<string, string> = {
        '开心': 'happy',
        '悲伤': 'sad',
        '愤怒': 'angry',
        '恐惧': 'fearful',
        '惊讶': 'surprised',
        '厌恶': 'disgusted'
    };
    const emotionMapNatural: Record<string, string> = {
        '开心': '请用非常开心的语气说话',
        '悲伤': '请用悲伤的语气说话',
        '愤怒': '请用愤怒的口气说话',
        '恐惧': '请用恐惧的语气说话',
        '惊讶': '请用惊讶的语气说话',
        '厌恶': '请用厌恶的语气说话'
    };

    // 系统音色中只有部分支持 Instruct（固定格式）
    // 复刻音色支持任意自然语言指令
    if (isSystemVoice) {
        const emotionKey = emotionMapFixed[emotion];
        if (emotionKey) {
            return `你说话的情感是${emotionKey}。`;
        }
    } else {
        return emotionMapNatural[emotion] || '';
    }
    return '';
};

const doSubmit = async () => {
    const value = await soundGenerateForm.value?.getValue() as any;
    if (!value) {
        return;
    }
    if (!formData.value.text) {
        Dialog.tipError(t("请输入合成内容"));
        return;
    }

    Dialog.loadingOn(t("正在合成语音..."));
    try {
        let result: any;
        let audioPath: string | undefined;

        if (value.type === "AliyunCosyVoice") {
            // V1 阿里云 CosyVoice 模型
            const isSystemVoice = typeof value.promptId === 'string' && value.promptId.startsWith('sys_');
            let instruction = '';
            if (value.emotion) {
                instruction = buildEmotionInstruction(value.voice || 'longanhuan', value.emotion, isSystemVoice);
            }

            const modelStore = useModelStore();
            await modelStore.refreshBuildIn();
            const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
            const apiKey = dashscopeProvider?.data?.apiKey || getSystemConfigSync().aliyun_bailian_api_key;

            const cosyvoiceParams: any = {
                apiKey,
                model: value.model || 'cosyvoice-v3-flash',
                voice: value.voice || 'longanhuan',
                text: formData.value.text,
                rate: value.speed || 1,
                format: 'mp3',
                sampleRate: 22050,
                ...(instruction ? { instruction } : {})
            };
            result = await window.$mapi.aliyun.cosyvoice.synthesizeRealtime(cosyvoiceParams);
            if (result.success) {
                audioPath = result.audioPath;
            }
        } else if (value.cosyvoiceV2Config) {
            // T1多模态语音模型（cosyvoice-v3.5-plus）
            result = await window.$mapi.aliyun.cosyvoiceV2.synthesize({
                text: formData.value.text,
                config: value.cosyvoiceV2Config
            });
            if (result.success) {
                audioPath = result.audioPath;
            }
        } else {
            result = await window.$mapi.aliyun.cosyvoice.synthesize({
                text: formData.value.text,
                config: value.aliyunConfig
            });
            if (result.success) {
                audioPath = result.audioPath;
            }
        }

        if (result.success && audioPath) {
            Dialog.tipSuccess(t("语音合成成功"));
            const record: TaskRecord = {
                biz: "SoundGenerate",
                title: await window.$mapi.file.textToName(formData.value.text || "tts"),
                serverName: value.serverName,
                serverTitle: value.serverTitle,
                serverVersion: value.serverVersion,
                modelConfig: {
                    type: value.type,
                    text: formData.value.text,
                    ...(value.type === "AliyunCosyVoice" ? {
                        voice: value.voice,
                        model: value.model,
                        speed: value.speed,
                        audioPath: audioPath
                    } : {
                        aliyunConfig: value.aliyunConfig,
                        cosyvoiceV2Config: value.cosyvoiceV2Config,
                        audioPath: audioPath
                    })
                },
            };
            await TaskService.submit(record);
            formData.value.text = "";
            emit("submitted");
        } else {
            Dialog.tipError(t("合成失败") + ": " + (result.error || "未知错误"));
        }
    } catch (error: any) {
        Dialog.tipError(t("合成失败") + ": " + error.message);
    } finally {
        Dialog.loadingOff();
    }
};

const doSubmitBatch = async (records: { text: string }[]) => {
    const value = await soundGenerateForm.value?.getValue() as any;
    if (!value) {
        return;
    }
    Dialog.loadingOn(t("正在批量合成语音..."));
    try {
        for (const r of records) {
            let result: any;
            let audioPath: string | undefined;

            if (value.type === "AliyunCosyVoice") {
                // V1 阿里云 CosyVoice 情绪通过 instruction 控制
                const isSystemVoice = typeof value.promptId === 'string' && value.promptId.startsWith('sys_');
                let instruction = '';
                if (value.emotion) {
                    instruction = buildEmotionInstruction(value.voice || 'longanhuan', value.emotion, isSystemVoice);
                }

                const modelStore = useModelStore();
                await modelStore.refreshBuildIn();
                const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
                const apiKey = dashscopeProvider?.data?.apiKey || getSystemConfigSync().aliyun_bailian_api_key;

                const cosyvoiceParams: any = {
                    apiKey,
                    model: value.model || 'cosyvoice-v3-flash',
                    voice: value.voice || 'longanhuan',
                    text: r.text,
                    rate: value.speed || 1,
                    format: 'mp3',
                    sampleRate: 22050,
                    ...(instruction ? { instruction } : {})
                };
                result = await window.$mapi.aliyun.cosyvoice.synthesizeRealtime(cosyvoiceParams);
                if (result.success) {
                    audioPath = result.audioPath;
                }
            } else if (value.cosyvoiceV2Config) {
                // T1多模态语音模型
                result = await window.$mapi.aliyun.cosyvoiceV2.synthesize({
                    text: r.text,
                    config: value.cosyvoiceV2Config
                });
                if (result.success) {
                    audioPath = result.audioPath;
                }
            } else {
                result = await window.$mapi.aliyun.cosyvoice.synthesize({
                    text: r.text,
                    config: value.aliyunConfig
                });
                if (result.success) {
                    audioPath = result.audioPath;
                }
            }

            if (result.success && audioPath) {
                const record: TaskRecord = {
                    biz: "SoundGenerate",
                    title: await window.$mapi.file.textToName(r.text || "tts"),
                    serverName: value.serverName,
                    serverTitle: value.serverTitle,
                    serverVersion: value.serverVersion,
                    modelConfig: {
                        type: value.type,
                        text: r.text,
                        ...(value.type === "AliyunCosyVoice" ? {
                            voice: value.voice,
                            model: value.model,
                            speed: value.speed,
                            audioPath: audioPath
                        } : {
                            aliyunConfig: value.aliyunConfig,
                            cosyvoiceV2Config: value.cosyvoiceV2Config,
                            audioPath: audioPath
                        })
                    },
                };
                await TaskService.submit(record);
            }
        }
        Dialog.tipSuccess(t("批量合成完成"));
        emit("submitted");
    } catch (error: any) {
        Dialog.tipError(t("合成失败") + ": " + error.message);
    } finally {
        Dialog.loadingOff();
    }
};

const emit = defineEmits({
    submitted: () => true,
});
</script>

<template>
    <div :class="simpleMode ? 'bg-[#141414] border border-[#333] rounded-xl' : 'glass-card rounded-lg overflow-hidden'">
        <div v-if="!simpleMode" class="glass-card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white;">01</div>
                <h3 class="text-base font-semibold" style="color: #e2e8f0;">{{ $t("声音合成") }}</h3>
            </div>
        </div>
        
        <div class="p-4">
            <div class="mb-3">
                <a-textarea
                    v-model="formData.text"
                    class="dark-input-override"
                    :auto-size="{minRows: 4, maxRows: 12}"
                    :placeholder="$t('输入语音内容开始合成')"
                ></a-textarea>
            </div>

            <SoundGenerateForm ref="soundGenerateForm"/>
            <div class="flex gap-1 mt-4">
                <a-button class="mr-2" type="primary" @click="doSubmit">
                    {{ $t("开始合成") }}
                </a-button>
                <BatchTextareaInputAction
                    :text="$t('批量文本合成')"
                    :confirm-text="$t('提交合成')"
                    @submit="doSubmitBatch"
                />
            </div>
        </div>
    </div>
</template>
