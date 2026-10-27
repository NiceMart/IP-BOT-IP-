<script setup lang="ts">
import { onMounted, ref } from "vue";
import HtmlViewer from "../../../components/common/HtmlViewer.vue";
import { MarkdownUtil } from "../../../lib/markdown";

const changelogHtml = ref<string>("");
const loading = ref(true);

onMounted(async () => {
    try {
        // 读取 changelog.md 文件
        const changelogPath = await window.$mapi.file.resolvePath("changelog.md", { isAppPath: true });
        const content = await window.$mapi.file.readText(changelogPath, { encoding: "utf-8" });
        changelogHtml.value = MarkdownUtil.toHtml(content);
    } catch (error) {
        console.error("读取更新日志失败:", error);
        changelogHtml.value = "<p>无法加载更新日志</p>";
    } finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="p-5">
        <div class="app-header mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ "更新日志" }}</div>
                <div class="text-gray-400 ml-3">{{ "查看软件版本更新记录" }}</div>
            </div>
        </div>
        <div v-if="loading" class="text-center py-20">
            <div class="text-gray-400">{{ "加载中..." }}</div>
        </div>
        <div v-else class="bg-white rounded-lg p-6 overflow-y-auto" style="max-height: calc(100vh - 150px);">
            <HtmlViewer :value="changelogHtml" />
        </div>
    </div>
</template>

<style lang="less" scoped>
:deep(.pb-html-viewer) {
    h1, h2, h3, h4, h5, h6 {
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: bold;
    }
    
    h2 {
        font-size: 1.5em;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 0.3em;
    }
    
    ul, ol {
        margin: 0.5em 0;
        padding-left: 2em;
    }
    
    li {
        margin: 0.25em 0;
    }
    
    p {
        margin: 0.5em 0;
    }
}
</style>








