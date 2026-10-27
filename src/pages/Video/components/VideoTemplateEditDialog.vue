<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import VideoPlayer from "../../../components/common/VideoPlayer.vue";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";
import {ffmpegVideoNormal} from "../../../lib/ffmpeg";
import {ffprobeVideoInfo} from "../../../lib/ffprobe";

const visible = ref(false);
const editingRecord = ref<VideoTemplateRecord | null>(null);
const saving = ref(false);
const edit = (record: VideoTemplateRecord) => { editingRecord.value = {...record}; formData.value={name:record.name,video:record.video}; visible.value=true; };
const videoPlayer = ref<InstanceType<typeof VideoPlayer> | null>(null);

const formData = ref({
    name: "",
    video: "",
});

const add = () => {
    editingRecord.value = null;
    formData.value.name = "";
    formData.value.video = "";
    visible.value = true;
};

const doSelectFile = async () => {
    const path = await window.$mapi.file.openFile({
        accept: "video/*",
    });
    if (path) {
        formData.value.video = path;
        // videoPlayer.value?.loadVideo(path)
    }
};

const doSave = async () => {
    if (saving.value) return;
    if (!formData.value.name) {
        Dialog.tipError(t("请输入名称"));
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(t("请选择视频"));
        return;
    }
    const exists = await VideoTemplateService.getByName(formData.value.name);
    if (exists && exists.id !== editingRecord.value?.id) {
        Dialog.tipError(t("名称重复"));
        return;
    }
    saving.value = true;
    let loadingShown = false;
    try {
        if (editingRecord.value && formData.value.video === editingRecord.value.video) {
            await VideoTemplateService.update(editingRecord.value.id!, {name:formData.value.name});
            visible.value=false;
            emit('update');
            window.dispatchEvent(new CustomEvent('video-template-updated'));
            return;
        }
        loadingShown = true;
        Dialog.loadingOn(t("正在处理视频，请稍候..."));
        const normalPath = await ffmpegVideoNormal(formData.value.video, {
            durationMax: 120,
            crf: 18,
            preset: 'ultrafast',
        });
        const videoInfo = await ffprobeVideoInfo(normalPath);
        const videoPathFull = await $mapi.file.hubSave(normalPath);
        const record = {
            name: formData.value.name,
            video: videoPathFull,
            info: videoInfo,
        } as VideoTemplateRecord;
        if(editingRecord.value) await VideoTemplateService.update(editingRecord.value.id!,record);
        else await VideoTemplateService.insert(record);
        visible.value = false;
        emit("update");
        // 触发全局更新事件，通知其他组件刷新
        window.dispatchEvent(new CustomEvent('video-template-updated'));
    } catch (e) {
        console.error(e);
        Dialog.tipError(t("视频处理失败，请选择其他视频") + ":" + e);
    } finally {
        saving.value = false;
        if (loadingShown) Dialog.loadingOff();
    }
};

defineExpose({
    add, edit,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ editingRecord ? $t("编辑视频形象") : $t("添加视频形象") }}
        </template>
        <template #footer>
            <a-button @click="visible=false" :disabled="saving">取消</a-button>
            <a-button type="primary" @click="doSave" :loading="saving" :disabled="saving">
                {{ $t("保存") }}
            </a-button>
        </template>
        <div style="max-height: 60vh">
            <div class="flex p-4">
                <div class="w-1/2 flex-shrink-0 mr-5">
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('名称')" required>
                            <a-input v-model="formData.name" />
                        </a-form-item>
                        <a-form-item :label="$t('视频')" required>
                            <div class="w-full">
                                <div class="mb-3" v-if="formData.video">
                                    <div class="h-52 rounded-lg p-2 bg-black">
                                        <VideoPlayer ref="videoPlayer" :url="`file://${formData.video}`" />
                                    </div>
                                </div>
                                <div class="mb-3" v-if="!formData.video">
                                    <div
                                        class="h-52 bg-gray-100 border rounded-lg flex items-center text-center cursor-pointer"
                                        @click="doSelectFile"
                                    >
                                        <div class="mx-auto">
                                            <div>
                                                <icon-video-camera class="text-xl" />
                                            </div>
                                            <div>
                                                {{ $t("选择视频文件") }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="mb-3">
                                    <a-button @click="doSelectFile">
                                        <template #icon>
                                            <icon-upload />
                                        </template>
                                        {{ $t("选择视频文件") }}
                                    </a-button>
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
                <div class="flex-grow">
                    <div class="text-lg font-bold">{{ $t("形象示例") }}</div>
                    <div class="mb-3">
                        <div class="mt-1 grid grid-cols-3 gap-4">
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/1.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{ $t("正脸自拍") }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/2.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{ $t("可张口闭口") }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/3.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-close-circle class="text-red-500" />
                                    <span class="text-xs">{{ $t("面部有干扰") }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="text-lg font-bold">{{ $t("形象视频要求") }}</div>
                    <div class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs">
                        <div>{{ $t("1. 视频时长要求在10秒～30秒，视频格式为MP4，建议分辨率1080p~4K") }}</div>
                        <div>
                            {{
                                $t(
                                    "2. 为保障效果，视频必须保证每一帧都要正面露脸，脸部无任何遮挡，并且视频中只能出现同一个人脸"
                                )
                            }}
                        </div>
                        <div>
                            {{
                                $t(
                                    "3. 视频人物建议闭口或微微张口，张口幅度不宜过大，距离镜头一定距离，可根据合成效果自行调整"
                                )
                            }}
                        </div>
                        <div>{{ $t("4. 不能全程闭嘴，可以正常语气循环说 一二三四五六七八九 等文字") }}</div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
