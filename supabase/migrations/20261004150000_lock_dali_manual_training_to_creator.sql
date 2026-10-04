begin;

-- Keep the production database change reproducible in the repository.
update public.dali_knowledge
set created_by = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'
where created_by is null;

update public.dali_terminology
set created_by = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'
where created_by is null;

update public.dali_customer_aliases
set created_by = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'
where created_by is null;

drop policy if exists "dali knowledge staff read" on public.dali_knowledge;
drop policy if exists "dali knowledge managers write" on public.dali_knowledge;
drop policy if exists "dali knowledge managers update" on public.dali_knowledge;
drop policy if exists "dali knowledge authenticated read" on public.dali_knowledge;
drop policy if exists "dali knowledge creator insert" on public.dali_knowledge;
drop policy if exists "dali knowledge creator update" on public.dali_knowledge;
drop policy if exists "dali knowledge creator delete" on public.dali_knowledge;

create policy "dali knowledge authenticated read" on public.dali_knowledge
for select to authenticated using (active = true);

create policy "dali knowledge creator insert" on public.dali_knowledge
for insert to authenticated
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali knowledge creator update" on public.dali_knowledge
for update to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()))
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali knowledge creator delete" on public.dali_knowledge
for delete to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

drop policy if exists "dali terminology admin write" on public.dali_terminology;
drop policy if exists "dali terminology authenticated read" on public.dali_terminology;
drop policy if exists "dali terminology creator insert" on public.dali_terminology;
drop policy if exists "dali terminology creator update" on public.dali_terminology;
drop policy if exists "dali terminology creator delete" on public.dali_terminology;

create policy "dali terminology authenticated read" on public.dali_terminology
for select to authenticated using (status = 'approved');

create policy "dali terminology creator insert" on public.dali_terminology
for insert to authenticated
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali terminology creator update" on public.dali_terminology
for update to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()))
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali terminology creator delete" on public.dali_terminology
for delete to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

drop policy if exists "dali customer aliases staff read" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases admin manager insert" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases admin manager update" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases admin manager delete" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases authenticated read" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases creator insert" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases creator update" on public.dali_customer_aliases;
drop policy if exists "dali customer aliases creator delete" on public.dali_customer_aliases;

create policy "dali customer aliases authenticated read" on public.dali_customer_aliases
for select to authenticated using (active = true);

create policy "dali customer aliases creator insert" on public.dali_customer_aliases
for insert to authenticated
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali customer aliases creator update" on public.dali_customer_aliases
for update to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()))
with check ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

create policy "dali customer aliases creator delete" on public.dali_customer_aliases
for delete to authenticated
using ((select auth.uid()) = '0eb0739a-8b59-4d3a-83bc-39972ee1d6b5'::uuid and created_by = (select auth.uid()));

commit;