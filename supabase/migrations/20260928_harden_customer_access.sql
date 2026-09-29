-- Customer access hardening: least privilege + server-side ownership enforcement.
create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and old.role not in ('ADMIN', 'MANAGER') then
    new.role := old.role;
    new.revoked := old.revoked;
    new.allowed_screens := old.allowed_screens;
    new.permissions := old.permissions;
    new.assigned_ports := old.assigned_ports;
    new.company_name := old.company_name;
    new.company_name_ar := old.company_name_ar;
    new.past_outstanding_amount := old.past_outstanding_amount;
    new.is_eta_verified := old.is_eta_verified;
    new.mfa_enabled := old.mfa_enabled;
    new.taxpayer_id := old.taxpayer_id;
    new.invoice_settings := old.invoice_settings;
    new.wipe_password := old.wipe_password;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_identity_fields() from public, anon, authenticated;
drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields before update on public.profiles for each row execute function public.protect_profile_identity_fields();

drop policy if exists "customer operations read own" on public.operations;
create policy "customer operations read own" on public.operations for select to authenticated
using (customer_id = (select auth.uid()));

drop policy if exists "customer_prices customer read own" on public.customer_prices;
create policy "customer_prices customer read own" on public.customer_prices for select to authenticated
using (customer_name = (select p.company_name from public.profiles p where p.id = (select auth.uid()) and p.role = 'CUSTOMER' and coalesce(p.revoked,false)=false));

drop policy if exists "notifications read" on public.system_notifications;
create policy "notifications read" on public.system_notifications for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN','MANAGER','VIEWER','GATE_OPERATOR') and coalesce(p.revoked,false)=false)
  or (target_user_id is null and target_org_name is null)
  or target_user_id = (select auth.uid())
  or target_org_name = (select p.company_name from public.profiles p where p.id=(select auth.uid()) and p.role='CUSTOMER' and coalesce(p.revoked,false)=false)
);

create index if not exists idx_operations_customer_id on public.operations(customer_id);
create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_payments_customer_id on public.payments(customer_id);
create index if not exists idx_reservations_customer_id on public.reservations(customer_id);
create index if not exists idx_notifications_target_user on public.system_notifications(target_user_id);
create index if not exists idx_notifications_target_org on public.system_notifications(target_org_name);