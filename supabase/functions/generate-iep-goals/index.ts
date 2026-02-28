import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { studentName, grade, abcLogs, behaviorCategories, sectionType } = await req.json();

    const abcSummary = (abcLogs || [])
      .slice(0, 30)
      .map(
        (l: any, i: number) =>
          `${i + 1}. A: ${l.antecedent} | B: ${l.behavior} (${l.behavior_category || "uncategorized"}, intensity ${l.intensity || "N/A"}) | C: ${l.consequence}`
      )
      .join("\n");

    const categorySummary = (behaviorCategories || [])
      .map((c: any) => `- ${c.name}${c.description ? `: ${c.description}` : ""}${c.triggers?.length ? ` (triggers: ${c.triggers.join(", ")})` : ""}`)
      .join("\n");

    const sectionInstructions: Record<string, string> = {
      present_levels:
        "Write a Present Levels of Academic Achievement and Functional Performance (PLAAFP) section. Summarize the student's current performance using the ABC data patterns. Include strengths and areas of concern.",
      goals:
        "Generate 2-3 measurable annual IEP goals with short-term objectives. Each goal must include: baseline, target, measurement method, and timeline. Goals should directly address behavior patterns found in the ABC data.",
      accommodations:
        "Recommend specific accommodations and modifications based on the behavior patterns. Include classroom, assessment, and environmental accommodations.",
      services:
        "Recommend related services (e.g., counseling, behavioral support, speech) with suggested frequency and duration based on the behavior data.",
      transition:
        "Write age-appropriate transition planning content including post-secondary goals, transition activities, and recommended assessments.",
    };

    const instruction = sectionInstructions[sectionType] || sectionInstructions.goals;

    const systemPrompt = `You are an experienced special education professional who writes high-quality IEP documents. You use data-driven approaches and follow IDEA compliance standards. Write in professional but accessible language. Do not include disclaimers about not being a licensed professional — you are acting as a drafting assistant.`;

    const userPrompt = `Student: ${studentName || "Unknown"}
Grade: ${grade || "Not specified"}

Behavior Categories:
${categorySummary || "None recorded"}

Recent ABC Log Data (up to 30 entries):
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
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway error [${response.status}]` }),
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
    console.error("generate-iep-goals error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
