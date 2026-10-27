<template>
  <a-slider
    v-model="internalValue"
    :min="min"
    :max="max"
    :step="step"
    :show-input="showInput"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: number;
  min: number;
  max: number;
  step?: number;
  showInput?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
}>();

const internalValue = ref(props.modelValue);

watch(() => props.modelValue, (newValue) => {
  internalValue.value = newValue;
});

const handleChange = (value: number) => {
  internalValue.value = value;
  emit('update:modelValue', value);
  emit('change', value);
};
</script>