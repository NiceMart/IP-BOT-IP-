<script setup lang="ts">
import {useServerStore} from "../../store/modules/server";
import {useAuthStore} from "../../store/modules/auth";
import {EnumServerStatus, ServerRecord} from "../../types/Server";
import {computed, onMounted, ref, watch} from "vue";
import {Dialog} from "../../lib/dialog";
import {mapError} from "../../lib/error";
import { clearConfigCache, fetchSystemConfig } from "../../service/systemConfig";
import { useModelStore } from "../../module/Model/store/model";

const serverStore = useServerStore();
const authStore = useAuthStore();
const modelStore = useModelStore();

const select = ref<any>(null);
const props = defineProps<{
    functionName: string;
    modelValue?: string;
    showCloud?: boolean;
    showSelfServer?: boolean;
}>();
const emit = defineEmits({
    update: (config: any) => true,
    'update:modelValue': (value: string) => true,
});

const matchesFunctionName = (functions: string[] = [], functionName: string) => {
    const normalizedFunctions = functions.map(f => (f === 'speechRecognition' ? 'asr' : f));
    const normalizedFunctionName = functionName === 'speechRecognition' ? 'asr' : functionName;
    return normalizedFunctions.includes(normalizedFunctionName);
};

const normalizeServerConfig = (config: any) => {
    if (!config?.functions) {
        return config;
    }
    const functions = {
        ...config.functions,
    };
    if (functions.speechRecognition && !functions.asr) {
        functions.asr = functions.speechRecognition;
    }
    return {
        ...config,
        functions,
    };
};

const recordsFilter = computed(() => {
    return serverStore.records.filter(s => matchesFunctionName(s.functions, props.functionName));
});

const cloudDisabled = computed(() => {
    return !!authStore.user?.cloud_digital_human_disabled;
});

const cloudBeautyEnabled = ref(false);

// 服务端推送的数字人模型列表（排除与硬编码云端模型重复的项）
const serverPushDigitalModels = computed(() => {
    const models: { value: string; label: string; providerApiKey?: string; providerApiHost?: string }[] = []
    // 硬编码的云端模型ID，需要排除
    const hardcodedModelIds = ['cloud_digital_human', 'cloud_digital_human_plus', 'cloud_digital_human_3', 'cloud_digital_human_4', 'cloud_digital_human_5', 'cloud_digital_human_6']
    for (const p of modelStore.providers) {
        if (!p.data.enabled || !p.isServerPush) continue
        for (const m of p.data.models) {
            if (!m.enabled) continue
            if (m.types?.includes('digital-human') && !hardcodedModelIds.includes(m.id)) {
                models.push({
                    value: `__SERVER_DH_${p.id}_${m.id}__`,
                    label: m.name || m.id,
                    providerApiKey: p.data.apiKey,
                    providerApiHost: p.data.apiHost,
                })
            }
        }
    }
    return models
})

onMounted(async () => {
    try {
        clearConfigCache();
        const config = await fetchSystemConfig();
        console.log('[ServerSelector] cloud_beauty_enabled:', config.cloud_beauty_enabled);
        cloudBeautyEnabled.value = config.cloud_beauty_enabled === 'true';
    } catch (e) {
        console.warn('[ServerSelector] 获取配置失败:', e);
    }
});

const showCloudGroup = computed(() => {
    return props.showCloud !== false && !cloudDisabled.value;
});
const showSelfServerGroup = computed(() => {
    return props.showSelfServer && !cloudDisabled.value;
});
const valueAutoStart = computed(() => {
    const server = serverStore.records.find(s => s.key === props.modelValue);
    return server?.autoStart;
});
const valueAutoStartStatus = computed(() => {
    const server = serverStore.records.find(s => s.key === props.modelValue);
    return server?.runtime.autoStartStatus || EnumServerStatus.STOPPED;
});
const valueStatus = computed(() => {
    return serverStore.records.find(s => s.key === props.modelValue)?.status || EnumServerStatus.STOPPED;
});

watch(
    () => cloudDisabled.value,
    disabled => {
        if (disabled && (props.modelValue?.startsWith('__CLOUD') || props.modelValue === '__SELF_SERVER__')) {
            const firstLocal = recordsFilter.value[0];
            emit('update:modelValue', firstLocal ? firstLocal.key : '');
        }
    }
);

