-- Consolidate overlapping permissive RLS policies without changing intended role access.
-- Applied to production on 2026-10-01.

-- customer_prices
drop policy if exists "customer_prices customer read own" on public.customer_prices;
drop policy if exists "customer_prices staff write" on public.customer_prices;
create policy "customer_prices read access" on public.customer_prices for select to authenticated using (
  private.is_admin() or
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role) or
  customer_name=(select p.company_name from public.profiles p where p.id=(select auth.uid()) and p.role='CUSTOMER'::user_role and coalesce(p.revoked,false)=false)
);
create policy "customer_prices staff insert" on public.customer_prices for insert to authenticated with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "customer_prices staff update" on public.customer_prices for update to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
) with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "customer_prices staff delete" on public.customer_prices for delete to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);

-- faqs
drop policy if exists "admin write faqs" on public.faqs;
drop policy if exists "all staff faqs" on public.faqs;
create policy "faqs read access" on public.faqs for select to authenticated using ((select auth.uid()) is not null);
create policy "admin insert faqs" on public.faqs for insert to authenticated with check (private.is_admin());
create policy "admin update faqs" on public.faqs for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin delete faqs" on public.faqs for delete to authenticated using (private.is_admin());

-- gensets
drop policy if exists "gensets viewer read" on public.gensets;
drop policy if exists "staff full access gensets" on public.gensets;
create policy "gensets read access" on public.gensets for select to authenticated using (
  private.is_admin() or
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role,'VIEWER'::user_role))
);
create policy "gensets staff insert" on public.gensets for insert to authenticated with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);
create policy "gensets staff update" on public.gensets for update to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
) with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);
create policy "gensets staff delete" on public.gensets for delete to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);

-- invoices
drop policy if exists "invoices access" on public.invoices;
drop policy if exists "invoices staff write" on public.invoices;
create policy "invoices read access" on public.invoices for select to authenticated using (
  private.is_admin() or customer_id=(select auth.uid()) or
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "invoices staff insert" on public.invoices for insert to authenticated with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "invoices staff update" on public.invoices for update to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
) with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "invoices staff delete" on public.invoices for delete to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);

-- operations
drop policy if exists "customer operations read own" on public.operations;
drop policy if exists "operations staff access" on public.operations;
drop policy if exists "operations viewer read" on public.operations;
create policy "operations read access" on public.operations for select to authenticated using (
  customer_id=(select auth.uid()) or private.is_admin() or
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role,'VIEWER'::user_role))
);
create policy "operations staff insert" on public.operations for insert to authenticated with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);
create policy "operations staff update" on public.operations for update to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
) with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);
create policy "operations staff delete" on public.operations for delete to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'GATE_OPERATOR'::user_role))
);

-- payment_allocations
drop policy if exists "payment allocations read" on public.payment_allocations;
drop policy if exists "payment allocations staff write" on public.payment_allocations;
create policy "payment allocations read access" on public.payment_allocations for select to authenticated using (
  private.is_admin() or
  exists (select 1 from public.payments p where p.id=payment_allocations.payment_id and p.customer_id=(select auth.uid())) or
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "payment allocations staff insert" on public.payment_allocations for insert to authenticated with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "payment allocations staff update" on public.payment_allocations for update to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
) with check (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);
create policy "payment allocations staff delete" on public.payment_allocations for delete to authenticated using (
  private.is_admin() or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.revoked=false and p.role='MANAGER'::user_role)
);

-- ports_info
drop policy if exists "admin write ports_info" on public.ports_info;
drop policy if exists "all staff ports_info" on public.ports_info;
create policy "ports_info read access" on public.ports_info for select to authenticated using ((select auth.uid()) is not null);
create policy "admin insert ports_info" on public.ports_info for insert to authenticated with check (private.is_admin());
create policy "admin update ports_info" on public.ports_info for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin delete ports_info" on public.ports_info for delete to authenticated using (private.is_admin());

-- profiles
drop policy if exists "admin profile management" on public.profiles;
drop policy if exists "admin roster read" on public.profiles;
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "profiles read access" on public.profiles for select to authenticated using (private.is_admin_or_manager() or id=(select auth.uid()));
create policy "profiles update access" on public.profiles for update to authenticated using (private.is_admin_or_manager() or id=(select auth.uid())) with check (private.is_admin_or_manager() or id=(select auth.uid()));

-- support_contacts
drop policy if exists "admin write support_contacts" on public.support_contacts;
drop policy if exists "all staff support_contacts" on public.support_contacts;
create policy "support_contacts read access" on public.support_contacts for select to authenticated using ((select auth.uid()) is not null);
create policy "admin insert support_contacts" on public.support_contacts for insert to authenticated with check (private.is_admin());
create policy "admin update support_contacts" on public.support_contacts for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin delete support_contacts" on public.support_contacts for delete to authenticated using (private.is_admin());

-- system_notifications
drop policy if exists "notifications admin write" on public.system_notifications;
drop policy if exists "notifications read" on public.system_notifications;
create policy "notifications read access" on public.system_notifications for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN'::user_role,'MANAGER'::user_role,'VIEWER'::user_role,'GATE_OPERATOR'::user_role) and coalesce(p.revoked,false)=false)
  or (target_user_id is null and target_org_name is null)
  or target_user_id=(select auth.uid())
  or target_org_name=(select p.company_name from public.profiles p where p.id=(select auth.uid()) and p.role='CUSTOMER'::user_role and coalesce(p.revoked,false)=false)
);
create policy "notifications admin insert" on public.system_notifications for insert to authenticated with check (private.is_admin());
create policy "notifications admin update" on public.system_notifications for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "notifications admin delete" on public.system_notifications for delete to authenticated using (private.is_admin());
