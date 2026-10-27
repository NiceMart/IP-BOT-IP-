/**
 * 开发模式检查 Composable
 * 用于在 Vue 组件中检查是否处于开发模式
 */

import { ref } from 'vue';

// 创建单例的开发模式状态
const isDev = ref<boolean>(false);
let initialized = false;

// 初始化开发模式
export function initDevMode() {
  if (initialized) return isDev.value;
  initialized = true;

  // 检查多个开发模式指标
  let devMode = true; // 默认为开发模式（除非明确标记为生产）

  // 1. 检查是否明确标记为生产模式
  if (typeof process !== 'undefined' && process.env.ELECTRON_ENV_PROD === 'true') {
    devMode = false;
  }

  // 2. 检查 NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    devMode = false;
  }

  // 3. 记录开发模式信息
  isDev.value = devMode;
  console.log('[useDevMode] 初始化完成 - 开发模式:', isDev.value, '环境:', {
    NODE_ENV: process.env.NODE_ENV,
    VITE_DEV: process.env.VITE_DEV,
    ELECTRON_ENV_PROD: process.env.ELECTRON_ENV_PROD
  });

  return isDev.value;
}

/**
 * 获取开发模式 Composable
 * @returns {Object} 包含 isDev ref 的对象
 *
 * @example
 * import { useDevMode } from '@/composables/useDevMode';
 *
 * export default {
 *   setup() {
 *     const { isDev } = useDevMode();
 *     return { isDev };
 *   }
 * }
 */
export function useDevMode() {
  // 初始化开发模式
  if (!initialized) {
    initDevMode();
  }

  return {
    isDev
  };
}
