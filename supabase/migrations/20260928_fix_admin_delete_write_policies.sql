-- Restore admin write operations that the UI already exposes.
-- Without these policies, Supabase RLS can make UPDATE/DELETE affect zero rows
-- without returning an error, so deleted records can reappear after refresh.

drop policy if exists "payments staff update" on public.payments;
create policy "payments staff update"
on public.payments
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "payments staff delete" on public.payments;
create policy "payments staff delete"
on public.payments
for delete
to authenticated
using (private.is_admin());

drop policy if exists "audit log admin delete" on public.audit_log;
create policy "audit log admin delete"
on public.audit_log
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin reservation delete" on public.reservations;
create policy "admin reservation delete"
on public.reservations
for delete
to authenticated
using (private.is_admin());

drop policy if exists "admin customer profile delete" on public.profiles;
create policy "admin customer profile delete"
on public.profiles
for delete
to authenticated
using (private.is_admin());
