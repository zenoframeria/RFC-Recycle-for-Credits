-- Server-side price snapshot. Run once in Supabase Dashboard -> SQL Editor.
-- Idempotent — safe to re-run.
--
-- Problem: scan.js sent submissions.point_value_snapshot from the browser and
-- approve_submission() trusted it, so a student could insert a row from
-- devtools with "plastic = 9999 points/kg" and only an admin's eyeball on the
-- suggested points would catch it. The same insert could also pre-fill the
-- review fields (points_awarded, reviewed_by, reviewed_at, comment).
--
-- Fix: a BEFORE INSERT trigger that ignores whatever the browser sent and
-- copies the category's current price itself, and blanks the review fields.
-- Nothing else changes — approve_submission() still reads the snapshot, so
-- an admin's later price edit doesn't change rows already submitted.

create or replace function public.set_submission_price_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select wc.point_value into new.point_value_snapshot
  from public.waste_categories wc
  where wc.id = new.waste_category_id;

  new.points_awarded := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.comment := null;
  return new;
end;
$$;

drop trigger if exists set_submission_price_snapshot on public.submissions;
create trigger set_submission_price_snapshot
  before insert on public.submissions
  for each row
  execute function public.set_submission_price_snapshot();

-- Informational only — pending rows whose snapshot doesn't match today's
-- price. A row here isn't proof of cheating (an admin may have changed the
-- price since it was sent), but an absurd price is worth a look before
-- approving. Expected: few or no rows.
select s.id, s.created_at, wc.name, s.point_value_snapshot, wc.point_value as current_price
from public.submissions s
join public.waste_categories wc on wc.id = s.waste_category_id
where s.status = 'pending'
  and s.point_value_snapshot is distinct from wc.point_value
order by s.created_at;
