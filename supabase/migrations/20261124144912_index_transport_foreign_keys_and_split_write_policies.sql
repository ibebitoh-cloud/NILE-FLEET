-- Add indexes for the three unindexed transport foreign keys.
CREATE INDEX IF NOT EXISTS idx_transport_fuel_tx_uploaded_by
  ON public.transport_fuel_tx (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_transport_rates_updated_by
  ON public.transport_rates (updated_by);
CREATE INDEX IF NOT EXISTS idx_transport_settings_updated_by
  ON public.transport_settings (updated_by);

-- The private recovery snapshot is production-only; add a primary key when it exists.
DO $$
BEGIN
  IF to_regclass('private.transport_rates_backup_20261110') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'transport_rates_backup_20261110_pkey'
         AND conrelid = 'private.transport_rates_backup_20261110'::regclass
     ) THEN
    ALTER TABLE private.transport_rates_backup_20261110
      ADD CONSTRAINT transport_rates_backup_20261110_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Split broad write policies into INSERT/UPDATE/DELETE policies. This preserves
-- the same admin/manager write permissions while leaving SELECT to the existing
-- read policy (which also permits VIEWER).
DO $$
DECLARE
  v_table text;
  v_write_policy text;
  v_predicate text := $policy$
    (private.is_admin() OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.revoked = false
        AND profiles.role = 'MANAGER'::public.user_role
    ))
  $policy$;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'employees',
    'food_expenses',
    'gas_transactions',
    'genset_replacements',
    'payroll_transactions',
    'port_rents',
    'transport_expenses'
  ] LOOP
    v_write_policy := CASE
      WHEN v_table = 'genset_replacements' THEN 'admin manager write genset replacements'
      ELSE 'admin manager write ' || v_table
    END;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_write_policy, v_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s',
      'admin manager insert ' || v_table, v_table, v_predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING %s WITH CHECK %s',
      'admin manager update ' || v_table, v_table, v_predicate, v_predicate
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING %s',
      'admin manager delete ' || v_table, v_table, v_predicate
    );
  END LOOP;
END $$;
