import {net} from "electron";
import {Client, handle_file} from "@gradio/client";
import {platformArch, platformName, platformUUID} from "../../lib/env";
import {Events} from "../event/main";
import {Apps} from "../app";
import {Files} from "../file/main";
import fs from "node:fs";
import User, {UserApi} from "../user/main";
import {EncodeUtil, MemoryMapCacheUtil} from "../../lib/util";
import {ServerContext, ServerFunctionDataType} from "./type";
import {Log} from "../log/main";
import {TaskLogMain} from "../taskLog/main";

type RequestOptionType = {
    method?: "POST" | "GET";
    timeout?: number;
    headers?: Record<string, string>;
    responseType?: "json" | "text";
    retry?: number;
    retryTimes?: number;
    retryInterval?: number;
};

const request = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "GET",
            timeout: 60 * 1000,
            headers: {
                "Content-Type": "application/json",
            },
            responseType: "json" as "json",
            retry: 0,
            retryTimes: 0,
            retryInterval: 5,
        },
        option
    );
    if (option["method"] === "GET") {
        url += "?";
        for (let key in data) {
            url += `${key}=${data[key]}&`;
        }
    }
    return new Promise((resolve, reject) => {
        const req = net.request({
            url,
            method: option["method"],
            headers: option["headers"],
        });
        req.on("response", response => {
            let body = "";
            response.on("data", chunk => {
                body += chunk.toString();
            });
            response.on("end", () => {
                if ("json" === option["responseType"]) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        if (option.retry > 0 && option.retryTimes < option.retry) {
                            option.retryTimes++;
                            Log.info("request", `retry ${option.retryTimes} ${url}`);
                            setTimeout(() => {
                                request(url, data, option).then(resolve).catch(reject);
                            }, option.retryInterval * 1000);
                        } else {
                            resolve({code: -1, msg: `ResponseError: ${body}`});
                        }
                    }
                } else {
                    resolve(body);
                }
            });
        });
        req.on("error", err => {
            if (option.retry > 0 && option.retryTimes < option.retry) {
                option.retryTimes++;
                Log.info("request", `retry ${option.retryTimes} ${url}`);
                setTimeout(() => {
                    request(url, data, option).then(resolve).catch(reject);
                }, option.retryInterval * 1000);
            } else {
                reject(err);
            }
        });
        if (option["method"] === "POST") {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

const requestPost = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "POST",
        },
        option
    );
    return request(url, data, option);
};

const requestGet = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "GET",
        },
        option
    );
    return request(url, data, option);
};

const requestPostSuccess = async (url, data?: {}, option?: RequestOptionType) => {
    const res = await requestPost(url, data, option);
    if (res["code"] === 0) {
        return res;
    }
    throw new Error(res["msg"]);
};

const requestUrlFileToLocal = async (url, path) => {
    return new Promise((resolve, reject) => {
        const req = net.request(url);
        req.on("response", response => {
            const file = fs.createWriteStream(path);
            // @ts-ignore
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve("x");
            });
        });
        req.on("error", err => {
            reject(err);
        });
        req.end();
    });
};

const requestEventSource = async (
    url: string,
    param: any,
    option?: {
        method?: "POST" | "GET";
        headers?: Record<string, string>;
        onMessage: (data: any) => void;
        onEnd?: () => void;
    }
) => {
    option = Object.assign(
        {
            method: "POST",
            headers: {},
            onMessage: (data: any) => {
                console.log("onMessage", data);
            },
            onEnd: () => {
                console.log("onEnd");
            },
        },
        option
    );
    // return new Promise((resolve, reject) => {
    //     const req = net.request({
    //         url,
    //         method: option.method,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             ...option.headers,
    //         },
    //     })
    //     req.on('response', (response) => {
    //         console.log('response', response)
    //         let buffer = ''
    //         response.on('data', (chunk) => {
    //             console.log('response.data', chunk)
    //             buffer += chunk.toString()
    //             const lines = buffer.split("\n")
    //             buffer = lines.pop()
    //             for (const line of lines) {
    //                 if (line.startsWith("data: ")) {
    //                     const data = line.slice(6)
    //                     if ('[END]' === data) {
    //                         option.onEnd()
    //                         return;
    //                     }
    //                     const eventData = line.slice(6).trim();
    //                     option.onMessage(EncodeUtil.base64Decode(eventData))
    //                 }
    //             }
    //         })
    //         response.on('end', () => {
    //             resolve(undefined)
    //         })
    //     })
    //     req.on('error', (err) => {
    //         reject(err)
    //     })
    //     req.end()
    // });
    const response = await net.fetch(url, {
        method: option.method,
        headers: {
            "Content-Type": "application/json",
            ...option.headers,
        },
        body: JSON.stringify(param || {}),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const {done, value} = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split("\n");
        buffer = lines.pop();
        // console.log('fetchEventSource', JSON.stringify(buffer))
        for (const line of lines) {
            // console.log('line', JSON.stringify(line))
            if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if ("[END]" === data) {
                    option.onEnd();
                    return;
                }
                const eventData = line.slice(6).trim();
                option.onMessage(EncodeUtil.base64Decode(eventData));
            }
        }
    }
};

