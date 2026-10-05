ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS manual_scct_clip_off boolean NOT NULL DEFAULT false;
