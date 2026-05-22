import { createClient } from '@supabase/supabase-js';

const CORE_SUPABASE_URL = import.meta.env.VITE_CORE_SUPABASE_URL as string;
const CORE_SUPABASE_ANON_KEY = import.meta.env.VITE_CORE_SUPABASE_ANON_KEY as string;

if (!CORE_SUPABASE_URL || !CORE_SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_CORE_SUPABASE_URL or VITE_CORE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(CORE_SUPABASE_URL, CORE_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sb-yboqqmkghwhlhhnsegje-auth-token',
  },
});
