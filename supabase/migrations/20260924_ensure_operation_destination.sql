-- Ensure the Operations table supports the Master View / Add New Operation destination field.
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS destination text;

COMMENT ON COLUMN public.operations.destination IS 'Final destination for the operation / container movement';