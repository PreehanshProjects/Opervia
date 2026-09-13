-- Opervia v1: one private workspace per authenticated account.
-- Run once in Supabase SQL Editor. All financial writes are validated in PostgreSQL.
begin;
create table public.business_profiles (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 details jsonb not null check (jsonb_typeof(details) = 'object' and coalesce(length(trim(details->>'name')),0) between 1 and 500)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200),
 address text not null default '' check(length(address)<=500),
 phone text not null default '' check(length(phone)<=200),
 email text not null default '' check(length(email)<=200),
 brn text not null default '' check(length(brn)<=200),
 unique(id,owner_id)
);
create sequence public.invoice_number_seq start 1001;
create table public.invoices (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 number text not null unique,
 customer_id uuid not null,
 customer jsonb not null,
 business jsonb not null,
 date date not null,
 due_date date not null check(due_date >= date),
 items jsonb not null check(jsonb_typeof(items)='array'),
 notes text not null default '' check(length(notes)<=2000),
 tax_rate numeric not null check(tax_rate between 0 and 100),
 subtotal numeric not null check(subtotal >= 0),
 tax numeric not null check(tax >= 0),
 total numeric not null check(total = subtotal + tax),
 voided boolean not null default false,
 created_at timestamptz not null default now(),
 unique(id,owner_id),
 foreign key(customer_id,owner_id) references public.customers(id,owner_id)
);
create table public.payments (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 invoice_id uuid not null,
 date date not null,
 amount numeric not null check(amount>0 and amount=round(amount,2)),
 method text not null check(method in ('Cash','Bank transfer','Card','Cheque','Other')),
 reference text not null default '' check(length(reference)<=200),
 created_at timestamptz not null default now(),
 foreign key(invoice_id,owner_id) references public.invoices(id,owner_id)
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 date date not null check(date<=current_date),
 description text not null check(length(trim(description)) between 1 and 500),
 category text not null check(category in ('Supplies','Transport','Stock purchases','Rent','Utilities','Other')),
 amount numeric not null check(amount>0 and amount<=100000000 and amount=round(amount,2)),
 created_at timestamptz not null default now()
);
create index customers_owner_idx on public.customers(owner_id);
create index invoices_owner_date_idx on public.invoices(owner_id,date desc);
create index invoices_customer_idx on public.invoices(customer_id,owner_id);
create index payments_owner_idx on public.payments(owner_id);
create index payments_invoice_idx on public.payments(invoice_id,owner_id);
create index expenses_owner_idx on public.expenses(owner_id);

alter table public.business_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
revoke all on public.business_profiles,public.customers,public.invoices,public.payments,public.expenses from anon,authenticated;
revoke all on sequence public.invoice_number_seq from anon,authenticated;
grant select,insert,update on public.business_profiles,public.customers to authenticated;
grant select,insert on public.expenses to authenticated;
grant select on public.invoices,public.payments to authenticated;
create policy own_business on public.business_profiles to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy own_customers on public.customers to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy own_invoices on public.invoices for select to authenticated using(owner_id=(select auth.uid()));
create policy own_payments on public.payments for select to authenticated using(owner_id=(select auth.uid()));
create policy own_expenses on public.expenses to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

-- Definer functions are the only financial write path. Every operation derives
-- the owner from the verified JWT, uses a fixed search_path and locks invoices.
create function public.create_invoice(payload jsonb) returns uuid
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
 if deposit>0 and inv_date>current_date then raise exception 'A payment cannot be recorded in the future'; end if;
 insert into public.invoices(id,owner_id,number,customer_id,customer,business,date,due_date,items,notes,tax_rate,subtotal,tax,total)
 values(inv_id,uid,'OP-'||nextval('public.invoice_number_seq'),cust.id,to_jsonb(cust)-'owner_id',profile,inv_date,due,payload->'items',coalesce(payload->>'notes',''),rate,sub,tax_amount,grand);
 if deposit>0 then
  insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
  values(gen_random_uuid(),uid,inv_id,inv_date,deposit,payload->>'method','Initial deposit');
 end if;
 return inv_id;
end;
$$;
create function public.record_payment(payload jsonb) returns uuid
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
 if pay_date is null or pay_date<inv.date or pay_date>current_date then raise exception 'Payment date must be between invoice date and today'; end if;
 insert into public.payments(id,owner_id,invoice_id,date,amount,method,reference)
 values(pay_id,uid,inv.id,pay_date,new_amount,payload->>'method',coalesce(payload->>'reference',''));
 return pay_id;
end;
$$;
create function public.void_invoice(invoice_uuid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); inv public.invoices;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into inv from public.invoices where id=invoice_uuid and owner_id=uid for update;
 if not found then raise exception 'Invoice not found'; end if;
 if exists(select 1 from public.payments where invoice_id=invoice_uuid) then raise exception 'An invoice with payments cannot be voided'; end if;
 update public.invoices set voided=true where id=invoice_uuid and owner_id=uid;
end;
$$;
revoke all on function public.create_invoice(jsonb),public.record_payment(jsonb),public.void_invoice(uuid) from public,anon,authenticated;
grant execute on function public.create_invoice(jsonb),public.record_payment(jsonb),public.void_invoice(uuid) to authenticated;
commit;
