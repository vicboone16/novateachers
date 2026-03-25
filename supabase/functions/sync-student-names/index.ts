import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { group_id } = await req.json();
    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cloud client (service role to update classroom_group_students)
    const cloudClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get student IDs from Cloud
    const { data: students, error: studentsErr } = await cloudClient
      .from("classroom_group_students")
      .select("client_id, first_name")
      .eq("group_id", group_id);

    if (studentsErr) {
      return new Response(JSON.stringify({ error: studentsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to those missing names
    const needsNames = (students || []).filter(
      (s: any) => !s.first_name
    );
    if (needsNames.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, synced: 0, message: "All names present" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIds = needsNames.map((s: any) => s.client_id);

    // Core client (service role to read clients table)
    const coreUrl =
      Deno.env.get("VITE_CORE_SUPABASE_URL") ||
      "https://yboqqmkghwhlhhnsegje.supabase.co";
    const coreKey = Deno.env.get("CORE_SERVICE_ROLE_KEY");
    if (!coreKey) {
      return new Response(
        JSON.stringify({ error: "Missing CORE_SERVICE_ROLE_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const coreClient = createClient(coreUrl, coreKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try clients table first, then students
    let coreData: any[] = [];
    const { data: clients, error: clientsErr } = await coreClient
      .from("clients")
      .select("client_id, first_name, last_name")
      .in("client_id", clientIds);

    if (!clientsErr && clients && clients.length > 0) {
      coreData = clients;
    } else {
      // Fallback: try with 'id' as PK
      const { data: clientsById } = await coreClient
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", clientIds);
      if (clientsById && clientsById.length > 0) {
        coreData = clientsById.map((c: any) => ({
          client_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
        }));
      } else {
        // Try students table
        const { data: studs } = await coreClient
          .from("students")
          .select("id, first_name, last_name")
          .in("id", clientIds);
        if (studs) {
          coreData = studs.map((s: any) => ({
            client_id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
          }));
        }
      }
    }

    // Update Cloud with resolved names
    let synced = 0;
    for (const c of coreData) {
      if (c.first_name || c.last_name) {
        const { error: updateErr } = await cloudClient
          .from("classroom_group_students")
          .update({
            first_name: c.first_name || null,
            last_name: c.last_name || null,
          })
          .eq("group_id", group_id)
          .eq("client_id", c.client_id);
        if (!updateErr) synced++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced,
        total_missing: needsNames.length,
        core_found: coreData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
