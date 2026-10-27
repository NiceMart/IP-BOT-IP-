import {dialog, ipcMain} from "electron";
import fileIndex from "./index";
import { existsSync, mkdirSync, readdirSync, statSync, createReadStream } from "fs";
import { join, basename } from "path";
import { downloadFile } from "./download";
import { AppEnv } from "../env";
import { normalizePath } from "../../lib/path-util";
import { getRuntimeBundlePath, isDevelopment } from "../../lib/resource-path";
import * as http from "http";
import * as os from "os";

ipcMain.handle("file:exists", async (_, filePath: string): Promise<boolean> => {
    try {
        return existsSync(filePath);
    } catch (e) {
        console.error("[file:exists] 检查文件存在性失败:", filePath, e);
        return false;
    }
});

ipcMain.handle("path:join", async (_, ...segments: string[]): Promise<string> => {
    try {
        return join(...segments);
    } catch (e) {
        console.error("[path:join] 路径拼接失败:", segments, e);
        throw e;
    }
});

// 🔧 新增：路径标准化接口（处理中文路径和空格）
ipcMain.handle("file:normalizePath", async (_, filePath: string): Promise<string> => {
    try {
        return normalizePath(filePath);
    } catch (e) {
        console.error("[file:normalizePath] 路径标准化失败:", filePath, e);
        return filePath; // 失败时返回原路径
    }
});

ipcMain.handle("file:fullPath", async (_, filePath: string): Promise<string> => {
    try {
        console.log("[file:fullPath] 处理请求，路径:", filePath);
        const result = await fileIndex.fullPath(filePath);
        console.log("[file:fullPath] 返回结果:", result);
        return result;
    } catch (e: any) {
        console.error("[file:fullPath] 获取完整路径失败:", filePath, e);
        throw new Error(`Failed to get full path: ${e.message}`);
    }
});

