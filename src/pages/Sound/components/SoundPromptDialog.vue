<script setup lang="ts">
import {onMounted, ref, computed, watch} from "vue";
import { IconPlus, IconPlayArrow, IconCheck, IconPen, IconEdit, IconDelete, IconExclamationCircleFill, IconVoice } from "@arco-design/web-vue/es/icon";
import {StorageRecord, StorageService} from "../../../service/StorageService";
import SoundPromptEditDialog from "./SoundPromptEditDialog.vue";
import InputInlineEditor from "../../../components/common/InputInlineEditor.vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {useModelStore} from "../../../module/Model/store/model";
import { getSystemConfigSync } from "../../../service/systemConfig";
import {GlobalEvent} from "../../../lib/event";
import {systemVoices as systemVoicesData, SYSTEM_VOICE_CATEGORIES, type SystemVoice} from "../config/systemVoices";
import {useSettingStore} from "../../../store/modules/setting";

const visible = ref(false);
const modelStore = useModelStore();
const settingStore = useSettingStore();

const isSoftLight = computed(() => settingStore.isSoftLightTheme());

const props = defineProps({
    ttsModel: {
        type: String,
        default: 'cosyvoiceV2',
    },
});

const resolveAliyunTtsModelByVoiceId = (voiceId?: string) => {
    if (!voiceId) {
        return 'cosyvoice-v3-flash';
    }

    if (voiceId.startsWith('qwen-tts-vc-')) {
        return 'qwen3-tts-vc-2026-01-22';
    }

    // CosyVoice v3/v2 音色ID（long*_v3, loong*_v3, longanhuan, longanyang 等）
    if (voiceId.startsWith('long') || voiceId.startsWith('loong')) {
        return 'cosyvoice-v3-flash';
    }

    return 'cosyvoice-v3-flash';
};

const editDialog = ref<InstanceType<typeof SoundPromptEditDialog>>();
const records = ref<StorageRecord[]>([]);
const loading = ref(true);

// 🎯 系统默认音色列表（统一数据源）
const systemVoices = ref<SystemVoice[]>(systemVoicesData);

// 🔧 主Tab: 'system' | 'my'
const mainTab = ref<'system' | 'my'>('system');

// 🔧 系统音色子分类筛选
const activeCategory = ref('全部');

// 系统音色子分类（排除"我的音色"和"全部"）
const systemSubCategories = computed(() => {
    return SYSTEM_VOICE_CATEGORIES.filter(c => c.key !== '我的音色');
});

// 根据当前分类显示的音色
const filteredSystemVoices = computed(() => {
    if (activeCategory.value === '全部') return systemVoices.value;
    return systemVoices.value.filter(v => v.category === activeCategory.value);
});

const playingVoiceId = ref<string | null>(null);
const generatingVoiceId = ref<string | null>(null);
const previewAudioUrl = ref<string>('');

// 🔊 试听音频缓存 - 避免重复生成
const voicePreviewCache = ref<Map<string, string>>(new Map());

// 🔧 处理音色ID显示 - 隐藏前缀
const formatVoiceId = (voiceId: string): string => {
    if (!voiceId) return '';
    // 移除已知的音色ID前缀
    return voiceId.replace(/^(cosyvoice-v3-flash-|cosyvoice-v3\.5-plus-|qwen-tts-vc-)/, '');
};

const doRefresh = async () => {
    loading.value = true;
    records.value = await StorageService.list("SoundPrompt");
    loading.value = false;
    emit("update");
    // 🔧 发布全局事件,通知所有音色选择器刷新
    GlobalEvent.emit('soundPromptUpdated');
};

const onChangeTitle = async (record: StorageRecord, value: string) => {
    await StorageService.update(record.id as any, {
        title: value,
    });
    await doRefresh();
};

const doDelete = async (record: StorageRecord) => {
    await Dialog.confirm(t("确认删除？"));
    await StorageService.delete(record);
    await doRefresh();
};

const doEdit = (record: StorageRecord) => {
    editDialog.value?.edit(record);
};

