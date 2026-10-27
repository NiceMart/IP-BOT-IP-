<script setup lang="ts" name="KeywordMarker">
import { ref, computed } from 'vue';

interface Props {
    keywords?: Array<{ keyword: string; count?: number }>;
    subtitleSegments?: any[];
}

interface Emits {
    (e: 'markersChange', markers: any[]): void;
}

const props = withDefaults(defineProps<Props>(), {
    keywords: () => [],
    subtitleSegments: () => []
});

const emit = defineEmits<Emits>();

const markers = ref<any[]>([]);

const addMarker = (keyword: string, groupId?: string) => {
    const newMarker = {
        id: 'marker_' + Date.now(),
        keyword: keyword,
        enabled: true,
        groupId: groupId // 记录关键词所属分组，用于查找该分组的样式
    };
    markers.value.push(newMarker);
    emit('markersChange', markers.value);
};

const removeMarker = (id: string) => {
    const index = markers.value.findIndex(m => m.id === id);
    if (index > -1) {
        markers.value.splice(index, 1);
        emit('markersChange', markers.value);
    }
};

defineExpose({
    markers
});
</script>

<template>
    <div class="keyword-marker">
        <div class="text-sm font-medium mb-2">关键词标记</div>
        <div v-if="keywords.length > 0" class="flex flex-wrap gap-2">
            <a-button
                v-for="item in keywords"
                :key="item.keyword"
                size="small"
                @click="addMarker(item.keyword)"
            >
                + {{ item.keyword }}
            </a-button>
        </div>
        <div v-else class="text-xs text-gray-400">
            暂无关键词
        </div>
    </div>
</template>

<style scoped>
.keyword-marker {
    padding: 0;
}
</style>
