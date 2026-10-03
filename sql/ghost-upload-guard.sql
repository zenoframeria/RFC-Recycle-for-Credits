-- Ghost-account upload guard. Run once in Supabase Dashboard -> SQL Editor.
-- Idempotent — safe to re-run.
--
-- Problem: anyone can call supabaseClient.auth.signUp() directly (skipping the
-- roster check in auth.js) and get a logged-in "ghost" account with no
-- profiles row. The existing INSERT policy on the `submissions` Storage bucket
-- only checks `owner = auth.uid()`, so a ghost could still upload photos and
-- fill the 1GB free-tier storage.
--
-- Fix: a RESTRICTIVE policy. Restrictive policies are AND-ed with the existing
-- permissive ones, so we don't need to know or touch the existing policy's
-- name — uploads to `submissions` now also require a real student profile.
-- Other buckets (shop-items) are unaffected.

-- 1) Helper, same pattern as is_admin(): SECURITY DEFINER so it reads
--    profiles without depending on the caller's RLS.
create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  );
$$;

grant execute on function public.is_student() to authenticated;

-- 2) The restrictive policy.
drop policy if exists "submissions uploads need a student profile" on storage.objects;
create policy "submissions uploads need a student profile"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (bucket_id <> 'submissions' or public.is_student());

-- 3) Informational only — lists every policy on storage.objects so you can
--    see the new restrictive one next to the old permissive ones.
select policyname, permissive, cmd, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
