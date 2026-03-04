/**
 * Helper to invoke Lovable Cloud edge functions from the NovaTrack Core-connected app.
 * Uses the Cloud project URL + anon key from environment variables.
 */
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
  student_permissions: {
    student_id: string;
    can_view_notes: boolean;
    can_collect_data: boolean;
    can_generate_reports: boolean;
  }[];
}

/**
 * Resolve a user's identity and permissions from Nova Core.
 * Requires a valid auth token (from the logged-in session).
 */
export async function resolveUser(
  email: string,
  authToken: string,
  appSlug = 'novateachers'
): Promise<InvokeResult<ResolvedUser>> {
  return invokeCloudFunction<ResolvedUser>('resolve-user', {
    email,
    app_slug: appSlug,
  }, authToken);
}
