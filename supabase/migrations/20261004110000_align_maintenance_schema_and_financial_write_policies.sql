-- Align live maintenance schema and financial/HR write access with the application.
ALTER TABLE public.genset_maintenance_logs
ADD COLUMN IF NOT EXISTS completed_date date;

COMMENT ON COLUMN public.genset_maintenance_logs.completed_date IS 'Date maintenance work was completed; used for duration reporting';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='employees' AND policyname='admin manager write employees') THEN
    CREATE POLICY "admin manager write employees" ON public.employees
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payroll_transactions' AND policyname='admin manager write payroll_transactions') THEN
    CREATE POLICY "admin manager write payroll_transactions" ON public.payroll_transactions
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='food_expenses' AND policyname='admin manager write food_expenses') THEN
    CREATE POLICY "admin manager write food_expenses" ON public.food_expenses
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gas_transactions' AND policyname='admin manager write gas_transactions') THEN
    CREATE POLICY "admin manager write gas_transactions" ON public.gas_transactions
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='port_rents' AND policyname='admin manager write port_rents') THEN
    CREATE POLICY "admin manager write port_rents" ON public.port_rents
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transport_expenses' AND policyname='admin manager write transport_expenses') THEN
    CREATE POLICY "admin manager write transport_expenses" ON public.transport_expenses
      FOR ALL TO authenticated
      USING (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role))
      WITH CHECK (private.is_admin() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id=(SELECT auth.uid()) AND profiles.revoked=false AND profiles.role='MANAGER'::user_role));
  END IF;
END $$;