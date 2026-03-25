import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentId, agencyId } = await req.json();
    if (!studentId || !agencyId) throw new Error("studentId and agencyId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Gather student context
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const [ledgerRes, profileRes, questsRes] = await Promise.all([
      supabase.from("beacon_points_ledger")
        .select("points, source, reason, created_at")
        .eq("student_id", studentId)
        .eq("agency_id", agencyId)
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("student_game_profiles")
        .select("identity_title, momentum_state, current_level, current_xp, avatar_emoji")
        .eq("student_id", studentId)
        .maybeSingle(),
      supabase.from("student_quests")
        .select("title, status, current_value, target_value")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(5),
    ]);

    const points = ledgerRes.data || [];
    const profile = profileRes.data as any || {};
    const quests = questsRes.data || [];

    const todayPoints = points.filter(p => p.created_at?.startsWith(today));
    const todayTotal = todayPoints.reduce((s, p) => s + p.points, 0);
    const weekTotal = points.reduce((s, p) => s + p.points, 0);
    const positiveToday = todayPoints.filter(p => p.points > 0).length;
    const negativeToday = todayPoints.filter(p => p.points < 0).length;

    // Derive momentum
    const dailyTotals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const dayTotal = points.filter(p => p.created_at?.startsWith(d)).reduce((s, p) => s + p.points, 0);
      dailyTotals.push(dayTotal);
    }

    const prompt = `You are a warm, encouraging narrative generator for a classroom behavior app.
Generate TWO things:
1. A daily narrative (2-3 sentences) about this student's day. Positive, strength-based, simple language. No clinical jargon.
2. A short affirmation (1 sentence) aligned to their identity.

Student context:
- Identity: ${profile.identity_title || 'not yet assigned'}
- Level: ${profile.current_level || 1}
- Today's points: ${todayTotal} (${positiveToday} positive, ${negativeToday} corrections)
- Week total: ${weekTotal}
- Daily trend (newest first): ${dailyTotals.join(', ')}
- Active quests: ${quests.map((q: any) => `${q.title} (${q.current_value}/${q.target_value})`).join(', ') || 'none'}
- Momentum: ${profile.momentum_state || 'stable'}

Rules:
- Be warm and genuine, not generic
- Reference specific achievements if possible
- Never mention point deductions negatively — frame as "working through challenges"
- Keep language at a 3rd-5th grade reading level for student view`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Generate the narrative and affirmation now." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "output_narrative",
            description: "Output the daily narrative and affirmation",
            parameters: {
              type: "object",
              properties: {
                narrative: { type: "string", description: "2-3 sentence daily narrative" },
                affirmation: { type: "string", description: "1 sentence identity-aligned affirmation" },
                suggested_identity: { type: "string", description: "Suggested identity title if none assigned" },
              },
              required: ["narrative", "affirmation"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "output_narrative" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let narrative = "Great day of learning and growing!";
    let affirmation = "You're doing amazing!";
    let suggestedIdentity = null;

    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      narrative = args.narrative || narrative;
      affirmation = args.affirmation || affirmation;
      suggestedIdentity = args.suggested_identity || null;
    }

    // Save to profile
    const updateData: any = {
      daily_narrative: narrative,
      daily_narrative_at: new Date().toISOString(),
    };

    // Auto-assign identity if none exists
    if (!profile.identity_title && suggestedIdentity) {
      updateData.identity_title = suggestedIdentity;
    }

    // Update momentum state
    const recentAvg = dailyTotals.slice(0, 2).reduce((a, b) => a + b, 0) / Math.max(1, dailyTotals.slice(0, 2).length);
    const olderAvg = dailyTotals.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, dailyTotals.slice(2).length);
    if (olderAvg > 0) {
      if (recentAvg > olderAvg * 1.15) updateData.momentum_state = 'rising';
      else if (recentAvg < olderAvg * 0.85) updateData.momentum_state = 'dropping';
      else updateData.momentum_state = 'stable';
    }

    await supabase.from("student_game_profiles")
      .update(updateData)
      .eq("student_id", studentId);

    return new Response(JSON.stringify({ narrative, affirmation, momentum_state: updateData.momentum_state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-student-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
