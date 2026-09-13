-- Server-side filtering, paging and totals.
--
-- Until now the app fetched every invoice, payment and expense on load, and did
-- it again after every single write. That is fine for a first year and becomes
-- unusable after a few thousand records on a phone.
--
-- The catch: every figure on Overview, and the ledger's running balance, was
-- computed by reducing over the complete in-memory set. Paginating without
-- moving those to SQL would silently turn them into "totals of page one", which
-- for a book of record is worse than being slow. So the aggregates move too.
--
-- All four functions derive the owner from auth.uid() and filter on it, so they
-- honour the same isolation as the row-level policies.
--
-- Safe to run more than once.

begin;

-- Supporting indexes for the new filters ---------------------------------------
create index if not exists invoices_owner_number_idx on public.invoices(owner_id, number);
create index if not exists expenses_owner_date_idx on public.expenses(owner_id, date desc);
create index if not exists expenses_owner_category_idx on public.expenses(owner_id, category);
create index if not exists payments_owner_date_idx on public.payments(owner_id, date);

-- 1. Invoices ------------------------------------------------------------------
-- Status is derived, not stored, so it is computed here exactly as the client
-- did: void, then paid, then overdue, then partial, then unpaid.
create or replace function public.list_invoices(payload jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select
    i.*,
    coalesce((select sum(p.amount) from public.payments p
              where p.invoice_id = i.id and p.owner_id = i.owner_id), 0) as settled
  from public.invoices i
  where i.owner_id = (select auth.uid())
),
typed as (
  select
    b.*,
    round(b.total - b.settled, 2) as balance_due,
    case
      when b.voided then 'Void'
      when b.total - b.settled <= 0 then 'Paid'
      when b.due_date < public.opervia_today() then 'Overdue'
      when b.settled > 0 then 'Partial'
      else 'Unpaid'
    end as derived_status
  from base b
),
filtered as (
  select * from typed t
  where
    (coalesce(payload->>'status', 'All') = 'All'
      or t.derived_status = payload->>'status')
    and (payload->>'customer_id' is null
      or t.customer_id = (payload->>'customer_id')::uuid)
    and (payload->>'from' is null or t.date >= (payload->>'from')::date)
    and (payload->>'to' is null or t.date <= (payload->>'to')::date)
    and (coalesce(payload->>'search', '') = ''
      or t.number ilike '%' || (payload->>'search') || '%'
      or t.customer->>'name' ilike '%' || (payload->>'search') || '%')
)
select jsonb_build_object(
  'total', (select count(*) from filtered),
  'rows', coalesce((
    select jsonb_agg(to_jsonb(f) - 'owner_id' order by f.date desc, f.number desc)
    from (
      select * from filtered
      order by date desc, number desc
      limit least(greatest(coalesce((payload->>'limit')::int, 25), 1), 200)
      offset greatest(coalesce((payload->>'offset')::int, 0), 0)
    ) f
  ), '[]'::jsonb)
);
$$;

-- 2. Expenses ------------------------------------------------------------------
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
      or e.description ilike '%' || (payload->>'search') || '%')
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

