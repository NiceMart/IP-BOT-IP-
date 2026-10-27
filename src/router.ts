import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";
import authService from "./service/auth";
import { useAuthStore } from "./store/modules/auth";

// 公开路由（不需要认证）
const publicRoutes = ['/login', '/register', '/subscription-expired'];

const routes: RouteRecordRaw[] = [
    // 认证相关路由
    {
        path: "/login",
        component: () => import("./pages/Auth/Login.vue"),
        meta: { requiresAuth: false }
    },
    {
        path: "/register",
        component: () => import("./pages/Auth/Register.vue"),
        meta: { requiresAuth: false }
    },
    {
        path: "/subscription-expired",
        component: () => import("./pages/SubscriptionExpired.vue"),
        meta: { requiresAuth: false }
    },
    // 主应用路由
    {
        path: "/",
        component: () => import("./layouts/Main.vue"),
        meta: { requiresAuth: true },
        children: [
            { path: "", redirect: "/video?tab=ipAgent" },
            { path: "home", component: () => import("./pages/Home.vue") },
            { path: "server", component: () => import("./pages/Server.vue") },
            { path: "video", component: () => import("./pages/Video.vue") },
            { path: "video-subtitle", component: () => import("./pages/Video/VideoSubtitle.vue") },
            { path: "video-audio-extract", component: () => import("./pages/Video/VideoAudioExtract.vue") },
            { path: "video-publish", component: () => import("./pages/Video/VideoPublish.vue") },
            { path: "font-manager", component: () => import("./pages/Video/FontManager.vue") },
            { path: "image", component: () => import("./pages/Image.vue") },
            { path: "sound", component: () => import("./pages/Sound.vue") },
            { path: "tool", component: () => import("./pages/Tool.vue") },
            { path: "live", component: () => import("./pages/Live.vue") },
            { path: "changelog", component: () => import("./pages/Changelog/Changelog.vue") },
            { path: "setting", component: () => import("./pages/Setting.vue") },
            { path: "design", component: () => import("./pages/Design/Workbench.vue") },
        ],
    },
    // 其他原有路由
    {
        path: "/",
        component: () => import("./layouts/Raw.vue"),
        children: [],
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

// 路由守卫 - 认证和订阅检查
router.beforeEach(async to => {
    if (publicRoutes.includes(to.path)) {
        return true;
    }

    if (!to.meta.requiresAuth) {
        return true;
    }

    const authStore = useAuthStore();
    const token = authService.getToken();

    if (!token) {
        console.log('❌ 未登录，跳转到登录页');
        return '/login';
    }

    const authState = await authStore.refreshAuthState();

    if (authState.status === 'pending') {
        console.warn('⚠️ Electron API 尚未就绪，暂不重定向登录页');
        return true;
    }

    if (authState.status === 'kicked') {
        console.log('⚠️ 账号已在其他设备登录，被踢出');
        // 用 setTimeout 确保 alert 不阻塞路由
        setTimeout(() => {
            alert((authState as any).message || '您的账号已在其他设备登录，当前会话已失效');
        }, 100);
        return '/login';
    }

    if (authState.status === 'unauthenticated') {
        console.log('❌ 登录状态失效，跳转到登录页');
        // 检查是否是被禁用
        const verifyResult = (authState as any).verifyResult;
        if (verifyResult?.disabled) {
            setTimeout(() => {
                alert(verifyResult.message || '您的账号已被管理员禁用');
            }, 100);
        }
        return '/login';
    }

    if (authState.status === 'expired') {
        console.log('❌ 订阅已过期，跳转到过期页');
        return '/subscription-expired';
    }


    return true;
});

export default router;
