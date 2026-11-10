-- Transport FUEL role ("fuel editor"): works only in the Fuel tab.
--   * can read and change fuel transactions and the fuel settings
--   * can NOT read the price list (transport_rates) and has no DALI access
-- Requires 20261108140000_transport_fuel.sql to have run first.

alter table public.transport_users drop constraint if exists transport_users_role_check;
alter table public.transport_users
  add constraint transport_users_role_check check (role in ('ADMIN', 'VIEWER', 'FUEL'));

-- Prices: only ADMIN and VIEWER (previously any Transport role).
drop policy if exists "transport rates read" on public.transport_rates;
create policy "transport rates read"
on public.transport_rates for select to authenticated
using (private.transport_role() in ('ADMIN', 'VIEWER'));

-- Fuel transactions: ADMIN and FUEL write.
drop policy if exists "transport fuel admin insert" on public.transport_fuel_tx;
create policy "transport fuel admin insert" on public.transport_fuel_tx for insert to authenticated
with check (private.transport_role() in ('ADMIN', 'FUEL'));

drop policy if exists "transport fuel admin update" on public.transport_fuel_tx;
create policy "transport fuel admin update" on public.transport_fuel_tx for update to authenticated
using (private.transport_role() in ('ADMIN', 'FUEL')) with check (private.transport_role() in ('ADMIN', 'FUEL'));

drop policy if exists "transport fuel admin delete" on public.transport_fuel_tx;
create policy "transport fuel admin delete" on public.transport_fuel_tx for delete to authenticated
using (private.transport_role() in ('ADMIN', 'FUEL'));

-- Settings: FUEL may only write the 'fuel' settings row.
drop policy if exists "transport settings admin write" on public.transport_settings;
create policy "transport settings admin write" on public.transport_settings for insert to authenticated
with check (private.transport_role() = 'ADMIN' or (private.transport_role() = 'FUEL' and key = 'fuel'));

drop policy if exists "transport settings admin update" on public.transport_settings;
create policy "transport settings admin update" on public.transport_settings for update to authenticated
using (private.transport_role() = 'ADMIN' or (private.transport_role() = 'FUEL' and key = 'fuel'))
with check (private.transport_role() = 'ADMIN' or (private.transport_role() = 'FUEL' and key = 'fuel'));
