import {defineAsyncComponent} from "vue";
import {NodeFunctionCall, NodeRunController, NodeRunParam, NodeRunResult} from "../../../../module/Workflow/core/type";
import {workflowRun} from "../../common/workflow";
import {ImageToImageRun} from "../task";
import ImageToImageIcon from "./../assets/icon.svg";

export default <NodeFunctionCall>{
    name: "ImageToImage",
    title: "图生图",
    description: "将图像转换为图像",
    icon: ImageToImageIcon,
    comp: defineAsyncComponent(() => import("./ImageToImageNode.vue")),
    inputFields: [
        {
            type: "file",
            name: "Image",
            fileExtensions: ["png", "jpg", "jpeg"],
        },
        {
            type: "text",
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
        console.log('ImageToImage run', param);
        return workflowRun(
            controller, param,
            async () => {
                const taskRunData = {
                    taskId: param.runData?.['taskId'] || '',
                    image: param.runInputs['Image'],
                    prompt: param.runInputs['Prompt'],
                    title: param.node.properties?.title + '-' + param.node.id,
                    imageToImage: param.node.properties?.data?.imageToImage,
                };
                if (!taskRunData.image || !taskRunData.prompt || !taskRunData.imageToImage) {
                    const missing: string[] = [];
                    if (!taskRunData.image) missing.push("图像");
                    if (!taskRunData.prompt) missing.push("提示文本");
                    if (!taskRunData.imageToImage) missing.push("图像生成服务");
                    throw `参数错误：缺少 ${missing.join(", ")}`;
                }
                return await ImageToImageRun(taskRunData);
            },
            async (result, data) => {
                result.runOutputs['Image'] = data.image
            }
        );
    },
    async check(node) {
        if (!node.properties?.data?.imageToImage) {
            throw "请配置图像生成服务";
        }
        if (node.properties?.inputFields?.[0].value === '') {
            throw "请输入图像参数";
        }
        if (node.properties?.inputFields?.[1].value === '') {
            throw "请输入提示参数";
        }
    }
}
