-- Link every operation to its customer profile without changing existing operation data.
ALTER TABLE public.operations
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operations_customer_id
ON public.operations(customer_id);
