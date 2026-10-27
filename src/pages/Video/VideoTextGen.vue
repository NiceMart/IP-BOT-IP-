<script setup lang="ts">
import {ref, computed, watch} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {useServerStore} from "../../store/modules/server";
import {usePaginate} from "../../hooks/paginate";
import {useTaskChangeRefresh} from "../../hooks/task";

const serverStore = useServerStore();
const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const inputText = ref("");
const outputText = ref("");
const isGenerating = ref(false);
const selectedTemplate = ref("default");
const customInstructions = ref("");

// Template options for text generation
const textTemplates = [
    { value: "default", label: "通用优化", description: "优化语言表达，提高可读性" },
    { value: "social", label: "社交媒体", description: "适合社交媒体平台的文案风格" },
    { value: "short", label: "简洁版", description: "精简内容，突出重点" },
    { value: "detailed", label: "详细版", description: "扩充内容，增加细节" },
    { value: "title", label: "标题生成", description: "为内容生成吸引人的标题" }
];

// Fetch previous text generation results
useTaskChangeRefresh("TextGen", () => {
    setTimeout(doRefresh, 1000);
});

const doRefresh = async () => {
    // Load previous text generation tasks
    const textGenRecords = await TaskService.list("TextGen");
    records.value = textGenRecords;
};

// Generate improved text based on input
const generateText = async () => {
    if (!inputText.value.trim()) {
        Dialog.tipError(t("请输入要优化的文本"));
        return;
    }

    isGenerating.value = true;
    outputText.value = "";

    try {
        // Get a server for text generation
        const serverInfo = await serverStore.getFirstServerByKey("LLM");
        if (!serverInfo) {
            Dialog.tipError(t("未找到可用的文本生成服务器"));
            return;
        }

        // Prepare the prompt based on template
        let prompt = "";
        switch (selectedTemplate.value) {
            case "social":
                prompt = `请将以下内容改写为适合社交媒体平台的文案，要求语言简洁、吸引人，并加入适当的表情符号：\n\n${inputText.value}`;
                break;
            case "short":
                prompt = `请将以下内容精简，保留核心信息，使表达更加简洁有力：\n\n${inputText.value}`;
                break;
            case "detailed":
                prompt = `请扩展以下内容，增加细节和背景信息，使其更加丰富完整：\n\n${inputText.value}`;
                break;
            case "title":
                prompt = `请基于以下内容生成5个吸引人的标题：\n\n${inputText.value}`;
                break;
            default: // "default"
                prompt = `请优化以下文本，使其表达更清晰、语言更流畅：\n\n${inputText.value}`;
        }

        // Add custom instructions if provided
        if (customInstructions.value.trim()) {
            prompt += `\n\n额外要求：${customInstructions.value}`;
        }

        // Call the LLM service
        const res = await serverStore.call(serverInfo, "textGen", {
            prompt: prompt,
            temperature: 0.7,
            maxTokens: 1000
        });

        if (res.code) {
            throw res.msg || "Text generation failed";
        }

        outputText.value = res.data.text;

        // Save the generation task for history
        const taskTitle = t("AI文案生成") + " - " + new Date().toLocaleString();
        const record: TaskRecord = {
            biz: "TextGen",
            title: taskTitle,
            serverName: serverInfo.server.name,
            serverTitle: serverInfo.server.title,
            serverVersion: serverInfo.server.version,
            modelConfig: {
                type: "TextGen",
                serverKey: serverInfo.server.key,
                param: {
                    template: selectedTemplate.value,
                    customInstructions: customInstructions.value
                },
                inputText: inputText.value,
                outputText: outputText.value
            },
            param: {},
        };

        await TaskService.submit(record);
        Dialog.tipSuccess(t("文案生成完成"));
    } catch (error: any) {
        Dialog.tipError(error.message || t("文案生成失败"));
    } finally {
        isGenerating.value = false;
    }
};

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        Dialog.tipSuccess(t("已复制到剪贴板"));
    }).catch(() => {
        Dialog.tipError(t("复制失败"));
    });
};

