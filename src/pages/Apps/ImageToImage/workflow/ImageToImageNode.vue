<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import ImageToImageFormView from "../../../common/ImageToImageFormView.vue";
import ImageToImageParamDialog from "../components/ImageToImageParamDialog.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const {nodeData, nodeRunData, nodeUpdateData} = useFunctionCallNode(props, emit)
const paramDialog = ref<InstanceType<typeof ImageToImageParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <ImageToImageFormView v-if="nodeData.imageToImage" :data="nodeData.imageToImage"/>
            <div class="flex gap-2 items-center">
                <a-button v-if="props.source==='config'" @click="paramDialog?.show(nodeData)" size="small">
                    <template #icon>
                        <icon-settings/>
                    </template>
                    {{ '设置'}}
                </a-button>
                <TaskDialogViewButton :task-id="nodeRunData.taskId"/>
            </div>
        </div>
    </div>
    <ImageToImageParamDialog ref="paramDialog" @update="nodeUpdateData"/>
</template>
