<script setup lang="ts">
// @ts-nocheck
import {onBeforeUnmount, onMounted, ref, watch, computed} from "vue";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {FileUtil} from "../../lib/file";

const videoContainer = ref<HTMLDivElement | undefined>(undefined);

const props = withDefaults(
    defineProps<{
        url?: string;
        width?: string;
        height?: string;
        autoplay?: boolean;
        autoplayMuted?: boolean;
        loop?: boolean;
        controls?: boolean;
        showOpenFolder?: boolean;
        hidePlayButton?: boolean;
        preload?: 'auto' | 'metadata' | 'none';
        playbackRate?: number;
        showPerformance?: boolean;
    }>(),
    {
        url: "",
        width: "100%",
        height: "100%",
        autoplay: false,
        autoplayMuted: false,
        loop: false,
        controls: true,
        showOpenFolder: true,
        hidePlayButton: false,
        preload: 'metadata',  // 默认只预加载元数据（性能优化：避免同时加载多个视频）
        playbackRate: 1.0,  // 默认正常速度
        showPerformance: false,  // 默认不显示性能指标
    }
);

let player: Player | null = null;
const isPlaying = ref(false);  // 视频是否正在播放
const fps = ref(0);  // 当前帧率
const droppedFrames = ref(0);  // 丢帧数
let performanceMonitor: any = null;  // 性能监控定时器

const initPlayer = () => {
    if (player) {
        player.destroy();
        player = null;
    }
    isPlaying.value = false;  // 重置播放状态

    // 重置性能数据
    fps.value = 0;
    droppedFrames.value = 0;

    if (videoContainer.value && props.url) {
        console.log('[VideoPlayer] 初始化播放器, showPerformance:', props.showPerformance);
        let url = props.url
        if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('file:')) {
            // do nothing
        } else {
            url = 'file://' + url;
        }
        player = new Player({
            el: videoContainer.value,
            url: url,
            width: props.width,
            height: props.height,
            autoplay: props.autoplay,
            muted: props.autoplayMuted,
            loop: props.loop,
            controls: props.controls,
            volume: 1.0,
            playbackRate: props.playbackRate,
            playsinline: true,
            videoInit: true,
            minWaitDelay: 100,
            fluid: false,
            // 保持播放器容器尺寸固定，避免竖屏视频在不同预览容器里被二次裁切。
            fitVideoSize: 'fixWidth',
            videoFillMode: 'contain',
            cssFullscreen: true,
        });

        // 监听播放事件
        if (player) {
            player.on('play', () => {
                isPlaying.value = true;
            });
            player.on('pause', () => {
                isPlaying.value = false;
            });
            player.on('ended', () => {
                isPlaying.value = false;
            });
        }

        // 延迟获取 video 元素，确保 xgplayer 已经创建完成
        setTimeout(() => {
            const videoElement = videoContainer.value?.querySelector('video') as HTMLVideoElement;

            if (!videoElement) {
                console.error('[VideoPlayer] 未找到 video 元素');
                return;
            }

            console.log('[VideoPlayer] 找到 video 元素:', videoElement);

            // CSS 硬件加速
            videoElement.style.transform = 'translateZ(0)';
            videoElement.style.willChange = 'transform';

            // 启用硬件解码（关键优化）
            videoElement.setAttribute('disablePictureInPicture', 'false');

            // 强制启用硬件加速渲染
            (videoElement as any).preservesPitch = false;  // 禁用音高保持，减少计算

            // 根据props设置预加载策略（关键性能优化）
            videoElement.preload = props.preload;
            console.log(`[VideoPlayer] 预加载策略: ${props.preload}`);

            // 性能监控（如果启用）
            if (props.showPerformance) {
                console.log('[VideoPlayer] 启用性能监控');
                startPerformanceMonitor(videoElement);
            }
        }, 100);  // 延迟 100ms 确保 xgplayer 已经创建 video 元素
    }
};

