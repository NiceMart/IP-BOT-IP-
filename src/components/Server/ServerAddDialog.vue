<script setup lang="ts">
import {computed, ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {functionToLabels} from "../../lib/aigcpanel";
import {EnumServerType, ServerRecord} from "../../types/Server";
import {useServerStore} from "../../store/modules/server";
import {VersionUtil} from "../../lib/util";
import {AppConfig} from "../../config";
import ServerAddResolvePanel from "./ServerAddResolvePanel.vue";
import {isDev} from "../../lib/env";

const resolvePanel = ref<InstanceType<typeof ServerAddResolvePanel> | null>(null);

const serverStore = useServerStore();
const visible = ref(false);
const loading = ref(false);
const modelInfo = ref({
    type: EnumServerType.LOCAL as EnumServerType,
    name: "",
    version: "",
    serverRequire: "",
    title: "",
    description: "",
    deviceDescription: "",
    path: "",
    platformName: "",
    platformArch: "",
    entry: "",
    functions: [],
    settings: [],
    setting: {},
    isSupport: false,
    config: {} as Record<string, any>,
});
const isImporting = ref(false);
const logStatus = ref("");
const KNOWN_VOICE_BUNDLE_ROOT = "";
const KNOWN_VOICE_BUNDLES = [
    "asr_bundle",
    "tts_bundle",
    "video_sync_bundle",
];

const show = () => {
    emptyModelInfo();
    visible.value = true;
};

const platformInfo = computed(() => {
    const platformNameMap = {
        win: "Windows",
        osx: "macOS",
        linux: "Linux",
    };
    const platformName = platformNameMap[modelInfo.value.platformName] || modelInfo.value.platformName;
    return `${platformName} ${modelInfo.value.platformArch}`;
});
const functionLabels = computed(() => {
    return functionToLabels(modelInfo.value.functions);
});

const normalizeBundleConfig = (json: any, serverPath: string) => {
    const normalized = JSON.parse(JSON.stringify(json || {}));
    normalized.easyServer = normalized.easyServer || {};
    normalized.easyServer.functions = {
        ...(normalized.easyServer.functions || {}),
    };
    const pathLower = (serverPath || "").toLowerCase().replace(/\\/g, "/");
    const nameLower = String(normalized.name || '').toLowerCase();

    const isAsrBundle = pathLower.includes('/asr_bundle') || nameLower === 'asrbundle';
    const isTtsBundle = pathLower.includes('/tts_bundle') || nameLower === 'ttsbundle';
    const isVideoSyncBundle = pathLower.includes('/video_sync_bundle') || nameLower === 'videosync';

    if (isAsrBundle) {
        normalized.name = normalized.name || 'asrBundle';
        normalized.title = normalized.title || 'ASR Bundle';
        normalized.description = normalized.description || 'Offline speech recognition bundle.';
        normalized.functions = ['asr'];
        if (normalized.easyServer.functions.speechRecognition && !normalized.easyServer.functions.asr) {
            normalized.easyServer.functions.asr = normalized.easyServer.functions.speechRecognition;
        }
    } else if (isTtsBundle) {
        normalized.name = normalized.name || 'ttsBundle';
        normalized.title = normalized.title || 'TTS Bundle';
        normalized.description = normalized.description || 'Offline voice generation bundle.';
        normalized.functions = ['soundClone'];
    } else if (isVideoSyncBundle) {
        normalized.name = normalized.name || 'videosync';
        normalized.title = normalized.title || 'Video Sync';
        normalized.description = normalized.description || 'Protected digital human video generation bundle.';
        normalized.functions = ['videoGen'];
    }

    return normalized;
};

const trimTrailingSeparators = (value: string) => {
    return (value || "").replace(/[\/\\]+$/, "");
};

const joinLocalPath = (basePath: string, childName: string) => {
    return `${trimTrailingSeparators(basePath)}\\${childName}`;
};

const getDirName = (targetPath: string) => {
    const parts = trimTrailingSeparators(targetPath).split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] || targetPath;
};

