import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("Email service not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extract sender email from body since auth is via Nova Core
    const senderEmail = "teacher@app";

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: "Request body must be a JSON object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clientId, clientName, fieldChanges } = body as Record<string, unknown>;

    if (!clientId || typeof clientId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
      return new Response(
        JSON.stringify({ error: "clientId must be a valid UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clientName || typeof clientName !== "string" || clientName.length > 200) {
      return new Response(
        JSON.stringify({ error: "clientName is required and must be under 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeClientName = escapeHtml(clientName.slice(0, 200));
    const safeSenderEmail = escapeHtml(senderEmail);

    // Build changes summary for email
    const changes = (fieldChanges && typeof fieldChanges === "object") ? fieldChanges as Record<string, { old: string | null; new: string }> : {};
    const changesRows = Object.entries(changes).map(([field, val]) => {
      const safeField = escapeHtml(field);
      const safeOld = escapeHtml(String(val?.old || "—"));
      const safeNew = escapeHtml(String(val?.new || "—"));
      return `<tr>
        <td style="padding: 6px 12px; border: 1px solid #e5e7eb; font-size: 13px;">${safeField}</td>
        <td style="padding: 6px 12px; border: 1px solid #e5e7eb; font-size: 13px; color: #888;">${safeOld}</td>
        <td style="padding: 6px 12px; border: 1px solid #e5e7eb; font-size: 13px; font-weight: 600;">${safeNew}</td>
      </tr>`;
    }).join("");

    // Find assigned BCBAs via user_client_access on Core
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: accessRows, error: accessError } = await serviceClient
      .from("user_client_access")
      .select("user_id")
      .eq("client_id", clientId);

    if (accessError) {
      throw new Error("Failed to look up assigned staff");
    }

    if (!accessRows || accessRows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No assigned staff — no emails sent", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = accessRows.map((r: any) => r.user_id);
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, role")
      .in("id", userIds);

    const bcbaProfiles = (profiles || []).filter(
      (p: any) =>
        p.role === "bcba" ||
        p.role === "admin" ||
        p.role === "owner" ||
        p.role === "clinical_director"
    );

    if (bcbaProfiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No BCBAs assigned — no emails sent", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    for (const bcba of bcbaProfiles) {
      if (!bcba.email) continue;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #fef3c7; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px; color: #92400e; font-size: 18px;">
              ✏️ Student Record Change Request
            </h2>
            <p style="margin: 0; color: #78350f; font-size: 14px;">
              A teacher has requested changes to a student's information for your review.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${safeClientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Requested by</td>
              <td style="padding: 8px 0; color: #1a1a1a;">${safeSenderEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Date</td>
              <td style="padding: 8px 0; color: #1a1a1a;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td>
            </tr>
          </table>

          <h3 style="font-size: 14px; color: #1a1a1a; margin: 16px 0 8px;">Proposed Changes</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 12px; text-align: left;">Field</th>
                <th style="padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 12px; text-align: left;">Current</th>
                <th style="padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 12px; text-align: left;">Proposed</th>
              </tr>
            </thead>
            <tbody>${changesRows}</tbody>
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #555; font-size: 13px; margin: 0;">
              Log in to NovaTrack to review and approve or reject this change request.
            </p>
          </div>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "NovaTrack <noreply@novabehavior.com>",
          to: [bcba.email],
          subject: `✏️ Change Request: ${safeClientName} — Review Required`,
          html: emailHtml,
        }),
      });

      if (res.ok) {
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, total: bcbaProfiles.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
