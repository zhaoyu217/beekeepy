# Beekeepy 原始数据保全模块（候选实验版）

**本模块是为恢复和审计重新实现的独立工具，不是 2026-11-23 已丢失的原始代码，不是已批准的 `Beekeepy Local Preservation V2 / suite 0x0001` 协议。**

已实现：明确范围只读读取 localStorage 原始字符串与 IndexedDB 主键/记录/结构；多类结构化原始值标签编码；SHA256 逐项校验；PBKDF2-SHA256（60万次）+ AES-256-GCM 加密；错误密码/篡改/遗漏拒绝；只读同步差异检查；隔离恢复**计划**；浏览器工作台的用户主动下载。

默认只枚举 `hivedash_v9`、`hivedash_phase1`、`beekeepy_sync_v2`。对超出范围的 IndexedDB、Cache、Service Worker、文件、sessionStorage、Blob URLs、草稿、未保存图片等**不宣称覆盖**。如浏览器不支持 IDB 清单、数据库不存在、存储被锁、跨存储变化、数据类型未知，则必须停止并登记缺口。跨存储采集并非原子快照，不能用于生产恢复。

不可使用 `state()`、`save()`、`normalizeStateV50` 或 sync 桥接读取原始数据；工具仅使用浏览器原生只读接口。

此版本为 *v0 独立候选封装*，与历史冻结的 `BKPTREE-SHA256-128-1M-v1` 和 suite `0x0001` 不兼容，不能把它伪称 V2.0 验收完成。生产恢复写入、删除、重放旧同步 receipts、账户迁移及真实云同步通道全部关闭。

运行测试：`node --test tools/data-preservation-v2/tests/*.test.mjs`。

在支持 WebCrypto 的安全上下文中以本地 HTTP localhost/HTTPS 静态服务打开 `workbench.html`；必须确认当前网页 origin 是计划保全的真实数据源，不能跨 origin 读取另一个 App 的数据。强烈建议离线、使用合成账户数据演练；严禁把真实备份 JSON/口令/Token 上传到公开服务。
