-- Opervia: correcting and removing invoices that no money has touched.
-- Run once in the Supabase SQL Editor, after 202609140004_server_queries.sql.
--
-- The record stays append-only where it matters. The moment a payment exists
-- against an invoice it can only be voided, exactly as before. Before that point
-- the document has settled nothing, so the owner may correct it or remove it
-- outright — the paper equivalent of tearing up a sheet you have not handed over.
--
-- A voided invoice never carries payments (void_invoice refuses one that does),
-- so "unpaid" and "voided" both reduce to the same single rule: no payments.
--
-- Deleting reclaims nothing. Invoice numbers come from a sequence and are never
-- reused, so a gap in the numbering is the visible trace of a removed invoice.
begin;

-- Re-issues an invoice from scratch, keeping its number, its id and the date it
-- was created. Validation is deliberately identical to create_invoice: the same
-- limits must hold whether a line was typed today or corrected tomorrow.
create or replace function public.update_invoice(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); inv_id uuid := (payload->>'id')::uuid; inv public.invoices;
 cust public.customers; profile jsonb; entry jsonb;
 qty numeric; price numeric; rate numeric; sub numeric := 0; tax_amount numeric; grand numeric;
 deposit numeric; inv_date date; due date;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if inv_id is null then raise exception 'Invoice ID required'; end if;
 select * into inv from public.invoices where id=inv_id and owner_id=uid for update;
 if not found then raise exception 'Invoice not found'; end if;
 if inv.voided then raise exception 'A voided invoice cannot be edited'; end if;
 if exists(select 1 from public.payments where invoice_id=inv_id and owner_id=uid) then
  raise exception 'An invoice with a payment against it cannot be edited';
 end if;
 select * into cust from public.customers where id=(payload->>'customer_id')::uuid and owner_id=uid;
 if not found then raise exception 'Customer not found'; end if;
 select details into profile from public.business_profiles where owner_id=uid;
 if profile is null or coalesce(trim(profile->>'name'),'')='' then raise exception 'Save your business details in Settings first'; end if;
 -- The logo is branding, not a financial fact: never snapshot the image.
 -- (Same reason as create_invoice — see 202609140003_business_logo.sql.)
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
 rate:=(payload->>'tax_rate')::numeric;deposit:=coalesce((payload->>'deposit')::numeric,0);
 if rate is null or rate<0 or rate>100 or rate<>round(rate,2) then raise exception 'Invalid tax rate'; end if;
 tax_amount:=round(sub*rate/100,2);grand:=sub+tax_amount;
 if grand>10000000000 then raise exception 'Invoice total exceeds MUR 10 billion'; end if;
 if deposit<0 or deposit>grand or deposit<>round(deposit,2) then raise exception 'Invalid deposit'; end if;
 -- Mauritius time, not UTC: see public.opervia_today().
 if deposit>0 and inv_date>public.opervia_today() then raise exception 'A payment cannot be recorded in the future'; end if;
 -- The customer and business snapshots are refreshed too: an edit re-issues the
 -- document, so it carries the details as they stand now rather than a stale copy
 -- of a name the owner has since corrected in Settings.
 update public.invoices set
   customer_id=cust.id, customer=to_jsonb(cust)-'owner_id', business=profile,
   date=inv_date, due_date=due, items=payload->'items',
   notes=coalesce(payload->>'notes',''), tax_rate=rate,
   subtotal=sub, tax=tax_amount, total=grand
  where id=inv_id and owner_id=uid;
 if deposit>0 then
  insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
  values(gen_random_uuid(),uid,inv_id,inv_date,deposit,payload->>'method','Initial deposit');
 end if;
 return inv_id;
end;
$$;

-- Removes an invoice outright. Only ever reachable for an invoice with no
-- payments, which is both the unpaid case and every voided one. The payments
-- foreign key would refuse the delete regardless; checking first turns a
-- constraint violation into a sentence the owner can act on.
create or replace function public.delete_invoice(invoice_uuid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); inv public.invoices;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into inv from public.invoices where id=invoice_uuid and owner_id=uid for update;
 if not found then raise exception 'Invoice not found'; end if;
 if exists(select 1 from public.payments where invoice_id=invoice_uuid and owner_id=uid) then
  raise exception 'An invoice with a payment against it cannot be deleted. Void it instead.';
 end if;
 delete from public.invoices where id=invoice_uuid and owner_id=uid;
end;
$$;

revoke all on function public.update_invoice(jsonb),public.delete_invoice(uuid) from public,anon,authenticated;
grant execute on function public.update_invoice(jsonb),public.delete_invoice(uuid) to authenticated;
commit;
