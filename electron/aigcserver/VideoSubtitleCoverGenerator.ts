import { exec, spawn, type ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import { VideoSubtitleCoverGeneratorModelConfig } from "../../src/types/VideoSubtitleCoverGenerator";
import { getPythonPath } from "../lib/python-util";
import { getPythonScriptPath, getFFmpegExecutablePath, resourceExists } from "../lib/resource-path";
import { Log } from "../mapi/log/main";

const execAsync = promisify(exec);

export class VideoSubtitleCoverGenerator {
    type = "buildIn";
    ServerApi: any;
    ServerInfo: any;
    private currentProcess: ChildProcessWithoutNullStreams | null = null;

    private async stopCurrentProcess() {
        if (!this.currentProcess?.pid) {
            this.currentProcess = null;
            return;
        }

        const currentPid = this.currentProcess.pid;
        const processToStop = this.currentProcess;
        this.currentProcess = null;

        try {
            if (process.platform === "win32") {
                await execAsync(`taskkill /F /PID ${currentPid} /T`);
            } else {
                processToStop.kill("SIGKILL");
            }
        } catch (error: any) {
            Log.warn("VideoSubtitleCoverGenerator", `Failed to stop python process ${currentPid}: ${error.message}`);
        }
    }

    async init() {
        // 初始化
    }

    async start() {
        // 启动服务
        return { code: 0, msg: "VideoSubtitleCoverGenerator服务启动成功" };
    }

    async ping() {
        // 检查服务状态
        return { code: 0, msg: "pong" };
    }

    async stop() {
        await this.stopCurrentProcess();
        return { code: 0, msg: "服务已停止" };
    }

    async cancel() {
        await this.stopCurrentProcess();
        return { code: 0, msg: "任务已取消" };
    }

    async config() {
        // 返回配置信息
        return {
            code: 0,
            config: {
                name: "VideoSubtitleCoverGenerator",
                displayName: "字幕封面生成器",
                description: "一键生成带字幕的视频和封面，支持多种样式模板",
                version: "1.0.0",
                functions: ["VideoSubtitleCoverGenerator"],
                models: []
            }
        };
    }

    async VideoSubtitleCoverGenerator(data: VideoSubtitleCoverGeneratorModelConfig, option: any = {}) {
        try {
            // 创建临时配置文件
            const configPath = path.join(process.cwd(), "temp_config.json");
            const config = {
                modelConfig: data,
                ...option
            };

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            // 调用Python脚本
            // ⚠️ 只使用程序自带的 Python，不依赖系统环境
            const pythonScript = getPythonScriptPath('video_subtitle_cover_generator.py');
            const pythonPath = getPythonPath();

            return new Promise((resolve, reject) => {
                // 🔧 修复：传递APP_ROOT环境变量给Python进程，使其能正确识别打包环境
                const env = Object.assign({}, process.env, {
                    APP_ROOT: process.env.APP_ROOT || process.cwd()
                });

                // 🔧 修复：添加 FFmpeg 目录到 PATH，让 Python 脚本能找到 ffmpeg
                const ffmpegPath = getFFmpegExecutablePath();
                if (resourceExists(ffmpegPath)) {
                    const ffmpegDir = path.dirname(ffmpegPath);
                    const pathSep = process.platform === 'win32' ? ';' : ':';
                    env['PATH'] = ffmpegDir + pathSep + (env['PATH'] || process.env.PATH || '');
                    Log.info('VideoSubtitleCoverGenerator', `Added FFmpeg to PATH: ${ffmpegDir}`);
                }

                const pythonProcess = spawn(pythonPath, [pythonScript, configPath], {
                    cwd: process.env.APP_ROOT || process.cwd(),
                    env: env,
                    stdio: ["pipe", "pipe", "pipe"]
                });
                this.currentProcess = pythonProcess;

                let stdout = "";
                let stderr = "";

                pythonProcess.stdout.on("data", (data) => {
                    stdout += data.toString();
                    console.log("Python stdout:", data.toString());
                });

                pythonProcess.stderr.on("data", (data) => {
                    stderr += data.toString();
                    console.error("Python stderr:", data.toString());
                });

                pythonProcess.on("close", (code) => {
                    if (this.currentProcess?.pid === pythonProcess.pid) {
                        this.currentProcess = null;
                    }

                    // 清理临时文件
                    try {
                        fs.unlinkSync(configPath);
                    } catch (e) {
                        console.warn("清理临时文件失败:", e);
                    }

                    if (code === 0) {
                        try {
                            const result = JSON.parse(stdout);
                            resolve(result);
                        } catch (e) {
                            resolve({
                                code: -1,
                                msg: `解析Python输出失败: ${e}`
                            });
                        }
                    } else {
                        resolve({
                            code: -1,
                            msg: `Python脚本执行失败 (退出码: ${code}): ${stderr}`
                        });
                    }
                });

                pythonProcess.on("error", (error) => {
                    if (this.currentProcess?.pid === pythonProcess.pid) {
                        this.currentProcess = null;
                    }

                    // 清理临时文件
                    try {
                        fs.unlinkSync(configPath);
                    } catch (e) {
                        console.warn("清理临时文件失败:", e);
                    }

                    resolve({
                        code: -1,
                        msg: `启动Python进程失败: ${error.message}`
                    });
                });

                // 设置超时
                setTimeout(() => {
                    this.stopCurrentProcess().catch((error) => {
                        Log.warn("VideoSubtitleCoverGenerator", `Timeout stop failed: ${error}`);
                    });
                    resolve({
                        code: -1,
                        msg: "处理超时"
                    });
                }, 300000); // 5分钟超时
            });

        } catch (error: any) {
            return {
                code: -1,
                msg: `处理失败: ${error.message}`
            };
        }
    }
}
