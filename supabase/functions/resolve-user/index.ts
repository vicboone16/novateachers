import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Nova Core client using the Service Role Key to bypass RLS. */
function getCoreClient() {
  const url = Deno.env.get("VITE_CORE_SUPABASE_URL");
  const serviceKey = Deno.env.get("CORE_SERVICE_ROLE_KEY");
  console.log("Core URL configured:", url ? `${url.substring(0, 30)}...` : "MISSING");
  console.log("Service key configured:", serviceKey ? `${serviceKey.substring(0, 10)}...` : "MISSING");
  if (!url || !serviceKey) {
    throw new Error(`Missing config: URL=${!!url}, KEY=${!!serviceKey}`);
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    // Allow testing without auth temporarily
    if (false && !authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { email, app_slug } = await req.json();
    if (!email || typeof email !== "string") {
      return json({ error: "email is required" }, 400);
    }

    const slug = app_slug || "novateachers";
    const normalizedEmail = email.toLowerCase().trim();

    // Use Service Role Key client to bypass RLS
    const core = getCoreClient();

    // Step 1: Resolve user_id from profiles
    const { data: profile, error: profileErr } = await core
      .from("profiles")
      .select("user_id, first_name, last_name, display_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileErr) {
      console.error("Profile lookup error:", profileErr.message);
      return json({ error: "Profile lookup failed" }, 500);
    }

    if (!profile?.user_id) {
      return json({ error: "User not found in Nova Core" }, 404);
    }

    const userId = profile.user_id;

    // Step 2: Get agencies from user_agency_access
    const { data: agencies, error: agenciesErr } = await core
      .from("user_agency_access")
      .select("agency_id, role")
      .eq("user_id", userId);

    if (agenciesErr) {
      console.error("Agency access error:", agenciesErr.message);
      return json({ error: "Failed to fetch agencies" }, 500);
    }

    return json({
      user_id: userId,
      display_name: profile.display_name ?? null,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      email: normalizedEmail,
      app_slug: slug,
      agencies: (agencies ?? []).map((a: any) => ({
        agency_id: a.agency_id,
        role: a.role,
      })),
      current_agency_id: agencies?.[0]?.agency_id ?? null,
      student_permissions: [],
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
