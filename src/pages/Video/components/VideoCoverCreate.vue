<script setup lang="ts">
import {ref, computed, onMounted} from "vue";
import {$t} from "../../../lang";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import VideoCoverForm from "./VideoCoverForm.vue";
import {TaskService} from "../../../service/TaskService";
import {useServerStore} from "../../../store/modules/server";
import {VideoCoverModelConfigType} from "../../../declarations/app";

const serverStore = useServerStore();
const emit = defineEmits<{
    (e: "submitted"): void;
}>();

const config = ref<VideoCoverModelConfigType>({
    video: "",
    type: "VideoCover",
    serverKey: "",
    param: {
        timePointType: "random",
        customTimePoint: 10,
        textOverlay: "",
        fontSize: 64,
        fontColor: "white",
        position: "bottom-left",
        backgroundColor: true,
        backgroundOpacity: 70,
        maxWidth: 80,
        effectType: "none",
        quality: 95
    },
});

const show = ref(false);
const serverVersion = ref("");
const title = ref("");
const isSubmitting = ref(false);

onMounted(() => {
    reset();
});

const reset = () => {
    config.value = {
        video: "",
        type: "VideoCover",
        serverKey: "",
        param: {
            timePointType: "random",
            customTimePoint: 10,
            textOverlay: "",
            fontSize: 64,
            fontColor: "white",
            position: "bottom-left",
            backgroundColor: true,
            backgroundOpacity: 70,
            maxWidth: 80,
            effectType: "none",
            quality: 95
        },
    };
    title.value = $t("封面自动生成");
    serverVersion.value = "";
};

const submit = async () => {
    if (isSubmitting.value) return;
    if (!config.value.video) {
        window.$message.error($t("请选择视频文件"));
        return;
    }

    isSubmitting.value = true;
    try {
        await TaskService.create(
            title.value,
            "VideoCover",
            {
                ...config.value,
                serverKey: config.value.serverKey || "local",
            },
            {},
        );
        emit("submitted");
        show.value = false;
        reset();
    } catch (e) {
        console.error(e);
    } finally {
        isSubmitting.value = false;
    }
};

const canSubmit = computed(() => {
    return config.value.video && !isSubmitting.value;
});
</script>

<template>
    <div class="rounded-xl shadow border p-4 hover:shadow-lg">
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="text-lg font-semibold">{{ $t("创建封面生成任务") }}</div>
            </div>
            <div>
                <a-button v-if="show" @click="show = false">
                    {{ $t("收起") }}
                </a-button>
                <a-button v-else type="primary" @click="show = true">
                    {{ $t("创建任务") }}
                </a-button>
            </div>
        </div>

        <div v-if="show" class="space-y-4">
            <!-- Server Selection -->
            <div>
                <div class="mb-2 flex items-center">
                    <label class="text-sm font-medium text-gray-700">{{
                        $t("处理引擎")
                    }}</label>
                    <a-tooltip :content="$t('选择用于封面生成的处理引擎')" mini>
                        <icon-question-circle class="ml-1 text-gray-400" />
                    </a-tooltip>
                </div>
                <ServerSelector
                    v-model="config.serverKey"
                    v-model:version="serverVersion"
                    task-type="VideoCover"
                />
            </div>

            <!-- Title -->
            <div>
                <div class="mb-2 flex items-center">
                    <label class="text-sm font-medium text-gray-700">{{
                        $t("任务名称")
                    }}</label>
                </div>
                <TaskTitleField v-model="title" :placeholder="$t('封面自动生成')" />
            </div>

            <!-- Form -->
            <div>
                <VideoCoverForm v-model="config" />
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-end space-x-2 pt-4 border-t">
                <a-button @click="reset">{{ $t("重置") }}</a-button>
                <a-button
                    type="primary"
                    :loading="isSubmitting"
                    :disabled="!canSubmit"
                    @click="submit"
                >
                    {{ $t("提交任务") }}
                </a-button>
            </div>
        </div>
    </div>
</template>