# Beekeepy · 本机隔离 QA 配置（Windows）

这是一套重新编写的 QA 环境，不是 11 月 23 日丢失的原始服务器。未完成安全审计，不可公开到互联网，不可连接真实客户或真实收款账号进行测试。

**安全边界**：服务器只绑定 `127.0.0.1` / `::1`；必须 HTTPS；管理员密码必须经过 scrypt 哈希并同时提供 TOTP；没有真实 Supabase 用户身份就拒绝客户操作；没有 Stripe 服务端密钥就拒绝付费/退款；Webhook 必须校验签名；默认使用独立 SQLite 数据库，不触碰 `app_state`、历史 IDB 及手机数据。

## 准备

1. 独立复制源码 ZIP 到新文件夹，保留旧备份原件不动。安装 Node.js 22 和 Windows PowerShell。
2. 在项目中的 `commercial` 目录运行 `node deployment/generate-admin-credentials.mjs`。它随机生成管理员密码、哈希和一次性 TOTP 种子；请将种子添加到自己手机的 authenticator 应用；不得发到任何聊天、日志或公开仓库。
3. 把 `deployment/.env.local.example` 复制为 `commercial/.env.local`，填写 `BEE_ADMIN_PASSWORD_SCRYPT` 和 `BEE_ADMIN_TOTP_SECRET`；设置为仅当前 Windows 账户可读。
4. 创建本机 HTTPS 测试证书（仅用 Windows 系统自带命令；不要复用生产证书）：
   ```powershell
   $c=New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation 'Cert:\CurrentUser\My' -FriendlyName 'Beekeepy Local QA' -KeyExportPolicy Exportable
   $password=Read-Host '给 PFX 设置单独的强密码' -AsSecureString
   Export-PfxCertificate -Cert $c -FilePath "$env:USERPROFILE\beekeepy-local-qa.pfx" -Password $password
   ```
   将 PFX 的**本机完整路径**设置为 `BEE_HTTPS_PFX_FILE`，PFX 密码设置为 `BEE_HTTPS_PFX_PASSWORD`（不要分享该文件或密码）。这只是自签名 QA 证书；浏览器会提示非受信任，不能拿来做真实生产服务。
5. 在 `commercial` 文件夹内执行 `powershell -ExecutionPolicy Bypass -File .\start-local.ps1`。管理员后台地址 `https://127.0.0.1:8443/admin/`，普通账户接口 `https://127.0.0.1:8443/account/`。

## 连接真实服务仍处于阻断状态

- `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`：只用于服务端验证已有用户 JWT；无配置直接拒绝。
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRO_PRICE_IDS`：默认不配置，无配置不可能真实创建付款或退款；必须在**另建测试账户**审计后配置，避免连接真实商户。
- 写回现有 `app.js` 所信任的 Supabase `app_metadata`，需另行设置 service-role 并**明确批准**才可运行 `server/entitlement-sync.mjs` 提供的同步函数；当前没有自动运行入口，保证不会误改生产身份数据。
- 所有 SQL 文件仅是候选，不自动执行；不会初始化或清空原有 Supabase 表。

## Android 版阻断

历史已有 `mobile/scripts/prepare-web.mjs` 可以制作 `mobile/dist`（此恢复流程已实际验证），但备份没有完整 Android Gradle 工程和商用版签名密钥，因此现在**不能提供与原 11 月 23 日同签名、可安全覆盖安装的 APK**。

禁止在没有原签名及数据迁移/备份验证时覆盖安装到存有用户记录的手机上。
