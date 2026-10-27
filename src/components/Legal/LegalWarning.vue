<template>
  <div class="legal-warning-container">
    <!-- 违法行为警告横幅 -->
    <div class="warning-banner">
      <a-alert
        type="warning"
        closable
        show-icon
        :title="t('warning.illegalBehavior')"
        :content="t('warning.illegalBehaviorContent')"
        class="warning-alert"
      />
    </div>

    <!-- 法律免责声明 -->
    <div class="disclaimer-section">
      <a-card :title="t('legal.disclaimer')" class="disclaimer-card">
        <template #extra>
          <a-button size="small" type="text" @click="showFullDisclaimer = !showFullDisclaimer">
            {{ showFullDisclaimer ? t('common.collapse') : t('common.expand') }}
          </a-button>
        </template>

        <div class="disclaimer-content" v-if="showFullDisclaimer">
          <div class="disclaimer-item">
            <h4>{{ t('legal.disclaimerTitle1') }}</h4>
            <p>{{ t('legal.disclaimerText1') }}</p>
          </div>

          <div class="disclaimer-item">
            <h4>{{ t('legal.disclaimerTitle2') }}</h4>
            <ul>
              <li>{{ t('legal.disclaimerText2_1') }}</li>
              <li>{{ t('legal.disclaimerText2_2') }}</li>
              <li>{{ t('legal.disclaimerText2_3') }}</li>
              <li>{{ t('legal.disclaimerText2_4') }}</li>
              <li>{{ t('legal.disclaimerText2_5') }}</li>
            </ul>
          </div>

          <div class="disclaimer-item">
            <h4>{{ t('legal.disclaimerTitle3') }}</h4>
            <p>{{ t('legal.disclaimerText3') }}</p>
          </div>

          <div class="disclaimer-item">
            <h4>{{ t('legal.disclaimerTitle4') }}</h4>
            <p>{{ t('legal.disclaimerText4') }}</p>
          </div>

          <div class="disclaimer-item">
            <h4>{{ t('legal.disclaimerTitle5') }}</h4>
            <p>{{ t('legal.disclaimerText5') }}</p>
          </div>
        </div>

        <div class="disclaimer-brief" v-if="!showFullDisclaimer">
          <p>{{ t('legal.disclaimerBrief') }}</p>
        </div>
      </a-card>
    </div>

    <!-- 用户确认复选框 -->
    <div class="user-acknowledgment">
      <a-checkbox v-model="userAcknowledged" :disabled="disableAcknowledgment">
        {{ t('legal.acknowledgmentText') }}
      </a-checkbox>
      <span v-if="!userAcknowledged" class="warning-text">
        ⚠️ {{ t('legal.mustAcknowledge') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted } from 'vue';
import { t } from '../../lang';
import { StorageUtil } from '../../lib/storage';

interface Props {
  disableAcknowledgment?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disableAcknowledgment: false
});

const showFullDisclaimer = ref(false);
const userAcknowledged = ref(false);

onMounted(() => {
  // 从本地存储读取用户是否已确认
  const acknowledged = StorageUtil.get('legal_acknowledged');
  userAcknowledged.value = acknowledged === 'true';
});

// 监听用户确认状态变化
const handleAcknowledgmentChange = (value: boolean) => {
  if (value) {
    StorageUtil.set('legal_acknowledged', 'true');
  }
};

defineExpose({
  userAcknowledged
});
</script>

<style scoped lang="less">
.legal-warning-container {
  width: 100%;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .warning-banner {
    margin-bottom: 16px;

    :deep(.arco-alert) {
      background-color: rgba(255, 209, 0, 0.1) !important;
      border-color: #ffd100 !important;
    }
  }

  .disclaimer-section {
    margin-bottom: 16px;

    .disclaimer-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);

      .disclaimer-content {
        max-height: 400px;
        overflow-y: auto;
        padding: 16px 0;

        .disclaimer-item {
          margin-bottom: 16px;
          line-height: 1.6;

          h4 {
            margin: 8px 0;
            color: #ffd100;
            font-weight: 600;
          }

          p {
            margin: 0;
            color: rgba(255, 255, 255, 0.85);
            font-size: 13px;
          }

          ul {
            margin: 0;
            padding-left: 20px;
            color: rgba(255, 255, 255, 0.85);
            font-size: 13px;

            li {
              margin: 6px 0;
            }
          }
        }
      }

      .disclaimer-brief {
        padding: 8px 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        line-height: 1.5;
      }
    }
  }

  .user-acknowledgment {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 0, 0, 0.05);
    border: 1px solid rgba(255, 0, 0, 0.2);
    border-radius: 6px;

    .warning-text {
      color: #ff4d4f;
      font-size: 12px;
      font-weight: 500;
    }

    :deep(.arco-checkbox) {
      margin-right: 0;
    }
  }
}
</style>
