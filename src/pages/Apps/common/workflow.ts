import {NodeRunController, NodeRunParam, NodeRunResult, NodeRunResultStatus} from "../../../module/Workflow/core/type";

type TaskRunnerResultBaseType = {
    code: number,
    msg: string,
    data?: {
        status: 'success' | 'pause',
        [key: string]: any,
    }
}

export const workflowRun = async <TaskRunnerResultType extends TaskRunnerResultBaseType>(
    controller: NodeRunController,
    param: NodeRunParam,
    taskRunner: () => Promise<{
        taskId: string,
        result: () => Promise<TaskRunnerResultType>,
    }>,
    taskSuccessCallback: (result: NodeRunResult, data: Record<string, any>) => Promise<void>
): Promise<NodeRunResult> => {
    const result: NodeRunResult = {
        status: 'error' as NodeRunResultStatus,
        statusMsg: "未知错误",
        runOutputs: {},
        runData: {},
        pauseByType: '',
        pauseById: '',
    }
    const res = await taskRunner();
    result.runData!['taskId'] = res.taskId;
    controller.updateNodeRunData(param.node.id, result.runData)
    const taskResult = await res.result();
    if (taskResult.code) {
        result.status = 'error';
        result.statusMsg = taskResult.msg || "任务失败";
    } else if (taskResult.data?.status === 'success') {
        result.status = 'success';
        await taskSuccessCallback(result, taskResult.data);
    } else if (taskResult.data?.status === 'pause') {
        result.status = 'pause';
        result.pauseByType = 'task';
        result.pauseById = res.taskId;
    } else {
        result.status = 'error';
        result.statusMsg = taskResult.msg || "任务失败";
    }
    return result
}
