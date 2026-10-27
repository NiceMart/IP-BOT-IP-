<script setup lang="ts">
const props = defineProps<{
    param: {
        [key: string]: any;
    },
}>();
const formatValue = (v: any) => {
    if (true === v) return 'true';
    if (false === v) return 'false';
    if (null === v) return 'null';
    if (undefined === v) return 'undefined';
    if (Array.isArray(v)) return `[${v.map(i => formatValue(i)).join(',')}]`;
    if ('object' === typeof v) return JSON.stringify(v);
    return v;
};
</script>

<template>
    <div v-for="(v,k) in param">
        <a-tag v-if="!(k as string).startsWith('_')" class="rounded-lg">
            <div class="w-5">
                <svg class="w-4 h-4" viewBox="0 0 1024 1024" width="200" height="200">
                    <path
                        d="M305.74999971 361.99999971h206.25000029v56.25H305.74999971zM624.5 418.24999971h93.75000029v-56.25h-93.75000029v-37.49999942h-56.25v131.24999971h56.25zM512 605.75000029h206.25000029v56.25H512zM399.5 699.49999971h56.25v-131.24999971h-56.25v37.50000029h-93.75000029v56.25h93.75000029z"
                        fill="currentColor"
                    ></path>
                    <path
                        d="M840.12499971 155.75000029h-656.24999942C168.875 155.75000029 155.75000029 168.875 155.75000029 183.87500029v656.24999942c0 15.00000029 13.12499971 28.125 28.125 28.125h656.24999942c15.00000029 0 28.125-13.12499971 28.125-28.125v-656.24999942c0-15.00000029-13.12499971-28.125-28.125-28.125zM811.99999971 811.99999971H212.00000029V212.00000029h599.99999942v599.99999942z"
                        fill="currentColor"
                    ></path>
                </svg>
            </div>
            {{ param['_' + k] || k }}
            {{ formatValue(param['__' + k] || v) }}
        </a-tag>
    </div>
</template>
