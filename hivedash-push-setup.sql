-- ============================================================
--  HiveDash · 推送订阅表(Web Push)
--  在 Supabase → SQL Editor 运行一次。
-- ============================================================

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  updated_at timestamptz default now()
);

-- 行级安全:每个登录用户只能读写自己的订阅
alter table public.push_subscriptions enable row level security;
drop policy if exists "push owner access" on public.push_subscriptions;
create policy "push owner access"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 验证
select c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policy where polrelid=c.oid) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='push_subscriptions';
-- 期望:rls_enabled=true, policies>=1

-- 说明:用户删除账号时(delete_account 删 auth.users),
-- 这里的订阅会因 on delete cascade 自动一并删除。
