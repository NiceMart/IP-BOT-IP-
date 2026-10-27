/**
 * 一键智能全流程自动化功能
 * 独立文件，可单独编辑，不影响其他文件
 */

import type { Ref } from 'vue';
import { nextTick } from 'vue';
import { TaskService, TaskRecord } from '../../service/TaskService';
import { TaskChainExecutor } from '../../lib/task/TaskChainExecutor';
import { BatchStateUpdater } from '../../lib/task/BatchStateUpdater';

// 进度回调类型
export interface ProgressCallback {
  (step: string, progress: number): void;
}

// 错误回调类型
export interface ErrorCallback {
  (step: string, error: Error): void;
}

// 完成回调类型
export interface CompleteCallback {
  (): void;
}

// 取消检查回调类型
export interface CancelCheckCallback {
  (): boolean; // 返回true表示已取消
}

// 一键智能上下文接口 - 包含所有需要的响应式引用和函数
export interface OneClickContext {
  // 文案相关
  scriptContent: Ref<string>;

  // 语音相关
  generateAudio: (options?: { skipPolling?: boolean }) => Promise<void>;
  isGeneratingAudio: Ref<boolean>;
  audioPreviewUrl: Ref<string>;
  latestAudioTaskId: Ref<string | number | null>;

  // 视频相关
  generateVideo: (options?: { skipPolling?: boolean }) => Promise<void>;
  isGeneratingVideo: Ref<boolean>;
  videoPreviewUrl: Ref<string>;
  latestVideoTaskId: Ref<string | number | null>;

  // 视频处理相关
  autoProcessVideo: () => Promise<void>;
  isProcessingVideo: Ref<boolean>;
  processedVideoUrl: Ref<string>;

  // 标题标签关键词相关
  generateTitleTags: () => Promise<void>;
  isGeneratingTitleTags: Ref<boolean>;
  generatedTitle: Ref<string>;

  // 字幕和BGM相关
  autoGenerateSubtitleAndBGM: () => Promise<void>;
  enableSubtitle: Ref<boolean>;
  isGeneratingSubtitle: Ref<boolean>;
  enableBGM: Ref<boolean>;
  selectedBGMPath: Ref<string>;

  // 封面相关
  generateCover: () => Promise<void>;
  isGeneratingCover: Ref<boolean>;

  // 发布相关
  publishVideo: (options?: { autoPublish?: boolean }) => Promise<void>;
  publishPlatforms: Ref<{
    [key: string]: { checked: boolean; loggedIn: boolean; nickname: string; refreshing: boolean };
  }>;
  isPublishing: Ref<boolean>;
}

// 🔧 优化：支持异步条件检查，使用 requestIdleCallback 避免阻塞主线程
function waitForCompletion(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 300000, // 5分钟超时
  interval: number = 3000 // 🔧 优化：增加到3秒，减少轮询频率
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let checkInterval: any = null;
    let timeoutHandle: any = null;
    let isResolved = false;  // 🔧 防止多次resolve/reject
    let isChecking = false;  // 🔧 防止并发检查

    const cleanup = () => {
      if (checkInterval) clearTimeout(checkInterval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };

    const safeResolve = () => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve();
      }
    };

    const safeReject = (error: any) => {
      if (!isResolved) {
        isResolved = true;
        cleanup();
        reject(error);
      }
    };

    // 🔧 优化：支持异步条件检查
    const check = async () => {
      // 🔧 防止并发检查
      if (isChecking || isResolved) {
        return;
      }

      isChecking = true;

      try {
        // 🔧 关键：超时检查必须在条件检查前，防止无限轮询
        if (Date.now() - startTime > timeout) {
          safeReject(new Error(`操作超时（${timeout / 1000}秒），请检查网络连接`));
          return;
        }

        // 🔧 支持同步和异步条件
        const result = await Promise.resolve(condition());

        if (result) {
          safeResolve();
        } else {
          // 🔧 优化：使用 requestIdleCallback 在浏览器空闲时检查，避免阻塞UI
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
              if (!isResolved) {
                checkInterval = setTimeout(check, interval);
              }
            }, { timeout: interval });
          } else {
            // 降级方案：使用普通 setTimeout
            checkInterval = setTimeout(check, interval);
          }
        }
      } catch (error) {
        // ✅ 捕获 condition() 中的异常（包括 checkCancel 抛出的异常）
        safeReject(error);
      } finally {
        isChecking = false;
      }
    };

    // 开始第一次检查
    check();

    // 添加超时控制（备用），防止永久等待
    timeoutHandle = setTimeout(() => {
      safeReject(new Error(`操作超时（${timeout / 1000}秒），请检查网络连接`));
    }, timeout);
  });
}

