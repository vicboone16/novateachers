import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Escape a value for safe interpolation into HTML (emails, etc.). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow absolute https links to be embedded in emails. */
export function safeHttpsUrl(value: unknown, fallback = "#"): string {
  try {
    const url = new URL(String(value ?? ""));
    if (url.protocol !== "https:") return fallback;
    return escapeHtml(url.toString());
  } catch {
    return fallback;
  }
}

/**
 * Validate the bearer token against the Cloud project and the external Core
 * project. Returns the authenticated user id, or null when the token is invalid.
 */
export async function verifyCaller(req: Request): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");

  // Tier 1 — Cloud project
  try {
    const cloud = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await cloud.auth.getUser(token);
    if (data?.user?.id) return { userId: String(data.user.id), token };
  } catch { /* fall through */ }

  const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL");
  const coreAnon = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY");
  if (!coreUrl || !coreAnon) return null;

  // Tier 2 — external Core project
  try {
    const core = createClient(coreUrl, coreAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await core.auth.getUser(token);
    if (data?.user?.id) return { userId: String(data.user.id), token };
  } catch { /* fall through */ }

  // Tier 3 — Core auth endpoint directly
  try {
    const res = await fetch(`${coreUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: coreAnon },
    });
    if (res.ok) {
      const user = await res.json();
      if (user?.id) return { userId: String(user.id), token };
    }
  } catch { /* fall through */ }

  return null;
}

/**
 * Confirm the caller belongs to the given agency on the Core instance.
 * Returns true when membership is proven, false when it is explicitly absent.
 * When neither membership table can be read, `null` is returned so callers can
 * decide how to treat an indeterminate result.
 */
export async function isAgencyMember(
  core: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<boolean | null> {
  let readable = false;

  for (const table of ["user_agency_access", "agency_memberships"]) {
    const { data, error } = await core
      .from(table)
      .select("user_id")
      .eq("agency_id", agencyId)
      .eq("user_id", userId)
      .limit(1);
    if (error) continue;
    readable = true;
    if (data && data.length > 0) return true;
  }

  return readable ? false : null;
}

/** Collect every agency id the caller belongs to on the Core instance. */
export async function callerAgencyIds(core: SupabaseClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const table of ["user_agency_access", "agency_memberships"]) {
    const { data, error } = await core.from(table).select("agency_id").eq("user_id", userId);
    if (error || !data) continue;
    for (const row of data as Array<{ agency_id?: string }>) {
      if (row.agency_id) ids.add(String(row.agency_id));
    }
  }
  return [...ids];
}
