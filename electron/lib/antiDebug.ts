/**
 * Electron 防破解模块
 * 禁用开发者工具、快捷键、右键菜单
 */

import { BrowserWindow, globalShortcut, Menu } from 'electron';
import { isDev } from './env';

export class AntiDebugManager {
  private static instance: AntiDebugManager;
  private disabledShortcuts: string[] = [];
  private originalOpenDevTools: Map<BrowserWindow, Function> = new Map();
  private originalToggleDevTools: Map<BrowserWindow, Function> = new Map();

  private constructor() {
    console.log('[AntiDebugManager] 初始化');
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AntiDebugManager {
    if (!AntiDebugManager.instance) {
      AntiDebugManager.instance = new AntiDebugManager();
    }
    return AntiDebugManager.instance;
  }

  /**
   * 禁用开发者工具
   * @param window 目标窗口
   */
  disableDevTools(window: BrowserWindow): void {
    try {
      // 💾 保存原始方法，以便后续恢复
      this.originalOpenDevTools.set(window, window.webContents.openDevTools.bind(window.webContents));
      this.originalToggleDevTools.set(window, window.webContents.toggleDevTools.bind(window.webContents));

      // 禁用 openDevTools 方法
      window.webContents.openDevTools = () => {
        console.warn('[AntiDebugManager] 尝试打开开发者工具被拦截');
      };

      // 禁用 toggleDevTools 方法
      window.webContents.toggleDevTools = () => {
        console.warn('[AntiDebugManager] 尝试切换开发者工具被拦截');
      };

      console.log('[AntiDebugManager] ✅ 已禁用开发者工具');
    } catch (error) {
      console.error('[AntiDebugManager] 禁用开发者工具失败:', error);
    }
  }

  /**
   * 禁用快捷键
   * 包括：F12、Ctrl+Shift+I、Ctrl+Shift+C、Ctrl+Shift+J、Ctrl+I 等
   */
  disableDebugShortcuts(): void {
    try {
      const shortcuts = [
        'F12',                    // 开发者工具
        'Ctrl+Shift+I',          // 开发者工具 (Windows/Linux)
        'Cmd+Option+I',          // 开发者工具 (macOS)
        'Ctrl+Shift+C',          // 检查元素
        'Cmd+Option+C',          // 检查元素 (macOS)
        'Ctrl+Shift+J',          // 控制台
        'Cmd+Option+J',          // 控制台 (macOS)
        'Ctrl+I',                // 开发者工具 (某些浏览器)
        'Cmd+Option+U',          // 查看源代码 (macOS)
        'Ctrl+U',                // 查看源代码 (Windows/Linux)
        'Ctrl+Shift+K',          // 控制台 (某些浏览器)
        'Ctrl+Shift+D',          // 某些调试快捷键
      ];

      shortcuts.forEach(shortcut => {
        try {
          globalShortcut.register(shortcut, () => {
            console.warn(`[AntiDebugManager] 快捷键 "${shortcut}" 被拦截`);
            return true; // 阻止默认行为
          });
          this.disabledShortcuts.push(shortcut);
        } catch (error) {
          console.warn(`[AntiDebugManager] 注册快捷键 "${shortcut}" 失败:`, error);
        }
      });

      console.log(`[AntiDebugManager] ✅ 已禁用 ${this.disabledShortcuts.length} 个调试快捷键`);
    } catch (error) {
      console.error('[AntiDebugManager] 禁用快捷键失败:', error);
    }
  }

  /**
   * 禁用右键菜单
   * @param window 目标窗口
   */
  disableContextMenu(window: BrowserWindow): void {
    try {
      window.webContents.on('context-menu', (e) => {
        e.preventDefault();
        console.warn('[AntiDebugManager] 右键菜单被拦截');
      });

      console.log('[AntiDebugManager] ✅ 已禁用右键菜单');
    } catch (error) {
      console.error('[AntiDebugManager] 禁用右键菜单失败:', error);
    }
  }

  /**
   * 禁用鼠标右键
   * @param window 目标窗口
   */
  disableMouseRightClick(window: BrowserWindow): void {
    try {
      window.webContents.on('before-input-event', (event, input) => {
        // 检查是否是鼠标右键（某些情况下）
        if (input.type === 'mouseUp' && input.button === 2) {
          event.preventDefault();
        }
      });

      console.log('[AntiDebugManager] ✅ 已禁用鼠标右键');
    } catch (error) {
      console.error('[AntiDebugManager] 禁用鼠标右键失败:', error);
    }
  }

  /**
   * 拦截快捷键（键盘事件）
   * @param window 目标窗口
   */
  interceptDebugHotkeys(window: BrowserWindow): void {
    try {
      window.webContents.on('before-input-event', (event, input) => {
        // 拦截 F12
        if (input.key.toLowerCase() === 'f12') {
          event.preventDefault();
          console.warn('[AntiDebugManager] F12 被拦截');
          return;
        }

        // 拦截 Ctrl+Shift+I (Windows/Linux)
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Ctrl+Shift+I 被拦截');
          return;
        }

        // 拦截 Ctrl+Shift+C (Windows/Linux)
        if (input.control && input.shift && input.key.toLowerCase() === 'c') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Ctrl+Shift+C 被拦截');
          return;
        }

        // 拦截 Ctrl+Shift+J (Windows/Linux)
        if (input.control && input.shift && input.key.toLowerCase() === 'j') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Ctrl+Shift+J 被拦截');
          return;
        }

        // 拦截 Cmd+Option+I (macOS)
        if (input.meta && input.alt && input.key.toLowerCase() === 'i') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Cmd+Option+I 被拦截');
          return;
        }

        // 拦截 Cmd+Option+C (macOS)
        if (input.meta && input.alt && input.key.toLowerCase() === 'c') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Cmd+Option+C 被拦截');
          return;
        }

