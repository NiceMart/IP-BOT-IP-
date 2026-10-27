<script setup lang="ts">
// @ts-nocheck
import {onBeforeUnmount, onMounted, ref} from "vue";
import QRCode from "qrcode";
// 🔧 不直接导入 electron，在使用时通过 window.ipcRenderer 访问
import {Message} from "@arco-design/web-vue";
import {t} from "../lang";

interface Props {
  region?: string;
  showLoginStatus?: boolean;  // 如果为true，显示已登录界面
}

const props = withDefaults(defineProps<Props>(), {
  region: '07',
  showLoginStatus: false
});

const emit = defineEmits<{
  loginSuccess: [userInfo: any];
  loginError: [error: string];
  refresh: [];
}>();

const loginUrl = ref<string>("");
const qrcodeExpireTime = ref<number>(0);
const status = ref<"" | "WaitScan" | "Scanned" | "LoggedIn" | "Expired" | "Error">("");
const qrcodeExpireLeft = ref<number>(0);
const qrcodeUrl = ref<string>("");
const errorMessage = ref<string>("");

let countDownTimer = null as any;
let watchTimer = null as any;

onMounted(async () => {
    // 如果传入了showLoginStatus为true，则不自动刷新二维码
    if (!props.showLoginStatus) {
        await doRefreshQRLogin();
    } else {
        status.value = "LoggedIn";
    }

    // 启动倒计时
    countDownTimer = setInterval(() => {
        if (status.value !== "WaitScan") {
            return;
        }
        const left = Math.floor(qrcodeExpireTime.value - Date.now() / 1000);
        if (left <= 0) {
            clearInterval(countDownTimer);
            status.value = "Expired";
            errorMessage.value = "二维码已过期，请刷新重试";
            return;
        }
        if (left < 60) {
            qrcodeExpireLeft.value = left;
        }
    }, 1000);
});

onBeforeUnmount(() => {
    clearInterval(countDownTimer);
    clearTimeout(watchTimer);
});

const doRefreshQRLogin = async () => {
    try {
        status.value = "WaitScan";
        errorMessage.value = "";

        // 🔧 使用 window.ipcRenderer 代替直接导入
        if (typeof (window as any).ipcRenderer === 'undefined') {
            throw new Error('IPC接口不可用');
        }
        const ipcRenderer = (window as any).ipcRenderer;

        // 调用electron后端的智能体登录二维码生成
        const result = await ipcRenderer.invoke("AgentLogin.Event", "getQRCode", {
            region: props.region
        });

        if (!result || !result.loginUrl) {
            throw new Error("获取登录二维码失败：无效响应");
        }

        qrcodeExpireTime.value = (Date.now() + 1000 * result.expireSeconds) / 1000;
        qrcodeExpireLeft.value = 0;
        loginUrl.value = result.loginUrl;

        // 生成二维码
        qrcodeUrl.value = await QRCode.toDataURL(loginUrl.value, {
            width: 300,
            height: 300,
        });

        if (watchTimer) {
            clearTimeout(watchTimer);
        }
        doStartWatchLogin().then();
    } catch (error: any) {
        console.error('获取智能体登录二维码失败:', error);
        status.value = "Error";
        errorMessage.value = error.message || "获取登录二维码失败，请重试";
        emit('loginError', error.message || "获取登录二维码失败");
    }
};

// 检测登录状态
const isCheckingLogin = ref(false);

const doCheckLoginStatus = async () => {
    isCheckingLogin.value = true;
    try {
        // 🔧 使用 window.ipcRenderer 代替直接导入
        if (typeof (window as any).ipcRenderer === 'undefined') {
            throw new Error('IPC接口不可用');
        }
        const ipcRenderer = (window as any).ipcRenderer;

        const result = await ipcRenderer.invoke("AgentLogin.Event", "checkStatus", {
            region: props.region
        });

        if (result && result.status === "LoggedIn") {
            status.value = "LoggedIn";
            Message.success(t("已登录"));
            emit('loginSuccess', result.userInfo);
        } else if (result && result.status === "Scanned") {
            status.value = "Scanned";
            Message.info(t("已扫码，请在手机上确认登录"));
        } else {
            status.value = "WaitScan";
            Message.warning(t("未登录，请扫码登录"));
            await doRefreshQRLogin();
        }
    } catch (error: any) {
        console.error("检测登录状态失败:", error);
        Message.error(t("检测登录状态失败"));
    } finally {
        isCheckingLogin.value = false;
    }
};

const doStartWatchLogin = async () => {
    try {
        // 🔧 使用 window.ipcRenderer 代替直接导入
        if (typeof (window as any).ipcRenderer === 'undefined') {
            throw new Error('IPC接口不可用');
        }
        const ipcRenderer = (window as any).ipcRenderer;

        const result = await ipcRenderer.invoke("AgentLogin.Event", "checkStatus", {
            region: props.region
        });

        if (!result) {
            throw new Error("检查登录状态失败：无效响应");
        }

        status.value = result.status;

        switch (result.status) {
            case "Scanned":
                // 已扫码，等待确认
                break;
            case "WaitScan":
                // 继续等待扫码
                watchTimer = setTimeout(() => {
                    doStartWatchLogin().then();
                }, 3000);
                break;
            case "LoggedIn":
                // 登录成功
                console.log('智能体扫码登录成功');
                emit('loginSuccess', result.userInfo);
                break;
            case "Expired":
                // 二维码过期
                errorMessage.value = "二维码已过期，请刷新重试";
                break;
            case "Error":
                // 登录失败
                errorMessage.value = result.message || "登录失败";
                emit('loginError', result.message || "登录失败");
                break;
        }
    } catch (error: any) {
        console.error('检查智能体登录状态失败:', error);
        status.value = "Error";
        errorMessage.value = error.message || "检查登录状态失败";
        emit('loginError', error.message || "检查登录状态失败");
    }
};
</script>

