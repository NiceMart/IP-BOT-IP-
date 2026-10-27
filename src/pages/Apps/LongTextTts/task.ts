// @ts-nocheck
import {ffmpegConcatAudio} from "../../../lib/ffmpeg";
import {serverSoundGenerate} from "../../../lib/server";
import {TaskRecord, TaskService, TaskType} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {TaskBiz, useTaskStore} from "../../../store/modules/task";
import {LongTextTtsJobResultType, LongTextTtsModelConfigType} from "./type";
import {splitText} from "./util";

import {createTaskRunResult} from "../common/lib";
import {TaskRunResult} from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const LongTextTtsRun = async (data: {
    taskId: string;
    title: string;
    text: string;
    soundGenerate: SoundGenerateParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("LongTextTts.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "LongTextTts",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                text: data.text,
                soundGenerate: data.soundGenerate,
            },
            param: {},
        };
        taskId = await TaskService.submit(record);
    }
    return {
        taskId,
        result: await createTaskRunResult(taskId, (resultData, task) => {
            resultData.audio = task.result?.url;
        }),
    };
};

export const LongTextTtsCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: LongTextTtsJobResultType = task.jobResult;
    if (jobResult.SoundGenerate) {
        if (jobResult.SoundGenerate.records) {
            for (const r of jobResult.SoundGenerate.records) {
                if (r.audio) {
                    files.push(r.audio);
                }
            }
        }
    }
    if (jobResult.Combine) {
        if (jobResult.Combine.audio) {
            files.push(jobResult.Combine.audio);
        }
    }
    return {
        files,
    };
};

export const LongTextTts: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("LongTextTts.runFunc", {bizId, bizParam});
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: LongTextTtsModelConfigType = record.modelConfig;
        const jobResult: LongTextTtsJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "SplitText";
        jobResult.SplitText = jobResult.SplitText || {status: "queue"};
        jobResult.SoundGenerate = jobResult.SoundGenerate || {status: "queue"};
        jobResult.Combine = jobResult.Combine || {status: "queue"};

        if (jobResult.step === "SplitText") {
            console.log("LongTextTts.SplitText", jobResult);
            jobResult.SplitText.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "LongTextTts", bizId}, "running");

            jobResult.SplitText.records = splitText(modelConfig.text, 150)
            jobResult.SoundGenerate.records = null;
            jobResult.step = "SoundGenerate";
            jobResult.SplitText.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "SoundGenerate") {
            console.log("LongTextTts.SoundGenerate", jobResult);
            jobResult.SoundGenerate.status = "running";
            if (!jobResult.SoundGenerate.records) {
                jobResult.SoundGenerate.records = jobResult.SplitText.records.map(item => ({
                    ...item,
                    audio: "",
                }));
            }
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({biz: "LongTextTts", bizId}, "running");

            for (let i = 0; i < jobResult.SoundGenerate.records!.length; i++) {
                const record = jobResult.SoundGenerate.records![i];
                if (record.audio) {
                    continue;
                }
                const ret = await serverSoundGenerate("LongTextTts", bizId, modelConfig.soundGenerate, {}, record.text);
                if (ret.type === "retry") {
                    return ret.type;
                }
                record.audio = await $mapi.file.hubSave(ret.url);
                await TaskService.update(bizId, {jobResult});
            }
            jobResult.step = "Combine";
            jobResult.SoundGenerate.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "Combine") {
            console.log("LongTextTts.Combine", jobResult);
            jobResult.Combine.status = "running";
            jobResult.Combine.audio = "";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "LongTextTts", bizId}, "running");

            const filesToClean: string[] = [];
            try {
                const audio = await ffmpegConcatAudio(jobResult.SoundGenerate.records!.map(r => r.audio));
                jobResult.Combine.audio = await $mapi.file.hubSave(audio);
                jobResult.step = "End";
                jobResult.Combine.status = "success";
                await TaskService.update(bizId, {
                    jobResult,
                });
                return "success";
            } catch (error) {
                console.error("LongTextTts.Combine error", error);
                throw error;
            } finally {
                await $mapi.file.clean(filesToClean);
            }
        }

        if (jobResult.step === "End") {
            console.log("LongTextTts.End", jobResult);
            return "success";
        }

        throw `LongTextTts.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: LongTextTtsJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    url: await $mapi.file.hubSave(jobResult.Combine.audio),
                },
            });
        } else {
            $mapi.log.error("LongTextTts.successFunc: unknown jobResult.step", jobResult.step);
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
        console.log("LongTextTts.update", {bizId, data, bizParam});
    },
};
