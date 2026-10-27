import {ipcMain} from "electron";

import index from "./index";

// 注册所有 IPC 处理器，这样 render.ts 就不需要导入 Node.js 模块
ipcMain.handle("misc:getZipFileContent", async (_, path: string, pathInZip: string) => {
    return await index.getZipFileContent(path, pathInZip);
});

ipcMain.handle("misc:unzip", async (_, zipPath: string, dest: string, option?: any) => {
    return await index.unzip(zipPath, dest, option);
});

ipcMain.handle("misc:zip", async (_, zipPath: string, sourceDir: string, option?: any) => {
    return await index.zip(zipPath, sourceDir, option);
});

ipcMain.handle("misc:request", async (_, requestOption: any) => {
    return await index.request(requestOption);
});

export default {
    ...index,
};

export const MiscMain = {
    ...index,
};
