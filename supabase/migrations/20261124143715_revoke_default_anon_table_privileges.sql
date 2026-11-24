-- Migrations run as postgres; new public tables/sequences should not
-- inherit anonymous privileges by default.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
