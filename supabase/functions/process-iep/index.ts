import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * IEP Document Processing Pipeline
 * 
 * Steps:
 * 1. ocr_clean — Clean & normalize OCR text
 * 2. detect_sections — Identify IEP sections
 * 3. extract_goals — Find & parse goal blocks
 * 4. extract_progress — Find & parse progress blocks  
 * 5. extract_services — Extract service entries
 * 6. extract_accommodations — Extract accommodations
 * 7. link_progress — Link progress to goals
 * 8. validate — Run quality & compliance checks
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const { step, document_id, raw_text, goals_json, progress_json } = body;

    if (!step || typeof step !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'step' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to call AI gateway
    async function callAI(systemPrompt: string, userPrompt: string, useToolCalling = false, tools?: any[]) {
      const payload: any = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      };
      if (useToolCalling && tools) {
        payload.tools = tools;
        payload.tool_choice = { type: "function", function: { name: tools[0].function.name } };
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded");
        if (response.status === 402) throw new Error("AI credits exhausted");
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();

      if (useToolCalling) {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          return JSON.parse(toolCall.function.arguments);
        }
      }

      const content = data.choices?.[0]?.message?.content || "";
      // Try to extract JSON from response
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[1]); } catch { /* fall through */ }
      }
      return content;
    }

    const GLOBAL_SYSTEM = `You are an IEP document analysis and writing assistant. Your outputs MUST be grounded in provided input text only. Do not invent data, dates, baselines, services, student details, or progress. If something is missing or unclear, return null and add a flag in issues. Always return valid JSON that matches the requested schema exactly. Include a confidence score for each extracted field and a source_map that points to the exact evidence span in the provided text.

Rules:
- No PHI leakage beyond what is in the input. Do not infer diagnoses.
- If multiple possible interpretations exist, choose the most conservative interpretation and add an ambiguity issue.
- Never "approve" or "upload" anything. You only prepare structured drafts for human review.
- Prefer accuracy over completeness.
- Use US-style IEP goal measurability conventions unless the user's text indicates otherwise.`;

    let result: any;

    switch (step) {
      // ─── Step 1: OCR Clean + Normalize ─────────────────────────
      case "ocr_clean": {
        if (!raw_text) throw new Error("Missing raw_text");

        const cleanTools = [{
          type: "function",
          function: {
            name: "return_cleaned_document",
            description: "Return the cleaned and normalized IEP document text with OCR confidence.",
            parameters: {
              type: "object",
              properties: {
                cleaned_text: { type: "string", description: "The fully cleaned and reconstructed document text" },
                ocr_confidence: { type: "number", description: "OCR quality confidence score 0-100" },
                suspected_errors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      original: { type: "string" },
                      corrected: { type: "string" },
                      location: { type: "string" },
                    },
                    required: ["original", "corrected"],
                  },
                },
                sections_needing_review: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["cleaned_text", "ocr_confidence"],
            },
          },
        }];

        const cleanPrompt = `You are an expert document reconstruction engine specializing in IEPs (Individualized Education Programs).

Clean and normalize the following OCR-extracted text from an uploaded PDF so it becomes readable, logically structured, and suitable for automated analysis.

PRIMARY OBJECTIVES:
- Correct OCR errors where obvious
- Restore sentence flow and paragraph structure
- Rebuild lists and tables when possible
- Identify and label IEP sections (Student Info, Present Levels, Goals, Services, Accommodations, Progress, BIP, etc.)
- Preserve ALL original meaning and wording
- Do NOT remove any educational data

CHARACTER CORRECTIONS: Fix common OCR mistakes (0 vs O, l vs I, rn vs m, broken words, split sentences).

TABLE RECONSTRUCTION: If text came from a table, reconstruct using clear field labels.

If uncertain about a word, keep original but mark with [uncertain].

INPUT TEXT:
${raw_text.slice(0, 50000)}`;

        result = await callAI(GLOBAL_SYSTEM, cleanPrompt, true, cleanTools);

        // Update the document record
        if (document_id) {
          // Use the Core Supabase for updating
          const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
          const coreKey = Deno.env.get("CORE_SERVICE_ROLE_KEY");
          if (coreKey) {
            const adminClient = createClient(coreUrl, coreKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            });
            // Note: iep_documents is on Lovable Cloud, not Core
          }

          await supabase.from("iep_documents").update({
            ocr_cleaned_text: result.cleaned_text,
            ocr_confidence: result.ocr_confidence,
            pipeline_status: "cleaned",
            global_issues: result.suspected_errors || [],
          }).eq("id", document_id);
        }
        break;
      }

      // ─── Step 2: Section Detection ─────────────────────────────
      case "detect_sections": {
        const text = raw_text;
        if (!text) throw new Error("Missing text");

        const sectionTools = [{
          type: "function",
          function: {
            name: "return_sections",
            description: "Return detected IEP sections with character offsets",
            parameters: {
              type: "object",
              properties: {
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "Section type: student_info|present_levels|goals|objectives|services|accommodations|progress|bip|evaluation|eligibility|transition|other" },
                      title: { type: "string" },
                      start: { type: "number" },
                      end: { type: "number" },
                      confidence: { type: "number" },
                    },
                    required: ["type", "title", "start", "end", "confidence"],
                  },
                },
                global_issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      severity: { type: "string" },
                      note: { type: "string" },
                    },
                    required: ["type", "severity", "note"],
                  },
                },
              },
              required: ["sections"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Detect major IEP sections in this document. Return section boundaries with character offsets.

Possible sections: Student Info, Present Levels (PLAAFP/PLOP), Measurable Annual Goals, Short-Term Objectives, Benchmarks, Services, Accommodations/Modifications, Progress Monitoring, BIP, Related Services, Evaluation Results, Eligibility, Service Minutes, Assistive Technology, Transition Plan.

DOCUMENT:
${text.slice(0, 50000)}`,
          true, sectionTools);

        if (document_id) {
          await supabase.from("iep_documents").update({
            sections_detected: result.sections || [],
            pipeline_status: "sections_detected",
            global_issues: result.global_issues || [],
          }).eq("id", document_id);
        }
        break;
      }

      // ─── Step 3: Goal Extraction ───────────────────────────────
      case "extract_goals": {
        const text = raw_text;
        if (!text) throw new Error("Missing text");

        const goalTools = [{
          type: "function",
          function: {
            name: "return_goals",
            description: "Return extracted IEP goals",
            parameters: {
              type: "object",
              properties: {
                goals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      goal_key: { type: "string" },
                      goal_index_label: { type: "string" },
                      domain: { type: "string" },
                      area_of_need: { type: "string" },
                      goal_statement_raw: { type: "string" },
                      goal_statement_clean: { type: "string" },
                      condition: { type: "string" },
                      behavior: { type: "string" },
                      criterion: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          value: { type: "number" },
                          unit: { type: "string" },
                          details: { type: "string" },
                        },
                      },
                      measurement_method: { type: "string" },
                      mastery_criteria: { type: "string" },
                      baseline: {
                        type: "object",
                        properties: {
                          value: { type: "string" },
                          date: { type: "string" },
                          context: { type: "string" },
                        },
                      },
                      short_term_objectives: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            objective_text_raw: { type: "string" },
                            objective_text_clean: { type: "string" },
                            criterion: {
                              type: "object",
                              properties: {
                                type: { type: "string" },
                                value: { type: "number" },
                                unit: { type: "string" },
                              },
                            },
                            measurement_method: { type: "string" },
                          },
                          required: ["objective_text_raw"],
                        },
                      },
                      confidence: {
                        type: "object",
                        properties: {
                          overall: { type: "number" },
                          field_confidence: {
                            type: "object",
                            properties: {
                              domain: { type: "number" },
                              baseline: { type: "number" },
                              criterion: { type: "number" },
                              measurement_method: { type: "number" },
                            },
                          },
                        },
                      },
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            severity: { type: "string" },
                            note: { type: "string" },
                          },
                          required: ["type", "severity", "note"],
                        },
                      },
                    },
                    required: ["goal_key", "goal_statement_raw"],
                  },
                },
                iep_cycle: {
                  type: "object",
                  properties: {
                    start_date: { type: "string" },
                    end_date: { type: "string" },
                  },
                },
                global_issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string" },
                      severity: { type: "string" },
                      note: { type: "string" },
                    },
                  },
                },
              },
              required: ["goals"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Extract ALL IEP goals from this document. For each goal:
- Generate a stable goal_key by combining: normalized domain + first 12 words of clean goal + target date
- Extract baseline if present (often in "Present Levels", "Baseline", "Currently")
- Extract criterion (%, frequency, duration, trials, rubric)
- Extract measurement method (work samples, probes, teacher charting, ABC data, etc)
- Extract short-term objectives if listed
- Add field-level confidence 0–1
- Add issues for any missing or ambiguous fields

DOCUMENT:
${text.slice(0, 50000)}`,
          true, goalTools);

        // Save extracted goals
        if (document_id && result.goals?.length > 0) {
          const rows = result.goals.map((g: any) => ({
            document_id,
            goal_key: g.goal_key,
            goal_data: g,
          }));
          await supabase.from("iep_extracted_goals").insert(rows);

          await supabase.from("iep_documents").update({
            pipeline_status: "goals_extracted",
            iep_cycle_start: result.iep_cycle?.start_date || null,
            iep_cycle_end: result.iep_cycle?.end_date || null,
          }).eq("id", document_id);
        }
        break;
      }

      // ─── Step 4: Progress Extraction ───────────────────────────
      case "extract_progress": {
        const text = raw_text;
        if (!text) throw new Error("Missing text");

        const progressTools = [{
          type: "function",
          function: {
            name: "return_progress",
            description: "Return extracted progress entries",
            parameters: {
              type: "object",
              properties: {
                progress_entries: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      progress_key: { type: "string" },
                      goal_reference_text: { type: "string" },
                      reporting_period: { type: "string" },
                      progress_date: { type: "string" },
                      status: { type: "string", enum: ["met", "making_progress", "limited_progress", "not_making_progress", "regressed", "unknown"] },
                      data_points: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            metric: { type: "string" },
                            value: { type: "string" },
                            context: { type: "string" },
                            date: { type: "string" },
                          },
                        },
                      },
                      narrative_raw: { type: "string" },
                      confidence: {
                        type: "object",
                        properties: {
                          overall: { type: "number" },
                          link_confidence: { type: "number" },
                        },
                      },
                      issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            severity: { type: "string" },
                            note: { type: "string" },
                          },
                        },
                      },
                    },
                    required: ["progress_key", "narrative_raw"],
                  },
                },
              },
              required: ["progress_entries"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Extract ALL progress report entries from this IEP document. For each entry:
- Set progress_key as a unique identifier
- Copy any goal number/title/text into goal_reference_text
- Extract status if explicitly stated; if only implied, set status=unknown and add issue
- Extract data points verbatim
- Do NOT guess linked_goal_key; leave it for the linking step

DOCUMENT:
${text.slice(0, 50000)}`,
          true, progressTools);

        if (document_id && result.progress_entries?.length > 0) {
          const rows = result.progress_entries.map((p: any) => ({
            document_id,
            progress_key: p.progress_key,
            progress_data: p,
            link_confidence: p.confidence?.link_confidence || null,
          }));
          await supabase.from("iep_extracted_progress").insert(rows);
        }
        break;
      }

      // ─── Step 5: Services Extraction ───────────────────────────
      case "extract_services": {
        const text = raw_text;
        if (!text) throw new Error("Missing text");

        const serviceTools = [{
          type: "function",
          function: {
            name: "return_services",
            description: "Return extracted services",
            parameters: {
              type: "object",
              properties: {
                services: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      service_type: { type: "string" },
                      provider: { type: "string" },
                      frequency: { type: "string" },
                      duration: { type: "string" },
                      location: { type: "string" },
                      start_date: { type: "string" },
                      end_date: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["service_type"],
                  },
                },
              },
              required: ["services"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Extract ALL services and related services from this IEP document. Include:
- Service type (specialized instruction, speech-language, OT, PT, counseling, etc.)
- Provider role
- Frequency and duration
- Location (classroom, therapy room, etc.)
- Start/end dates if present

DOCUMENT:
${text.slice(0, 50000)}`,
          true, serviceTools);

        if (document_id && result.services?.length > 0) {
          const rows = result.services.map((s: any) => ({
            document_id,
            service_data: s,
          }));
          await supabase.from("iep_extracted_services").insert(rows);
        }
        break;
      }

      // ─── Step 6: Accommodations Extraction ─────────────────────
      case "extract_accommodations": {
        const text = raw_text;
        if (!text) throw new Error("Missing text");

        const accomTools = [{
          type: "function",
          function: {
            name: "return_accommodations",
            description: "Return extracted accommodations",
            parameters: {
              type: "object",
              properties: {
                accommodations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      accommodation_type: { type: "string" },
                      description: { type: "string" },
                      environment: { type: "string", enum: ["classroom", "testing", "transportation", "other"] },
                      confidence: { type: "number" },
                    },
                    required: ["accommodation_type", "description"],
                  },
                },
              },
              required: ["accommodations"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Extract ALL accommodations and modifications from this IEP document. Categorize each as:
- classroom (preferential seating, fidget tools, visual schedules, etc.)
- testing (extended time, separate setting, read-aloud, etc.)
- transportation
- other

DOCUMENT:
${text.slice(0, 50000)}`,
          true, accomTools);

        if (document_id && result.accommodations?.length > 0) {
          const rows = result.accommodations.map((a: any) => ({
            document_id,
            accommodation_data: a,
          }));
          await supabase.from("iep_extracted_accommodations").insert(rows);
        }
        break;
      }

      // ─── Step 7: Link Progress to Goals ────────────────────────
      case "link_progress": {
        if (!goals_json || !progress_json) throw new Error("Missing goals_json or progress_json");

        const linkTools = [{
          type: "function",
          function: {
            name: "return_links",
            description: "Return progress-to-goal links",
            parameters: {
              type: "object",
              properties: {
                links: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      progress_key: { type: "string" },
                      linked_goal_key: { type: "string" },
                      link_confidence: { type: "number" },
                      rationale: { type: "string" },
                    },
                    required: ["progress_key", "link_confidence"],
                  },
                },
              },
              required: ["links"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `Link each progress entry to the best matching goal. Use:
- goal_index_label match
- strong text overlap
- same domain/area_of_need
- semantic similarity ONLY if there is clear anchor text

If link_confidence < 0.70, set linked_goal_key to null.

GOALS:
${JSON.stringify(goals_json).slice(0, 20000)}

PROGRESS ENTRIES:
${JSON.stringify(progress_json).slice(0, 20000)}`,
          true, linkTools);
        break;
      }

      // ─── Step 8: Goal Quality & Compliance Validation ─────────
      case "validate_goals": {
        if (!goals_json) throw new Error("Missing goals_json");

        const validateTools = [{
          type: "function",
          function: {
            name: "return_validation",
            description: "Return goal quality and compliance validation results",
            parameters: {
              type: "object",
              properties: {
                validated_goals: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      goal_key: { type: "string" },
                      quality_score: { type: "number", description: "0-100 overall quality score" },
                      is_measurable: { type: "boolean" },
                      compliance_issues: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", description: "non_measurable|missing_baseline|missing_criterion|vague_behavior|missing_condition|missing_measurement|non_idea_compliant|other" },
                            severity: { type: "string", enum: ["low", "medium", "high"] },
                            note: { type: "string" },
                            suggestion: { type: "string" },
                          },
                          required: ["type", "severity", "note"],
                        },
                      },
                      measurability: {
                        type: "object",
                        properties: {
                          has_condition: { type: "boolean" },
                          has_observable_behavior: { type: "boolean" },
                          has_criterion: { type: "boolean" },
                          has_measurement_method: { type: "boolean" },
                          has_timeline: { type: "boolean" },
                        },
                      },
                    },
                    required: ["goal_key", "quality_score", "is_measurable", "compliance_issues"],
                  },
                },
              },
              required: ["validated_goals"],
            },
          },
        }];

        result = await callAI(GLOBAL_SYSTEM,
          `You are an IEP compliance validator. Analyze each goal for:

1. MEASURABILITY (IDEA-compliant goals must have):
   - Condition (Given..., When..., During...)
   - Observable/measurable behavior (student will...)
   - Criterion (with X% accuracy, in Y out of Z trials, etc.)
   - Measurement method (teacher observation, work samples, probes, etc.)
   - Timeline (by annual review, within 36 weeks, etc.)

2. COMPLIANCE FLAGS:
   - non_measurable: Goal cannot be objectively measured
   - missing_baseline: No current performance level referenced
   - missing_criterion: No success criteria defined
   - vague_behavior: Behavior is not observable (e.g., "understand", "appreciate")
   - missing_condition: No condition under which behavior occurs
   - missing_measurement: No data collection method specified
   - non_idea_compliant: Other IDEA compliance issues

3. QUALITY SCORE (0-100):
   - 90-100: Exemplary, fully measurable
   - 70-89: Good, minor improvements needed
   - 50-69: Adequate, significant gaps
   - 0-49: Poor, needs substantial revision

For each issue, provide a specific suggestion for improvement.

GOALS TO VALIDATE:
${JSON.stringify(goals_json).slice(0, 30000)}`,
          true, validateTools);

        // Update each goal's goal_data with quality scores
        if (document_id && result.validated_goals?.length > 0) {
          for (const vg of result.validated_goals) {
            // Find the matching goal in DB and update its goal_data
            const { data: existingGoals } = await supabase
              .from("iep_extracted_goals")
              .select("id, goal_data")
              .eq("document_id", document_id)
              .eq("goal_key", vg.goal_key)
              .limit(1);

            if (existingGoals?.[0]) {
              const existing = existingGoals[0];
              const updatedData = {
                ...(existing.goal_data as any),
                quality_score: vg.quality_score,
                is_measurable: vg.is_measurable,
                compliance_issues: vg.compliance_issues,
                measurability: vg.measurability,
              };
              await supabase
                .from("iep_extracted_goals")
                .update({ goal_data: updatedData })
                .eq("id", existing.id);
            }
          }
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown step: ${step}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
