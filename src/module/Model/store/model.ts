import { defineStore } from "pinia";
import store from "../../../store/index";

import { getProviderLogo, getProviderTitle, SystemProviders } from "../providers";
import { SystemModels } from "../models";
import { BUILTIN_PROVIDERS, isBuiltInProvider, getBuiltInConfig, refreshBuiltinProviders } from "../builtinConfig";
import { Model, Provider } from "../types";
import { ObjectUtil, StringUtil } from "../../../lib/util";
import { debounce } from "lodash-es";
import { ModelChatResult, ModelProvider } from "../provider/provider";
import { mapError } from "../../../lib/error";
import { Dialog } from "../../../lib/dialog";
import { t } from "../../../lang";
import { useUserStore } from "../../../store/modules/user";
import { watch } from "vue";
import { AppConfig } from "../../../config";
import { getSystemConfigSync, fetchSystemConfig } from "../../../service/systemConfig";

const userStore = useUserStore();

export type ModelItem = {
    id: string;
    providerId: string;
    providerLogo: string;
    providerTitle: string;
    modelId: string;
    modelName: string;
}

watch(
    () => userStore.data,
    newValue => {
        model.init().then();
    },
    {
        deep: true,
    }
);

const mapModelError = (e: any, provider: Provider) => {
    if (provider.id === "buildIn") {
        const msg = e + "";
        const showCharge = () => {
            if (window.$mapi) {
                window.$mapi.user
                    .open({
                        readyParam: {
                            page: "ChargeLmApi",
                        },
                    })
                    .then();
            } else {
                console.warn('⚠️ $mapi 不可用，无法打开用户页面');
            }
        };
        const map = {
            insufficient_user_quota: {
                msg: t("大模型能量不足，请充值后继续使用"),
                callback: showCharge,
            },
        };
        for (const key in map) {
            if (msg.includes(key)) {
                const error = map[key];
                if (error.callback) {
                    setTimeout(() => {
                        error.callback();
                    }, 3000);
                }
                return error.msg;
            }
        }
    }
    return mapError(e);
};

