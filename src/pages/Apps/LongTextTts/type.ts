import {AudioRecord} from "../../../lib/ffmpeg";
import {TaskJobResultStepStatus} from "../../../service/TaskService";

export type LongTextTtsModelConfigType = {
    text: string;
    soundGenerate: SoundGenerateParamType;
};

type ArticleItemRecord = {
    text: string;
    audio: string;
}

export type LongTextTtsJobResultType = {
    // 处理步骤
    // 1 SplitText 分割文本
    // 2 SoundGenerate 合成音频
    // 3 Combine 合并音频
    // 4 End
    step: "SplitText" | "SoundGenerate" | "Combine" | "End";

    SplitText: {
        status: TaskJobResultStepStatus,
        records: { text: string }[];
    };
    SoundGenerate: {
        status: TaskJobResultStepStatus,
        records: { text: string, audio: string, }[] | null;
    };
    Combine: {
        status: TaskJobResultStepStatus,
        audio: string;
    };
};
