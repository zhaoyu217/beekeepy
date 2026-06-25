-- ============================================================
--  HiveDash · 应用内"删除账号"所需的 Supabase 函数
--  苹果 / 谷歌商店都强制要求用户能在 app 内删除账号。
--  在 Supabase → SQL Editor 里运行一次即可。
-- ============================================================

-- 让"已登录用户"能删除自己的账号:先删其数据行,再删 auth 用户。
-- security definer 让函数以所有者权限运行,从而能删除 auth.users。
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 删除该用户的所有业务数据
  delete from public.hive_data where user_id = auth.uid();
  -- 删除登录账号本身
  delete from auth.users where id = auth.uid();
end;
$$;

-- 只允许已登录用户调用;禁止匿名/公开调用
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
--  验证:函数存在
-- ============================================================
select proname, prosecdef as security_definer
from pg_proc
where proname = 'delete_account';
-- 期望:能查到一行,security_definer = true

-- ============================================================
--  说明
--  · app 里"删除账号"按钮会调用 sb.rpc('delete_account'),
--    然后登出并清空本地数据。用户的账号与所有蜂箱数据被永久删除。
--  · 如果以后又加了别的存数据的表,记得在上面 delete from 那里
--    一起加上对应的删除语句。
-- ============================================================
