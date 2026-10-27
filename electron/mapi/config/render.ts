import { ipcRenderer } from "electron";

const all = async () => {
    return ipcRenderer.invoke("config:all");
};

const get = async (key: string, defaultValue: any = null) => {
    return ipcRenderer.invoke("config:get", key, defaultValue);
};

const set = async (key: string, value: any) => {
    return ipcRenderer.invoke("config:set", key, value);
};

const allEnv = async () => {
    return ipcRenderer.invoke("config:allEnv");
};

const getEnv = async (key: string, defaultValue: any = null) => {
    return ipcRenderer.invoke("config:getEnv", key, defaultValue);
};

const setEnv = (key: string, value: any) => {
    return ipcRenderer.invoke("config:setEnv", key, value);
};

const exportCurrent = () => {
    return ipcRenderer.invoke("config:exportCurrent");
};

const exportToFile = (targetPath: string) => {
    return ipcRenderer.invoke("config:exportToFile", targetPath);
};

export default {
    all,
    get,
    set,
    allEnv,
    getEnv,
    setEnv,
    exportCurrent,
    exportToFile,
};
