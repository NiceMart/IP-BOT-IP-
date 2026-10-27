/* Modified for IP Bot: publication preparation, configuration or security changes. See CHANGELOG.md. */
/**
 * 认证服务器配置
 * 配置远程用户管理服务器地址
 */

declare const __IPBOT_AUTH_SERVER_URL__: string;
export const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL ||
    (typeof __IPBOT_AUTH_SERVER_URL__ === 'undefined' ? 'http://127.0.0.1:3002' : __IPBOT_AUTH_SERVER_URL__);

export const USE_REMOTE_AUTH = true;
