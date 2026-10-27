import { defineStore } from 'pinia'
import authService from '@/service/auth'

interface User {
    id: number
    username: string
    email: string
    avatar?: string | null
    role: 'admin' | 'user'
    status: 'active' | 'inactive' | 'suspended'
    points?: number
    cloud_digital_human_disabled?: boolean
    video_quota?: number
    video_used?: number
    created_at: string
    updated_at: string
    last_login_at?: string | null
}

interface Subscription {
    id: number
    user_id: number
    subscription_type: 'trial' | 'free' | 'pro'
    expires_at: string
    trial_started_at?: string | null
    created_at: string
    updated_at: string
}

interface AuthState {
    token: string | null
    user: User | null
    subscription: Subscription | null
    isLoading: boolean
    error: string | null
    isAuthenticated: boolean
}

let _lastRefreshTime = 0
let _lastRefreshResult: any = null
const REFRESH_CACHE_MS = 30000

export const useAuthStore = defineStore('auth', {
    state(): AuthState {
        return {
            token: authService.getToken(),
            user: authService.getUser(),
            subscription: authService.getSubscription(),
            isLoading: false,
            error: null,
            isAuthenticated: authService.isAuthenticated()
        }
    },

    getters: {
        // 检查是否已登录
        isLoggedIn(): boolean {
            return this.isAuthenticated && !!this.token && !!this.user
        },

        // 检查是否为管理员
        isAdmin(): boolean {
            return this.user?.role === 'admin'
        },

        // 获取用户名
        username(): string {
            return this.user?.username || ''
        },

        // 获取手机号
        phone(): string {
            return this.user?.email || ''
        },

        // 获取剩余天数
        remainingDays(): number {
            if (!this.subscription?.expires_at) {
                return 0
            }

            const expiresAt = new Date(this.subscription.expires_at)
            const now = new Date()
            const diffTime = expiresAt.getTime() - now.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            return diffDays > 0 ? diffDays : 0
        },

        // 获取已使用天数（从订阅创建开始计算）
        usedDays(): number {
            if (!this.subscription?.created_at) {
                return 0
            }
            const createdAt = new Date(this.subscription.created_at)
            const now = new Date()
            const diffTime = now.getTime() - createdAt.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return diffDays > 0 ? diffDays : 0
        },

        // 获取用户积分
        userPoints(): number {
            return this.user?.points || 0
        },

        // 检查订阅是否过期
        isSubscriptionExpired(): boolean {
            if (!this.subscription) return true
            const expiresAt = new Date(this.subscription.expires_at)
            const now = new Date()
            return now > expiresAt
        },

        // 视频配额剩余
        videoQuotaRemaining(): number {
            const quota = this.user?.video_quota || 0
            const used = this.user?.video_used || 0
            return Math.max(0, quota - used)
        },

        // 视频配额是否已用完
        isVideoQuotaExhausted(): boolean {
            const quota = this.user?.video_quota || 0
            const used = this.user?.video_used || 0
            return quota > 0 && used >= quota
        },

        // 获取剩余时间显示文字
        remainingTimeDisplay(): string {
            const days = this.remainingDays
            if (days > 0) {
                return `剩余 ${days} 天`
            } else if (days === 0) {
                return '今天过期'
            } else {
                return '已过期'
            }
        },

        // 获取订阅类型显示文字
        subscriptionTypeDisplay(): string {
            const type = this.subscription?.subscription_type || 'unknown'
            const typeMap: Record<string, string> = {
                trial: '试用',
                free: '免费',
                pro: '专业版'
            }
            return typeMap[type] || type
        }
    },

    actions: {
        // 用户注册
        async register(username: string, email: string, password: string, cdkey?: string) {
            this.isLoading = true
            this.error = null

            try {
                const result = await authService.register({ username, email, password, cdkey })

                if (result.success) {
                    this.token = result.token || null
                    this.user = result.user || null
                    this.subscription = result.subscription || null
                    this.isAuthenticated = true
                }

                this.error = result.message || null
                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    success: false,
                    message: error.message
                }
            } finally {
                this.isLoading = false
            }
        },

        // 用户登录
        async login(email: string, password: string, rememberMe?: boolean) {
            this.isLoading = true
            this.error = null

            try {
                const result = await authService.login({ email, password, rememberMe })

                if (result.success) {
                    this.token = result.token || null
                    this.user = result.user || null
                    this.subscription = result.subscription || null
                    this.isAuthenticated = true
                }

                this.error = result.message || null
                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    success: false,
                    message: error.message
                }
            } finally {
                this.isLoading = false
            }
        },

        // 用户登出
        async logout() {
            this.isLoading = true

            try {
                const result = await authService.logout()

                if (result.success) {
                    this.token = null
                    this.user = null
                    this.subscription = null
                    this.isAuthenticated = false
                }

                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    success: false,
                    message: error.message
                }
            } finally {
                this.isLoading = false
            }
        },

        // 验证 Token
        async verifyToken(token?: string) {
            try {
                const result = await authService.verifyToken(token)
                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    valid: false,
                    message: error.message
                }
            }
        },

        // 获取当前用户信息（从后端）
        async getCurrentUser(token?: string) {
            this.isLoading = true
            this.error = null

            try {
                const result = await authService.getCurrentUser(token)

                if (result.success) {
                    this.user = result.user || null
                    this.subscription = result.subscription || null
                }

                this.error = result.message || null
                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    success: false,
                    message: error.message
                }
            } finally {
                this.isLoading = false
            }
        },

        // 检查订阅状态
        async checkSubscriptionStatus(userId?: number) {
            try {
                const result = await authService.checkSubscriptionStatus(userId)

                if (result.subscription) {
                    this.subscription = result.subscription
                }

                return result
            } catch (error: any) {
                this.error = error.message
                return {
                    hasAccess: false,
                    isExpired: true,
                    message: error.message
                }
            }
        },

        // 检查是否可以访问应用
        async canAccess(): Promise<boolean> {
            return await authService.canAccess()
        },

        async refreshAuthState() {
            const token = this.token || authService.getToken()
            if (!token) {
                this.token = null
                this.user = null
                this.subscription = null
                this.isAuthenticated = false
                return { status: 'unauthenticated' as const }
            }

            const now = Date.now()
            if (_lastRefreshResult && (now - _lastRefreshTime) < REFRESH_CACHE_MS && this.isAuthenticated) {
                return _lastRefreshResult
            }

            const verifyResult = await authService.verifyToken(token)
            if ((verifyResult as any).apiUnavailable) {
                return {
                    status: 'pending' as const,
                    message: verifyResult.message
                }
            }

            if (!verifyResult.valid) {
                this.token = null
                this.user = null
                this.subscription = null
                this.isAuthenticated = false
                _lastRefreshResult = null
                _lastRefreshTime = 0

                if ((verifyResult as any).kicked) {
                    return {
                        status: 'kicked' as const,
                        message: verifyResult.message || '您的账号已在其他设备登录，当前会话已失效'
                    }
                }

                if ((verifyResult as any).disabled) {
                    return {
                        status: 'unauthenticated' as const,
                        message: verifyResult.message || '您的账号已被管理员禁用',
                        disabled: true,
                        verifyResult
                    }
                }

                return {
                    status: 'unauthenticated' as const,
                    message: verifyResult.message
                }
            }

            const currentUserResult = await authService.getCurrentUser(token)
            if (!currentUserResult.success || !currentUserResult.user) {
                this.token = null
                this.user = null
                this.subscription = null
                this.isAuthenticated = false
                _lastRefreshResult = null
                _lastRefreshTime = 0
                return {
                    status: 'unauthenticated' as const,
                    message: currentUserResult.message
                }
            }

            this.token = token
            this.user = currentUserResult.user || null
            this.subscription = currentUserResult.subscription || null
            this.isAuthenticated = true
            this.error = null

            if (this.isSubscriptionExpired) {
                _lastRefreshTime = now
                _lastRefreshResult = { status: 'expired' as const }
                return _lastRefreshResult
            }

            _lastRefreshTime = now
            _lastRefreshResult = { status: 'authenticated' as const }
            return _lastRefreshResult
        },

        // 清除错误信息
        clearError() {
            this.error = null
        }
    }
})
