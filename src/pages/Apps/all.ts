import {defineAsyncComponent} from "vue";
import { t } from "../../lang";

// 🔧 性能优化：使用异步导入减少首屏加载时间
// 声音相关组件 - 懒加载
const LongTextTts = defineAsyncComponent(() => import("./LongTextTts/LongTextTts.vue"));
const SubtitleTts = defineAsyncComponent(() => import("./SubtitleTts/SubtitleTts.vue"));
const SoundReplace = defineAsyncComponent(() => import("./SoundReplace/SoundReplace.vue"));

// 视频相关组件 - 懒加载
const VideoGenFlow = defineAsyncComponent(() => import("./VideoGenFlow/VideoGenFlow.vue"));

// 图片相关组件 - 懒加载
const TextToImage = defineAsyncComponent(() => import("./TextToImage/TextToImage.vue"));
const ImageToImage = defineAsyncComponent(() => import("./ImageToImage/ImageToImage.vue"));

// 图标静态导入（图标较小，同步加载即可）
import LongTextTtsIcon from "./LongTextTts/assets/icon.svg";
import SubtitleTtsIcon from "./SubtitleTts/assets/icon.svg";
import SoundReplaceIcon from "./SoundReplace/assets/icon.svg";
import VideoGenFlowIcon from "./VideoGenFlow/assets/icon.svg";
import TextToImageIcon from "./TextToImage/assets/icon.svg";
import ImageToImageIcon from "./ImageToImage/assets/icon.svg";

import FeedbackIcon from "./../../assets/image/feedback.svg";

export const SoundApps = [
    {
        name: "LongTextTts",
        title: t("长文本转音频"),
        description: t("将长文本内容转换为音频文件"),
        icon: LongTextTtsIcon,
        component: LongTextTts,
    },
    {
        name: "SubtitleTts",
        title: t("字幕转音频"),
        description: t("将字幕文件转换为音频文件"),
        icon: SubtitleTtsIcon,
        component: SubtitleTts,
    },
    {
        name: "SoundReplace",
        title: t("声音替换"),
        description: t("将视频中的人声替换为其他音色"),
        icon: SoundReplaceIcon,
        component: SoundReplace,
    },
];

export const VideoApps = [
    // 🔧 隐藏"数字人一键合成"菜单
    // {
    //     name: "VideoGenFlow",
    //     title: t("数字人一键合成"),
    //     description: t("输入文本自动合成音频驱动口型合成视频"),
    //     icon: VideoGenFlowIcon,
    //     component: VideoGenFlow,
    // },
];

export const ImageApps = [
    {
        name: "TextToImage",
        title: t("文生图"),
        description: t("根据文本描述生成图片"),
        icon: TextToImageIcon,
        component: TextToImage,
    },
    {
        name: "ImageToImage",
        title: t("图生图"),
        description: t("根据输入图片+描述提示生成新的图片"),
        icon: ImageToImageIcon,
        component: ImageToImage,
    }
];

export const AllApps = [
    ...(SoundApps.map(app => ({
        ...app,
        url: `/sound?tab=${app.name}`,
    })) as any),
    // 🔧 修复：VideoApps可能为空，使用条件判断
    ...(VideoApps.length > 0 ? VideoApps.map(app => ({
        ...app,
        url: `/video?tab=${app.name}`,
    })) : []),
    // 只包含文生图，图生图在图片页面的侧边栏中
    {
        name: "TextToImage",
        title: t("文生图"),
        description: t("根据文本描述生成图片"),
        icon: TextToImageIcon,
        url: `/image?tab=TextToImage`,
    },
    {
        title: t("更新日志"),
        description: t("查看软件版本更新记录"),
        icon: FeedbackIcon,
        url: "/changelog",
    },
    {
        title: t("工具需求"),
        description: t("更多工具提交需求给我们"),
        icon: FeedbackIcon,
        url: "https://060.cn/wish",
    },
];
