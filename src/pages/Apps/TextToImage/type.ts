import {TaskJobResultStepStatus} from "../../../service/TaskService";

export type TextToImageModelConfigType = {
    prompt: string;
    textToImage: TextToImageParamType;
};

export type TextToImageJobResultType = {
    // 处理步骤
    // 1 Prepare 准备
    // 2 Generate 生成图像
    // 3 End
    step: "Prepare" | "Generate" | "End";

    Prepare: {
        status: TaskJobResultStepStatus;
    };
    Generate: {
        status: TaskJobResultStepStatus;
        image?: string;
    };
};
