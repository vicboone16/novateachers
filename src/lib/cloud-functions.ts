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
  body: Record<string, any>
): Promise<InvokeResult<T>> {
  try {
    const res = await fetch(`${CLOUD_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLOUD_ANON_KEY}`,
        'apikey': CLOUD_ANON_KEY,
      },
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