// 启动性能监控
const startPerformanceMonitor = (videoElement: HTMLVideoElement) => {
    if (performanceMonitor) {
        clearInterval(performanceMonitor);
    }

    console.log('[VideoPlayer] 性能监控已启动');

    let lastDecodedFrames = 0;
    let lastDroppedFrames = 0;
    let lastTime = performance.now();

    performanceMonitor = setInterval(() => {
        // 不管是否播放，都显示数据

        // 获取视频质量指标
        const quality = (videoElement as any).getVideoPlaybackQuality?.();

        if (!quality) {
            // 如果 API 不支持，尝试其他方法
            console.warn('[VideoPlayer] getVideoPlaybackQuality 不支持，使用估算');
            // 使用视频帧率估算
            const videoFps = 30;  // 假设 30fps
            fps.value = isPlaying.value ? videoFps : 0;
            droppedFrames.value = 0;
            return;
        }

        const now = performance.now();
        const timeDiff = (now - lastTime) / 1000;  // 秒

        // 计算帧率
        const decodedDiff = quality.totalVideoFrames - lastDecodedFrames;
        fps.value = timeDiff > 0 ? Math.round(decodedDiff / timeDiff) : 0;

        // 计算丢帧
        const droppedDiff = quality.droppedVideoFrames - lastDroppedFrames;
        droppedFrames.value = quality.droppedVideoFrames;

        console.log(`[VideoPlayer] FPS: ${fps.value}, 总帧数: ${quality.totalVideoFrames}, 丢帧: ${droppedFrames.value}`);

        // 如果丢帧严重，输出警告
        if (droppedDiff > 5) {
            console.warn(`[VideoPlayer] 性能警告: ${droppedDiff} 帧在过去 ${timeDiff.toFixed(1)}s 内丢失`);
        }

        lastDecodedFrames = quality.totalVideoFrames;
        lastDroppedFrames = quality.droppedVideoFrames;
        lastTime = now;
    }, 1000);  // 每秒更新一次
};

// 获取视频文件路径（去除 file:// 前缀）
const videoPath = computed(() => {
    if (!props.url) return "";
    let path = props.url;
    if (path.startsWith('file://')) {
        path = path.replace('file://', '');
    }
    return path;
});

const openFileFolder = async () => {
    if (!videoPath.value) {
        Dialog.tipError(t("视频路径为空"));
        return;
    }
    try {
        await window.$mapi.shell.showItemInFolder(videoPath.value);
    } catch (e: any) {
        Dialog.tipError(t("打开文件夹失败") + ": " + (e?.message || e));
    }
};

const downloadVideo = async () => {
    if (!videoPath.value) {
        Dialog.tipError(t("视频路径为空"));
        return;
    }
    try {
        const path = videoPath.value;
        const fileName = path.split(/[/\\]/).pop() || 'video.mp4';
        const savePath = await window.$mapi?.file?.openSave({
            defaultPath: fileName,
            filters: [{ name: '视频文件', extensions: [fileName.split('.').pop() || 'mp4'] }]
        });
        if (savePath) {
            await window.$mapi?.file?.copy(path, savePath, { isDataPath: false });
            Dialog.tipSuccess(t("下载成功"));
        }
    } catch (e: any) {
        Dialog.tipError(t("下载视频失败") + ": " + (e?.message || e));
    }
};

// 下载到手机相关
const showPhoneDialog = ref(false);
const phoneQrUrl = ref('');
const phoneShareUrl = ref('');

