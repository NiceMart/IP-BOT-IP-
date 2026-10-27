import path from "node:path";
import { AppEnv } from "../env";
import fs from "node:fs";
import { app, ipcMain } from "electron";
import { Events } from "../event/main";

let data = null;
let dataEnv = {};

const userDataRoot = () => {
    return path.join(AppEnv.userData, "config.json");
};

const dataRoot = () => {
    return path.join(AppEnv.dataRoot, "config.json");
}

const filePath = () => {
    if (fs.existsSync(userDataRoot())) {
        return userDataRoot();
    }
    return dataRoot();
};

const loadDefaults = () => {
    try {
        const isDev = !app.isPackaged;

        let defaultConfigPath: string;

        if (isDev) {
            // 开发模式：使用 app.getAppPath() 获取项目根目录
            defaultConfigPath = path.join(app.getAppPath(), 'electron/config/default-config.json');
            console.log('[Config] 开发模式 - 配置文件路径:', defaultConfigPath);
        } else {
            // 生产模式：使用 process.resourcesPath
            // 配置文件应该被打包到 resources/extra/common/ 目录
            defaultConfigPath = path.join(process.resourcesPath, 'extra/common/default-config.json');
            console.log('[Config] 生产模式 - 配置文件路径:', defaultConfigPath);
        }

        // 检查文件是否存在
        if (fs.existsSync(defaultConfigPath)) {
            const defaultJson = fs.readFileSync(defaultConfigPath).toString();
            const parsed = JSON.parse(defaultJson);
            if (parsed.config) {
                console.log('[Config] ✅ 成功加载默认配置:', defaultConfigPath);
                return { ...parsed.config, hubRoot: app.getPath("desktop") };
            }
        } else {
            console.warn('[Config] ⚠️ 默认配置文件不存在:', defaultConfigPath);
        }
    } catch (error) {
        console.warn('[Config] 加载默认配置失败:', error);
    }

    // 返回硬编码的最小配置
    console.log('[Config] 使用硬编码的最小配置');
    return {
        hubRoot: app.getPath('desktop'),
        darkMode: 'auto',
        guideWatched: false,
        updaterCheckAtLaunch: 'yes'
    };
};

const load = () => {
    try {
        let json = fs.readFileSync(filePath()).toString();
        json = JSON.parse(json);
        data = json || {};
        // Migrate the previously shipped fixed drive path, preserving custom folders.
        if (!data.hubRoot || data.hubRoot === "D:\\生成的文件") {
            data.hubRoot = app.getPath("desktop");
            fs.writeFileSync(filePath(), JSON.stringify(data, null, 4));
        }
        console.log(`[Config:load] filePath=${filePath()}, hubRoot=${data?.hubRoot}`);
    } catch (e) {
        console.warn('[Config] 配置文件读取失败，使用默认配置:', e.message);
        data = loadDefaults();
    }
};

const loadIfNeed = () => {
    if (data === null) {
        load();
    }
};

const save = () => {
    fs.writeFileSync(filePath(), JSON.stringify(data, null, 4));
};

const all = async () => {
    loadIfNeed();
    return data;
};

const get = async (key: string, defaultValue: any = null) => {
    loadIfNeed();

    // 如果配置项不存在，尝试从默认配置文件中获取
    if (!(key in data)) {
        // 尝试加载默认配置
        const defaults = loadDefaults();

        // 如果默认配置中有这个键，使用默认值
        if (defaults && key in defaults) {
            console.log(`[Config] 使用默认配置: ${key}`);
            data[key] = defaults[key];
            save();
            return data[key];
        }

        // 否则使用传入的 defaultValue
        if (defaultValue !== null) {
            data[key] = defaultValue;
            save();
        }
    }

    return data[key];
};

const set = async (key: string, value: any) => {
    loadIfNeed();
    data[key] = value;
    save();
};

const allEnv = async () => {
    return dataEnv;
};

const getEnv = async (key: string, defaultValue: any = null) => {
    if (!(key in dataEnv)) {
        dataEnv[key] = defaultValue;
    }
    return dataEnv[key];
};

const setEnv = async (key: string, value: any) => {
    dataEnv[key] = value;
};

ipcMain.handle("config:desktopPath", () => app.getPath("desktop"));

ipcMain.handle("config:all", async _ => {
    return await all();
});
ipcMain.handle("config:get", async (_, key: string, defaultValue: any = null) => {
    return await get(key, defaultValue);
});
ipcMain.handle("config:set", async (_, key: string, value: any) => {
    const res = await set(key, value);
    Events.broadcast("ConfigChange", { key, value });
    return res;
});

ipcMain.handle("config:allEnv", async _ => {
    return await allEnv();
});

ipcMain.handle("config:getEnv", async (_, key: string, defaultValue: any = null) => {
    return await getEnv(key, defaultValue);
});

ipcMain.handle("config:setEnv", async (_, key: string, value: any) => {
    const res = await setEnv(key, value);
    Events.broadcast("ConfigEnvChange", { key, value });
    return res;
});

// 导入导出功能
import { exportCurrentConfig, saveConfigToFile } from './exportConfig';

// 导出当前配置
ipcMain.handle('config:exportCurrent', async () => {
    return await exportCurrentConfig();
});

// 导出配置到文件
ipcMain.handle('config:exportToFile', async (_, targetPath: string) => {
    const config = await exportCurrentConfig();
    await saveConfigToFile(config, targetPath);
    return { success: true, path: targetPath };
});

export const ConfigMain = {
    all,
    get,
    set,
    getSync: (key: string, defaultValue: any = null) => {
        loadIfNeed();
        return data[key] ?? defaultValue;
    },
    allEnv,
    getEnv,
    setEnv,
};

export default ConfigMain;

