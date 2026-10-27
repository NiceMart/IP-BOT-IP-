/**
 * 发布任务配置
 */
export interface PublishTask {
    id: number;
    title: string;
    videoPath: string;
    coverPath: string;
    platforms: string[];
    publishConfig: {
        [platform: string]: {
            title: string;
            description: string;
            tags: string[];
            location?: string;
            visibility?: 'public' | 'private' | 'friends';
            allowComment?: boolean;
            allowDuet?: boolean;
        }
    };
    scheduledTime: number | null;
    status: 'pending' | 'uploading' | 'processing' | 'published' | 'failed';
    createdAt: number;
    updatedAt: number;
}

/**
 * 发布历史记录
 */
export interface PublishHistory {
    id: number;
    taskId: number;
    platform: string;
    accountId: number;
    videoUrl: string;
    videoId: string;
    status: 'success' | 'failed' | 'verification_required' | 'manual_pending';
    errorMessage: string;
    publishedAt: number;
    viewCount: number;
    likeCount: number;
}

/**
 * 封面适配要求
 */
export interface PlatformCoverRequirements {
    width: number;
    height: number;
    ratio: string;
    maxSize: number; // KB
    format: 'jpg' | 'png' | 'webp';
}

/**
 * 封面适配结果
 */
export interface CoverAdaptResult {
    success: boolean;
    adaptedPath: string;
    originalSize: { width: number; height: number };
    adaptedSize: { width: number; height: number };
    adjustments: string[];
}

/**
 * 执行发布的参数
 */
export interface ExecutePublishParams {
    taskId: number;
    accountId?: number;
    platform?: string;
    videoPath: string;
    coverPath: string;
    title: string;
    description: string;
    tags: string[];
    autoPublish?: boolean;
}

/**
 * 平台账号
 */
export interface PlatformAccount {
    id: number;
    platform: string;
    nickname: string;
    uid: string;
    avatar: string;
    cookies: string;
    tokens: string;
    loginStatus: 'pending' | 'active' | 'expired' | 'failed';
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
}
