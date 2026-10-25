import { createClient } from '@supabase/supabase-js';

// The Transport system shares the Supabase project with the Genset app but
// keeps its own browser session (separate storage key), so signing in to one
// system never signs you in or out of the other.
const fallbackUrl = import.meta.env.PROD ? 'https://mlxsafyubdsssugyiarx.supabase.co' : undefined;
const fallbackKey = import.meta.env.PROD ? 'sb_publishable_A6Mc79suLAirBb1mo3L_Vg_NnUXiB1F' : undefined;

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackUrl;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || fallbackKey;

if (!url || !key) {
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const transportDb = createClient(url, key, {
  auth: { storageKey: 'nf-transport-auth', persistSession: true, autoRefreshToken: true },
});
