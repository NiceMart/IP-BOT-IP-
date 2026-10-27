import "vue";

declare module "@vue/runtime-core" {
    interface ComponentCustomProperties {
        $mapi: DefsMapi;
    }
}

export {};
