-- Allow ADMIN and MANAGER to operate the staff reservation queue.
-- Customers remain restricted to their own reservations.

drop policy if exists "reservations access" on public.reservations;
create policy "reservations access" on public.reservations
for select to authenticated
using (
  private.is_admin()
  or customer_id = (select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN','MANAGER','VIEWER','GATE_OPERATOR')
      and coalesce(p.revoked,false) = false
  )
);

drop policy if exists "reservations update" on public.reservations;
create policy "reservations update" on public.reservations
for update to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN','MANAGER')
      and coalesce(p.revoked,false) = false
  )
  or customer_id = (select auth.uid())
)
with check (
  private.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN','MANAGER')
      and coalesce(p.revoked,false) = false
  )
  or customer_id = (select auth.uid())
);

drop policy if exists "reservations write" on public.reservations;
create policy "reservations write" on public.reservations
for insert to authenticated
with check (
  private.is_admin()
  or customer_id = (select auth.uid())
);