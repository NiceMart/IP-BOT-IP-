import { autoUpdater, UpdateInfo } from "electron-updater";
import { BrowserWindow } from "electron";
import { fetchElectronSystemConfig } from "../systemConfig";
import path from "node:path";
import fs from "node:fs";
import Log from "../log/main";
import { checkResourceBundles, setResourceStatusListener } from "../resourceManager";
import { ProcessCleanupManager } from "../../lib/process-cleanup";
import { isDevelopment } from "../../lib/resource-path";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableDifferentialDownload = false;
(autoUpdater as any).logger = {
    info: (...args: any[]) => Log.info("[UpdaterCore]", args),
    warn: (...args: any[]) => Log.warn("[UpdaterCore]", args),
    error: (...args: any[]) => Log.error("[UpdaterCore]", args),
    debug: (...args: any[]) => Log.debug("[UpdaterCore]", args),
};

let updaterWindow: BrowserWindow | null = null;
let downloadedSetupPath: string | null = null;
let latestUpdaterStatus: any = null;

export function setUpdaterWindow(win: BrowserWindow) {
    updaterWindow = win;
}

function sendToRenderer(channel: string, ...args: any[]) {
    if (channel === "updater:status" && args.length > 0) {
        latestUpdaterStatus = args[0];
    }
    if (updaterWindow && !updaterWindow.isDestroyed()) {
        updaterWindow.webContents.send(channel, ...args);
    }
}

const getLatestStatus = () => latestUpdaterStatus;

setResourceStatusListener((data) => {
    sendToRenderer("updater:status", data);
});

async function ensureUpdateFeedURL() {
    try {
        const config = await fetchElectronSystemConfig();
        if (config.update_url) {
            autoUpdater.setFeedURL({ provider: "generic", url: config.update_url });
            Log.info("[Updater] feedURL set:", config.update_url);
        }
    } catch (e: any) {
        Log.error("[Updater] setFeedURL failed:", e.message);
    }
}

autoUpdater.on("checking-for-update", () => {
    Log.info("[Updater] checking for update...");
    sendToRenderer("updater:status", { status: "checking" });
});

autoUpdater.on("update-available", (info: UpdateInfo) => {
    Log.info("[Updater] update available:", {
        version: info.version,
        files: info.files?.map(file => file.url) || [],
    });
    sendToRenderer("updater:status", {
        status: "available",
        version: info.version,
        releaseNotes: info.releaseNotes,
        fileSize: info.files?.[0]?.size || 0,
    });
});

autoUpdater.on("update-not-available", () => {
    Log.info("[Updater] no update available");
    sendToRenderer("updater:status", { status: "not-available" });
});

autoUpdater.on("download-progress", (progress) => {
    sendToRenderer("updater:status", {
        status: "downloading",
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
    });
});

autoUpdater.on("update-downloaded", () => {
    try {
        const helper = (autoUpdater as any).downloadedUpdateHelper;
        if (helper?.cacheDir) {
            const pendingDir = helper.cacheDirForPendingUpdate || path.join(helper.cacheDir, "pending");
            const pendingInstallerPath = (() => {
                try {
                    if (!fs.existsSync(pendingDir)) {
                        return null;
                    }
                    const pendingFiles = fs.readdirSync(pendingDir).filter((f: string) => f.endsWith(".exe")).sort();
                    if (pendingFiles.length > 0) {
                        return path.join(pendingDir, pendingFiles[pendingFiles.length - 1]);
                    }
                } catch (error: any) {
                    Log.warn("[Updater] read pending installer failed:", error?.message || error);
                }
                return null;
            })();

            if (pendingInstallerPath && fs.existsSync(pendingInstallerPath)) {
                downloadedSetupPath = pendingInstallerPath;
            } else {
                const files = fs.readdirSync(helper.cacheDir).filter((f: string) => f.endsWith(".exe")).sort();
                if (files.length > 0) {
                    downloadedSetupPath = path.join(helper.cacheDir, files[files.length - 1]);
                }
            }

            // Keep a stable old installer cache so the next update can reuse it
            // for differential download instead of falling back to a full package.
            if (downloadedSetupPath && fs.existsSync(downloadedSetupPath)) {
                const canonicalInstallerPath = path.join(helper.cacheDir, "installer.exe");
                if (path.resolve(downloadedSetupPath) !== path.resolve(canonicalInstallerPath)) {
                    fs.copyFileSync(downloadedSetupPath, canonicalInstallerPath);
                    Log.info("[Updater] cached canonical installer for future differential download:", canonicalInstallerPath);
                }
            }
        }
        Log.info("[Updater] downloaded, setup path:", downloadedSetupPath);
    } catch (e: any) {
        Log.error("[Updater] find downloaded exe failed:", e.message);
    }
    sendToRenderer("updater:status", { status: "downloaded" });
});

autoUpdater.on("error", (error) => {
    Log.error("[Updater] error:", error?.message || error);
    sendToRenderer("updater:status", { status: "error", message: error?.message || "Unknown error" });
});

const checkForUpdate = async () => {
    try {
        if (!isDevelopment()) {
            await ensureUpdateFeedURL();
            sendToRenderer("updater:status", { status: "resource-checking" });
            const resourceCheck = await checkResourceBundles({ installMissing: false });
            sendToRenderer("updater:status", {
                status: "resource-check-complete",
                pending: resourceCheck.pending,
                missingRequired: resourceCheck.missingRequired,
                installed: resourceCheck.installed,
            });
            await autoUpdater.checkForUpdates();
        }
        return { code: 0, msg: "success" };
    } catch (e: any) {
        Log.error("[Updater] checkForUpdate failed:", e.message);
        return { code: -1, msg: `Failed to check update: ${e.message}` };
    }
};

const downloadUpdate = async () => {
    try {
        const result = await autoUpdater.downloadUpdate();
        Log.info("[Updater] download result:", JSON.stringify(result));
        return { code: 0, msg: "success" };
    } catch (e: any) {
        Log.error("[Updater] downloadUpdate failed:", e.message);
        return { code: -1, msg: `Failed to download update: ${e.message}` };
    }
};

const quitAndInstall = async () => {
    try {
        Log.info("[Updater] Starting quitAndInstall process...");
        (global as any).__isUpdating = true;
        Log.info("[Updater] Set isUpdating flag");

        Log.info("[Updater] Cleaning up child processes (attempt 1)...");
        await ProcessCleanupManager.cleanupAllProcesses();

        Log.info("[Updater] Cleaning up child processes (attempt 2)...");
        await ProcessCleanupManager.cleanupAllProcesses();

        Log.info("[Updater] Child processes cleaned up");
        await new Promise(resolve => setTimeout(resolve, 2000));

        Log.info("[Updater] Starting update installation...", {
            downloadedSetupPath,
            differentialDownloadDisabled: autoUpdater.disableDifferentialDownload,
        });
        autoUpdater.quitAndInstall(false, true);

        return { code: 0, msg: "success" };
    } catch (e: any) {
        Log.error("[Updater] quitAndInstall failed:", e.message);
        return { code: -1, msg: `Failed to quit and install: ${e.message}` };
    }
};

export default {
    checkForUpdate,
    downloadUpdate,
    quitAndInstall,
    getLatestStatus,
};
