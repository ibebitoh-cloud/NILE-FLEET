-- Manager needs the same maintenance-log access exposed by the Stock screen.
drop policy if exists "maintenance logs staff" on public.genset_maintenance_logs;
create policy "maintenance logs staff" on public.genset_maintenance_logs for all to authenticated
using (private.is_admin() or exists (
  select 1 from public.profiles
  where id = auth.uid() and revoked = false
    and role in ('ADMIN','MANAGER','GATE_OPERATOR')
))
with check (private.is_admin() or exists (
  select 1 from public.profiles
  where id = auth.uid() and revoked = false
    and role in ('ADMIN','MANAGER','GATE_OPERATOR')
));
