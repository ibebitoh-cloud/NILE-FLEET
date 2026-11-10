-- Transport fuel (diesel) tracking: fuel-card transactions uploaded from the
-- card provider's "Fuel Transactions" Excel export, plus shared settings
-- (targets and margins). Same access model as transport_rates:
-- any Transport role reads, only Transport ADMIN writes.

create table if not exists public.transport_fuel_tx (
  id text primary key,                -- card transaction number ("#")
  at text not null,                   -- local date-time "YYYY-MM-DDTHH:mm" as printed on the report
  plate text not null,
  data jsonb not null,                -- the full parsed row
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists transport_fuel_tx_plate_at_idx on public.transport_fuel_tx (plate, at);

alter table public.transport_fuel_tx enable row level security;

drop policy if exists "transport fuel read" on public.transport_fuel_tx;
create policy "transport fuel read" on public.transport_fuel_tx for select to authenticated
using (private.transport_role() is not null);

drop policy if exists "transport fuel admin insert" on public.transport_fuel_tx;
create policy "transport fuel admin insert" on public.transport_fuel_tx for insert to authenticated
with check (private.transport_role() = 'ADMIN');

drop policy if exists "transport fuel admin update" on public.transport_fuel_tx;
create policy "transport fuel admin update" on public.transport_fuel_tx for update to authenticated
using (private.transport_role() = 'ADMIN') with check (private.transport_role() = 'ADMIN');

drop policy if exists "transport fuel admin delete" on public.transport_fuel_tx;
create policy "transport fuel admin delete" on public.transport_fuel_tx for delete to authenticated
using (private.transport_role() = 'ADMIN');

create table if not exists public.transport_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid()
);

alter table public.transport_settings enable row level security;

drop policy if exists "transport settings read" on public.transport_settings;
create policy "transport settings read" on public.transport_settings for select to authenticated
using (private.transport_role() is not null);

drop policy if exists "transport settings admin write" on public.transport_settings;
create policy "transport settings admin write" on public.transport_settings for insert to authenticated
with check (private.transport_role() = 'ADMIN');

drop policy if exists "transport settings admin update" on public.transport_settings;
create policy "transport settings admin update" on public.transport_settings for update to authenticated
using (private.transport_role() = 'ADMIN') with check (private.transport_role() = 'ADMIN');

grant select, insert, update, delete on public.transport_fuel_tx to authenticated;
grant select, insert, update on public.transport_settings to authenticated;
