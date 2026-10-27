<template>
  <a-color-picker
    v-model="internalValue"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
}>();

const internalValue = ref(props.modelValue);

watch(() => props.modelValue, (newValue) => {
  internalValue.value = newValue;
});

const handleChange = (value: string) => {
  internalValue.value = value;
  emit('update:modelValue', value);
  emit('change', value);
};
</script>