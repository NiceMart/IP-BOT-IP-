/**
 * 阿里云 OSS 文件上传模块
 * 使用官方 ali-oss SDK
 * 文档: https://help.aliyun.com/zh/oss/user-guide/simple-upload
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import logger from '../log/main';

// 动态导入 ali-oss
let OSS: any = null;

async function getOssClient() {
    if (!OSS) {
        try {
            // 尝试动态导入 ali-oss
            OSS = await import('ali-oss').then((m: any) => m.default || m);
        } catch (e) {
            logger.error('[Aliyun:OSS] ali-oss 模块未安装，使用 HTTP API');
            return null;
        }
    }
    return OSS;
}

export interface OssConfig {
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    region: string;  // 如 oss-cn-beijing
    endpoint?: string;
}

export interface OssUploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * 上传文件到阿里云OSS
 */
export async function uploadToOss(
    filePath: string,
    config: OssConfig,
    objectKey?: string
): Promise<OssUploadResult> {
    try {
        config = {
            accessKeyId: (config.accessKeyId || '').trim(),
            accessKeySecret: (config.accessKeySecret || '').trim(),
            bucket: (config.bucket || '').trim(),
            region: (config.region || '').trim(),
            endpoint: (config.endpoint || '').trim(),
        };

        if (config.endpoint && !config.endpoint.startsWith('http')) {
            config.endpoint = `https://${config.endpoint}`;
        }

        logger.info('[Aliyun:OSS] 开始上传文件', { filePath, bucket: config.bucket, region: config.region });

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return { success: false, error: `文件不存在: ${filePath}` };
        }

        // 生成ObjectKey（如果未指定）
        if (!objectKey) {
            const ext = path.extname(filePath);
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            objectKey = `audio/${timestamp}_${random}${ext}`;
        }

        // 尝试使用 ali-oss SDK
        const OssClass = await getOssClient();

        if (OssClass) {
            const clientConfig: any = {
                accessKeyId: config.accessKeyId,
                accessKeySecret: config.accessKeySecret,
                bucket: config.bucket,
                secure: true,
            };

            if (config.endpoint) {
                clientConfig.endpoint = config.endpoint;
            } else if (config.region) {
                clientConfig.region = config.region;
            } else {
                return { success: false, error: '缺少 region 配置' };
            }

            logger.info('[Aliyun:OSS] SDK clientConfig:', {
                bucket: clientConfig.bucket,
                bucketType: typeof clientConfig.bucket,
                region: clientConfig.region,
                endpoint: clientConfig.endpoint,
            });

            logger.info('[Aliyun:OSS] 使用 SDK 上传', { objectKey, region: config.region, endpoint: config.endpoint });

            const client = new OssClass(clientConfig);

            try {
                const result = await client.put(objectKey, filePath);

                if (result.res.status === 200) {
                    // 生成签名 URL（有效期1小时），供 FunASR API 访问
                    const signedUrl = client.signatureUrl(objectKey, {
                        expires: 3600,  // 1小时有效期
                        method: 'GET'
                    });

                    logger.info('[Aliyun:OSS] SDK上传成功，已生成签名URL', {
                        objectKey,
                        signedUrl: signedUrl.substring(0, 100) + '...'  // 只记录部分URL
                    });
                    return { success: true, url: signedUrl };
                } else {
                    logger.error('[Aliyun:OSS] SDK上传失败', result);
                    throw new Error(`上传失败: HTTP ${result.res.status}`);
                }
            } catch (sdkError: any) {
                logger.warn('[Aliyun:OSS] SDK上传失败，降级到 HTTP API', { error: sdkError.message });
                // SDK 失败，降级到 HTTP API 方式
                return await uploadToOssViaHttp(filePath, config, objectKey);
            }
        } else {
            // ali-oss 未安装，使用 HTTP API 方式
            return await uploadToOssViaHttp(filePath, config, objectKey);
        }

    } catch (error: any) {
        logger.error('[Aliyun:OSS] 上传异常', error);

        let errorMsg = error.message || '未知错误';
        if (error.code) {
            errorMsg = `${error.code}: ${error.message}`;
        }

        return { success: false, error: errorMsg };
    }
}

