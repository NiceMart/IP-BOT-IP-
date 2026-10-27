<script setup lang="ts">
import {computed, ref} from "vue";
import {useServerStore} from "../../store/modules/server";
import {doCopy} from "../common/util";
import {Dialog} from "../../lib/dialog";

const serverStore = useServerStore();
const props = defineProps<{
    root: string;
}>();

const running = ref(false);

const passed = ref({
    commands: false,
});

const commands = computed(() => {
    const commands: string[] = [];
    if (window.$mapi.app.isPlatform("osx")) {
        // commands.push('sudo spctl --master-disable')
        commands.push(`sudo xattr -r -d com.apple.quarantine ${props.root}`);
    }
    return commands;
});

const shouldShow = computed(() => {
    if (commands.value.length > 0) {
        return true;
    }
    return false;
});

const doRun = async (type: "commands") => {
    running.value = true;
    const commandString = commands.value.join("; ");
    try {
        await window.$mapi.app.shell(`osascript -e 'do shell script "${commandString}" with administrator privileges'`);
        passed.value.commands = true;
    } catch (e) {
        running.value = false;
        Dialog.alertError("ERROR:" + e).then();
        return;
    }
    running.value = false;
};
const doRunManual = (type: "commands") => {
    passed.value[type] = true;
};

const emit = defineEmits({
    update: (status: "success" | "fail") => true,
});

const reset = () => {
    running.value = false;
    passed.value.commands = false;
};

const isSuccess = () => {
    return computed(() => {
        if (shouldShow.value) {
            for (const p of Object.values(passed.value)) {
                if (!p) {
                    return false;
                }
            }
        }
        return true;
    });
};

defineExpose({
    reset,
    isSuccess,
});
</script>

<template>
    <div v-if="shouldShow">
        <div class="border rounded-lg py-3 mt-3">
            <div class="flex mb-4">
                <div class="w-20 flex-shrink-0 text-right pr-3">{{ $t("修复命令") }}</div>
                <div class="">
                    <div v-if="passed.commands">
                        <div class="mr-2 mb-1">
                            <a-alert type="success">
                                {{ $t("模型文件签名") }}
                            </a-alert>
                        </div>
                    </div>
                    <div v-else>
                        <div class="mr-2 mb-1">
                            <a-alert>
                                {{ $t("由于模型文件未完全签名，请运行以下命令完成签名后运行") }}
                            </a-alert>
                        </div>
                        <div
                            v-for="c in commands"
                            class="mr-2 mb-1 bg-gray-100 p-2 rounded text-sm overflow-auto flex items-start"
                        >
                            <div class="flex-grow">{{ c }}</div>
                            <div class="w-10 text-right flex-shrink-0">
                                <a href="javascript:;" @click="doCopy(c)" class="mr-1">
                                    <icon-copy />
                                </a>
                            </div>
                        </div>
                        <div class="mb-1">
                            <!--                            <a-button @click="doRun('commands')" :loading="running" class="mr-2">-->
                            <!--                                {{ $t('一键运行') }}-->
                            <!--                            </a-button>-->
                            <a-button @click="doRunManual('commands')" class="mr-2">
                                {{ $t("已手动完成") }}
                            </a-button>
                        </div>
                        <div class="mb-1">
                            <div class="text-xs text-gray-500">
                                {{ $t("运行过程可能需要输入密码") }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
