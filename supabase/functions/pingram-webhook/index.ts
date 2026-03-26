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
    const payload = await req.json();
    const eventType = payload.eventType;

    if (!eventType) {
      return new Response(JSON.stringify({ error: "Missing eventType" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[pingram-webhook] Received event: ${eventType}`, JSON.stringify(payload));

    if (eventType === "SMS_INBOUND") {
      // Find original outbound message by lastTrackingId
      const lastTrackingId = payload.lastTrackingId;
      const fromNumber = payload.from;
      const replyText = payload.text;
      const pingramUserId = payload.userId;

      if (!lastTrackingId && !pingramUserId) {
        console.warn("[pingram-webhook] SMS_INBOUND missing lastTrackingId and userId");
        return new Response(JSON.stringify({ ok: true, action: "skipped_no_tracking" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the original outbound message
      let threadId: string | null = null;
      let originalSenderId: string | null = null;

      if (lastTrackingId) {
        const { data: original } = await supabase
          .from("thread_messages")
          .select("thread_id, sender_id")
          .eq("pingram_tracking_id", lastTrackingId)
          .limit(1)
          .maybeSingle();

        if (original) {
          threadId = original.thread_id;
          originalSenderId = original.sender_id;
        }
      }

      // Fallback: search by phone number in recent outbound messages
      if (!threadId && fromNumber) {
        const { data: byPhone } = await supabase
          .from("thread_messages")
          .select("thread_id, sender_id")
          .eq("channel", "sms")
          .eq("direction", "outbound")
          .eq("sms_to_number", fromNumber)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byPhone) {
          threadId = byPhone.thread_id;
          originalSenderId = byPhone.sender_id;
        }
      }

      if (!threadId) {
        console.warn("[pingram-webhook] Could not find thread for inbound SMS");
        return new Response(JSON.stringify({ ok: true, action: "orphaned_inbound" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert inbound message into the same thread
      // Use a system sender_id (the original staff member or a placeholder)
      const { data: inboundMsg, error: insertErr } = await supabase
        .from("thread_messages")
        .insert({
          thread_id: threadId,
          sender_id: originalSenderId || "00000000-0000-0000-0000-000000000000",
          body: replyText || "(empty reply)",
          message_type: "text",
          channel: "sms",
          direction: "inbound",
          sms_from_number: fromNumber,
          pingram_tracking_id: lastTrackingId,
          pingram_user_id: pingramUserId,
          delivery_status: "delivered",
          external_metadata: payload,
          metadata: {
            app_source: "pingram_inbound",
            parent_reply: true,
            received_at: payload.receivedAt || new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[pingram-webhook] Insert inbound error:", insertErr);
      } else {
        console.log(`[pingram-webhook] Inbound SMS saved: ${inboundMsg?.id} in thread ${threadId}`);
      }

      return new Response(
        JSON.stringify({ ok: true, action: "inbound_saved", message_id: inboundMsg?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (eventType === "SMS_DELIVERED") {
      const trackingId = payload.trackingId;
      if (trackingId) {
        await supabase
          .from("thread_messages")
          .update({ delivery_status: "delivered", external_metadata: payload })
          .eq("pingram_tracking_id", trackingId);
        console.log(`[pingram-webhook] Marked delivered: ${trackingId}`);
      }
      return new Response(JSON.stringify({ ok: true, action: "delivered" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "SMS_FAILED") {
      const trackingId = payload.trackingId;
      if (trackingId) {
        await supabase
          .from("thread_messages")
          .update({
            delivery_status: "failed",
            external_metadata: payload,
          })
          .eq("pingram_tracking_id", trackingId);
        console.log(`[pingram-webhook] Marked failed: ${trackingId}`);
      }
      return new Response(JSON.stringify({ ok: true, action: "failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unhandled event types — acknowledge
    console.log(`[pingram-webhook] Unhandled event: ${eventType}`);
    return new Response(JSON.stringify({ ok: true, action: "ignored" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pingram-webhook] Error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
