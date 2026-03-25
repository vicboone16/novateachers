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
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: _claims, error: _authError } = await _authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authError || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipient_email, recipient_name, student_name, snapshot_link, snapshot_date, points_earned, highlights, teacher_note } = await req.json();

    if (!recipient_email) {
      return new Response(JSON.stringify({ error: "recipient_email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedDate = snapshot_date
      ? new Date(snapshot_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : "Today";

    const highlightHtml = (highlights || []).map((h: string) => `<li style="margin: 4px 0;">✅ ${h}</li>`).join("");

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; padding: 24px; background: linear-gradient(135deg, #FFF7ED, #FFFBEB); border-radius: 16px;">
          <p style="font-size: 48px; margin: 0;">💜</p>
          <h1 style="color: #1F2937; margin: 8px 0 4px; font-size: 22px;">${student_name}'s Day</h1>
          <p style="color: #6B7280; margin: 0; font-size: 14px;">${formattedDate}</p>
        </div>

        ${points_earned !== undefined ? `
        <div style="text-align: center; margin: 16px 0; padding: 16px; background: #FFFBEB; border-radius: 12px;">
          <p style="font-size: 36px; font-weight: 700; color: #D97706; margin: 0;">⭐ ${points_earned}</p>
          <p style="color: #92400E; font-size: 13px; margin: 4px 0 0;">Points Earned Today</p>
          ${points_earned > 0 ? `<p style="color: #6B7280; font-size: 12px; margin: 4px 0 0;">Great job! ${student_name} is doing amazing! 🌟</p>` : ""}
        </div>
        ` : ""}

        ${highlightHtml ? `
        <div style="margin: 16px 0; padding: 16px; background: #F9FAFB; border-radius: 8px;">
          <p style="font-weight: 600; margin: 0 0 8px;">✨ Today's Highlights</p>
          <ul style="padding-left: 0; list-style: none; margin: 0;">${highlightHtml}</ul>
        </div>
        ` : ""}

        ${teacher_note ? `
        <div style="margin: 16px 0; padding: 16px; background: #EFF6FF; border-radius: 8px; border-left: 3px solid #3B82F6;">
          <p style="font-weight: 600; margin: 0 0 4px;">📝 A Note from the Teacher</p>
          <p style="color: #374151; margin: 0; font-size: 14px;">${teacher_note}</p>
        </div>
        ` : ""}

        <div style="text-align: center; margin: 24px 0;">
          <a href="${snapshot_link}" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
            View Full Snapshot →
          </a>
        </div>

        <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 24px;">
          Thank you for being part of ${student_name}'s journey! 💜<br/>
          Powered by Beacon
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Beacon <noreply@novabehavior.com>`,
        to: [recipient_email],
        subject: `${student_name}'s Daily Snapshot — ${formattedDate}`,
        html: htmlBody,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: resData }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, email_id: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
