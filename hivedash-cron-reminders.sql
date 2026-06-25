-- ============================================================
--  HiveDash · 自动逾期提醒(pg_cron)
--  每天扫描每个用户的检查记录,找出「最近一次检查超过 N 天」的
--  蜂箱,调用 send-push 给该用户推送提醒。
--
--  前置条件:
--   1) 已跑 hivedash-push-setup.sql(订阅表)
--   2) 已部署 send-push Edge Function(见 push-notifications-guide.md)
--   3) app 已更新(检查记录带 iso 时间戳 —— 只对更新后新增的检查生效)
--
--  在 Supabase → SQL Editor 运行。
-- ============================================================

-- 1) 开启所需扩展(Supabase 支持)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) 逾期提醒函数
--    把下面两个占位换成你的真实值:
--      <<PROJECT_URL>>      例如 https://ydrawqnkwdvfhauansdf.supabase.co
--      <<SERVICE_ROLE_KEY>> Supabase → Settings → API → service_role
--    (service_role 是机密;它只存在你自己的数据库函数里,不外泄。)
create or replace function public.notify_overdue_hives(threshold_days int default 10)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  cnt int := 0;
  fn_url      text := '<<PROJECT_URL>>/functions/v1/send-push';
  service_key text := '<<SERVICE_ROLE_KEY>>';
begin
  for r in
    with per_hive as (
      select hd.user_id,
             rec->>'hid'                          as hid,
             max((rec->>'iso')::timestamptz)      as last_insp
      from public.hive_data hd,
           lateral jsonb_array_elements(coalesce(hd.data->'records', '[]'::jsonb)) rec
      where (rec->>'iso') is not null
      group by hd.user_id, rec->>'hid'
    )
    select user_id,
           count(*)                               as overdue,
           string_agg(hid, ', ' order by hid)     as hives
    from per_hive
    where last_insp < now() - make_interval(days => threshold_days)
    group by user_id
  loop
    perform net.http_post(
      url     := fn_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || service_key
                 ),
      body    := jsonb_build_object(
                   'user_id', r.user_id,
                   'title',   'HiveDash',
                   'body',    'You haven''t inspected ' || r.hives ||
                              ' in over ' || threshold_days || ' days 🐝',
                   'url',     '/app.html'
                 )
    );
    cnt := cnt + 1;
  end loop;
  return cnt;
end;
$$;

-- 3) 定时任务:每天 09:00(UTC)跑一次,阈值 10 天
--    （改时间就改 cron 表达式;改天数就改函数参数）
select cron.schedule(
  'hivedash-overdue-reminders',
  '0 9 * * *',
  $$ select public.notify_overdue_hives(10); $$
);

-- ============================================================
--  常用操作
-- ============================================================
-- 立刻手动跑一次测试(会真的推送):
--   select public.notify_overdue_hives(10);
--
-- 查看已排定的任务:
--   select * from cron.job;
--
-- 取消任务:
--   select cron.unschedule('hivedash-overdue-reminders');
--
-- 查看最近执行记录:
--   select * from cron.job_run_details order by start_time desc limit 10;

-- ============================================================
--  说明 / 限制(请知悉)
--  · 只统计「带 iso 时间戳」的检查 —— 即 app 更新后新记录的检查。
--    更新前的老记录没有 iso,不会触发(用户下次记录后即纳入)。
--  · 判定口径:某蜂箱「最近一次检查」距今超过 threshold_days 天 →
--    视为逾期。从没检查过的蜂箱不计入(避免打扰新用户)。
--  · app 目前没有「每箱自定义检查间隔」,这里用统一天数(默认 10)。
--    若以后想按箱设定,需要再加一点 app 端逻辑。
-- ============================================================
