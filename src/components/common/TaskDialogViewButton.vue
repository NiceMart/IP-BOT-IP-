<script setup lang="ts">
import AppsItemDialog from "../../pages/Apps/common/AppsItemDialog.vue";
import {ref} from "vue";

const props = defineProps<{
    taskId: string | number | undefined,
    title?: string
}>()
const itemDialog = ref<InstanceType<typeof AppsItemDialog>>();
</script>

<template>
    <a-button :disabled="!taskId"
              @click="itemDialog?.show(taskId as any)"
              size="small"
              class="w-full">
        <template #icon>
            <icon-tool/>
        </template>
        <template v-if="taskId">
            {{ $t('查看任务') }}
            #{{ taskId }}
        </template>
        <template v-else>
            {{ $t('暂未运行') }}
        </template>
    </a-button>
    <AppsItemDialog ref="itemDialog" :title="title || $t('任务详情')"/>
</template>
