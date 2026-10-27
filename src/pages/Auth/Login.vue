<template>
  <div class="auth-appearance"><ThemeSwitch/></div>
  <div class="login-container" :style="loginBgStyle">
    <div class="login-window-controls">
      <div class="login-drag-area"></div>
      <div class="login-control-buttons">
        <button type="button" class="ctrl-btn" aria-label="最小化窗口" @click="windowMin">&#x2500;</button>
        <button type="button" class="ctrl-btn ctrl-close" aria-label="关闭窗口" @click="windowClose">&#x2715;</button>
      </div>
    </div>
    <div class="studio-auth-story"><div class="studio-auth-brand"><img src="/logo.svg" alt="IP Bot 标志"/><strong>IP Bot</strong></div><div class="studio-eyebrow">数字人创作工作室</div><h2>让灵感<br/>拥有<span>自己的声音。</span></h2><p>从文案、声音到数字人视频<br/>在一个空间，完成每一次创作。</p><div class="studio-auth-art" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="studio-auth-caption">从灵感到作品，在一个空间完成。</div></div><div class="login-card-wrapper">
    <div class="login-card">
      <div class="login-header"><div class="auth-card-brand"><img src="/logo.svg" alt=""/><span>IP Bot</span></div>
        <h1>欢迎回来</h1>
        <p>请输入您的手机号和密码登录</p>
      </div>

      <a-alert
        v-if="error"
        type="error"
        :title="error"
        closable
        @close="authStore.clearError"
        style="margin-bottom: 16px"
      />

      <a-form layout="vertical" @submit="handleLogin" :model="formData">
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
          { required: true, message: '密码不能为空' }
        ]">
          <a-input-password
            v-model="formData.password" autocomplete="current-password"
            placeholder="请输入密码"
            allow-clear
          />
        </a-form-item>

        <a-checkbox v-model="formData.rememberMe">记住我</a-checkbox>

        <a-button
          type="primary"
          long
          html-type="submit"
          :loading="authStore.isLoading"
          :disabled="authStore.isLoading"
          style="margin-top: 16px"
        >
          登录
        </a-button>
      </a-form>

      <div class="login-footer">
        <p>
          还没有账户？
          <router-link to="/register">立即注册</router-link>
        </p>
      </div>

      <div class="login-features">
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ThemeSwitch from "../../components/ThemeSwitch.vue";
import { reactive, computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/store/modules/auth'

const router = useRouter()
const authStore = useAuthStore()

const hasLoginBg = ref(false)
try {
  const img = new Image()
  img.src = './login-bg.png'
  img.onload = () => { hasLoginBg.value = true }
} catch(e) {}

const loginBgStyle = computed(() => {
  if (hasLoginBg.value) {
    return {
      backgroundImage: 'url(./login-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return {}
})

// 初始登录默认预填账号，仅在无“记住我”保存凭据时显示
const DEFAULT_LOGIN_EMAIL = ''
const DEFAULT_LOGIN_PASSWORD = ''

const formData = reactive({
  email: DEFAULT_LOGIN_EMAIL,
  password: DEFAULT_LOGIN_PASSWORD,
  rememberMe: true
})

const previousBodyTheme = ref<string | null>(null)
const previousHtmlTheme = ref<string | null>(null)
const previousArcoTheme = ref<string | null>(null)

onMounted(() => {
  previousBodyTheme.value = document.body.getAttribute('data-theme')
  previousHtmlTheme.value = document.documentElement.getAttribute('data-theme')
  previousArcoTheme.value = document.body.getAttribute('arco-theme')

  // Use the shared studio theme on authentication screens as well.

  const rememberMeFlag = localStorage.getItem('auth_remember_me')
  formData.rememberMe = rememberMeFlag === 'true'
  if (formData.rememberMe) {
    const savedEmail = localStorage.getItem('auth_saved_email')
    localStorage.removeItem('auth_saved_password')
    if (savedEmail) formData.email = savedEmail

  }
})



const error = computed(() => authStore.error)

const windowMin = () => {
  window.$mapi?.app?.windowMin?.()
}

const windowClose = () => {
  window.$mapi?.app?.windowClose?.('main')
}

const handleLogin = async () => {
  console.log('[Login] window.$mapi exists:', !!window['$mapi'], 'auth exists:', !!window['$mapi']?.['auth'])
  try {
    authStore.clearError()

    if (!formData.email || !/^1[3-9]\d{9}$/.test(formData.email)) {
      authStore.error = '请输入有效的手机号'
      return
    }

    if (!formData.password) {
      authStore.error = '密码不能为空'
      return
    }

    const result = await authStore.login(formData.email, formData.password, formData.rememberMe)


    if (result.success) {
      router.push('/')
    }
  } catch (error: any) {
    authStore.error = error.message || '登录失败'
  }
}
</script>

<style scoped lang="less">
.login-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;

  .login-window-controls {
    display: flex;
    align-items: center;
    height: 36px;
    flex-shrink: 0;

    .login-drag-area {
      flex: 1;
      height: 100%;
      -webkit-app-region: drag;
    }

    .login-control-buttons {
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

  .login-card-wrapper {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .login-card {
    width: 100%;
    max-width: 400px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 32px;

    .login-header {
      text-align: center;
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }

      p {
        color: #666;
        margin-top: 8px;
      }
    }
  }

  .login-footer {
    text-align: center;
    margin-top: 16px;

    p {
      color: #666;
    }

    a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .login-features {
    margin-top: 16px;
  }
}
</style>

<style scoped>.auth-appearance{position:fixed;right:148px;top:12px;z-index:50;-webkit-app-region:no-drag}@media(max-width:600px){.auth-appearance{right:12px;top:48px}}</style>
