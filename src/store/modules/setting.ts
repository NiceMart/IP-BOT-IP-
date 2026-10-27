import { defineStore } from "pinia";
import { computed } from "vue";
import { cloneDeep } from "lodash-es";
import store from "../index";
import { AppConfig } from "../../config";
import { isElectronEnv } from "../../lib/electronEnv";

export type UiTheme = "dark" | "soft-light" | "auto";
type ResolvedUiTheme = Exclude<UiTheme, "auto">;
const systemAppearance = (): ResolvedUiTheme => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "soft-light";
const normalizeUiTheme = (value: unknown, legacyDarkMode?: unknown): UiTheme => {
    if (value === "dark" || value === "soft-light" || value === "auto") return value;
    if (legacyDarkMode === "light") return "soft-light";
    if (legacyDarkMode === "dark") return "dark";
    return "auto";
};
const DEFAULT_UI_THEME: UiTheme = normalizeUiTheme(localStorage.getItem("ipbot.uiTheme"));

const applyThemeAttributes = (theme: ResolvedUiTheme) => {
    if (typeof document === "undefined") {
        return;
    }

    document.body?.setAttribute("data-theme", theme);
    document.documentElement?.setAttribute("data-theme", theme);

    if (theme === "dark") {
        document.body?.setAttribute("arco-theme", "dark");
    } else {
        document.body?.removeAttribute("arco-theme");
    }
};

applyThemeAttributes(DEFAULT_UI_THEME === "auto" ? systemAppearance() : DEFAULT_UI_THEME);
if (typeof matchMedia !== "undefined") matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const setting = settingStore(store);
    setting.setupTheme();
});

export const settingStore = defineStore("setting", {
    state() {
        return {
            isReady: false,
            version: AppConfig.version,
            basic: cloneDeep(AppConfig.basic),
            isDarkMode: false,
            buildInfo: {
                buildId: "",
            },
            config: {
                guideWatched: false as boolean,
                darkMode: "" as "light" | "dark" | "auto",
                uiTheme: DEFAULT_UI_THEME as UiTheme,
            },
            configEnv: {},
        };
    },
    actions: {
        ensureUiTheme() {
            const theme = normalizeUiTheme(this.config.uiTheme, this.config.darkMode);
            this.config.uiTheme = theme;
            localStorage.setItem("ipbot.uiTheme", theme);
            return theme;
        },
        currentTheme(): ResolvedUiTheme {
            return this.config.uiTheme === "auto" ? systemAppearance() : normalizeUiTheme(this.config.uiTheme) as ResolvedUiTheme;
        },
        isSoftLightTheme() {
            return this.currentTheme() === "soft-light";
        },
        async init() {
            if (!isElectronEnv()) {
                this.config.uiTheme = DEFAULT_UI_THEME;
                this.setupTheme();
                this.isReady = true;
                return;
            }

            if (!window.$mapi) {
                console.warn("[setting.ts] $mapi is not ready yet, skip init");
                this.setupTheme();
                this.isReady = true;
                return;
            }

            try {
                this.isDarkMode = await window.$mapi.app.isDarkMode();
                this.config = await window.$mapi.config.all();
                this.configEnv = await window.$mapi.config.allEnv();
                const savedTheme = this.config.uiTheme;
                const theme = this.ensureUiTheme();
                this.setupTheme();

                if (savedTheme !== theme) {
                    this.config.uiTheme = theme;
                    await window.$mapi.config.set("uiTheme", theme);
                }

                window.$mapi.app.getBuildInfo().then((info: any) => {
                    this.buildInfo = info;
                });
            } catch (error) {
                console.error("[setting.ts] init failed", error);
            } finally {
                this.isReady = true;
            }
        },
        async showGuideWhenReady() {
            if (!(await window.$mapi.app.setupIsOk())) {
                setTimeout(() => {
                    this.showGuideWhenReady();
                }, 1000);
                return;
            }
            setTimeout(() => {
                if (!this.config.guideWatched) {
                    window.$mapi.app.windowOpen("guide").then();
                    this.setConfig("guideWatched", true).then();
                }
            }, 2000);
        },
        onConfigChangeBroadcast() {
            (async () => {
                this.config = await window.$mapi.config.all();
                this.ensureUiTheme();
                this.setupTheme();
            })();
        },
        onConfigEnvChangeBroadcast() {
            (async () => {
                this.configEnv = await window.$mapi.config.allEnv();
            })();
        },
        onDarkModeChangeBroadcast(data: any) {
            this.isDarkMode = data.isDarkMode;
            this.setupTheme();
        },
        shouldDarkMode() {
            return this.currentTheme() === "dark";
        },
        setupTheme() {
            applyThemeAttributes(this.currentTheme());
        },
        async initBasic(basic: object) {
            this.basic = Object.assign(this.basic, basic);
        },
        async setConfig(key: string, value: any) {
            if (key === "uiTheme") {
                value = normalizeUiTheme(value, this.config["darkMode"]);
            }

            this.config[key] = value;
            if (key === "uiTheme" || key === "darkMode") {
                if (key === "darkMode") this.config.uiTheme = normalizeUiTheme(undefined, value);
                this.ensureUiTheme();
                this.setupTheme();
            }

            if (isElectronEnv() && window.$mapi?.config?.set) {
                await window.$mapi.config.set(key, value);
            }

            if (key === "uiTheme" || key === "darkMode") {
                this.ensureUiTheme();
                this.setupTheme();
            }
        },
        async setConfigEnv(key: string, value: any) {
            this.configEnv[key] = value;
            await window.$mapi.config.setEnv(key, value);
        },
        async onConfigChange(key: string, value: any) {
            return await this.setConfig(key, value);
        },
        async onConfigEnvChange(key: string, value: any) {
            return await this.setConfigEnv(key, value);
        },
        configGet(key: string, defaultValue: any = null) {
            return computed(() => {
                if (key in this.config) {
                    return this.config[key];
                }
                return defaultValue;
            });
        },
        configEnvGet(key: string, defaultValue: any = null) {
            return computed(() => {
                if (key in this.configEnv) {
                    return this.configEnv[key];
                }
                return defaultValue;
            });
        },
    },
});

const setting = settingStore(store);
setting.init().then();

if (window.__page) {
    window.__page.onBroadcast("ConfigChange", setting.onConfigChangeBroadcast);
    window.__page.onBroadcast("ConfigEnvChange", setting.onConfigEnvChangeBroadcast);
    window.__page.onBroadcast("DarkModeChange", setting.onDarkModeChangeBroadcast);
} else {
    console.warn("[setting.ts] window.__page is not ready, skip broadcast binding");
}

export const useSettingStore = () => {
    return setting;
};
