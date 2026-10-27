import { ipcRenderer } from "electron";
import fileIndex from "./index";

const openFile = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openFile", options);
};

const openDirectory = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openDirectory", options);
};

const openSave = async (options: {} = {}) => {
    return ipcRenderer.invoke("file:openSave", options);
};

const fullPath = async (path: string): Promise<string> => {
    return ipcRenderer.invoke("file:fullPath", path);
};

const temp = async (ext: string = "tmp", prefix: string = "file", suffix: string = ""): Promise<string> => {
    return ipcRenderer.invoke("file:temp", ext, prefix, suffix);
};

const writeBuffer = async (path: string, data: any, option?: { isDataPath?: boolean }): Promise<void> => {
    return ipcRenderer.invoke("file:writeBuffer", path, data, option);
};

const hubSave = async (file: string, option?: any): Promise<string> => {
    return ipcRenderer.invoke("file:hubSave", file, option);
};

const deletes = async (path: string, option?: { isDataPath?: boolean }): Promise<void> => {
    return ipcRenderer.invoke("file:deletes", path, option);
};

const downloadUrl = async (url: string, saveDir?: string): Promise<string> => {
    return ipcRenderer.invoke("file:downloadUrl", url, saveDir);
};

const getOutputDir = async (): Promise<string> => {
    return ipcRenderer.invoke("file:getOutputDir");
};

// 🔧 新增：路径标准化方法（处理中文路径和空格）
const normalizePath = async (filePath: string): Promise<string> => {
    return ipcRenderer.invoke("file:normalizePath", filePath);
};

// 读取目录内容
const readDir = async (dirPath: string, options?: { extensions?: string[] }): Promise<{name: string; path: string; isDirectory: boolean}[]> => {
    return ipcRenderer.invoke("dir:read", dirPath, options);
};

// 获取BGM资源目录路径
const getBGMDir = async (): Promise<string> => {
    return ipcRenderer.invoke("bgm:getDir");
};

// 启动临时文件共享服务器
const shareStart = async (filePath: string): Promise<{ url: string; localIp: string; port: number } | null> => {
    return ipcRenderer.invoke("file:shareStart", filePath);
};

// 停止临时文件共享服务器
const shareStop = async (filePath: string): Promise<void> => {
    return ipcRenderer.invoke("file:shareStop", filePath);
};

export default {
    ...fileIndex,
    openFile,
    openDirectory,
    openSave,
    fullPath,
    temp,
    writeBuffer,
    hubSave,
    deletes,
    downloadUrl,
    getOutputDir,
    normalizePath,
    readDir,
    getBGMDir,
    shareStart,
    shareStop,
};
