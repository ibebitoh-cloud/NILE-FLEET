create table if not exists public.dali_terminology (
  id uuid primary key default gen_random_uuid(),
  canonical_value text not null,
  canonical_type text not null,
  alias text not null,
  normalized_alias text not null,
  language text not null default 'mixed',
  alias_type text not null default 'manual',
  context text[] not null default '{}',
  confidence numeric(4,3) not null default 0.98 check (confidence >= 0 and confidence <= 1),
  usage_count integer not null default 0,
  source text not null default 'manual_training',
  status text not null default 'pending' check (status in ('approved','pending','rejected')),
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_value, canonical_type, normalized_alias)
);
create index if not exists idx_dali_terminology_normalized on public.dali_terminology(normalized_alias);
create index if not exists idx_dali_terminology_canonical on public.dali_terminology(canonical_value, canonical_type);
create index if not exists idx_dali_terminology_status on public.dali_terminology(status);
alter table public.dali_terminology enable row level security;
create table if not exists public.dali_term_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  input_text text not null,
  correct_intent text,
  correct_entity text,
  previous_match jsonb not null default '{}',
  confidence numeric(4,3) not null default 1.0,
  created_at timestamptz not null default now()
);
alter table public.dali_term_corrections enable row level security;