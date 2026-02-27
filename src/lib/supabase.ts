import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yboqqmkghwhlhhnsegje.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlib3FxbWtnaHdobGhobnNlZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc4ODMsImV4cCI6MjA4NTEyMzg4M30.F2RPn-0nNx6sqje7P7W2Jfz9mXAXBFNy6xzbV4vf-Fs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
