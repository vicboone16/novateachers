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
    const PINGRAM_API_KEY = Deno.env.get("PINGRAM_API_KEY");
    if (!PINGRAM_API_KEY) {
      throw new Error("PINGRAM_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { thread_id, message_text, phone_number, severity, notification_type } = body;

    if (!thread_id || !message_text || !phone_number) {
      return new Response(
        JSON.stringify({ error: "thread_id, message_text, and phone_number are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone to E.164
    const normalizedPhone = phone_number.startsWith("+")
      ? phone_number
      : `+1${phone_number.replace(/\D/g, "")}`;

    // 1. Save outbound message to thread first
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: msg, error: msgErr } = await serviceClient
      .from("thread_messages")
      .insert({
        thread_id,
        sender_id: userId,
        body: message_text,
        message_type: "text",
        channel: "sms",
        direction: "outbound",
        severity: severity || null,
        sms_to_number: normalizedPhone,
        delivery_status: "pending",
        metadata: { app_source: "beacon", notification_type: notification_type || "beacon_sms" },
      })
      .select("id")
      .single();

    if (msgErr) {
      throw new Error(`Failed to save message: ${msgErr.message}`);
    }

    // 2. Send via Pingram
    const pingramPayload = {
      type: notification_type || "beacon_sms",
      to: {
        id: `beacon_${thread_id}`,
        number: normalizedPhone,
      },
      sms: {
        message: message_text,
      },
    };

    const pingramRes = await fetch("https://api.pingram.io/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pingramPayload),
    });

    const pingramData = await pingramRes.json();

    if (!pingramRes.ok) {
      // Update message as failed
      await serviceClient
        .from("thread_messages")
        .update({
          delivery_status: "failed",
          external_metadata: pingramData,
        })
        .eq("id", msg.id);

      throw new Error(`Pingram send failed [${pingramRes.status}]: ${JSON.stringify(pingramData)}`);
    }

    // 3. Update message with tracking info
    const trackingId = pingramData.trackingId || pingramData.id || null;
    await serviceClient
      .from("thread_messages")
      .update({
        delivery_status: "sent",
        pingram_tracking_id: trackingId,
        pingram_notification_type: notification_type || "beacon_sms",
        external_metadata: pingramData,
      })
      .eq("id", msg.id);

    // 4. Update thread severity if provided
    if (severity) {
      await serviceClient
        .from("threads")
        .update({ severity })
        .eq("id", thread_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message_id: msg.id,
        tracking_id: trackingId,
        delivery_status: "sent",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-beacon-sms error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
