import { createClient } from '@supabase/supabase-js';

// These are browser-safe project identifiers and a publishable API key. Keep
// env overrides for staging or alternate deployments. The production fallback
// applies only to production builds, so a dev server with missing variables
// fails loudly instead of silently writing to the live database.
const fallbackUrl = import.meta.env.PROD ? 'https://mlxsafyubdsssugyiarx.supabase.co' : undefined;
const fallbackKey = import.meta.env.PROD ? 'sb_publishable_A6Mc79suLAirBb1mo3L_Vg_NnUXiB1F' : undefined;

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackUrl;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || fallbackKey;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
