/**
 * 平台账号信息
 */
export interface PlatformAccount {
    id: number;
    platform: 'douyin' | 'kuaishou' | 'shipin';
    nickname: string;
    uid: string;
    avatar: string;
    cookies: string;
    tokens: string;
    loginStatus: 'active' | 'expired' | 'pending';
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * 登录会话信息
 */
export interface LoginSession {
    sessionId: string;
    platform: string;
    qrCodeUrl: string;
    status: 'pending' | 'success' | 'expired' | 'failed';
    createdAt: number;
}

/**
 * 平台发布参数
 */
export interface PublishParams {
    platform: string;
    accountId: number;
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    location?: string;
    visibility?: 'public' | 'private' | 'friends';
    allowComment?: boolean;
    allowDuet?: boolean;
}

/**
 * 发布结果
 */
export interface PublishResult {
    success: boolean;
    videoUrl?: string;
    videoId?: string;
    platform: string;
    publishTime: number;
    message?: string;
}
