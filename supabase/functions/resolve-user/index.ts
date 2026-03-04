import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Nova Core client using the Service Role Key to bypass RLS. */
function getCoreClient() {
  const url = Deno.env.get("VITE_CORE_SUPABASE_URL")!;
  const serviceKey = Deno.env.get("CORE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authenticate caller via Lovable Cloud JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Validate JWT against Core (where users actually authenticate)
    const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL")!;
    const coreAnonKey = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY")!;
    const coreAuth = createClient(coreUrl, coreAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } =
      await coreAuth.auth.getUser();
    if (userError || !callingUser) {
      console.error("Auth error:", userError?.message);
      return json({ error: "Invalid token" }, 401);
    }

    // --- Parse request body ---
    const { email, app_slug } = await req.json();

    if (!email || typeof email !== "string") {
      return json({ error: "email is required" }, 400);
    }

    const slug = app_slug || "novateachers";
    const normalizedEmail = email.toLowerCase().trim();

    // --- Resolve against Nova Core ---
    const core = getCoreClient();

    // Step 1: Find user_id from profiles
    const { data: profile, error: profileErr } = await core
      .from("profiles")
      .select("user_id, first_name, last_name, display_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let userId: string | null = profile?.user_id ?? null;

    // Step 1b: Fallback — check user_app_access by email
    if (!userId) {
      const { data: fallback } = await core
        .from("user_app_access")
        .select("user_id")
        .eq("email", normalizedEmail)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      userId = fallback?.user_id ?? null;
    }

    if (!userId) {
      return json({ error: "User not found in Nova Core" }, 404);
    }

    // Step 2: Verify app-specific access
    const { data: appAccess } = await core
      .from("user_app_access")
      .select("agency_id, role, is_active")
      .eq("user_id", userId)
      .eq("app_slug", slug)
      .eq("is_active", true);

    if (!appAccess || appAccess.length === 0) {
      return json({ error: "No access to this app", user_id: userId }, 403);
    }

    const agencies = appAccess.map((a: any) => ({
      agency_id: a.agency_id,
      role: a.role,
    }));

    // Step 3: Get student-level permissions for this app
    const { data: studentAccess } = await core
      .from("user_student_access")
      .select(
        "student_id, can_view_notes, can_collect_data, can_generate_reports"
      )
      .eq("user_id", userId)
      .eq("app_scope", slug);

    // Step 4: Get active agency context
    const { data: agencyCtx } = await core
      .from("user_agency_context")
      .select("current_agency_id")
      .eq("user_id", userId)
      .maybeSingle();

    return json({
      user_id: userId,
      display_name: profile?.display_name ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      email: normalizedEmail,
      app_slug: slug,
      agencies,
      current_agency_id: agencyCtx?.current_agency_id ?? null,
      student_permissions: studentAccess ?? [],
    });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
