import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: _claims, error: _authError } = await _authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (_authError || !_claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { document_content, document_type, student_name } = await req.json();
    if (!document_content) throw new Error("document_content required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const docLabel = (document_type || "fba").toUpperCase();

    const systemPrompt = `You are a Board Certified Behavior Analyst (BCBA) reviewing a ${docLabel} document. Provide a structured clinical review with:

1. **Overall Assessment** — Brief quality rating (Strong / Adequate / Needs Revision) with rationale
2. **Strengths** — 2-4 bullet points of what is well done
3. **Areas for Improvement** — 2-4 specific, actionable suggestions
4. **Data Sufficiency** — Is there enough data to support the conclusions? What additional data collection is recommended?
5. **Compliance Notes** — Any ethical or regulatory concerns (BACB guidelines, IDEA requirements for ${docLabel}s)
6. **Suggested Edits** — Up to 3 specific text suggestions with "CHANGE: [original] → [suggested]" format

Keep the review concise (under 500 words). Use professional clinical language.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Review this ${docLabel} for student "${student_name || "Student"}":\n\n${document_content.slice(0, 8000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI review error:", response.status, t);
      throw new Error("AI review failed");
    }

    const result = await response.json();
    const review = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ review }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("review-fba-bip error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