/**
 * 执行一键智能全流程自动化
 * 流程：生成语音 -> 生成口播视频 -> 自动剪辑 -> 生成标题标签关键词 -> 自动生成字幕和BGM -> 生成封面
 */
export async function executeOneClickIntelligence(
  context: OneClickContext,
  callbacks: {
    onProgress: ProgressCallback;
    onError: ErrorCallback;
    onComplete: CompleteCallback;
    onCancelCheck?: CancelCheckCallback; // 可选：取消检查回调
  }
): Promise<void> {
  const { onProgress, onError, onComplete, onCancelCheck } = callbacks;

  // 检查是否已取消的辅助函数
  const checkCancel = () => {
    if (onCancelCheck && onCancelCheck()) {
      throw new Error('用户已取消一键智能流程');
    }
  };

  try {
    checkCancel();

    // 步骤1: 检查文案内容 (0-3%)
    onProgress('检查文案内容', 2);
    if (!context.scriptContent.value || !context.scriptContent.value.trim()) {
      throw new Error('请先在02区域输入文案内容');
    }

    checkCancel();

    // 步骤2: 生成标题标签关键词 (3-15%)
    onProgress('正在生成标题标签关键词...', 5);
    // 无论是否已有标题，都重新生成（确保使用最新的文案）
    await context.generateTitleTags();

    // 等待标题生成完成（在等待过程中检查取消）
    await waitForCompletion(
      () => {
        checkCancel(); // 每次检查时也检查取消
        return !context.isGeneratingTitleTags.value;
      },
      120000
    );

    checkCancel();

    if (context.isGeneratingTitleTags.value) {
      throw new Error('标题标签关键词生成超时，请重试');
    }
    onProgress('标题标签关键词生成完成', 15);

    checkCancel();

    // 步骤3: 生成语音 (15-30%)
    onProgress('正在生成语音...', 18);
    // 无论是否已有语音，都重新生成（确保使用最新的文案）
    // 🔧 优化：skipPolling=true，避免双重轮询
    await context.generateAudio({ skipPolling: true });

    // 🔧 关键优化：使用事件驱动替代轮询，消除CPU占用
    try {
      const executor = new TaskChainExecutor();
      const audioTaskId = context.latestAudioTaskId.value;

      if (audioTaskId) {
        console.log(`[executeOneClickIntelligence] 🎵 等待语音生成完成: ${audioTaskId}（事件驱动）`);

        // 使用事件驱动等待，而不是轮询
        await executor.waitForTaskEventDriven('SoundGenerate', audioTaskId as string, 300000);

        // 🔧 关键修复：等待 successFunc 完成并保存 result.url
        // runFunc 完成后，successFunc 还需要时间保存文件和更新数据库
        console.log(`[executeOneClickIntelligence] 🔍 等待文件保存完成...`);

        let task: TaskRecord | null = null;
        let retryCount = 0;
        const maxRetries = 30; // 🔧 修复：增加到 30 次（30 秒），给 successFunc 充足时间保存文件

        while (retryCount < maxRetries) {
          task = await TaskService.get(audioTaskId as string);

          if (task?.result?.url) {
            console.log(`[executeOneClickIntelligence] ✓ 语音文件已保存: ${task.result.url}`);
            context.audioPreviewUrl.value = task.result.url;
            context.isGeneratingAudio.value = false;
            console.log(`[executeOneClickIntelligence] ✓ audioPreviewUrl 已更新:`, context.audioPreviewUrl.value);
            break;
          }

          // 等待 1 秒后重试
          console.log(`[executeOneClickIntelligence] ⏳ 文件尚未保存，重试 ${retryCount + 1}/${maxRetries}... task.result:`, task?.result);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        }

        if (!task?.result?.url) {
          console.error(`[executeOneClickIntelligence] ❌ 重试 ${maxRetries} 次后仍未获取到语音文件`);
          console.error(`[executeOneClickIntelligence] 最后一次查询的任务:`, JSON.stringify(task, null, 2));
          throw new Error('语音文件保存超时，请重试');
        }
      }
    } catch (error: any) {
      context.isGeneratingAudio.value = false;
      throw new Error(`语音生成失败: ${error.message || '未知错误'}`);
    }

    checkCancel();

    if (!context.audioPreviewUrl.value) {
      throw new Error('语音生成失败，请检查配置和网络连接');
    }
    onProgress('语音生成完成', 30);

    checkCancel();

    // 步骤4: 生成口播视频 (30-45%)
    onProgress('正在生成口播视频...', 33);
    // 检查语音是否已生成
    if (!context.audioPreviewUrl.value) {
      throw new Error('语音生成失败，无法继续生成视频');
    }

    // 无论是否已有视频，都重新生成（确保使用最新的语音）
    // 🔧 优化：skipPolling=true，避免双重轮询
    await context.generateVideo({ skipPolling: true });

    // 🔧 关键优化：使用事件驱动替代轮询，消除CPU占用
    try {
      const executor = new TaskChainExecutor();
      const videoTaskId = context.latestVideoTaskId.value;

      if (videoTaskId) {
        console.log(`[executeOneClickIntelligence] 🎬 等待视频生成完成: ${videoTaskId}（事件驱动）`);

        // 使用事件驱动等待，而不是轮询
        await executor.waitForTaskEventDriven('VideoGen', videoTaskId as string, 600000);

        // 🔧 关键修复：等待 successFunc 完成并保存 result.url
        console.log(`[executeOneClickIntelligence] 🔍 等待视频文件保存完成...`);

        let task: TaskRecord | null = null;
        let retryCount = 0;
        const maxRetries = 15; // 最多重试 15 次（15 秒，视频通常较大）

        while (retryCount < maxRetries) {
          task = await TaskService.get(videoTaskId as string);

          if (task?.result?.url) {
            console.log(`[executeOneClickIntelligence] ✓ 视频文件已保存: ${task.result.url}`);
            context.videoPreviewUrl.value = task.result.url;
            context.isGeneratingVideo.value = false;
            // 🔧 【关键修复】使用 nextTick 确保 Vue 响应式更新立即生效
            await nextTick();
            break;
          }

          // 等待 1 秒后重试
          console.log(`[executeOneClickIntelligence] ⏳ 视频尚未保存，重试 ${retryCount + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
        }

        if (!task?.result?.url) {
          console.error(`[executeOneClickIntelligence] ❌ 重试 ${maxRetries} 次后仍未获取到视频文件`);
          throw new Error('视频文件保存超时，请重试');
        }
      }
    } catch (error: any) {
      context.isGeneratingVideo.value = false;
      throw new Error(`视频生成失败: ${error.message || '未知错误'}`);
    }

    checkCancel();

    if (!context.videoPreviewUrl.value) {
      throw new Error('口播视频生成失败，请检查配置和网络连接');
    }
    onProgress('口播视频生成完成', 45);

    checkCancel();

    // 步骤5: 自动剪辑 (45-60%)
    onProgress('正在自动剪辑视频...', 50);
    // 检查视频是否已生成
    if (!context.videoPreviewUrl.value) {
      throw new Error('视频生成失败，无法继续剪辑');
    }

    // 无论是否已有处理后的视频，都重新执行自动剪辑
    await context.autoProcessVideo();

    // 等待视频处理完成（在等待过程中检查取消）
    await waitForCompletion(
      () => {
        checkCancel(); // 每次检查时也检查取消
        return !context.isProcessingVideo.value;
      },
      300000
    );

    checkCancel();

    if (context.isProcessingVideo.value) {
      throw new Error('视频剪辑超时，请重试');
    }
    onProgress('视频剪辑完成', 60);

    checkCancel();

    // 步骤6: 自动生成字幕和BGM (60-80%)
    onProgress('正在生成字幕和BGM...', 65);

    // 检查视频是否存在
    const currentVideo = context.processedVideoUrl.value || context.videoPreviewUrl.value;
    if (!currentVideo) {
      throw new Error('视频文件不存在，无法生成字幕');
    }

    // 确保字幕功能已启用
    if (!context.enableSubtitle.value) {
      context.enableSubtitle.value = true;
    }

    // 无论是否已有字幕，都重新生成（确保使用最新的视频和配置）
    await context.autoGenerateSubtitleAndBGM();

    // 等待字幕和BGM处理完成（在等待过程中检查取消）
    await waitForCompletion(
      () => {
        checkCancel(); // 每次检查时也检查取消
        return !context.isGeneratingSubtitle.value;
      },
      300000
    );

    checkCancel();

    if (context.isGeneratingSubtitle.value) {
      throw new Error('字幕和BGM生成超时，请重试');
    }
    onProgress('字幕和BGM处理完成', 80);

    checkCancel();

    // 步骤7: 生成封面 (80-100%)
    onProgress('正在生成封面...', 85);

    // 检查是否有标题
    if (!context.generatedTitle.value || !context.generatedTitle.value.trim()) {
      throw new Error('标题生成失败，无法生成封面');
    }

    // 检查是否有视频（用于生成封面）
    const videoForCover = context.processedVideoUrl.value || context.videoPreviewUrl.value;
    if (!videoForCover) {
      throw new Error('视频文件不存在，无法生成封面');
    }

    // 无论是否已有封面，都重新生成（确保使用最新的标题和视频）
    await context.generateCover();

    // 等待封面生成完成（在等待过程中检查取消）
    await waitForCompletion(
      () => {
        checkCancel(); // 每次检查时也检查取消
        return !context.isGeneratingCover.value;
      },
      180000
    );

    checkCancel();

    if (context.isGeneratingCover.value) {
      throw new Error('封面生成超时，请重试');
    }
    onProgress('封面生成完成', 95);

    checkCancel();

    // 步骤8: 发布视频 (95-100%)
    onProgress('正在发布视频...', 96);

    // 检查是否选择了发布平台
    const hasSelectedPlatforms = Object.values(context.publishPlatforms.value).some(p => p.checked);

    if (hasSelectedPlatforms) {
      // 执行发布
      await context.publishVideo({ autoPublish: true });

      // 等待发布完成（在等待过程中检查取消）
      await waitForCompletion(
        () => {
          checkCancel(); // 每次检查时也检查取消
          return !context.isPublishing.value;
        },
        600000 // 10分钟超时
      );

      checkCancel();

      if (context.isPublishing.value) {
        throw new Error('视频发布超时，请手动检查状态');
      }

      // 注意：publishVideo 函数内部会处理 success/failure 的 UI 提示和结果记录
      // 这里只需要确认流程完成即可
    } else {
      console.log('未选择发布平台，跳过发布步骤');
    }
    onProgress('发布完成', 100);

    // 完成

    onProgress('一键智能流程全部完成', 100);
    onComplete();

  } catch (error: any) {
    const errorMessage = error?.message || '未知错误';
    console.error('一键智能流程执行失败:', error);
    console.error('错误堆栈:', error?.stack);

    // 🔧 优化：确保所有状态标志都被重置，防止卡死
    try {
      context.isGeneratingAudio.value = false;
      context.isGeneratingVideo.value = false;
      context.isProcessingVideo.value = false;
      context.isGeneratingTitleTags.value = false;
      context.isGeneratingSubtitle.value = false;
      context.isGeneratingCover.value = false;
    } catch (resetError) {
      console.warn('重置状态标志失败:', resetError);
    }

    onError(errorMessage, error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}

