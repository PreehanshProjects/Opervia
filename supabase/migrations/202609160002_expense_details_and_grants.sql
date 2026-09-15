-- Opervia: the table privileges that were never issued, and a second line on an
-- expense. Run once in the Supabase SQL Editor.
begin;

-- 1. The missing grants -------------------------------------------------------
-- Row-level security decides *which* rows an account may touch; the table GRANT
-- decides whether it may touch them at all. Both policies here are already FOR
-- ALL, but the grants stopped at what the app needed on day one, so two things
-- the interface openly offers could never succeed:
--
--   * Deleting a customer needs DELETE on customers, which was never granted.
--   * Saving an expense goes through PostgREST upsert, which is INSERT ... ON
--     CONFLICT DO UPDATE — and Postgres requires the UPDATE privilege for that
--     even when the row is new. So *recording* an expense failed, not just
--     correcting one.
--
-- Both surfaced as "permission denied" (42501), which the app reports as "This
-- record belongs to another account", because that is the usual cause. Here it
-- was not: the rows were the owner's all along.
grant delete on public.customers to authenticated;
grant update, delete on public.expenses to authenticated;

-- 2. The second line on an expense -------------------------------------------
-- "Delivery fuel" is the entry; "Vacoas run, two drops, receipt in the folder"
-- is what makes it findable in six months. The first line stays required and
-- stays the label everywhere; this one is optional and purely for the owner.
alter table public.expenses
  add column if not exists note text not null default ''
  constraint expenses_note_length check (length(note) <= 1000);

-- 3. Search both lines --------------------------------------------------------
-- A detail worth typing is a detail worth searching for. Otherwise identical to
-- the previous definition.
create or replace function public.list_expenses(payload jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with filtered as (
  select e.* from public.expenses e
  where e.owner_id = (select auth.uid())
    and (coalesce(payload->>'category', 'All') = 'All'
      or e.category = payload->>'category')
    and (payload->>'from' is null or e.date >= (payload->>'from')::date)
    and (payload->>'to' is null or e.date <= (payload->>'to')::date)
    and (coalesce(payload->>'search', '') = ''
      or e.description ilike '%' || (payload->>'search') || '%'
      or e.note ilike '%' || (payload->>'search') || '%')
)
select jsonb_build_object(
  'total', (select count(*) from filtered),
  'sum', (select coalesce(round(sum(amount), 2), 0) from filtered),
  'rows', coalesce((
    select jsonb_agg(to_jsonb(f) - 'owner_id' order by f.date desc, f.id desc)
    from (
      select * from filtered
      order by date desc, id desc
      limit least(greatest(coalesce((payload->>'limit')::int, 25), 1), 200)
      offset greatest(coalesce((payload->>'offset')::int, 0), 0)
    ) f
  ), '[]'::jsonb)
);
$$;
revoke all on function public.list_expenses(jsonb) from public, anon, authenticated;
grant execute on function public.list_expenses(jsonb) to authenticated;
commit;