const emptyModelInfo = () => {
    modelInfo.value.type = EnumServerType.LOCAL;
    modelInfo.value.name = "";
    modelInfo.value.version = "";
    modelInfo.value.title = "";
    modelInfo.value.description = "";
    modelInfo.value.serverRequire = "";
    modelInfo.value.deviceDescription = "";
    modelInfo.value.path = "";
    modelInfo.value.platformName = "";
    modelInfo.value.platformArch = "";
    modelInfo.value.entry = "";
    modelInfo.value.functions = [];
    modelInfo.value.settings = [];
    modelInfo.value.setting = {};
    modelInfo.value.isSupport = false;
    modelInfo.value.config = {};
    resolvePanel.value?.reset();
};

const doSubmitLocalDir = async () => {
    try {
        console.log("[ServerAddDialog.doSubmitLocalDir] 开始添加本地模型");

        const serverKey = serverStore.generateServerKey({
            name: modelInfo.value.name,
            version: modelInfo.value.version,
        } as any);

        console.log("[ServerAddDialog.doSubmitLocalDir] 生成的服务器Key:", serverKey);

        const serverRecord: ServerRecord = {
            key: serverKey,
            name: modelInfo.value.name,
            title: modelInfo.value.title,
            version: modelInfo.value.version,
            type: modelInfo.value.type,
            autoStart: modelInfo.value.entry === "__EasyServer__",
            functions: modelInfo.value.functions,
            localPath: modelInfo.value.path,
            settings: modelInfo.value.settings,
            setting: modelInfo.value.setting,
            config: modelInfo.value.config,
        } as ServerRecord;

        console.log("[ServerAddDialog.doSubmitLocalDir] 服务器记录:", {
            key: serverRecord.key,
            name: serverRecord.name,
            version: serverRecord.version,
            type: serverRecord.type,
            localPath: serverRecord.localPath,
        });

        await serverStore.add(serverRecord);
        console.log("[ServerAddDialog.doSubmitLocalDir] ✅ 模型已添加到存储");
    } catch (e: any) {
        console.error("[ServerAddDialog.doSubmitLocalDir] ❌ 添加模型失败:", {
            error: e,
            message: e.message,
            stack: e.stack,
        });
        throw e;
    }
};

const installBundleRecord = async (serverPath: string, json: any) => {
    const serverKey = serverStore.generateServerKey({
        name: json.name,
        version: json.version,
    } as any);

    const serverRecord: ServerRecord = {
        key: serverKey,
        name: json.name,
        title: json.title,
        version: json.version,
        type: EnumServerType.LOCAL_DIR,
        autoStart: json.entry === "__EasyServer__",
        functions: json.functions || [],
        localPath: serverPath,
        settings: json.settings || [],
        setting: json.setting || {},
        config: json,
    } as ServerRecord;

    await serverStore.add(serverRecord);
};

