-- A business logo for the printed invoice.
--
-- The logo is stored inline on the business profile (details is jsonb, so no
-- schema change is needed). Two things have to be true for that to be safe:
--
--   1. create_invoice snapshots the whole profile onto every invoice. Left
--      alone, the image would be copied into every invoice row and the database
--      would grow by the size of the logo per invoice. The snapshot now drops
--      the logo; the app renders the current one on the sheet instead, so the
--      text details stay historical while the image does not repeat.
--   2. The stored image must stay small, or it travels on every page load.
--
-- Safe to run more than once.

begin;

-- 1. Keep images out of the per-invoice snapshot --------------------------------
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
 -- The logo is branding, not a financial fact: never snapshot the image.
 profile := profile - 'logo';
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

revoke all on function public.create_invoice(jsonb) from public, anon, authenticated;
grant execute on function public.create_invoice(jsonb) to authenticated;

-- 2. Cap the stored image ------------------------------------------------------
-- ~90 KB of base64. The app resizes before upload; this is the backstop.
alter table public.business_profiles drop constraint if exists business_profiles_logo_size;
alter table public.business_profiles
  add constraint business_profiles_logo_size
  check (length(coalesce(details->>'logo', '')) <= 100000);

-- 3. Drop any logo already copied into existing invoices ------------------------
update public.invoices set business = business - 'logo'
where business ? 'logo';

commit;
