<script setup lang="ts">
import {t} from "../lang";
import {ref} from "vue";
import {Dialog} from "../lib/dialog";

const props = defineProps({
    text: {
        type: String,
        default: t("批量输入"),
    },
    confirmText: {
        type: String,
        default: t("确定"),
    },
});

const visible = ref(false);
const inputTextVisible = ref(false);
const inputTextContent = ref("");

const records = ref<
    {
        text: string;
    }[]
>([]);

const doShow = () => {
    records.value = [];
    visible.value = true;
};

const doDelete = (index: number) => {
    records.value.splice(index, 1);
};

const doAdd = () => {
    records.value.push({text: ""});
};

const doShowInputText = () => {
    inputTextVisible.value = true;
    inputTextContent.value = "";
};

const doInputTextSubmit = () => {
    const lines = inputTextContent.value.split("\n").filter(line => line.trim());
    if (!lines.length) {
        return;
    }
    records.value = lines.map(text => ({text}));
    inputTextVisible.value = false;
};

const doSubmit = () => {
    for (const record of records.value) {
        if (!record.text.trim()) {
            Dialog.tipError(t("所有内容不能为空"));
            return;
        }
    }
    if (records.value.length === 0) {
        Dialog.tipError(t("请添加内容"));
        return;
    }
    emit("submit", records.value);
    visible.value = false;
};

const emit = defineEmits({
    submit: (records: {text: string}[]) => true,
});
</script>

<template>
    <a-button class="mr-2" @click="doShow">
        {{ text }}
    </a-button>
    <a-modal v-model:visible="visible" width="80vw" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            {{ text }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">
                {{ confirmText }}
            </a-button>
        </template>
        <div style="height: calc(100vh - 20rem)">
            <div class="mb-3 flex items-center">
                <a-button @click="doAdd" class="mr-1">
                    <template #icon>
                        <icon-plus />
                    </template>
                    {{ $t("添加一个") }}
                </a-button>
                <a-button @click="doShowInputText" class="mr-2">
                    <template #icon>
                        <icon-paste />
                    </template>
                    {{ $t("批量粘贴") }}
                </a-button>
                <div class="font-bold">
                    {{ $t("共 {count} 条", {count: records.length}) }}
                </div>
            </div>
            <div v-if="!records.length">
                <m-empty />
            </div>
            <div v-for="(text, textIndex) in records">
                <div class="rounded-lg shadow border px-3 pt-3 pb-1 mb-3 flex">
                    <div class="flex-grow mr-2">
                        <a-textarea
                            v-model="records[textIndex].text"
                            style="min-height: 3rem"
                            :placeholder="$t('输入内容')"
                            :auto-size="{minRows: 2}"
                            show-word-limit
                            :max-length="1000"
                        ></a-textarea>
                    </div>
                    <div>
                        <a-button type="primary" size="small" status="danger" @click="doDelete(textIndex)">
                            <template #icon>
                                <icon-delete />
                            </template>
                        </a-button>
                    </div>
                </div>
            </div>
            <div class="h-10"></div>
        </div>
    </a-modal>
    <a-modal
        v-model:visible="inputTextVisible"
        width="70vw"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("批量粘贴，每行一个") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doInputTextSubmit">
                {{ $t("确定") }}
            </a-button>
        </template>
        <div style="height: calc(100vh - 30rem)">
            <a-textarea
                v-model="inputTextContent"
                style="min-height: calc(100vh - 30rem)"
                :auto-size="{minRows: 2}"
                :placeholder="$t('批量粘贴，每行一个')"
            ></a-textarea>
        </div>
    </a-modal>
</template>
