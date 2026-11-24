-- Nile Fleet uses Supabase Auth and PostgREST; the repository has no GraphQL client.
drop extension if exists pg_graphql;

-- There are no anon RLS policies in public, so anonymous table access is not
-- part of the app's intended access model.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
