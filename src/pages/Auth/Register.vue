<template>
  <div class="auth-appearance"><ThemeSwitch/></div>
  <div class="register-container" :style="registerBgStyle">
    <div class="register-window-controls">
      <div class="register-drag-area"></div>
      <div class="register-control-buttons">
        <button type="button" class="ctrl-btn" aria-label="最小化窗口" @click="windowMin">&#x2500;</button>
        <button type="button" class="ctrl-btn ctrl-close" aria-label="关闭窗口" @click="windowClose">&#x2715;</button>
      </div>
    </div>
    <div class="studio-auth-story"><div class="studio-auth-brand"><img src="/logo.svg" alt="IP Bot 标志"/><strong>IP Bot</strong></div><div class="studio-eyebrow">AI CREATIVE STUDIO</div><h2>让灵感<br/>拥有<span>自己的声音。</span></h2><p>从文案、声音到数字人视频<br/>在一个空间，完成每一次创作。</p><div class="studio-auth-art" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="studio-auth-caption">IMAGINE. CREATE. INSPIRE.</div></div><div class="register-card-wrapper">
    <div class="register-card">
      <div class="register-header"><div class="auth-card-brand"><img src="/logo.svg" alt=""/><span>IP Bot</span></div>
        <h1>创建账户</h1>
        <p>加入我们开始免费试用</p>
      </div>

      <a-alert
        v-if="error"
        type="error"
        :title="error"
        closable
        @close="authStore.clearError"
        style="margin-bottom: 16px"
      />

      <a-form layout="vertical" @submit="handleRegister" :model="formData">
        <a-form-item field="username" label="用户名" :rules="[
          { required: true, message: '用户名不能为空' },
          { minLength: 3, message: '用户名至少3个字符' },
          { maxLength: 20, message: '用户名最多20个字符' }
        ]">
          <a-input
            v-model="formData.username"
            placeholder="请输入用户名（3-20个字符）"
            allow-clear
          />
        </a-form-item>

        <a-form-item field="email" label="手机号" :rules="[
          { required: true, message: '手机号不能为空' },
          { match: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
        ]">
          <a-input
            v-model="formData.email" autocomplete="username" inputmode="tel"
            placeholder="请输入手机号"
            allow-clear
            :max-length="11"
          />
        </a-form-item>

        <a-form-item field="password" label="密码" :rules="[
          { required: true, message: '密码不能为空' },
          { minLength: 6, message: '密码至少6个字符' }
        ]">
          <a-input-password
            v-model="formData.password" autocomplete="new-password"
            placeholder="请输入密码（至少6个字符）"
            allow-clear
          />
        </a-form-item>

        <a-form-item field="confirmPassword" label="确认密码" :rules="[
          { required: true, message: '确认密码不能为空' },
          { validator: validatePasswordMatch }
        ]">
          <a-input-password
            v-model="formData.confirmPassword"
            placeholder="请再次输入密码"
            allow-clear
          />
        </a-form-item>

        <a-form-item field="cdkey" label="卡密">
          <a-input
            v-model="formData.cdkey"
            placeholder="请输入注册卡密"
            allow-clear
          />
        </a-form-item>

        <a-button
          type="primary"
          long
          html-type="submit"
          :loading="authStore.isLoading"
          :disabled="authStore.isLoading"
        >
          {{ authStore.isLoading ? '注册中...' : '注册' }}
        </a-button>
      </a-form>

      <div class="register-footer">
        <p>
          已有账户？
          <router-link to="/login">立即登录</router-link>
        </p>
      </div>

      <div class="register-info">
        <a-alert
          type="info"
          title="注册说明"
          closable
          style="margin-top: 16px"
        >
          <template #default>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>🔑 请联系客服获取本机卡密</li>
              <li>📝 请妥善保管用户名和手机号</li>
              <li>💬 如忘记密码请联系管理员</li>
            </ul>
          </template>
        </a-alert>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ThemeSwitch from "../../components/ThemeSwitch.vue";
