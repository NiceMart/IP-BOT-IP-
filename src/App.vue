<template>
    <a-config-provider :locale="locale" :global="true">
        <router-view></router-view>
        <ResourcePreparingDialog />
    </a-config-provider>
</template>

<script setup lang="ts">
import {onMounted, onUnmounted, ref, onErrorCaptured} from "vue";
import {onLocaleChange} from "./lang";
import {useRouter} from "vue-router";

import zhCN from "@arco-design/web-vue/es/locale/lang/zh-cn";
import enUS from "@arco-design/web-vue/es/locale/lang/en-us";
import {doCheckForUpdate} from "./components/common/util";
import ResourcePreparingDialog from "./components/common/ResourcePreparingDialog.vue";

const locales = {
    "zh-CN": zhCN,
    "en-US": enUS,
};

const locale = ref(zhCN);
onLocaleChange(newLocale => {
    locale.value = locales[newLocale];
});

// 捕获所有 Vue 组件错误
onErrorCaptured((err, instance, info) => {
    console.error('❌ Vue 组件错误:', err);
    console.error('组件:', instance);
    console.error('错误信息:', info);

    // 如果是 $mapi 相关错误，给出友好提示
    if (err.message && err.message.includes('$mapi')) {
        console.error('💡 提示: $mapi 可能尚未初始化，请检查 preload 脚本');
    }

    // 返回 false 继续传播错误，返回 true 阻止传播
    return false;
});

// 🔥 心跳检测：定时验证 token，检测被踢出/被禁用/token失效
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const router = useRouter();

const startHeartbeat = () => {
    // 每 60 秒检测一次
    heartbeatTimer = setInterval(async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return; // 未登录，不检测

            // 直接调用后端验证
            if (!window['$mapi']?.auth?.verifyToken) return;

            const result = await window['$mapi'].auth.verifyToken(token);
            if (result && !result.valid) {
                let alertMsg = '登录状态已失效，请重新登录';

                if (result.kicked) {
                    alertMsg = result.message || '您的账号已在其他设备登录，当前会话已失效';
                } else if (result.disabled) {
                    alertMsg = result.message || '您的账号已被管理员禁用';
                }

                console.warn('⚠️ 心跳检测：', alertMsg);

                // 清除本地登录状态
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_subscription');

                // 停止心跳
                if (heartbeatTimer) {
                    clearInterval(heartbeatTimer);
                    heartbeatTimer = null;
                }

                // 弹窗提示
                alert(alertMsg);

                // 跳转登录页
                router.push('/login');
            }
        } catch (e) {
            // 网络错误等，静默忽略
        }
    }, 60000); // 60 秒
};

onMounted(() => {
    // 启动心跳检测
    startHeartbeat();

    setTimeout(async () => {
        if (!window.$mapi) {
            return;
        }
        try {
            const checkAtLaunch = await window.$mapi.config.get("updaterCheckAtLaunch", "yes");
            if ("yes" !== checkAtLaunch) {
                return;
            }
            doCheckForUpdate().then();
        } catch (error) {
            console.error('检查更新失败:', error);
        }
    }, 6000);
});

onUnmounted(() => {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
});

</script>
