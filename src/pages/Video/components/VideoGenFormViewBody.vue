<script setup lang="ts">
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import ParamFormView from "../../../components/common/ParamFormView.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <ServerNameVersion v-if="data.serverTitle" :record="data" />
    <a-tag v-if="data.videoTemplateName" class="rounded-lg">
        <i class="iconfont icon-video-template w-5"></i>
        {{ data.videoTemplateName }}
    </a-tag>
    <ParamFormView v-if="data.param" :param="data.param" />
</template>
