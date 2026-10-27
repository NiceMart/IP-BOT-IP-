<script setup lang="ts">
import {onMounted, onBeforeUnmount, ref} from "vue";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";

const records = ref<VideoTemplateRecord[]>([]);
const selectRef = ref<any>(null);

const refresh = async () => {
    records.value = await VideoTemplateService.list();
};

const focus = () => {
    selectRef.value?.focus();
};

const handleTemplateUpdate = () => {
    refresh();
};

onMounted(async () => {
    await refresh();
    // 监听数字人模板更新事件
    window.addEventListener('video-template-updated', handleTemplateUpdate);
});

onBeforeUnmount(() => {
    // 清理事件监听
    window.removeEventListener('video-template-updated', handleTemplateUpdate);
});

// 暴露方法供父组件调用
defineExpose({
    refresh,
    focus
});
</script>

<template>
    <a-select ref="selectRef" allow-search>
        <a-option :value="0">
            {{ $t("请选择形象") }}
        </a-option>
        <a-option v-for="record in records" :key="record.id" :value="record.id">
            {{ record.name }}
        </a-option>
    </a-select>
</template>

<style scoped>
:deep(.arco-select-view-single) {
    background-color: #1a1a1a;
    border-color: #333;
    color: #e5e7eb;
}

:deep(.arco-select-view-single:hover) {
    border-color: #4b5563;
}
</style>
