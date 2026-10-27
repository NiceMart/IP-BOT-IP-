<script setup lang="ts">
import {ref} from "vue";
import {TaskRecord, TaskService} from "../../../../service/TaskService";
import SoundReplaceItem from "./SoundReplaceItem.vue";
import {Dialog} from "../../../../lib/dialog";
import {t} from "../../../../lang";
import {useTaskChangeRefresh} from "../../../../hooks/task";
import {TaskChangeType} from "../../../../store/modules/task";

const record = ref<TaskRecord | null>(null);
const loading = ref(false);
const currentId = ref<number | null>(null);
const visible = ref(false);

const doLoad = async () => {
    loading.value = true;
    try {
        record.value = await TaskService.get(currentId.value!);
        if (!record.value) {
            Dialog.tipError(t("未找到记录"));
            return;
        }
    } catch (error) {
        Dialog.tipError(t("加载记录失败 {error}", {error}));
    } finally {
        loading.value = false;
    }
};

useTaskChangeRefresh("SoundReplace", (
    bizId: string,
    type: TaskChangeType
) => {
    if (bizId + '' === `${currentId.value}`) {
        doLoad();
    }
});

defineExpose({
    show: (id: number) => {
        currentId.value = id;
        visible.value = true;
        doLoad();
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="90vw"
        :footer="false"
        title-align="start">
        <template #title>
            <div class="font-bold">
                {{ $t("声音替换") }}
            </div>
        </template>
        <div class="h-[calc(100vh-10rem)] -my-6 -mx-4 p-3 overflow-y-auto">
            <div v-if="loading&&!record" class="flex justify-center items-center p-8">
                <icon-refresh spin class="mr-2"/>
                {{ $t("加载中...") }}
            </div>
            <div v-else-if="record">
                <SoundReplaceItem
                    :record="record"
                    :dialog="true"
                    :on-refresh="doLoad"
                />
            </div>
            <div v-else class="text-center p-8 text-gray-400">
                {{ $t("未找到记录") }}
            </div>
        </div>
    </a-modal>
</template>
