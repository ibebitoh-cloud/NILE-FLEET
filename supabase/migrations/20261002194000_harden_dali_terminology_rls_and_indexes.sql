-- Nile Fleet reliability hardening: DALI terminology RLS + FK indexes
alter function public.touch_dali_terminology_updated_at() set search_path = public;

drop policy if exists "dali terminology authenticated read" on public.dali_terminology;
drop policy if exists "dali terminology admin write" on public.dali_terminology;
create policy "dali terminology authenticated read" on public.dali_terminology
  for select to authenticated using (true);
create policy "dali terminology admin write" on public.dali_terminology
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN'::user_role,'MANAGER'::user_role])))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = any (array['ADMIN'::user_role,'MANAGER'::user_role])));

drop policy if exists "dali corrections owner insert" on public.dali_term_corrections;
drop policy if exists "dali corrections owner read" on public.dali_term_corrections;
create policy "dali corrections owner insert" on public.dali_term_corrections
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "dali corrections owner read" on public.dali_term_corrections
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = any (array['ADMIN'::user_role,'MANAGER'::user_role])
    )
  );

create index if not exists idx_dali_customer_aliases_created_by on public.dali_customer_aliases(created_by);
create index if not exists idx_dali_term_corrections_user_id on public.dali_term_corrections(user_id);
create index if not exists idx_dali_terminology_created_by on public.dali_terminology(created_by);