const importBundleDirectories = async (bundleDirs: string[]) => {
    const imported: string[] = [];
    const skipped: string[] = [];
    const currentPlatform = $mapi.app.platformName();
    const currentArch = $mapi.app.platformArch();

    for (const rawDir of bundleDirs) {
        const serverPath = trimTrailingSeparators(rawDir);
        const dirName = getDirName(serverPath);
        const configPath = joinLocalPath(serverPath, "config.json");
        const exists = await $mapi.file.exists(configPath, {isDataPath: false});
        if (!exists) {
            skipped.push(`${dirName}(missing-config)`);
            continue;
        }

        const content = await $mapi.file.read(configPath, {isDataPath: false});
        const json = normalizeBundleConfig(JSON.parse(content), serverPath);
        const displayName = json.title || dirName;

        if (!json.name || !json.version) {
            skipped.push(`${displayName}(invalid-config)`);
            continue;
        }

        if (!isDev && json.platformName && json.platformName !== currentPlatform) {
            skipped.push(`${displayName}(platform-mismatch)`);
            continue;
        }

        if (!isDev && json.platformArch && json.platformArch !== currentArch) {
            skipped.push(`${displayName}(arch-mismatch)`);
            continue;
        }

        if (!VersionUtil.match(AppConfig.version, json.serverRequire || "*")) {
            skipped.push(`${displayName}(version-mismatch)`);
            continue;
        }

        const isSupport = await $mapi.server.isSupport({
            localPath: serverPath,
            name: json.name,
        } as any);
        if (!isSupport) {
            skipped.push(`${displayName}(unsupported)`);
            continue;
        }

        const existsByName = await serverStore.getByNameVersion(json.name, json.version);
        if (existsByName) {
            skipped.push(`${displayName}(exists)`);
            continue;
        }

        await installBundleRecord(serverPath, json);
        imported.push(displayName);
    }

    if (imported.length > 0) {
        Dialog.tipSuccess(`已导入 ${imported.length} 个模型: ${imported.join("、")}`);
        emit("update");
        return;
    }

    Dialog.tipError(`没有导入新模型，已跳过: ${skipped.join("、") || "none"}`);
};

const resolveBundleDirectories = async (selectedRoot: string) => {
    const normalizedRoot = trimTrailingSeparators(selectedRoot);
    const candidates = new Set<string>();
    const directConfigPath = joinLocalPath(normalizedRoot, "config.json");

    if (await $mapi.file.exists(directConfigPath, {isDataPath: false})) {
        candidates.add(normalizedRoot);
    }

    for (const dirName of KNOWN_VOICE_BUNDLES) {
        const bundleDir = joinLocalPath(normalizedRoot, dirName);
        const bundleConfigPath = joinLocalPath(bundleDir, "config.json");
        if (await $mapi.file.exists(bundleConfigPath, {isDataPath: false})) {
            candidates.add(bundleDir);
        }
    }

    return Array.from(candidates);
};

const doImportVoiceBundlesFromDirectory = async () => {
    const selectedRoot = await $mapi.file.openDirectory({
        title: "选择 bundles 根目录",
    });
    if (!selectedRoot) {
        return;
    }

    loading.value = true;
    try {
        const bundleDirs = await resolveBundleDirectories(selectedRoot);
        if (bundleDirs.length === 0) {
            Dialog.tipError("请选择包含 asr_bundle、tts_bundle、video_sync_bundle 的目录，或直接选择某个 bundle 目录");
            return;
        }
        await importBundleDirectories(bundleDirs);
    } catch (error: any) {
        Dialog.tipError(error?.message || "导入语音 bundles 失败");
    } finally {
        loading.value = false;
    }
};

const doImportKnownVoiceBundles = async () => {
    loading.value = true;
    try {
        const imported: string[] = [];
        const skipped: string[] = [];

        for (const dirName of KNOWN_VOICE_BUNDLES) {
            const configPath = `${KNOWN_VOICE_BUNDLE_ROOT}\\${dirName}\\config.json`;
            const exists = await $mapi.file.exists(configPath, { isDataPath: false });
            if (!exists) {
                skipped.push(`${dirName}(missing)`);
                continue;
            }

            const content = await $mapi.file.read(configPath, { isDataPath: false });
            const serverPath = configPath.slice(0, -'config.json'.length).replace(/[\/\\]+$/, '');
            const json = normalizeBundleConfig(JSON.parse(content), serverPath);

            const existsByName = await serverStore.getByNameVersion(json.name, json.version);
            if (existsByName) {
                skipped.push(`${json.title || dirName}(exists)`);
                continue;
            }

            await installBundleRecord(serverPath, json);
            imported.push(json.title || dirName);
        }

        if (imported.length > 0) {
            Dialog.tipSuccess(`已导入 ${imported.length} 个模型: ${imported.join("、")}`);
            emit("update");
        } else {
            Dialog.tipError(`未导入新模型，跳过: ${skipped.join("、") || "none"}`);
        }
    } catch (error: any) {
        Dialog.tipError(error?.message || "导入语音 bundles 失败");
    } finally {
        loading.value = false;
    }
};