import { reactive, computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'

const router = useRouter()
const authStore = useAuthStore()

const previousBodyTheme = ref<string | null>(null)
const previousHtmlTheme = ref<string | null>(null)
const previousArcoTheme = ref<string | null>(null)

const hasRegisterBg = ref(false)
try {
  const img = new Image()
  img.src = './login-bg.png'
  img.onload = () => { hasRegisterBg.value = true }
} catch(e) {}

const registerBgStyle = computed(() => {
  if (hasRegisterBg.value) {
    return {
      backgroundImage: 'url(./login-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {}
})

onMounted(() => {
  previousBodyTheme.value = document.body.getAttribute('data-theme')
  previousHtmlTheme.value = document.documentElement.getAttribute('data-theme')
  previousArcoTheme.value = document.body.getAttribute('arco-theme')

  // Use the shared studio theme on authentication screens as well.
})



const formData = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  cdkey: ''
})

const error = computed(() => authStore.error)

const windowMin = () => {
  window.$mapi?.app?.windowMin?.()
}

const windowClose = () => {
  window.$mapi?.app?.windowClose?.('main')
}

const validatePasswordMatch = (value: string, cb: any) => {
  if (value && value !== formData.password) {
    cb('两次输入的密码不一致')
  } else {
    cb()
  }
}

const handleRegister = async () => {
  try {
    authStore.clearError()

    if (!formData.username || formData.username.length < 3) {
      authStore.error = '用户名至少3个字符'
      return
    }

    if (!formData.email || !/^1[3-9]\d{9}$/.test(formData.email)) {
      authStore.error = '请输入有效的手机号'
      return
    }

    if (!formData.password || formData.password.length < 6) {
      authStore.error = '密码至少6个字符'
      return
    }

    if (formData.password !== formData.confirmPassword) {
      authStore.error = '两次输入的密码不一致'
      return
    }

    const result = await authStore.register(
      formData.username,
      formData.email,
      formData.password,
      formData.cdkey || undefined
    )

    if (result.success) {
      router.push('/')
    }
  } catch (error: any) {
    authStore.error = error.message || '注册失败'
  }
}
</script>

<style scoped lang="less">
.register-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 0;
  position: relative;

  .register-window-controls {
    display: flex;
    align-items: center;
    height: 36px;
    flex-shrink: 0;

    .register-drag-area {
      flex: 1;
      height: 100%;
      -webkit-app-region: drag;
    }

    .register-control-buttons {
      display: flex;
      -webkit-app-region: no-drag;

      .ctrl-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        transition: all 0.15s;

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
        }

        &.ctrl-close:hover {
          background: #e81123;
          color: #fff;
        }
      }
    }
  }

  .register-card-wrapper {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .register-card {
    width: 100%;
    max-width: 400px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 32px;

    .register-header {
        text-align: center;
        margin-bottom: 24px;

        h1 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: #000;
        }

        p {
          font-size: 14px;
          color: #333;
          margin: 0;
        }
      }

      .register-footer {
        text-align: center;
        margin-top: 16px;

        p {
          margin: 0;
          font-size: 14px;
          color: #333;

          a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;

            &:hover {
              text-decoration: underline;
            }
          }
        }
      }

    .register-info {
      margin-top: 16px;
    }

    :deep(.a-form-item-label) {
      color: #000 !important;
      font-weight: 500;
    }

    :deep(.a-form-item-label-content) {
      color: #000 !important;
      font-weight: 500;
    }

    :deep(.a-input::placeholder) {
      color: #666 !important;
    }

    :deep(.a-input-password::placeholder) {
      color: #666 !important;
    }
  }
}
</style>
<style scoped>.auth-appearance{position:fixed;right:148px;top:12px;z-index:50;-webkit-app-region:no-drag}@media(max-width:600px){.auth-appearance{right:12px;top:48px}}</style>
