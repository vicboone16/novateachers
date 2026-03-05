import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_id, client_name, agency_id } = await req.json();
    if (!client_id || !agency_id) throw new Error("client_id and agency_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    const CORE_URL = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const CORE_KEY = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY") || "";
    const supabase = createClient(CORE_URL, CORE_KEY, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    // Fetch ABC logs
    const { data: logs } = await supabase
      .from("abc_logs")
      .select("*")
      .eq("client_id", client_id)
      .order("logged_at", { ascending: false })
      .limit(500);

    // Fetch frequency entries
    const { data: freq } = await supabase
      .from("teacher_frequency_entries")
      .select("*")
      .eq("client_id", client_id)
      .eq("agency_id", agency_id)
      .order("logged_date", { ascending: false })
      .limit(200);

    // Fetch duration entries
    const { data: dur } = await supabase
      .from("teacher_duration_entries")
      .select("*")
      .eq("client_id", client_id)
      .eq("agency_id", agency_id)
      .order("logged_date", { ascending: false })
      .limit(200);

    // Fetch behavior categories
    const { data: categories } = await supabase
      .from("behavior_categories")
      .select("*")
      .eq("client_id", client_id);

    // Fetch quick notes
    const { data: notes } = await supabase
      .from("teacher_quick_notes")
      .select("*")
      .eq("client_id", client_id)
      .order("logged_at", { ascending: false })
      .limit(100);

    const dataContext = JSON.stringify({
      abc_logs: (logs || []).slice(0, 200),
      frequency_entries: (freq || []).slice(0, 100),
      duration_entries: (dur || []).slice(0, 100),
      behavior_categories: categories || [],
      quick_notes: (notes || []).slice(0, 50),
    });

    const systemPrompt = `You are a Board Certified Behavior Analyst (BCBA) assistant. Generate a comprehensive Functional Behavior Assessment (FBA) draft based on the provided data.

Structure the FBA with these sections:
1. **Referral Information** - Student name, reason for referral, referral source
2. **Background Information** - Summary of known history from the data
3. **Operational Definitions of Target Behaviors** - Define each behavior observed in the data with measurable, observable terms
4. **Data Summary & Analysis** - Summarize ABC patterns, frequency data, duration data, and trends
5. **Antecedent Analysis** - Common antecedents/triggers identified from ABC logs
6. **Consequence Analysis** - Common consequences and their potential reinforcing effects
7. **Hypothesized Function(s)** - Based on patterns (attention, escape, access to tangibles, automatic reinforcement)
8. **Setting Events & Motivating Operations** - Environmental factors that increase behavior likelihood
9. **Summary & Recommendations** - Key findings and recommended next steps

Use professional clinical language. Base ALL conclusions on the actual data provided. Flag areas where more data is needed.`;

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
          {
            role: "user",
            content: `Generate an FBA draft for student "${client_name || "Student"}".

Here is all the collected behavioral data:
${dataContext}`,
          },
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
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      fba_content: content,
      data_summary: {
        abc_log_count: (logs || []).length,
        frequency_entry_count: (freq || []).length,
        duration_entry_count: (dur || []).length,
        category_count: (categories || []).length,
        note_count: (notes || []).length,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-fba error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
