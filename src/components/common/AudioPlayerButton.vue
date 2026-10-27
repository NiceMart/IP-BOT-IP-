<template>
    <span @click="playing = !playing">
        <a v-if="!playing" class="play" href="javascript:;">
            <icon-play-circle/>
        </a>
        <a v-if="playing" class="pause" href="javascript:;">
            <icon-pause-circle/>
        </a>
        <audio ref="audio" :src="audioSource" preload="none"></audio>
    </span>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";

const props = defineProps({
    source: {
        type: String,
        default: "",
    },
    stopPageOtherAudios: {
        type: Boolean,
        default: true,
    },
});

const audio = ref<HTMLAudioElement | null>(null);
const loaded = ref(false);
const playing = ref(false);
const durationSeconds = ref(0);

const audioSource = computed(() => {
    if (props.source) {
        if (props.source.startsWith('http:') || props.source.startsWith('https:') || props.source.startsWith('file:')) {
            return props.source;
        }
        return `file://${props.source}`;
    }
    return "";
});

watch(
    () => props.source,
    (newValue, oldValue) => {
        if (newValue && newValue !== oldValue) {
            init();
        }
    }
);

watch(playing, value => {
    if (!audio.value) return;
    if (value) {
        audio.value.play();
    } else {
        audio.value.pause();
    }
});

function loadeddata() {
    if (audio.value && audio.value.readyState >= 2) {
        loaded.value = true;
        // @ts-ignore
        durationSeconds.value = parseInt(audio.value.duration);
    } else {
        throw new Error("Failed to load sound file.");
    }
}

function init() {
    // 可以在这里重置一些状态
}

function stop() {
    if (audio.value) {
        audio.value.pause();
        audio.value.currentTime = 0;
        playing.value = false;
    }
}

defineExpose({
    stop,
});

onMounted(() => {
    if (!audio.value) return;
    audio.value.addEventListener("loadeddata", loadeddata);
    audio.value.addEventListener("pause", () => {
        playing.value = false;
    });
    audio.value.addEventListener("play", () => {
        playing.value = true;
        if (props.stopPageOtherAudios) {
            const audios = document.querySelectorAll("audio");
            audios.forEach((el: HTMLAudioElement) => {
                if (el !== audio.value && !el.paused) {
                    el.pause();
                }
            });
        }
    });
});

onBeforeUnmount(() => {
    if (!audio.value) return;
    audio.value.removeEventListener("loadeddata", loadeddata);
});
</script>