        // 拦截 Ctrl+U (查看源代码)
        if (input.control && input.key.toLowerCase() === 'u') {
          event.preventDefault();
          console.warn('[AntiDebugManager] Ctrl+U 被拦截');
          return;
        }
      });

      console.log('[AntiDebugManager] ✅ 已拦截调试快捷键');
    } catch (error) {
      console.error('[AntiDebugManager] 快捷键拦截失败:', error);
    }
  }

  /**
   * 禁用菜单栏（可选）
   * @param window 目标窗口
   */
  disableMenuBar(window: BrowserWindow): void {
    try {
      Menu.setApplicationMenu(null);
      console.log('[AntiDebugManager] ✅ 已禁用菜单栏');
    } catch (error) {
      console.error('[AntiDebugManager] 禁用菜单栏失败:', error);
    }
  }

  /**
   * 完整的防破解方案
   * @param window 目标窗口
   * @param options 选项
   */
  enableFullProtection(window: BrowserWindow, options: {
    disableDevTools?: boolean;
    disableShortcuts?: boolean;
    disableContextMenu?: boolean;
    disableMenuBar?: boolean;
    interceptHotkeys?: boolean;
  } = {}): void {
    const {
      disableDevTools = true,
      disableShortcuts = true,
      disableContextMenu = true,
      disableMenuBar = true,
      interceptHotkeys = true
    } = options;

    console.log('[AntiDebugManager] 启用完整防破解保护...');
    console.log('[AntiDebugManager] 环境:', isDev ? '开发' : '生产');

    if (disableDevTools) {
      this.disableDevTools(window);
    }

    if (disableShortcuts) {
      this.disableDebugShortcuts();
    }

    if (disableContextMenu) {
      this.disableContextMenu(window);
    }

    if (disableMenuBar) {
      this.disableMenuBar(window);
    }

    if (interceptHotkeys) {
      this.interceptDebugHotkeys(window);
    }

    console.log('[AntiDebugManager] ✅ 防破解保护已启用');
  }

  /**
   * 临时启用开发者工具（用于隐藏调试快捷键）
   * @param window 目标窗口
   */
  restoreDevTools(window: BrowserWindow): void {
    try {
      const originalMethod = this.originalOpenDevTools.get(window);
      if (originalMethod && typeof originalMethod === 'function') {
        console.log('[AntiDebugManager] 使用保存的原始 openDevTools 方法打开 DevTools');
        // 调用保存的原始方法
        originalMethod({ mode: 'detach', activate: true });
        console.log('[AntiDebugManager] ✅ DevTools 已通过原始方法打开');
      } else {
        console.warn('[AntiDebugManager] 未找到保存的原始方法，尝试直接调用');
        // 备选方案：直接调用（可能被拦截，但尽量尝试）
        window.webContents.openDevTools({ mode: 'detach', activate: true });
      }
    } catch (error) {
      console.error('[AntiDebugManager] 恢复 DevTools 失败:', error);
    }
  }

  /**
   * 卸载防破解（开发时使用）
   */
  unload(): void {
    try {
      // 注销所有快捷键
      this.disabledShortcuts.forEach(shortcut => {
        globalShortcut.unregister(shortcut);
      });
      this.disabledShortcuts = [];

      console.log('[AntiDebugManager] ✅ 防破解已卸载');
    } catch (error) {
      console.error('[AntiDebugManager] 卸载防破解失败:', error);
    }
  }
}

export default AntiDebugManager.getInstance();
