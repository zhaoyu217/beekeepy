# HiveDash · 推送通知上线指南

## 已经做好的(在最新 app.html / sw.js 里)
- 设置页「Notifications」开关 → 申请权限、订阅、把订阅存到 Supabase。
- service worker 收到推送会弹通知,点击会打开 app。
- 防重复触发、订阅失效自动清理。
- 公钥已内置进 app(VAPID 公钥)。

> 客户端齐了,但**要让通知真正发出去,需要下面的后端 3 步。**

---

## 后端设置(发送端)

### 1. 建订阅表
Supabase → SQL Editor 运行 `hivedash-push-setup.sql`。

### 2. 部署发送函数
需要 Supabase CLI(`npm i -g supabase`,然后 `supabase login`、`supabase link`)。
1. 在项目里建目录 `supabase/functions/send-push/`,把 `supabase-function-send-push.ts` 改名为 `index.ts` 放进去。
2. 设密钥(VAPID 公私钥在随附的 `vapid.txt` 里):
   ```
   supabase secrets set VAPID_PUBLIC_KEY=<vapid.txt 的 PUBLIC>
   supabase secrets set VAPID_PRIVATE_KEY=<vapid.txt 的 PRIVATE>
   supabase secrets set VAPID_SUBJECT=mailto:support@hivedash.app
   ```
   ⚠️ **私钥保密**,只设到 Supabase secrets,不要进任何前端文件或仓库。
3. 部署:
   ```
   supabase functions deploy send-push
   ```

### 3. 测试发一条
先在手机/电脑上把 app 的「Notifications」打开(会订阅成功),然后:
```
curl -X POST 'https://ydrawqnkwdvfhauansdf.supabase.co/functions/v1/send-push' \
  -H 'Authorization: Bearer <你的 anon 或 service key>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"HiveDash","body":"Time to inspect Hive #1 🐝","url":"/app.html"}'
```
不带 `user_id` = 广播给所有订阅;带 `"user_id":"<uuid>"` = 只发给某用户。
设备上应弹出通知。

---

## 让它「定时提醒」(可选,进阶)
真正的「该检查蜂箱了」提醒,需要定时触发上面的函数。两种方式:
- **pg_cron**(Supabase 内置):在数据库里建定时任务,定期查出「有逾期任务」的用户,对每人调用 send-push。需要写一小段 SQL/函数。
- **外部定时器**:任意 cron 服务(如 cron-job.org)定时 POST 调用该函数。

需要的话我可以帮你写这段「找出逾期用户并推送」的 pg_cron 任务。

---

## iOS / 苹果商店注意
- **网页/已安装 PWA**:iOS **16.4+** 且用户「添加到主屏幕」后,上面这套 web push 才会在 iPhone 上生效。
- **苹果商店版(Capacitor 壳)**:商店里的原生 app **不走 web push**,要用 Capacitor 的原生推送插件 + APNs(在 Xcode/壳工程里配),那是另一套。这套 web push 主要服务**网页用户 + 安卓 + 已装 PWA 的 iOS**。

---

## 安全小结
- 公钥:可公开(已在 app 里)。
- 私钥(`vapid.txt` 的 PRIVATE):**机密**,只进 Supabase secrets。
- `vapid.txt` 本身别上传到 GitHub/网站。