const env = async () => {
    const result = {};
    result["AIGCPANEL_SERVER_API_TOKEN"] = await User.getApiToken();
    result["AIGCPANEL_SERVER_UUID"] = platformUUID();
    result["AIGCPANEL_SERVER_LAUNCHER_MODE"] = "api";
    return result;
};

const sleep = async ms => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

/**
 * 解析日志文本并保存到数据库
 * @param taskId 任务ID
 * @param logs 日志文本
 * @param context 服务器上下文
 */
const parseAndSaveLogsToDatabase = async (taskId: string, logs: string, context: ServerContext) => {
    const lines = logs.split("\n").filter(line => line.trim());

    for (const line of lines) {
        try {
            // 解析日志行，格式通常为: 2024-11-24 16:31:08 - INFO - 标签 - 消息
            const parts = line.split(" - ");
            if (parts.length < 3) {
                // 如果格式不匹配，作为普通信息日志记录
                await TaskLogMain.addLog({
                    taskId: taskId,
                    level: "info",
                    message: line,
                    processName: context.ServerInfo?.name || "模型",
                });
                continue;
            }

            // 提取时间戳、级别、标签和消息
            const timestamp = new Date(parts[0]).getTime();
            const level = (parts[1]?.toLowerCase() || "info") as "info" | "warn" | "error" | "debug";
            const label = parts[2] || "";
            const message = parts.slice(3).join(" - ");

            // 检测是否包含进度信息
            let progress: number | undefined = undefined;
            const progressMatch = line.match(/(\d+)%/);
            if (progressMatch) {
                progress = parseInt(progressMatch[1]);
            }

            // 判断日志级别
            let logLevel: "info" | "warn" | "error" | "debug" = "info";
            if (level === "error" || line.toLowerCase().includes("error") || line.toLowerCase().includes("失败")) {
                logLevel = "error";
            } else if (
                level === "warn" ||
                line.toLowerCase().includes("warning") ||
                line.toLowerCase().includes("警告") ||
                line.includes("FutureWarning") ||
                line.includes("DeprecationWarning") ||
                line.includes("UserWarning") ||
                line.includes("RuntimeWarning")
            ) {
                logLevel = "warn";
            } else if (level === "debug") {
                logLevel = "debug";
            }

            await TaskLogMain.addLog({
                taskId: taskId,
                level: logLevel,
                message: message || label,
                processName: context.ServerInfo?.name || "模型",
                progress: progress,
                timestamp: isNaN(timestamp) ? undefined : timestamp,
            });
        } catch (error) {
            // 解析失败时，将整行作为信息日志记录
            await TaskLogMain.addLog({
                taskId: taskId,
                level: "info",
                message: line,
                processName: context.ServerInfo?.name || "模型",
            });
        }
    }
};

const launcherCancel = async (context: ServerContext) => {
    const ret = (await requestPost(`${context.url()}cancel`, {})) as any;
    // console.log('cancel', JSON.stringify(ret))
    if (ret.code) {
        throw new Error(`cancel ${ret.msg}`);
    }
};

