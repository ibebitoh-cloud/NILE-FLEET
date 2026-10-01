create table if not exists public.dali_knowledge (
  id uuid primary key default gen_random_uuid(), category text not null default 'company_rule',
  title text not null, content text not null, keywords text[] not null default '{}',
  applies_to text[] not null default '{}', source text, priority integer not null default 50,
  active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.dali_knowledge enable row level security;
create index if not exists idx_dali_knowledge_active_category on public.dali_knowledge(active, category);
create index if not exists idx_dali_knowledge_keywords on public.dali_knowledge using gin(keywords);
drop policy if exists "dali knowledge staff read" on public.dali_knowledge;
create policy "dali knowledge staff read" on public.dali_knowledge for select to authenticated using (
 active = true and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN','MANAGER','VIEWER','GATE_OPERATOR') and coalesce(p.revoked,false)=false)
);
drop policy if exists "dali knowledge managers write" on public.dali_knowledge;
create policy "dali knowledge managers write" on public.dali_knowledge for insert to authenticated with check (
 exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN','MANAGER') and coalesce(p.revoked,false)=false)
);
drop policy if exists "dali knowledge managers update" on public.dali_knowledge;
create policy "dali knowledge managers update" on public.dali_knowledge for update to authenticated using (
 exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN','MANAGER') and coalesce(p.revoked,false)=false)
) with check (
 exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('ADMIN','MANAGER') and coalesce(p.revoked,false)=false)
);
create or replace function public.set_dali_knowledge_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_dali_knowledge_updated_at on public.dali_knowledge;
create trigger trg_dali_knowledge_updated_at before update on public.dali_knowledge for each row execute function public.set_dali_knowledge_updated_at();