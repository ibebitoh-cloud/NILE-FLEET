-- Store per-invoice payment distribution and keep access aligned with payments.
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_allocations_invoice_id
  on public.payment_allocations(invoice_id);
create index if not exists idx_payment_allocations_payment_id
  on public.payment_allocations(payment_id);

alter table public.payment_allocations enable row level security;
revoke all on table public.payment_allocations from anon;
grant select, insert, update, delete on table public.payment_allocations to authenticated;

drop policy if exists "payment allocations read" on public.payment_allocations;
create policy "payment allocations read"
on public.payment_allocations
for select
to authenticated
using (
  private.is_admin()
  or exists (
    select 1
    from public.payments p
    where p.id = payment_id
      and p.customer_id = (select auth.uid())
  )
);

drop policy if exists "payment allocations staff write" on public.payment_allocations;
create policy "payment allocations staff write"
on public.payment_allocations
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

notify pgrst, 'reload schema';
