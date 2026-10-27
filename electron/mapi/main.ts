import config from "./config/main";
import log from "./log/main";
import app from "./app/main";
import storage from "./storage/main";
import db from "./db/main";
import file from "./file/main";
import event from "./event/main";
import ui from "./ui";
import keys from "./keys/main";
import user from "./user/main";
import auth from "./auth/main";
import misc from "./misc/main";
import updater from "./updater/main";
import server from "./server/main";
// @ts-ignore - ipAgent module may have type issues but exports correctly
import ipAgent from "./ipAgent/main";
import taskLog from "./taskLog/main";
import { register as registerSubtitleCover } from "./subtitleCover/register";
import platform from "./platform/main";
import publish from "./publish/main";
// 导入账号管理IPC handlers（模块加载时自动注册）
import "./publish/accountIpc";
import { registerFontManagerHandlers } from "./fontManager/main";
import keywordGroup from "./keywordGroup/index";
import style from "./style/index";
// 导入shell模块以注册FFmpeg执行等IPC handlers（模块加载时自动注册）
import shell from "./shell/main";
// 导入soundEffect模块以注册音效相关IPC handlers（模块加载时自动注册）
import soundEffect from "./soundEffect/index";
import sticker from "./sticker/main";
// 导入阿里云语音服务模块
import { registerAliyunHandlers } from "./aliyun/main";
// 导入RunningHub云端服务模块
import { registerRunningHubHandlers } from "./runninghub/main";
// 导入CompShare自主算力服务模块
import { registerCompShareHandlers } from "./compshare/main";

const $mapi = {
    app,
    log,
    config,
    storage,
    db,
    file,
    event,
    ui,
    keys,
    user,
    auth,
    misc,
    updater,
    server,
    ipAgent,
    taskLog,
    platform,
    publish,
    keywordGroup,
    style,
    shell,
    soundEffect,
    sticker,
};

export const MAPI = {
    async init() {
        await $mapi.user.init();
        await $mapi.auth.init();
        await $mapi.db.init();
        await $mapi.event.init();
        await $mapi.ipAgent.init();
        await $mapi.platform.init();
        await $mapi.publish.init();
        // 初始化音效系统（在数据库初始化之后）
        await $mapi.soundEffect.init($mapi.db);
        // 初始化字幕封面生成器（在 AppEnv 初始化之后）
        registerSubtitleCover();
        // 注册字体管理器处理器
        registerFontManagerHandlers();
        // Shell处理器已在模块导入时自动注册（shell/main.ts）
        console.log("[MAPI.init] Shell handlers already registered at module load time");
        // 音效处理器已在模块导入时自动注册（soundEffect/main.ts）
        console.log("[MAPI.init] SoundEffect handlers already registered at module load time");
        // 注册关键词分组处理器
        $mapi.keywordGroup.registerIpcHandlers();
        // 注册字幕样式处理器
        $mapi.style.registerIpcHandlers();
        // 注册贴纸生成处理器
        $mapi.sticker.registerIpcHandlers();
        // 注册阿里云语音服务处理器
        registerAliyunHandlers();
        // 注册RunningHub云端服务处理器
        registerRunningHubHandlers();
        // 注册CompShare自主算力服务处理器
        registerCompShareHandlers();
    },
    ready() {
        $mapi.keys.ready();
    },
    destroy() {
        $mapi.keys.destroy();
    },
};
