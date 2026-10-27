<script setup lang="ts">
// @ts-nocheck
import { onMounted, ref, watch, computed } from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { useServerStore } from "../../../store/modules/server";
import { useModelStore } from "../../../module/Model/store/model";
import { EnumServerStatus } from "../../../types/Server";

const serverStore = useServerStore();
const modelStore = useModelStore();
const formData = ref({
    serverKey: "",
    modelType: "local", // local | online
    onlineModelId: "",
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);

// 获取在线ASR模型列表
const onlineAsrModels = ref<any[]>([]);

const loadOnlineModels = async () => {
    const items = await modelStore.enabledModels();
    onlineAsrModels.value = items.filter(item => {
        const provider = modelStore.providers.find(p => p.id === item.providerId);
        if (!provider) return false;
        const model = provider.data.models.find(m => m.id === item.modelId);
        return model && model.types && model.types.includes("asr");
    });
};

const onServerUpdate = async (config: any) => {
    param.value = config.functions.asr?.param || [];
    modelConfig.value = config;
};

onMounted(async () => {
    const old = StorageUtil.getObject("SoundAsrForm.formData");
    formData.value.serverKey = old.serverKey || "";
    formData.value.modelType = old.modelType || "local";
    
    // 🔧 确保 onlineModelId 格式正确（必须包含 provider 前缀）
    let savedModelId = old.onlineModelId || "";
    // 如果缓存的值没有 provider 前缀，或者为空，使用默认值
    if (!savedModelId || !savedModelId.includes("|")) {
        savedModelId = "builtInAliyun|fun-asr";
    }
    formData.value.onlineModelId = savedModelId;

    // 初始化在线模型列表
    await modelStore.init();
    await loadOnlineModels();
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("SoundAsrForm.formData", value);
    },
    {
        deep: true,
    }
);

const getValue = async (): Promise<SoundAsrParamType | undefined> => {
    const data: any = {};
    data.type = "SoundAsr";
    data.modelType = formData.value.modelType;

    if (formData.value.modelType === "local") {
        // 本地模型模式
        data.serverKey = formData.value.serverKey;

        const server = await serverStore.getByKey(data.serverKey);
        if (!server) {
            Dialog.tipError(t("请选择语音识别模型"));
            return;
        }
        if (server.status !== EnumServerStatus.RUNNING) {
            Dialog.tipError(t("语音识别模型未启动"));
            return;
        }

        data.serverName = server.name;
        data.serverTitle = server.title;
        data.serverVersion = server.version;
        data.param = paramForm.value ? paramForm.value.getValue() : {};

        if (!data.param) {
            Dialog.tipError(t("语音识别参数不正确"));
            return;
        }
    } else {
        // 在线模型模式
        if (!formData.value.onlineModelId) {
            Dialog.tipError(t("请选择在线语音识别模型"));
            return;
        }
        data.onlineModelId = formData.value.onlineModelId;
    }

    return data;
};

const setValue = (data: Partial<SoundAsrParamType>) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.param !== undefined) {
        paramForm.value?.setValue(data.param);
    }
    if (data.modelType !== undefined) {
        formData.value.modelType = data.modelType;
    }
    if (data.onlineModelId !== undefined) {
        formData.value.onlineModelId = data.onlineModelId;
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">
            <div class="inline-block w-5">
                <icon-settings />
            </div>
            {{ $t("语音识别配置") }}
        </div>

        <!-- 模型类型选择 -->
        <div class="mb-3">
            <a-radio-group v-model="formData.modelType" type="button">
                <a-radio value="local">{{ $t("本地模型") }}</a-radio>
                <a-radio value="online">{{ $t("在线模型") }}</a-radio>
            </a-radio-group>
        </div>

        <!-- 本地模型配置 -->
        <div v-if="formData.modelType === 'local'" class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="$t('语音识别模型')" mini>
                    <i class="iconfont icon-server"></i>
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <div>
                    <ServerSelector v-model="formData.serverKey" @update="onServerUpdate" functionName="asr" />
                </div>
                <div class="">
                    <ServerContentInfoAction :config="modelConfig as any" func="asr" />
                </div>
            </div>
        </div>

        <!-- 在线模型配置 (已隐藏: 默认均使用FunASR) -->
        <div v-else class="flex items-start min-h-8 max-w-lg w-full gap-1" v-if="false">
            <div class="pt-2">
                <a-tooltip :content="$t('在线语音识别模型')" mini>
                    <i class="iconfont icon-cloud"></i>
                </a-tooltip>
            </div>
            <div class="flex-grow">
                <a-select
                    v-model="formData.onlineModelId"
                    :placeholder="$t('选择在线ASR模型')"
                    allow-search
                >
                    <template v-for="model in onlineAsrModels" :key="model.id">
                        <a-option :value="model.id">
                            <div class="flex items-center">
                                <img v-if="model.providerLogo" :src="model.providerLogo" class="w-4 h-4 mr-2 rounded" />
                                <span>{{ model.providerTitle }} - {{ model.modelName }}</span>
                            </div>
                        </a-option>
                    </template>
                </a-select>
            </div>
        </div>

        <!-- 本地模型参数 -->
        <div class="flex items-center mt-2" v-if="formData.modelType === 'local' && param && param.length > 0">
            <ParamForm ref="paramForm" :param="param" />
        </div>
    </div>
</template>