const doSelect = (record: StorageRecord | SystemVoice) => {
    if ('isSystem' in record && record.isSystem) {
        emit("select", record.id as string);
    } else {
        emit("select", (record as StorageRecord).id as number);
    }
    visible.value = false;
};

// 🔊 试听系统音色 - 优先使用预缓存，避免重复生成
const playSystemVoice = async (voice: SystemVoice) => {
    try {
        const memoryCached = voicePreviewCache.value.get(voice.id);
        if (memoryCached) {
            previewAudioUrl.value = memoryCached;
            playingVoiceId.value = voice.id;
            return;
        }

        const preCacheResult = await window.$mapi.aliyun.cosyvoice.getPreCachedVoicePath(voice.id);
        if (preCacheResult.success && preCacheResult.path) {
            const audioUrl = 'file://' + preCacheResult.path;
            previewAudioUrl.value = audioUrl;
            voicePreviewCache.value.set(voice.id, audioUrl);
            playingVoiceId.value = voice.id;
            return;
        }

        generatingVoiceId.value = voice.id;
        Dialog.loadingOn(t("正在生成试听音频..."));

        let apiKey = "";
        await modelStore.refreshBuildIn();
        const dashscopeProvider = modelStore.providers.find(p => p.id === 'dashscope');
        apiKey = dashscopeProvider?.data?.apiKey || getSystemConfigSync().aliyun_bailian_api_key;

        const result = await window.$mapi.aliyun.cosyvoice.synthesize({
            text: `你好，我是${voice.title.split('（')[0]}，很高兴为您服务。`,
            config: {
                apiKey: apiKey,
                model: resolveAliyunTtsModelByVoiceId(voice.aliyunVoiceId),
                voice: voice.aliyunVoiceId,
                format: 'wav',
                sampleRate: 24000,
                saveToPreCache: voice.id
            }
        });

        Dialog.loadingOff();

        if (result.success && result.audioPath) {
            const audioUrl = 'file://' + result.audioPath;
            previewAudioUrl.value = audioUrl;
            voicePreviewCache.value.set(voice.id, audioUrl);
            playingVoiceId.value = voice.id;
        } else {
            Dialog.tipError(t("试听失败") + ": " + (result.error || "未知错误"));
        }
    } catch (error: any) {
        Dialog.loadingOff();
        Dialog.tipError(t("试听失败") + ": " + error.message);
    } finally {
        generatingVoiceId.value = null;
    }
};

// 切换主Tab时重置子分类
watch(mainTab, () => {
    if (mainTab.value === 'system') {
        activeCategory.value = '全部';
    }
    // 切换时停止播放
    playingVoiceId.value = null;
    previewAudioUrl.value = '';
});

const show = (tab?: 'system' | 'my') => {
    visible.value = true;
    if (tab) {
        mainTab.value = tab;
    }
};
defineExpose({
    show,
});

const emit = defineEmits({
    update: () => true,
    select: (id: number | string) => true,
});
onMounted(async () => {
    await doRefresh();
});
</script>

