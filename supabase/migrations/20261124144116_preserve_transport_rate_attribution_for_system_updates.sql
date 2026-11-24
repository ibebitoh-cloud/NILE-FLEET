CREATE OR REPLACE FUNCTION public.transport_rates_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NOT NULL THEN
    NEW.updated_at := now();
    NEW.updated_by := v_actor;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Service/migration updates should preserve existing or explicitly supplied
    -- attribution instead of replacing it with NULL.
    NEW.updated_at := COALESCE(NEW.updated_at, OLD.updated_at, now());
    NEW.updated_by := COALESCE(NEW.updated_by, OLD.updated_by);
  ELSE
    NEW.updated_at := COALESCE(NEW.updated_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

-- Restore the original source attribution and last-known update timestamp from
-- the same verified backup used for the price recovery.
UPDATE public.transport_rates c
SET updated_at = b.updated_at,
    updated_by = b.updated_by
FROM private.transport_rates_backup_20261110 b
WHERE c.id = b.id;

INSERT INTO public.audit_log ("user", action, details)
VALUES (
  'SYSTEM',
  'TRANSPORT_RATES_ATTRIBUTION_RESTORED',
  'Restored original updated_by and updated_at provenance for all 5,029 transport rate rows from the verified 2026-11-10 backup.'
);
