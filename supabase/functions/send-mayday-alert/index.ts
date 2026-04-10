const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const PINGRAM_API_KEY = Deno.env.get("PINGRAM_API_KEY");
    if (!PINGRAM_API_KEY) {
      throw new Error("PINGRAM_API_KEY is not configured");
    }

    const {
      alert_type, urgency, message, classroom_name, student_name,
      triggered_by_name, recipient_emails, recipient_phones,
    } = await req.json();

    const urgencyEmoji = urgency === "critical" ? "🔴" : urgency === "high" ? "🟠" : urgency === "medium" ? "🟡" : "🔵";
    const detailLines = [
      `${urgencyEmoji} MAYDAY: ${(alert_type || "Alert").toUpperCase()} (${urgency || "medium"})`,
      classroom_name ? `Classroom: ${classroom_name}` : null,
      student_name ? `Student: ${student_name}` : null,
      message ? `Message: ${message}` : null,
      `Triggered by: ${triggered_by_name || "Staff"}`,
    ].filter(Boolean) as string[];

    const emailSubject = `${urgencyEmoji} Mayday Alert${classroom_name ? ` • ${classroom_name}` : ""}`;
    const smsMessage = detailLines.join(" | ").slice(0, 320);
    const emailHtml = buildEmailHtml(detailLines);

    let sent = 0;
    const errors: string[] = [];

    const emailArr = Array.from(new Set<string>(recipient_emails || []));
    const phoneArr = Array.from(new Set<string>(recipient_phones || []));

    if (emailArr.length === 0 && phoneArr.length === 0) {
      emailArr.push("victoriaboonebcba@gmail.com");
      phoneArr.push("+18185180306");
    }

    // Use the Pingram SDK approach via dynamic import
    const { Pingram } = await import("npm:pingram");
    const pingram = new Pingram({ apiKey: PINGRAM_API_KEY });

    // Send to each unique recipient
    const maxPairs = Math.max(emailArr.length, phoneArr.length);
    for (let i = 0; i < maxPairs; i++) {
      const email = i < emailArr.length ? emailArr[i] : undefined;
      const phone = i < phoneArr.length ? phoneArr[i] : undefined;

      const toObj: Record<string, string> = {};
      if (email) toObj.email = email;
      if (phone) toObj.number = phone;

      try {
        console.log(`[Mayday] Sending to:`, JSON.stringify(toObj));

        const sendPayload: Record<string, unknown> = {
          type: "mayday",
          to: toObj,
        };

        if (email) {
          sendPayload.email = {
            subject: emailSubject,
            html: emailHtml,
          };
        }

        if (phone) {
          sendPayload.sms = {
            message: smsMessage,
          };
        }

        const result = await pingram.send(sendPayload);
        console.log(`[Mayday] Pingram result:`, JSON.stringify(result));
        sent++;
      } catch (e) {
        const errMsg = `${email || phone}: ${(e as Error).message}`;
        console.error(`[Mayday] Send error:`, errMsg);
        errors.push(errMsg);
      }
    }

    const ok = sent > 0 && errors.length === 0;
    return new Response(JSON.stringify({ ok, sent, errors, partial: sent > 0 && errors.length > 0 }), {
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
