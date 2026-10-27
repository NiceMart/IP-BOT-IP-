import { TaskJobResultStepStatus } from "../../../service/TaskService";

export type ImageToImageModelConfigType = {
    image: string;
    prompt: string;
    imageToImage: ImageToImageParamType;
};

export type ImageToImageJobResultType = {
    // 处理步骤
    // 1 Prepare 准备图像
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
