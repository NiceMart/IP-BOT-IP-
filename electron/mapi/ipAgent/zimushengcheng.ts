/**
 * 后端字幕生成模块
 *
 * 【已废弃】
 * 新的字幕生成采用前端处理 + 主进程执行FFmpeg的架构：
 * 1. 前端接收来自主进程的 ipAgent:performSubtitleGeneration 事件
 * 2. 前端调用 ZimuShengcheng.generate() 完成所有字幕处理逻辑（七步流程）
 * 3. 前端通过 ipcRenderer.invoke('ipAgent:generateSubtitleV2Result') 返回结果
 * 4. 主进程接收结果，如需要则执行FFmpeg命令
 *
 * 详见：
 * - electron/mapi/ipAgent/main.ts (第5437-5603行)
 * - src/pages/Video/VideoIPAgent.vue (第4743-4818行)
 */

// 此文件不再在主进程中使用，避免导入前端模块
export {};
