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
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });


    // --- Main logic ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: "Request body must be a JSON object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { studentName, grade, abcLogs, behaviorCategories, sectionType } = body as Record<string, unknown>;

    // --- Input validation ---
    if (!sectionType || typeof sectionType !== "string" || sectionType.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid sectionType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (studentName !== undefined && (typeof studentName !== "string" || studentName.length > 200)) {
      return new Response(
        JSON.stringify({ error: "studentName must be a string under 200 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (grade !== undefined && (typeof grade !== "string" || grade.length > 50)) {
      return new Response(
        JSON.stringify({ error: "grade must be a string under 50 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (abcLogs !== undefined && (!Array.isArray(abcLogs) || abcLogs.length > 50)) {
      return new Response(
        JSON.stringify({ error: "abcLogs must be an array with at most 50 entries" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (behaviorCategories !== undefined && (!Array.isArray(behaviorCategories) || behaviorCategories.length > 20)) {
      return new Response(
        JSON.stringify({ error: "behaviorCategories must be an array with at most 20 entries" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeStudentName = typeof studentName === "string" ? studentName.slice(0, 200) : "Unknown";
    const safeGrade = typeof grade === "string" ? grade.slice(0, 50) : "Not specified";
    const safeLogs = Array.isArray(abcLogs) ? abcLogs.slice(0, 50) : [];
    const safeCategories = Array.isArray(behaviorCategories) ? behaviorCategories.slice(0, 20) : [];

    const abcSummary = safeLogs
      .map(
        (l: any, i: number) =>
          `${i + 1}. A: ${String(l.antecedent || "").slice(0, 500)} | B: ${String(l.behavior || "").slice(0, 500)} (${String(l.behavior_category || "uncategorized").slice(0, 100)}, intensity ${String(l.intensity || "N/A").slice(0, 20)}) | C: ${String(l.consequence || "").slice(0, 500)}`
      )
      .join("\n");

    const categorySummary = safeCategories
      .map((c: any) => {
        const name = String(c.name || "").slice(0, 200);
        const desc = c.description ? `: ${String(c.description).slice(0, 500)}` : "";
        const triggers = Array.isArray(c.triggers) ? ` (triggers: ${c.triggers.map((t: any) => String(t).slice(0, 200)).slice(0, 10).join(", ")})` : "";
        return `- ${name}${desc}${triggers}`;
      })
      .join("\n");

    const sectionInstructions: Record<string, string> = {
      present_levels:
        "Write a Present Levels of Academic Achievement and Functional Performance (PLAAFP) section. Summarize the student's current performance using the ABC data patterns. Include strengths and areas of concern.",
      behavior_impact:
        "Write a Behavior Impact Statement describing how the student's behavior affects their learning and the learning environment. Use the ABC data to identify patterns and provide specific examples.",
      goals:
        "Generate 2-3 measurable annual IEP goals with short-term objectives. Each goal must include: baseline, target, measurement method, and timeline. Goals should directly address behavior patterns found in the ABC data.",
      accommodations:
        "Recommend specific accommodations and modifications based on the behavior patterns. Include classroom, assessment, and environmental accommodations.",
      services:
        "Recommend related services (e.g., counseling, behavioral support, speech) with suggested frequency and duration based on the behavior data.",
      transition:
        "Write age-appropriate transition planning content including post-secondary goals, transition activities, and recommended assessments.",
    };

    const instruction = sectionInstructions[sectionType] || `Write content for a custom IEP section titled "${sectionType.slice(0, 100)}". Use the ABC behavior data to inform your writing. Provide professional, data-driven content appropriate for an IEP document.`;

    const systemPrompt = `You are an experienced special education professional who writes high-quality IEP documents. You use data-driven approaches and follow IDEA compliance standards. Write in professional but accessible language. Do not include disclaimers about not being a licensed professional — you are acting as a drafting assistant.`;

    const userPrompt = `Student: ${safeStudentName}
Grade: ${safeGrade}

Behavior Categories:
${categorySummary || "None recorded"}

Recent ABC Log Data (up to 50 entries):
${abcSummary || "No ABC data available"}

Task: ${instruction}

Provide the content directly, ready to paste into an IEP document section.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
