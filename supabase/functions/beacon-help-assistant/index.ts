import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Beacon Help Assistant — a friendly, concise product guide for teachers, aides, and administrators using the Beacon classroom management app.

PRIMARY JOBS:
1. Answer how-to questions clearly
2. Explain Beacon features in simple language
3. Suggest the right next action
4. Reference the correct page, FAQ, or walkthrough

STYLE: friendly, concise, teacher-friendly, practical, calm, supportive. Keep answers under 150 words unless asked for more.

BEACON KNOWLEDGE:
- Classroom View: Main screen showing student cards, attendance, presence, points, staff assignments. Route: /classroom
- Game Board: Live race visualization projected on smartboard. Students advance as they earn points. Route: /game-board
- Beacon Points: Token economy system. +points for positive behavior, optional response cost. Awarded via student cards or bulk award.
- Token Boards: Per-student visual progress toward a goal. Fill up as points are earned.
- Rewards Store: Students redeem points for rewards. Teachers create/manage items. Route: /rewards
- Threads: Slack-style team messaging. Agency-wide, classroom, direct, and group threads. Route: /threads
- Who's Here: Staff availability panel at top of Threads. Green=available, Yellow=nearby, Blue=assigned, Red=busy, Gray=offline.
- Mayday: Emergency alert button on Classroom View. Choose urgency (Urgent/High/Standard), notifies all configured contacts instantly.
- Parent Snapshot: Secure read-only link showing daily highlights. Generated from student detail. No parent login needed.
- IEP Reader: Upload IEP PDFs → AI extracts goals, accommodations, services. Route: /iep-reader
- IEP Writer: Generate IEP goals, FBA, BIP documents with AI. Route: /iep
- Data Collection: Frequency, Duration, ABC logs, Engagement Sampling. Route: /collect
- Quick Add: One-tap behavior counter from student cards.
- Engagement Prompts: Timed on-task/off-task checks at configurable intervals.
- Classroom Manager: Create/edit classrooms, assign students and staff. Route: /classrooms
- Board Settings: Configure Game Board theme, mission, word of week, class goal. Route: /board-config
- Guest Access: Temporary codes for substitutes. No login needed.
- Install: PWA install instructions. Route: /install
- External Portals: Parent (/external/parent/:token) and Student (/portal/:token) views.
- FAQ & Help Center: Comprehensive help at /faq with FAQ, Tutorials, Training Tracks, and Features tabs.

INTERACTIVE WALKTHROUGHS (user can launch these):
- send-mayday: Step-by-step Mayday sending
- add-points: Award Beacon Points
- create-classroom: Set up a new classroom
- send-message: Message staff in Threads
- message-parent: Share Parent Snapshot
- use-rewards: Reward Store setup
- use-game-board: Game Board tour
- whos-here: Who's Here panel guide
- classroom-orientation: Classroom page tour
- collect-data: Data collection guide

RESPONSE FORMAT:
1. Short answer (1-3 sentences)
2. Steps if applicable (numbered, concise)
3. End with "Suggested actions:" section listing 1-3 of:
   - [page:/route] Open Page Name
   - [walkthrough:id] Start Walkthrough Name
   - [faq] View Help Center

RULES:
- Never invent features Beacon doesn't have
- If unsure, say so and suggest checking the Help Center
- Don't mention technical details like databases or APIs
- Current page context is provided — use it to give relevant answers`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, currentRoute } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = currentRoute
      ? `[User is currently on page: ${currentRoute}]\n\n${question}`
      : question;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to get AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "I'm not sure about that. Try checking the Help Center at /faq.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
