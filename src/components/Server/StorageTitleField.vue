<script setup lang="ts">
import {StorageRecord, StorageService} from "../../service/StorageService";
import InputInlineEditor from "../common/InputInlineEditor.vue";

const props = defineProps({
    record: {
        type: Object as () => StorageRecord,
        required: true,
    },
});

const emit = defineEmits({
    update: (value: string) => true,
    titleClick: () => true,
});

const onEditTitle = async (value: string) => {
    await StorageService.update(props.record.id as any, {
        title: value,
    });
    emit("update", value);
};
</script>

<template>
    <div class="flex items-center">
        <div class="truncate flex-grow max-w-96 cursor-pointer" @click="emit('titleClick')">
            {{ record.title }}
        </div>
        <InputInlineEditor :value="record.title" @change="onEditTitle">
            <a class="ml-1 text-gray-400" href="javascript:;">
                <icon-pen />
            </a>
        </InputInlineEditor>
    </div>
</template>

<style scoped></style>
