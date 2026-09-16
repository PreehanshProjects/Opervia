-- Opervia: the cash book. Run once in the Supabase SQL Editor.
--
-- The Ledger has always answered one question — "who owes me what" — and
-- answered it well. It could not answer the other one the owner actually asks:
-- "where did my money go". Expenses were deliberately kept out of it, because
-- they are bought in bulk (a crate of vegetables, a tray of cakes) and sold on
-- to whoever buys them, so they belong to no customer and cannot sit in a
-- receivables balance without making that balance a lie.
--
-- So list_ledger now serves two readings of the same book, chosen by 'mode':
--
--   'account' (the default, and byte-for-byte the previous behaviour) — opening
--     balances and invoices as debits, payments as credits, balance = owed.
--
--   'cash' — only money that actually moved: payments received as credits,
--     expenses as debits, balance = net cash movement. Invoices are absent
--     because an unpaid invoice is not cash, and the customer filter does not
--     apply because the debits belong to no customer. Net cash movement is not
--     profit and must never be labelled as such.
begin;

create or replace function public.list_ledger(payload jsonb default '{}'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with uid as (select auth.uid() as id),
cfg as (
  select
    case when payload->>'mode' = 'cash' then 'cash' else 'account' end as mode,
    -- A cash book narrowed to one customer would keep the credits and silently
    -- drop every debit, so the scope is dropped instead.
    case when payload->>'mode' = 'cash' then null
         else nullif(payload->>'customer_id', '')::uuid end as customer_id
),
entries as (
  -- What was owed before Opervia. Account ledger only.
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
    and (select mode from cfg) = 'account'
    and ((select customer_id from cfg) is null
      or o.customer_id = (select customer_id from cfg))
  union all
  -- Invoices raised. Voided ones are excluded from the ledger entirely, and an
  -- unpaid invoice is not cash, so this is the account ledger only.
  select
    i.id::text, i.date, i.number, i.customer->>'name',
    'Invoice', 1, i.total, 0::numeric
  from public.invoices i
  where i.owner_id = (select id from uid) and not i.voided
    and (select mode from cfg) = 'account'
    and ((select customer_id from cfg) is null
      or i.customer_id = (select customer_id from cfg))
  union all
  -- Payments against an invoice. Money in, so both readings want them.
  select
    p.id::text, p.date, 'Payment received',
    i.number || ' · ' || p.method, 'Payment', 2, 0::numeric, p.amount
  from public.payments p
  join public.invoices i on i.id = p.invoice_id and i.owner_id = p.owner_id
  where p.owner_id = (select id from uid) and not i.voided
    and ((select customer_id from cfg) is null
      or i.customer_id = (select customer_id from cfg))
  union all
  -- Payments against an opening balance carry a customer, not an invoice.
  select
    p.id::text, p.date, 'Payment received',
    'Opening balance · ' || p.method, 'Payment', 2, 0::numeric, p.amount
  from public.payments p
  where p.owner_id = (select id from uid) and p.invoice_id is null
    and p.customer_id is not null
    and ((select customer_id from cfg) is null
      or p.customer_id = (select customer_id from cfg))
  union all
  -- Money out. The category is the entry; the description is the second line,
  -- matching how an expense reads on the Expenses page.
  select
    e.id::text, e.date, e.category,
    case when e.note = '' then e.description else e.description || ' · ' || e.note end,
    'Expense', 3, e.amount, 0::numeric
  from public.expenses e
  where e.owner_id = (select id from uid)
    and (select mode from cfg) = 'cash'
),
ranged as (
  select * from entries e
  where (payload->>'from' is null or e.date >= (payload->>'from')::date)
    and (payload->>'to' is null or e.date <= (payload->>'to')::date)
),
running as (
  select r.*,
    -- The columns mean the same thing in both modes; the balance does not. A
    -- debit is money owed to you in the account ledger, and money gone in the
    -- cash book, so the sign flips.
    round(sum(case when (select mode from cfg) = 'cash'
                   then r.credit - r.debit
                   else r.debit - r.credit end)
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

revoke all on function public.list_ledger(jsonb) from public, anon, authenticated;
grant execute on function public.list_ledger(jsonb) to authenticated;

-- The cash book reads every expense in the period, which the owner-only index
-- cannot help with once a few years have accumulated.
create index if not exists expenses_owner_date_idx
  on public.expenses(owner_id, date);

commit;
