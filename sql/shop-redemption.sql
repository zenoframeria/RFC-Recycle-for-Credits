-- Real Shop redemption — replaces the local-only demo redeem in js/shop.js.
-- Run once in Supabase Dashboard -> SQL Editor (project region
-- ap-southeast-1). Idempotent — safe to re-run.
--
-- Run this BEFORE the shop-redemption branch's code goes live: the new
-- Shop / Pickups code calls redeem_item() and reads `redemptions`, which
-- don't exist until this runs. Running it early is harmless — the old code
-- never touches them, and part 4 keeps the leaderboard functions' names
-- and return shape, so today's rank.js keeps working.
--
-- Rules (agreed with the owner, 2026-10-05):
--   * Redeeming is final — no cancel, no refund. The Shop asks to confirm first.
--   * Points come off profiles.points_total and stock drops the moment the
--     student confirms, all inside redeem_item() on the server.
--   * cert + limited: one per student. stationery: any number of times.
--   * The student shows the receipt (code R-0042 = redemption id 42) to a
--     council member, who looks it up in the Pickups tab and marks it
--     picked up — once. A picked-up receipt can't be used again.
--   * Rank counts points EARNED (sum of approved submissions), so spending
--     points in the Shop never drops a student's rank.

-- 1) The log — one row per redemption.
--    item_name / item_section / cost are copied from shop_items at redeem
--    time, so the receipt stays correct even if an admin later renames,
--    re-prices or deletes the item (shop_item_id then becomes null).
create table if not exists public.redemptions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_item_id bigint references public.shop_items(id) on delete set null,
  item_name text not null,
  item_section text not null,
  cost integer not null check (cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'picked_up')),
  picked_up_by uuid references public.profiles(id),
  picked_up_at timestamptz
);

create index if not exists redemptions_user_id_idx on public.redemptions (user_id);

alter table public.redemptions enable row level security;

-- SELECT only. Nobody writes this table directly from the browser — every
-- insert goes through redeem_item() and every status change through
-- mark_redemption_picked_up(), both SECURITY DEFINER below.
grant select on public.redemptions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'redemptions'
      and policyname = 'students can read own redemptions'
  ) then
    create policy "students can read own redemptions"
      on public.redemptions for select to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'redemptions'
      and policyname = 'admins can read all redemptions'
  ) then
    create policy "admins can read all redemptions"
      on public.redemptions for select to authenticated
      using (public.is_admin());
  end if;
end $$;

-- 2) Redeem. Everything happens in one transaction: lock the item row
--    (two students racing for the last Limited item serialize here), lock
--    the student's profile (a double-tap can't spend the same points
--    twice), check every rule, then deduct + decrement + write the log.
--    Lock order is always item -> profile, so two calls can't deadlock.
create or replace function public.redeem_item(p_item_id bigint)
returns table (success boolean, message text, redemption_id bigint, points_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shop_items%rowtype;
  v_points integer;
  v_id bigint;
begin
  if not public.is_student() then
    raise exception 'not authorized';
  end if;

  select * into v_item
  from public.shop_items
  where id = p_item_id
  for update;

  if not found then
    return query select false, 'not found'::text, null::bigint, null::integer;
    return;
  end if;

  -- opens_on is a school-calendar date, so compare against today in Thailand
  if v_item.opens_on is not null
     and v_item.opens_on > (now() at time zone 'Asia/Bangkok')::date then
    return query select false, 'not open'::text, null::bigint, null::integer;
    return;
  end if;

  if v_item.stock is not null and v_item.stock <= 0 then
    return query select false, 'sold out'::text, null::bigint, null::integer;
    return;
  end if;

  if v_item.section in ('cert', 'limited') and exists (
    select 1 from public.redemptions r
    where r.user_id = auth.uid() and r.shop_item_id = p_item_id
  ) then
    return query select false, 'already redeemed'::text, null::bigint, null::integer;
    return;
  end if;

  select p.points_total into v_points
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if v_points < v_item.cost then
    return query select false, 'not enough points'::text, null::bigint, v_points;
    return;
  end if;

  update public.profiles
  set points_total = points_total - v_item.cost
  where id = auth.uid();

  if v_item.stock is not null then
    update public.shop_items set stock = stock - 1 where id = p_item_id;
  end if;

  insert into public.redemptions (user_id, shop_item_id, item_name, item_section, cost)
  values (auth.uid(), p_item_id, v_item.name, v_item.section, v_item.cost)
  returning id into v_id;

  return query select true, 'redeemed'::text, v_id, v_points - v_item.cost;
end;
$$;

revoke execute on function public.redeem_item(bigint) from public;
grant execute on function public.redeem_item(bigint) to authenticated;

-- 3) Hand-over. The `where status = 'pending'` makes it count only once,
--    even if two council members tap "มอบแล้ว" on the same receipt at once.
create or replace function public.mark_redemption_picked_up(p_redemption_id bigint)
returns table (success boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.redemptions
  set status = 'picked_up',
      picked_up_by = auth.uid(),
      picked_up_at = now()
  where id = p_redemption_id and status = 'pending';

  if found then
    return query select true, 'picked up'::text;
  elsif exists (select 1 from public.redemptions where id = p_redemption_id) then
    return query select false, 'already picked up'::text;
  else
    return query select false, 'not found'::text;
  end if;
end;
$$;

revoke execute on function public.mark_redemption_picked_up(bigint) from public;
grant execute on function public.mark_redemption_picked_up(bigint) to authenticated;

-- 4) Rank by points EARNED instead of points_total (which now drops when a
--    student redeems). Earned = sum of points_awarded over the student's
--    approved submissions — nothing new to store or keep in sync.
--    Same names and return columns as before (the column is still called
--    points_total so rank.js needn't change), so CREATE OR REPLACE works
--    without a DROP.
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
  order by e.earned desc, p.name asc
  limit 10;
$$;

revoke execute on function public.leaderboard_top10() from public;
grant execute on function public.leaderboard_top10() to authenticated;

create or replace function public.my_rank()
returns table (my_rank bigint, points_total integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    return;
  end if;

  select coalesce(sum(s.points_awarded), 0)::integer into v_earned
  from public.submissions s
  where s.user_id = auth.uid() and s.status = 'approved';

  return query
    select
      1 + (
        select count(*) from (
          select s.user_id
          from public.submissions s
          join public.profiles p2 on p2.id = s.user_id and p2.role = 'student'
          where s.status = 'approved'
          group by s.user_id
          having sum(s.points_awarded) > v_earned
        ) ahead
      ) as my_rank,
      v_earned as points_total;
end;
$$;

revoke execute on function public.my_rank() from public;
grant execute on function public.my_rank() to authenticated;

-- Informational only — the 4 functions should all say DEFINER.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('redeem_item', 'mark_redemption_picked_up', 'leaderboard_top10', 'my_rank');
