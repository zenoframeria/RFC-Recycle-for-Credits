-- Phase 6b — Rank: real Top 10 leaderboard + own-rank lookup. Run once in
-- Supabase Dashboard -> SQL Editor (project region ap-southeast-1).
-- Idempotent — safe to re-run (create or replace function).
--
-- Problem: `profiles` RLS (per CLAUDE.md) only lets a student SELECT their
-- own row, by design — a student's own points are their business. A
-- leaderboard needs to read across all students, so this adds two
-- SECURITY DEFINER functions (same pattern as the existing check_roster()/
-- check_admin_roster() functions) that expose only the minimum needed to
-- render a leaderboard. Neither function is admin-gated — every student
-- should be able to see the leaderboard, that's the whole point of it.

-- 1) Top 10 by points_total, students only (admins don't compete on the
--    leaderboard), excluding students with points_total = 0 (the vast
--    majority who haven't submitted anything yet — never pad the list with
--    blank/zero rows). Secondary sort by name keeps ordering deterministic
--    across repeated calls when points_total ties. Also returns a
--    server-computed `is_you` flag (p.id = auth.uid()) so the client can
--    identify the caller's own row by identity, not by comparing rank
--    numbers — my_rank() below uses competition ranking (ties share one
--    rank), which does not correspond 1:1 with this function's unique list
--    positions when two students tie on points_total.
create or replace function public.leaderboard_top10()
returns table (name text, points_total integer, is_you boolean)
language sql
security definer
set search_path = public
as $$
  select p.name, p.points_total, (p.id = auth.uid()) as is_you
  from public.profiles p
  where p.role = 'student' and p.points_total > 0
  order by p.points_total desc, p.name asc
  limit 10;
$$;

revoke execute on function public.leaderboard_top10() from public;
grant execute on function public.leaderboard_top10() to authenticated;

-- 2) The calling student's own rank + points, even if outside the top 10.
--    Rank = 1 + count of students with strictly more points (computed in
--    SQL, not by fetching/sorting the full student list client-side).
--    Returns zero rows if the caller has no profiles row.
create or replace function public.my_rank()
returns table (my_rank bigint, points_total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
begin
  select p.points_total into v_points
  from public.profiles p
  where p.id = auth.uid();

  if v_points is null then
    return;
  end if;

  return query
    select
      1 + (
        select count(*) from public.profiles p2
        where p2.role = 'student' and p2.points_total > v_points
      ) as my_rank,
      v_points as points_total;
end;
$$;

revoke execute on function public.my_rank() from public;
grant execute on function public.my_rank() to authenticated;

-- Informational only — confirms both functions exist as SECURITY DEFINER
-- and shows their granted privileges.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public' and routine_name in ('leaderboard_top10', 'my_rank');
