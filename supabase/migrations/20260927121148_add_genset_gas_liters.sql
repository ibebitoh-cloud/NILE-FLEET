-- Existing gensets receive the baseline amount of 50 liters; future rows
-- use the same default unless a different amount is supplied.
alter table public.gensets
  add column if not exists gas_liters numeric not null default 50;

notify pgrst, 'reload schema';
