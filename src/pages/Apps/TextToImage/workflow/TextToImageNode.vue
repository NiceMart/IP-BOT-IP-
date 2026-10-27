<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import TextToImageFormView from "../../common/TextToImageFormView.vue";
import TextToImageParamDialog from "../components/TextToImageParamDialog.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const {nodeData, nodeRunData, nodeUpdateData} = useFunctionCallNode(props, emit)
const paramDialog = ref<InstanceType<typeof TextToImageParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <TextToImageFormView v-if="nodeData.textToImage" :data="nodeData.textToImage"/>
            <div class="flex gap-1 items-center">
                <a-button v-if="props.source==='config'" @click="paramDialog?.show(nodeData)" size="small">
                    <template #icon>
                        <icon-settings/>
                    </template>
                    设置
                </a-button>
                <TaskDialogViewButton :task-id="nodeRunData.taskId"/>
            </div>
        </div>
    </div>
    <TextToImageParamDialog ref="paramDialog" @update="nodeUpdateData"/>
</template>