const doImportKnownVoiceBundlesQuickInstall = async () => {
    loading.value = true;
    try {
        const imported: string[] = [];
        const skipped: string[] = [];
        const currentPlatform = $mapi.app.platformName();
        const currentArch = $mapi.app.platformArch();

        for (const dirName of KNOWN_VOICE_BUNDLES) {
            const configPath = `${KNOWN_VOICE_BUNDLE_ROOT}\\${dirName}\\config.json`;
            const exists = await $mapi.file.exists(configPath, {isDataPath: false});
            if (!exists) {
                skipped.push(`${dirName}(missing)`);
                continue;
            }

            const content = await $mapi.file.read(configPath, {isDataPath: false});
            const serverPath = configPath.slice(0, -"config.json".length).replace(/[\/\\]+$/, "");
            const json = normalizeBundleConfig(JSON.parse(content), serverPath);

            if (!json.name || !json.version) {
                skipped.push(`${dirName}(invalid-config)`);
                continue;
            }

            if (!isDev && json.platformName && json.platformName !== currentPlatform) {
                skipped.push(`${json.title || dirName}(platform-mismatch)`);
                continue;
            }

            if (!isDev && json.platformArch && json.platformArch !== currentArch) {
                skipped.push(`${json.title || dirName}(arch-mismatch)`);
                continue;
            }

            if (!VersionUtil.match(AppConfig.version, json.serverRequire || "*")) {
                skipped.push(`${json.title || dirName}(version-mismatch)`);
                continue;
            }

            const isSupport = await $mapi.server.isSupport({
                localPath: serverPath,
                name: json.name,
            } as any);
            if (!isSupport) {
                skipped.push(`${json.title || dirName}(unsupported)`);
                continue;
            }

            const existsByName = await serverStore.getByNameVersion(json.name, json.version);
            if (existsByName) {
                skipped.push(`${json.title || dirName}(exists)`);
                continue;
            }

            await installBundleRecord(serverPath, json);
            imported.push(json.title || dirName);
        }

        if (imported.length > 0) {
            Dialog.tipSuccess(`Imported ${imported.length} models: ${imported.join(", ")}`);
            emit("update");
            return;
        }

        Dialog.tipError(`No new models imported. Skipped: ${skipped.join(", ") || "none"}`);
    } catch (error: any) {
        Dialog.tipError(error?.message || "Import voice bundles failed");
    } finally {
        loading.value = false;
    }
};

