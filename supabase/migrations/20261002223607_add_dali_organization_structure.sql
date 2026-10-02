create table if not exists public.organization_structure (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  employee_name text not null,
  employee_name_ar text,
  job_title text,
  job_title_ar text,
  department text,
  department_ar text,
  manager_id uuid references public.organization_structure(id) on delete set null,
  reports_to text,
  assigned_ports public.location_enum[] default '{}',
  responsibilities text[] default '{}',
  responsibilities_ar text[] default '{}',
  dali_access boolean not null default false,
  sentinel_access boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.organization_structure enable row level security;

create policy "organization_structure_admin_manager_select"
on public.organization_structure for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('ADMIN'::user_role, 'MANAGER'::user_role)
  )
);

create index if not exists organization_structure_manager_id_idx on public.organization_structure(manager_id);
create index if not exists organization_structure_department_idx on public.organization_structure(department);
create index if not exists organization_structure_user_id_idx on public.organization_structure(user_id);

insert into public.organization_structure
(employee_name, job_title, department, reports_to, dali_access, sentinel_access, active)
select 'Sherif Hegazy','CEO','Nile Fleet',null,true,true,true
where not exists (select 1 from public.organization_structure where employee_name='Sherif Hegazy');

insert into public.organization_structure
(employee_name, job_title, department, reports_to, dali_access, sentinel_access, active)
select 'Samar Hegazy','Transport Department Head','Transport','Sherif Hegazy',true,true,true
where not exists (select 1 from public.organization_structure where employee_name='Samar Hegazy');

insert into public.organization_structure
(employee_name, job_title, department, reports_to, dali_access, sentinel_access, active)
select 'Yasmine Hegazy','Genset Department Head','Genset Department','Sherif Hegazy',true,true,true
where not exists (select 1 from public.organization_structure where employee_name='Yasmine Hegazy');

update public.organization_structure child
set manager_id = parent.id
from public.organization_structure parent
where child.reports_to = parent.employee_name;
revoke all on table public.organization_structure from anon;
grant select on table public.organization_structure to authenticated;
