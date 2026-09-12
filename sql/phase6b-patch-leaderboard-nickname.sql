-- Phase 6b patch — leaderboard shows nicknames. Run once in Supabase
-- Dashboard -> SQL Editor (project region ap-southeast-1). Idempotent.
--
-- profiles.nickname already exists (backs the dashboard header's
-- nickname-edit feature), but leaderboard_top10() was never updated to
-- return it, so the Rank page could only show real names. This patch adds
-- nickname to the returned columns; js/rank.js now resolves the shown name
-- via the shared displayName() helper in js/nav-common.js (nickname if set,
-- else first name only) — same rule the dashboard header already uses for
-- the logged-in student's own name.
--
-- The return signature changes (name -> name + nickname), and Postgres
-- won't let CREATE OR REPLACE change a function's return type, so the old
-- function must be dropped first.
drop function if exists public.leaderboard_top10();

create or replace function public.leaderboard_top10()
returns table (name text, nickname text, points_total integer, is_you boolean)
language sql
security definer
set search_path = public
as $$
  select p.name, p.nickname, p.points_total, (p.id = auth.uid()) as is_you
  from public.profiles p
  where p.role = 'student' and p.points_total > 0
  order by p.points_total desc, p.name asc
  limit 10;
$$;

revoke execute on function public.leaderboard_top10() from public;
grant execute on function public.leaderboard_top10() to authenticated;

-- Informational only — confirms the new return shape.
select routine_name, data_type
from information_schema.routines
where routine_schema = 'public' and routine_name = 'leaderboard_top10';
