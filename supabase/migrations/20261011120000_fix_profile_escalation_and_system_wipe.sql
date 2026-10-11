-- 1. Close MANAGER -> ADMIN privilege escalation through direct profile updates.
-- 2. Drop the reference to the removed profiles.wipe_password column, which broke
--    every self-service profile update by non-staff users.
-- 3. Make the service-role-only system wipe work: the Edge Function verifies the
--    caller and passes their id, because auth.uid() is null for service-role calls.

-- 4. Remove protect_profile_authorization_fields (exists only in production, not in
--    earlier migrations). It referenced the dropped wipe_password column and rejected
--    service-role updates, so create-user's profile upsert always failed and the new
--    account was rolled back. protect_profile_identity_fields below covers its checks.

-- create-user writes this column; ensure it exists before the trigger references it.
alter table public.profiles add column if not exists is_service_account boolean not null default false;

drop trigger if exists protect_profile_authorization_fields on public.profiles;
drop function if exists public.protect_profile_authorization_fields();

create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := (select auth.uid());
begin
  -- Server-side calls (service role, migrations, SQL editor) are trusted.
  if caller is null then
    return new;
  end if;

  if private.is_admin() then
    -- Admins may manage any account but cannot demote or revoke themselves,
    -- which could leave the system without an administrator.
    if old.id = caller then
      new.role := old.role;
      new.revoked := old.revoked;
    end if;
    return new;
  end if;

  if private.is_admin_or_manager() then
    if old.id = caller then
      -- Managers may edit their own details but not their role or status.
      new.role := old.role;
      new.revoked := old.revoked;
      new.allowed_screens := old.allowed_screens;
      new.permissions := old.permissions;
      new.is_service_account := old.is_service_account;
      return new;
    end if;

    if old.role in ('ADMIN', 'MANAGER') then
      raise exception 'Managers cannot modify administrator or manager accounts'
        using errcode = '42501';
    end if;

    if new.role not in ('CUSTOMER', 'VIEWER', 'GATE_OPERATOR') then
      raise exception 'Managers may only assign CUSTOMER, VIEWER, or GATE_OPERATOR roles'
        using errcode = '42501';
    end if;

    new.is_service_account := old.is_service_account;
    return new;
  end if;

  -- Everyone else can only reach their own row (RLS); lock privileged fields.
  new.role := old.role;
  new.revoked := old.revoked;
  new.email := old.email;
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
  new.signature_url := old.signature_url;
  new.is_service_account := old.is_service_account;
  return new;
end;
$$;

revoke all on function public.protect_profile_identity_fields() from public, anon, authenticated;
drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields
before update on public.profiles
for each row execute function public.protect_profile_identity_fields();

-- System wipe: service-role only, actor verified by id.
drop function if exists public.admin_total_system_wipe();

create or replace function public.admin_total_system_wipe(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_actor is null or not exists (
    select 1 from public.profiles
    where id = p_actor
      and role = 'ADMIN'::public.user_role
      and coalesce(revoked, false) = false
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
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
  -- Must match GensetStatus.IN_STOCK used by the app.
  update public.gensets set status = 'IN_STOCK';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_total_system_wipe(uuid) from public, anon, authenticated;
grant execute on function public.admin_total_system_wipe(uuid) to service_role;
