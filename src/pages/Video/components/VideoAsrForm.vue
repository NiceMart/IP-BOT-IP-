<script setup lang="ts">
import {onMounted, ref} from "vue";
import {useServerStore} from "../../../store/modules/server";
import ModelSelector from "../../../module/Model/ModelSelector.vue";
import ParamForm from "../../../components/common/ParamForm.vue";

const emit = defineEmits<{
    loaded: [];
}>();

const serverStore = useServerStore();

const modelSelector = ref<InstanceType<typeof ModelSelector>>();

const serverInfo = ref<ServerInfo>();
const modelConfig = ref<any>({});
const paramFormItems = ref<ParamFormItem[]>([]);
const paramFormRef = ref<InstanceType<typeof ParamForm>>();

onMounted(async () => {
    await loadServerList();
});

const loadServerList = async () => {
    serverInfo.value = await serverStore.getFirstServerByKey("FunASR");
    if (serverInfo.value) {
        emit("loaded");
    }
};

const onSelect = async () => {
    if (!serverInfo.value) {
        return;
    }
    const server = serverInfo.value.server;
    const modelConfigTemplate = serverStore.getModelConfigTemplate(server);
    if (!modelConfigTemplate) {
        return;
    }
    modelConfig.value = modelConfigTemplate;
    paramFormItems.value = modelConfigTemplate.params || [];
};

const getValue = async () => {
    if (!serverInfo.value) {
        return undefined;
    }
    const param = await paramFormRef.value?.getValue();
    return {
        type: "VideoAsr",
        serverKey: serverInfo.value.server.key,
        serverName: serverInfo.value.server.name,
        serverTitle: serverInfo.value.server.title,
        serverVersion: serverInfo.value.server.version,
        param: param || {},
    };
};
</script>

<template>
    <div class="flex flex-col">
        <ModelSelector ref="modelSelector" :server-key="'FunASR'" @select="onSelect"/>
        <ParamForm v-if="paramFormItems.length" ref="paramFormRef" :items="paramFormItems"/>
    </div>
</template>