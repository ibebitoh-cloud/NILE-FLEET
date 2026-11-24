DO $$
DECLARE
  v_updated integer;
BEGIN
  IF (SELECT count(*) FROM public.transport_rates) <> 5029
     OR (SELECT count(*) FROM private.transport_rates_backup_20261110) <> 5029 THEN
    RAISE EXCEPTION 'Rate restore stopped: expected exactly 5029 live and backup rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transport_rates c
    JOIN private.transport_rates_backup_20261110 b USING (id)
    WHERE (c.customer, c.load_port, c.destination, c.transit_port, c.currency, c.notes, c.active, c.created_at)
       IS DISTINCT FROM
          (b.customer, b.load_port, b.destination, b.transit_port, b.currency, b.notes, b.active, b.created_at)
  ) THEN
    RAISE EXCEPTION 'Rate restore stopped: non-price fields differ from the backup';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transport_rates
    WHERE price_1x20 <> 0 OR price_2x20 <> 0 OR price_40dc <> 0 OR price_40rf <> 0
  ) THEN
    RAISE EXCEPTION 'Rate restore stopped: live price fields are no longer all zero';
  END IF;

  UPDATE public.transport_rates c
  SET price_1x20 = b.price_1x20,
      price_2x20 = b.price_2x20,
      price_40dc = b.price_40dc,
      price_40rf = b.price_40rf,
      updated_by = b.updated_by,
      updated_at = now()
  FROM private.transport_rates_backup_20261110 b
  WHERE c.id = b.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 5029 THEN
    RAISE EXCEPTION 'Rate restore stopped: updated % rows instead of 5029', v_updated;
  END IF;

  INSERT INTO public.audit_log ("user", action, details)
  VALUES (
    'SYSTEM',
    'TRANSPORT_RATES_RESTORED',
    'Restored the four container price columns for 5,029 transport rate rows from private.transport_rates_backup_20261110. 4,888 rows contained at least one price, 140 were unpriced, and one row contained a missing price value. Customer, route, currency, notes, active flags, and created_at were verified unchanged.'
  );
END $$;
