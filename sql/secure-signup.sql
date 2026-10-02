-- Secure signup — profiles are created only by the server. Run in Supabase
-- Dashboard -> SQL Editor. Idempotent — safe to re-run.
--
-- Problem: signup used to insert its own profiles row straight from the
-- browser, guarded only by `auth.uid() = id`. The roster check happened in
-- the browser too, so anyone with devtools could create an account with
-- role = 'admin', any name/student_id, or a starting points_total.
--
-- Fix: create_my_profile() takes NO arguments. It reads the caller's own
-- auth email ({student_id}@student.kyt.local or @admin.kyt.local), checks
-- the matching roster on the server, and inserts the row itself
-- (role from the email domain, name/class from the roster, points 0).
--
-- RUN IN TWO STEPS:
--   PART A — any time (safe: adds the function, the old signup keeps working).
--   PART B — only when the new js/auth.js is live (i.e. when merging), since
--            it removes the old direct insert that the old auth.js still uses.

-- ═══ PART A ═══════════════════════════════════════════════════════════

create or replace function public.create_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_email      text;
  v_id         text;
  v_domain     text;
  v_role       text;
  v_student_id text;
  v_name       text;
  v_class      text;
  v_row        public.profiles;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile already exists';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  v_id     := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  if v_domain = 'student.kyt.local' then
    v_role := 'student';
    select r.student_id, r.name, r.class_room
      into v_student_id, v_name, v_class
      from public.student_roster r
      where lower(r.student_id) = v_id
      limit 1;
  elsif v_domain = 'admin.kyt.local' then
    v_role := 'admin';
    select r.student_id, r.name
      into v_student_id, v_name
      from public.admin_roster r
      where lower(r.student_id) = v_id
      limit 1;
  else
    raise exception 'unknown account type';
  end if;

  if not found then
    raise exception 'not on roster';
  end if;

  insert into public.profiles (id, role, student_id, name, class_room)
  values (v_uid, v_role, v_student_id, v_name, v_class)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_my_profile() from public, anon;
grant execute on function public.create_my_profile() to authenticated;

-- ═══ PART B — run when merging (new js/auth.js live) ══════════════════

drop policy if exists "Users can create own profile" on public.profiles;
revoke insert on public.profiles from authenticated, anon;

-- Informational — after PART B, authenticated should have INSERT on no
-- column, and UPDATE only on nickname (set on 2026-10-02:
-- `revoke update ... ; grant update (nickname) ...`).
select privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
order by privilege_type, column_name;
