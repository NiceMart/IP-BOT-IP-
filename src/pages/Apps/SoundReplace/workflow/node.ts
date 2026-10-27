import { defineAsyncComponent } from "vue";
import { NodeFunctionCall, NodeRunController, NodeRunParam, NodeRunResult } from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { SoundReplaceRun } from "../task";
import SoundReplaceIcon from "./../assets/icon.svg";

export default <NodeFunctionCall>{
    name: "SoundReplace",
    title: "声音替换",
    description: "替换视频中的音频",
    icon: SoundReplaceIcon,
    comp: defineAsyncComponent(() => import("./SoundReplaceNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Video",
            fileExtensions: ["mp4"],
        },
        {
            type: "file",
            name: "Srt",
            fileExtensions: ["srt"],
        }
    ],
    async run(controller: NodeRunController, param: NodeRunParam): Promise<NodeRunResult> {
        console.log('SoundReplace run', param);
        return workflowRun(
            controller, param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.['taskId'] || '',
                    video: param.runInputs['Video'],
                    title: param.node.properties?.title + '-' + param.node.id,
                    soundAsr: param.node.properties?.data?.soundAsr,
                    soundGenerate: param.node.properties?.data?.soundGenerate,
                };
                if (!taskRunData.video || !taskRunData.soundAsr || !taskRunData.soundGenerate) {
                    const missing: string[] = [];
                    if (!taskRunData.video) missing.push("视频");
                    if (!taskRunData.soundAsr) missing.push("声音识别服务");
                    if (!taskRunData.soundGenerate) missing.push("声音生成服务");
                    throw `参数错误：缺少 ${missing.join(", ")}`;
                }
                return await SoundReplaceRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs['Video'] = data.video
                result.runOutputs['Srt'] = data.srt
            }
        );
    },
    async check(node) {
        if (!node.properties?.data?.soundAsr || !node.properties?.data?.soundGenerate) {
            throw "请配置声音识别和声音生成服务";
        }
        if (node.properties?.inputFields?.[0].value === '') {
            throw "请输入视频参数";
        }
    }
}
