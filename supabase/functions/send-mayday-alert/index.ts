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

    const PINGRAM_API_KEY = Deno.env.get("PINGRAM_API_KEY");
    if (!PINGRAM_API_KEY) {
      throw new Error("PINGRAM_API_KEY is not configured");
    }

    const {
      alert_type, urgency, message, classroom_name, student_name,
      triggered_by_name, recipient_emails, recipient_phones,
    } = await req.json();

    const urgencyEmoji = urgency === "critical" ? "🔴" : urgency === "high" ? "🟠" : urgency === "medium" ? "🟡" : "🔵";
    const subject = `${urgencyEmoji} MAYDAY: ${alert_type} alert${classroom_name ? ` — ${classroom_name}` : ""}`;
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #FEE2E2; border: 2px solid #EF4444; border-radius: 12px; padding: 20px; text-align: center;">
          <h1 style="color: #DC2626; margin: 0 0 8px;">🚨 MAYDAY ALERT</h1>
          <p style="color: #991B1B; font-size: 18px; font-weight: 600; margin: 0;">${(alert_type || "").toUpperCase()}</p>
        </div>
        <div style="margin-top: 16px; padding: 16px; background: #F9FAFB; border-radius: 8px;">
          <p style="margin: 0 0 8px;"><strong>Urgency:</strong> ${urgencyEmoji} ${urgency}</p>
          ${classroom_name ? `<p style="margin: 0 0 8px;"><strong>Classroom:</strong> ${classroom_name}</p>` : ""}
          ${student_name ? `<p style="margin: 0 0 8px;"><strong>Student:</strong> ${student_name}</p>` : ""}
          ${triggered_by_name ? `<p style="margin: 0 0 8px;"><strong>Triggered by:</strong> ${triggered_by_name}</p>` : ""}
          ${message ? `<p style="margin: 16px 0 0; padding-top: 12px; border-top: 1px solid #E5E7EB;"><strong>Message:</strong> ${message}</p>` : ""}
        </div>
        <p style="color: #6B7280; font-size: 12px; text-align: center; margin-top: 16px;">
          This is an automated alert from Beacon. Please respond immediately.
        </p>
      </div>
    `;

    const smsBody = `🚨 MAYDAY: ${(alert_type || "").toUpperCase()} (${urgency})${classroom_name ? ` - ${classroom_name}` : ""}${student_name ? ` - ${student_name}` : ""}${message ? `: ${message}` : ""}. Triggered by ${triggered_by_name || "Staff"}.`;

    let emailsSent = 0;
    let smsSent = 0;
    const errors: string[] = [];

    if (recipient_emails?.length > 0) {
      for (const email of recipient_emails) {
        try {
          const res = await fetch("https://api.pingram.io/sender", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PINGRAM_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "mayday_alert_email",
              to: { id: email, email: email },
              forceChannels: ["EMAIL"],
              email: { subject, html: htmlBody, senderName: "Beacon Alerts", senderEmail: "noreply@novabehavior.com" },
            }),
          });
          if (res.ok) emailsSent++;
          else {
            const errBody = await res.text();
            errors.push(`email:${email}:${res.status}:${errBody}`);
          }
        } catch (e) {
          errors.push(`email:${email}:${(e as Error).message}`);
        }
      }
    }

    if (recipient_phones?.length > 0) {
      for (const phone of recipient_phones) {
        try {
          const res = await fetch("https://api.pingram.io/sender", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PINGRAM_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "mayday_alert_sms",
              to: { id: phone, number: phone },
              forceChannels: ["SMS"],
              sms: { message: smsBody.slice(0, 1600) },
            }),
          });
          if (res.ok) smsSent++;
          else {
            const errBody = await res.text();
            errors.push(`sms:${phone}:${res.status}:${errBody}`);
          }
        } catch (e) {
          errors.push(`sms:${phone}:${(e as Error).message}`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, emails_sent: emailsSent, sms_sent: smsSent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
