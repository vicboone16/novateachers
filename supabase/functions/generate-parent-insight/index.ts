import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date().toISOString().split("T")[0];

    // Resolve student list
    let studentIds: string[] = [];

    if (body.student_id) {
      studentIds = [body.student_id];
    } else if (body.agency_id) {
      // Get students from classroom_group_students for this agency
      const { data: students } = await supabase
        .from("classroom_group_students")
        .select("client_id")
        .eq("agency_id", body.agency_id);
      const unique = new Set((students || []).map((s: any) => s.client_id));
      studentIds = [...unique];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide student_id or agency_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (studentIds.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No students found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const studentId of studentIds) {
      try {
        const insights = await generateInsightsForStudent(supabase, studentId, targetDate, body.agency_id);
        results.push({ student_id: studentId, status: "ok", count: insights.length });
      } catch (err: any) {
        console.error(`Error for student ${studentId}:`, err.message);
        results.push({ student_id: studentId, status: "error", error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, date: targetDate, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-parent-insight error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ──────────────────────────────────────────────────
// Generate parent-friendly insights for a single student
// ──────────────────────────────────────────────────

async function generateInsightsForStudent(
  supabase: any,
  studentId: string,
  date: string,
  agencyId?: string
): Promise<any[]> {
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd = `${date}T23:59:59Z`;

  // 1. Today's points
  const { data: pointRows } = await supabase
    .from("beacon_points_ledger")
    .select("points, source, reason, entry_kind, created_at")
    .eq("student_id", studentId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  const earned = (pointRows || []).filter((r: any) => r.points > 0);
  const deducted = (pointRows || []).filter((r: any) => r.points < 0);
  const totalEarned = earned.reduce((s: number, r: any) => s + r.points, 0);
  const totalDeducted = deducted.reduce((s: number, r: any) => s + Math.abs(r.points), 0);

  // 2. Prior 7 days for trend
  const weekAgo = new Date(date);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: priorPoints } = await supabase
    .from("beacon_points_ledger")
    .select("points, created_at")
    .eq("student_id", studentId)
    .gte("created_at", weekAgo.toISOString())
    .lt("created_at", dayStart);

  const priorDailyTotals: number[] = [];
  const priorByDay = new Map<string, number>();
  for (const r of priorPoints || []) {
    if (r.points > 0) {
      const d = r.created_at.split("T")[0];
      priorByDay.set(d, (priorByDay.get(d) || 0) + r.points);
    }
  }
  for (const v of priorByDay.values()) priorDailyTotals.push(v);
  const priorAvg = priorDailyTotals.length > 0
    ? priorDailyTotals.reduce((a, b) => a + b, 0) / priorDailyTotals.length
    : null;

  // 3. Resolve agency_id if not provided
  if (!agencyId) {
    const firstPoint = (pointRows || [])[0];
    if (firstPoint) {
      const { data: ledger } = await supabase
        .from("beacon_points_ledger")
        .select("agency_id")
        .eq("student_id", studentId)
        .limit(1)
        .single();
      agencyId = ledger?.agency_id;
    }
  }

  // 4. Recent reward redemptions
  const { data: redemptions } = await supabase
    .from("beacon_reward_redemptions")
    .select("reward_id, points_spent, redeemed_at")
    .eq("student_id", studentId)
    .gte("redeemed_at", dayStart)
    .lte("redeemed_at", dayEnd);

  // 5. Streaks — count consecutive days with positive points
  let streakCount = 0;
  const sortedDays = [...priorByDay.keys()].sort().reverse();
  for (const d of sortedDays) {
    if ((priorByDay.get(d) || 0) > 0) streakCount++;
    else break;
  }
  if (totalEarned > 0) streakCount++;

  // ── Generate insights ──
  const insights: any[] = [];
  const resolvedAgency = agencyId || "00000000-0000-0000-0000-000000000000";

  // WIN insight — great day
  if (totalEarned > 0) {
    let title: string;
    let body: string;
    let tone = "positive";

    if (priorAvg !== null && totalEarned > priorAvg * 1.2) {
      title = "🌟 Above-average day!";
      body = `Your child earned ${totalEarned} points today — that's above their recent average of ${Math.round(priorAvg)}. Great momentum!`;
    } else if (totalEarned >= 20) {
      title = "🌟 Strong day!";
      body = `Your child earned ${totalEarned} points today. That's a lot of positive choices!`;
    } else {
      title = "⭐ Points earned today";
      body = `Your child earned ${totalEarned} points today through positive behavior and participation.`;
    }

    insights.push({
      student_id: studentId,
      agency_id: resolvedAgency,
      insight_type: "win",
      title,
      body,
      tone,
      source: "auto_daily",
      is_read: false,
    });
  }

  // PATTERN insight — streak or trend
  if (streakCount >= 3) {
    insights.push({
      student_id: studentId,
      agency_id: resolvedAgency,
      insight_type: "pattern",
      title: `🔥 ${streakCount}-day streak!`,
      body: `Your child has earned points ${streakCount} days in a row. Consistency like this shows real growth!`,
      tone: "positive",
      source: "auto_daily",
      is_read: false,
    });
  } else if (priorAvg !== null && totalEarned > 0) {
    const trend = totalEarned > priorAvg * 1.3 ? "up" : totalEarned < priorAvg * 0.7 ? "down" : "stable";
    if (trend === "up") {
      insights.push({
        student_id: studentId,
        agency_id: resolvedAgency,
        insight_type: "pattern",
        title: "📈 Trending up!",
        body: `Today's ${totalEarned} points are above the recent average of ${Math.round(priorAvg)}. Your child is making progress!`,
        tone: "positive",
        source: "auto_daily",
        is_read: false,
      });
    }
  }

  // CONCERN insight — gentle heads-up (only if deductions happened)
  if (totalDeducted > 0 && totalDeducted > totalEarned * 0.5) {
    insights.push({
      student_id: studentId,
      agency_id: resolvedAgency,
      insight_type: "concern",
      title: "💗 A tougher moment today",
      body: `Your child had some challenging moments today. This is a normal part of learning — the team is supporting them with strategies that help.`,
      tone: "supportive",
      source: "auto_daily",
      is_read: false,
    });
  }

  // Reward redemption celebration
  if ((redemptions || []).length > 0) {
    const count = redemptions.length;
    insights.push({
      student_id: studentId,
      agency_id: resolvedAgency,
      insight_type: "win",
      title: "🎁 Reward earned!",
      body: `Your child redeemed ${count} reward${count > 1 ? "s" : ""} today — they worked hard for ${count > 1 ? "these" : "this"}!`,
      tone: "positive",
      source: "auto_daily",
      is_read: false,
    });
  }

  // Insert insights
  if (insights.length > 0) {
    const { data, error } = await supabase
      .from("parent_insights")
      .insert(insights)
      .select("id");
    if (error) throw error;
    return data || [];
  }

  return [];
}
