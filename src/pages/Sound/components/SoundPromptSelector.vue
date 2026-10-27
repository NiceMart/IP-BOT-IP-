<script setup lang="ts">
// @ts-nocheck
import {onMounted, ref, computed, onBeforeUnmount} from "vue";
import {StorageRecord, StorageService} from "../../../service/StorageService";
import SoundPromptDialog from "./SoundPromptDialog.vue";
import {GlobalEvent} from "../../../lib/event";
import {systemVoicesSimple as systemVoices} from "../config/systemVoices";

const soundPromptDialog = ref<InstanceType<typeof SoundPromptDialog>>();
const records = ref<StorageRecord[]>([]);
const isListenerRegistered = ref(false);  // 🔧 追踪是否已注册监听器

// 🔧 监听全局事件,实现跨页面音色同步
const handleSoundPromptUpdate = async () => {
    await doRefresh();
};

onMounted(async () => {
    await doRefresh();

    // 🔧 监听全局音色更新事件（防止重复注册）
    if (!isListenerRegistered.value) {
        GlobalEvent.on('soundPromptUpdated', handleSoundPromptUpdate);
        isListenerRegistered.value = true;
    }
});

onBeforeUnmount(() => {
    // 清理事件监听（只在已注册时清理）
    if (isListenerRegistered.value) {
        GlobalEvent.off('soundPromptUpdated', handleSoundPromptUpdate);
        isListenerRegistered.value = false;
    }
});

const doRefresh = async () => {
    records.value = await StorageService.list("SoundPrompt");
};

const props = defineProps({
    modelValue: {
        type: [Number, String],  // 🔧 支持数字和字符串类型
        required: true,
        default: 0,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    ttsModel: {
        type: String,
        default: 'cosyvoiceV2',
    },
});

const emit = defineEmits(["update:modelValue"]);

const onSelect = (id: number | string) => {
    emit("update:modelValue", id);
};

const doSelect = (tab?: 'system' | 'my') => {
    if (props.disabled) {
        return;
    }
    soundPromptDialog.value?.show(tab);
};

defineExpose({
    doSelect,
});

// 🔧 计算显示的音色名称
const displayTitle = computed(() => {
    if (!props.modelValue) {
        return "选择音色";
    }
    
    // 检查是否为系统音色
    if (typeof props.modelValue === 'string' && props.modelValue.startsWith('sys_')) {
        const systemVoice = systemVoices.find(v => v.id === props.modelValue);
        return systemVoice ? systemVoice.title : "选择音色";
    }
    
    // 用户自定义音色
    const record = records.value.find(s => s.id === props.modelValue);
    return record ? record.title : "选择音色";
});
</script>

<template>
    <div class="flex items-center">
        <div
            @click="doSelect()"
            class="sound-prompt-trigger mr-1 h-8 leading-8 px-3 rounded-lg cursor-pointer truncate w-full transition-colors"
            :class="[
                disabled ? 'cursor-not-allowed opacity-50' : '',
                $attrs.class?.includes('dark-input-override') ? 'sound-prompt-trigger--embedded' : 'sound-prompt-trigger--default'
            ]"
        >
            {{ displayTitle }}
        </div>
    </div>
    <SoundPromptDialog ref="soundPromptDialog" @update="doRefresh" @select="onSelect" :ttsModel="ttsModel"/>
</template>

<style scoped>
.sound-prompt-trigger--default {
  background: #f3f4f6;
  color: #1f2937;
}

.sound-prompt-trigger--default:hover {
  background: #e5e7eb;
}

.sound-prompt-trigger--embedded {
  background: #2a2a2a;
  color: #e5e7eb;
  border: 1px solid #374151;
}

:global(body[data-theme="soft-light"]) .sound-prompt-trigger--embedded {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(244, 245, 255, 0.98) 100%) !important;
  color: #1f2749 !important;
  border: 1px solid rgba(132, 142, 220, 0.26) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 10px 24px rgba(104, 110, 170, 0.08) !important;
}

:global(body[data-theme="soft-light"]) .sound-prompt-trigger--embedded:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 248, 255, 0.995) 100%) !important;
  border-color: rgba(106, 116, 247, 0.34) !important;
}
</style>
