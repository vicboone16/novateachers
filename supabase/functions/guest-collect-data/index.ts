import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, action, payload } = await req.json();
    if (!code) throw new Error("Guest code is required");

    // Use service role to bypass RLS for guest operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Validate the guest code
    const { data: guestCode, error: codeErr } = await db
      .from("guest_access_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (codeErr || !guestCode) {
      return new Response(JSON.stringify({ error: "Invalid or expired guest code" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(guestCode.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Guest code has expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: validate — return classroom info for the guest UI
    if (action === "validate") {
      // Get students in this classroom group
      const { data: groupStudents } = await db
        .from("classroom_group_students")
        .select("client_id")
        .eq("group_id", guestCode.group_id);

      return new Response(JSON.stringify({
        valid: true,
        group_id: guestCode.group_id,
        agency_id: guestCode.agency_id,
        guest_name: guestCode.guest_name,
        permissions: guestCode.permissions,
        student_ids: (groupStudents || []).map((s: any) => s.client_id),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: collect — insert a data entry
    if (action === "collect") {
      if (!payload?.client_id) throw new Error("client_id is required");

      const { error: insertErr } = await db.from("guest_data_entries").insert({
        guest_code_id: guestCode.id,
        client_id: payload.client_id,
        agency_id: guestCode.agency_id,
        group_id: guestCode.group_id,
        entry_type: payload.entry_type || "tally",
        behavior_name: payload.behavior_name || null,
        value: payload.value ?? 1,
        notes: payload.notes || null,
        guest_name: guestCode.guest_name || payload.guest_name || "Substitute",
        created_by_teacher: guestCode.created_by,
      });

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("guest-collect-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
