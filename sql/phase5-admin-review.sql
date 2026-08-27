-- Phase 5 — Admin console: atomic approve RPC + waste_categories price-edit
-- policy. Run once in Supabase Dashboard -> SQL Editor (project region
-- ap-southeast-1). Idempotent — safe to re-run if anything fails partway.

-- 1) Atomic approve. SECURITY DEFINER so it can write profiles.points_total,
--    which authenticated users cannot write directly (per the profiles RLS
--    documented in CLAUDE.md — only admins can UPDATE profiles, and even
--    admins should go through this function rather than a raw UPDATE, so
--    the status check and the points increment happen in one transaction).
--    `for update` locks the submissions row so a double-click or two admins
--    approving the same row concurrently serializes instead of double-
--    awarding: the second caller sees status <> 'pending' and no-ops.
create or replace function public.approve_submission(p_submission_id uuid)
returns table (success boolean, points_awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.submissions%rowtype;
  v_price integer;
  v_points integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_sub
  from public.submissions
  where id = p_submission_id
  for update;

  if not found then
    return query select false, null::integer, 'not found'::text;
    return;
  end if;

  if v_sub.status <> 'pending' then
    return query select false, null::integer, 'already reviewed'::text;
    return;
  end if;

  select coalesce(v_sub.point_value_snapshot, wc.point_value)
  into v_price
  from public.waste_categories wc
  where wc.id = v_sub.waste_category_id;

  v_points := round(v_sub.weight_kg * v_price);

  update public.submissions
  set status = 'approved',
      points_awarded = v_points,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_submission_id;

  update public.profiles
  set points_total = points_total + v_points
  where id = v_sub.user_id;

  return query select true, v_points, 'approved'::text;
end;
$$;

grant execute on function public.approve_submission(uuid) to authenticated;

-- 2) Admins need UPDATE on waste_categories.point_value for the price
--    editor (Part 4) — no such policy existed before Phase 5.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waste_categories'
      and policyname = 'admins can update waste categories'
  ) then
    create policy "admins can update waste categories"
      on public.waste_categories for update to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- 3) Informational only — does not change anything. Confirms no policy lets
--    a non-admin write directly to profiles (which would let a student
--    self-award points via devtools, bypassing approve_submission above).
--    Expected: every row's `qual`/`with_check` should reference is_admin().
--    If you see an UPDATE policy on profiles WITHOUT is_admin() in it,
--    stop and flag it before merging this branch.
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE';
