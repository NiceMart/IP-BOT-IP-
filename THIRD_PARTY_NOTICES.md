# 第三方代码、依赖和素材

本次保留原有许可证，不将工作区中的文件一概视为可由维护者重新授权。

| 内容 | 来源 / 许可 | 本次处理 |
| --- | --- | --- |
| 继承桌面代码 | [AIGCPanel / ModStartLib](https://github.com/modstart-lib/aigcpanel)，Apache-2.0 | 保留 LICENSE、NOTICE、修改记录；新增修改由维护者确认按 Apache-2.0 发布 |
| MODNet 源码 | python/MODNet-master/LICENSE，Apache-2.0 | 原许可证随源码保留；不包含或授权模型权重 |
| Arco Vue 与替代图标 | [Arco Design Vue](https://github.com/arco-design/arco-design-vue)，MIT | 保留 [完整 MIT 许可](docs/licenses/arco-design-MIT.txt)；替换旧 iconfont 字形，保留类名兼容 |
| npm 依赖 | 两份 package-lock.json 的确切版本与各包许可证 | 依赖通过 npm 安装，不将 node_modules 再分发；元数据清单见 dependency-licenses.json |
| 原 iconfont 项目 4705978 | 未发现完整授权证据 | 旧字体与脚本从候选目录隔离，未发布 |
| AlibabaPuHuiTi 字体文件 | 文件含 Alibaba 版权声明，未随附完整许可 | 候选目录隔离；界面使用系统字体 |
| 原反馈二维码 | 私人联系与来源未确认 | 候选目录隔离，替换为本地原创反馈说明图 |
| 继承品牌、插图、封面预览 | 工作区来源记录有限 | 维护者确认本次保留素材可公开；各服务商商标及独立资源条款继续适用 |
| FFmpeg、浏览器、Python 与二进制包 | 构建选项与组件许可证分别适用 | 源码仓库排除；二进制发行须另审 |
| 模型、数字人环境、字体、音乐、音效和素材 | 各自权利人、模型卡与服务条款 | 排除完整运行资源与用户数据；本地拥有不代表允许再分发 |

dependency-licenses.json 是安装元数据盘点，不能代替许可证全文、代码来源核验或法律意见。缺失/非标准 SPDX 的包需要人工复核，未来二进制打包还需收集完整依赖通知。

Apache-2.0 的再分发要求见 [官方条款](https://www.apache.org/licenses/LICENSE-2.0)。任何原始商标与名称仅用于识别来源和服务，不表示原作者或服务商为本项目背书。

补充核验：锁文件中缺少 license 字段的 5 个条目已在安装包中核对 MIT 许可全文，并保存在 docs/licenses。源码未使用的 @lobehub/tts 已移除，同时移除了其引入的 @splinetool/runtime / @giscus/react 依赖链，避免将缺少完整许可证据的组件带入未来打包。源码未分发 node_modules；其余 LGPL/MPL/CC-BY 等通知与二进制义务仍需发行时逐项处理。
