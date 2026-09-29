-- Add final destination to logistics operations.
-- Run this once in Supabase SQL Editor.
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS destination text;