<template>
    <a-modal 
        v-model:visible="visible" 
        width="960px" 
        :footer="false" 
        title-align="start"
        :header-style="isSoftLight ? { backgroundColor: '#f8f9ff', borderBottom: '1px solid rgba(118,129,218,0.24)', color: '#1f2749' } : { backgroundColor: '#000000', borderBottom: '1px solid #333', color: '#fff' }"
        :body-style="isSoftLight ? { backgroundColor: '#f8f9ff', color: '#1f2749', padding: 0 } : { backgroundColor: '#000000', color: '#e2e8f0', padding: 0 }"
        :mask-style="{ backgroundColor: isSoftLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.8)' }"
        :modal-class="isSoftLight ? 'sound-prompt-modal-light' : 'sound-prompt-modal-dark'"
    >
        <template #title>
            <div class="flex items-center">
                <div class="font-bold mr-2">{{ $t("音色管理") }}</div>
            </div>
        </template>
        <div style="height: calc(100vh - 12rem)" class="flex flex-col">
            <!-- 主Tab切换：系统音色 / 我的音色 -->
            <div class="flex-shrink-0 px-5 pt-4 pb-0">
                <div class="voice-main-tabs" :class="isSoftLight ? 'voice-main-tabs-light' : ''">
                    <div 
                        @click="mainTab = 'system'"
                        class="voice-main-tab"
                        :class="{ 
                            'voice-main-tab-active': mainTab === 'system',
                            'voice-main-tab-light': isSoftLight,
                            'voice-main-tab-active-light': mainTab === 'system' && isSoftLight
                        }"
                    >
                        <i class="iconfont icon-sound-generate text-sm mr-1.5"></i>
                        {{ $t("系统音色") }}
                    </div>
                    <div 
                        @click="mainTab = 'my'"
                        class="voice-main-tab"
                        :class="{ 
                            'voice-main-tab-active': mainTab === 'my',
                            'voice-main-tab-light': isSoftLight,
                            'voice-main-tab-active-light': mainTab === 'my' && isSoftLight
                        }"
                    >
                        <icon-voice class="text-sm mr-1.5" />
                        {{ $t("我的音色") }}
                        <span v-if="records.length" class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full" 
                              :class="mainTab === 'my' 
                                ? (isSoftLight ? 'bg-white/30 text-white' : 'bg-white/20 text-white') 
                                : (isSoftLight ? 'bg-[rgba(118,129,218,0.15)] text-[#5f6b93]' : 'bg-white/10 text-gray-400')">
                            {{ records.length }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- 系统音色区域 -->
            <template v-if="mainTab === 'system'">
                <!-- 子分类标签栏 -->
                <div class="flex-shrink-0 px-5 pt-3 pb-2" :class="isSoftLight ? 'border-b border-[rgba(118,129,218,0.18)]' : 'border-b border-[#2a2a2a]'">
                    <div class="flex flex-wrap gap-1.5">
                        <span
                            v-for="cat in systemSubCategories"
                            :key="cat.key"
                            @click="activeCategory = cat.key"
                            class="category-tag"
                            :class="{ 
                                'category-tag-active': activeCategory === cat.key, 
                                'category-tag-light': isSoftLight,
                                'category-tag-active-light': activeCategory === cat.key && isSoftLight
                            }"
                        >
                            {{ cat.label }}
                        </span>
                    </div>
                </div>
                <!-- 系统音色列表 -->
                <div class="flex-1 overflow-y-auto px-5 py-3 voice-scroll-area" :class="isSoftLight ? 'voice-scroll-light' : ''">
                    <div v-for="v in filteredSystemVoices" :key="v.id">
                        <div class="rounded-xl p-3 mb-2 transition-all duration-200"
                             :class="isSoftLight
                                ? 'border border-[rgba(118,129,218,0.18)] bg-white hover:border-purple-400/50 hover:shadow-sm'
                                : 'border border-[#2a2a2a] bg-[#161616] hover:border-purple-500/50'"
                             :style="{ opacity: !v.supportedInV3Flash ? 0.5 : 1 }">
                            <div class="flex mb-2">
                                <div class="flex-grow w-0 mr-2">
                                    <div class="inline-flex max-w-full items-center flex-wrap">
                                        <span class="font-medium text-sm" :class="isSoftLight ? 'text-[#1f2749]' : 'text-gray-200'">{{ v.title }}</span>
                                        <span class="ml-2 text-xs" :class="isSoftLight ? 'text-[#8b93b8]' : 'text-gray-500'">{{ v.desc }}</span>
                                    </div>
                                </div>
                                <div class="flex gap-1.5 shrink-0">
                                    <a-button v-if="v.supportedInV3Flash" @click="playSystemVoice(v)" :loading="generatingVoiceId === v.id" size="small" :type="isSoftLight ? 'outline' : 'secondary'" class="!rounded-lg">
                                        <template #icon><icon-play-arrow /></template>
                                        试听
                                    </a-button>
                                    <a-button v-if="v.supportedInV3Flash" @click="doSelect(v)" type="primary" size="small" class="!rounded-lg">
                                        <template #icon><icon-check /></template>
                                        选择
                                    </a-button>
                                    <a-tooltip v-if="!v.supportedInV3Flash" content="该音色仅支持 V2 模型，当前不可用">
                                        <a-button size="small" disabled class="!rounded-lg">
                                            <template #icon><icon-exclamation-circle-fill /></template>
                                            仅V2
                                        </a-button>
                                    </a-tooltip>
                                </div>
                            </div>
                            <div v-if="previewAudioUrl && playingVoiceId === v.id" class="mb-2">
                                <AudioPlayer show-wave :url="previewAudioUrl" />
                            </div>
                            <div class="text-xs" :class="isSoftLight ? 'text-[#8b93b8]' : 'text-gray-500'">音色ID: {{ v.aliyunVoiceId }}</div>
                        </div>
                    </div>
                    <m-empty v-if="!filteredSystemVoices.length" />
                </div>
            </template>

            <!-- 我的音色区域 -->
            <template v-if="mainTab === 'my'">
                <!-- 顶部操作栏：添加按钮 + 统计 -->
                <div class="flex-shrink-0 px-5 pt-3 pb-3 flex items-center gap-3" :class="isSoftLight ? 'border-b border-[rgba(118,129,218,0.18)]' : 'border-b border-[#2a2a2a]'">
                    <a-button @click="editDialog?.add()" type="primary" size="large" class="!rounded-xl !font-semibold !text-base flex-1" style="height: 44px;">
                        <template #icon><icon-plus /></template>
                        {{ $t("添加音色") }}
                    </a-button>
                </div>
                <!-- 我的音色列表 -->
                <div class="flex-1 overflow-y-auto px-5 py-3 voice-scroll-area" :class="isSoftLight ? 'voice-scroll-light' : ''">
                    <m-empty v-if="!records.length && !loading" :class="isSoftLight ? '' : ''" />
                    <m-loading v-else-if="!records.length && loading" page />
                    <div v-for="r in records" :key="r.id">
                        <div class="rounded-xl p-3 mb-2 transition-all duration-200" :class="isSoftLight ? 'border border-[rgba(118,129,218,0.18)] bg-white hover:border-blue-400/50 hover:shadow-sm' : 'border border-[#2a2a2a] bg-[#161616] hover:border-cyan-500/50'">
                            <div class="flex mb-3">
                                <div class="flex-grow w-0 mr-2">
                                    <div class="inline-flex max-w-full items-center rounded-full px-2.5 leading-8 h-8" :class="isSoftLight ? 'bg-[rgba(106,116,247,0.08)]' : 'bg-white/5'">
                                        <div class="truncate overflow-hidden flex-grow cursor-pointer text-sm" :class="isSoftLight ? 'text-[#1f2749]' : 'text-gray-200'">
                                            {{ r.title }}
                                        </div>
                                        <InputInlineEditor :value="r.title" @change="onChangeTitle(r, $event)">
                                            <a class="ml-1" :class="isSoftLight ? 'text-[#8b93b8]' : 'text-gray-400'" href="javascript:;">
                                                <icon-pen />
                                            </a>
                                        </InputInlineEditor>
                                    </div>
                                </div>
                                <div class="flex gap-1.5">
                                    <a-button @click="doSelect(r)" type="primary" size="small" class="!rounded-lg">
                                        <template #icon><icon-check /></template>
                                        选择
                                    </a-button>
                                    <a-button @click="doEdit(r)" size="small" class="!rounded-lg">
                                        <template #icon><icon-edit /></template>
                                    </a-button>
                                    <a-button @click="doDelete(r)" size="small" status="danger" class="!rounded-lg">
                                        <template #icon><icon-delete /></template>
                                    </a-button>
                                </div>
                            </div>
                            <div class="mb-2">
                                <AudioPlayer show-wave :url="'file://' + r.content.url" />
                            </div>
                            <div class="text-sm mb-1" :class="isSoftLight ? 'text-[#5f6b93]' : 'text-gray-400'">{{ r.content.promptText }}</div>
                            <div class="text-xs" :class="isSoftLight ? 'text-blue-500' : 'text-blue-400'" v-if="r.content.aliyunVoiceId">
                                音色ID: {{ formatVoiceId(r.content.aliyunVoiceId) }}
                            </div>
                            <div class="text-xs text-red-500 flex items-center" v-else>
                                <span>未配置音色ID (将使用默认音色)</span>
                                <a-link @click="doEdit(r)" size="mini" status="warning" class="ml-2">
                                    {{ $t("[去配置]") }}
                                </a-link>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </a-modal>
    <SoundPromptEditDialog ref="editDialog" @update="doRefresh" />
