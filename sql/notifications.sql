-- Notifications — unread count, clear, realtime. Run once in Supabase
-- Dashboard -> SQL Editor. Idempotent — safe to re-run.
--
-- The Home bell lists the student's reviewed submissions (approved +
-- rejected). Two timestamps on profiles remember, across devices:
--   notif_seen_at    — when the bell was last opened (badge counts reviews after it)
--   notif_cleared_at — when "ล้างทั้งหมด" was last pressed (list hides reviews before it)
-- Students can't UPDATE profiles directly (points_total lives there), so
-- both are set through SECURITY DEFINER functions that touch only these
-- columns of the caller's own row.

alter table public.profiles add column if not exists notif_seen_at timestamptz;
alter table public.profiles add column if not exists notif_cleared_at timestamptz;

create or replace function public.mark_notifications_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set notif_seen_at = now() where id = auth.uid();
$$;

create or replace function public.clear_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set notif_seen_at = now(), notif_cleared_at = now()
  where id = auth.uid();
$$;

revoke all on function public.mark_notifications_seen() from public, anon;
revoke all on function public.clear_notifications() from public, anon;
grant execute on function public.mark_notifications_seen() to authenticated;
grant execute on function public.clear_notifications() to authenticated;

-- Realtime: let the Home page hear about approve/reject without a reload.
-- The existing "students can read own submissions" RLS policy still
-- applies, so each student only receives events for their own rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;

-- Informational — should show one row for submissions.
select pubname, tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'submissions';
