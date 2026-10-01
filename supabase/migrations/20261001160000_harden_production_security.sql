-- Nile Fleet production hardening.
-- Safe to re-run: index creation is idempotent and policy/function changes are guarded.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'::public.user_role
      and coalesce(revoked, false) = false
  );
$$;

drop policy if exists "Users can insert own DALI conversations" on public.dali_conversations;
drop policy if exists "Users can read own DALI conversations" on public.dali_conversations;

create index if not exists idx_customer_prices_customer_id
  on public.customer_prices(customer_id);

create index if not exists idx_operations_reservation_id
  on public.operations(reservation_id);

create index if not exists idx_payroll_transactions_employee_id
  on public.payroll_transactions(employee_id);

-- The destructive wipe is callable by the server-side system-wipe Edge Function,
-- not directly by browser-authenticated users.
revoke all on function public.admin_total_system_wipe() from public, anon, authenticated;
grant execute on function public.admin_total_system_wipe() to service_role;

-- Supabase recommends init-plan-safe auth predicates in RLS.
do $$
declare
  r record;
  new_qual text;
  new_check text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    if r.qual is not null then
      new_qual := replace(r.qual, 'auth.uid()', '(select auth.uid())');
      if new_qual <> r.qual then
        execute format(
          'alter policy %I on %I.%I using (%s)',
          r.policyname, r.schemaname, r.tablename, new_qual
        );
      end if;
    end if;

    if r.with_check is not null then
      new_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
      if new_check <> r.with_check then
        execute format(
          'alter policy %I on %I.%I with check (%s)',
          r.policyname, r.schemaname, r.tablename, new_check
        );
      end if;
    end if;
  end loop;
end
$$;
