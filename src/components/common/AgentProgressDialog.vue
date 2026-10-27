<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="dialog-overlay">
        <div class="dialog-container">
          <div class="dialog-title">{{ t("智能体生成中...") }}</div>

          <div class="dialog-step">{{ currentStep || t("初始化中...") }}</div>

          <div class="dialog-progress">
            <div class="progress-track"></div>
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            <div class="progress-percent">{{ progressPercent }}%</div>
          </div>

          <div v-if="errorMessage" class="dialog-error">
            <div class="error-icon">!</div>
            <div class="error-text">{{ errorMessage }}</div>
          </div>

          <div class="dialog-buttons">
            <button
              v-if="!errorMessage"
              type="button"
              class="dialog-btn dialog-btn-secondary"
              @click="handleClose"
            >
              {{ t("后台运行") }}
            </button>
            <button
              v-if="!errorMessage"
              type="button"
              class="dialog-btn dialog-btn-danger"
              :disabled="!canCancel"
              @click="handleCancel"
            >
              {{ t("停止运行") }}
            </button>
            <button
              v-if="errorMessage"
              type="button"
              class="dialog-btn dialog-btn-primary"
              @click="handleClose"
            >
              {{ t("关闭") }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '../../lang';

interface Props {
  visible: boolean;
  currentStep?: string;
  progressPercent?: number;
  errorMessage?: string;
  canCancel?: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  currentStep: '',
  progressPercent: 0,
  errorMessage: '',
  canCancel: true
});

const emit = defineEmits<Emits>();

const visible = ref(props.visible);

watch(() => props.visible, (val) => {
  visible.value = val;
});

watch(visible, (val) => {
  emit('update:visible', val);
});

const handleCancel = () => {
  emit('cancel');
};

const handleClose = () => {
  visible.value = false;
  emit('close');
};
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
}

.dialog-container {
  position: relative;
  width: 480px;
  height: 480px;
  max-width: 90vw;
  max-height: 90vw;
  background: rgb(20, 20, 20);
  border-radius: 16px;
  padding: 0 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: dialogIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes dialogIn {
  0% {
    transform: scale(0.85) translateY(20px);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 2px;
  text-align: center;
  margin-top: auto;
  margin-bottom: 12px;
}

.dialog-step {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.dialog-progress {
  position: relative;
  width: 60%;
  height: 24px;
  margin-bottom: auto;
  overflow: hidden;
  border-radius: 10px;
}

.progress-track {
  width: 100%;
  height: 100%;
  background: rgba(50, 50, 50, 0.5);
  border-radius: 10px;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 10px;
  background: linear-gradient(90deg, #f59e0b 0%, #fb7185 50%, #8b5cf6 100%);
  box-shadow: 0 0 12px rgba(251, 113, 133, 0.35);
  transition: width 0.3s ease;
  z-index: 2;
}

.dialog-progress::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 200, 80, 0.5), transparent);
  animation: progressShimmer 1.8s linear infinite;
  pointer-events: none;
  border-radius: 10px;
  z-index: 3;
}

@keyframes progressShimmer {
  0% { left: -60%; }
  100% { left: 100%; }
}

.progress-percent {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  letter-spacing: 1px;
  z-index: 4;
}

.dialog-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  width: 100%;
}

.error-icon {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(239, 68, 68, 0.18);
  color: rgba(239, 68, 68, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.error-text {
  color: rgba(239, 68, 68, 0.85);
  font-size: 12px;
  word-break: break-word;
}

.dialog-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  width: 100%;
  margin-bottom: 36px;
}

.dialog-btn {
  min-width: 128px;
  height: 38px;
  padding: 0 18px;
  border: 0;
  border-radius: 19px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
}

.dialog-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  filter: brightness(1.1);
}

.dialog-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.dialog-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dialog-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  box-shadow: 0 10px 24px rgba(99, 102, 241, 0.35);
}

.dialog-btn-secondary {
  background: linear-gradient(135deg, #334155, #475569);
  box-shadow: 0 10px 24px rgba(71, 85, 105, 0.3);
}

.dialog-btn-danger {
  background: linear-gradient(135deg, #ef4444, #f97316);
  box-shadow: 0 10px 24px rgba(239, 68, 68, 0.3);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .dialog-container {
    width: 90vw;
    padding: 28px 16px 20px;
    gap: 20px;
  }

  .dialog-buttons {
    flex-direction: column;
    align-items: center;
  }

  .dialog-btn {
    width: 100%;
  }
}
</style>
