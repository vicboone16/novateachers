import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PINGRAM_API_URL = "https://api.pingram.io/send";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(lines: string[]) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px; color: #b91c1c;">Mayday Alert</h2>
      ${lines.map((line) => `<p style="margin: 0 0 8px;">${escapeHtml(line)}</p>`).join("")}
    </div>
  `.trim();
}

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
    const token = authHeader.replace("Bearer ", "");
    let authenticated = false;

    // Tier 1: Cloud
    try {
      const cloudClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error } = await cloudClient.auth.getUser(token);
      if (!error && user) authenticated = true;
    } catch {}

    // Tier 2: Core
    if (!authenticated) {
      const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
      const coreAnon = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "";
      try {
        const coreClient = createClient(coreUrl, coreAnon, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error } = await coreClient.auth.getUser(token);
        if (!error && user) authenticated = true;
      } catch {}
    }

    // Tier 3: Direct fetch
    if (!authenticated) {
      const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
      try {
        const res = await fetch(`${coreUrl}/auth/v1/user`, {
          headers: { Authorization: authHeader, apikey: Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "" },
        });
        if (res.ok) authenticated = true;
        else await res.text();
      } catch {}
    }

    if (!authenticated) {
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

    // Build the comment merge tag for the Pingram template
    const urgencyEmoji = urgency === "critical" ? "🔴" : urgency === "high" ? "🟠" : urgency === "medium" ? "🟡" : "🔵";
    const detailLines = [
      `${urgencyEmoji} MAYDAY: ${(alert_type || "Alert").toUpperCase()} (${urgency || "medium"})`,
      classroom_name ? `Classroom: ${classroom_name}` : null,
      student_name ? `Student: ${student_name}` : null,
      message ? `Message: ${message}` : null,
      `Triggered by: ${triggered_by_name || "Staff"}`,
    ].filter(Boolean) as string[];
    const commentParts = detailLines.join("\n");
    const emailSubject = `${urgencyEmoji} Mayday Alert${classroom_name ? ` • ${classroom_name}` : ""}`;
    const smsMessage = detailLines.join(" | ").slice(0, 320);

    let sent = 0;
    const errors: string[] = [];

    // Collect all unique recipients
    const emailArr = Array.from(new Set<string>(recipient_emails || []));
    const phoneArr = Array.from(new Set<string>(recipient_phones || []));

    // If no recipients at all, use defaults
    if (emailArr.length === 0 && phoneArr.length === 0) {
      emailArr.push("victoriaboonebcba@gmail.com");
      phoneArr.push("+18185180306");
    }

    // Send one call per unique email (with paired phone if available)
    const maxPairs = Math.max(emailArr.length, phoneArr.length);
    for (let i = 0; i < maxPairs; i++) {
      const email = i < emailArr.length ? emailArr[i] : undefined;
      const phone = i < phoneArr.length ? phoneArr[i] : undefined;

      const toObj: Record<string, string> = {};
      if (email) toObj.email = email;
      if (phone) toObj.number = phone;

      try {
        console.log(`[Mayday] Sending to:`, JSON.stringify(toObj));

        const payload: Record<string, unknown> = {
          type: "mayday",
          to: toObj,
          templateId: "template_1",
          parameters: {
            comment: commentParts,
          },
        };

        if (email) {
          payload.email = {
            subject: emailSubject,
            html: buildEmailHtml(detailLines),
          };
        }

        if (phone) {
          payload.sms = {
            message: smsMessage,
          };
        }

        const res = await fetch(PINGRAM_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PINGRAM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const resBody = await res.text();
        console.log(`[Mayday] Pingram response ${res.status}:`, resBody);

        if (res.ok) {
          sent++;
        } else {
          errors.push(`${email || phone}:${res.status}:${resBody}`);
        }
      } catch (e) {
        errors.push(`${email || phone}:${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Mayday] Error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
