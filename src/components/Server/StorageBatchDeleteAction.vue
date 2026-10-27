<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {computed} from "vue";
import {sleep} from "../../lib/util";
import {StorageRecord, StorageService} from "../../service/StorageService";

const props = defineProps<{
    records: StorageRecord[];
}>();

const canDelete = computed(() => {
    return props.records.length > 0;
});

const emit = defineEmits({
    update: () => true,
});

const doDelete = async () => {
    await Dialog.confirm(t("确定删除 {count} 条记录?", {count: props.records.length}));
    Dialog.loadingOn(t("正在删除"));
    await sleep(500);
    for (const r of props.records) {
        await StorageService.delete(r);
    }
    Dialog.loadingOff();
    emit("update");
};
</script>

<template>
    <a-tooltip :content="$t('删除')" mini>
        <a-button class="mr-2" :disabled="!canDelete" @click="doDelete()">
            <template #icon>
                <icon-delete />
            </template>
        </a-button>
    </a-tooltip>
</template>
