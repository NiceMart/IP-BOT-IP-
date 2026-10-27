// @ts-nocheck
import {ffmpegMergeAudio} from "../../../lib/ffmpeg";
import {serverSoundGenerate} from "../../../lib/server";
import {TaskRecord, TaskService, TaskType} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {TaskBiz, useTaskStore} from "../../../store/modules/task";
import {SubtitleTtsJobResultType, SubtitleTtsModelConfigType} from "./type";
import {parseSrt} from "./util";

import {createTaskRunResult} from "../common/lib";
import {TaskRunResult} from "../common/type";

const serverStore = useServerStore();
const taskStore = useTaskStore();

export const SubtitleTtsRun = async (data: {
    taskId: string;
    title: string;
    srt: string;
    soundGenerate: SoundGenerateParamType;
}): Promise<{
    taskId: string;
    result: () => Promise<TaskRunResult>;
}> => {
    console.log("SubtitleTts.Run", data);
    let taskId = data.taskId;
    if (!taskId) {
        const record: TaskRecord = {
            type: TaskType.System,
            biz: "SubtitleTts",
            title: data.title,
            serverName: "",
            serverTitle: "",
            serverVersion: "",
            modelConfig: {
                srt: data.srt,
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

export const SubtitleTtsCleaner = async (task: TaskRecord) => {
    const files: string[] = [];
    const jobResult: SubtitleTtsJobResultType = task.jobResult;
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

export const SubtitleTts: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        console.log("SubtitleTts.runFunc", {bizId, bizParam});
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const modelConfig: SubtitleTtsModelConfigType = record.modelConfig;
        const jobResult: SubtitleTtsJobResultType = record.jobResult;

        jobResult.step = jobResult.step || "ParseSrt";
        jobResult.ParseSrt = jobResult.ParseSrt || {status: "queue", records: []};
        jobResult.SoundGenerate = jobResult.SoundGenerate || {status: "queue", records: []};
        jobResult.Combine = jobResult.Combine || {status: "queue", audio: ""};

        if (jobResult.step === "ParseSrt") {
            console.log("SubtitleTts.ParseSrt", jobResult);
            jobResult.ParseSrt.status = "running";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "SubtitleTts", bizId}, "running");

            const srtContent = await $mapi.file.read(modelConfig.srt);
            jobResult.ParseSrt.records = parseSrt(srtContent);
            jobResult.SoundGenerate.records = null;
            jobResult.step = "SoundGenerate";
            jobResult.ParseSrt.status = "success";
            await TaskService.update(bizId, {jobResult});
        }

        if (jobResult.step === "SoundGenerate") {
            console.log("SubtitleTts.SoundGenerate", jobResult);
            jobResult.SoundGenerate.status = "running";
            if (!jobResult.SoundGenerate.records) {
                jobResult.SoundGenerate.records = jobResult.ParseSrt.records.map(item => ({
                    ...item,
                    audio: "",
                }));
            }
            await TaskService.update(bizId, {
                jobResult,
                status: "running",
            });
            taskStore.fireChange({biz: "SubtitleTts", bizId}, "running");

            for (let i = 0; i < jobResult.SoundGenerate.records.length; i++) {
                const record = jobResult.SoundGenerate.records[i];
                if (record.audio) {
                    continue;
                }
                const ret = await serverSoundGenerate("SubtitleTts", bizId, modelConfig.soundGenerate, {}, record.text);
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
            console.log("SubtitleTts.Combine", jobResult);
            jobResult.Combine.status = "running";
            jobResult.Combine.audio = "";
            await TaskService.update(bizId, {
                status: "running",
                jobResult,
            });
            taskStore.fireChange({biz: "SubtitleTts", bizId}, "running");

            const filesToClean: string[] = [];
            try {
                // 计算总时长
                const totalDuration =
                    jobResult.ParseSrt.records.length > 0 ? Math.max(...jobResult.ParseSrt.records.map(r => r.end)) : 0;

                const {output, cleans, mergeRecords} = await ffmpegMergeAudio(
                    jobResult.SoundGenerate.records!,
                    totalDuration
                );
                filesToClean.push(...cleans);
                jobResult.Combine.records = mergeRecords;
                jobResult.Combine.audio = await $mapi.file.hubSave(output);
                jobResult.step = "End";
                jobResult.Combine.status = "success";
                await TaskService.update(bizId, {
                    jobResult,
                });
                return "success";
            } catch (error) {
                console.error("SubtitleTts.Combine error", error);
                throw error;
            } finally {
                await $mapi.file.clean(filesToClean);
            }
        }

        if (jobResult.step === "End") {
            console.log("SubtitleTts.End", jobResult);
            return "success";
        }

        throw `SubtitleTts.runFunc: unknown jobResult.step: ${jobResult.step}`;
    },
    successFunc: async (bizId, bizParam) => {
        const {record} = await serverStore.prepareForTask(bizId, bizParam);
        const jobResult: SubtitleTtsJobResultType = record.jobResult;
        if (jobResult.step === "End") {
            await TaskService.update(bizId, {
                status: "success",
                endTime: Date.now(),
                result: {
                    url: await $mapi.file.hubSave(jobResult.Combine.audio),
                },
            });
        } else {
            $mapi.log.error("SubtitleTts.successFunc: unknown jobResult.step", jobResult.step);
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
        console.log("SubtitleTts.update", {bizId, data, bizParam});
    },
};
