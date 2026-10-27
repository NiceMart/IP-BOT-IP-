<script setup lang="ts">
import {AppConfig} from "../../config";
import {t} from "../../lang";
import UpdaterButton from "../common/UpdaterButton.vue";
import {useSettingStore} from "../../store/modules/setting";
import FeedbackTicketButton from "../common/FeedbackTicketButton.vue";

const setting = useSettingStore();
const licenseYear = new Date().getFullYear();

const doOpenLog = async () => {
    await window.$mapi.app.openPath(window.$mapi.log.root());
};
</script>

<template>
    <div class="py-4">
        <div class="text-center mb-6">
            <img class="w-14 h-14 mx-auto mb-2" src="/logo.svg" />
            <div class="text-2xl font-bold">{{ AppConfig.title }}</div>
        </div>
        <div class="flex mb-4 items-center">
            <div class="w-20 text-gray-400">{{ t("版本") }}</div>
            <div class="flex-grow">
                <span class="text-lg">v{{ AppConfig.version }}</span>
            </div>
            <div class="inline-block ml-3">
                <UpdaterButton />
            </div>
        </div>
        <div class="flex mb-4 items-center">
            <div class="w-20 text-gray-400">{{ t("官网") }}</div>
            <div class="flex-grow">
                <a :href="AppConfig.website" target="_blank" class="text-link">
                    {{ AppConfig.website }}
                </a>
            </div>
            <div>
                <a-button size="mini" @click="doOpenLog">
                    <template #icon>
                        <icon-file />
                    </template>
                    {{ t("日志") }}
                </a-button>
            </div>
        </div>
        <div class="text-gray-500 text-center mt-6 select-none">
            &copy; {{ licenseYear }} {{ AppConfig.title }}
        </div>
    </div>
</template>
