-- Phase 7 — Admin-managed Shop catalog (real items + photos, replacing the
-- SHOP_ITEMS mock array in js/shop.js). Run once in Supabase Dashboard ->
-- SQL Editor (project region ap-southeast-1). Idempotent — safe to re-run.
--
-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ MANUAL STEP FIRST — this SQL cannot create a Storage bucket for you. │
-- │ Before running the rest of this file:                                │
-- │   1. Supabase Dashboard -> Storage -> "New bucket"                   │
-- │   2. Name: shop-items                                                │
-- │   3. Public bucket: ON (toggle it on)                                │
-- │      — different from the `submissions` bucket, which is private.   │
-- │        Product photos aren't sensitive and every student needs to   │
-- │        see them, so this bucket is public by design.                │
-- │   4. File size limit: 5 MB                                           │
-- │   5. Allowed MIME types: image/jpeg,image/png                       │
-- │   6. Click "Create bucket"                                          │
-- │ Only after the bucket exists, run the SQL below — the storage       │
-- │ policies reference bucket_id = 'shop-items', which must already     │
-- │ exist (they won't error if it doesn't, but nothing will ever match). │
-- └─────────────────────────────────────────────────────────────────────┘

-- 1) The catalog table.
create table if not exists public.shop_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  section text not null check (section in ('cert', 'stationery', 'limited')),
  name text not null,
  description text,
  cost integer not null check (cost >= 0),
  image_path text,
  stock integer,
  stock_max integer,
  opens_on date
);

alter table public.shop_items enable row level security;

-- Every logged-in student and admin needs to read the catalog — it's the
-- Shop page's data source, no restriction beyond being authenticated.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shop_items'
      and policyname = 'authenticated can read shop items'
  ) then
    create policy "authenticated can read shop items"
      on public.shop_items for select to authenticated using (true);
  end if;
end $$;

-- Only admins can add/edit/remove items — same is_admin() helper every
-- other admin-only policy in this project already uses.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shop_items'
      and policyname = 'admins can manage shop items'
  ) then
    create policy "admins can manage shop items"
      on public.shop_items for all to authenticated
      using (is_admin()) with check (is_admin());
  end if;
end $$;

-- 2) Storage RLS for the shop-items bucket (create the bucket itself by
--    hand first — see the instructions at the top of this file).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public can view shop item images'
  ) then
    create policy "public can view shop item images"
      on storage.objects for select
      using (bucket_id = 'shop-items');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'admins can upload shop item images'
  ) then
    create policy "admins can upload shop item images"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'shop-items' and is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'admins can update shop item images'
  ) then
    create policy "admins can update shop item images"
      on storage.objects for update to authenticated
      using (bucket_id = 'shop-items' and is_admin())
      with check (bucket_id = 'shop-items' and is_admin());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'admins can delete shop item images'
  ) then
    create policy "admins can delete shop item images"
      on storage.objects for delete to authenticated
      using (bucket_id = 'shop-items' and is_admin());
  end if;
end $$;

-- 3) Seed the 10 items currently hardcoded in the SHOP_ITEMS mock array in
--    js/shop.js, so the catalog isn't empty on first load. No photos yet —
--    image_path stays null until an admin uploads one via the new Shop tab
--    in admin-review.html. Each insert is guarded by WHERE NOT EXISTS so
--    re-running this file doesn't create duplicates.
insert into public.shop_items (section, name, description, cost)
select 'cert', 'แลกเกียรติบัตร', 'เกียรติบัตรผู้พิทักษ์โลกดิจิทัล', 1800
where not exists (select 1 from public.shop_items where name = 'แลกเกียรติบัตร');

insert into public.shop_items (section, name, cost)
select 'stationery', 'ปากกาเจลหมึกสี', 350
where not exists (select 1 from public.shop_items where name = 'ปากกาเจลหมึกสี');

insert into public.shop_items (section, name, cost)
select 'stationery', 'สมุดโน้ตลายแผนที่', 480
where not exists (select 1 from public.shop_items where name = 'สมุดโน้ตลายแผนที่');

insert into public.shop_items (section, name, cost)
select 'stationery', 'สติกเกอร์ตราไปรษณีย์', 220
where not exists (select 1 from public.shop_items where name = 'สติกเกอร์ตราไปรษณีย์');

insert into public.shop_items (section, name, cost)
select 'stationery', 'ไฮไลท์เตอร์ 3 สี', 300
where not exists (select 1 from public.shop_items where name = 'ไฮไลท์เตอร์ 3 สี');

insert into public.shop_items (section, name, cost)
select 'stationery', 'วอชิเทปลายแผนที่', 260
where not exists (select 1 from public.shop_items where name = 'วอชิเทปลายแผนที่');

insert into public.shop_items (section, name, cost)
select 'stationery', 'สมุดพาสปอร์ตสะสมตรา', 3200
where not exists (select 1 from public.shop_items where name = 'สมุดพาสปอร์ตสะสมตรา');

insert into public.shop_items (section, name, cost, stock, stock_max)
select 'limited', 'กระเป๋าผ้าลายตราไปรษณีย์', 900, 3, 10
where not exists (select 1 from public.shop_items where name = 'กระเป๋าผ้าลายตราไปรษณีย์');

insert into public.shop_items (section, name, cost, stock, stock_max)
select 'limited', 'กระบอกน้ำสะสม', 1500, 0, 10
where not exists (select 1 from public.shop_items where name = 'กระบอกน้ำสะสม');

insert into public.shop_items (section, name, cost, opens_on)
select 'limited', 'เข็มกลัดตราปั๊ม', 650, date '2026-10-01'
where not exists (select 1 from public.shop_items where name = 'เข็มกลัดตราปั๊ม');

-- Informational only — confirms row counts per section after seeding.
select section, count(*) from public.shop_items group by section order by section;
