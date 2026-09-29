ALTER TABLE public.ports_info
ADD COLUMN IF NOT EXISTS maps_url text;

COMMENT ON COLUMN public.ports_info.maps_url IS
'Google Maps URL for directions to the yard or port location';