ipcMain.handle("file:openFile", async (
    event,
    options: {
        filters?: {
            name: string;
            extensions: string[];
        }[],
        properties?: ("multiSelections" | "openFile")[]
    } = {}): Promise<string | string[] | null> => {
    options = Object.assign({
        filters: [],
        properties: [],
    }, options);
    if (!options.properties.includes("openFile")) {
        options.properties.push("openFile");
    }
    // @ts-ignore
    options.properties.push('noResolveAliases');
    const res = await dialog
        .showOpenDialog({
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    if (options.properties.includes("multiSelections")) {
        return res.filePaths || null;
    }
    return res.filePaths?.[0] || null;
});

ipcMain.handle("file:openDirectory", async (_, options): Promise<string | null> => {
    const res = await dialog
        .showOpenDialog({
            properties: ["openDirectory"],
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    return res.filePaths?.[0] || null;
});

ipcMain.handle("file:openSave", async (_, options): Promise<string | null> => {
    const res = await dialog
        .showSaveDialog({
            ...options,
        })
        .catch(e => {
        });
    if (!res || res.canceled) {
        return null;
    }
    return res.filePath || null;
});

ipcMain.handle("file:temp", async (_, ext: string = "tmp", prefix: string = "file", suffix: string = ""): Promise<string> => {
    try {
        return await fileIndex.temp(ext, prefix, suffix);
    } catch (e: any) {
        console.error("[file:temp] 获取临时文件路径失败:", e);
        throw e;
    }
});

ipcMain.handle("file:writeBuffer", async (_, path: string, data: any, option?: { isDataPath?: boolean }): Promise<void> => {
    try {
        return await fileIndex.writeBuffer(path, data, option);
    } catch (e: any) {
        console.error("[file:writeBuffer] 写入缓冲区失败:", path, e);
        throw e;
    }
});

ipcMain.handle("file:hubSave", async (_, file: string, option?: any): Promise<string> => {
    try {
        return await fileIndex.hubSave(file, option);
    } catch (e: any) {
        console.error("[file:hubSave] Hub保存失败:", file, e);
        throw e;
    }
});

ipcMain.handle("file:deletes", async (_, path: string, option?: { isDataPath?: boolean }): Promise<void> => {
    try {
        return await fileIndex.deletes(path, option);
    } catch (e: any) {
        console.error("[file:deletes] 删除文件失败:", path, e);
        throw e;
    }
});

const autoCleanTemp = async () => {
    fileIndex.autoCleanTemp(1).finally(() => {
        setTimeout(() => {
            autoCleanTemp();
        }, 10 * 60 * 1000);
    });
}

setTimeout(() => {
    autoCleanTemp().then();
}, 5000);

// 下载外部URL文件到本地
ipcMain.handle("file:downloadUrl", async (_, url: string, saveDir?: string): Promise<string> => {
    try {
        console.log("[file:downloadUrl] 开始下载文件:", url);
        const filePath = await downloadFile(url, saveDir);
        console.log("[file:downloadUrl] 文件下载成功:", filePath);
        return filePath;
    } catch (error: any) {
        console.error("[file:downloadUrl] 下载文件失败:", error.message);
        throw new Error(`下载文件失败: ${error.message}`);
    }
});

// 读取目录内容（用于系统乐库等场景）
ipcMain.handle("dir:read", async (_, dirPath: string, options?: { extensions?: string[] }): Promise<{name: string; path: string; isDirectory: boolean}[]> => {
    try {
        if (!existsSync(dirPath)) return [];
        const entries = readdirSync(dirPath);
        const result: {name: string; path: string; isDirectory: boolean}[] = [];
        for (const entry of entries) {
            const fullPath = join(dirPath, entry);
            try {
                const stat = statSync(fullPath);
                const isDir = stat.isDirectory();
                // 如果指定了扩展名过滤，只返回匹配的文件
                if (!isDir && options?.extensions?.length) {
                    const ext = entry.split('.').pop()?.toLowerCase() || '';
                    if (!options.extensions.includes(ext)) continue;
                }
                result.push({ name: entry, path: fullPath, isDirectory: isDir });
            } catch (e) {
                // 跳过无法访问的文件
            }
        }
        return result;
    } catch (e: any) {
        console.error("[dir:read] 读取目录失败:", dirPath, e.message);
        return [];
    }
});

// 获取BGM资源目录路径（兼容开发环境和生产环境）
ipcMain.handle("bgm:getDir", async (): Promise<string> => {
    try {
        // 优先检查打包后的 resources-bundles 目录
        const bundleBgmDir = getRuntimeBundlePath('bgm');
        if (existsSync(bundleBgmDir)) {
            console.log("[bgm:getDir] 使用打包目录:", bundleBgmDir);
            return bundleBgmDir;
        }
        // 开发环境回退：项目根目录/bgm
        const appRoot = process.env.APP_ROOT || process.cwd();
        const devBgmDir = join(appRoot, 'bgm');
        if (existsSync(devBgmDir)) {
            console.log("[bgm:getDir] 使用开发目录:", devBgmDir);
            return devBgmDir;
        }
        console.warn("[bgm:getDir] BGM目录不存在，尝试路径:", bundleBgmDir, devBgmDir);
        return devBgmDir; // 返回默认路径，让前端处理不存在的情况
    } catch (e: any) {
        console.error("[bgm:getDir] 获取BGM目录失败:", e.message);
        const appRoot = process.env.APP_ROOT || process.cwd();
        return join(appRoot, 'bgm');
    }
});

// 获取输出目录（用于字体文件等临时文件）
// 使用 AppEnv.dataRoot/output 目录，便携版模式下会在应用目录下
ipcMain.handle("file:getOutputDir", async (): Promise<string> => {
    try {
        const outputDir = join(AppEnv.dataRoot, 'output');
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }
        console.log("[file:getOutputDir] 返回输出目录:", outputDir);
        return outputDir;
    } catch (error: any) {
        console.error("[file:getOutputDir] 获取输出目录失败:", error.message);
        throw new Error(`获取输出目录失败: ${error.message}`);
    }
});

export default {
    ...fileIndex,
};

export const Files = {
    ...fileIndex,
};

// ====== 临时文件共享服务器（用于手机扫码下载） ======
const activeServers = new Map<string, http.Server>();

// 获取本机局域网IP
function getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// 启动临时文件共享服务器
ipcMain.handle("file:shareStart", async (_, filePath: string): Promise<{ url: string; localIp: string; port: number } | null> => {
    try {
        if (!existsSync(filePath)) {
            throw new Error("文件不存在: " + filePath);
        }

        const fileName = basename(filePath);
        const fileStat = statSync(filePath);

        const server = http.createServer((req, res) => {
            // 设置 CORS 头，允许手机浏览器访问
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // 支持 Range 请求（手机浏览器可能需要）
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileStat.size - 1;
                const chunkSize = end - start + 1;

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                });
                createReadStream(filePath, { start, end }).pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileStat.size,
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                    'Accept-Ranges': 'bytes',
                });
                createReadStream(filePath).pipe(res);
            }
        });

        // 监听随机端口
        await new Promise<void>((resolve, reject) => {
            server.listen(0, '0.0.0.0', () => resolve());
            server.on('error', reject);
        });

        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const localIp = getLocalIP();
        const url = `http://${localIp}:${port}/${encodeURIComponent(fileName)}`;

        // 存储服务器引用
        activeServers.set(filePath, server);

        // 10分钟后自动关闭
        setTimeout(() => {
            if (activeServers.has(filePath)) {
                server.close();
                activeServers.delete(filePath);
            }
        }, 10 * 60 * 1000);

        console.log(`[file:shareStart] 文件共享服务器已启动: ${url}`);
        return { url, localIp, port };
    } catch (e: any) {
        console.error("[file:shareStart] 启动文件共享服务器失败:", e.message);
        throw new Error(`启动文件共享失败: ${e.message}`);
    }
});

// 停止临时文件共享服务器
ipcMain.handle("file:shareStop", async (_, filePath: string): Promise<void> => {
    try {
        const server = activeServers.get(filePath);
        if (server) {
            server.close();
            activeServers.delete(filePath);
            console.log(`[file:shareStop] 文件共享服务器已关闭: ${filePath}`);
        }
    } catch (e: any) {
        console.error("[file:shareStop] 关闭文件共享服务器失败:", e.message);
    }
});
