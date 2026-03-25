import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple HTML entity escaper to prevent XSS in email templates
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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Validate JWT
    const _authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: _claims, error: _authError } = await _authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authError || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey) {
      throw new Error("Email service not configured");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extract sender email from the request body (since auth is via Nova Core, not this project)
    // The caller passes sender info in the body

    // Parse & validate body
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

    const { clientId, clientName, summaryTitle, senderEmail: senderEmailBody } = body as Record<string, unknown>;
    const senderEmail = (typeof senderEmailBody === "string" && senderEmailBody) ? senderEmailBody : "Unknown";

    // Validate clientId as UUID
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

    if (summaryTitle !== undefined && (typeof summaryTitle !== "string" || summaryTitle.length > 500)) {
      return new Response(
        JSON.stringify({ error: "summaryTitle must be a string under 500 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeClientName = escapeHtml(clientName.slice(0, 200));
    const safeSummaryTitle = escapeHtml(typeof summaryTitle === "string" ? summaryTitle.slice(0, 500) : "BCBA Summary");
    const safeSenderEmail = escapeHtml(senderEmail || "Unknown");

    // Find assigned BCBAs for this student via user_client_access on Nova Core
    const CORE_URL = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const CORE_SERVICE_KEY = Deno.env.get("CORE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(CORE_URL, CORE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: accessRows, error: accessError } = await serviceClient
      .from("user_client_access")
      .select("user_id")
      .eq("client_id", clientId);

    if (accessError) {
      throw new Error("Failed to look up assigned staff");
    }

    if (!accessRows || accessRows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No assigned staff found — no emails sent",
          sent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user emails from profiles
    const userIds = accessRows.map((r: any) => r.user_id);
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, email, full_name, role")
      .in("id", userIds);

    // Filter to BCBAs/admins only
    const bcbaProfiles = (profiles || []).filter(
      (p: any) =>
        p.role === "bcba" ||
        p.role === "admin" ||
        p.role === "owner" ||
        p.role === "clinical_director"
    );

    if (bcbaProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No BCBAs assigned — no emails sent",
          sent: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send emails via Resend
    let sentCount = 0;
    for (const bcba of bcbaProfiles) {
      if (!bcba.email) continue;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 16px;">
            <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 18px;">
              📋 New Teacher Summary Shared
            </h2>
            <p style="margin: 0; color: #555; font-size: 14px;">
              A teacher has shared a data summary for your review.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 120px;">Student</td>
              <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600;">${safeClientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Report</td>
              <td style="padding: 8px 0; color: #1a1a1a;">${safeSummaryTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Shared by</td>
              <td style="padding: 8px 0; color: #1a1a1a;">${safeSenderEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888;">Date</td>
              <td style="padding: 8px 0; color: #1a1a1a;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td>
            </tr>
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #555; font-size: 13px; margin: 0;">
              Log in to NovaTrack to review this summary and mark it as reviewed.
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
          subject: `📋 New Summary: ${safeClientName} — Review Required`,
          html: emailHtml,
        }),
      });

      if (res.ok) {
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: bcbaProfiles.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
