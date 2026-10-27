<script setup lang="ts">
import {TimeUtil} from "../../../lib/util";

const props = withDefaults(
    defineProps<{
        label?: boolean;
        icon?: boolean;
        data: {
            audioDuration?: number;
            audioChannels?: number;
            audioSampleRate?: number;
        };
    }>(),
    {
        icon: true,
        label: true,
    }
);
</script>

<template>
    <a-tag v-if="icon" class="rounded-lg" color="blue">
        <icon-file-audio />
    </a-tag>
    <a-tag class="rounded-lg">{{ label ? "时长" : "" }}{{ TimeUtil.secondsToTime(data.audioDuration || 0) }}</a-tag>
    <a-tag class="rounded-lg">{{ data.audioChannels }} Channels</a-tag>
    <a-tag class="rounded-lg">{{ data.audioSampleRate }} Hz</a-tag>
</template>

<style scoped></style>
