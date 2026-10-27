<template>
  <a-select
    v-model="modelValue"
    :loading="loading"
    :placeholder="placeholder"
    :filter-option="false"
    @search="handleSearch"
    @change="handleChange"
  >
    <a-option
      v-for="option in filteredOptions"
      :key="option.value"
      :value="option.value"
    >
      {{ option.label }}
    </a-option>
  </a-select>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: string | number;
  options: Array<{ label: string; value: string | number }>;
  loading?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'change', value: string | number): void;
  (e: 'search', value: string): void;
}>();

const searchValue = ref('');

const filteredOptions = computed(() => {
  if (!searchValue.value) return props.options;

  return props.options.filter(option =>
    option.label.toLowerCase().includes(searchValue.value.toLowerCase())
  );
});

const handleSearch = (value: string) => {
  searchValue.value = value;
  emit('search', value);
};

const handleChange = (value: string | number) => {
  emit('update:modelValue', value);
  emit('change', value);
};
</script>