const downloadToPhone = async () => {
    if (!videoPath.value) {
        Dialog.tipError(t("视频路径为空"));
        return;
    }
    try {
        const result = await window.$mapi?.file?.shareStart(videoPath.value);
        if (result) {
            phoneShareUrl.value = result.url;
            // 动态导入 qrcode，避免静态导入导致组件加载失败
            const QRCode = (await import("qrcode")).default;
            phoneQrUrl.value = await QRCode.toDataURL(result.url, {
                width: 256,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
            showPhoneDialog.value = true;
        }
    } catch (e: any) {
        Dialog.tipError(t("启动共享失败") + ": " + (e?.message || e));
    }
};

const closePhoneDialog = () => {
    showPhoneDialog.value = false;
    if (videoPath.value) {
        window.$mapi?.file?.shareStop(videoPath.value).catch(() => {});
    }
};

watch(
    () => props.url,
    newUrl => {
        initPlayer();
    }
);

onMounted(() => {
    initPlayer();
});

onBeforeUnmount(() => {
    console.log(`[VideoPlayer] 🔧 组件卸载，销毁播放器: ${props.url?.substring(props.url.length - 30)}`);
    // 关闭临时共享服务器
    if (videoPath.value) {
        window.$mapi?.file?.shareStop(videoPath.value).catch(() => {});
    }
    if (player) {
        player.destroy();
        player = null;
        console.log('[VideoPlayer] ✓ xgplayer实例已销毁');
    }
    if (performanceMonitor) {
        clearInterval(performanceMonitor);
        performanceMonitor = null;
        console.log('[VideoPlayer] ✓ 性能监控器已清理');
    }
});
</script>

<template>
    <div class="video-player-wrapper" :class="{ 'video-playing': isPlaying }">
        <div ref="videoContainer" class="w-full h-full"></div>
        <div v-if="showOpenFolder && videoPath"
             class="absolute top-2 right-2 z-10 flex flex-col gap-2">
            <a-tooltip :content="$t('打开文件位置')" mini>
                <a-button
                    size="small"
                    shape="circle"
                    @click="openFileFolder"
                    class="video-action-btn">
                    <template #icon>
                        <icon-folder style="font-size: 14px;" />
                    </template>
                </a-button>
            </a-tooltip>
            <a-tooltip :content="$t('下载视频')" mini>
                <a-button
                    size="small"
                    shape="circle"
                    @click="downloadVideo"
                    class="video-action-btn">
                    <template #icon>
                        <icon-download style="font-size: 14px;" />
                    </template>
                </a-button>
            </a-tooltip>
            <a-tooltip :content="$t('下载到手机')" mini>
                <a-button
                    size="small"
                    shape="circle"
                    @click="downloadToPhone"
                    class="video-action-btn">
                    <template #icon>
                        <icon-mobile style="font-size: 14px;" />
                    </template>
                </a-button>
            </a-tooltip>
        </div>

        <!-- 下载到手机 - 二维码弹窗 -->
        <a-modal
            v-model:visible="showPhoneDialog"
            :title="$t('下载到手机')"
            :footer="false"
            :mask-closable="true"
            @close="closePhoneDialog"
        >
            <div class="flex flex-col items-center py-4">
                <p class="text-sm text-gray-500 mb-4">请用手机扫描下方二维码下载视频</p>
                <img v-if="phoneQrUrl" :src="phoneQrUrl" alt="下载二维码" class="rounded-lg" style="width: 200px; height: 200px;" />
                <p class="text-xs text-gray-400 mt-4 break-all text-center max-w-[300px]">{{ phoneShareUrl }}</p>
                <p class="text-xs text-gray-400 mt-1">确保手机和电脑在同一局域网下</p>
                <p class="text-xs text-gray-400 mt-3 px-2 py-2 bg-gray-700 bg-opacity-50 rounded-lg">微信扫码后点击右上角<span class="text-white">···</span> → <span class="text-white">在浏览器打开</span> → 即可播放/保存视频</p>
                <a-button type="primary" size="small" class="mt-4" @click="closePhoneDialog">{{ $t('关闭') }}</a-button>
            </div>
        </a-modal>

        <!-- 性能指标显示 - 始终显示（如果启用） -->
        <div v-if="showPerformance"
             class="absolute top-2 left-2 z-50 bg-black bg-opacity-90 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-mono border border-gray-600">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-gray-400">FPS:</span>
                <span class="text-green-400 font-bold text-lg">{{ fps || '0' }}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-gray-400">丢帧:</span>
                <span :class="{
                    'text-green-400': droppedFrames === 0,
                    'text-yellow-400': droppedFrames > 0 && droppedFrames <= 10,
                    'text-red-400': droppedFrames > 10
                }" class="font-bold text-lg">{{ droppedFrames || '0' }}</span>
            </div>
            <div class="text-xs text-gray-500 mt-2">
                {{ isPlaying ? '播放中' : '暂停' }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.video-player-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
}

.video-action-btn {
    width: 28px !important;
    height: 28px !important;
    background: rgba(0, 0, 0, 0.5) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
}

.video-action-btn:hover {
    background: rgba(0, 0, 0, 0.75) !important;
    border-color: rgba(255, 255, 255, 0.4) !important;
    transform: scale(1.1);
}

/* 浅色主题下视频播放器按钮样式 */
body[data-theme="soft-light"] .video-action-btn {
    background: rgba(255, 255, 255, 0.85) !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: #334155 !important;
}

body[data-theme="soft-light"] .video-action-btn:hover {
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: rgba(0, 0, 0, 0.25) !important;
    color: #1e293b !important;
}

/* cssfullscreen 限制在父板块框内放大，而非全页面 */
:deep(.xgplayer-is-cssfullscreen) {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 50 !important;
}

/* 将 xgplayer 背景设为深灰色，与IP智能体页面风格一致 */
:deep(.xgplayer) {
    background: #141414 !important;
    width: 100% !important;
    height: 100% !important;
    position: relative !important;
}
:deep(.xgplayer .xg-video-container) {
    width: 100% !important;
    height: 100% !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    overflow: hidden !important;
}
:deep(.xgplayer video) {
    background: #141414 !important;
    object-fit: contain !important;
    object-position: center center !important;
    width: 100% !important;
    height: 100% !important;
}
:deep(.xgplayer .xg-controls) {
    width: 100% !important;
}

/* 播放时隐藏中心的大播放按钮 */
.video-playing :deep(.xgplayer-start) {
    display: none !important;
}

/* tooltip 确保深色背景，不受主题影响 */
:deep(.arco-tooltip-content) {
    background-color: rgba(0, 0, 0, 0.75) !important;
}
:deep(.arco-tooltip-popup-arrow) {
    background-color: rgba(0, 0, 0, 0.75) !important;
}
</style>