const doSubmit = async () => {
    console.log("[ServerAddDialog.doSubmit] 开始提交模型，modelInfo:", {
        name: modelInfo.value.name,
        version: modelInfo.value.version,
        path: modelInfo.value.path,
        type: modelInfo.value.type,
    });

    if (!modelInfo.value.path) {
        console.error("[ServerAddDialog.doSubmit] ❌ 路径为空，中止提交");
        Dialog.tipError(t("模型路径为空"));
        return;
    }

    if (!modelInfo.value.name) {
        console.error("[ServerAddDialog.doSubmit] ❌ 模型名称为空，中止提交");
        Dialog.tipError(t("模型名称为空"));
        return;
    }

    if (!modelInfo.value.version) {
        console.error("[ServerAddDialog.doSubmit] ❌ 模型版本为空，中止提交");
        Dialog.tipError(t("模型版本为空"));
        return;
    }

    isImporting.value = true;
    try {
        console.log("[ServerAddDialog.doSubmit] ✅ 基础字段验证通过");

        console.log("[ServerAddDialog.doSubmit] 📍 开始调用 $mapi.file.fullPath...");
        const target = await $mapi.file.fullPath(`model/${modelInfo.value.name}-${modelInfo.value.version}`);
        console.log("[ServerAddDialog.doSubmit] ✅ fullPath 返回:", target);

        console.log("[ServerAddDialog.doSubmit] 📍 开始检查模型文件是否存在...");
        const existsInFile = await $mapi.file.exists(target);
        console.log("[ServerAddDialog.doSubmit] ✅ 文件存在检查完成，结果:", existsInFile);

        if (existsInFile) {
            console.warn("[ServerAddDialog.doSubmit] ⚠️ 模型目录已存在:", target);
            Dialog.tipError(t("模型相同版本已存在"));
            return;
        }

        console.log("[ServerAddDialog.doSubmit] 📍 开始检查存储中是否有相同模型...");
        const exists = await serverStore.getByNameVersion(modelInfo.value.name, modelInfo.value.version);
        console.log("[ServerAddDialog.doSubmit] ✅ 存储检查完成，结果:", exists);

        if (exists) {
            console.warn("[ServerAddDialog.doSubmit] ⚠️ 模型已存在于存储中");
            Dialog.tipError(t("模型相同版本已存在"));
            return;
        }

        console.log("[ServerAddDialog.doSubmit] 📍 开始检查平台兼容性...");
        const currentPlatform = $mapi.app.platformName();
        const currentArch = $mapi.app.platformArch();
        console.log("[ServerAddDialog.doSubmit] ✅ 当前平台:", currentPlatform, "架构:", currentArch);
        console.log("[ServerAddDialog.doSubmit] ✅ 模型平台:", modelInfo.value.platformName, "架构:", modelInfo.value.platformArch);

        if ($mapi.app.platformName() !== modelInfo.value.platformName && !isDev) {
            console.warn("[ServerAddDialog.doSubmit] ⚠️ 平台不匹配");
            Dialog.tipError(t("模型平台不匹配"));
            return;
        }
        if ($mapi.app.platformArch() !== modelInfo.value.platformArch && !isDev) {
            console.warn("[ServerAddDialog.doSubmit] ⚠️ 架构不匹配");
            Dialog.tipError(t("模型架构不匹配"));
            return;
        }

        console.log("[ServerAddDialog.doSubmit] 📍 开始检查版本要求...");
        if (!VersionUtil.match(AppConfig.version, modelInfo.value.serverRequire)) {
            console.warn("[ServerAddDialog.doSubmit] ⚠️ 版本不满足要求");
            Dialog.tipError(t("软件不满足模型版本要求"));
            return;
        }
        console.log("[ServerAddDialog.doSubmit] ✅ 版本检查通过");

        console.log("[ServerAddDialog.doSubmit] ✅ 所有检查通过，准备添加模型");
        console.log("[ServerAddDialog.doSubmit] 模型类型:", modelInfo.value.type);

        if (modelInfo.value.type === EnumServerType.LOCAL_DIR) {
            console.log("[ServerAddDialog.doSubmit] 📍 开始调用 doSubmitLocalDir...");
            await doSubmitLocalDir();
            console.log("[ServerAddDialog.doSubmit] ✅ doSubmitLocalDir 完成");
        } else {
            console.error("[ServerAddDialog.doSubmit] ❌ 模型类型错误:", modelInfo.value.type);
            Dialog.tipError(t("模型类型错误"));
            return;
        }

        console.log("[ServerAddDialog.doSubmit] ✅ 模型添加成功");
        Dialog.tipSuccess(t("模型添加成功"));
        visible.value = false;
        emit("update");
    } catch (error: any) {
        console.error("[ServerAddDialog.doSubmit] ❌ 模型添加失败:", {
            error: error,
            message: error.message,
            stack: error.stack,
        });
        Dialog.tipError(error.message || t("模型添加失败"));
    } finally {
        console.log("[ServerAddDialog.doSubmit] 重置 isImporting 状态");
        isImporting.value = false;
    }
};

