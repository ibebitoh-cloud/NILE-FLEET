import { createClient } from '@supabase/supabase-js';

// These are browser-safe project identifiers and a publishable API key. Keep
// env overrides for staging or alternate deployments, but let the connected
// Nile Fleet project work when a host has not been given build-time variables.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://mlxsafyubdsssugyiarx.supabase.co';
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || 'sb_publishable_A6Mc79suLAirBb1mo3L_Vg_NnUXiB1F';

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
