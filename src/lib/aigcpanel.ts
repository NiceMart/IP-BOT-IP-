import { t } from "../lang";

export const allFunctions = [
    { value: "soundTts", label: t("语音合成") },
    { value: "soundClone", label: t("声音克隆") },
    { value: "videoGen", label: t("数字人") },
    { value: "asr", label: t("语音识别") },
    { value: "speechRecognition", label: t("语音识别") },
    { value: "textToImage", label: t("文生图") },
    { value: "imageToImage", label: t("图生图") },
    { value: "live", label: t("智能直播") },
];

export function functionToLabels(functions: string[]) {
    return functions.map(f => functionToLabel(f));
}

export function functionToLabel(f: string) {
    for (const func of allFunctions) {
        if (func.value === f) {
            return func.label;
        }
    }
    return f;
}

export function buildServerContent(config: any) {
    const contentLines: string[] = [];
    if (config?.content) {
        contentLines.push(config.content as string);
    }
    if (config.functions) {
        for (const func in config.functions) {
            if (config.functions[func].content) {
                contentLines.push('<p class="font-bold">' + functionToLabel(func) + "</p>");
                contentLines.push(config.functions[func].content as string);
            }
        }
    }
    return contentLines.join("\n");
}

export function contentToFilenamePathPart(text: string, limit: number = 10) {
    return text
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
        .substring(0, limit);
}
