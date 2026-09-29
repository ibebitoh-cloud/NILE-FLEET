-- Align Supabase RLS with the application role model.
-- VIEWER is read-only. MANAGER can manage operational/business screens.
-- GATE_OPERATOR retains field-operation write access.

drop policy if exists "operations staff access" on public.operations;
create policy "operations staff access" on public.operations for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('ADMIN','MANAGER','GATE_OPERATOR')))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('ADMIN','MANAGER','GATE_OPERATOR')));

drop policy if exists "operations viewer read" on public.operations;
create policy "operations viewer read" on public.operations for select to authenticated
using (exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='VIEWER'));

drop policy if exists "staff full access gensets" on public.gensets;
create policy "staff full access gensets" on public.gensets for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('ADMIN','MANAGER','GATE_OPERATOR')))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('ADMIN','MANAGER','GATE_OPERATOR')));

drop policy if exists "gensets viewer read" on public.gensets;
create policy "gensets viewer read" on public.gensets for select to authenticated
using (exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='VIEWER'));

drop policy if exists "customer_prices admin only" on public.customer_prices;
create policy "customer_prices staff write" on public.customer_prices for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));

drop policy if exists "invoices staff write" on public.invoices;
create policy "invoices staff write" on public.invoices for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));

drop policy if exists "payments staff write" on public.payments;
create policy "payments staff write" on public.payments for insert to authenticated
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));

drop policy if exists "payments staff update" on public.payments;
create policy "payments staff update" on public.payments for update to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));

drop policy if exists "payments staff delete" on public.payments;
create policy "payments staff delete" on public.payments for delete to authenticated using (private.is_admin());

drop policy if exists "procurement admin only" on public.procurement;
create policy "procurement staff write" on public.procurement for all to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'))
with check (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role='MANAGER'));

-- Tables not exposed as editable Manager screens remain readable to Manager/Viewer,
-- but Viewer no longer has accidental write access.
drop policy if exists "admin staff employees" on public.employees;
create policy "staff read employees" on public.employees for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));

drop policy if exists "admin staff payroll" on public.payroll_transactions;
create policy "staff read payroll" on public.payroll_transactions for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));

drop policy if exists "admin staff food" on public.food_expenses;
create policy "staff read food" on public.food_expenses for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));

drop policy if exists "admin staff transport" on public.transport_expenses;
create policy "staff read transport" on public.transport_expenses for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));

drop policy if exists "admin staff port_rents" on public.port_rents;
create policy "staff read port_rents" on public.port_rents for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));

drop policy if exists "admin staff gas" on public.gas_transactions;
create policy "staff read gas" on public.gas_transactions for select to authenticated
using (private.is_admin() or exists (select 1 from public.profiles where id=auth.uid() and revoked=false and role in ('MANAGER','VIEWER')));