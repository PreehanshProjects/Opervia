-- Opening balances: what a customer already owed before Opervia existed.
--
-- Without this, a business moving off a paper book starts with a ledger that is
-- simply wrong, and the only workaround is inventing back-dated invoices that
-- consume real invoice numbers and print as though Opervia issued them.
--
-- One dated entry per customer. It is not an invoice: it consumes no number,
-- cannot be printed, and must never be sent to a customer who already holds the
-- paper invoice it represents.
--
-- Money received against an opening balance is a real payment and is recorded as
-- one, so "Payments received" and the cash figures stay correct. That requires
-- payments to be able to point at a customer instead of an invoice.
--
-- Safe to run more than once.

begin;

-- 1. The opening balance ------------------------------------------------------
create table if not exists public.opening_balances (
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null,
  date date not null,
  amount numeric not null check (amount > 0 and amount <= 100000000 and amount = round(amount, 2)),
  note text not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (owner_id, customer_id),
  unique (customer_id, owner_id),
  foreign key (customer_id, owner_id) references public.customers(id, owner_id) on delete cascade
);

alter table public.opening_balances enable row level security;

drop policy if exists own_opening_balances on public.opening_balances;
create policy own_opening_balances on public.opening_balances
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.opening_balances to authenticated;

-- The opening date may not be in the future, in Mauritius time.
alter table public.opening_balances drop constraint if exists opening_balances_date_check;
alter table public.opening_balances
  add constraint opening_balances_date_check check (date <= public.opervia_today());

-- 2. Payments may settle an opening balance -----------------------------------
-- Existing rows all carry an invoice_id, so this widening is safe.
alter table public.payments alter column invoice_id drop not null;
alter table public.payments add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_customer_fkey'
  ) then
    alter table public.payments
      add constraint payments_customer_fkey
      foreign key (customer_id, owner_id) references public.customers(id, owner_id);
  end if;
end $$;

-- A payment settles exactly one thing: an invoice, or a customer's opening balance.
alter table public.payments drop constraint if exists payments_one_target;
alter table public.payments
  add constraint payments_one_target
  check ((invoice_id is null) <> (customer_id is null));

create index if not exists payments_customer_idx on public.payments(customer_id, owner_id);

-- 3. record_payment accepts either target -------------------------------------
create or replace function public.record_payment(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid:=auth.uid(); inv public.invoices; amount_paid numeric; new_amount numeric:=(payload->>'amount')::numeric;
 pay_id uuid:=(payload->>'id')::uuid; pay_date date:=(payload->>'date')::date;
 cust_id uuid:=(payload->>'customer_id')::uuid; opening public.opening_balances;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if pay_id is null then raise exception 'Payment ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(pay_id::text,0));
 if exists(select 1 from public.payments where id=pay_id and owner_id=uid) then return pay_id; end if;
 if new_amount is null or new_amount<=0 or new_amount<>round(new_amount,2) then raise exception 'Enter a valid payment amount'; end if;

 -- Settling an opening balance: no invoice is involved.
 if cust_id is not null then
  select * into opening from public.opening_balances where customer_id=cust_id and owner_id=uid for update;
  if not found then raise exception 'This customer has no opening balance'; end if;
  select coalesce(sum(amount),0) into amount_paid from public.payments where customer_id=cust_id and owner_id=uid;
  if new_amount > opening.amount - amount_paid then raise exception 'Payment exceeds the opening balance still owed'; end if;
  if pay_date is null or pay_date<opening.date or pay_date>public.opervia_today() then raise exception 'Payment date must be between the opening date and today'; end if;
  insert into public.payments(id,owner_id,invoice_id,customer_id,date,amount,method,reference)
  values(pay_id,uid,null,cust_id,pay_date,new_amount,payload->>'method',coalesce(payload->>'reference',''));
  return pay_id;
 end if;

 -- Settling an invoice: unchanged behaviour.
 select * into inv from public.invoices where id=(payload->>'invoice_id')::uuid and owner_id=uid for update;
 if not found or inv.voided then raise exception 'Active invoice not found'; end if;
 select coalesce(sum(amount),0) into amount_paid from public.payments where invoice_id=inv.id and owner_id=uid;
 if new_amount>inv.total-amount_paid then raise exception 'Payment exceeds balance or has an invalid amount'; end if;
 if pay_date is null or pay_date<inv.date or pay_date>public.opervia_today() then raise exception 'Payment date must be between invoice date and today'; end if;
 insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
 values(pay_id,uid,inv.id,pay_date,new_amount,payload->>'method',coalesce(payload->>'reference',''));
 return pay_id;
end;
$$;

revoke all on function public.record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.record_payment(jsonb) to authenticated;

-- 4. An opening balance cannot drop below what has been settled ---------------
create or replace function public.save_opening_balance(payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid:=auth.uid(); cust_id uuid:=(payload->>'customer_id')::uuid;
 new_amount numeric:=(payload->>'amount')::numeric; new_date date:=(payload->>'date')::date;
 settled numeric;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.customers where id=cust_id and owner_id=uid) then raise exception 'Customer not found'; end if;
 select coalesce(sum(amount),0) into settled from public.payments where customer_id=cust_id and owner_id=uid;

 -- Clearing it: only allowed while nothing has been settled against it.
 if new_amount is null or new_amount=0 then
  if settled>0 then raise exception 'Payments have been recorded against this opening balance, so it cannot be removed'; end if;
  delete from public.opening_balances where customer_id=cust_id and owner_id=uid;
  return;
 end if;

 if new_amount<0 or new_amount>100000000 or new_amount<>round(new_amount,2) then raise exception 'Enter a valid opening amount'; end if;
 if new_date is null or new_date>public.opervia_today() then raise exception 'The opening date cannot be in the future'; end if;
 if new_amount<settled then raise exception 'The opening balance cannot be less than the payments already recorded against it'; end if;

 insert into public.opening_balances(owner_id,customer_id,date,amount,note)
 values(uid,cust_id,new_date,new_amount,coalesce(payload->>'note',''))
 on conflict (owner_id,customer_id) do update
   set date=excluded.date, amount=excluded.amount, note=excluded.note;
end;
$$;

revoke all on function public.save_opening_balance(jsonb) from public, anon, authenticated;
grant execute on function public.save_opening_balance(jsonb) to authenticated;

commit;
