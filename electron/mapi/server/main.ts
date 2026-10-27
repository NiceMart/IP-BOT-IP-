import ServerApi from "./api";
import {ipcMain} from "electron";
import {Log} from "../log/main";
import {mapError} from "./error";
import {AigcServer} from "../../aigcserver";
import {SendType, ServerContext, ServerInfo} from "./type";
import {Files} from "../file/main";
import {getGpuInfo} from "../../lib/env-main";

ipcMain.handle("server:listGpus", async event => {
    return await getGpuInfo();
});

let runningServerCount = 0;
ipcMain.handle("server:runningServerCount", async (event, count: number | null) => {
    if (count === null) {
        return runningServerCount;
    }
    // console.log('runningServerCount', count)
    runningServerCount = count;
    return runningServerCount;
});
const getRunningServerCount = () => {
    return runningServerCount;
};

const serverModule: {
    [key: string]: ServerContext;
} = {};

// 清理单个模块
const cleanupModule = async (localPath: string) => {
    if (serverModule[localPath]) {
        try {
            const server = serverModule[localPath];
            if (server && server.stop) {
                await server.stop();
            }
        } catch (e) {
            Log.warn(`[cleanupModule] 停止模块失败: ${localPath}`, e);
        }
        delete serverModule[localPath];
        Log.info(`[cleanupModule] ✓ 已清理模块: ${localPath}`);
    }
};

// 清理所有模块缓存
const clearAllModules = async () => {
    const paths = Object.keys(serverModule);
    Log.info(`[clearAllModules] 开始清理 ${paths.length} 个模块缓存`);
    for (const path of paths) {
        delete serverModule[path];
    }
    Log.info(`[clearAllModules] ✓ 已清理所有模块缓存`);
};

const init = () => {
};

const getModule = async (
    serverInfo: ServerInfo,
    option?: {
        throwException: boolean;
    }
): Promise<ServerContext> => {
    option = Object.assign(
        {
            throwException: true,
        },
        option
    );
    // console.log('getModule', serverInfo)
    if (!serverModule[serverInfo.localPath]) {
        try {
            if (serverInfo.name.startsWith("Cloud")) {
                const server = new AigcServer["Cloud"]();
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else if (serverInfo.name in AigcServer) {
                const server = AigcServer[serverInfo.name] as ServerContext;
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else {
                const serverPath = `${serverInfo.localPath}/server.js`;
                const configPath = `${serverInfo.localPath}/config.json`;

                let server = null;
                if (
                    await Files.exists(serverPath, {
                        isDataPath: false,
                    })
                ) {
                    const module = await import(`file://${serverPath}`);
                    server = module.default;
                }
                if (
                    !server &&
                    (await Files.exists(configPath, {
                        isDataPath: false,
                    }))
                ) {
                    const configContent = await Files.read(configPath, {isDataPath: false});
                    try {
                        const config = JSON.parse(configContent);
                        if (config.entry === "__EasyServer__") {
                            server = new AigcServer["EasyServer"](config);
                        } else {
                            throw `ServerEntryNotFound : ${config.entry}`;
                        }
                    } catch (e) {
                        const errorMessage = e instanceof Error ? e.message : String(e);
                        console.error(`Failed to parse config file: ${configPath}`, {
                            error: e,
                            content: configContent.substring(0, 500) + (configContent.length > 500 ? "..." : ""),
                            contentLength: configContent.length
                        });
                        throw `ConfigParseError : ${configPath} - ${errorMessage}`;
                    }
                }
                if (!server) {
                    throw `ServerFileNotFound : ${serverPath}`;
                }
                server.type = "custom";
                server.ServerApi = ServerApi;
                if (server.init) {
                    await server.init();
                }
                server.send = (type: SendType, data: any) => {
                    server.ServerApi.event.sendChannel(server.ServerInfo.eventChannelName, {type, data});
                };
                server.sendLog = (data: any) => {
                    server.ServerApi.file.appendText(server.ServerInfo.logFile, data, {isDataPath: true});
                };
                serverModule[serverInfo.localPath] = server;
            }
        } catch (e) {
            if (!option.throwException) {
                return null;
            }
            const error = mapError(e);
            Log.error("mapi.server.getModule.error", error);
            throw error;
        }
    }
    // console.log('getModule', serverInfo, serverModule[serverInfo.localPath])
    serverModule[serverInfo.localPath].ServerInfo = serverInfo;
    return serverModule[serverInfo.localPath];
};

ipcMain.handle("server:isSupport", async (event, serverInfo: ServerInfo) => {
    try {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        return !!module;
    } catch (e) {
        return false;
    }
});

ipcMain.handle("server:start", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.start();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.start.error", error);
        throw error;
    }
});

ipcMain.handle("server:ping", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.ping();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.ping.error", error);
        throw error;
    }
    return false;
});

ipcMain.handle("server:stop", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        const result = await module.stop();

        // ✅ 关键修复：停止后立即删除缓存，释放内存
        if (serverModule[serverInfo.localPath]) {
            delete serverModule[serverInfo.localPath];
            Log.info(`[server:stop] ✓ 已释放模块缓存: ${serverInfo.name}`);
        }

        return result;
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.stop.error", error);
        throw error;
    }
});

ipcMain.handle("server:cancel", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.cancel();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.cancel.error", error);
        throw error;
    }
});

ipcMain.handle("server:deletes", async (event, serverInfo: ServerInfo) => {
    if (serverModule[serverInfo.localPath]) {
        delete serverModule[serverInfo.localPath];
    }
    return true;
});

ipcMain.handle("server:config", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.config();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.config.error", error);
        throw error;
    }
});

ipcMain.handle("server:callFunction", async (event, serverInfo: ServerInfo, method: string, data: any, option: any) => {
    // console.log('getModule.before', serverInfo, method)
    const module = await getModule(serverInfo);
    // console.log('getModule.end', serverInfo, method, module)
    const func = module[method];
    if (!func) {
        throw new Error(`MethodNotFound : ${method}`);
    }
    try {
        return await func.bind(module)(data, option || {});
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.callFunction.error", {
            type: typeof e,
            error,
            serverInfo,
            method,
            data,
            option,
        });
        return {
            code: -1,
            msg: error,
        };
    }
});

export default {
    init,
};

// 关闭所有运行中的服务器
const stopAllServers = async () => {
    const servers = Object.entries(serverModule);
    Log.info(`[stopAllServers] 开始停止 ${servers.length} 个服务器`);

    for (const [localPath, server] of servers) {
        try {
            if (server && server.stop) {
                Log.info(`[stopAllServers] 正在停止: ${server.ServerInfo?.name || localPath}`);
                await server.stop();
            }
        } catch (e) {
            const error = mapError(e);
            Log.error(`[stopAllServers] 停止失败: ${server.ServerInfo?.name || localPath}`, error);
        }
        // 无论成功失败，都从缓存中删除
        delete serverModule[localPath];
        Log.info(`[stopAllServers] ✓ 已释放模块缓存: ${server.ServerInfo?.name || localPath}`);
    }

    Log.info(`[stopAllServers] ✓ 所有服务器已停止，模块缓存已清空`);
};

export const ServerMain = {
    getRunningServerCount,
    stopAllServers,
    clearAllModules,
    getModule,  // 导出给其他模块使用
};