/**
 * 使用 HTTP API 方式上传（备用方案）
 */
function generateSignedUrl(config: OssConfig, objectKey: string, expires: number): string {
    const expireTime = Math.floor(Date.now() / 1000) + expires;
    const resource = `/${config.bucket}/${objectKey}`;
    const stringToSign = `GET\n\n\n${expireTime}\n${resource}`;
    const hmac = crypto.createHmac('sha1', config.accessKeySecret);
    hmac.update(stringToSign);
    const signature = encodeURIComponent(hmac.digest('base64'));
    return `https://${config.bucket}.${config.region}.aliyuncs.com/${objectKey}?OSSAccessKeyId=${config.accessKeyId}&Expires=${expireTime}&Signature=${signature}`;
}

async function uploadToOssViaHttp(
    filePath: string,
    config: OssConfig,
    objectKey: string
): Promise<OssUploadResult> {
    try {
        logger.info('[Aliyun:OSS] 使用 HTTP API 上传');

        const fileContent = fs.readFileSync(filePath);
        const fileSize = fileContent.length;

        // 确定Content-Type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac',
        };
        const contentType = contentTypeMap[ext] || 'application/octet-stream';

        // 生成Date
        const date = new Date().toUTCString();

        // 构建URL
        const host = `${config.bucket}.${config.region}.aliyuncs.com`;
        const resource = `/${config.bucket}/${objectKey}`;

        // 构建StringToSign (V1签名)
        const stringToSign = [
            'PUT',
            '',  // Content-MD5 留空
            contentType,
            date,
            resource
        ].join('\n');

        // 计算HMAC-SHA1签名
        const hmac = crypto.createHmac('sha1', config.accessKeySecret);
        hmac.update(stringToSign);
        const signature = hmac.digest('base64');

        // 发送上传请求
        const url = `https://${host}/${objectKey}`;

        const response = await axios.put(url, fileContent, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileSize.toString(),
                'Date': date,
                'Authorization': `OSS ${config.accessKeyId}:${signature}`,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000
        });

        if (response.status === 200) {
            const unsignedUrl = url;
            const signedUrl = generateSignedUrl(config, objectKey, 3600);
            logger.info('[Aliyun:OSS] HTTP API上传成功', { url: unsignedUrl, signedUrl: signedUrl.substring(0, 100) + '...' });
            return { success: true, url: signedUrl };
        } else {
            logger.error('[Aliyun:OSS] HTTP API上传失败', { status: response.status });
            return { success: false, error: `上传失败: HTTP ${response.status}` };
        }

    } catch (error: any) {
        logger.error('[Aliyun:OSS] HTTP API上传异常', error);

        let errorMsg = error.message || '未知错误';
        if (error.response?.data) {
            const data = error.response.data;
            if (typeof data === 'string' && data.includes('<Message>')) {
                const match = data.match(/<Message>(.*?)<\/Message>/);
                if (match) {
                    errorMsg = match[1];
                }
            }
        }

        return { success: false, error: errorMsg };
    }
}

/**
 * 从配置中获取OSS配置
 */
export function getOssConfigFromProvider(providerData: any): OssConfig | null {
    if (!providerData?.ossAccessKeyId || !providerData?.ossAccessKeySecret ||
        !providerData?.ossBucket || !providerData?.ossRegion) {
        return null;
    }

    return {
        accessKeyId: providerData.ossAccessKeyId,
        accessKeySecret: providerData.ossAccessKeySecret,
        bucket: providerData.ossBucket,
        region: providerData.ossRegion,
        endpoint: providerData.ossEndpoint
    };
}
