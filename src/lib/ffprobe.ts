export const ffprobeGetMediaDuration = async (media: string, ms: boolean = false): Promise<number> => {
    const info = await $mapi.app.spawnBinary("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        media,
    ]);
    const duration = parseFloat(info.trim());
    if (isNaN(duration)) {
        throw "Could not retrieve media duration";
    }
    return ms ? Math.ceil(duration * 1000) : duration;
};

export const ffprobeVideoInfo = async (
    video: string
): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
}> => {
    let handlerResult = null;

    // 尝试方法1：后端 IPC handler
    try {
        console.log('[ffprobeVideoInfo] 调用后端 ffprobeVideoInfo handler...');

        // 🔧 使用 window.ipcRenderer 代替 require('electron')
        if (typeof (window as any).ipcRenderer !== 'undefined') {
            const ipcRenderer = (window as any).ipcRenderer;
            handlerResult = await ipcRenderer.invoke('app:ffprobeVideoInfo', video);
            console.log('[ffprobeVideoInfo] ✅ 后端返回视频信息:', handlerResult);

            // 🔧 修复：如果后端 handler 返回了有效的 duration，直接返回
            if (handlerResult && handlerResult.duration && handlerResult.duration > 0) {
                return handlerResult;
            }

            // 如果后端 handler 返回了但 duration 无效，标记以继续降级
            console.warn('[ffprobeVideoInfo] ⚠️ 后端 handler 未返回有效的 duration');
        } else {
            console.warn('[ffprobeVideoInfo] ⚠️ ipcRenderer 不可用，跳过 handler 方法');
        }
    } catch (handlerError) {
        // 如果后端 handler 失败，继续降级
        console.warn('[ffprobeVideoInfo] ❌ 后端 handler 失败，将尝试降级方法:', handlerError);
    }

    // 尝试方法2：调用 ffprobe 命令行工具（降级方案）
    try {
        console.log('[ffprobeVideoInfo] 使用 ffprobe 命令行工具...');

        const info = await $mapi.app.spawnBinary("ffprobe", [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            video,
        ]);

        const lines = info
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length < 4) {
            throw new Error("Could not retrieve video info");
        }

        const width = parseInt(lines[0], 10);
        const height = parseInt(lines[1], 10);
        const fpsParts = lines[2].split("/");
        const fps = fpsParts.length === 2 ? parseFloat(fpsParts[0]) / parseFloat(fpsParts[1]) : parseFloat(lines[2]);
        const duration = parseFloat(lines[3]);

        if (isNaN(width) || isNaN(height) || isNaN(fps) || isNaN(duration)) {
            throw new Error("Invalid video info data");
        }

        console.log('[ffprobeVideoInfo] ✅ 通过 ffprobe 命令获取到视频信息:', {width, height, fps, duration});

        return {duration, width, height, fps};
    } catch (fallbackError) {
        console.error('[ffprobeVideoInfo] ❌ ffprobe 降级方法也失败:', fallbackError);
        throw new Error(`无法获取视频信息: ${(fallbackError as any).message || fallbackError}`);
    }
};

export const ffprobeAudioInfo = async (audio: string): Promise<{
    duration: number;
    sampleRate: number;
    channels: number;
}> => {
    const info = await $mapi.app.spawnBinary("ffprobe", [
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels,duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio,
    ]);
    const lines = info.split("\n").map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 3) {
        throw "Could not retrieve audio info";
    }
    const sampleRate = parseInt(lines[0], 10);
    const channels = parseInt(lines[1], 10);
    const duration = parseFloat(lines[2]);
    if (isNaN(sampleRate) || isNaN(channels) || isNaN(duration)) {
        throw "Invalid audio info data";
    }
    return {duration, sampleRate, channels};
}
