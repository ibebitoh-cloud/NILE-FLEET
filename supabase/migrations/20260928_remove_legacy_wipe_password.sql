-- Remove the retired plaintext emergency wipe-code field.
-- Total system wipe is now authorized exclusively by the admin-only RPC.
alter table public.profiles drop column if exists wipe_password;
