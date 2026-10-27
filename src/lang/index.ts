import { createI18n } from "vue-i18n";

import { isDev } from "../lib/env";
import source from "./source.json";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

let localeInit = false;
export const defaultLocale = "zh-CN";

export const messageList = [
    {
        name: "en-US",
        label: "English",
        messages: enUS,
    },
    {
        name: "zh-CN",
        label: "简体中文",
        messages: zhCN,
    },
];

const buildMessages = (): any => {
    const messages = {};
    for (const localeItem of messageList) {
        const msgList = {};
        for (const key in source) {
            const sourceKey = source[key];
            if (localeItem.messages[sourceKey]) {
                msgList[key] = localeItem.messages[sourceKey];
            }
        }
        messages[localeItem.name] = msgList;
    }
    return messages;
};

const messages = buildMessages();

export const i18n = createI18n({
    locale: defaultLocale,
    legacy: false,
    globalInjection: true,
    messages,
});

if (window.$mapi) {
    window.$mapi.config.get("lang", defaultLocale).then((lang: string) => {
        i18n.global.locale.value = lang as any;
        localeInit = true;
        fireLocaleChange(lang);
    });
}

export type LocaleItem = {
    name: string;
    label: string;
    active?: boolean;
};

export const listLocales = () => {
    const list: LocaleItem[] = messageList;
    list.forEach(item => {
        item.active = i18n.global.locale.value === item.name;
    });
    return list;
};

export const getLocale = async () => {
    return new Promise<string>(resolve => {
        if (localeInit) {
            resolve(i18n.global.locale.value);
        } else {
            setTimeout(() => {
                resolve(getLocale());
            }, 100);
        }
    });
};

let localeChangeListener: Array<(locale: string) => void> = [];

export const onLocaleChange = (callback: (lang: string) => void) => {
    localeChangeListener.push(callback);
};

const fireLocaleChange = (lang: string) => {
    localeChangeListener.forEach(callback => {
        callback(lang);
    });
};

export const changeLocale = (lang: string) => {
    i18n.global.locale.value = lang as any;
    window.$mapi.config.set("lang", lang).then(() => {
        fireLocaleChange(lang);
    });
};

const recordedKeys = new Set<string>();

export const t = (key: string, param: object | null = null) => {
    if (isDev && window.$mapi && window.$mapi.lang) {
        if (!recordedKeys.has(key)) {
            recordedKeys.add(key);
            getLocale()
                .then(locale => {
                    if (!messages[locale][key]) {
                        window.$mapi.lang.writeSourceKey(key).then().catch(err => {
                            console.error("Failed to write source key:", err);
                        });
                    }
                })
                .catch(err => {
                    console.error("Failed to get locale:", err);
                });
            window.$mapi.lang.writeSourceKeyUse(key).then().catch(err => {
                console.error("Failed to write source key use:", err);
            });
        }
    }
    if (!(key in messages[i18n.global.locale.value])) {
        if (param) {
            return key.replace(/\{(\w+)\}/g, function (match, paramKey) {
                return paramKey in param ? param[paramKey] : match;
            });
        }
        return key;
    }
    // @ts-ignore
    return i18n.global.t(key, param as any);
};

export const $t = t;