-- 3. Ledger --------------------------------------------------------------------
-- The running balance is a window function over the WHOLE filtered set, then the
-- page is cut from the result. Computing it per page would restart the balance
-- at zero on page two, which is the classic way to get this wrong.
create or replace function public.list_ledger(payload jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with uid as (select auth.uid() as id),
scope as (select nullif(payload->>'customer_id', '')::uuid as customer_id),
entries as (
  -- What was owed before Opervia.
  select
    'opening-' || o.customer_id::text as id,
    o.date,
    'Opening balance' as label,
    coalesce(c.name, 'Customer')
      || ' · ' || coalesce(nullif(o.note, ''), 'owed before Opervia') as detail,
    -- Not "rank": that is an ordered-set aggregate, and Postgres then demands
    -- WITHIN GROUP wherever the bare name appears in an ORDER BY.
    'Opening' as type, 0 as sort_rank,
    o.amount as debit, 0::numeric as credit
  from public.opening_balances o
  join public.customers c on c.id = o.customer_id and c.owner_id = o.owner_id
  where o.owner_id = (select id from uid)
    and ((select customer_id from scope) is null
      or o.customer_id = (select customer_id from scope))
  union all
  -- Invoices raised. Voided ones are excluded from the ledger entirely.
  select
    i.id::text, i.date, i.number, i.customer->>'name',
    'Invoice', 1, i.total, 0::numeric
  from public.invoices i
  where i.owner_id = (select id from uid) and not i.voided
    and ((select customer_id from scope) is null
      or i.customer_id = (select customer_id from scope))
  union all
  -- Payments against an invoice.
  select
    p.id::text, p.date, 'Payment received',
    i.number || ' · ' || p.method, 'Payment', 2, 0::numeric, p.amount
  from public.payments p
  join public.invoices i on i.id = p.invoice_id and i.owner_id = p.owner_id
  where p.owner_id = (select id from uid) and not i.voided
    and ((select customer_id from scope) is null
      or i.customer_id = (select customer_id from scope))
  union all
  -- Payments against an opening balance carry a customer, not an invoice.
  select
    p.id::text, p.date, 'Payment received',
    'Opening balance · ' || p.method, 'Payment', 2, 0::numeric, p.amount
  from public.payments p
  where p.owner_id = (select id from uid) and p.invoice_id is null
    and p.customer_id is not null
    and ((select customer_id from scope) is null
      or p.customer_id = (select customer_id from scope))
),
ranged as (
  select * from entries e
  where (payload->>'from' is null or e.date >= (payload->>'from')::date)
    and (payload->>'to' is null or e.date <= (payload->>'to')::date)
),
running as (
  select r.*,
    round(sum(r.debit - r.credit)
      over (order by r.date, r.sort_rank, r.id
            rows between unbounded preceding and current row), 2) as balance
  from ranged r
)
select jsonb_build_object(
  'total', (select count(*) from running),
  'closing', coalesce((
    select balance from running order by date desc, sort_rank desc, id desc limit 1
  ), 0),
  'rows', coalesce((
    -- sort_rank is carried through the page so the aggregate can order by it,
    -- then dropped from each row: it is an implementation detail, not data.
    select jsonb_agg(to_jsonb(f) - 'sort_rank' order by f.date, f.sort_rank, f.id)
    from (
      select id, date, label, detail, type, sort_rank, debit, credit, balance
      from running
      order by date, sort_rank, id
      limit least(greatest(coalesce((payload->>'limit')::int, 50), 1), 500)
      offset greatest(coalesce((payload->>'offset')::int, 0), 0)
    ) f
  ), '[]'::jsonb)
);
$$;

-- 4. Workspace summary ----------------------------------------------------------
-- Every headline figure, computed over the whole workspace regardless of paging.
create or replace function public.workspace_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with uid as (select auth.uid() as id),
live as (
  select i.id, i.total, i.due_date,
    coalesce((select sum(p.amount) from public.payments p
              where p.invoice_id = i.id and p.owner_id = i.owner_id), 0) as settled
  from public.invoices i
  where i.owner_id = (select id from uid) and not i.voided
),
opening as (
  select o.customer_id, o.amount,
    coalesce((select sum(p.amount) from public.payments p
              where p.customer_id = o.customer_id and p.owner_id = o.owner_id
                and p.invoice_id is null), 0) as settled
  from public.opening_balances o
  where o.owner_id = (select id from uid)
)
select jsonb_build_object(
  'invoiceOutstanding',
    coalesce((select round(sum(greatest(total - settled, 0)), 2) from live), 0),
  'openingOutstanding',
    coalesce((select round(sum(greatest(amount - settled, 0)), 2) from opening), 0),
  'unpaidCount',
    (select count(*) from live where total - settled > 0),
  'invoiceCount',
    (select count(*) from public.invoices where owner_id = (select id from uid) and not voided),
  'overdueCount',
    (select count(*) from live where total - settled > 0 and due_date < public.opervia_today()),
  'overdueAmount',
    coalesce((select round(sum(total - settled), 2) from live
              where total - settled > 0 and due_date < public.opervia_today()), 0),
  'received',
    coalesce((select round(sum(amount), 2) from public.payments
              where owner_id = (select id from uid)), 0),
  'expenses',
    coalesce((select round(sum(amount), 2) from public.expenses
              where owner_id = (select id from uid)), 0),
  'expenseCount',
    (select count(*) from public.expenses where owner_id = (select id from uid)),
  'customerCount',
    (select count(*) from public.customers where owner_id = (select id from uid))
);
$$;

revoke all on function
  public.list_invoices(jsonb), public.list_expenses(jsonb),
  public.list_ledger(jsonb), public.workspace_summary()
  from public, anon, authenticated;
grant execute on function
  public.list_invoices(jsonb), public.list_expenses(jsonb),
  public.list_ledger(jsonb), public.workspace_summary()
  to authenticated;

commit;

-- 5. Per-customer outstanding ---------------------------------------------------
-- The Customers page shows what each customer owes. Loading every invoice to
-- work that out is exactly what this migration exists to stop, so it is summed
-- in SQL and returned as one small object keyed by customer id.
create or replace function public.customer_balances()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with uid as (select auth.uid() as id),
per_invoice as (
  select i.customer_id,
    sum(i.total - coalesce((select sum(p.amount) from public.payments p
                            where p.invoice_id = i.id and p.owner_id = i.owner_id), 0)) as owed
  from public.invoices i
  where i.owner_id = (select id from uid) and not i.voided
  group by i.customer_id
),
per_opening as (
  select o.customer_id,
    o.amount - coalesce((select sum(p.amount) from public.payments p
                         where p.customer_id = o.customer_id and p.owner_id = o.owner_id
                           and p.invoice_id is null), 0) as owed
  from public.opening_balances o
  where o.owner_id = (select id from uid)
),
combined as (
  select customer_id, owed from per_invoice
  union all
  select customer_id, greatest(owed, 0) from per_opening
)
select coalesce(
  jsonb_object_agg(customer_id::text, round(total_owed, 2)),
  '{}'::jsonb
)
from (
  select customer_id, sum(owed) as total_owed
  from combined group by customer_id
) totals;
$$;

revoke all on function public.customer_balances() from public, anon, authenticated;
grant execute on function public.customer_balances() to authenticated;
