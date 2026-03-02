import { createClient } from '@supabase/supabase-js';

// External NovaTrack Core instance credentials.
// The anon key is a publishable key safe for client-side use (security is enforced via RLS).
const SUPABASE_URL = import.meta.env.VITE_CORE_SUPABASE_URL || 'https://yboqqmkghwhlhhnsegje.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_CORE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlib3FxbWtnaHdobGhobnNlZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc4ODMsImV4cCI6MjA4NTEyMzg4M30.F2RPn-0nNx6sqje7P7W2Jfz9mXAXBFNy6xzbV4vf-Fs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
