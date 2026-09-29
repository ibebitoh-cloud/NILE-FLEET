-- Track the current fuel amount for each genset.
-- Existing units start at 50 liters; new units default to 50 liters.
ALTER TABLE public.gensets
  ADD COLUMN IF NOT EXISTS gas_liters numeric NOT NULL DEFAULT 50;

-- Keep the profile fields required by the secure account-creation endpoint
-- available even when older database migrations have not yet been applied.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS joined_date date,
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS phone_number text;
