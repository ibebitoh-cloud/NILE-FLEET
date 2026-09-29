ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS joined_date date,
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_job_title ON public.profiles(job_title);
