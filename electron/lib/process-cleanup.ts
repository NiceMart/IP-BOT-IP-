import { exec } from "child_process";
import { promisify } from "util";
import path from "node:path";
import Log from "../mapi/log/main";
import { getRuntimeBundleRoot, getRuntimeRoot, isDevelopment } from "./resource-path";

const execAsync = promisify(exec);

export class ProcessCleanupManager {
    private static childProcesses: Set<number> = new Set();

    static registerChildProcess(pid: number) {
        this.childProcesses.add(pid);
        Log.info(`[ProcessCleanup] Registered child process: ${pid}`);
    }

    static unregisterChildProcess(pid: number) {
        this.childProcesses.delete(pid);
        Log.info(`[ProcessCleanup] Unregistered child process: ${pid}`);
    }

    static getChildProcesses(): number[] {
        return Array.from(this.childProcesses);
    }

    private static async killProcess(pid: number): Promise<boolean> {
        try {
            if (process.platform === "win32") {
                await execAsync(`taskkill /F /PID ${pid} /T`);
            } else {
                await execAsync(`kill -9 ${pid}`);
            }
            Log.info(`[ProcessCleanup] Killed process: ${pid}`);
            return true;
        } catch (error: any) {
            Log.error(`[ProcessCleanup] Failed to kill process ${pid}:`, error.message);
            return false;
        }
    }

    private static escapePowerShellString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private static getCleanupRoots(): string[] {
        const roots = new Set<string>();
        const candidates = [
            path.dirname(process.execPath),
            getRuntimeRoot(),
            getRuntimeBundleRoot(),
        ];

        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }

            try {
                roots.add(path.resolve(candidate));
            } catch {
            }
        }

        return Array.from(roots);
    }

    private static async killProcessesUnderAppRoots(): Promise<number> {
        if (process.platform !== "win32" || isDevelopment()) {
            return 0;
        }

        const roots = this.getCleanupRoots();
        if (roots.length === 0) {
            return 0;
        }

        const rootList = roots.map(root => `'${this.escapePowerShellString(root)}'`).join(", ");
        const command =
            `powershell -NoProfile -ExecutionPolicy Bypass -Command ` +
            `"$roots = @(${rootList}); ` +
            `$roots = $roots | Where-Object { $_ } | ForEach-Object { [System.IO.Path]::GetFullPath($_) }; ` +
            `Get-Process -ErrorAction SilentlyContinue | ` +
            `Where-Object { $_.Id -ne ${process.pid} -and $_.Path } | ` +
            `Where-Object { ` +
            `try { ` +
            `$path = [System.IO.Path]::GetFullPath($_.Path); ` +
            `foreach ($root in $roots) { ` +
            `if ($path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $true } ` +
            `}; ` +
            `$false ` +
            `} catch { $false } ` +
            `} | ` +
            `ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction Stop; Write-Output $_.Id } catch {} }"`;

        try {
            const { stdout } = await execAsync(command);
            const count = stdout
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean).length;
            if (count > 0) {
                Log.info("[ProcessCleanup] Killed app-owned processes under install roots", { count, roots });
            }
            return count;
        } catch {
            return 0;
        }
    }

    static async cleanupAllProcesses(): Promise<boolean> {
        Log.info("[ProcessCleanup] Starting cleanup...");

        const registeredPids = this.getChildProcesses();
        for (const pid of registeredPids) {
            await this.killProcess(pid);
            this.unregisterChildProcess(pid);
        }

        await this.killProcessesUnderAppRoots();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.killProcessesUnderAppRoots();
        await new Promise(resolve => setTimeout(resolve, 1000));

        Log.info("[ProcessCleanup] Cleanup completed");
        return true;
    }

    static getRunningTaskCount(): number {
        return this.childProcesses.size;
    }
}
