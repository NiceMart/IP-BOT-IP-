<script setup lang="ts">
import {PropType} from "vue";

const props = defineProps({
    record: {
        type: Object as PropType<{
            serverTitle: string;
            serverVersion: string;
        }>,
        required: true,
    },
});
</script>

<template>
    <a-tag class="rounded-lg">
        <i class="iconfont icon-server w-5"></i>
        {{ record.serverTitle }}
        v{{ record.serverVersion }}
    </a-tag>
</template>

<style scoped></style>
