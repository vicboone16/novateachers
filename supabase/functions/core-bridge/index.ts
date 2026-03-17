import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Json = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const coreUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const coreKey = Deno.env.get("CORE_SERVICE_ROLE_KEY");

    if (!coreKey) {
      return json({ error: "Missing CORE_SERVICE_ROLE_KEY" }, 500);
    }

    const core = createClient(coreUrl, coreKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = String(body?.action || "");

    // ─── diagnose_schema ───────────────────────────────────────────
    if (action === "diagnose_schema") {
      const targetTables = [
        "teacher_frequency_entries",
        "teacher_duration_entries",
        "teacher_data_events",
        "teacher_messages",
        "teacher_message_attachments",
        "teacher_weekly_summaries",
        "teacher_quick_notes",
        "teacher_interval_settings",
        "teacher_targets",
        "teacher_data_sessions",
        "teacher_data_points",
        "abc_logs",
        "behavior_categories",
        "clients",
        "students",
        "user_agency_access",
        "user_student_access",
        "user_app_access",
        "agency_memberships",
        "classrooms",
        "event_stream",
        "supervisor_signals",
        "iep_drafts",
      ];

      const results: Record<string, { exists: boolean; columns?: string[]; error?: string }> = {};

      for (const table of targetTables) {
        try {
          // Try selecting 0 rows to see if table exists + get column names
          const { data, error } = await core.from(table).select("*").limit(0);
          if (error) {
            // 42P01 = table doesn't exist
            if (String(error.code) === "42P01" || String(error.message).includes("does not exist")) {
              results[table] = { exists: false };
            } else {
              results[table] = { exists: true, error: error.message };
            }
          } else {
            // Get column names from a single row or from the empty result
            const { data: sample } = await core.from(table).select("*").limit(1);
            const columns = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
            results[table] = { exists: true, columns };
          }
        } catch (err) {
          results[table] = { exists: false, error: String(err) };
        }
      }

      // Also check for RPC functions
      const rpcs = ["insert_event", "create_supervisor_signal"];
      const rpcResults: Record<string, { available: boolean; error?: string }> = {};
      for (const fn of rpcs) {
        try {
          // Call with empty/invalid params to see if function exists
          const { error } = await core.rpc(fn, {});
          if (error && String(error.message).includes("does not exist")) {
            rpcResults[fn] = { available: false };
          } else {
            // Either succeeded or failed with param error — function exists
            rpcResults[fn] = { available: true, error: error?.message };
          }
        } catch (err) {
          rpcResults[fn] = { available: false, error: String(err) };
        }
      }

      return json({ tables: results, rpcs: rpcResults, core_url: coreUrl });
    }

    // ─── list_recent_classroom_events ──────────────────────────────
    if (action === "list_recent_classroom_events") {
      const userId = String(body.user_id || "");
      const agencyId = body.agency_id ? String(body.agency_id) : null;
      const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(String) : [];
      const limit = Math.min(Number(body.limit || 20), 50);
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      let query = core
        .from("teacher_data_events")
        .select("event_id, student_id, event_type, event_subtype, event_value, recorded_at, source_module")
        .eq("staff_id", userId)
        .gte("recorded_at", startOfDay.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(limit);

      if (agencyId) query = query.eq("agency_id", agencyId);
      if (studentIds.length > 0) query = query.in("student_id", studentIds);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);

      return json({ events: data || [] });
    }

    // ─── seed_teacher_events (schema-adaptive) ────────────────────
    if (action === "seed_teacher_events") {
      const studentId = String(body.student_id || "");
      const userId = String(body.user_id || "");
      const agencyId = String(body.agency_id || "");
      const behavior = String(body.behavior || "Aggression");

      if (!studentId || !userId || !agencyId) {
        return json({ error: "student_id, user_id, and agency_id are required" }, 400);
      }

      const now = new Date();
      const behaviorAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
      const abcAt = new Date(now.getTime() - 60 * 1000).toISOString();
      const loggedDate = now.toISOString().slice(0, 10);
      const steps: { step: string; ok: boolean; error?: string }[] = [];

      // Step 1: Detect schema for teacher_frequency_entries
      const freqPayloads = [
        // Try client_id + logged_date (Lovable Cloud schema)
        { agency_id: agencyId, client_id: studentId, user_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate },
        // Try student_id variant (some Core schemas)
        { agency_id: agencyId, student_id: studentId, user_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate },
        // Try staff_id variant
        { agency_id: agencyId, client_id: studentId, staff_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate },
      ];

      let freqOk = false;
      for (const payload of freqPayloads) {
        const { error } = await core.from("teacher_frequency_entries").insert(payload);
        if (!error) {
          steps.push({ step: "teacher_frequency_entries", ok: true });
          freqOk = true;
          break;
        }
        // If column doesn't exist, try next variant
        if (String(error.message).includes("column") || String(error.code) === "42703") {
          continue;
        }
        // Other error — record it but keep going
        steps.push({ step: "teacher_frequency_entries", ok: false, error: error.message });
        break;
      }
      if (!freqOk && steps.filter(s => s.step === "teacher_frequency_entries").length === 0) {
        steps.push({ step: "teacher_frequency_entries", ok: false, error: "All column variants failed" });
      }

      // Step 2: Try abc_logs with adaptive columns
      const abcPayloads = [
        { client_id: studentId, user_id: userId, antecedent: "Transition to independent work", behavior, consequence: "Redirected and offered a brief break", behavior_category: behavior, notes: "Seeded test ABC event", logged_at: abcAt },
        { student_id: studentId, user_id: userId, antecedent: "Transition to independent work", behavior, consequence: "Redirected and offered a brief break", behavior_category: behavior, notes: "Seeded test ABC event", logged_at: abcAt },
        { client_id: studentId, staff_id: userId, antecedent: "Transition to independent work", behavior, consequence: "Redirected and offered a brief break", behavior_category: behavior, notes: "Seeded test ABC event", logged_at: abcAt },
      ];

      let abcOk = false;
      for (const payload of abcPayloads) {
        const { error } = await core.from("abc_logs").insert(payload);
        if (!error) {
          steps.push({ step: "abc_logs", ok: true });
          abcOk = true;
          break;
        }
        if (String(error.message).includes("column") || String(error.code) === "42703") continue;
        steps.push({ step: "abc_logs", ok: false, error: error.message });
        break;
      }
      if (!abcOk && steps.filter(s => s.step === "abc_logs").length === 0) {
        steps.push({ step: "abc_logs", ok: false, error: "All column variants failed" });
      }

      // Step 3: teacher_data_events (unified event stream)
      const eventRows = [
        {
          student_id: studentId,
          staff_id: userId,
          agency_id: agencyId,
          event_type: "behavior_event",
          event_subtype: "frequency",
          event_value: { behavior, count: 1, seeded: true },
          source_module: "core_bridge_seed",
          metadata: { seeded: true },
          recorded_at: behaviorAt,
        },
        {
          student_id: studentId,
          staff_id: userId,
          agency_id: agencyId,
          event_type: "abc_event",
          event_subtype: behavior,
          event_value: {
            antecedent: "Transition to independent work",
            behavior,
            consequence: "Redirected and offered a brief break",
            seeded: true,
          },
          source_module: "core_bridge_seed",
          metadata: { seeded: true },
          recorded_at: abcAt,
        },
      ];

      const { error: eventsError } = await core.from("teacher_data_events").insert(eventRows);
      steps.push({
        step: "teacher_data_events",
        ok: !eventsError,
        ...(eventsError ? { error: eventsError.message } : {}),
      });

      const allOk = steps.every(s => s.ok);

      return json({
        ok: allOk,
        steps,
        seeded: {
          student_id: studentId,
          user_id: userId,
          agency_id: agencyId,
          behavior_timestamp: behaviorAt,
          abc_timestamp: abcAt,
        },
      });
    }

    // ─── count_unread_messages ─────────────────────────────────────
    if (action === "count_unread_messages") {
      const userId = String(body.user_id || "");
      const { count, error } = await core
        .from("teacher_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (error) return json({ error: error.message }, 400);
      return json({ count: count || 0 });
    }

    // ─── list_messages ────────────────────────────────────────────
    if (action === "list_messages") {
      const userId = String(body.user_id || "");
      const tab = String(body.tab || "inbox");
      let query = core.from("teacher_messages").select("*");
      query = tab === "sent" ? query.eq("sender_id", userId) : query.eq("recipient_id", userId);
      let result = await query.is("parent_id", null).order("created_at", { ascending: false });
      if (result.error && String(result.error.message || "").includes("parent_id")) {
        result = await query.order("created_at", { ascending: false });
      }
      if (result.error) return json({ error: result.error.message }, 400);
      return json({ messages: result.data || [] });
    }

    // ─── list_thread ──────────────────────────────────────────────
    if (action === "list_thread") {
      const threadId = String(body.thread_id || "");
      const { data, error } = await core
        .from("teacher_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 400);
      return json({ messages: data || [] });
    }

    // ─── mark_messages_read ───────────────────────────────────────
    if (action === "mark_messages_read") {
      const messageIds = Array.isArray(body.message_ids) ? body.message_ids.map(String) : [];
      if (messageIds.length === 0) return json({ ok: true, updated: 0 });
      const { error } = await core
        .from("teacher_messages")
        .update({ is_read: true, read_at: new Date().toISOString(), status: "read" })
        .in("id", messageIds);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, updated: messageIds.length });
    }

    // ─── update_message_status ────────────────────────────────────
    if (action === "update_message_status") {
      const messageId = String(body.message_id || "");
      const status = String(body.status || "");
      const patch: Json = { status };
      if (status === "reviewed") {
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = String(body.reviewed_by || "");
      }
      const { error } = await core.from("teacher_messages").update(patch).eq("id", messageId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ─── list_recipients ──────────────────────────────────────────
    if (action === "list_recipients") {
      const agencyId = String(body.agency_id || "");
      const excludeUserId = String(body.exclude_user_id || "");
      const { data, error } = await core
        .from("user_agency_access")
        .select("user_id")
        .eq("agency_id", agencyId);
      if (error) return json({ error: error.message }, 400);
      const recipients = (data || [])
        .map((row: { user_id: string }) => row.user_id)
        .filter((id: string) => id && id !== excludeUserId);
      return json({ user_ids: Array.from(new Set(recipients)) });
    }

    // ─── send_message ─────────────────────────────────────────────
    if (action === "send_message") {
      const payload = {
        agency_id: String(body.agency_id || ""),
        sender_id: String(body.sender_id || ""),
        recipient_id: String(body.recipient_id || ""),
        message_type: String(body.message_type || "note"),
        subject: body.subject ? String(body.subject) : null,
        body: String(body.body || ""),
        metadata: body.metadata || { app_source: "teacher_hub" },
      } as Record<string, unknown>;

      let result = await core.from("teacher_messages").insert({
        ...payload,
        ...(body.thread_id ? { thread_id: String(body.thread_id) } : {}),
        ...(body.parent_id ? { parent_id: String(body.parent_id) } : {}),
      }).select("id").single();

      if (result.error && String(result.error.message || "").includes("parent_id")) {
        result = await core.from("teacher_messages").insert({
          ...payload,
          ...(body.thread_id ? { thread_id: String(body.thread_id) } : {}),
        }).select("id").single();
      }

      if (result.error) return json({ error: result.error.message }, 400);
      return json({ id: result.data?.id });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
