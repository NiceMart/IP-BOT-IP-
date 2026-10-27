<script setup lang="ts">
import {computed, onMounted, onBeforeUnmount} from "vue";
import {useRoute} from 'vue-router';
import {SoundApps} from './Apps/all';
const route=useRoute();
const soundFeature=computed(()=>SoundApps.find(app=>app.name===route.query.tab));
import SoundWorkbench from "./Sound/SoundWorkbench.vue";
import {GlobalEvent} from "../lib/event";

onMounted(() => {
    const beforeCount = GlobalEvent.getListenerCount('soundPromptUpdated');
    GlobalEvent.removeAllListeners('soundPromptUpdated');
});

onBeforeUnmount(() => {
    setTimeout(() => {
        GlobalEvent.removeAllListeners('soundPromptUpdated');
    }, 0);
});
</script>

<template>
    <div class="sound-page">
        <div class="sound-container">
            <component v-if="soundFeature" :is="soundFeature.component" :key="String(route.query.tab)"/><SoundWorkbench v-else/>
        </div>
    </div>
</template>

<style>
.sound-page {
    height: 100%;
    background: transparent;
}

.sound-container {
    height: 100%;
}
</style>
