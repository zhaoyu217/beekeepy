-- ============================================================
--  HiveDash · Supabase 数据安全 (Row Level Security)
--  在 Supabase → SQL Editor 里运行。
--  分两步:先跑【第1步 审计】看现状,再跑【第2步 加固】。
-- ============================================================


-- ============================================================
--  第 1 步：审计 —— 查看 public 里每张表是否开启了 RLS
--  （只读，安全。relrowsecurity = true 表示已开启）
-- ============================================================
select
  c.relname                       as table_name,
  c.relrowsecurity                as rls_enabled,
  coalesce(p.cnt, 0)              as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join (
  select polrelid, count(*) cnt from pg_policy group by polrelid
) p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
order by rls_enabled asc, table_name;
-- 看结果:任何 rls_enabled = false 的数据表都是风险点。
-- hive_data 必须是 true 且 policy_count > 0。


-- ============================================================
--  第 2 步：加固 hive_data —— 开启 RLS + 只能访问自己的行
--  （安全可重复运行；不会动到已有数据）
-- ============================================================

-- 2a. 开启行级安全
alter table public.hive_data enable row level security;

-- 2b. 清掉可能存在的旧策略，避免重复
drop policy if exists "own rows - select" on public.hive_data;
drop policy if exists "own rows - insert" on public.hive_data;
drop policy if exists "own rows - update" on public.hive_data;
drop policy if exists "own rows - delete" on public.hive_data;
drop policy if exists "hive_data owner access" on public.hive_data;

-- 2c. 一条总策略：登录用户只能读/写/改/删自己 user_id 的行
create policy "hive_data owner access"
  on public.hive_data
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2d.（可选但推荐）确保 user_id 有非空约束，杜绝无主数据
--    如果这行报错说已存在约束，忽略即可。
-- alter table public.hive_data alter column user_id set not null;


-- ============================================================
--  第 3 步：验证 —— 确认 hive_data 已锁好
-- ============================================================
select
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policy where polrelid = c.oid) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'hive_data';
-- 期望:rls_enabled = true, policy_count >= 1


-- ============================================================
--  说明
--  · 开启后,前端那个公开的 anon key 再也无法读到别人的数据;
--    只有登录用户、且只能访问自己的行。app 用的是登录会话,
--    auth.uid() 会等于该用户,所以功能照常,不受影响。
--  · 如果第1步发现还有别的存数据的表(不是系统表),
--    把上面 2a–2c 的 hive_data 换成那张表名、user_id 换成它的
--    用户列名,同样跑一遍即可。需要我帮你写就把表结构发我。
-- ============================================================
