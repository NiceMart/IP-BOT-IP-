import {serverTextToImage} from "../../../lib/server";
import {TaskRecord, TaskService, TaskType} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {TaskBiz, useTaskStore} from "../../../store/modules/task";
import {TextToImageJobResultType, TextToImageModelConfigType} from "./type";

import {createTaskRunResult} from "../common/lib";
import {TaskRunResult} from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const TextToImageRun = async (data: {
    taskId: string;
    title: string;
    prompt: string;
    textToImage: TextToImageParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("TextToImage.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "TextToImage",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                prompt: data.prompt,
                textToImage: data.textToImage,
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

export const TextToImageCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: TextToImageJobResultType = task.jobResult;
    if (jobResult.Generate) {
        if (jobResult.Generate.image) {
            files.push(jobResult.Generate.image);
        }
    }
    return {
        files,
    };
};

export const TextToImage: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("TextToImage.runFunc", {bizId, bizParam});
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: TextToImageModelConfigType = record.modelConfig;
        const jobResult: TextToImageJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "Prepare";
        jobResult.Prepare = jobResult.Prepare || {status: "queue"};
        jobResult.Generate = jobResult.Generate || {status: "queue"};

        if (jobResult.step === "Prepare") {
            console.log("TextToImage.Prepare", jobResult);
            jobResult.Prepare.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "TextToImage", bizId}, "running");

            jobResult.step = "Generate";
            jobResult.Prepare.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "Generate") {
            console.log("TextToImage.Generate", jobResult);
            jobResult.Generate.status = "running";
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({biz: "TextToImage", bizId}, "running");

            const ret = await serverTextToImage(
                "TextToImage", bizId, modelConfig.textToImage, record.result, modelConfig.prompt,
                {
                    cache: false,
                }
            );
            if (ret.type === "retry") {
                return ret.type;
            }
            jobResult.Generate.image = await $mapi.file.hubSave(ret.url);
            jobResult.step = "End";
            jobResult.Generate.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "End") {
            console.log("TextToImage.End", jobResult);
            return "success";
        }

        throw `TextToImage.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: TextToImageJobResultType = record.jobResult;
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
                $mapi.log.error("TextToImage.successFunc: no image in jobResult.Generate");
            }
        } else {
            $mapi.log.error("TextToImage.successFunc: unknown jobResult.step", jobResult.step);
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
        console.log("TextToImage.update", {bizId, data, bizParam});
    },
};
