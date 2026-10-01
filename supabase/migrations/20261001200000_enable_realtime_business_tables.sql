-- Keep the operational data tables available to Supabase Realtime.
-- Idempotent because production may already have these tables enabled manually.
do $$
declare
  t text;
begin
  foreach t in array array['operations','invoices','reservations','gensets'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
