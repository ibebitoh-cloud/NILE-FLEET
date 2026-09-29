-- Secure the destructive system wipe behind a database-side administrator check.
create or replace function public.admin_total_system_wipe()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required';
  end if;

  delete from public.payment_allocations;
  delete from public.operations;
  delete from public.invoices;
  delete from public.payments;
  delete from public.procurement;
  delete from public.gas_transactions;
  delete from public.payroll_transactions;
  delete from public.food_expenses;
  delete from public.transport_expenses;
  delete from public.port_rents;
  delete from public.reservations;
  delete from public.customer_prices;
  delete from public.system_notifications;
  delete from public.profiles where role = 'CUSTOMER';
  update public.gensets set status = 'IN STOCK';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_total_system_wipe() from public, anon;
grant execute on function public.admin_total_system_wipe() to authenticated;