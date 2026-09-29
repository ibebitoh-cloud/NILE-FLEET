-- Track maintenance completion so the system can calculate how many days each service took.
ALTER TABLE public.genset_maintenance_logs
ADD COLUMN IF NOT EXISTS completed_date date;

COMMENT ON COLUMN public.genset_maintenance_logs.completed_date IS 'Date maintenance work was completed; used for duration reporting';