<template>
  <div class="ip-agent-warning">
    <!-- 违法行为警告横幅 -->
    <a-alert
      v-if="showBanner"
      type="error"
      banner
      closable
      class="warning-alert"
      @close="handleBannerClose"
    >
      <template #icon>
        <icon-exclamation-circle-fill />
      </template>
      <div class="warning-content">
        <div class="warning-title">声音与形象使用提示</div>
        <div class="warning-text">
          本软件涉及<strong>视频采集、声音合成克隆、数字人合成、形象克隆</strong>等AI技术，使用者<strong>必须严格遵守法律法规</strong>！
          严禁用于任何<strong>非法用途、侵权行为、诈骗活动</strong>等违法犯罪行为。
          <a-button type="text" size="small" @click="showDetailDialog = true" style="padding: 0 4px;">
            查看完整法律声明
          </a-button>
        </div>
      </div>
    </a-alert>

    <!-- 详细法律声明对话框 -->
    <a-modal
      v-model:visible="showDetailDialog"
      title="法律免责声明与使用条款"
      :width="800"
      :footer="false"
      unmount-on-close
    >
      <div class="disclaimer-dialog">
        <div class="disclaimer-section">
          <h3>⚖️ 一、软件性质与合法用途</h3>
          <p>
            本软件（以下简称"本软件"）是一款基于人工智能技术的内容创作辅助工具，
            旨在为用户提供<strong>合法的、创意性的内容生成服务</strong>。本软件所包含的视频采集、声音合成克隆、数字人合成、形象克隆等功能，
            <strong>仅限用于合法、正当、授权的创作场景</strong>，例如：
          </p>
          <ul>
            <li>✅ 用户对<strong>本人</strong>的声音和形象进行克隆，用于个人创作</li>
            <li>✅ 经<strong>明确授权</strong>，对他人的声音、形象进行合法使用</li>
            <li>✅ 用于<strong>教育、学习、研究</strong>等非商业性质的合法目的</li>
            <li>✅ 符合法律法规和平台规定的<strong>商业创作</strong>活动</li>
          </ul>
        </div>

        <div class="disclaimer-section danger-zone">
          <h3>🚫 二、严格禁止的违法行为</h3>
          <p class="danger-text">
            <strong>使用本软件进行以下任何行为均属违法，一经发现将立即报警处理，并配合执法机关追究法律责任：</strong>
          </p>
          <ul class="danger-list">
            <li>❌ <strong>未经授权克隆他人声音、形象</strong>，侵犯他人肖像权、声音权</li>
            <li>❌ <strong>制作虚假、欺骗性内容</strong>，进行诈骗、敲诈勒索等违法犯罪活动</li>
            <li>❌ <strong>传播淫秽、色情、暴力、恐怖主义</strong>等违法有害信息</li>
            <li>❌ <strong>冒充他人身份</strong>，制作假冒视频、音频进行不正当商业竞争</li>
            <li>❌ <strong>侵犯知识产权</strong>，非法复制、传播受版权保护的内容</li>
            <li>❌ <strong>制作深度伪造（Deepfake）内容</strong>，用于政治造谣、诽谤他人、散布虚假信息</li>
            <li>❌ 任何其他<strong>违反《中华人民共和国刑法》《中华人民共和国民法典》《网络安全法》</strong>等法律法规的行为</li>
          </ul>
        </div>

        <div class="disclaimer-section">
          <h3>📢 三、法律责任声明</h3>
          <p>
            <strong>1. 用户责任：</strong>用户对使用本软件所产生的一切内容及后果承担<strong>完全法律责任</strong>。
            用户保证其使用本软件的行为<strong>完全合法</strong>，并已获得所有必要的授权和许可。
          </p>
          <p>
            <strong>2. 软件开发者免责：</strong>本软件开发者、发行者（以下简称"开发者"）
            <strong>不对用户使用本软件从事的任何违法行为承担责任</strong>。
            用户因违法使用本软件而导致的任何民事、行政或刑事责任，<strong>均由用户本人独立承担</strong>，
            与开发者无关。
          </p>
          <p>
            <strong>3. 连带责任排除：</strong>若用户因违法使用本软件导致第三方权益受损，
            第三方仅可向<strong>违法使用者本人</strong>追责，<strong>不得</strong>要求开发者承担连带责任。
          </p>
          <p>
            <strong>4. 配合执法：</strong>若用户使用本软件从事违法犯罪活动，
            开发者<strong>有权且有义务</strong>向执法机关提供用户信息，并<strong>全力配合调查</strong>。
          </p>
        </div>

        <div class="disclaimer-section">
          <h3>✅ 四、使用条款确认</h3>
          <p>
            使用本软件即表示用户已<strong>完全理解、同意并承诺遵守</strong>以上所有条款。
            若用户不同意上述条款，请<strong>立即停止使用</strong>本软件并卸载。
          </p>
          <p class="final-warning">
            <strong>⚠️ 最后警告：</strong>
            任何违法使用行为都将受到法律的严厉制裁！请珍惜自己的前途，依法合规使用本软件！
          </p>
        </div>

        <div class="acknowledgment-section">
          <a-checkbox v-model="acknowledged">
            <span class="acknowledgment-text">
              我已完全阅读、理解并同意遵守上述法律声明与使用条款，
              <strong>保证合法合规使用本软件，并对自己的使用行为承担全部法律责任</strong>
            </span>
          </a-checkbox>
        </div>

        <div class="dialog-footer">
          <a-button type="primary" :disabled="!acknowledged" @click="handleConfirm">
            我已知晓，确认并同意
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IconExclamationCircleFill } from '@arco-design/web-vue/es/icon';

