<script setup lang="ts">
import {computed, ref, watch} from "vue";

const props = defineProps<{
    visible: boolean;
    data: any;
}>();

const emit = defineEmits<{
    (e: "update:visible", value: boolean): void;
    (e: "close"): void;
}>();

const dialogVisible = computed({
    get: () => props.visible,
    set: (val) => emit("update:visible", val)
});

const handleClose = () => {
    emit("close");
};
</script>

<template>
    <a-modal
        v-model:visible="dialogVisible"
        :title="$t('封面预览')"
        width="80%"
        :footer="false"
        @cancel="handleClose"
    >
        <div v-if="data" class="bg-gray-100 rounded-lg p-4">
            <div v-if="data.coverImage" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("生成的封面") }}</h4>
                <div class="flex justify-center">
                    <img 
                        :src="'file://' + data.coverImage" 
                        :alt="$t('封面图片')" 
                        class="max-w-full max-h-96 shadow-lg rounded-lg"
                    />
                </div>
            </div>
            
            <div v-if="data.originalVideo" class="mb-4">
                <h4 class="font-medium mb-2">{{ $t("来源视频") }}</h4>
                <div class="rounded-md p-2 bg-gray-200">
                    <span class="truncate">{{ data.originalVideo.split(/[/\\]/).pop() }}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div v-if="data.timePoint">
                    <h4 class="font-medium mb-2">{{ $t("截图时间点") }}</h4>
                    <div class="rounded-md p-2 bg-gray-200 font-mono">
                        {{ data.timePoint.toFixed(2) }}{{ $t("秒") }}
                    </div>
                </div>
                
                <div v-if="data.width && data.height">
                    <h4 class="font-medium mb-2">{{ $t("图片尺寸") }}</h4>
                    <div class="rounded-md p-2 bg-gray-200 font-mono">
                        {{ data.width }} × {{ data.height }}
                    </div>
                </div>
                
                <div v-if="data.textOverlay">
                    <h4 class="font-medium mb-2">{{ $t("叠加文字") }}</h4>
                    <div class="rounded-md p-2 bg-gray-200">
                        {{ data.textOverlay }}
                    </div>
                </div>
                
                <div v-if="data.fontSize">
                    <h4 class="font-medium mb-2">{{ $t("文字大小") }}</h4>
                    <div class="rounded-md p-2 bg-gray-200">
                        {{ data.fontSize }}{{ $t("像素") }}
                    </div>
                </div>
            </div>
        </div>
        
        <div v-else class="text-center py-8">
            {{ $t("无封面数据") }}
        </div>
    </a-modal>
</template>