-- Fixes a timezone bug that made Opervia unusable in the early hours.
--
-- The app computes "today" from the device clock (Mauritius, UTC+4), while
-- Postgres `current_date` on Supabase is UTC. Between 00:00 and 04:00 local
-- time the two disagree by a day, so a record dated today was rejected as being
-- "in the future". It broke three things:
--
--   1. Recording an expense  -> expenses_date_check (23514)
--   2. Creating an invoice with a deposit
--   3. Recording a payment
--
-- Opervia is a Mauritian product, so the database should reckon the date in
-- Mauritius. This introduces one function that owns that definition and points
-- all three checks at it. Safe to run more than once.

begin;

-- The single source of truth for "today" in this database.
create or replace function public.opervia_today() returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Indian/Mauritius')::date $$;

revoke all on function public.opervia_today() from public, anon;
grant execute on function public.opervia_today() to authenticated;

-- 1. Expenses -----------------------------------------------------------------
alter table public.expenses drop constraint if exists expenses_date_check;
alter table public.expenses
  add constraint expenses_date_check check (date <= public.opervia_today());

-- 2. Invoice creation ---------------------------------------------------------
-- Unchanged except for the deposit date check near the end.
create or replace function public.create_invoice(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); inv_id uuid := (payload->>'id')::uuid;
 cust public.customers; profile jsonb; entry jsonb;
 qty numeric; price numeric; rate numeric; sub numeric := 0; tax_amount numeric; grand numeric;
 deposit numeric; inv_date date; due date;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if inv_id is null then raise exception 'Invoice ID required'; end if;
 -- A client-generated UUID makes network retries idempotent.
 perform pg_advisory_xact_lock(hashtextextended(inv_id::text,0));
 if exists(select 1 from public.invoices where id=inv_id and owner_id=uid) then return inv_id; end if;
 select * into cust from public.customers where id=(payload->>'customer_id')::uuid and owner_id=uid;
 if not found then raise exception 'Customer not found'; end if;
 select details into profile from public.business_profiles where owner_id=uid;
 if profile is null or coalesce(trim(profile->>'name'),'')='' then raise exception 'Save your business details in Settings first'; end if;
 inv_date := (payload->>'date')::date; due := (payload->>'due_date')::date;
 if inv_date is null or due is null or due<inv_date then raise exception 'Invalid invoice dates'; end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Invoice items required'; end if;
 if jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Use between 1 and 100 items'; end if;
 for entry in select value from jsonb_array_elements(payload->'items') loop
  if coalesce(length(trim(entry->>'description')),0) not between 1 and 500 then raise exception 'Item description required (maximum 500 characters)'; end if;
  if coalesce(length(entry->>'unit'),0) not between 1 and 20 or coalesce(length(entry->>'section'),0)>100 then raise exception 'Invalid unit or section'; end if;
  qty:=(entry->>'quantity')::numeric;price:=(entry->>'price')::numeric;
  if qty is null or qty<=0 or qty>1000000 or qty<>round(qty,3) or price is null or price<0 or price>100000000 or price<>round(price,2) then raise exception 'Invalid quantity or price'; end if;
  sub:=sub+round(qty*price,2);
 end loop;
 rate:=(payload->>'tax_rate')::numeric;deposit:=(payload->>'deposit')::numeric;
 if rate is null or rate<0 or rate>100 or rate<>round(rate,2) then raise exception 'Invalid tax rate'; end if;
 tax_amount:=round(sub*rate/100,2);grand:=sub+tax_amount;
 if grand>10000000000 then raise exception 'Invoice total exceeds MUR 10 billion'; end if;
 if deposit is null or deposit<0 or deposit>grand or deposit<>round(deposit,2) then raise exception 'Invalid deposit'; end if;
 -- Mauritius time, not UTC: see public.opervia_today().
 if deposit>0 and inv_date>public.opervia_today() then raise exception 'A payment cannot be recorded in the future'; end if;
 insert into public.invoices(id,owner_id,number,customer_id,customer,business,date,due_date,items,notes,tax_rate,subtotal,tax,total)
 values(inv_id,uid,'OP-'||nextval('public.invoice_number_seq'),cust.id,to_jsonb(cust)-'owner_id',profile,inv_date,due,payload->'items',coalesce(payload->>'notes',''),rate,sub,tax_amount,grand);
 if deposit>0 then
  insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
  values(gen_random_uuid(),uid,inv_id,inv_date,deposit,payload->>'method','Initial deposit');
 end if;
 return inv_id;
end;
$$;

-- 3. Payments -----------------------------------------------------------------
-- Unchanged except for the payment date check.
create or replace function public.record_payment(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid:=auth.uid(); inv public.invoices; amount_paid numeric; new_amount numeric:=(payload->>'amount')::numeric;
 pay_id uuid:=(payload->>'id')::uuid; pay_date date:=(payload->>'date')::date;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if pay_id is null then raise exception 'Payment ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(pay_id::text,0));
 if exists(select 1 from public.payments where id=pay_id and owner_id=uid) then return pay_id; end if;
 select * into inv from public.invoices where id=(payload->>'invoice_id')::uuid and owner_id=uid for update;
 if not found or inv.voided then raise exception 'Active invoice not found'; end if;
 select coalesce(sum(amount),0) into amount_paid from public.payments where invoice_id=inv.id and owner_id=uid;
 if new_amount is null or new_amount<=0 or new_amount<>round(new_amount,2) or new_amount>inv.total-amount_paid then raise exception 'Payment exceeds balance or has an invalid amount'; end if;
 -- Mauritius time, not UTC: see public.opervia_today().
 if pay_date is null or pay_date<inv.date or pay_date>public.opervia_today() then raise exception 'Payment date must be between invoice date and today'; end if;
 insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
 values(pay_id,uid,inv.id,pay_date,new_amount,payload->>'method',coalesce(payload->>'reference',''));
 return pay_id;
end;
$$;

revoke all on function public.create_invoice(jsonb), public.record_payment(jsonb) from public, anon, authenticated;
grant execute on function public.create_invoice(jsonb), public.record_payment(jsonb) to authenticated;

commit;
