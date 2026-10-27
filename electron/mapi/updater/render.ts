import { ipcRenderer } from "electron";

const getCheckAtLaunch = async (): Promise<"yes" | "no"> => {
    return ipcRenderer.invoke("updater:getCheckAtLaunch");
};

const setCheckAtLaunch = async (value: "yes" | "no"): Promise<void> => {
    return ipcRenderer.invoke("updater:setCheckAtLaunch", value);
};

const getLatestStatus = async () => {
    return ipcRenderer.invoke("updater:getLatestStatus");
};

const checkForUpdate = async () => {
    return ipcRenderer.invoke("updater:checkForUpdate");
};

const downloadUpdate = async () => {
    return ipcRenderer.invoke("updater:downloadUpdate");
};

const quitAndInstall = async () => {
    return ipcRenderer.invoke("updater:quitAndInstall");
};

const onUpdaterStatus = (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on("updater:status", handler);
    return () => {
        ipcRenderer.removeListener("updater:status", handler);
    };
};

export default {
    checkForUpdate,
    downloadUpdate,
    quitAndInstall,
    getCheckAtLaunch,
    setCheckAtLaunch,
    getLatestStatus,
    onUpdaterStatus,
};
