import { nextTick } from "vue";
import type { TaskBiz } from "../service/TaskService";
import { SoundReplace, SoundReplaceCleaner } from "../pages/Apps/SoundReplace/task";
import { VideoGenFlow } from "../pages/Apps/VideoGenFlow/task";
import { TaskService } from "../service/TaskService";
import { useServerStore } from "../store/modules/server";
import { useTaskStore } from "../store/modules/task";
import { SoundAsr } from "./SoundAsr";
import { SoundGenerate } from "./SoundGenerate";
import { VideoGen } from "./VideoGen";
import { VideoSubtitle } from "./VideoSubtitle";
import { VideoPublish } from "./VideoPublish";
import { SubtitleTts, SubtitleTtsCleaner } from "../pages/Apps/SubtitleTts/task";
import { LongTextTts, LongTextTtsCleaner } from "../pages/Apps/LongTextTts/task";
import { TextToImage, TextToImageCleaner } from "../pages/Apps/TextToImage/task";
import { ImageToImage, ImageToImageCleaner } from "../pages/Apps/ImageToImage/task";
import { VideoMixCut } from "./VideoMixCut";

const taskStore = useTaskStore();
const serverStore = useServerStore();

export const tasks: Record<string, any> = {
    // basics
    SoundGenerate,
    SoundAsr,
    VideoGen,
    VideoSubtitle,
    VideoPublish,
    // sound apps
    LongTextTts,
    SubtitleTts,
    SoundReplace,
    // video apps
    VideoGenFlow,
    TextToImage,
    ImageToImage,
    // video editing
    VideoMixCut,
};

export const taskCleaners: Record<string, any> = {
    // sound cleaners
    LongTextTts: LongTextTtsCleaner,
    SubtitleTts: SubtitleTtsCleaner,
    SoundReplace: SoundReplaceCleaner,
    // video cleaners
    TextToImage: TextToImageCleaner,
    ImageToImage: ImageToImageCleaner,
};

export const TaskManager = {
    init() {
        console.log('[TaskManager.init] 开始初始化,准备注册任务...');
        console.log('[TaskManager.init] 可用任务列表:', Object.keys(tasks));

        for (const k in tasks) {
            taskStore.register(k, tasks[k]);
            console.log(`[TaskManager.init] ✅ 已注册任务: ${k}`);
        }

        console.log('[TaskManager.init] 所有任务注册完成');

        nextTick(async () => {
            await serverStore.waitReady();
            // Removed automatic task restoration on startup - tasks must be started manually
            // for (const k in tasks) {
            //     await TaskService.restoreForTask(k as any);
            // }
            for (const k in taskCleaners) {
                TaskService.registerCleaner(k as any, taskCleaners[k]);
            }
        }).then();
    },
    count() {
        return taskStore.records.length;
    },
};