<template>
    <div class="agent-login-qr-container">
        <div class="text-center">
            <!-- 已登录状态显示 -->
            <template v-if="props.showLoginStatus && status === 'LoggedIn'">
                <div class="mb-4">
                    <h3 class="text-lg font-bold">智能体{{ props.region }}区域</h3>
                    <p class="text-sm text-gray-600">登录状态</p>
                </div>

                <div
                    class="qr-code-container mx-auto rounded-lg shadow-lg overflow-hidden border border-solid border-green-200 relative bg-green-50"
                    style="width: 320px; height: 320px;"
                >
                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                        <svg class="w-16 h-16 text-green-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        <div class="text-2xl font-bold text-green-600 mb-2">{{ t("已登录") }}</div>
                        <div class="text-sm text-gray-600">{{ t("账号登录成功") }}</div>
                    </div>
                </div>

                <!-- 状态提示 -->
                <div class="mt-4 h-16 flex items-center justify-center">
                    <div class="text-green-500 flex items-center justify-center">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        {{ t("登录成功！") }}
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="mt-4 flex gap-2 justify-center">
                    <a-button
                        type="primary"
                        @click="doCheckLoginStatus"
                        :loading="isCheckingLogin"
                        class="px-6 py-2"
                    >
                        {{ isCheckingLogin ? t("检测中...") : t("检测登录状态") }}
                    </a-button>
                    <a-button
                        status="secondary"
                        @click="doRefreshQRLogin"
                        class="px-6 py-2"
                    >
                        {{ t("重新扫码") }}
                    </a-button>
                </div>
            </template>

            <!-- 二维码登录状态显示 -->
            <template v-else>
                <div class="mb-4">
                    <h3 class="text-lg font-bold">智能体{{ props.region }}区域登录</h3>
                    <p class="text-sm text-gray-600">请使用微信或支付宝扫描二维码登录</p>
                </div>

                <div
                    class="qr-code-container mx-auto rounded-lg shadow-lg overflow-hidden border border-solid border-gray-200 relative"
                    style="width: 320px; height: 320px;"
                >
                    <!-- 二维码显示 -->
                    <img
                        v-if="qrcodeUrl && status !== 'Expired' && status !== 'Error'"
                        class="w-full h-full rounded"
                        :src="qrcodeUrl"
                        alt="登录二维码"
                    />

                <!-- 过期状态 -->
                <div v-if="status === 'Expired'" class="absolute inset-0 bg-gray-900 bg-opacity-50 flex flex-col items-center justify-center rounded">
                    <div class="text-white mb-3">
                        <svg class="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>二维码已过期</div>
                    </div>
                    <button
                        @click="doRefreshQRLogin"
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        刷新二维码
                    </button>
                </div>

                <!-- 错误状态 -->
                <div v-if="status === 'Error'" class="absolute inset-0 bg-red-900 bg-opacity-50 flex flex-col items-center justify-center rounded">
                    <div class="text-white mb-3">
                        <svg class="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>获取二维码失败</div>
                    </div>
                    <button
                        @click="doRefreshQRLogin"
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                        重试
                    </button>
                </div>

                <!-- 加载状态 -->
                <div v-if="!qrcodeUrl && status === 'WaitScan'" class="absolute inset-0 flex items-center justify-center">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <div class="text-sm text-gray-600">生成二维码中...</div>
                    </div>
                </div>
            </div>

            <!-- 状态提示 -->
            <div class="mt-4 h-16 flex items-center justify-center">
                <div v-if="status" class="text-center">
                    <div v-if="status === 'WaitScan' && qrcodeExpireLeft" class="text-orange-500 flex items-center justify-center">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                        </svg>
                        {{ qrcodeExpireLeft }}秒内请完成扫码
                    </div>
                    <div v-else-if="status === 'Scanned'" class="text-blue-500 flex items-center justify-center">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        已扫码，请在手机上确认登录
                    </div>
                    <div v-else-if="status === 'LoggedIn'" class="text-green-500 flex items-center justify-center">
                        <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        登录成功！
                    </div>
                    <div v-else-if="status === 'Expired'" class="text-red-500">
                        {{ errorMessage || '二维码已过期' }}
                    </div>
                    <div v-else-if="status === 'Error'" class="text-red-500">
                        {{ errorMessage || '登录失败' }}
                    </div>
                </div>
            </div>

                <!-- 操作按钮 -->
                <div class="mt-4 flex gap-2 justify-center">
                    <button
                        v-if="status === 'WaitScan' || status === 'Scanned'"
                        @click="doRefreshQRLogin"
                        class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    >
                        刷新二维码
                    </button>
                    <a-button
                        type="outline"
                        @click="doCheckLoginStatus"
                        :loading="isCheckingLogin"
                        :disabled="status !== 'WaitScan' && status !== 'Scanned'"
                    >
                        {{ isCheckingLogin ? t("检测中...") : t("检测登录状态") }}
                    </a-button>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.qr-code-container {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.animate-spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
</style>
