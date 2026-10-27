import { exposeContext } from "./util";
import { AppEnv } from "./env";

import config from "./config/render";
import log from "./log/render";
import app from "./app/render";
import storage from "./storage/render";
import db from "./db/render";
import file from "./file/render";
import event from "./event/render";
import ui from "./ui/render";
import updater from "./updater/render";
import statistics from "./statistics/render";
import lang from "./lang/render";
import user from "./user/render";
import auth from "./auth/render";
import misc from "./misc/render";
import shell from "./shell/render";

import server from "./server/render";
import ipAgent from "./ipAgent/render";
import subtitleCover from "./subtitleCover/render";
import platform from "./platform/render";
import publish from "./publish/render";
import fontManager from "./fontManager/render";
import keywordGroup from "./keywordGroup/render";
import style from "./style/render";
import soundEffect from "./soundEffect/render";
import sticker from "./sticker/render";
import aliyun from "./aliyun/render";
import runninghub from "./runninghub/render";
import compshare from "./compshare/render";

export const MAPI = {
    init(env: typeof AppEnv = null) {
        if (!env) {
            // expose context
            exposeContext("$mapi", {
                app,
                log,
                config,
                storage,
                db,
                file,
                event,
                ui,
                updater,
                statistics,
                lang,
                user,
                auth,
                misc,
                server,
                shell,
                ipAgent,
                subtitleCover,
                platform,
                publish,
                fontManager,
                keywordGroup,
                style,
                soundEffect,
                sticker,
                aliyun,
                runninghub,
                compshare,
            });
            db.init();
            event.init();
            ui.init();
        } else {
            // init context
            AppEnv.appRoot = env.appRoot;
            AppEnv.appData = env.appData;
            AppEnv.userData = env.userData;
            AppEnv.dataRoot = env.dataRoot;
            AppEnv.isInit = true;
        }
    },
};