const doSelectLocalDir = async () => {
    console.log("[ServerAddDialog.doSelectLocalDir] 开始选择本地模型目录");

    const configPath = await $mapi.file.openFile({
        filters: [{name: "config.json", extensions: ["json"]}],
    });
    if (!configPath) {
        console.log("[ServerAddDialog.doSelectLocalDir] 用户取消了文件选择");
        return;
    }

    console.log("[ServerAddDialog.doSelectLocalDir] 用户选择的文件路径:", configPath);

    emptyModelInfo();
    loading.value = true;

    try {
        console.log("[ServerAddDialog.doSelectLocalDir] 开始读取配置文件:", configPath);
        const content = await $mapi.file.read(configPath, {
            isDataPath: false,
        });
        console.log("[ServerAddDialog.doSelectLocalDir] 读取成功，文件大小:", content.length, "字节");

        // 🔧 改进路径提取逻辑 - 支持 Windows 和 Unix 路径
        let serverPath = configPath;
        // 移除末尾的 config.json（支持 \ 和 / 分隔符）
        if (configPath.endsWith('config.json')) {
            serverPath = configPath.slice(0, -'config.json'.length);
        }
        // 移除末尾的分隔符
        serverPath = serverPath.replace(/[\/\\]+$/, '');

        console.log("[ServerAddDialog.doSelectLocalDir] 配置文件路径:", configPath);
        console.log("[ServerAddDialog.doSelectLocalDir] 提取的服务器路径:", serverPath);

        const json = normalizeBundleConfig(JSON.parse(content), serverPath);
        console.log("[ServerAddDialog.doSelectLocalDir] JSON 解析成功:", json);
        modelInfo.value.type = EnumServerType.LOCAL_DIR;
        modelInfo.value.name = json.name || "";
        modelInfo.value.version = json.version || "";
        modelInfo.value.serverRequire = json.serverRequire || "*";
        modelInfo.value.deviceDescription = json.deviceDescription || "";
        modelInfo.value.title = json.title || "";
        modelInfo.value.description = json.description || "";
        modelInfo.value.path = serverPath;
        modelInfo.value.platformName = json.platformName || "";
        modelInfo.value.platformArch = json.platformArch || "";
        modelInfo.value.entry = json.entry || "";
        modelInfo.value.functions = json.functions || [];
        modelInfo.value.settings = json.settings || [];
        modelInfo.value.setting = json.setting || {};
        modelInfo.value.config = json;
        modelInfo.value.isSupport = await $mapi.server.isSupport({
            localPath: serverPath,
            name: modelInfo.value.name,
        } as any);
        console.log("[ServerAddDialog.doSelectLocalDir] isSupport 结果:", modelInfo.value.isSupport);

        if (modelInfo.value.isSupport) {
            logStatus.value = "";
            console.log("[ServerAddDialog.doSelectLocalDir] ✅ 模型支持当前系统");
        } else {
            logStatus.value = t("模型不支持");
            const currentPlatform = $mapi.app.platformName();
            const currentArch = $mapi.app.platformArch();
            console.log("[ServerAddDialog.doSelectLocalDir] ❌ 模型不支持", {
                modelPlatform: modelInfo.value.platformName,
                currentPlatform,
                modelArch: modelInfo.value.platformArch,
                currentArch,
            });
            if (modelInfo.value.platformName !== currentPlatform) {
                logStatus.value += `(${t("平台不匹配")})`;
            }
            if (modelInfo.value.platformArch !== currentArch) {
                logStatus.value += `(${t("芯片架构不匹配")})`;
            }
        }
        console.log("[ServerAddDialog.doSelectLocalDir] 模型加载完成，名称:", modelInfo.value.name, "状态:", logStatus.value);
    } catch (e: any) {
        console.error("[ServerAddDialog.doSelectLocalDir] ❌ 配置文件处理异常:", {
            error: e,
            message: e.message,
            stack: e.stack,
        });
        Dialog.tipError(t("模型目录识别失败，请选择正确的模型目录") + "\n\n错误信息: " + (e.message || String(e)));
        // 清空模型信息，允许用户重新选择
        emptyModelInfo();
    } finally {
        console.log("[ServerAddDialog.doSelectLocalDir] 重置 loading 状态");
        loading.value = false;
    }
};

