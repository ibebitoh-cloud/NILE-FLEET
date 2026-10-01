-- Keep the operational data tables available to Supabase Realtime.
-- This lets the web app synchronize changes made by another tab/device/user.
alter publication supabase_realtime add table public.operations, public.invoices, public.reservations, public.gensets;
