import { ipcRenderer } from "electron";
import { MAPI } from "../mapi/render";

// Keep this module "touched" in dev so vite-plugin-electron rebuilds preload
// after a broken renderer-only reload removed dist-electron.
MAPI.init();
console.log('[Preload] MAPI.init() completed, window.$mapi =', typeof window['$mapi'], window['$mapi'] ? Object.keys(window['$mapi']).length : 0);

// 🔧 【关键修复】将 ipcRenderer 暴露到 window 全局对象
// 这样 Vue 组件和其他 TypeScript 文件可以通过 (window as any).ipcRenderer 访问
(window as any).ipcRenderer = ipcRenderer;

// 🔐 Electron Store API - 用于持久化存储激活信息和设备指纹
window["electronAPI"] = {
    // 🔧 获取系统信息（用于生成设备指纹）
    getSystemInfo: async () => {
        try {
            return await ipcRenderer.invoke('System:getSystemInfo');
        } catch (error) {
            console.error('[electronAPI] getSystemInfo failed:', error);
            return null;
        }
    },
    // 🔧 获取硬件序列号（用于生成设备指纹）
    getHardwareSerial: async () => {
        try {
            return await ipcRenderer.invoke('System:getHardwareSerial');
        } catch (error) {
            console.error('[electronAPI] getHardwareSerial failed:', error);
            return null;
        }
    },
    store: {
        // 获取激活信息
        getActivation: async () => {
            try {
                return await ipcRenderer.invoke('Store:getActivation');
            } catch (error) {
                console.error('[electronAPI.store] getActivation failed:', error);
                return null;
            }
        },
        // 保存激活信息
        setActivation: async (data: any) => {
            try {
                return await ipcRenderer.invoke('Store:setActivation', data);
            } catch (error) {
                console.error('[electronAPI.store] setActivation failed:', error);
            }
        },
        // 清除激活信息
        clearActivation: async () => {
            try {
                return await ipcRenderer.invoke('Store:clearActivation');
            } catch (error) {
                console.error('[electronAPI.store] clearActivation failed:', error);
            }
        },
        // 获取设备指纹
        getDeviceFingerprint: async () => {
            try {
                return await ipcRenderer.invoke('Store:getDeviceFingerprint');
            } catch (error) {
                console.error('[electronAPI.store] getDeviceFingerprint failed:', error);
                return null;
            }
        },
        // 保存设备指纹
        setDeviceFingerprint: async (fingerprint: string) => {
            try {
                return await ipcRenderer.invoke('Store:setDeviceFingerprint', fingerprint);
            } catch (error) {
                console.error('[electronAPI.store] setDeviceFingerprint failed:', error);
            }
        },
        // 清除设备指纹
        clearDeviceFingerprint: async () => {
            try {
                return await ipcRenderer.invoke('Store:clearDeviceFingerprint');
            } catch (error) {
                console.error('[electronAPI.store] clearDeviceFingerprint failed:', error);
            }
        }
    }
};

window["__page"] = {
    hooks: {},
    onShow: (cb: Function) => {
        window["__page"].hooks.onShow = cb;
    },
    onHide: (cb: Function) => {
        window["__page"].hooks.onHide = cb;
    },
    onMaximize: (cb: Function) => {
        window["__page"].hooks.onMaximize = cb;
    },
    onUnmaximize: (cb: Function) => {
        window["__page"].hooks.onUnmaximize = cb;
    },
    onEnterFullScreen: (cb: Function) => {
        window["__page"].hooks.onEnterFullScreen = cb;
    },
    onLeaveFullScreen: (cb: Function) => {
        window["__page"].hooks.onLeaveFullScreen = cb;
    },
    onShowQuitConfirmDialog: (cb: Function) => {
        window["__page"].hooks.onShowQuitConfirmDialog = cb;
    },
    broadcastListeners: {},
    onBroadcast: (type: string, cb: (data: any) => void) => {
        if (!(type in window["__page"].broadcastListeners)) {
            window["__page"].broadcastListeners[type] = [];
        }
        window["__page"].broadcastListeners[type].push(cb);
    },
    offBroadcast: (type: string, cb: (data: any) => void) => {
        if (!(type in window["__page"].broadcastListeners)) {
            return;
        }
        window["__page"].broadcastListeners[type] = window["__page"].broadcastListeners[type].filter(c => c !== cb);
    },
    callPage: {},
    registerCallPage: (
        name: string,
        cb: (resolve: (data: any) => void, reject: (error: string) => void, data: any) => void
    ) => {
        window["__page"].callPage[name] = cb;
    },
    channel: {},
    createChannel: (cb: (data: any) => void) => {
        const channel = Math.random().toString(36).substring(2);
        window["__page"].channel[channel] = cb;
        return channel;
    },
    destroyChannel: (channel: string) => {
        delete window["__page"].channel[channel];
    },
    ipcSendToHost: (channel: string, type: string, data?: any) => {
        ipcRenderer.sendToHost(channel, {
            type,
            data,
        });
    },
    ipcSend: (channel: string, type: string, data?: any) => {
        ipcRenderer.send(channel, {
            type,
            data,
        });
    },
    ipcInvoke: (channel: string, data?: any) => {
        return ipcRenderer.invoke(channel, data);
    },
    sendSync: (channel: string, data?: any) => {
        return ipcRenderer.invoke(channel, data);
    },
};