export const modelStore = defineStore("model", {
    state() {
        return {
            providers: [] as Provider[],
        };
    },
    actions: {
        async init() {
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过模型初始化');
                return;
            }

            refreshBuiltinProviders();

            const results: Provider[] = [];
            for (const providerId in SystemProviders) {
                const provider = SystemProviders[providerId];
                const builtInConfig = getBuiltInConfig(providerId);

                results.push({
                    id: providerId,
                    type: "openai",
                    title: getProviderTitle(providerId),
                    logo: getProviderLogo(providerId),
                    isSystem: true,
                    isBuiltIn: isBuiltInProvider(providerId), // 标记是否为内置提供商
                    apiUrl: provider.api.url,
                    websites: {
                        official: provider.websites?.official,
                        docs: provider.websites?.docs,
                        models: provider.websites?.models,
                    },
                    data: {
                        apiKey: builtInConfig?.apiKey || "",  // 内置提供商使用硬编码的 API Key
                        apiHost: builtInConfig?.apiHost || "",
                        // OSS 配置（仅内置阿里云有）
                        ossAccessKeyId: builtInConfig?.ossConfig?.accessKeyId || "",
                        ossAccessKeySecret: builtInConfig?.ossConfig?.accessKeySecret || "",
                        ossBucket: builtInConfig?.ossConfig?.bucket || "",
                        ossRegion: builtInConfig?.ossConfig?.region || "",
                        models: (SystemModels[providerId] || []).map(m => {
                            return {
                                id: m.id,
                                provider: providerId,
                                name: m.name,
                                group: m.group,
                                types: m.types || ["text"],  // 使用模型定义的types
                                enabled: builtInConfig ? true : false, // 内置模型默认启用
                                editable: false,  // 系统模型不可编辑/删除
                            } as any;
                        }),
                        enabled: builtInConfig?.enabled || false, // 内置提供商默认启用
                    },
                });
            }
            let buildInProviderData: any = null;
            const storageData = await $mapi.storage.read("models");
            if (storageData) {
                if (storageData.userProviders) {
                    storageData.userProviders.forEach(provider => {
                        results.unshift({
                            id: provider.id,
                            type: provider.type,
                            title: provider.title,
                            logo: null,
                            isSystem: false,
                            apiUrl: "",
                            websites: {
                                official: "",
                                docs: "",
                                models: "",
                            },
                            data: {
                                apiKey: "",
                                apiHost: "",
                                models: [],
                                enabled: false,
                            },
                        });
                    });
                }
                if (storageData.providerData) {
                    buildInProviderData = storageData.providerData["buildIn"] || null;
                    for (const providerId in storageData.providerData) {
                        const provider = results.find(p => p.id === providerId);
                        if (provider) {
                            // 内置提供商：只加载模型启用状态，不加载 API Key 和 OSS 配置（这些是硬编码的）
                            if (isBuiltInProvider(providerId)) {
                                // 只加载模型的启用状态
                                (storageData.providerData[providerId].models || []).forEach(savedModel => {
                                    const existingModel = provider.data.models.find(m => m.id === savedModel.id);
                                    if (existingModel) {
                                        existingModel.enabled = savedModel.enabled || false;
                                    } else if (savedModel.id) {
                                        provider.data.models.push({
                                            id: savedModel.id,
                                            provider: providerId,
                                            name: savedModel.name || savedModel.id,
                                            group: savedModel.group || "Custom",
                                            types: savedModel.types || ["text"],
                                            enabled: savedModel.enabled !== false,
                                            editable: savedModel.editable !== false,
                                        } as any);
                                    }
                                });
                                // 加载提供商的启用状态
                                if ('enabled' in storageData.providerData[providerId]) {
                                    provider.data.enabled = storageData.providerData[providerId].enabled;
                                }
                            } else {
                                // 非内置提供商：加载完整配置
                                provider.data.apiKey = storageData.providerData[providerId].apiKey || "";
                                provider.data.apiHost = storageData.providerData[providerId].apiHost;
                                // 加载 OSS 配置（用于阿里云录音识别）
                                if (storageData.providerData[providerId].ossAccessKeyId) {
                                    provider.data.ossAccessKeyId = storageData.providerData[providerId].ossAccessKeyId;
                                }
                                if (storageData.providerData[providerId].ossAccessKeySecret) {
                                    provider.data.ossAccessKeySecret = storageData.providerData[providerId].ossAccessKeySecret;
                                }
                                if (storageData.providerData[providerId].ossBucket) {
                                    provider.data.ossBucket = storageData.providerData[providerId].ossBucket;
                                }
                                if (storageData.providerData[providerId].ossRegion) {
                                    provider.data.ossRegion = storageData.providerData[providerId].ossRegion;
                                }
                                if (storageData.providerData[providerId].ossEndpoint) {
                                    provider.data.ossEndpoint = storageData.providerData[providerId].ossEndpoint;
                                }
                                (storageData.providerData[providerId].models || []).forEach(model => {
                                    // 仅处理在 SystemModels 中定义的模型
                                    const systemModels = SystemModels[providerId] || [];
                                    const isSystemModel = systemModels.some(m => m.id === model.id);

                                    if (isSystemModel) {
                                        const existingModel = provider.data.models.find(m => m.id === model.id);
                                        if (existingModel) {
                                            existingModel.name = model.name;
                                            existingModel.group = model.group;
                                            existingModel.types = model.types || ["text"];
                                            existingModel.enabled = model.enabled || false;
                                            existingModel.editable = false;  // 系统模型强制不可编辑
                                        }
                                    } else if (providerId !== 'buildIn') {
                                        // 用户自定义的非系统模型，保留
                                        const existingModel = provider.data.models.find(m => m.id === model.id);
                                        if (!existingModel) {
                                            provider.data.models.push({
                                                id: model.id,
                                                provider: providerId,
                                                name: model.name,
                                                group: model.group,
                                                types: ["text"],
                                                enabled: model.enabled || false,
                                                editable: true,
                                            });
                                        }
                                    }
                                    // 其他模型（如被移除的系统模型）不再加载
                                });
                                provider.data.enabled = storageData.providerData[providerId].enabled || false;
                            }
                        }
                    }
                }
            }
            this.providers = results;
            // 合并服务端推送的模型配置
            await this.mergeServerModelProviders();
            await this.refreshBuildIn(buildInProviderData);
        },
        async enabledModels(): Promise<ModelItem[]> {
            const results: ModelItem[] = [];
            this.providers.forEach(provider => {
                if (provider.data.enabled) {
                    provider.data.models.forEach(model => {
                        if (model.enabled) {
                            results.push({
                                id: provider.id + "|" + model.id,
                                providerId: provider.id,
                                providerLogo: provider.logo || "",
                                providerTitle: provider.title || "",
                                modelId: model.id,
                                modelName: model.name,
                            });
                        }
                    });
                }
            });
            return results;
        },
        async mergeServerModelProviders() {
            try {
                // 先尝试刷新系统配置
                await fetchSystemConfig().catch(() => {});
                const config = getSystemConfigSync();
                const providersJson = config.model_providers || '[]';
                const serverProviders = JSON.parse(providersJson);

                if (!Array.isArray(serverProviders) || serverProviders.length === 0) return;

                // 移除之前推送的供应商（避免重复）
                this.providers = this.providers.filter(p => !p.id.startsWith('server_push_'));

                // 添加服务端推送的供应商
                for (const sp of serverProviders) {
                    if (sp.enabled === false) continue; // 跳过禁用的

                    const providerId = 'server_push_' + sp.id;
                    const models: Model[] = (sp.models || []).map((m: any) => ({
                        id: m.id,
                        provider: providerId,
                        name: m.name || m.id,
                        group: m.group || '云端推送',
                        types: m.types || ['text'],
                        enabled: m.enabled !== false,
                        editable: false, // 推送的模型不可编辑/删除
                    }));

                    this.providers.unshift({
                        id: providerId,
                        type: sp.type || 'openai',
                        title: (sp.title || '云端模型') + ' ☁️',
                        logo: null,
                        isSystem: true,
                        isServerPush: true,
                        apiUrl: '',
                        websites: { official: '', docs: '', models: '' },
                        data: {
                            apiKey: sp.apiKey || '',
                            apiHost: sp.apiHost || '',
                            models,
                            enabled: true,
                        },
                    });
                }
            } catch (e) {
                console.warn('[ModelStore] 合并服务端模型配置失败:', e);
            }
        },
        async refreshBuildIn(buildInProviderData?: any) {
            if (userStore.data && userStore.data.lmApi && userStore.data.lmApi.models) {
                const lmApi = userStore.data.lmApi;
                const buildInProvider = this.providers.find(p => p.id === "buildIn");
                if (!buildInProvider) {
                    const models: Model[] = [];
                    for (const m of lmApi.models) {
                        models.push({
                            id: m,
                            provider: "buildIn",
                            name: m,
                            group: "Default",
                            types: ["text"],
                            enabled: true,
                            editable: false,
                        });
                    }
                    // console.log("model.init.buildIn", JSON.stringify({lmApi}, null, 2));
                    let enabled = true;
                    if (buildInProviderData && 'enabled' in buildInProviderData) {
                        enabled = buildInProviderData.enabled;
                    }
                    console.log('model.init.buildIn', { enabled, buildInProviderData });
                    this.providers.unshift({
                        id: "buildIn",
                        type: "openai",
                        title: getProviderTitle("buildIn"),
                        logo: getProviderLogo("buildIn"),
                        isSystem: true,
                        apiUrl: lmApi.apiUrl,
                        websites: {
                            official: AppConfig.website,
                            docs: AppConfig.website,
                            models: AppConfig.website,
                        },
                        data: {
                            apiKey: lmApi.apiKey,
                            apiHost: "",
                            models: models,
                            enabled: enabled,
                        },
                    });
                } else {
                    buildInProvider.data.apiKey = lmApi.apiKey;
                }
            }
        },
        async add(provider: Partial<Provider>) {
            const p = {
                id: provider.id || StringUtil.random(8),
                type: provider.type,
                title: provider.title,
                logo: null,
                isSystem: false,
                websites: {
                    official: "",
                    docs: "",
                    models: "",
                },
                data: {
                    apiKey: "",
                    apiHost: "",
                    models: [],
                    enabled: false,
                },
            };
            this.providers.unshift(p as any);
            await this.sync();
        },
        async edit(provider: Partial<Provider>) {
            const p = this.providers.find(p => p.id === provider.id);
            if (p) {
                if ("title" in provider) {
                    p.title = provider.title || "";
                }
                if ("type" in provider) {
                    p.type = provider.type || "openai";
                }
                if (provider.data) {
                    if ("apiKey" in provider.data) {
                        p.data.apiKey = provider.data.apiKey;
                    }
                    if ("apiHost" in provider.data) {
                        p.data.apiHost = provider.data.apiHost;
                    }
                    if ("enabled" in provider.data) {
                        p.data.enabled = provider.data.enabled;
                    }
                }
                await this.sync();
            }
        },
        async test(providerId: string, modelId: string) {
            await this.refreshBuildIn();
            const provider = this.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find(m => m.id === modelId);
            if (!m) {
                return;
            }
            Dialog.loadingOn(t("测试中，请稍候..."));
            try {
                const ret = await ModelProvider.chat("你是什么模型，简短回答", {
                    type: provider.type,
                    modelId: m.id,
                    apiUrl: provider.apiUrl,
                    apiHost: provider.data.apiHost,
                    apiKey: provider.data.apiKey,
                });
                if (ret.code) {
                    throw ret.msg;
                }
                Dialog.tipSuccess(t("测试成功"));
            } catch (e) {
                Dialog.tipError(t("测试失败") + " " + mapModelError(e, provider));
            } finally {
                Dialog.loadingOff();
            }
        },
        async chat(
            providerId: string,
            modelId: string,
            prompt: string,
            option?: {
                loading: boolean;
            }
        ): Promise<ModelChatResult> {
            await this.refreshBuildIn();
            if (!providerId || !modelId) {
                Dialog.tipError(t("请选择模型"));
                return { code: -1, msg: t("请选择模型") };
            }
            option = Object.assign(
                {
                    loading: false,
                },
                option
            );
            const provider = this.providers.find(p => p.id === providerId);
            // console.log("provider.chat", JSON.stringify({provider}, null, 2));
            if (!provider) {
                return { code: -1, msg: "provider not found" };
            }
            const m = provider.data.models.find(m => m.id === modelId);
            if (!m) {
                return { code: -1, msg: "model not found" };
            }
            if (option.loading) {
                Dialog.loadingOn();
            }
            try {
                return await ModelProvider.chat(prompt, {
                    type: provider.type,
                    modelId: m.id,
                    apiUrl: provider.apiUrl,
                    apiHost: provider.data.apiHost,
                    apiKey: provider.data.apiKey,
                });
            } catch (e) {
                return { code: -1, msg: mapModelError(e, provider) };
            } finally {
                if (option.loading) {
                    Dialog.loadingOff();
                }
            }
        },
        async change(providerId: string, key: string, value: any) {
            const provider = model.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            const keys = key.split(".");
            let obj = provider as any;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!obj[keys[i]]) {
                    obj[keys[i]] = {};  // 自动创建中间对象
                }
                obj = obj[keys[i]];
            }
            const lastKey = keys[keys.length - 1];
            if (obj) {
                obj[lastKey] = value;  // 允许添加新字段
            }
            await this.sync();
        },
        async modelAdd(providerId: string, model: Partial<Model>) {
            const provider = this.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            if (provider.data.models.some(m => m.id === model.id)) {
                Dialog.tipError(t("模型ID已存在"));
                return false;
            }
            const m = {
                id: model.id,
                provider: providerId,
                name: model.name || "",
                group: model.group || "",
                types: model.types || ["text"],
                enabled: true,
                editable: model.editable !== false,
            };
            provider.data.models.unshift(m as any);
            await this.sync();
            return true;
        },
        async modelDelete(providerId: string, modelId: string) {
            const provider = this.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find(m => m.id === modelId);
            if (m) {
                provider.data.models.splice(provider.data.models.indexOf(m), 1);
            }
            await this.sync();
        },
        async modelEdit(providerId: string, model: Partial<Model>) {
            const provider = this.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find(m => m.id === model.id);
            if (m) {
                if ("name" in model) {
                    m.name = model.name || "";
                }
                if ("group" in model) {
                    m.group = model.group || "";
                }
                if ("types" in model) {
                    m.types = model.types || ["text"];
                }
                if ("enabled" in model) {
                    m.enabled = model.enabled as boolean;
                }
            }
            await this.sync();
        },
        async changeModel(providerId: string, modelId: string, key: "enabled", value: any) {
            const provider = this.providers.find(p => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find(m => m.id === modelId);
            if (m) {
                m[key] = value;
            }
            await this.sync();
        },
        sync: debounce(async () => {
            // 🔧 Guard: Check if $mapi is available before syncing
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过模型配置同步');
                return;
            }

            const providerData = {};
            model.providers.forEach(provider => {
                // 跳过内置提供商的完整配置，只保存模型启用状态
                if (isBuiltInProvider(provider.id)) {
                    // 对于内置提供商，只保存模型的启用状态，不保存API密钥和OSS配置
                    providerData[provider.id] = {
                        models: provider.data.models.map(m => ({
                            id: m.id,
                            name: m.name,
                            group: m.group,
                            types: m.types,
                            enabled: m.enabled,
                            editable: m.editable !== false,
                        })),
                        enabled: provider.data.enabled,
                    };
                } else {
                    // 非内置提供商，保存完整配置
                    providerData[provider.id] = ObjectUtil.clone(provider.data);
                    // 清空 buildIn 提供商的 API Key（保持原有逻辑）
                    if (provider.id === "buildIn") {
                        providerData[provider.id].apiKey = "";
                    }
                }
            });
            const userProviders = model.providers.filter(provider => !provider.isSystem);
            await window.$mapi.storage.write("models", ObjectUtil.clone({ providerData, userProviders }));
        }, 200),
    },
});

export const model = modelStore(store);

// 🔧 Defer initialization until $mapi is ready
// Don't call init() at module load time, let the app call it when ready
// This will be called from src/main.ts after MAPI.init()

export const useModelStore = () => {
    return model;
};
