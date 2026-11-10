-- protect_profile_authorization_fields() still exists in production and still
-- compares profiles.wipe_password, a column dropped in
-- 20260928_remove_legacy_wipe_password.sql. Every profile UPDATE by a caller who
-- is not an admin or manager therefore failed with 42703 (column does not exist).
-- Keep every other check exactly as it was; only the stale column reference goes.

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
stable
set search_path to ''
as $function$
begin
  if (select private.is_admin_or_manager()) then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.revoked is distinct from old.revoked
     or new.mfa_enabled is distinct from old.mfa_enabled
     or new.permissions is distinct from old.permissions
     or new.assigned_ports is distinct from old.assigned_ports
     or new.taxpayer_id is distinct from old.taxpayer_id
     or new.is_eta_verified is distinct from old.is_eta_verified
     or new.past_outstanding_amount is distinct from old.past_outstanding_amount
     or new.invoice_settings is distinct from old.invoice_settings
     or new.signature_url is distinct from old.signature_url
     or new.email is distinct from old.email
  then
    raise exception 'Protected profile fields can only be changed by an administrator or manager'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;