const doSelectCloud = async () => {
    Dialog.tipError(t("请升级Pro版使用"));
};
defineExpose({
    show,
    doSelectCloud,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="40rem"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("添加本地模型") }}
        </template>
        <div>
            <div class="select-none" style="max-height: 70vh">
                <div v-if="!modelInfo.name">
                    <div class="px-3">
                        <div>
                            <img class="w-48 h-48 object-contain m-auto" src="./../../assets/image/server-folder.svg"/>
                        </div>
                        <div class="flex gap-4">
                            <a-button @click="doImportVoiceBundlesFromDirectory" class="block w-full" :loading="loading">
                                <template #icon>
                                    <icon-import/>
                                </template>
                                {{ $t("一键导入语音Bundles") }}
                            </a-button>
                            <a-button @click="doSelectLocalDir" class="block w-full" :loading="loading">
                                <template #icon>
                                    <icon-folder/>
                                </template>
                                {{ t("选择本地模型") }}
                                config.json
                            </a-button>
                        </div>
                        <div class="mt-2 text-xs text-gray-500">
                            一键导入会先让你选择 bundles 根目录，目录下应包含 asr_bundle、tts_bundle、video_sync_bundle。
                        </div>
                        <div class="mt-2">
                            <div class="text-sm bg-gray-100 p-5 rounded-lg text-gray-500 leading-6">
                                <div>
                                    {{ $t("模型运行在本地，对电脑性能有要求") }}
                                </div>
                                <div>
                                    {{ "① " + $t("访问模型市场，下载模型到本地") }}
                                </div>
                                <div>
                                    {{ "② " + $t("解压模型压缩包，选择目录中的config.json文件") }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <div class="border rounded-lg py-4 leading-10">
                        <div class="flex">
                            <div class="pr-3 text-right w-20">{{ t("名称") }}</div>
                            <div class="flex flex-wrap items-center">
                                <div class="mr-2 mb-1">{{ modelInfo.title }}</div>
                                <div class="mr-2 text-sm bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1">
                                    v{{ modelInfo.version }}
                                </div>
                                <div class="mr-2 text-xs bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1">
                                    {{ modelInfo.name }}
                                </div>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("描述") }}</div>
                            <div>{{ modelInfo.description }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ $t("适配") }}</div>
                            <div>{{ platformInfo }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ $t("功能") }}</div>
                            <div>
                                <a-tag v-for="label in functionLabels" class="mr-1">
                                    {{ label }}
                                </a-tag>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("硬件要求") }}</div>
                            <div>{{ modelInfo.deviceDescription }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("版本要求") }}</div>
                            <div>{{ modelInfo.serverRequire === "*" ? t("无") : modelInfo.serverRequire }}</div>
                        </div>
                    </div>
                    <div>
                        <ServerAddResolvePanel ref="resolvePanel" :root="modelInfo.path"/>
                    </div>
                    <div class="pt-4 flex items-center">
                        <div>
                            <a-button
                                class="mr-2"
                                type="primary"
                                :disabled="!modelInfo.name || !modelInfo.path || !resolvePanel?.isSuccess()?.value"
                                :loading="isImporting"
                                @click="doSubmit"
                            >
                                <template #icon>
                                    <icon-check/>
                                </template>
                                {{ $t("确认提交") }}
                            </a-button>
                            <a-button class="mr-2" v-if="!isImporting" @click="emptyModelInfo" :loading="loading">
                                <template #icon>
                                    <icon-redo/>
                                </template>
                                {{ $t("重新选择") }}
                            </a-button>
                        </div>
                        <div class="flex-grow pl-3 text-sm truncate text-red-600">
                            {{ logStatus }}
                        </div>
                    </div>
                </div>
                <div class="h-5"></div>
            </div>
        </div>
    </a-modal>
</template>