const launcherSubmitAndQuery = async (
    context: ServerContext,
    data: ServerFunctionDataType,
    option?: {
        timeout: number;
    }
): Promise<{
    result: {
        [key: string]: any;
    };
    endTime: number;
}> => {
    option = Object.assign(
        {
            timeout: 24 * 3600,
        },
        option
    );

    // 记录任务开始日志
    await TaskLogMain.addLog({
        taskId: data.id,
        level: "info",
        message: `任务开始执行`,
        processName: context.ServerInfo?.name || "模型",
        progress: 0,
    });

    const submitRet = (await requestPost(`${context.url()}submit`, data)) as any;
    // console.log('submitRet', JSON.stringify(submitRet))
    if (submitRet.code) {
        await TaskLogMain.addLog({
            taskId: data.id,
            level: "error",
            message: `任务提交失败: ${submitRet.msg}`,
            processName: context.ServerInfo?.name || "模型",
        });
        throw new Error(`submit ${submitRet.msg}`);
    }
    const launcherResult = {
        result: {} as {
            [key: string]: any;
        },
        endTime: null,
    };
    const totalWait = Math.ceil(option.timeout / 5);
    for (let i = 0; i < totalWait; i++) {
        if (i >= totalWait - 1) {
            throw new Error("timeout");
        }
        await sleep(5000);
        const queryRet = (await requestPost(
            `${context.url()}query`,
            {
                token: submitRet.data.token,
            },
            {
                retry: 3,
            }
        )) as any;
        // console.log('queryRet', JSON.stringify(queryRet))
        if (queryRet.code) {
            throw new Error(queryRet.msg);
        }
        let logs = queryRet.data.logs;
        if (logs) {
            logs = EncodeUtil.base64Decode(logs);
            if (logs) {
                await Files.appendText(context.ServerInfo.logFile, logs);
                const result = extractResultFromLogs(data.id, logs);
                if (result) {
                    launcherResult.result = Object.assign(launcherResult.result, result);
                    context.send("taskResult", {id: data.id, result});
                }

                // 将日志写入到任务日志数据库
                await parseAndSaveLogsToDatabase(data.id, logs, context);
            }
        }
        if (queryRet.data.status === "running") {
            continue;
        } else if (queryRet.data.status === "success") {
            launcherResult.endTime = Date.now();
            await Files.appendText(context.ServerInfo.logFile, "success");

            // 记录任务成功日志
            await TaskLogMain.addLog({
                taskId: data.id,
                level: "info",
                message: "任务执行成功",
                processName: context.ServerInfo?.name || "模型",
                progress: 100,
            });
        } else {
            let msg = "请在模型日志中查看错误日志";
            if (launcherResult.result && launcherResult.result.msg) {
                msg = launcherResult.result.msg;
            }

            // 记录任务失败日志
            await TaskLogMain.addLog({
                taskId: data.id,
                level: "error",
                message: `任务执行失败: ${msg}`,
                processName: context.ServerInfo?.name || "模型",
            });

            throw `运行错误：${msg}`;
        }
        break;
    }
    return launcherResult;
};


const launcherPrepareConfigJson = async (data: any) => {
    const configJson = await Files.temp("json");
    await Files.write(configJson, JSON.stringify(data), {isDataPath: false});
    return configJson;
};

const launcherSubmitConfigJsonAndQuery = async (context: ServerContext, configData: any) => {
    if (!("setting" in configData)) {
        configData.setting = context.ServerInfo.setting;
    }
    const configJsonPath = await launcherPrepareConfigJson(configData);
    // 使用传统的轮询方式（暂时保持原样）
    const result = await launcherSubmitAndQuery(context, {
        id: configData.id,
        result: {},
        entryPlaceholders: {
            CONFIG: configJsonPath,
        },
        root: context.ServerInfo.localPath,
    });
    await Files.deletes(configJsonPath, {isDataPath: false});
    return result;
};

const extractResultFromLogs = (dataId: string, logs: string) => {
    let result = null;
    logs.split("\n").forEach(line => {
        // 🔧 修复：兼容 AigcPanelRunResult 和 ZhenQianBaRunResult 两种格式
        // 因为模型服务器可能还在使用旧的 AigcPanelRunResult 前缀
        const match = line.match(new RegExp(`(?:ZhenQianBaRunResult|AigcPanelRunResult)\\[${dataId}\\]\\[(.*?)\\]`));
        // console.log('match', {_data, match})
        if (match) {
            const matchResult = JSON.parse(EncodeUtil.base64Decode(match[1]));
            result = Object.assign(result || {}, matchResult);
        }
    });
    return result;
};

const availablePort = async (
    port: number,
    setting: {
        port?: number;
    }
) => {
    setting = setting || {};
    if (port) {
        return port;
    }
    if (setting["port"]) {
        port = parseInt(setting["port"] as any);
    } else if (!port || !(await Apps.isPortAvailable(port))) {
        port = await Apps.availablePort(50617);
    }
    return port;
};

const pathSep = () => {
    return process.platform === "win32" ? ";" : ":";
};

const getPathEnv = (addition: string | string[] = null) => {
    let p = process.env["PATH"] || "";
    if (addition) {
        const sep = pathSep();
        if (typeof addition === "string") {
            addition = [addition];
        }
        for (let path of addition) {
            if (p.indexOf(path) === -1) {
                p = `${path}${sep}${p}`;
            }
        }
    }
    return p;
};

export default {
    GradioClient: Client,
    GradioHandleFile: handle_file,
    event: Events,
    file: Files,
    app: Apps,
    request,
    requestPost,
    requestGet,
    requestPostSuccess,
    requestUrlFileToLocal,
    requestEventSource,
    platformName: platformName(),
    platformArch: platformArch(),
    env,
    sleep,
    base64Encode: EncodeUtil.base64Encode,
    base64Decode: EncodeUtil.base64Decode,
    launcherCancel,
    launcherSubmitAndQuery,
    launcherPrepareConfigJson,
    launcherSubmitConfigJsonAndQuery,
    extractResultFromLogs,
    availablePort,
    getPathEnv,
};
