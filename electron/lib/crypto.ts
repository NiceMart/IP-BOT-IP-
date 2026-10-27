/**
 * Electron 主进程加密模块
 * 实现 RSA + AES 混合加密
 * 不会被代码混淆破坏
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class CryptoManager {
  private static instance: CryptoManager;
  private publicKeyPath: string;
  private privateKeyPath: string;
  private publicKey: string | null = null;
  private privateKey: string | null = null;

  private constructor() {
    // 密钥存储路径
    const keyDir = path.join(app.getPath('userData'), 'keys');
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }

    this.publicKeyPath = path.join(keyDir, 'public.pem');
    this.privateKeyPath = path.join(keyDir, 'private.pem');

    console.log('[CryptoManager] 初始化，密钥路径:', this.publicKeyPath);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CryptoManager {
    if (!CryptoManager.instance) {
      CryptoManager.instance = new CryptoManager();
    }
    return CryptoManager.instance;
  }

  /**
   * 初始化 RSA 密钥对
   * 如果密钥不存在则生成新的
   */
  async initializeKeys(): Promise<void> {
    try {
      // 检查密钥是否已存在
      if (fs.existsSync(this.publicKeyPath) && fs.existsSync(this.privateKeyPath)) {
        this.publicKey = fs.readFileSync(this.publicKeyPath, 'utf-8');
        this.privateKey = fs.readFileSync(this.privateKeyPath, 'utf-8');
        console.log('[CryptoManager] ✅ 已加载现有 RSA 密钥对');
        return;
      }

      // 生成新的 RSA 密钥对
      console.log('[CryptoManager] 生成新的 RSA 密钥对...');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      // 保存到文件
      fs.writeFileSync(this.publicKeyPath, publicKey, 'utf-8');
      fs.writeFileSync(this.privateKeyPath, privateKey, 'utf-8');

      this.publicKey = publicKey;
      this.privateKey = privateKey;

      console.log('[CryptoManager] ✅ RSA 密钥对生成完成');
    } catch (error) {
      console.error('[CryptoManager] ❌ 密钥初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取公钥（用于前端加密）
   */
  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('公钥未初始化，请先调用 initializeKeys()');
    }
    return this.publicKey;
  }

  /**
   * RSA 加密（用公钥）
   * @param data 要加密的数据
   * @returns Base64 编码的密文
   */
  encryptRSA(data: string): string {
    try {
      if (!this.publicKey) {
        throw new Error('公钥未初始化');
      }

      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        Buffer.from(data, 'utf-8')
      );

      return encrypted.toString('base64');
    } catch (error) {
      console.error('[CryptoManager] RSA 加密失败:', error);
      throw error;
    }
  }

  /**
   * RSA 解密（用私钥）
   * @param encryptedData Base64 编码的密文
   * @returns 解密后的明文
   */
  decryptRSA(encryptedData: string): string {
    try {
      if (!this.privateKey) {
        throw new Error('私钥未初始化');
      }

      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        Buffer.from(encryptedData, 'base64')
      );

      return decrypted.toString('utf-8');
    } catch (error) {
      console.error('[CryptoManager] RSA 解密失败:', error);
      throw error;
    }
  }

  /**
   * AES-256-GCM 加密（改进版，替代 AES-128-ECB）
   * @param data 要加密的数据
   * @param key 加密密钥（32字节/256位）
   * @returns 包含 iv 和密文的 JSON 字符串（Base64 编码）
   */
  encryptAES(data: string, key: string): string {
    try {
      // 生成随机 IV
      const iv = crypto.randomBytes(16);

      // 确保密钥长度为 32 字节
      const keyBuffer = Buffer.alloc(32);
      Buffer.from(key, 'utf-8').copy(keyBuffer);

      // 创建加密器
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      // 加密数据
      let encrypted = cipher.update(data, 'utf-8', 'hex');
      encrypted += cipher.final('hex');

      // 获取认证标签
      const authTag = cipher.getAuthTag();

      // 返回格式：{iv: string, encryptedData: string, authTag: string}
      const result = {
        iv: iv.toString('base64'),
        encryptedData: encrypted,
        authTag: authTag.toString('base64')
      };

      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      console.error('[CryptoManager] AES 加密失败:', error);
      throw error;
    }
  }

  /**
   * AES-256-GCM 解密
   * @param encryptedData Base64 编码的加密数据
   * @param key 解密密钥（32字节/256位）
   * @returns 解密后的明文
   */
  decryptAES(encryptedData: string, key: string): string {
    try {
      // 解析加密数据
      const result = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf-8'));

      // 确保密钥长度为 32 字节
      const keyBuffer = Buffer.alloc(32);
      Buffer.from(key, 'utf-8').copy(keyBuffer);

      // 创建解密器
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        keyBuffer,
        Buffer.from(result.iv, 'base64')
      );

      // 设置认证标签
      decipher.setAuthTag(Buffer.from(result.authTag, 'base64'));

      // 解密数据
      let decrypted = decipher.update(result.encryptedData, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      console.error('[CryptoManager] AES 解密失败:', error);
      throw error;
    }
  }

  /**
   * SHA256 哈希（安全的哈希替代 MD5）
   * @param data 要哈希的数据
   * @returns 哈希值
   */
  sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * 生成随机密钥
   * @param length 密钥长度（字节数）
   * @returns Base64 编码的随机密钥
   */
  generateRandomKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * 签名（用私钥）
   * @param data 要签名的数据
   * @returns Base64 编码的签名
   */
  sign(data: string): string {
    try {
      if (!this.privateKey) {
        throw new Error('私钥未初始化');
      }

      const sign = crypto.createSign('sha256');
      sign.update(data);
      return sign.sign(this.privateKey, 'base64');
    } catch (error) {
      console.error('[CryptoManager] 签名失败:', error);
      throw error;
    }
  }

  /**
   * 验证签名（用公钥）
   * @param data 原始数据
   * @param signature Base64 编码的签名
   * @returns 签名是否有效
   */
  verify(data: string, signature: string): boolean {
    try {
      if (!this.publicKey) {
        throw new Error('公钥未初始化');
      }

      const verify = crypto.createVerify('sha256');
      verify.update(data);
      return verify.verify(this.publicKey, signature, 'base64');
    } catch (error) {
      console.error('[CryptoManager] 签名验证失败:', error);
      return false;
    }
  }
}

export default CryptoManager.getInstance();
