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

/**
 * Returns the current user's access_token, trying the Core client first
 * (where the session lives) then the Cloud client as a fallback.
 *
 * Returns `null` if no valid session exists on either client.
 */
export async function getAuthToken(): Promise<string | null> {
  // Primary: Core client (where the user actually signs in)
  try {
    const { data } = await coreClient.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // fall through
  }

  // Fallback: Cloud client (in case session was set there instead)
  try {
    const { data } = await cloudClient.auth.getSession();
    if (data?.session?.access_token) {
      if (import.meta.env.DEV) {
        console.warn(
          '[getAuthToken] Session found on Cloud client but NOT on Core client. ' +
          'This is unexpected — auth should live on the Core client.'
        );
      }
      return data.session.access_token;
    }
  } catch {
    // fall through
  }

  if (import.meta.env.DEV) {
    console.warn('[getAuthToken] No valid session found on either Supabase client.');
  }
  return null;
}