</template>

<style>
/* 强制覆盖Modal关闭按钮颜色 */
.sound-prompt-modal-dark .arco-modal-close-btn {
    color: rgba(255, 255, 255, 0.7) !important;
}
.sound-prompt-modal-dark .arco-modal-close-btn:hover {
    color: rgba(255, 255, 255, 1) !important;
    background-color: rgba(255, 255, 255, 0.1) !important;
}
.sound-prompt-modal-light .arco-modal-close-btn {
    color: rgba(31, 39, 73, 0.6) !important;
}
.sound-prompt-modal-light .arco-modal-close-btn:hover {
    color: rgba(31, 39, 73, 1) !important;
    background-color: rgba(118, 129, 218, 0.1) !important;
}

/* ===== 主Tab样式 ===== */
.voice-main-tabs {
    display: flex;
    gap: 4px;
    background: rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 4px;
}
.voice-main-tabs-light {
    background: rgba(118,129,218,0.08);
}
.voice-main-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.25s ease;
    color: #999;
    user-select: none;
}
.voice-main-tab:hover {
    color: #ccc;
    background: rgba(255,255,255,0.06);
}
.voice-main-tab-active {
    color: #fff;
    background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(139,92,246,0.75));
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(124,58,237,0.3);
}
.voice-main-tab-active:hover {
    background: linear-gradient(135deg, rgba(124,58,237,0.95), rgba(139,92,246,0.85));
}
.voice-main-tab-light {
    color: #8b93b8;
}
.voice-main-tab-light:hover {
    color: #5f6b93;
    background: rgba(118,129,218,0.1);
}
.voice-main-tab-active-light {
    color: #fff;
    background: linear-gradient(135deg, rgba(106,116,247,0.85), rgba(118,129,218,0.75));
    box-shadow: 0 2px 8px rgba(106,116,247,0.25);
}
.voice-main-tab-active-light:hover {
    background: linear-gradient(135deg, rgba(106,116,247,0.95), rgba(118,129,218,0.85));
}

