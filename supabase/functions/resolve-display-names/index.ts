import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Resolve an array of user IDs to human-readable display names.
 * 1. Try profiles table (display_name / first+last / email)
 * 2. Fallback to auth.users raw_user_meta_data for any IDs still unresolved
 *
 * Requires CORE_SERVICE_ROLE_KEY secret to read auth.users.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_ids } = await req.json();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap to 200 IDs per request
    const ids = user_ids.slice(0, 200) as string[];

    const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const serviceKey = Deno.env.get("CORE_SERVICE_ROLE_KEY");

    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "Missing CORE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(coreUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const names: Record<string, string> = {};
    const stillMissing: string[] = [];

    // Step 1: profiles table
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name, display_name, email")
      .in("id", ids);

    if (profiles) {
      for (const p of profiles) {
        const name =
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          p.email ||
          null;
        if (name) {
          names[p.id] = name;
        }
      }
    }

    // Find unresolved IDs
    for (const id of ids) {
      if (!names[id]) stillMissing.push(id);
    }

    // Step 2: auth.users metadata fallback
    if (stillMissing.length > 0) {
      // Use admin API to list users by ID
      for (const uid of stillMissing) {
        try {
          const { data: { user } } = await adminClient.auth.admin.getUserById(uid);
          if (user) {
            const meta = user.user_metadata || {};
            const name =
              meta.display_name ||
              meta.full_name ||
              meta.name ||
              [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
              user.email ||
              null;
            if (name) {
              names[uid] = name;
            }
          }
        } catch {
          // skip individual failures
        }
      }
    }

    return new Response(JSON.stringify({ names }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
