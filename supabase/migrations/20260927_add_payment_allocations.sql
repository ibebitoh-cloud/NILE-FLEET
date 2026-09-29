-- Keep invoice face values immutable and store each payment allocation separately.
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id
ON public.payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id
ON public.payment_allocations(payment_id);
