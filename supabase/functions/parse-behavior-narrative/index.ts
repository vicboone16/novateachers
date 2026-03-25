import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Behavior Capture Assistant for classroom staff.
Convert a teacher narrative into structured behavior events in chronological order.

Rules:
- Extract EVERY distinct event from the narrative — do not summarize or skip events.
- A single narrative typically contains 4-10+ events. Extract them ALL.
- Output valid JSON only matching the required schema.
- Prefer common ABA-friendly event types: context, behavior, prompt, skill_trial, reinforcement, incident.
- If the teacher mentions prompting, set prompt_code using FP, PP, G, M, VP when possible.
- If the teacher indicates correct/independent or incorrect, set correctness as '+' or '-'.
- If severity is implied (aggression, elopement, SIB, chair thrown), set intensity 3-5.
- If an incident is described (hitting, pushing, throwing, running away), include an incident event and recommend an alert via suggested_signal.
- Include transitions, redirections, calming strategies, and successful compliance as separate events.

You MUST use the extract_events tool to return your response.`;

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

    const { narrative } = await req.json();
    if (!narrative) throw new Error("narrative is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: narrative },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_events",
            description: "Extract structured behavior events from teacher narrative",
            parameters: {
              type: "object",
              properties: {
                events: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      event_type: { type: "string", enum: ["context", "behavior", "prompt", "skill_trial", "reinforcement", "incident"] },
                      event_name: { type: "string" },
                      value: { type: "number" },
                      intensity: { type: "number" },
                      prompt_code: { type: "string", enum: ["FP", "PP", "G", "M", "VP"] },
                      correctness: { type: "string", enum: ["+", "-"] },
                      metadata: { type: "object" },
                    },
                    required: ["event_type", "event_name"],
                    additionalProperties: false,
                  },
                },
                suggested_signal: {
                  type: "object",
                  properties: {
                    signalType: { type: "string" },
                    severity: { type: "string", enum: ["watch", "action", "critical"] },
                    title: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["signalType", "severity", "title", "message"],
                  additionalProperties: false,
                },
              },
              required: ["events"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_events" } },
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-behavior-narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
