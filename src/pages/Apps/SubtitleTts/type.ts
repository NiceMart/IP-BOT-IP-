import {AudioRecord} from "../../../lib/ffmpeg";
import {TaskJobResultStepStatus} from "../../../service/TaskService";

export type SubtitleTtsModelConfigType = {
    srt: string;
    soundGenerate: SoundGenerateParamType;
};

export type SubtitleTtsJobResultType = {
    // 处理步骤
    // 1 ParseSrt 解析SRT
    // 2 SoundGenerate 合成音频
    // 3 Combine 合并音频
    // 4 End
    step: "ParseSrt" | "SoundGenerate" | "Combine" | "End";

    ParseSrt: {
        status: TaskJobResultStepStatus,
        records: { start: number; end: number; text: string }[];
    };
    SoundGenerate: {
        status: TaskJobResultStepStatus,
        records: AudioRecord[] | null;
    };
    Combine: {
        status: TaskJobResultStepStatus,
        records: AudioRecord[] | null;
        audio: string;
    };
};
