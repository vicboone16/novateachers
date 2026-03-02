import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_CORE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_CORE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Core Supabase configuration. Set VITE_CORE_SUPABASE_URL and VITE_CORE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
