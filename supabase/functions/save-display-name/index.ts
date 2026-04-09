import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let body: { user_id?: unknown; display_name?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Invalid JSON body" });
    }

    const userId =
      typeof body.user_id === "string" ? body.user_id.trim() : "";
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (!userId || !displayName) {
      return json({ success: false, error: "user_id and display_name are required" });
    }

    if (displayName.length > 80) {
      return json({ success: false, error: "display_name must be 80 characters or less" });
    }

    // Split display_name: first word → first_name, remainder → last_name
    const words = displayName.split(/\s+/).filter(Boolean);
    const firstName = words[0] ?? displayName;
    const lastName = words.length > 1 ? words.slice(1).join(" ") : null;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("save-display-name upsert error:", error.message);
      return json({ success: false, error: error.message });
    }

    return json({ success: true, profile });
  } catch (err) {
    console.error("save-display-name error:", err);
    return json({ success: false, error: String(err) });
  }
});
