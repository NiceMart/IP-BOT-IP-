# 运行资源与安装边界

源码构建和媒体运行是两个独立条件。GitHub 源码只提供代码、配置模板与已保留许可的资源，不包含完整视频处理环境。开发者能够安装依赖、启动后台和构建界面；完整桌面媒体流程还需自行提供合法兼容的运行资源。

| 位置 | 所需内容 | 检查方式 |
| --- | --- | --- |
| electron/resources/extra/win-x86 | FFmpeg、FFprobe 及同版 DLL | 实际执行 -version |
| electron/resources/extra/common/python | 嵌入式 Python 与 numpy/Pillow/OpenCV/onnxruntime | 执行导入探针 |
| electron/resources/extra/common/models | u2net.onnx 等业务所需权重 | 存在性；未等同于精度/许可验证 |
| electron/resources/extra/common/playwright | 对应 Playwright 的浏览器，或系统 Edge/Chrome | 可执行文件检测，具体网站仍受访问限制 |
| modes | 可选本地数字人服务及配置 | 预检仅检测存在，GPU 推理需单独验证 |

运行 npm run check:runtime。缺资源时返回退出码 2 并列出缺项，不能把这视为 npm 安装失败。桌面启动器在缺核心资源时拒绝启动，避免运行到中途才报错。

已有完整安装的用户可运行 node scripts/import-runtime-resources.cjs <原安装路径>。脚本从原安装复制缺失文件，保留当前文件；不会导入原安装的账户与用户媒体。--with-local-models 体积大，排除模型输出和缓存。

再分发前必须逐项核验 FFmpeg 的 -buildconf、编解码器、Python/浏览器附带许可证、模型权重、字体、音乐和素材的授权，并准备要求的通知和对应源码。源码许可证不能代替这些许可。本次没有发布二进制资源，也没有承诺提供完整公开下载包。
