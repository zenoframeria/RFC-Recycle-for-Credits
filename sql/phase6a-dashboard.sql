-- Phase 6a — Dashboard: real personal stats. Run once in Supabase Dashboard
-- -> SQL Editor (project region ap-southeast-1). Idempotent — safe to re-run.
--
-- Problem: dashboard.js now needs to read the logged-in student's own
-- `submissions` rows (for the points/kg tile and the recent-activity list).
-- The only existing SELECT policy on `submissions` is admin-scoped
-- (is_admin()) for the Phase 5 review feed — nothing before this phase ever
-- needed a student to read their own submissions back (scan.html only ever
-- inserts). This adds that missing student-self-read policy.
--
-- Safe alongside the existing admin SELECT policy: Postgres RLS OR's
-- multiple permissive policies together for the same command, so admins
-- keep seeing every row and students additionally see their own.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'submissions'
      and policyname = 'students can read own submissions'
  ) then
    create policy "students can read own submissions"
      on public.submissions for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Informational only — confirms the policy is in place and shows every
-- SELECT policy currently on submissions (should be this new one plus the
-- existing admin is_admin() one from Phase 5).
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'submissions' and cmd = 'SELECT';
