<template>
  <button
    class="gradient-button"
    :class="{
      'is-loading': loading,
      'is-disabled': disabled,
      'is-stop': type === 'stop',
      'is-background': type === 'background'
    }"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <div class="btn-shimmer"></div>
    <div class="btn-content">
      <slot />
    </div>
    <span v-if="loading" class="loading-spinner"></span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
  disabled?: boolean
  type?: 'default' | 'stop' | 'background'
}

withDefaults(defineProps<Props>(), {
  type: 'default'
})
defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
.gradient-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 28px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  border: none;
  outline: none;
  cursor: pointer;
  overflow: hidden;
  border-radius: 28px;
  background: linear-gradient(135deg, #f97316 0%, #fb923c 25%, #f472b6 55%, #c084fc 100%);
  box-shadow:
    0 4px 15px rgba(249, 115, 22, 0.35),
    0 2px 8px rgba(196, 132, 252, 0.2);
  transition: all 0.3s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow:
      0 6px 20px rgba(249, 115, 22, 0.45),
      0 4px 12px rgba(196, 132, 252, 0.3);

    .btn-shimmer {
      animation: shimmer 1.5s ease-in-out infinite;
    }
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
    box-shadow:
      0 2px 10px rgba(249, 115, 22, 0.3),
      0 1px 4px rgba(196, 132, 252, 0.15);
  }

  &.is-stop {
    background: linear-gradient(135deg, #ef4444 0%, #f87171 40%, #fda4af 100%);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.35);
    &:hover:not(:disabled) {
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.45);
    }
  }

  &.is-background {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 40%, #93c5fd 100%);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.35);
    &:hover:not(:disabled) {
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45);
    }
  }

  &.is-loading {
    pointer-events: none;
    opacity: 0.85;
  }

  &.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
    filter: grayscale(0.4);
  }
}

.btn-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 100%
  );
  pointer-events: none;
}

.btn-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.loading-spinner {
  position: relative;
  z-index: 1;
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