const showDetailDialog = ref(false);
const acknowledged = ref(false);
const showBanner = ref(false);

onMounted(() => {
  const isAcknowledged = localStorage.getItem('legal_ip_agent_acknowledged');
  const sessionShown = sessionStorage.getItem('legal_ip_agent_dialog_shown');
  if (isAcknowledged !== 'true' && sessionShown !== 'true') {
    sessionStorage.setItem('legal_ip_agent_dialog_shown', 'true');
    // Full terms remain available from the contextual notice; do not interrupt launch.
  } else {
    acknowledged.value = true;
  }
});

const handleBannerClose = () => {
  // 关闭横幅并记录到 sessionStorage
  showBanner.value = false;
  sessionStorage.setItem('legal_ip_agent_banner_closed', 'true');
};

const handleConfirm = () => {
  if (acknowledged.value) {
    localStorage.setItem('legal_ip_agent_acknowledged', 'true');
    showDetailDialog.value = false;
  }
};
</script>

<style scoped lang="less">
.ip-agent-warning {
  width: 100%;

  .warning-alert {
    :deep(.arco-alert-body) {
      padding: 12px 16px;
    }

    .warning-content {
      .warning-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 6px;
        color: #ff4d4f;
      }

      .warning-text {
        font-size: 13px;
        line-height: 1.6;

        strong {
          color: #ff4d4f;
          font-weight: 600;
        }
      }
    }
  }
}

.disclaimer-dialog {
  max-height: 70vh;
  overflow-y: auto;
  padding: 8px 0;

  .disclaimer-section {
    margin-bottom: 24px;
    line-height: 1.8;

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--color-text-1);
      border-left: 4px solid rgb(var(--primary-6));
      padding-left: 12px;
    }

    p {
      margin: 8px 0;
      font-size: 14px;
      color: var(--color-text-2);
    }

    ul {
      margin: 8px 0;
      padding-left: 24px;

      li {
        margin: 6px 0;
        font-size: 14px;
        color: var(--color-text-2);

        strong {
          color: var(--color-text-1);
          font-weight: 600;
        }
      }
    }

    &.danger-zone {
      background: rgba(255, 77, 79, 0.05);
      border: 1px solid rgba(255, 77, 79, 0.2);
      border-radius: 6px;
      padding: 16px;

      h3 {
        border-left-color: #ff4d4f;
        color: #ff4d4f;
      }

      .danger-text {
        color: #ff4d4f;
        font-weight: 600;
      }

      .danger-list li {
        color: #ff4d4f;
        font-weight: 500;

        strong {
          color: #d32f2f;
        }
      }
    }

    .final-warning {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 4px;
      padding: 12px;
      margin-top: 12px;
      font-weight: 600;
      color: #fa8c16;
    }
  }

  .acknowledgment-section {
    margin: 24px 0;
    padding: 16px;
    background: rgba(var(--primary-6), 0.05);
    border: 1px solid rgba(var(--primary-6), 0.2);
    border-radius: 6px;

    .acknowledgment-text {
      font-size: 14px;
      line-height: 1.8;
      color: var(--color-text-1);

      strong {
        color: rgb(var(--primary-6));
        font-weight: 600;
      }
    }
  }

  .dialog-footer {
    text-align: center;
    padding-top: 16px;
    border-top: 1px solid var(--color-border-2);
  }
}
</style>
