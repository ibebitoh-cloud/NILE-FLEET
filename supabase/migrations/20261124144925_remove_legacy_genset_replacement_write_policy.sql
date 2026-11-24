-- The original policy name used spaces rather than the table's underscore name.
-- The earlier policy split now removes it directly; this is an idempotent cleanup.
DROP POLICY IF EXISTS "admin manager write genset replacements" ON public.genset_replacements;
