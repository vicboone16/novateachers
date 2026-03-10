/**
 * Helper to call Nova Core edge functions and Cloud edge functions.
 */

const CORE_URL = 'https://yboqqmkghwhlhhnsegje.supabase.co';
const CORE_ANON_KEY = import.meta.env.VITE_CORE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlib3FxbWtnaHdobGhobnNlZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc4ODMsImV4cCI6MjA4NTEyMzg4M30.F2RPn-0nNx6sqje7P7W2Jfz9mXAXBFNy6xzbV4vf-Fs';
const CLOUD_URL = import.meta.env.VITE_SUPABASE_URL;
const CLOUD_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface InvokeResult<T = any> {
  data: T | null;
  error: Error | null;
}

export async function invokeCloudFunction<T = any>(
  functionName: string,
  body: Record<string, any>,
  authToken?: string
): Promise<InvokeResult<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken || CLOUD_ANON_KEY}`,
      'apikey': CLOUD_ANON_KEY,
    };

    const res = await fetch(`${CLOUD_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: new Error(text || `HTTP ${res.status}`) };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/** Resolved user identity & permissions from Nova Core */
export interface ResolvedUser {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  app_slug: string;
  agencies: { agency_id: string; role: string }[];
  current_agency_id: string | null;
  roles?: string[];
  students?: any[];
  visible_student_ids?: string[];
  student_permissions: {
    student_id: string;
    can_view_notes: boolean;
    can_collect_data: boolean;
    can_generate_reports: boolean;
  }[];
}

/**
 * Resolve a user's identity and permissions via Nova Core's check-user-access endpoint.
 * No service_role key needed — the Core function handles RLS bypass internally.
 */
export async function resolveUser(
  email: string,
  _authToken?: string,
  appSlug = 'novateachers'
): Promise<InvokeResult<ResolvedUser>> {
  try {
    const res = await fetch(`${CORE_URL}/functions/v1/check-user-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, app_slug: appSlug }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: new Error(text || `HTTP ${res.status}`) };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}
