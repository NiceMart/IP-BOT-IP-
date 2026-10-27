/**
 * 全局IPC字幕生成监听器
 * 负责处理来自主进程的字幕生成请求
 * 在应用启动时注册，确保在后端发送消息时能正确接收
 */

// 🔧 通过 window.ipcRenderer 访问 IPC
import { ZimuShengcheng } from '@/service/ZimuShengcheng';

const ipcRenderer = (window as any).ipcRenderer;

/**
 * 设置全局的字幕生成IPC监听器
 * 这个函数应该在应用启动时调用，在App.vue挂载前
 */
export function setupGlobalSubtitleListener() {
  try {
    console.log('[ipcSubtitleListener] 🔧 开始设置全局字幕生成IPC监听器...');

    // ⚠️ 检查 ipcRenderer 是否可用（前端环境可能不可用）
    if (typeof (window as any).ipcRenderer === 'undefined') {
      console.warn('[ipcSubtitleListener] ⚠️ ipcRenderer 不可用，跳过设置');
      return;
    }

    const ipcRenderer = (window as any).ipcRenderer;

    // 移除可能存在的旧监听器，避免重复
    ipcRenderer.removeAllListeners('ipAgent:performSubtitleGeneration');
    console.log('[ipcSubtitleListener] ✓ 已移除旧监听器');

    // 监听来自主进程的字幕生成请求
    ipcRenderer.on('ipAgent:performSubtitleGeneration', async (event: any, params: any) => {
    console.log('[ipAgent:performSubtitleGeneration] 收到主进程请求:', {
      videoPath: params.videoPath,
      userText: params.userText?.substring(0, 50) + '...',
      segmentsCount: params.funasrSegments?.length || 0
    });

    try {
      // 创建ZimuShengcheng实例，执行完整的七步流程
      const service = new ZimuShengcheng();

      console.log('[ipAgent:performSubtitleGeneration] 开始执行ZimuShengcheng.generate()');

      // 这里调用新的ZimuShengcheng服务，完成完整的七步流程：
      // 1. 文案修正
      // 2. 关键词匹配
      // 3. 智能排列
      // 4. 生成ASS文件
      // 5. 生成drawtext命令
      // 6. 构建FFmpeg命令
      // 7. 执行FFmpeg
      const result = await service.generate({
        videoPath: params.videoPath,
        videoWidth: params.videoWidth,
        videoHeight: params.videoHeight,
        userText: params.userText,
        funasrSegments: params.funasrSegments,
        subtitleStyle: params.subtitleStyle,
        keywordGroups: params.keywordGroups,
        keywordRenderMode: params.keywordRenderMode,
        fontDir: params.fontDir,
        outputPath: params.outputPath,
        // ✨ 新增：标题字幕配置
        titleSubtitleConfig: params.titleSubtitleConfig,
        // ✨ 新增：视频时长
        videoDuration: params.videoDuration
      });

      console.log('[ipAgent:performSubtitleGeneration] ZimuShengcheng执行完成:', {
        success: result.success,
        outputPath: result.outputPath,
        message: result.message
      });

      // 返回结果给主进程
      // 使用ipcRenderer.send()，发送给主进程的ipcMain.once监听器
      ipcRenderer.send('ipAgent:generateSubtitleV2Result', {
        success: result.success,
        outputPath: result.outputPath,
        message: result.message,
        statistics: result.statistics
        // 注意: FFmpeg命令已在ZimuShengcheng.generate()中执行，
        // 不需要返回ffmpegCommand让主进程再执行一次
      });

      console.log('[ipAgent:performSubtitleGeneration] 已向主进程发送结果');

    } catch (error: any) {
      console.error('[ipAgent:performSubtitleGeneration] 字幕生成失败:', error);

      // 返回错误结果给主进程
      ipcRenderer.send('ipAgent:generateSubtitleV2Result', {
        success: false,
        message: '字幕生成失败: ' + (error?.message || '未知错误'),
        error: error?.message
      });

      console.log('[ipAgent:performSubtitleGeneration] 已向主进程发送错误结果');
    }
  });

    console.log('[ipcSubtitleListener] ✅ 全局IPC监听器设置完成');
  } catch (error: any) {
    console.error('[ipcSubtitleListener] ❌ 设置监听器失败:', error);
    console.error('[ipcSubtitleListener] 错误堆栈:', error?.stack);
  }
}
