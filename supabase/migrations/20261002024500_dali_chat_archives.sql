alter table public.dali_conversations add column if not exists archived boolean not null default false;
alter table public.dali_conversations add column if not exists archived_at timestamptz;
create index if not exists idx_dali_conversations_user_session_archived on public.dali_conversations(user_id, session_id, archived, created_at desc);
