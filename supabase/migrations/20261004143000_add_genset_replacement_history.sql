-- Persistent genset replacement history.
create table if not exists public.genset_replacements (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  original_genset_number text not null,
  original_port text not null,
  replacement_genset_number text not null,
  replacement_source_port text not null,
  reason text not null check (reason in ('BREAKDOWN','DAMAGED','OTHER')),
  replaced_at timestamptz not null default now(),
  replaced_by text,
  notes text
);

create index if not exists genset_replacements_operation_id_idx on public.genset_replacements(operation_id);
create index if not exists genset_replacements_original_genset_idx on public.genset_replacements(original_genset_number);
create index if not exists genset_replacements_replacement_genset_idx on public.genset_replacements(replacement_genset_number);

alter table public.genset_replacements enable row level security;
grant select, insert, update, delete on public.genset_replacements to authenticated;
revoke all on table public.genset_replacements from anon;

drop policy if exists "authenticated read genset replacements" on public.genset_replacements;
create policy "authenticated read genset replacements" on public.genset_replacements
for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.revoked = false
  )
);

drop policy if exists "admin manager write genset replacements" on public.genset_replacements;
create policy "admin manager write genset replacements" on public.genset_replacements
for all to authenticated
using (
  private.is_admin()
  or exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.revoked = false
      and profiles.role = 'MANAGER'::user_role
  )
)
with check (
  private.is_admin()
  or exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.revoked = false
      and profiles.role = 'MANAGER'::user_role
  )
);