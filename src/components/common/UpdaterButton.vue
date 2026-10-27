<script setup lang="ts">
import {onMounted, onUnmounted, ref} from "vue";
import {AppConfig} from "../../config";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";

const updaterCheckLoading = ref(false);
const checkAtLaunch = ref<"yes" | "no">("no");
const updateStatus = ref<string>("");
const updateVersion = ref<string>("");
const downloadPercent = ref(0);
const downloadSpeed = ref(0);
const downloadTransferred = ref(0);
const downloadTotal = ref(0);
const resourceStatus = ref<string>("");
const resourceBundle = ref<string>("");
const resourcePercent = ref(0);
const resourceTransferred = ref(0);
const resourceTotal = ref(0);
let unsubscribeStatus: null | (() => void) = null;
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

const handleUpdaterStatus = (data: any, autoPrompt: boolean = true) => {
    switch (data.status) {
        case "checking":
            updateStatus.value = "checking";
            break;
        case "resource-checking":
            resourceStatus.value = "checking";
            resourceBundle.value = "";
            resourcePercent.value = 0;
            break;
        case "resource-check-complete":
            if (data.pending?.length) {
                resourceBundle.value = data.pending.map((item: string) => formatBundleLabel(item)).join(", ");
                if (updaterCheckLoading.value) {
                    Dialog.tipSuccess(t("检测到待准备资源: {bundles}", { bundles: resourceBundle.value }));
                }
                resourceStatus.value = "";
                resourceBundle.value = "";
            } else {
                resourceStatus.value = "";
                resourceBundle.value = "";
            }
            break;
        case "resource-downloading":
            resourceStatus.value = "downloading";
            resourceBundle.value = formatBundleLabel(data.bundle);
            resourcePercent.value = data.percent || 0;
            resourceTransferred.value = data.transferred || 0;
            resourceTotal.value = data.total || 0;
            break;
        case "resource-installing":
            resourceStatus.value = "installing";
            resourceBundle.value = formatBundleLabel(data.bundle);
            break;
        case "resource-installed":
            resourceStatus.value = "installed";
            resourceBundle.value = formatBundleLabel(data.bundle);
            resourcePercent.value = 100;
            Dialog.tipSuccess(t("资源 {bundle} 已准备完成", { bundle: data.bundle }));
            setTimeout(() => {
                if (resourceStatus.value === 'installed' && resourceBundle.value === data.bundle) {
                    resourceStatus.value = "";
                    resourceBundle.value = "";
                }
            }, 1500);
            break;
        case "resource-ready":
            resourceStatus.value = "";
            break;
        case "available":
            updateStatus.value = "available";
            updateVersion.value = data.version;
            if (autoPrompt) {
                Dialog.confirm(
                    t("发现新版本 {version}，是否立即下载更新？", {version: data.version})
                ).then(() => {
                    doDownloadUpdate();
                }).catch(() => {});
            }
            break;
        case "not-available":
            updateStatus.value = "";
            resourceStatus.value = "";
            if (updaterCheckLoading.value) {
                Dialog.tipSuccess(t("已经是最新版本"));
            }
            updaterCheckLoading.value = false;
            break;
        case "downloading":
            updateStatus.value = "downloading";
            downloadPercent.value = data.percent;
            downloadSpeed.value = data.bytesPerSecond;
            downloadTransferred.value = data.transferred;
            downloadTotal.value = data.total;
            break;
        case "downloaded":
            updateStatus.value = "downloaded";
            if (autoPrompt) {
                Dialog.confirm(t("新版本已下载完成，是否立即重启安装？")).then(() => {
                    window.$mapi.updater.quitAndInstall();
                }).catch(() => {});
            }
            break;
        case "error":
            updateStatus.value = "";
            updaterCheckLoading.value = false;
            if (String(data.message || '').includes('资源') || String(data.message || '').includes('bundle')) {
                resourceStatus.value = "";
                Dialog.tipError(t("资源准备失败: {error}", {error: data.message}));
            } else {
                Dialog.tipError(t("更新失败: {error}", {error: data.message}));
            }
            break;
    }
};

onMounted(async () => {
    loadCheckAtLaunch();
    const latestStatus = await window.$mapi.updater.getLatestStatus();
    if (latestStatus) {
        handleUpdaterStatus(latestStatus, false);
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

const loadCheckAtLaunch = async () => {
    checkAtLaunch.value = await window.$mapi.updater.getCheckAtLaunch();
};

const onCheckAtLaunchChange = async (value: boolean) => {
    await window.$mapi.updater.setCheckAtLaunch(value ? "yes" : "no");
    await loadCheckAtLaunch();
};

const doVersionCheck = async () => {
    updaterCheckLoading.value = true;
    try {
        await window.$mapi.updater.checkForUpdate();
    } catch (error: any) {
        updaterCheckLoading.value = false;
        Dialog.tipError(t("检查更新失败: {error}", { error: error.message || String(error) }));
    }
};

const doDownloadUpdate = async () => {
    updateStatus.value = "downloading";
    downloadPercent.value = 0;
    await window.$mapi.updater.downloadUpdate();
};

const doQuitAndInstall = () => {
    window.$mapi.updater.quitAndInstall();
};

const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
</script>

<template>
    <div class="inline-flex items-center">
        <a-button
            v-if="resourceStatus === 'downloading'"
            size="mini"
            class="mr-2"
            loading
            disabled
        >
            {{ $t("资源准备") }} {{ resourceBundle }} {{ resourcePercent }}% {{ formatSize(resourceTransferred) }}/{{ formatSize(resourceTotal) }}
        </a-button>
        <a-button
            v-else-if="resourceStatus === 'installing' || resourceStatus === 'checking'"
            size="mini"
            class="mr-2"
            loading
            disabled
        >
            {{ $t("正在准备资源") }}{{ resourceBundle ? ` ${resourceBundle}` : '' }}
        </a-button>
        <a-button
            v-else-if="updateStatus === 'downloading'"
            size="mini"
            class="mr-2"
            loading
            disabled
        >
            {{ downloadPercent }}% {{ formatSize(downloadTransferred) }}/{{ formatSize(downloadTotal) }} ({{ formatSpeed(downloadSpeed) }})
        </a-button>
        <a-button
            v-else-if="updateStatus === 'downloaded'"
            size="mini"
            class="mr-2"
            type="primary"
            @click="doQuitAndInstall()"
        >
            {{ $t("重启并更新") }}
        </a-button>
        <a-button
            v-else
            size="medium"
            class="mr-2"
            :loading="updaterCheckLoading"
            @click="doVersionCheck()"
        >
            {{ $t("检测更新") }}
        </a-button>
        <a-checkbox :model-value="checkAtLaunch === 'yes'" @change="onCheckAtLaunchChange as any">
            {{ $t("自动检测更新") }}
        </a-checkbox>
    </div>
</template>
