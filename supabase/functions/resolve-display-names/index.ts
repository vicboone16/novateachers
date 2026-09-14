import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCaller, callerAgencyIds } from "../_shared/security.ts";


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
    const caller = await verifyCaller(req);
    if (!caller) {
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

    const requestedIds = (user_ids.slice(0, 200) as string[]).map(String);

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

    // Only resolve users who share an agency with the caller (plus the caller themselves)
    const myAgencies = await callerAgencyIds(adminClient, caller.userId);
    const allowed = new Set<string>([caller.userId]);

    if (myAgencies.length > 0) {
      for (const table of ["user_agency_access", "agency_memberships"]) {
        const { data, error } = await adminClient
          .from(table)
          .select("user_id")
          .in("agency_id", myAgencies)
          .in("user_id", requestedIds);
        if (error || !data) continue;
        for (const row of data as Array<{ user_id?: string }>) {
          if (row.user_id) allowed.add(String(row.user_id));
        }
      }
    }

    const ids = requestedIds.filter((id) => allowed.has(id));

    if (ids.length === 0) {
      return new Response(JSON.stringify({ names: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const names: Record<string, string> = {};
    const stillMissing: string[] = [];

    // Step 1: profiles table
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

    // Step 3: staff_members table as last resort
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
      } catch {}
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
