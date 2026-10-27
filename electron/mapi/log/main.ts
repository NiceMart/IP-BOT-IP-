import {ipcMain} from "electron";
import logIndex from "./index";

ipcMain.handle("log:info", (event, label: string, data: any) => {
    logIndex.info(label, data);
});
ipcMain.handle("log:error", (event, label: string, data: any) => {
    logIndex.error(label, data);
});
ipcMain.handle("log:appInfo", (event, name: string, label: string, data: any) => {
    logIndex.appInfo(name, label, data);
})
ipcMain.handle("log:appError", (event, name: string, label: string, data: any) => {
    logIndex.appError(name, label, data);
});
ipcMain.handle("log:debug", (event, label: string, data: any) => {
    logIndex.debug(label, data);
});

export default {
    info: logIndex.info,
    error: logIndex.error,
    debug: logIndex.debug,
    warn: logIndex.info,  // warn 使用 info 实现
    appInfo: logIndex.appInfo,
    appError: logIndex.appError,
};

export const Log = {
    info: logIndex.info,
    error: logIndex.error,
    debug: logIndex.debug || ((label: string, data: any = null) => logIndex.info(label, data)),
    warn: logIndex.info,  // warn 使用 info 实现（警告级别）
    appPath: logIndex.appPath,
    appInfo: logIndex.appInfo,
    appError: logIndex.appError,
    jsonStringifyLogData: logIndex.jsonStringifyLogData,
};
