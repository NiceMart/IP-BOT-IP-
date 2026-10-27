import {Files} from "../file/main";
import {AppEnv, AppRuntime} from "../env";
import {JsonUtil, StrUtil} from "../../lib/util";
import {langMessageList} from "../../config/lang";
import {app, dialog, ipcMain} from "electron";
import {Log} from "../log/main";
import {isDev} from "../../lib/env";
import {AppsMain} from "../app/main";

const fileSyncer = {
    readJson: async function (file: string) {
        let filePath = [AppEnv.appRoot, file].join("/");
        const sourceContent = (await Files.read(filePath)) || "{}";
        return JSON.parse(sourceContent);
    },
    writeJson: async function (file: string, data: any, order: "key" | "value" = "key") {
        let filePath = [AppEnv.appRoot, file].join("/");
        let jsonString: any;
        if (order === "key") {
            jsonString = JsonUtil.stringifyOrdered(data);
        } else {
            jsonString = JsonUtil.stringifyValueOrdered(data);
        }
        await Files.write(filePath, jsonString);
    },
};


const mergeJson = {};
let mergeJsonIgnore = false;
let autoWriteTimer = null;

const readSource = async () => {
    const json = await fileSyncer.readJson("src/lang/source.json");
    if (!mergeJson['source']) {
        mergeJson['source'] = {};
    }
    for (const k in mergeJson['source']) {
        if (!json[k]) {
            json[k] = mergeJson['source'][k];
        }
    }
    return json;
}

const readLang = async (name: string) => {
    const jsonLang = await fileSyncer.readJson(`src/lang/${name}.json`);
    if (!mergeJson[name]) {
        mergeJson[name] = {};
    }
    for (const k in mergeJson[name]) {
        if (!jsonLang[k]) {
            jsonLang[k] = mergeJson[name][k];
        }
    }
    return jsonLang;
}

const writeSourceKey = async (key: string) => {
    const source = await readSource();
    if (source[key]) {
        return;
    }
    source[key] = StrUtil.hashCodeWithDuplicateCheck(key, Object.values(source));
    mergeJson['source'][key] = source[key];
    for (let l of langMessageList) {
        const langJson = await readLang(l.name);
        langJson[source[key]] = key;
        mergeJson[l.name][source[key]] = key;
    }
    Log.info("Lang.writeSourceKey", {key, id: source[key]});
    // 禁用频繁的toast提示，只在日志中记录（避免干扰用户）
    // AppsMain.toast(`LangAdded: ${key}`, {status: "info", duration: 1000}).then();
    if (!mergeJsonIgnore) {
        autoWrite();
    }
};

const autoWrite = (delay = 10000) => {
    // 禁用自动写入语言键的弹窗提示（避免干扰用户）
    // 直接设置为忽略模式，不再显示对话框
    if (autoWriteTimer) {
        clearTimeout(autoWriteTimer);
        autoWriteTimer = null;
    }
    
    // 静默忽略，不显示对话框，不清空mergeJson（保留在内存中）
                mergeJsonIgnore = true;
    Log.info("Lang.autoWrite", {
        skipped: true,
        note: "自动写入对话框已禁用，语言键仅在后台记录",
        keyCount: Object.keys(mergeJson['source'] || {}).length
    });
    
    // 原来的对话框逻辑已禁用，避免频繁弹窗干扰用户
}
if (isDev) {
    app.on("before-quit", (e) => {
        // 禁用退出时的对话框提示，允许应用正常退出
        // 语言键仍然会在后台记录，但不会阻止应用退出
        if (!mergeJsonIgnore) {
            const hasKeys = Object.keys(mergeJson).some(k => mergeJson[k] && Object.keys(mergeJson[k]).length > 0);
            if (hasKeys) {
                Log.info("Lang.before-quit", {
                    note: "应用退出时发现未写入的语言键，已禁用对话框提示",
                    keyCount: Object.keys(mergeJson['source'] || {}).length
                });
                // 不再阻止应用退出，直接设置忽略标志
                mergeJsonIgnore = true;
            }
        }
        // 注释掉原来的阻止退出逻辑
        /*
        if (!mergeJsonIgnore) {
            for (const k in mergeJson) {
                if (mergeJson[k] && Object.keys(mergeJson[k]).length > 0) {
                    e.preventDefault();
                    autoWrite(0);
                }
            }
        }
        */
    });
}

const writeSourceKeyUse = async (key: string) => {
    const json = await fileSyncer.readJson("src/lang/source-use.json");
    if (!json[key]) {
        json[key] = 1;
    } else {
        json[key]++;
    }
    await fileSyncer.writeJson("src/lang/source-use.json", json, "value");
};

ipcMain.handle("lang:writeSourceKey", async (_, key) => {
    await writeSourceKey(key);
});
ipcMain.handle("lang:writeSourceKeyUse", async (_, key) => {
    await writeSourceKeyUse(key);
});

export default {
    writeSourceKey,
    writeSourceKeyUse,
};
