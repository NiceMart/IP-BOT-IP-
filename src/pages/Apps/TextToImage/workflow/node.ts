import { defineAsyncComponent } from "vue";
import { NodeFunctionCall, NodeRunController, NodeRunParam, NodeRunResult } from "../../../../module/Workflow/core/type";
import { workflowRun } from "../../common/workflow";
import { TextToImageRun } from "../task";
import TextToImageIcon from "./../assets/icon.svg";

export default <NodeFunctionCall>{
    name: "TextToImage",
    title: "文生图",
    description: "将文本转换为图像",
    icon: TextToImageIcon,
    comp: defineAsyncComponent(() => import("./TextToImageNode.vue")),
    inputFields: [
        {
            type: "textarea",
            name: "Prompt",
        },
    ],
    outputFields: [
        {
            type: "file",
            name: "Image",
            fileExtensions: ["png", "jpg"],
        }
    ],
    async run(controller: NodeRunController, param: NodeRunParam): Promise<NodeRunResult> {
        console.log('TextToImage run', param);
        return workflowRun(
            controller, param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.['taskId'] || '',
                    prompt: param.runInputs['Prompt'],
                    title: param.node.properties?.title + '-' + param.node.id,
                    textToImage: param.node.properties?.data?.textToImage,
                };
                if (!taskRunData.prompt || !taskRunData.textToImage) {
                    const missing: string[] = [];
                    if (!taskRunData.prompt) missing.push("提示文本");
                    if (!taskRunData.textToImage) missing.push("图像生成服务");
                    throw `参数错误：缺少 ${missing.join(", ")}`;
                }
                return await TextToImageRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs['Image'] = data.image
            }
        );
    },
    async check(node) {
        if (!node.properties?.data?.textToImage) {
            throw "请配置图像生成服务";
        }
        if (node.properties?.inputFields?.[0].value === '') {
            throw "请输入文本参数";
        }
    }
}
