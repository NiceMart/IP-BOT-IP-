<script setup lang="ts">
import {computed, ref} from "vue";

const props = defineProps<{
    url: string;
    width?: string;
    height?: string;
    largeWidth?: string;
    largeHeight?: string;
}>();

const isZoomed = ref(false);

const processedUrl = computed(() => {
    if (!props.url) {
        return "";
    }
    const url = props.url + '';
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    } else {
        return "file://" + url;
    }
});

const currentWidth = computed(() => (isZoomed.value ? props.largeWidth || "100%" : props.width || "10rem"));
const currentHeight = computed(() => (isZoomed.value ? props.largeHeight || "70vh" : props.height || "10rem"));

const toggleZoom = () => {
    isZoomed.value = !isZoomed.value;
};
</script>

<template>
    <div class="inline-block relative bg-gray-200 p-2 rounded-lg">
        <img :src="processedUrl"
             :style="{ width: currentWidth, height: currentHeight }"
             class="rounded object-contain border"/>
        <div @click="toggleZoom"
             class="cursor-pointer w-6 h-6 text-center leading-6 absolute top-4 left-4 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-75">
            <icon-zoom-in v-if="!isZoomed"/>
            <icon-zoom-out v-else/>
        </div>
    </div>
</template>

<style scoped>
</style>
