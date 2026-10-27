import { ipcRenderer } from "electron";

// 🔧 纯 IPC 包装 - 不导入 Node.js 模块（特别是 archiver），防止被打包到渲染进程
export default {
    getZipFileContent: async (path: string, pathInZip: string) => {
                if (!ipcRenderer) {
            throw new Error('IPC 接口不可用');
        }
        return await ipcRenderer.invoke("misc:getZipFileContent", path, pathInZip);
    },

    unzip: async (zipPath: string, dest: string, option?: any) => {
                if (!ipcRenderer) {
            throw new Error('IPC 接口不可用');
        }
        return await ipcRenderer.invoke("misc:unzip", zipPath, dest, option);
    },

    zip: async (zipPath: string, sourceDir: string, option?: any) => {
                if (!ipcRenderer) {
            throw new Error('IPC 接口不可用');
        }
        return await ipcRenderer.invoke("misc:zip", zipPath, sourceDir, option);
    },

    request: async (requestOption: any) => {
                if (!ipcRenderer) {
            throw new Error('IPC 接口不可用');
        }
        return await ipcRenderer.invoke("misc:request", requestOption);
    },
};
