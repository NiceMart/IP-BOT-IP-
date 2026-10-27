<script setup lang="ts">
import {ref, onMounted, onUnmounted, computed} from "vue";
import {t} from "../../lang";

const visible = ref(false);
const resourceStatus = ref<string>("");
const resourceBundle = ref<string>("");
const resourcePercent = ref(0);
const resourceTransferred = ref(0);
const resourceTotal = ref(0);
const errorMessage = ref<string>("");

const resourceLabelMap: Record<string, string> = {
    'python-runtime': 'Python 运行环境',
    'playwright': '浏览器内核',
    'models': 'AI 模型资源',
    'fonts': '字体资源',
    'ziti': '字库资源',
    'bgm': '背景音乐资源',
};

const formatBundleLabel = (bundle?: string) => {
    if (!bundle) return '';
    return resourceLabelMap[bundle] || bundle;
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const statusText = computed(() => {
    switch (resourceStatus.value) {
        case "checking":
            return t("正在检查资源");
        case "pending":
            return t("检测到待准备资源");
        case "downloading":
            return t("正在下载资源");
        case "installing":
            return t("正在安装资源");
        default:
            return t("正在准备资源");
    }
});

const showProgress = computed(() => {
    return resourceStatus.value === "downloading" && resourcePercent.value > 0;
});

const canClose = computed(() => {
    // pending 状态（检测到待准备资源）和 error 状态可以关闭
    return resourceStatus.value === "pending" || resourceStatus.value === "error";
});

const handleClose = () => {
    visible.value = false;
    resourceStatus.value = "";
    resourceBundle.value = "";
    errorMessage.value = "";
};

let unsubscribeStatus: (() => void) | null = null;

const handleUpdaterStatus = (data: any) => {
    switch (data.status) {
        case "resource-checking":
            visible.value = true;
            resourceStatus.value = "checking";
            resourceBundle.value = "";
            resourcePercent.value = 0;
            errorMessage.value = "";
            break;
        case "resource-check-complete":
            if (data.pending?.length) {
                // 只在有必需资源时才显示弹层
                const hasMissingRequired = data.missingRequired && data.missingRequired.length > 0;
                if (hasMissingRequired) {
                    visible.value = true;
                    resourceStatus.value = "pending";
                    resourceBundle.value = data.pending.map((item: string) => formatBundleLabel(item)).join(", ");
                } else {
                    // 只有可选资源缺失，不显示弹层
                    visible.value = false;
                }
            } else {
                visible.value = false;
            }
            break;
        case "resource-downloading":
            visible.value = true;
            resourceStatus.value = "downloading";
            resourceBundle.value = formatBundleLabel(data.bundle);
            resourcePercent.value = data.percent || 0;
            resourceTransferred.value = data.transferred || 0;
            resourceTotal.value = data.total || 0;
            errorMessage.value = "";
            break;
        case "resource-installing":
            visible.value = true;
            resourceStatus.value = "installing";
            resourceBundle.value = formatBundleLabel(data.bundle);
            errorMessage.value = "";
            break;
        case "resource-installed":
            resourceStatus.value = "installed";
            resourceBundle.value = formatBundleLabel(data.bundle);
            resourcePercent.value = 100;
            setTimeout(() => {
                if (resourceStatus.value === 'installed') {
                    visible.value = false;
                    resourceStatus.value = "";
                    resourceBundle.value = "";
                }
            }, 1500);
            break;
        case "resource-ready":
            visible.value = false;
            resourceStatus.value = "";
            resourceBundle.value = "";
            errorMessage.value = "";
            break;
        case "error":
            if (String(data.message || '').includes('资源') || String(data.message || '').includes('bundle')) {
                visible.value = true;
                resourceStatus.value = "error";
                errorMessage.value = data.message;
            }
            break;
    }
};

onMounted(async () => {
    if (!window.$mapi) return;

    const latestStatus = await window.$mapi.updater.getLatestStatus();
    if (latestStatus) {
        handleUpdaterStatus(latestStatus);
    }

    unsubscribeStatus = window.$mapi.updater.onUpdaterStatus((data: any) => {
        handleUpdaterStatus(data);
    });
});

onUnmounted(() => {
    if (unsubscribeStatus) {
        unsubscribeStatus();
    }
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        :closable="canClose"
        :mask-closable="canClose"
        :esc-to-close="canClose"
        :footer="false"
        width="480px"
        @cancel="handleClose"
    >
        <template #title>
            <div class="flex items-center">
                <icon-loading class="mr-2" v-if="resourceStatus !== 'error'" />
                <icon-close-circle-fill class="mr-2 text-red-500" v-else />
                <span>{{ statusText }}</span>
            </div>
        </template>

        <div class="py-4">
            <div v-if="resourceStatus === 'error'" class="text-red-500 mb-4">
                {{ errorMessage }}
            </div>

            <div v-else>
                <div v-if="resourceBundle" class="mb-4 text-base">
                    {{ resourceBundle }}
                </div>

                <div v-if="showProgress">
                    <a-progress
                        :percent="resourcePercent / 100"
                        :show-text="false"
                        class="mb-2"
                    />
                    <div class="flex justify-between text-sm text-gray-500">
                        <span>{{ resourcePercent.toFixed(1) }}%</span>
                        <span>{{ formatSize(resourceTransferred) }} / {{ formatSize(resourceTotal) }}</span>
                    </div>
                </div>

                <div v-else-if="resourceStatus === 'installing'" class="text-center">
                    <a-spin size="large" />
                </div>
            </div>
        </div>
    </a-modal>
</template>