watch(
    () => cloudBeautyEnabled.value,
    (enabled, oldEnabled) => {
        if (!enabled && oldEnabled === true && props.modelValue === '__CLOUD_BEAUTY__') {
            const firstLocal = recordsFilter.value[0];
            emit('update:modelValue', firstLocal ? firstLocal.key : '');
        }
    }
);

watch(
    () => props.modelValue,
    async value => {
        if (!value) {
            return;
        }

        // 云端模式：跳过服务器配置获取
        if (value?.startsWith('__CLOUD') || value?.startsWith('__SERVER_DH_')) {
            const isServerPush = value?.startsWith('__SERVER_DH_')
            emit("update", {
                isCloud: true,
                isServerPush,
                functions: {}
            });
            return;
        }

        // 自主算力机模式
        if (value === '__SELF_SERVER__') {
            emit("update", {
                isSelfServer: true,
                functions: {}
            });
            return;
        }

        let config: any = null;
        if (!config) {
            const server = await serverStore.getByKey(value);
            if (server) {
                const res = await window.$mapi.server.config(await serverStore.serverInfo(server));
                if (res.code) {
                    Dialog.tipError(mapError(res.msg));
                    return;
                }
                config = normalizeServerConfig(res.data);
            }
        }
        if (!config) {
            return;
        }
        emit("update", config);
    }
);
</script>

<template>
    <a-select
        ref="select"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :placeholder="$t('选择模型')"
        size="small"
        class="min-w-64 server-selector-select"
        style="height:32px;"
        :getPopupContainer="(node) => node.parentNode"
    >
        <a-optgroup v-if="showCloudGroup" :label="$t('云端模型')">
            <a-option v-if="cloudBeautyEnabled" value="__CLOUD_BEAUTY__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-pink-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        极速模型
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点01
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_1942022968606355458__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点02
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_3__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点03
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_4__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点04
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_5__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点05
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_6__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点06
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_7__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点07
                    </div>
                </div>
            </a-option>
            <a-option value="__CLOUD_MODEL_8__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-purple-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        网络节点08
                    </div>
                </div>
            </a-option>
            <!-- 服务端推送的数字人模型 -->
            <a-option v-for="dm in serverPushDigitalModels" :key="dm.value" :value="dm.value">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-amber-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        {{ dm.label }} ☁️
                    </div>
                </div>
            </a-option>
        </a-optgroup>
        <a-optgroup :label="$t('本地模型')">
            <a-option v-for="server in recordsFilter" :key="server.key" :value="server.key">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div
                        v-if="server.autoStart&&server.runtime.autoStartStatus === EnumServerStatus.RUNNING"
                        class="w-2 h-2 bg-green-500 rounded-full mr-1 flex-shrink-0"
                    ></div>
                    <div
                        v-else-if="server.autoStart&&server.runtime.autoStartStatus !== EnumServerStatus.RUNNING"
                        class="w-2 h-2 bg-blue-500 rounded-full mr-1 flex-shrink-0"
                    ></div>
                    <div
                        v-else-if="server.status === EnumServerStatus.RUNNING"
                        class="w-2 h-2 bg-blue-500 rounded-full mr-1 flex-shrink-0 animate-pulse"
                    ></div>
                    <div v-else class="w-2 h-2 bg-red-700 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        {{ server.title }}
                        v{{ server.version }}
                    </div>
                </div>
            </a-option>
            <a-option v-if="recordsFilter.length === 0" disabled>
                <div class="text-xs py-2">
                    {{ $t("没有可用本地模型") }}
                </div>
            </a-option>
        </a-optgroup>
        <a-optgroup v-if="showSelfServerGroup" :label="$t('自主算力')">
            <a-option value="__SELF_SERVER__">
                <div class="flex items-center py-2 flex-nowrap truncate no-wrap">
                    <div class="w-2 h-2 bg-orange-500 rounded-full mr-1 flex-shrink-0"></div>
                    <div class="text-xs flex-grow">
                        自主算力机
                    </div>
                </div>
            </a-option>
        </a-optgroup>
        <template #label="{data}">
            <div class="text-sm flex items-center flex-nowrap truncate no-wrap">
                <div
                    v-if="modelValue?.startsWith('__CLOUD')"
                    class="w-2 h-2 bg-purple-700 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else-if="modelValue?.startsWith('__SERVER_DH_')"
                    class="w-2 h-2 bg-amber-500 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else-if="modelValue === '__SELF_SERVER__'"
                    class="w-2 h-2 bg-orange-500 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else-if="valueStatus === EnumServerStatus.RUNNING"
                    class="w-2 h-2 bg-green-700 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div v-else class="w-2 h-2 bg-red-700 rounded-full mr-1 flex-shrink-0"></div>

                <!-- 根据 modelValue 直接判断显示什么，不依赖 data.label -->
                <div v-if="modelValue === '__CLOUD__'" class="flex-grow">
                    网络节点01
                </div>
                <div v-else-if="modelValue === '__CLOUD_1942022968606355458__'" class="flex-grow">
                    网络节点02
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_3__'" class="flex-grow">
                    网络节点03
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_4__'" class="flex-grow">
                    网络节点04
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_5__'" class="flex-grow">
                    网络节点05
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_6__'" class="flex-grow">
                    网络节点06
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_7__'" class="flex-grow">
                    网络节点07
                </div>
                <div v-else-if="modelValue === '__CLOUD_MODEL_8__'" class="flex-grow">
                    网络节点08
                </div>
                <div v-else-if="modelValue === '__CLOUD_BEAUTY__'" class="flex-grow">
                    极速模型
                </div>
                <div v-else-if="modelValue?.startsWith('__SERVER_DH_')" class="flex-grow">
                    {{ serverPushDigitalModels.find(m => m.value === modelValue)?.label || '云端推送模型' }} ☁️
                </div>
                <div v-else-if="modelValue === '__SELF_SERVER__'" class="flex-grow">
                    自主算力机
                </div>
                <div v-else>
                    <div v-if="recordsFilter.length > 0">
                        {{
                            serverStore.records.find(s => s.key === modelValue)?.title
                            ? `${serverStore.records.find(s => s.key === modelValue)?.title} v${serverStore.records.find(s => s.key === modelValue)?.version}`
                            : '选择模型'
                        }}
                    </div>
                    <div v-else>
                        {{ $t("没有可用模型") }}
                    </div>
                </div>
            </div>
        </template>
    </a-select>
