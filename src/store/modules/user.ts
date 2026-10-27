import {defineStore} from "pinia";
import store from "../index";
import {AppConfig} from "../../config";
import {useSettingStore} from "./setting";
import { isElectronEnv } from "../../lib/electronEnv";

const setting = useSettingStore();

export const userStore = defineStore("user", {
    state() {
        return {
            isInit: false,
            lastSavedJson: "",
            apiToken: null as string | null,
            user: {
                id: null as string | null,
                name: null as string | null,
                avatar: null as string | null,
            },
            data: {
                vip: {},
                functions: {},
            } as {
                vip: {
                    [key: string]: any;
                };
                functions: {
                    [key: string]: any;
                };
                [key: string]: any;
            },
            basic: {} as {
                [key: string]: any;
            },
        };
    },
    actions: {
        async init() {
            await this.load();
        },
        async load() {
            // 在网页环境中，跳过 Electron API 调用
            if (!isElectronEnv()) {
                console.log('[user.ts] 网页环境，跳过用户数据加载');
                this.isInit = true;
                return;
            }

            // 检查 $mapi 是否可用
            if (!window.$mapi) {
                console.warn('⚠️ $mapi 尚未初始化，跳过用户数据加载');
                return;
            }

            try {
                const {apiToken, user, data, basic} = await window.$mapi.user.get();
                this.apiToken = apiToken;
                this.user = Object.assign(this.user, user);
                this.data = data as any;
                this.basic = basic;
                await setting.initBasic(this.basic);
                this.isInit = true;
            } catch (error) {
                console.error('❌ 加载用户数据失败:', error);
            }
        },
        onChangeBroadcast() {
            this.load().then();
        },
        async waitInit() {
            if (this.isInit) {
                return;
            }
            await new Promise(resolve => {
                const timer = setInterval(() => {
                    if (this.isInit) {
                        clearInterval(timer);
                        resolve(undefined);
                    }
                }, 100);
            });
        },
        async webUrl() {
            await this.waitInit();
            let param: string[] = [];
            if (this.apiToken) {
                param.push(`api_token=${this.apiToken}`);
            }
            if (setting.shouldDarkMode()) {
                param.push("is_dark=1");
            }
            return `${AppConfig.apiBaseUrl}/app_manager/user_web?${param.join("&")}`;
        },
    },
});

export const user = userStore(store);

user.init().then();

// 仅在 Electron 环境中注册事件监听
if (isElectronEnv() && window.__page) {
    window.__page.onBroadcast("UserChange", user.onChangeBroadcast);
} else if (!isElectronEnv()) {
    console.log('[user.ts] 网页环境，跳过广播监听注册');
} else {
    console.warn('⚠️ window.__page 尚未初始化，跳过广播监听注册');
}

export const useUserStore = () => {
    return user;
};
