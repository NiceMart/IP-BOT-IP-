import {t} from "../lang";

export function mapError(msg: any) {
    if (typeof msg !== "string") {
        msg = msg.toString();
    }
    const map = {
        FileAlreadyExists: t("文件已存在"),
        FileNotFound: t("文件未找到"),
        ProcessTimeout: t("处理超时"),
        RequestError: t("请求错误"),
        ServerNotRunning: t("模型服务未运行"),
    };
    for (let key in map) {
        if (msg.includes(key)) {
            let error = map[key];
            // regex PluginReleaseDocFormatError:-11
            const regex = new RegExp(`${key}:(-?\\d+)`);
            const match = msg.match(regex);
            if (match) {
                error += `(${match[1]})`;
            }
            return error;
        }
    }
    return msg;
}
