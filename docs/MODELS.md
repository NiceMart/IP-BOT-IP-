# 数字人模型与运行资源

## HeyGem 与 HeyGen

本机已验证环境对应 HeyGem V2 的 AIGCPanel 兼容服务，名称是 **HeyGem**。HeyGen 是另一家云端视频服务，不能把它的 API 或网页下载内容当作本项目的本地模型。

- 模型获取入口：[AIGCPanel 上游项目](https://github.com/modstart-lib/aigcpanel)，按其模型管理文档获取对应系统、版本的模型服务包。
- [HeyGen 官方开发文档](https://developers.heygen.com/)仅用于识别区别，本项目不承诺支持其 API。
- 不发布维护者本机模型文件：包中有独立服务与授权要求，未完成可再分发核验。

## 本地接入

1. 从权利人或上述上游入口获取有权使用的 HeyGem 服务包，先阅读许可证、硬件要求及版本说明。不要用绕过授权的第三方补丁。
2. 完整解压到稳定目录；保留整个 Python 环境，包括 torch.utils.data 等包。
3. 在桌面端「模型服务」中导入/配置本地服务目录，启动后检查日志与服务地址。不要将模型存储路径误填为云端 API 地址。
4. 使用有权使用的人物视频及短音频测试，再接入自动流程。

维护者本机验证过 RTX 3090 上 Python/PyTorch/CUDA 环境；未完成完整模型视频推理验收。上游新版与本项目的兼容性需要逐版本验证，不能保证任意模型下载后直接可用。

## 基础资源

模型不能替代 FFmpeg、FFprobe、Python 媒体依赖与 Chromium。参考 [安装教程](INSTALL.md) 和 [运行资源](RUNTIME.md)，完成后执行 npm run check:runtime。源码启动器自动安装 npm 依赖、构建界面，但不自动获取未核准的第三方模型/媒体资源。
