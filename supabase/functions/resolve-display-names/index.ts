import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation — three-tier: Cloud JWT, Core JWT, Core auth endpoint
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    let authenticated = false;

    // Tier 1: Try Cloud Supabase
    try {
      const cloudClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data, error } = await cloudClient.auth.getClaims(token);
      if (!error && data?.claims) authenticated = true;
    } catch {}

    // Tier 2: Try Nova Core Supabase
    if (!authenticated) {
      const coreUrl2 = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
      const coreAnon = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlib3FxbWtnaHdobGhobnNlZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc4ODMsImV4cCI6MjA4NTEyMzg4M30.F2RPn-0nNx6sqje7P7W2Jfz9mXAXBFNy6xzbV4vf-Fs";
      try {
        const coreClient = createClient(coreUrl2, coreAnon, { global: { headers: { Authorization: authHeader } } });
        const { data, error } = await coreClient.auth.getClaims(token);
        if (!error && data?.claims) authenticated = true;
      } catch {}
    }

    // Tier 3: Direct auth endpoint
    if (!authenticated) {
      const coreUrl3 = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
      try {
        const res2 = await fetch(`${coreUrl3}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlib3FxbWtnaHdobGhobnNlZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDc4ODMsImV4cCI6MjA4NTEyMzg4M30.F2RPn-0nNx6sqje7P7W2Jfz9mXAXBFNy6xzbV4vf-Fs" },
        });
        if (res2.ok) authenticated = true;
        else await res2.text();
      } catch {}
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_ids } = await req.json();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Step 1: profiles table — use select * to handle any schema
    const { data: profiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("*")
      .in("id", ids);

    if (profilesErr) {
      console.warn("profiles query error:", profilesErr.message);
    }

    if (profiles) {
      for (const p of profiles) {
        const name =
          p.display_name ||
          p.full_name ||
          p.name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          p.email ||
          null;
        if (name) {
          names[p.id] = name;
        }
      }
    }

    // Step 1b: also try agency_memberships with user profile data
    for (const id of ids) {
      if (!names[id]) stillMissing.push(id);
    }

    // Step 2: auth.users metadata fallback
    if (stillMissing.length > 0) {
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
        } catch (e) {
          console.warn(`getUserById(${uid}) failed:`, e);
        }
      }
    }

    // Step 3: For any still unresolved, try staff_members table as last resort
    const finalMissing = ids.filter(id => !names[id]);
    if (finalMissing.length > 0) {
      try {
        const { data: staff } = await adminClient
          .from("staff_members")
          .select("*")
          .in("user_id", finalMissing);
        if (staff) {
          for (const s of staff) {
            const name =
              s.display_name ||
              s.full_name ||
              [s.first_name, s.last_name].filter(Boolean).join(" ") ||
              s.email ||
              null;
            if (name) names[s.user_id] = name;
          }
        }
      } catch {
        // staff_members table may not exist
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
