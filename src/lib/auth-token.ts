/**
 * Centralized auth token resolver.
 *
 * The app uses TWO Supabase clients:
 *   1. `@/lib/supabase`                  → Nova Core (where auth sessions live)
 *   2. `@/integrations/supabase/client`  → Lovable Cloud (operational data)
 *
 * The user's JWT session is ONLY on the Core client (#1).
 * Any code that needs an auth token MUST use this helper instead of
 * calling getSession() on an arbitrary client.
 *
 * This prevents the "Unauthorized / missing sub claim" bug where the
 * Cloud client's empty session falls back to the anon key.
 */

import { supabase as coreClient } from '@/lib/supabase';
import { supabase as cloudClient } from '@/integrations/supabase/client';

function getPersistedToken(storageKey: string): string | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const accessToken = parsed?.access_token;
    return typeof accessToken === 'string' && accessToken.length > 0 ? accessToken : null;
  } catch {
    return null;
  }
}

async function getSessionTokenWithRetry(
  getter: () => Promise<{ data?: { session?: { access_token?: string | null } | null } }>,
  attempts = 3,
): Promise<string | null> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const { data } = await getter();
      const token = data?.session?.access_token;
      if (token) return token;
    } catch {
      // fall through
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  }

  return null;
}

/**
 * Returns the current user's access_token, trying the Core client first
 * (where the session lives) then the Cloud client as a fallback.
 *
 * Returns `null` if no valid session exists on either client.
 */
export async function getAuthToken(): Promise<string | null> {
  // Primary: Core client (where the user actually signs in)
  const coreSessionToken = await getSessionTokenWithRetry(() => coreClient.auth.getSession());
  if (coreSessionToken) {
    return coreSessionToken;
  }

  // Fallback: Cloud client (in case session was set there instead)
  const cloudSessionToken = await getSessionTokenWithRetry(() => cloudClient.auth.getSession());
  if (cloudSessionToken) {
    if (import.meta.env.DEV) {
      console.warn(
        '[getAuthToken] Session found on Cloud client but NOT on Core client. ' +
        'This is unexpected — auth should live on the Core client.'
      );
    }
    return cloudSessionToken;
  }

  // Final fallback: parse the persisted auth state directly from localStorage.
  const coreStorageToken = getPersistedToken('sb-yboqqmkghwhlhhnsegje-auth-token');
  if (coreStorageToken) {
    if (import.meta.env.DEV) {
      console.warn('[getAuthToken] Recovered Core token from persisted auth storage.');
    }
    return coreStorageToken;
  }

  const cloudProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const cloudStorageToken = cloudProjectId
    ? getPersistedToken(`sb-${cloudProjectId}-auth-token`)
    : null;

  if (cloudStorageToken) {
    if (import.meta.env.DEV) {
      console.warn('[getAuthToken] Recovered Cloud token from persisted auth storage.');
    }
    return cloudStorageToken;
  }

  if (import.meta.env.DEV) {
    console.warn('[getAuthToken] No valid session found on either Supabase client.');
  }
  return null;
}
