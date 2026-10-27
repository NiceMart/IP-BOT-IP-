<script setup lang="ts">
import {computed, onMounted, ref, watch} from "vue";
import {t} from "../lang";
import Router from "../router";
import VideoGen from "./Video/VideoGen.vue";
import VideoTemplate from "./Video/VideoTemplate.vue";
import VideoMaterial from "./Video/VideoMaterial.vue";
import VideoAudioExtract from "./Video/VideoAudioExtract.vue";
import VideoIPAgent from "./Video/VideoIPAgent.vue";
import {VideoApps} from "./Apps/all";

const tab = ref("ipAgent");

// 监听路由变化，更新 tab
watch(
    () => Router.currentRoute.value.query.tab,
    (newTab) => {
        if (newTab && typeof newTab === 'string') {
            tab.value = newTab;
        }
    },
    { immediate: true }
);

// 使用 computed 动态返回当前组件
const currentComponent = computed(() => {
    switch (tab.value) {
        case 'ipAgent':
            return VideoIPAgent;
        case 'videoGen':
            return VideoGen;
        case 'videoTemplate':
            return VideoTemplate;
        case 'videoMaterial':
            return VideoMaterial;
        case 'videoAudioExtract':
            return VideoAudioExtract;
        default:
            // 检查是否是动态组件
            for (const app of VideoApps) {
                if (app.name === tab.value) {
                    return app.component;
                }
            }
            return VideoIPAgent; // 默认返回首页
    }
});
</script>

<template>
    <div class="video-page-container h-full relative select-none">
        <div class="h-full overflow-y-auto">
            <component :is="currentComponent" :key="tab" />
        </div>
    </div>
</template>

<style scoped>
.video-page-container {
    background: transparent;
}
</style>
