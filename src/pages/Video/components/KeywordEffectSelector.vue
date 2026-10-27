<script setup lang="ts" name="KeywordEffectSelector">
import { ref } from 'vue';

// 关键词特效样式定义
export interface KeywordEffect {
    id: string;
    name: string;
    description: string;
    icon: string;
    preview: string;
    animationClass: string;
}

// 关键词样式配置
export interface KeywordStyle {
    fontSize: number;
    fontColor: string;
    fontName?: string;  // 支持字体名称
    outlineColor: string;
    outlineWidth: number;
    shadowColor: string;
    shadowBlur: number;
    effectId: string;
    effectDuration: number;
}

const props = defineProps<{
    modelValue?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'styleChange', style: KeywordStyle): void;
}>();

// 预定义的关键词特效 - 10种炫酷特效
const keywordEffects = ref<KeywordEffect[]>([
    {
        id: 'zoom-in',
        name: '缩放弹出',
        description: '关键词从小到大弹出，吸引注意力',
        icon: 'icon-zoom-in',
        preview: '关键词',
        animationClass: 'effect-zoom-in'
    },
    {
        id: 'pulse',
        name: '脉冲跳动',
        description: '关键词脉冲式大小变化，持续吸引眼球',
        icon: 'icon-heartbeat',
        preview: '关键词',
        animationClass: 'effect-pulse'
    }
]);

const selectedEffectId = ref<string>(props.modelValue || 'zoom-in');

const keywordStyle = ref<KeywordStyle>({
    fontSize: 72,
    fontColor: '#FFD700',
    fontName: 'Microsoft YaHei',
    outlineColor: '#000000',
    outlineWidth: 3,
    shadowColor: '#000000',
    shadowBlur: 10,
    effectId: 'zoom-in',
    effectDuration: 2.0
});

const selectEffect = (effectId: string) => {
    selectedEffectId.value = effectId;
    keywordStyle.value.effectId = effectId;
    emit('update:modelValue', effectId);
    emit('styleChange', keywordStyle.value);
};

const onStyleChange = () => {
    emit('styleChange', keywordStyle.value);
};

const colorPresets = [
    { name: '金色', fontColor: '#FFD700', outlineColor: '#8B6914' },
    { name: '红色', fontColor: '#FF4500', outlineColor: '#8B0000' },
    { name: '蓝色', fontColor: '#00BFFF', outlineColor: '#00008B' },
    { name: '绿色', fontColor: '#32CD32', outlineColor: '#006400' },
    { name: '紫色', fontColor: '#DA70D6', outlineColor: '#4B0082' },
    { name: '白色', fontColor: '#FFFFFF', outlineColor: '#333333' }
];

const applyColorPreset = (preset: any) => {
    keywordStyle.value.fontColor = preset.fontColor;
    keywordStyle.value.outlineColor = preset.outlineColor;
    onStyleChange();
};

const getSelectedStyle = () => {
    return {
        ...keywordStyle.value,
        effect: selectedEffectId.value
    };
};

defineExpose({
    getSelectedStyle
});
</script>

<template>
    <div class="keyword-effect-selector">
        <div class="mb-6">
            <h4 class="font-bold text-sm mb-3">关键词特效选择</h4>
            <div class="space-y-4">
                <div class="text-xs text-gray-500 mb-4">
                    字体大小、颜色等样式设置请在"编辑样式"中配置
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.keyword-effect-selector {
    padding: 0;
}
</style>
