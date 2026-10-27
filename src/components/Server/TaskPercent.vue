<script setup lang="ts">

const props = defineProps<{
    percent: number | undefined;
}>();
</script>

<template>
    <div class="bg-gray-100 text-sm rounded-full px-2 leading-8">
        {{ ((percent || 0) * 100).toFixed(2) }}%
    </div>
</template>
