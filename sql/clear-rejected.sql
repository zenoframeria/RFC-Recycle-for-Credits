-- Clear rejected submissions — the "ล้างทั้งหมด" button on Home's rejected
-- tab. Run once in Supabase Dashboard -> SQL Editor. Idempotent — safe to
-- re-run. Run this BEFORE pushing the dashboard code that calls it.
--
-- Rejected photos are kept (for disputes) until the student clears them.
-- Clearing deletes every one of the caller's rejected submissions — not just
-- the 7 days shown in the tab — photo first, then the row:
--   1) the browser removes the photos through the Storage API (policy below)
--   2) the browser calls clear_my_rejected(ids) to delete the rows
-- Photo first on purpose: the storage policy needs the row to still exist,
-- so a failed photo delete stops before any row is lost.

-- 1) Students may delete a photo in the submissions bucket only when it is
--    their own upload AND it belongs to one of their rejected submissions.
--    Pending/approved photos stay admin-only, as before.
drop policy if exists "students delete own rejected photos" on storage.objects;
create policy "students delete own rejected photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'submissions'
    and owner = auth.uid()
    and exists (
      select 1 from public.submissions s
      where s.photo_url = objects.name
        and s.user_id = auth.uid()
        and s.status = 'rejected'
    )
  );

-- 2) Delete the caller's own rejected rows, limited to the ids the browser
--    just cleared photos for — so a submission an admin rejects mid-click
--    (whose photo wasn't removed) isn't deleted with its photo left behind.
--    Students have no DELETE grant on submissions; this is the only way in.
create or replace function public.clear_my_rejected(p_ids uuid[])
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.submissions
    where id = any(p_ids)
      and user_id = auth.uid()
      and status = 'rejected'
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.clear_my_rejected(uuid[]) from public, anon;
grant execute on function public.clear_my_rejected(uuid[]) to authenticated;

-- Informational — should list the new delete policy.
select policyname, permissive, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE';
