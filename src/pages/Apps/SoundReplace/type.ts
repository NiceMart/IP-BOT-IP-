import {TaskJobResultStepStatus} from "../../../service/TaskService";
import {AudioRecord} from "../../../lib/ffmpeg";

export type SoundReplaceModelConfigType = {
    video: string;
    soundAsr: SoundAsrParamType;
    soundGenerate: SoundGenerateParamType;
};

export type SoundReplaceJobResultType = {
    // 处理步骤
    // 1 转mp3 ToAudio
    // 2 识别 SoundAsr
    // 3 确认 Confirm
    // 4 合成 SoundGenerate
    // 5 替换 Combine
    // 6 替换确认 CombineConfirm
    step: "ToAudio" | "SoundAsr" | "Confirm" | "SoundGenerate" | "Combine" | "CombineConfirm" | "End";

    ToAudio: {
        status: TaskJobResultStepStatus,
        file: string;
    };
    SoundAsr: {
        status: TaskJobResultStepStatus,
        start: number;
        end: number;
        duration: number;
        records: { start: number; end: number; text: string }[];
    };
    Confirm: {
        status: TaskJobResultStepStatus,
        records: { start: number; end: number; text: string }[];
    };
    SoundGenerate: {
        status: TaskJobResultStepStatus,
        start: number;
        end: number;
        records: (AudioRecord & {
            actualStart: number;
            actualEnd: number;
        })[] | null;
    };
    Combine: {
        status: TaskJobResultStepStatus,
        audio: string;
        file: string;
    };
    CombineConfirm:{
        status: TaskJobResultStepStatus,
    }
};
