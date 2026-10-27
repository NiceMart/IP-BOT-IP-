import {serverImageToImage} from "../../../lib/server";
import {TaskRecord, TaskService, TaskType} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {TaskBiz, useTaskStore} from "../../../store/modules/task";
import {ImageToImageJobResultType, ImageToImageModelConfigType} from "./type";

import {createTaskRunResult} from "../common/lib";
import {TaskRunResult} from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const ImageToImageRun = async (data: {
    taskId: string;
    title: string;
    image: string;
    prompt: string;
    imageToImage: ImageToImageParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("ImageToImage.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "ImageToImage",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                image: data.image,
                prompt: data.prompt,
                imageToImage: data.imageToImage,
            },
            param: {},
        };
        taskId = await TaskService.submit(record);
    }
    return {
        taskId,
        result: await createTaskRunResult(taskId, (resultData, task) => {
            resultData.image = task.result?.url;
        }),
    };
};

export const ImageToImageCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: ImageToImageJobResultType = task.jobResult;
    if (jobResult.Generate) {
        if (jobResult.Generate.image) {
            files.push(jobResult.Generate.image);
        }
    }
    return {
        files,
    };
};

export const ImageToImage: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("ImageToImage.runFunc", {bizId, bizParam});
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: ImageToImageModelConfigType = record.modelConfig;
        const jobResult: ImageToImageJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || {status: "queue"};
        jobResult.Generate = jobResult.Generate || {status: "queue"};

        if (jobResult.step === "Prepare") {
            console.log("ImageToImage.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "ImageToImage", bizId}, "running");

            jobResult.step = "Generate";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "Generate") {
            console.log("ImageToImage.Generate", jobResult);
            jobResult.Generate.status = "running";
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({biz: "ImageToImage", bizId}, "running");

            const ret = await serverImageToImage(
                "ImageToImage", bizId, modelConfig.imageToImage,
                record.result, modelConfig.prompt, modelConfig.image,
                {
                    cache:false,
                });
            if (ret.type === "retry") {
                return ret.type;
            }
            jobResult.Generate.image = await $mapi.file.hubSave(ret.url);
            jobResult.step = "End";
            jobResult.Generate.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "End") {
            console.log("ImageToImage.End", jobResult);
            return "success";
        }

        throw `ImageToImage.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: ImageToImageJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            if (jobResult.Generate.image) {
                await TaskService.update(bizId, {
                    status: "success",
                    endTime: Date.now(),
                    result: {
                        url: await $mapi.file.hubSave(jobResult.Generate.image),
                    },
                });
            } else {
                $mapi.log.error("ImageToImage.successFunc: no image in jobResult.Generate");
            }
        } else {
            $mapi.log.error("ImageToImage.successFunc: unknown jobResult.step", jobResult.step);
        }
    },
    failFunc: async (bizId, msg, bizParam) => {
        await TaskService.update(bizId, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
    update: async (bizId, data, bizParam) => {
        console.log("ImageToImage.update", {bizId, data, bizParam});
    },
};
