import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

    let emailsSent = 0;
    let smsSent = 0;
    const errors: string[] = [];

    // Send emails via Resend
    if (RESEND_API_KEY && recipient_emails?.length > 0) {
      for (const email of recipient_emails) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Beacon Alerts <noreply@novabehavior.com>",
              to: [email],
              subject,
              html: htmlBody,
            }),
          });
          if (res.ok) emailsSent++;
          else errors.push(`email:${email}:${res.status}`);
        } catch (e) {
          errors.push(`email:${email}:${(e as Error).message}`);
        }
      }
    }

    // Send SMS via Twilio gateway (if configured)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

    if (LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM_NUMBER && recipient_phones?.length > 0) {
      const smsBody = `🚨 MAYDAY: ${(alert_type || "").toUpperCase()} (${urgency})${classroom_name ? ` - ${classroom_name}` : ""}${student_name ? ` - ${student_name}` : ""}${message ? `: ${message}` : ""}. Triggered by ${triggered_by_name || "Staff"}.`;

      for (const phone of recipient_phones) {
        try {
          const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: TWILIO_FROM_NUMBER,
              Body: smsBody.slice(0, 1600),
            }),
          });
          if (res.ok) smsSent++;
          else errors.push(`sms:${phone}:${res.status}`);
        } catch (e) {
          errors.push(`sms:${phone}:${(e as Error).message}`);
        }
      }
    } else if (recipient_phones?.length > 0) {
      errors.push("sms:not_configured");
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
