-- Complete Manager financial access.
drop policy if exists "payments access" on public.payments;
create policy "payments access" on public.payments for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER') or customer_id=auth.uid());

drop policy if exists "payment allocations staff write" on public.payment_allocations;
create policy "payment allocations staff write" on public.payment_allocations for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));