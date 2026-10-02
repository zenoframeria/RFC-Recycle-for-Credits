-- Roster checks return only found / not found. Run in Supabase Dashboard ->
-- SQL Editor. Idempotent — safe to re-run.
--
-- Problem: check_roster() / check_admin_roster() are callable WITHOUT login
-- (anon) and returned the student's real name + class for any student_id,
-- so a script could loop over IDs and collect the whole school's roster.
--
-- Since sql/secure-signup.sql, create_my_profile() reads name/class from the
-- roster on the server itself; js/auth.js only reads `found`. So both
-- functions now return just `found`. The return type changes, which
-- `create or replace` can't do — hence drop + create (+ re-grant).
-- Matching is case-insensitive, same as create_my_profile().

drop function if exists public.check_roster(text);
create function public.check_roster(p_student_id text)
returns table (found boolean)
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.student_roster
    where lower(student_id) = lower(trim(p_student_id))
  );
$$;

drop function if exists public.check_admin_roster(text);
create function public.check_admin_roster(p_student_id text)
returns table (found boolean)
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_roster
    where lower(student_id) = lower(trim(p_student_id))
  );
$$;

revoke all on function public.check_roster(text) from public;
revoke all on function public.check_admin_roster(text) from public;
grant execute on function public.check_roster(text) to anon, authenticated;
grant execute on function public.check_admin_roster(text) to anon, authenticated;

-- Informational — each should return one row with only `found`
-- (replace 'xxxx' with a real student_id to see true).
select * from public.check_roster('xxxx');
select * from public.check_admin_roster('xxxx');
