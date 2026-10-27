# 本地账户与管理后台

Express + SQLite 服务，为桌面端提供注册、登录、管理员配置、订阅、设备及配额管理。

在项目根目录使用 Node.js 22：

~~~sh
npm --prefix user-server ci
npm run init:local
npm run start:server
~~~

默认只监听 127.0.0.1:3002，管理入口为 http://127.0.0.1:3002/admin 。先通过桌面注册自己的首个管理员账号，之后的账号需要管理员生成的卡密。没有默认密码或通用激活卡。

配置位于根目录 .env 或初始化生成的私有 JSON，也支持进程环境变量。JWT 秘密必须至少 32 字符，初始化会随机生成。不要在启动脚本中写死秘密，不要提交 users.db、备份或日志。

当前客户端会读取已授权配置中的服务商密钥，只适用于受信任的本地安装，不要按旧部署示例开放公网。完整说明见 [主 README](../README.md)、[安全说明](../SECURITY.md)、[发布状态](../docs/RELEASE_STATUS.md)。测试使用临时独立数据库。

English: this is the local account/admin service. Read the root README before deployment. Bootstrap locally and keep provider credentials private. Public multi-tenant deployment is not validated.
