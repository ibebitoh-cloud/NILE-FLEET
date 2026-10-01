create table if not exists public.dali_customer_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  alias_type text not null default 'manual',
  source text not null default 'DALI Customer Dictionary',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dali_customer_aliases_alias_not_blank check (length(trim(alias)) >= 2),
  constraint dali_customer_aliases_type_check check (alias_type in ('arabic','nickname','typo','manual')),
  constraint dali_customer_aliases_unique unique (customer_id, normalized_alias)
);

create index if not exists idx_dali_customer_aliases_customer
  on public.dali_customer_aliases(customer_id) where active = true;
create index if not exists idx_dali_customer_aliases_normalized
  on public.dali_customer_aliases(normalized_alias) where active = true;

create or replace function public.normalize_dali_customer_alias_input(value text)
returns text language sql immutable set search_path = public as $$
  select trim(regexp_replace(
    lower(replace(replace(replace(replace(replace(coalesce(value,''),'أ','ا'),'إ','ا'),'آ','ا'),'ٱ','ا'),'ة','ه')),
    '[^[:alnum:][:alpha:]ء-ي]+', ' ', 'g'
  ));
$$;

create or replace function public.set_dali_customer_alias_normalized()
returns trigger language plpgsql set search_path = public as $$
begin
  new.alias := trim(new.alias);
  new.normalized_alias := public.normalize_dali_customer_alias_input(new.alias);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_dali_customer_alias_normalized on public.dali_customer_aliases;
create trigger set_dali_customer_alias_normalized
before insert or update of alias on public.dali_customer_aliases
for each row execute function public.set_dali_customer_alias_normalized();

alter table public.dali_customer_aliases enable row level security;

drop policy if exists "dali customer aliases staff read" on public.dali_customer_aliases;
create policy "dali customer aliases staff read"
on public.dali_customer_aliases for select to authenticated
using (
  active = true and (
    private.is_admin_or_manager()
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('VIEWER','GATE_OPERATOR')
        and coalesce(p.revoked,false) = false
    )
    or customer_id = (select auth.uid())
  )
);

drop policy if exists "dali customer aliases admin manager insert" on public.dali_customer_aliases;
create policy "dali customer aliases admin manager insert"
on public.dali_customer_aliases for insert to authenticated
with check (private.is_admin_or_manager() and created_by = (select auth.uid()));

drop policy if exists "dali customer aliases admin manager update" on public.dali_customer_aliases;
create policy "dali customer aliases admin manager update"
on public.dali_customer_aliases for update to authenticated
using (private.is_admin_or_manager())
with check (private.is_admin_or_manager());

drop policy if exists "dali customer aliases admin manager delete" on public.dali_customer_aliases;
create policy "dali customer aliases admin manager delete"
on public.dali_customer_aliases for delete to authenticated
using (private.is_admin_or_manager());

grant select, insert, update, delete on public.dali_customer_aliases to authenticated;
comment on table public.dali_customer_aliases is 'Structured Arabic/alias dictionary for reliable DALI customer entity resolution.';
