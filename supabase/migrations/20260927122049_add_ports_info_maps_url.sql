alter table public.ports_info
  add column if not exists maps_url text;

comment on column public.ports_info.maps_url is
  'Optional Google Maps link for the yard or port location.';

notify pgrst, 'reload schema';
