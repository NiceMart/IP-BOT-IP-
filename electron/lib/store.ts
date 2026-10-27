/**
 * 🔐 Store Manager - 用于持久化存储激活信息和设备指纹
 * 使用 JSON 文件存储，位于用户数据目录
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Log from '../mapi/log/main';

interface StoreData {
  activation?: any;
  deviceFingerprint?: string;
}

export class Store {
  private static instance: Store | null = null;
  private storePath: string;
  private data: StoreData = {};

  private constructor() {
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'store.json');
    this.load();
  }

  /**
   * 获取 Store 单例实例（延迟初始化）
   */
  static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  /**
   * 从文件加载数据
   */
  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8');
        this.data = JSON.parse(content);
        Log.info('[Store] 已从文件加载持久化数据:', {
          hasActivation: !!this.data.activation,
          hasDeviceFingerprint: !!this.data.deviceFingerprint
        });
      } else {
        this.data = {};
        Log.info('[Store] Store 文件不存在，使用空数据');
      }
    } catch (error) {
      Log.error('[Store] 加载文件失败:', error);
      this.data = {};
    }
  }

  /**
   * 保存数据到文件
   */
  private save(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf-8');
      Log.info('[Store] 数据已保存到文件');
    } catch (error) {
      Log.error('[Store] 保存文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取激活信息
   */
  getActivation(): any {
    Log.info('[Store] 获取激活信息:', !!this.data.activation);
    return this.data.activation || null;
  }

  /**
   * 保存激活信息
   */
  setActivation(data: any): void {
    Log.info('[Store] 保存激活信息');
    this.data.activation = data;
    this.save();
  }

  /**
   * 清除激活信息
   */
  clearActivation(): void {
    Log.info('[Store] 清除激活信息');
    delete this.data.activation;
    this.save();
  }

  /**
   * 获取设备指纹
   */
  getDeviceFingerprint(): string | null {
    Log.info('[Store] 获取设备指纹:', !!this.data.deviceFingerprint);
    return this.data.deviceFingerprint || null;
  }

  /**
   * 保存设备指纹
   */
  setDeviceFingerprint(fingerprint: string): void {
    Log.info('[Store] 保存设备指纹');
    this.data.deviceFingerprint = fingerprint;
    this.save();
  }

  /**
   * 清除设备指纹
   */
  clearDeviceFingerprint(): void {
    Log.info('[Store] 清除设备指纹');
    delete this.data.deviceFingerprint;
    this.save();
  }
}

// 延迟初始化：只有在第一次调用时才创建 Store 实例
// 这样确保 AppEnv 已经初始化完成
export default {
  getActivation: () => Store.getInstance().getActivation(),
  setActivation: (data: any) => Store.getInstance().setActivation(data),
  clearActivation: () => Store.getInstance().clearActivation(),
  getDeviceFingerprint: () => Store.getInstance().getDeviceFingerprint(),
  setDeviceFingerprint: (fingerprint: string) => Store.getInstance().setDeviceFingerprint(fingerprint),
  clearDeviceFingerprint: () => Store.getInstance().clearDeviceFingerprint(),
};
