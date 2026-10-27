# 贡献指南 / Contributing

欢迎提交可复现的问题、文档修订和范围明确的改进。项目以 Apache-2.0 提供开发预览，依赖安全升级仍在待办中。

1. 使用 Node.js 22，分别执行根目录与 user-server 的 npm ci，然后 npm run init:local。
2. 每个改动围绕一个问题，说明触发条件、修改后的行为和验证结果。不要顺带大规模重排目录、格式化全部文件或升级 Electron 大版本。
3. 运行 npm test、npm run audit:source、npm run build。涉及类型时运行 npm run typecheck，并区分新增问题与已记录的历史问题。依赖变更应同时更新对应锁文件并附 npm audit 结果。
4. 界面改动提供浅色/深色截图与键盘交互结果；媒体处理改动使用自己有权使用的短素材，说明服务商、模型和硬件前提，不上传真实用户数据。
5. PR 描述包括问题、行为变化、测试与限制。不要在补丁、截图、Issue、日志或提交历史中包含真实手机号、Token、API Key、付费素材或数据库。

新增依赖和素材必须记录来源、版本、许可证及分发条件，保留原始版权声明；来源无法核验的内容不要提交。不要移除已有上游归属或擅自修改 LICENSE。

安全漏洞请按 SECURITY.md 私下报告，不要在公开 Issue 中贴出利用所需的秘密。

English: keep pull requests focused, include reproducible evidence and test results, preserve attribution, and never contribute credentials, private datasets or unlicensed assets. New dependencies require license and security review.
