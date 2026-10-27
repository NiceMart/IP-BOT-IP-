import {BrowserWindow, ipcMain} from "electron";
import {preloadDefault, rendererLoadPath} from "../lib/env-main";
import {Page} from "./index";
import {AppConfig} from "../../src/config";
import {icnsLogoPath, icoLogoPath, logoPath} from "../config/icon";
import {isPackaged} from "../lib/env";
import {WindowConfig} from "../config/window";
import * as remoteMain from "@electron/remote/main";
import {DevToolsManager} from "../lib/devtools";

export const PageAgentLogin = {
    NAME: "agentLogin",
    event: {
        onGetQRCode: null,
        onCheckStatus: null,
        onClose: null,
    },
    open: async (option: {
        region: string;
        onGetQRCode: (region: string) => Promise<{
            loginUrl: string;
            expireSeconds: number;
        }>;
        onCheckStatus: (region: string) => Promise<{
            status: "WaitScan" | "Scanned" | "LoggedIn" | "Expired" | "Error";
            userInfo?: any;
        }>;
        onClose: () => void;
        parent?: BrowserWindow;
    }): Promise<{
        close: () => void;
    }> => {
        PageAgentLogin.event.onGetQRCode = option.onGetQRCode;
        PageAgentLogin.event.onCheckStatus = option.onCheckStatus;
        PageAgentLogin.event.onClose = option.onClose;

        let icon = logoPath;
        if (process.platform === "win32") {
            icon = icoLogoPath;
        } else if (process.platform === "darwin") {
            icon = icnsLogoPath;
        }

        let parent = option.parent || null;
        let alwaysOnTop = !parent;

        const win = new BrowserWindow({
            show: true,
            title: `${AppConfig.title} - 智能体登录`,
            ...(!isPackaged ? {icon} : {}),
            frame: false,
            transparent: false,
            hasShadow: true,
            center: true,
            useContentSize: true,
            minWidth: 500,
            minHeight: 650,
            width: 500,
            height: 650,
            skipTaskbar: true,
            resizable: false,
            maximizable: false,
            backgroundColor: "#f1f5f9",
            focusable: true,
            parent,
            alwaysOnTop,
            webPreferences: {
                preload: preloadDefault,
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                contextIsolation: false,
            },
        });

        win.on("closed", () => {
            Page.unregisterWindow(PageAgentLogin.NAME);
            PageAgentLogin.event.onClose();
        });

        let currentRegion = option.region;

        // 传递region参数到渲染进程
        win.webContents.once("did-finish-load", () => {
            win.webContents.send("AgentLogin.Init", { region: currentRegion });
            Page.ready("agentLogin");
            DevToolsManager.autoShow(win);
            win.focus();
        });

        rendererLoadPath(win, "page/agentLogin.html");
        remoteMain.enable(win.webContents);
        DevToolsManager.register("AgentLogin", win);
        Page.registerWindow(PageAgentLogin.NAME, win);

        return {
            close: () => {
                win.close();
            },
        };
    },
};

ipcMain.handle("AgentLogin.Event", async (event, type: "getQRCode" | "checkStatus", param: any) => {
    switch (type) {
        case "getQRCode":
            return await PageAgentLogin.event.onGetQRCode(param.region);
        case "checkStatus":
            return await PageAgentLogin.event.onCheckStatus(param.region);
    }
});
