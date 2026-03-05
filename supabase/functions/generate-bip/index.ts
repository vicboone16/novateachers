import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, client_name, agency_id, fba_content } = await req.json();
    if (!client_id || !agency_id) throw new Error("client_id and agency_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const CORE_URL = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const CORE_KEY = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "";
    const supabase = createClient(CORE_URL, CORE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // Fetch recent data for context
    const { data: logs } = await supabase
      .from("abc_logs")
      .select("*")
      .eq("client_id", client_id)
      .order("logged_at", { ascending: false })
      .limit(200);

    const { data: freq } = await supabase
      .from("teacher_frequency_entries")
      .select("*")
      .eq("client_id", client_id)
      .eq("agency_id", agency_id)
      .order("logged_date", { ascending: false })
      .limit(100);

    const { data: categories } = await supabase
      .from("behavior_categories")
      .select("*")
      .eq("client_id", client_id);

    const dataContext = JSON.stringify({
      abc_logs: (logs || []).slice(0, 100),
      frequency_entries: (freq || []).slice(0, 50),
      behavior_categories: categories || [],
    });

    const systemPrompt = `You are a Board Certified Behavior Analyst (BCBA) assistant. Generate a comprehensive Behavior Intervention Plan (BIP) based on the provided data and FBA findings.

Structure the BIP with these sections:
1. **Student Information** - Name, date, plan participants
2. **Target Behavior(s)** - Operational definitions of behaviors to address
3. **Hypothesized Function(s) of Behavior** - Based on FBA findings
4. **Baseline Data Summary** - Current levels from collected data
5. **Behavioral Goals** - Measurable, time-bound goals for each target behavior
6. **Prevention Strategies (Antecedent Interventions)** - Environmental modifications, schedule changes, pre-correction strategies
7. **Replacement Behaviors** - Functionally equivalent alternatives to teach, with teaching procedures
8. **Consequence Procedures**
   - Reinforcement strategies for replacement behaviors
   - Response procedures for target behaviors (de-escalation, planned ignoring, etc.)
9. **Crisis/Safety Plan** - If applicable based on severity
10. **Data Collection Plan** - What to measure, how often, who collects
11. **Training Needs** - Staff training requirements for implementation
12. **Review Schedule** - When and how to review/modify the plan

Use professional clinical language. Provide specific, actionable strategies. Base recommendations on the actual data patterns.`;

    let userContent = `Generate a BIP for student "${client_name || "Student"}".

Here is the collected behavioral data:
${dataContext}`;

    if (fba_content) {
      userContent += `\n\nHere is the completed FBA for this student:\n${fba_content.slice(0, 8000)}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ bip_content: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bip error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
