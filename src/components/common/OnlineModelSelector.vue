<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { t } from "../../lang";
import ServerSelector from "../Server/ServerSelector.vue";
import { useModelStore } from "../../module/Model/store/model";

const props = defineProps<{
    modelValue: string; // 'online' | 'local' | 具体的serverKey
    functionName: 'asr' | 'soundClone' | 'tts';
    label?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const modelStore = useModelStore();

// 模式选择: 'online' 或 'local'
const mode = ref<'online' | 'local'>('online');

// 本地服务器选择的key
const localServerKey = ref('');

// 初始化
onMounted(() => {
    // 如果modelValue是'online'，则模式为online
    // 如果是其他值，则模式为local，且该值是serverKey
    if (props.modelValue === 'online') {
        mode.value = 'online';
    } else if (props.modelValue) {
        mode.value = 'local';
        localServerKey.value = props.modelValue;
    }
});

// 监听模式变化
watch(mode, (newMode) => {
    if (newMode === 'online') {
        emit('update:modelValue', 'online');
    } else {
        emit('update:modelValue', localServerKey.value || '');
    }
});

// 监听本地服务器选择变化
watch(localServerKey, (newKey) => {
    if (mode.value === 'local') {
        emit('update:modelValue', newKey);
    }
});

// 获取功能名称显示
const functionLabel = computed(() => {
    switch (props.functionName) {
        case 'asr': return t('语音识别');
        case 'soundClone': return t('声音克隆');
        case 'tts': return t('语音合成');
        default: return t('模型');
    }
});

// 获取在线服务名称
const onlineServiceName = computed(() => {
    switch (props.functionName) {
        case 'asr': return 'FunASR';
        case 'soundClone': 
        case 'tts': 
            return 'T1多模态语音模型';
        default: return '阿里云';
    }
});
</script>

<template>
    <div class="online-model-selector">
        <!-- 模式选择 -->
        <a-radio-group v-model="mode" type="button" size="small" class="mb-2">
            <a-radio value="online">
                <div class="flex items-center gap-1">
                    <icon-cloud class="text-blue-500" />
                    <span>{{ t('在线') }}</span>
                </div>
            </a-radio>
            <a-radio value="local">
                <div class="flex items-center gap-1">
                    <icon-computer class="text-green-500" />
                    <span>{{ t('本地服务器') }}</span>
                </div>
            </a-radio>
        </a-radio-group>

        <!-- 在线模式状态 - API Key warning removed, backend has hardcoded fallback -->

        <!-- 本地服务器选择 -->
        <div v-if="mode === 'local'" class="mt-2">
            <ServerSelector
                v-model="localServerKey"
                :function-name="functionName"
                size="small"
            />
        </div>
    </div>
</template>

<style scoped>
.online-model-selector {
    /* 组件样式 */
}
</style>
