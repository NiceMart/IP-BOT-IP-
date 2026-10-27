import {DataService} from "../../../service/DataService";
import {TaskService} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {TaskBiz} from "../../../store/modules/task";
import {VideoGenFlowModelConfigType} from "./type";
import {replaceSoundGenerateText} from "../../../lib/server";

const serverStore = useServerStore();

const prepareData = async (bizId: string, bizParam: any) => {
    const {record, server, serverInfo} = await serverStore.prepareForTask(bizId, bizParam);
    const modelConfig: VideoGenFlowModelConfigType = record.modelConfig;
    const soundGenerateServer = await serverStore.getByNameVersion(
        modelConfig.soundGenerate.serverName,
        modelConfig.soundGenerate.serverVersion
    );
    if (!soundGenerateServer) {
        throw new Error("soundGenerateServer not found");
    }
    const soundGenerateServerInfo = await serverStore.serverInfo(soundGenerateServer);
    return {
        record,
        server,
        serverInfo,
        soundGenerateServer,
        soundGenerateServerInfo,
    };
};

export const VideoGenFlow: TaskBiz = {
    runFunc: async (bizId, bizParam) => {
        // console.log('VideoGenFlow.runFunc', {bizId, bizParam})
        const {record, server, serverInfo, soundGenerateServer, soundGenerateServerInfo} = await prepareData(
            bizId,
            bizParam
        );
        const modelConfig: VideoGenFlowModelConfigType = record.modelConfig;
        // console.log('VideoGenFlow.runFunc.record', {record, server, soundTtsServer, soundCloneServer})
        // const videoServerInfo = await serverStore.serverInfo(server)
        // console.log('VideoGenFlow.runFunc.serverInfoc', serverInfo)
        await TaskService.update(bizId as any, {
            status: "wait",
        });
        let audioFilePath: string | null = null;
        if (modelConfig.soundGenerate.type === "SoundTts") {
            const res = await serverStore.call(
                soundGenerateServerInfo,
                "soundTts",
                {
                    id: serverStore.generateTaskId("VideoGenFlow", bizId),
                    result: record.result,
                    param: modelConfig.soundGenerate.ttsParam,
                    text: await replaceSoundGenerateText(modelConfig.text),
                },
                {
                    taskIdResultKey: "soundTtsTaskId",
                }
            );
            // console.log('VideoGenFlow.runFunc.soundTts.res', res)
            if (res.code) {
                throw res.msg || "apiRequest videoGenFlow.soundTts fail";
            }
            switch (res.data.type) {
                case "success":
                    await TaskService.update(bizId as any, {
                        jobResult: {
                            soundTts: res,
                        },
                        result: {
                            url: null,
                        },
                    });
                    audioFilePath = res.data.data.url;
                    break;
                case "retry":
                    return "retry";
                default:
                    throw new Error("unknown res.data.type");
            }
        } else if (modelConfig.soundGenerate.type === "SoundClone") {
            const res = await serverStore.call(
                soundGenerateServerInfo,
                "soundClone",
                {
                    id: serverStore.generateTaskId("VideoGenFlow", bizId),
                    result: record.result,
                    param: modelConfig.soundGenerate.cloneParam,
                    text: await replaceSoundGenerateText(modelConfig.text),
                    promptAudio: modelConfig.soundGenerate.promptUrl,
                    promptText: modelConfig.soundGenerate.promptText,
                },
                {
                    taskIdResultKey: "soundCloneTaskId",
                }
            );
            // console.log('VideoGenFlow.runFunc.soundClone.res', res)
            if (res.code) {
                throw res.msg || "apiRequest videoGenFlow.soundClone fail";
            }
            switch (res.data.type) {
                case "success":
                    await TaskService.update(bizId as any, {
                        jobResult: {
                            soundClone: res,
                        },
                        result: {
                            url: null,
                        },
                    });
                    audioFilePath = res.data.data.url;
                    break;
                case "retry":
                    return "retry";
                default:
                    throw new Error("unknown res.data.type");
            }
        } else {
            throw new Error("unknown soundType");
        }
        if (!audioFilePath) {
            throw new Error("soundFilePath not found");
        }
        const urlSound = await DataService.saveFile(audioFilePath, {saveGroup: 'audio'});
        await TaskService.update(bizId as any, {
            result: {
                urlSound,
            },
        });
        // console.log('VideoGenFlow.runFunc.urlSound', urlSound)
        const res = await serverStore.call(
            serverInfo,
            "videoGen",
            {
                id: serverStore.generateTaskId("VideoGenFlow", bizId),
                result: record.result,
                param: record.param,
                video: modelConfig.videoTemplateUrl,
                audio: urlSound,
            },
            {
                taskIdResultKey: "videoGenTaskId",
            }
        );
        // console.log('VideoGen.runFunc.res', res)
        if (res.code) {
            throw res.msg || "apiRequest videoGenFlow fail";
        }
        switch (res.data.type) {
            case "success":
                await TaskService.update(bizId as any, {
                    status: "success",
                    jobResult: {
                        videoGen: res,
                    },
                });
                return "success";
            case "retry":
                return "retry";
            default:
                throw new Error("unknown res.data.type");
        }
    },
    successFunc: async (bizId, bizParam) => {
        // console.log('VideoGenFlow.successFunc', {bizId, bizParam})
        const {record} = await prepareData(bizId, bizParam);
        // console.log('VideoGenFlow.successFunc.record', {record, server, soundTtsServer, soundCloneServer})
        await TaskService.update(bizId as any, {
            status: "success",
            endTime: Date.now(),
            result: {
                url: await DataService.saveFile(record.jobResult.videoGen.data.data.url, {saveGroup: 'video'}),
            },
        });
    },
    failFunc: async (bizId, msg, bizParam) => {
        // console.log('VideoGenFlow.failFunc', {bizId, bizParam, msg})
        // const {record, server, soundTtsServer, soundCloneServer} = await prepareData(bizId, bizParam)
        await TaskService.update(bizId as any, {
            status: "fail",
            statusMsg: msg,
            endTime: Date.now(),
        });
    },
};
