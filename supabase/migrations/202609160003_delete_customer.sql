-- Opervia: deleting a customer, decided by the database rather than by whatever
-- the browser happens to be holding. Run once in the Supabase SQL Editor.
--
-- The rule has not changed: a customer who is part of the financial record stays
-- on it. What changed is who checks. The app checked against data.invoices,
-- which loadReference deliberately leaves empty — transactions are paged per
-- view — so on a real account the count was always zero. Delete was therefore
-- offered for every customer, including ones with a shelf of invoices, and the
-- only thing standing in the way was a foreign key telling the owner that
-- "something this record depends on is missing".
--
-- The three things that pin a customer, each with its own sentence, because
-- "cannot delete" without a reason is not an answer.
begin;

create or replace function public.delete_customer(customer_uuid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); invoices bigint; owed numeric; settled bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.customers where id=customer_uuid and owner_id=uid) then
  raise exception 'Customer not found';
 end if;

 select count(*) into invoices from public.invoices
  where customer_id=customer_uuid and owner_id=uid;
 if invoices > 0 then
  raise exception 'This customer has % invoice(s), so their details stay on record.', invoices;
 end if;

 select amount into owed from public.opening_balances
  where customer_id=customer_uuid and owner_id=uid;
 if owed is not null then
  raise exception 'This customer has an opening balance. Clear it first, then they can be deleted.';
 end if;

 select count(*) into settled from public.payments
  where customer_id=customer_uuid and owner_id=uid;
 if settled > 0 then
  raise exception 'This customer has payments on record, so their details stay on record.';
 end if;

 delete from public.customers where id=customer_uuid and owner_id=uid;
end;
$$;

revoke all on function public.delete_customer(uuid) from public, anon, authenticated;
grant execute on function public.delete_customer(uuid) to authenticated;
commit;