/* ===== 子分类标签样式 ===== */
.category-tag {
    display: inline-block;
    padding: 3px 12px;
    border-radius: 14px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    color: #888;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    user-select: none;
}
.category-tag:hover {
    color: #ccc;
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.2);
}
.category-tag-active {
    color: #fff;
    background: rgba(22,93,255,0.65);
    border-color: rgba(22,93,255,0.7);
    font-weight: 600;
}
.category-tag-active:hover {
    background: rgba(22,93,255,0.8);
}

/* 清淡主题子分类标签 */
.category-tag-light {
    color: #8b93b8;
    background: rgba(118,129,218,0.06);
    border: 1px solid rgba(118,129,218,0.12);
}
.category-tag-light:hover {
    color: #5f6b93;
    background: rgba(118,129,218,0.12);
    border-color: rgba(118,129,218,0.25);
}
.category-tag-active-light {
    color: #fff;
    background: rgba(22,93,255,0.65);
    border-color: rgba(22,93,255,0.7);
}
.category-tag-active-light:hover {
    background: rgba(22,93,255,0.8);
}

/* ===== 滚动区域 ===== */
.voice-scroll-area::-webkit-scrollbar {
    width: 4px;
}
.voice-scroll-area::-webkit-scrollbar-track {
    background: transparent;
}
.voice-scroll-area::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 2px;
}
.voice-scroll-area::-webkit-scrollbar-thumb:hover {
    background: #555;
}
.voice-scroll-light::-webkit-scrollbar-thumb {
    background: rgba(118,129,218,0.2);
}
.voice-scroll-light::-webkit-scrollbar-thumb:hover {
    background: rgba(118,129,218,0.35);
}
</style>
