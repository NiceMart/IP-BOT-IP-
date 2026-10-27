<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {StorageUtil} from "../../../lib/storage";
import {useServerStore} from "../../../store/modules/server";
import {EnumServerStatus} from "../../../types/Server";
import VideoTemplateSelector from "./VideoTemplateSelector.vue";
import {VideoTemplateService} from "../../../service/VideoTemplateService";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
    videoTemplateId: 0,
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);

const onServerUpdate = async (config: any) => {
    param.value = config.functions.asr?.param || [];
    modelConfig.value = config;
};

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenForm.formData");
    formData.value.serverKey = old.serverKey || "";
    formData.value.videoTemplateId = old.videoTemplateId || 0;  // 🔧 恢复选择的视频形象
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("VideoGenForm.formData", value);
    },
    {
        deep: true,
    }
);

const getValue = async () => {
    const data: any = {};
    data.serverKey = formData.value.serverKey;

    // 云端模式
    if (data.serverKey?.startsWith('__CLOUD')) {
        if (!formData.value.videoTemplateId) {
            Dialog.tipError(t("请选择视频"));
            return;
        }
        const videoTemplate = await VideoTemplateService.get(formData.value.videoTemplateId);
        if (!videoTemplate) {
            Dialog.tipError(t("请选择视频"));
            return;
        }

        // 根据不同的云端模型ID设置标题
        let serverTitle = '网络节点01';
        if (data.serverKey === '__CLOUD_1942022968606355458__') {
            serverTitle = '网络节点02';
        } else if (data.serverKey === '__CLOUD_MODEL_3__') {
            serverTitle = '网络节点03';
        } else if (data.serverKey === '__CLOUD_MODEL_4__') {
            serverTitle = '网络节点04';
        } else if (data.serverKey === '__CLOUD_MODEL_5__') {
            serverTitle = '网络节点05';
        } else if (data.serverKey === '__CLOUD_MODEL_6__') {
            serverTitle = '网络节点06';
        } else if (data.serverKey === '__CLOUD_BEAUTY__') {
            serverTitle = '极速模型';
        }

        data.serverName = data.serverKey;
        data.serverTitle = serverTitle;
        data.serverVersion = '1.0';
        data.videoTemplateId = formData.value.videoTemplateId;
        data.videoTemplateName = videoTemplate.name;
        data.videoTemplateUrl = videoTemplate.video;
        data.param = {};

        return data;
    }

    // 本地模式
    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("请选择数字人模型"));
        return;
    }
    if (server.status !== EnumServerStatus.RUNNING) {
        Dialog.tipError(t("数字人模型未启动"));
        return;
    }

    if (!formData.value.videoTemplateId) {
        Dialog.tipError(t("请选择视频"));
        return;
    }
    const videoTemplate = await VideoTemplateService.get(formData.value.videoTemplateId);
    if (!videoTemplate) {
        Dialog.tipError(t("请选择视频"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.videoTemplateId = formData.value.videoTemplateId;
    data.videoTemplateName = videoTemplate.name;
    data.videoTemplateUrl = videoTemplate.video;

    data.param = paramForm.value?.getValue();
    if (!data.param) {
        Dialog.tipError(t("语音识别参数不正确"));
        return;
    }

    return data;
};

defineExpose({
    getValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold">
            <icon-settings />
            {{ $t("数字人配置") }}
        </div>
        <div class="flex items-center h-12 mb-2">
            <div class="mr-1">
                <a-tooltip :content="$t('数字人模型')" mini>
                    <i class="iconfont icon-server"></i>
                </a-tooltip>
            </div>
            <div class="mr-2 w-96 flex-shrink-0">
                <ServerSelector v-model="formData.serverKey" @update="onServerUpdate" functionName="videoGen" :show-cloud="true" />
            </div>
            <div>
                <ServerContentInfoAction :config="modelConfig as any" func="videoGen" />
            </div>
        </div>
        <div class="flex items-center h-12 mb-2">
            <div class="mr-1">
                <a-tooltip :content="$t('视频形象')" mini>
                    <i class="iconfont icon-video-template"></i>
                </a-tooltip>
            </div>
            <div class="mr-3 w-56 flex-shrink-0">
                <VideoTemplateSelector v-model="formData.videoTemplateId" />
            </div>
        </div>
        <div class="flex items-center dark-param-form">
            <ParamForm ref="paramForm" :param="param" />
        </div>
    </div>
</template>

<style scoped>
.font-bold {
    color: #ffffff;
    border-bottom: 1px solid #333;
    padding-bottom: 8px;
    margin-bottom: 12px;
}

.iconfont {
    color: #9ca3af;
}

/* Dark mode overrides for ParamForm */
:deep(.dark-param-form .arco-popover-trigger) {
    color: #e5e7eb;
}

:deep(.dark-param-form .iconfont) {
    color: #9ca3af;
}

:deep(.dark-param-form .arco-input),
:deep(.dark-param-form .arco-input-number),
:deep(.dark-param-form .arco-select-view-single) {
    background-color: #1a1a1a;
    border-color: #333;
    color: #e5e7eb;
}

:deep(.dark-param-form .arco-input:hover),
:deep(.dark-param-form .arco-input-number:hover),
:deep(.dark-param-form .arco-select-view-single:hover) {
    border-color: #4b5563;
}
</style>
