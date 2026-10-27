import updaterIndex, { setUpdaterWindow } from "./index";
import { ipcMain } from "electron";
import ConfigMain from "../config/main";

ipcMain.handle("updater:getCheckAtLaunch", async () => {
    return ConfigMain.get("updaterCheckAtLaunch", "yes");
});

ipcMain.handle("updater:setCheckAtLaunch", async (event, value) => {
    return ConfigMain.set("updaterCheckAtLaunch", value);
});

ipcMain.handle("updater:getLatestStatus", async () => {
    return updaterIndex.getLatestStatus();
});

ipcMain.handle("updater:checkForUpdate", async () => {
    return await updaterIndex.checkForUpdate();
});

ipcMain.handle("updater:downloadUpdate", async () => {
    return await updaterIndex.downloadUpdate();
});

ipcMain.handle("updater:quitAndInstall", async () => {
    updaterIndex.quitAndInstall();
});

export const UpdaterMain = {
    ...updaterIndex,
    setUpdaterWindow,
};

export default UpdaterMain;
