-- Ghost-account read lockdown. Run once in Supabase Dashboard -> SQL Editor.
-- Idempotent — safe to re-run. Needs public.is_student() from
-- sql/ghost-upload-guard.sql (already run).
--
-- A "ghost" (logged in via a direct auth.signUp(), no profiles row) could
-- still read the shop catalog, waste prices and the Top 10 leaderboard by
-- calling Supabase from devtools. None of it is secret, but there's no reason
-- to hand it to accounts that aren't real students/admins. Every real user
-- has a profile, so nobody legitimate is affected.

-- 1) Restrictive SELECT policies — AND-ed with the existing permissive
--    "authenticated can read ..." policies, so those don't need touching.
drop policy if exists "reads need a real profile" on public.waste_categories;
create policy "reads need a real profile"
  on public.waste_categories
  as restrictive
  for select
  to authenticated
  using (public.is_student() or public.is_admin());

drop policy if exists "reads need a real profile" on public.shop_items;
create policy "reads need a real profile"
  on public.shop_items
  as restrictive
  for select
  to authenticated
  using (public.is_student() or public.is_admin());

-- 2) Leaderboard: same function as sql/shop-redemption.sql (ranks by points
--    earned from approved submissions, so redeeming never drops rank), plus a
--    caller check in the WHERE clause (a ghost gets zero rows).
--    my_rank() needs no change — it already returns nothing without a profile.
create or replace function public.leaderboard_top10()
returns table (name text, nickname text, points_total integer, is_you boolean)
language sql
security definer
set search_path = public
as $$
  select p.name, p.nickname, e.earned::integer as points_total, (p.id = auth.uid()) as is_you
  from public.profiles p
  join (
    select s.user_id, sum(s.points_awarded) as earned
    from public.submissions s
    where s.status = 'approved'
    group by s.user_id
  ) e on e.user_id = p.id
  where p.role = 'student' and e.earned > 0
    and public.is_student()
  order by e.earned desc, p.name asc
  limit 10;
$$;

revoke execute on function public.leaderboard_top10() from public;
grant execute on function public.leaderboard_top10() to authenticated;

-- 3) Informational only — the two new restrictive policies.
select tablename, policyname, permissive, cmd
from pg_policies
where schemaname = 'public' and policyname = 'reads need a real profile';
