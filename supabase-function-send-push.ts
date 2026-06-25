// HiveDash · Supabase Edge Function: send-push
// 把这个文件放到  supabase/functions/send-push/index.ts
// 部署:  supabase functions deploy send-push
//
// 需要先设三个密钥(supabase secrets set ...):
//   VAPID_PUBLIC_KEY   = (vapid.txt 里的 PUBLIC)
//   VAPID_PRIVATE_KEY  = (vapid.txt 里的 PRIVATE,保密!)
//   VAPID_SUBJECT      = mailto:support@hivedash.app
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 由平台自动注入。

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, url } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:support@hivedash.app",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    // user_id 提供则只发给该用户,否则广播给所有订阅
    let q = supabase.from("push_subscriptions").select("*");
    if (user_id) q = q.eq("user_id", user_id);
    const { data: subs, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({
      title: title || "HiveDash",
      body: body || "A hive needs your attention.",
      url: url || "/app.html",
    });

    let sent = 0;
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        // 订阅失效(过期/退订)→ 清理
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }));

    return new Response(JSON.stringify({ ok: true, sent, total: subs?.length || 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
