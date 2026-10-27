<script setup lang="ts">
import {StorageRecord, StorageService} from "../../service/StorageService";
import {nextTick, onMounted, ref} from "vue";

const props = defineProps({
    modelValue: {
        type: Number,
        default: () => 0,
    },
    biz: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        default: "请选择",
    },
    recordFilter: {
        type: Function,
        default: (r: StorageRecord) => true,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits<{
    (e: "update:modelValue", value: number): void;
}>();
const table = ref<any>(null);
const visible = ref(false);
const records = ref<StorageRecord[]>([]);
const recordSelect = ref<StorageRecord | undefined>(undefined);
const recordIdSelect = ref<number>(0);
const doLoad = async () => {
    records.value = await StorageService.list(props.biz as any);
    if (props.recordFilter) {
        records.value = records.value.filter(props.recordFilter as any);
    }
    nextTick(() => {
        if (props.modelValue) {
            recordSelect.value = records.value.find(r => r.id === props.modelValue);
        }
        // table.value?.select(records.value.map(r => r.id), false)
    });
};
const doShow = () => {
    visible.value = true;
    recordIdSelect.value = 0;
};
onMounted(() => {
    doLoad();
});
const doConfirm = () => {
    visible.value = false;
    recordSelect.value = records.value.find(r => r.id === recordIdSelect.value);
    emit("update:modelValue", recordIdSelect.value);
};
const doDelete = (id: number) => {
    recordSelect.value = undefined;
    emit("update:modelValue", 0);
};
const onSelectChange = (keys: number[]) => {
    recordIdSelect.value = keys[0];
};
</script>

<template>
    <div class="w-full">
        <div v-if="recordSelect" class="border pt-2 pl-2 pr-1 pb-1 rounded-lg mb-2">
            <div class="inline-flex items-center mr-1 mb-1 bg-gray-100 rounded-full p-1 pl-3">
                <div>
                    {{ recordSelect.title }}
                </div>
                <div>
                    <a-button
                        size="mini"
                        shape="round"
                        :disabled="props.disabled"
                        @click="doDelete(recordSelect.id as number)"
                    >
                        <template #icon>
                            <icon-close />
                        </template>
                    </a-button>
                </div>
            </div>
        </div>
        <div v-else>
            <a-button @click="doShow" :disabled="props.disabled">
                <template #icon>
                    <icon-plus />
                </template>
                点击选择
            </a-button>
        </div>
    </div>
    <a-modal v-model:visible="visible" :title="props.title" width="60vw" :destroy-on-close="true">
        <template #footer>
            <a-button @click="visible = false">取消</a-button>
            <a-button type="primary" @click="doConfirm">确定</a-button>
        </template>
        <div class="-mx-4 -my-5">
            <a-table
                ref="table"
                @selection-change="onSelectChange"
                :data="records"
                :row-selection="{type: 'radio'}"
                row-key="id"
                :bordered="false"
                :pagination="false"
                :virtual-list-props="{height: '50vh'}"
                :columns="[{title: '名称', dataIndex: 'title'}]"
            >
            </a-table>
        </div>
    </a-modal>
</template>

<style scoped></style>
