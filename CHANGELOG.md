# Changelog

采用按变更类型归档的方式；本文件不代表已创建 GitHub Release。

## Unreleased — 开源发布准备

### Added
- 图文 README、7 张隔离演示界面截图、部署与创作流程图，以及更新后的分步安装部署教程。
- 中文/英文安装文档、配置模板、贡献指南、安全说明、资源与发布状态文档。
- 隔离的后台账户权限和配置回归测试、源码发布边界检查、Windows CI。
- 进程环境变量 / .env / 本地 JSON 的统一配置加载。

### Changed
- 开发启动脚本移除 Windows 专用 set 语法，保留 Windows 双击启动器。
- 锁文件应用可兼容的安全修复，移除源码未使用的 @lobehub/tts 及其 546 个安装条目；跨大版本升级保留待办。
- 保留字幕模板源码配置；大体积运行资源、用户数据、真实配置与临时调查文件不入库。
- 许可未明确的旧图标字体改用 MIT 许可的 Arco 图标，保留其版权许可；个人二维码与字体文件从发布候选目录隔离。

### Startup fix — 2026-10-28
- First launch now initializes the private configuration instead of requiring an excluded file to exist.
- Windows launchers locate Node.js 22, preserve diagnostics and install missing dependencies automatically.
- Missing media resources display guidance while allowing the desktop interface to open.
- Portable instance locks now use the current installation's data directory.

### Security
- 匿名配置接口返回空配置；云服务配置需要有效账户。
- 管理员限定测试卡密接口；取消固定默认卡密和弱 JWT 后备秘密。
- 账户操作校验登录与用户归属；默认监听本机并收紧浏览器 CORS 来源。
- renderer 不再直接编译敏感 JSON；客户端会话传递认证头，登出清除内存配置缓存。
- 云配置不再写入跨账户共享磁盘缓存；客户端仍能读取自己调用服务所需的密钥，这一架构边界未改变。

## 继承的 5.0.6 工作区基线

历史工作区未发现 Git 提交，无法重建逐次版本历史。既有蓝色品牌、主题切换、底部账户区、桌面保存路径、语音服务分流和媒体运行资源修复作为当前基线保留；不声称本文件等同于上游正式发行记录。

## 2026-10-29

- 修复启动阶段阻塞提示与窗口显示时序；关闭默认开发者工具。
- 首次自动构建桌面界面，后续直接启动构建文件。
- 空的本机数据库初始化文档所列管理员；已有账号不变。
- 修复模型资源导入误排除嵌套 data 包；补充 HeyGem 获取与能力边界说明。