const loadResult = (record: TaskRecord) => {
    inputText.value = record.modelConfig.inputText;
    outputText.value = record.modelConfig.outputText;
    selectedTemplate.value = record.modelConfig.param.template || "default";
    customInstructions.value = record.modelConfig.param.customInstructions || "";
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ t("AI文案生成") }}</div>
                <div class="text-gray-400 ml-3">{{ t("基于提取的文本内容，智能生成优化文案") }}</div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Input Section -->
            <div class="rounded-xl shadow border p-4">
                <div class="mb-4">
                    <h3 class="text-lg font-semibold mb-2">{{ t("输入内容") }}</h3>
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ t("文本模板") }}</label>
                        <a-select v-model="selectedTemplate" class="w-full">
                            <a-option v-for="template in textTemplates" :key="template.value" :value="template.value">
                                <div>
                                    <div class="font-medium">{{ template.label }}</div>
                                    <div class="text-xs text-gray-500">{{ template.description }}</div>
                                </div>
                            </a-option>
                        </a-select>
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ t("自定义指令") }}</label>
                        <a-input
                            v-model="customInstructions"
                            :placeholder="t('例如：使语言更加生动有趣')"
                            class="w-full"
                        />
                    </div>
                    <a-textarea
                        v-model="inputText"
                        :placeholder="t('请输入要优化的文本内容')"
                        :auto-size="{ minRows: 6, maxRows: 10 }"
                        class="w-full"
                    />
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-sm text-gray-500">{{ inputText.length }} {{ t("字") }}</span>
                        <a-button
                            type="primary"
                            :loading="isGenerating"
                            @click="generateText"
                            :disabled="!inputText.trim()"
                        >
                            {{ t("生成优化文案") }}
                        </a-button>
                    </div>
                </div>
            </div>

            <!-- Output Section -->
            <div class="rounded-xl shadow border p-4">
                <div class="mb-4">
                    <h3 class="text-lg font-semibold mb-2">{{ t("优化结果") }}</h3>
                    <div v-if="isGenerating" class="flex items-center justify-center h-64">
                        <a-spin size="large" />
                        <span class="ml-3">{{ t("正在生成，请稍候...") }}</span>
                    </div>
                    <div v-else>
                        <a-textarea
                            v-model="outputText"
                            :placeholder="t('优化后的文案将显示在这里')"
                            :auto-size="{ minRows: 6, maxRows: 10 }"
                            class="w-full"
                        />
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-sm text-gray-500">{{ outputText.length }} {{ t("字") }}</span>
                            <a-button
                                v-if="outputText"
                                @click="copyToClipboard(outputText)"
                                type="outline"
                            >
                                <template #icon>
                                    <icon-copy />
                                </template>
                                {{ t("复制") }}
                            </a-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- History Section -->
        <div v-if="records.length > 0" class="mt-6 rounded-xl shadow border p-4">
            <h3 class="text-lg font-semibold mb-4">{{ t("历史记录") }}</h3>
            <div class="space-y-3">
                <div
                    v-for="record in recordsForPage"
                    :key="record.id"
                    class="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    @click="loadResult(record)"
                >
                    <div class="flex justify-between items-start">
                        <div class="flex-grow">
                            <div class="font-medium">{{ record.title }}</div>
                            <div class="text-sm text-gray-500 mt-1">
                                <span>{{ t("模板") }}: {{ textTemplates.find(t => t.value === record.modelConfig.param.template)?.label || record.modelConfig.param.template }}</span>
                            </div>
                        </div>
                        <div class="text-sm text-gray-400">
                            <timeago :datetime="record['createdAt'] * 1000" />
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex justify-center mt-4">
                <a-pagination
                    v-model:current="page"
                    :total="records.length"
                    :page-size="10"
                    show-total
                />
            </div>
        </div>
    </div>
</template>