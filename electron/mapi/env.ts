import electron, {BrowserWindow} from "electron";
import {Log} from "./log";

export const AppEnv = {
    isInit: false,
    appRoot: null as string,
    appData: null as string,
    userData: null as string,
    dataRoot: null as string,
    installRoot: null as string,
    sessionData: null as string,
    cacheRoot: null as string,
    tempRoot: null as string,
    resourceStateRoot: null as string,
    resourceBundleRoot: null as string,
};

export const AppRuntime = {
    fileHubRoot: null as string,
    splashWindow: null as BrowserWindow,
    mainWindow: null as BrowserWindow,
    windows: {} as Record<string, BrowserWindow>,
    mapiInitialized: false,  // 🔧 标记 MAPI 是否已初始化
};

export const waitAppEnvReady = async () => {
    while (!AppEnv.isInit) {
        await new Promise(resolve => {
            setTimeout(resolve, 1000);
        });
    }
};

export const callHandleFromMainOrRender = async (name: string, ...args) => {
    if (electron.ipcRenderer) {
        return electron.ipcRenderer.invoke(name, ...args);
    } else {
        const func = electron.ipcMain._invokeHandlers.get(name);
        if (func) {
            const fakeEvent = { sender: { send: () => {} } };
            return func(fakeEvent, ...args);
        } else {
            Log.error(`No handler found for ${name}`);
            return null;
        }
    }
};