</template>

<style scoped>
/* 输入框样式 - 深色主题 */
::deep(.arco-select-view-single) {
    background-color: #1e293b !important;
    border-color: #334155 !important;
    color: #e2e8f0 !important;
    border-radius: 6px;
}

::deep(.arco-select-view-single:hover) {
    border-color: #60a5fa !important;
}

::deep(.arco-select-view-single.arco-select-view-focus) {
    border-color: #60a5fa !important;
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.25) !important;
}

/* 下拉弹出层 */
::deep(.arco-select-dropdown) {
    background: #1e293b !important;
    border: 1px solid #334155 !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6) !important;
    padding: 4px;
    border-radius: 8px;
}

/* 分组标签 */
::deep(.arco-optgroup-label) {
    color: #94a3b8 !important;
    background: transparent !important;
    font-size: 12px;
    padding: 6px 12px 4px;
    font-weight: 500;
}

/* 选项基础样式 - 未选中 */
::deep(.arco-select-option) {
    color: #e2e8f0 !important;
    background-color: transparent !important;
    border-radius: 4px;
    margin: 1px 0;
    transition: all 0.15s ease;
}

/* hover 状态 - 浅灰色背景 深色文字 */
::deep(.arco-select-option:hover),
::deep(.arco-select-option-active) {
    background: #334155 !important;
    color: #e2e8f0 !important;
}

/* 选中状态 - 蓝色背景 白色文字 */
::deep(.arco-select-option-selected) {
    background: #2563eb !important;
    color: #ffffff !important;
    font-weight: 500;
}

/* 选中 + hover */
::deep(.arco-select-option-selected:hover) {
    background: #1d4ed8 !important;
    color: #ffffff !important;
}

/* 禁用状态 */
::deep(.arco-select-option-disabled) {
    color: #64748b !important;
    background: transparent !important;
    cursor: not-allowed;
}

/* 去掉 Arco 默认的异常高亮 */
::deep(.arco-select-option)::before,
::deep(.arco-select-option)::after {
    display: none !important;
}
</style>
