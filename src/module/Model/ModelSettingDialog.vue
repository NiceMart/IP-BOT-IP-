<script setup lang="ts">
import {ref} from "vue";
import ModelSetting from "./ModelSetting.vue";

const visible = ref(false);
const show = () => {
    visible.value = true;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="72rem"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
        :body-style="{ padding: '0' }"
    >
        <template #title>
            {{ $t("大模型设置") }}
        </template>
        <div class="model-setting-dialog-body">
            <ModelSetting/>
        </div>
    </a-modal>
</template>

<style scoped>
.model-setting-dialog-body {
    height: min(78vh, 920px);
}
</style>
