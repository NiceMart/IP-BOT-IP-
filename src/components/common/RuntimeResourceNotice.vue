<script setup lang="ts">
import { onMounted, ref } from 'vue';
const missing = ref<string[]>([]);
const dismissed = ref(false);
const electron = () => (window as any).require?.('electron');
onMounted(async () => {
    try {
        const status = await electron()?.ipcRenderer?.invoke('startup:runtime-status');
        if (Array.isArray(status?.missing)) missing.value = status.missing;
    } catch (error) { console.warn('[startup] 无法读取运行资源状态', error); }
});
const openGuide = () => electron()?.shell?.openExternal('https://github.com/pyqdcyy123-byte/IP-BOT-IP-/blob/main/docs/INSTALL.md');
</script>

<template>
    <aside v-if="missing.length && !dismissed" class="runtime-resource-notice" role="status" aria-live="polite" aria-label="运行资源提示">
        <strong>界面已启动，媒体资源尚未准备完整</strong>
        <p>缺少：{{ missing.join('、') }}。补齐后可使用相应生成功能。</p>
        <div><button type="button" @click="openGuide">安装说明</button><button type="button" @click="dismissed = true">稍后配置</button></div>
    </aside>
</template>

<style scoped>
.runtime-resource-notice{position:fixed;right:20px;bottom:20px;z-index:10000;max-width:min(420px,calc(100vw - 40px));padding:16px;border:1px solid var(--theme-border,#d4dce8);border-left:4px solid #d99a25;border-radius:12px;background:var(--theme-panel-bg,#fff);color:var(--theme-text-primary,#1c2535);box-shadow:0 8px 28px #0002;font-size:14px;line-height:1.6}.runtime-resource-notice strong{display:block;font-size:15px}.runtime-resource-notice p{margin:6px 0 12px;overflow-wrap:anywhere}.runtime-resource-notice div{display:flex;gap:10px}.runtime-resource-notice button{min-height:36px;padding:6px 12px;border:1px solid var(--theme-border,#d4dce8);border-radius:7px;background:var(--theme-panel-bg-muted,#eef3fb);color:var(--theme-text-primary,#1c2535);cursor:pointer}.runtime-resource-notice button:focus-visible{outline:2px solid #2775dc;outline-offset:2px}
</style>