ipcRenderer.removeAllListeners("MAIN_PROCESS_MESSAGE");
ipcRenderer.on("MAIN_PROCESS_MESSAGE", (_event: any, payload: any) => {
    if ("APP_READY" === payload.type) {
        MAPI.init(payload.data.AppEnv);
        // 🔧 暴露 APP_ROOT 到全局环境，供渲染进程使用（GPU清理脚本需要）
        window["APP_ROOT"] = payload.data.AppEnv?.appRoot;
        console.log('[Preload] APP_ROOT exposed:', window["APP_ROOT"]);
    } else if ("CALL_PAGE" === payload.type) {
        let { type, data, option } = payload.data;
        option = Object.assign(
            {
                waitReadyTimeout: 10 * 1000,
            },
            option
        );
        // console.log('CALL_PAGE', type, {type, data, option})
        const resultEventName = `event:callPage:${payload.id}`;
        const send = (code: number, msg: string, data?: any) => {
            ipcRenderer.send(resultEventName, { code, msg, data });
        };
        if (!window["__page"].callPage) {
            console.warn("CALL_PAGE.Failed", JSON.stringify(payload));
            send(-1, "error");
            return;
        }
        const callPageExecute = () => {
            try {
                const maybePromise = window["__page"].callPage[type](
                    (resultData: any) => {
                        send(0, "ok", resultData)
                    },
                    (error: string) => {
                        send(-1, error)
                    },
                    data
                );
                if (maybePromise && typeof maybePromise.then === "function") {
                    maybePromise.catch((e: any) => {
                        console.error('CallPage.Error', e);
                        send(-1, "CallPageExecuteError: " + (e?.message || e.toString()));
                    });
                }
            } catch (e) {
                console.error('CallPage.Error', e);
                send(-1, 'CallPageExecuteError: ' + (e?.message || e.toString()));
            }
        };
        if (!window["__page"].callPage[type]) {
            if (option.waitReadyTimeout > 0) {
                const start = Date.now();
                const monitor = () => {
                    setTimeout(() => {
                        if (!window["__page"].callPage[type]) {
                            if (Date.now() - start > option.waitReadyTimeout) {
                                console.warn("CALL_PAGE.Timeout", type, { type, data, option });
                                send(-1, "timeout");
                                return;
                            } else {
                                monitor();
                                return;
                            }
                        } else {
                            callPageExecute();
                        }
                    }, 10);
                };
                monitor();
                return;
            }
            console.warn("CALL_PAGE.NotFound", type, { type, data, option });
            send(-1, "event not found");
            return;
        }
        callPageExecute();
    } else if ("CHANNEL" === payload.type) {
        const { channel, data } = payload.data;
        if (!window["__page"].channel || !window["__page"].channel[channel]) {
            return;
        }
        window["__page"].channel[channel](data);
    } else if ("BROADCAST" === payload.type) {
        const { type, data } = payload.data;
        if (window["__page"].broadcastListeners[type]) {
            window["__page"].broadcastListeners[type].forEach((cb: Function) => {
                cb(data);
            });
        }
    } else {
        console.warn("UnknownMainProcessMessage", JSON.stringify(payload));
    }
});
