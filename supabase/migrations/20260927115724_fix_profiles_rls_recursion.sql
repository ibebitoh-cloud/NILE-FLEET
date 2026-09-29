-- Avoid recursive RLS evaluation: profile access checks use a private
-- SECURITY DEFINER helper instead of querying profiles from profiles policies.
create or replace function private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN'::public.user_role, 'MANAGER'::public.user_role)
      and coalesce(p.revoked, false) = false
  );
$$;

revoke all on function private.is_admin_or_manager() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin_or_manager() to authenticated;

drop policy if exists "admin roster read" on public.profiles;
create policy "admin roster read"
on public.profiles
for select
to authenticated
using (private.is_admin_or_manager());

drop policy if exists "admin profile management" on public.profiles;
create policy "admin profile management"
on public.profiles
for update
to authenticated
using (private.is_admin_or_manager())
with check (private.is_admin_or_manager());
