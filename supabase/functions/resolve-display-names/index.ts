import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function bestName(p: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string | null {
  // Priority 1: "First L."
  if (p.first_name) {
    const first = p.first_name.trim();
    if (first && !isUuid(first)) {
      const lastInitial =
        p.last_name && p.last_name.trim() ? p.last_name.trim()[0] : null;
      const candidate = lastInitial ? `${first} ${lastInitial}.` : first;
      return candidate;
    }
  }

  // Priority 2: display_name
  if (p.display_name && p.display_name.trim() && !isUuid(p.display_name)) {
    return p.display_name.trim();
  }

  // Priority 3: email prefix
  if (p.email) {
    const prefix = p.email.split("@")[0];
    if (prefix && !isUuid(prefix)) return prefix;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let body: { user_ids?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_ids } = body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = (user_ids as unknown[])
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, 200);

    if (ids.length === 0) {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profiles, error } = await adminClient
      .from("profiles")
      .select("id, display_name, first_name, last_name, email")
      .in("id", ids);

    if (error) {
      console.error("profiles query error:", error.message);
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const names: Record<string, string> = {};
    for (const p of profiles ?? []) {
      const name = bestName(p);
      if (name) names[p.id] = name;
    }

    return new Response(JSON.stringify({ names }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("resolve-display-names error:", err);
    return new Response(JSON.stringify({ names: {} }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
