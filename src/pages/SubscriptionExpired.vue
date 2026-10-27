<template>
  <div class="expired-container">
    <div class="expired-card">
      <div class="expired-header">
        <div class="icon">⏱️</div>
        <h1>试用期已过期</h1>
        <p>您的试用期已经结束，无法继续使用应用</p>
      </div>

      <!-- 过期信息 -->
      <div v-if="subscription" class="expired-info">
        <a-descriptions :data="[
          { label: '过期时间', value: formatDate(subscription.expires_at) },
          { label: '订阅类型', value: subscriptionTypeDisplay },
          { label: '用户账户', value: user?.username || '未知' }
        ]" :column="1" />
      </div>

      <!-- 操作按钮 -->
      <div class="expired-actions">
        <a-alert type="info" title="如何继续使用" closable style="margin-bottom: 16px">
          <template #default>
            <p style="margin: 8px 0;">
              您的试用期已过期。请联系管理员以延期您的账户时长。
            </p>
            <p style="margin: 8px 0; font-size: 12px; color: #999;">
              管理员可以按天、按月或按年为您增加使用时长。
            </p>
          </template>
        </a-alert>

        <!-- 登出按钮 -->
        <a-button type="secondary" long @click="handleLogout" style="margin-top: 16px">
          返回登录
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'

const router = useRouter()
const authStore = useAuthStore()

const user = computed(() => authStore.user)
const subscription = computed(() => authStore.subscription)

// 订阅类型显示
const subscriptionTypeDisplay = computed(() => {
  const type = subscription.value?.subscription_type || 'unknown'
  const typeMap: Record<string, string> = {
    trial: '试用',
    free: '免费',
    pro: '专业版'
  }
  return typeMap[type] || type
})

// 格式化日期
const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    return dateStr
  }
}

// 处理登出
const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped lang="less">
.expired-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 20px;

  .expired-card {
    width: 100%;
    max-width: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    padding: 48px 32px;
    text-align: center;

    .expired-header {
      margin-bottom: 32px;

      .icon {
        font-size: 64px;
        margin-bottom: 16px;
        animation: pulse 2s infinite;
      }

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #333;
        margin: 0 0 8px 0;
      }

      p {
        font-size: 14px;
        color: #999;
        margin: 0;
      }
    }

    .expired-info {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;

      :deep(.arco-descriptions) {
        .arco-descriptions-item {
          margin-bottom: 12px;

          &:last-child {
            margin-bottom: 0;
          }
        }

        .arco-descriptions-label {
          color: #666;
          font-weight: 500;
        }

        .arco-descriptions-value {
          color: #333;
        }
      }
    }

    .expired-actions {
      text-align: left;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }
  }
}
</style>
