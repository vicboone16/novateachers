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

    // ─── diagnose_schema (uses information_schema for real columns) ─
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

      // Use information_schema to get real column names even for empty tables
      const { data: allCols, error: colsErr } = await core
        .from("information_schema.columns" as any)
        .select("table_name, column_name")
        .eq("table_schema", "public")
        .in("table_name", targetTables);

      // Fallback: if information_schema query fails, use the old method
      if (colsErr) {
        // Try RPC approach or fall back to select * limit 0
        for (const table of targetTables) {
          try {
            const { data, error } = await core.from(table).select("*").limit(1);
            if (error) {
              if (String(error.code) === "42P01" || String(error.message).includes("does not exist")) {
                results[table] = { exists: false };
              } else {
                results[table] = { exists: true, columns: [], error: error.message };
              }
            } else {
              const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
              results[table] = { exists: true, columns };
            }
          } catch (err) {
            results[table] = { exists: false, error: String(err) };
          }
        }
      } else {
        // Build column map from information_schema
        const colMap: Record<string, string[]> = {};
        for (const row of (allCols || []) as { table_name: string; column_name: string }[]) {
          if (!colMap[row.table_name]) colMap[row.table_name] = [];
          colMap[row.table_name].push(row.column_name);
        }
        for (const table of targetTables) {
          if (colMap[table]) {
            results[table] = { exists: true, columns: colMap[table].sort() };
          } else {
            // Check if table exists but wasn't in information_schema (permissions)
            const { error } = await core.from(table).select("*").limit(0);
            if (error) {
              if (String(error.code) === "42P01" || String(error.message).includes("does not exist")) {
                results[table] = { exists: false };
              } else {
                results[table] = { exists: true, columns: [], error: error.message };
              }
            } else {
              results[table] = { exists: true, columns: [] };
            }
          }
        }
      }

      // Check RPCs
      const rpcs = ["insert_event", "create_supervisor_signal"];
      const rpcResults: Record<string, { available: boolean; error?: string }> = {};
      for (const fn of rpcs) {
        try {
          const { error } = await core.rpc(fn, {});
          if (error && String(error.message).includes("does not exist")) {
            rpcResults[fn] = { available: false };
          } else {
            rpcResults[fn] = { available: true, error: error?.message };
          }
        } catch (err) {
          rpcResults[fn] = { available: false, error: String(err) };
        }
      }

      return json({
        tables: results,
        rpcs: rpcResults,
        core_url: coreUrl,
        note: "If tables show 0 columns via information_schema, the service role may lack access to information_schema. Run: NOTIFY pgrst, 'reload schema'; on Core to refresh the PostgREST cache for newly created tables.",
      });
    }

    // ─── write_frequency (bridged insert for iOS, schema-adaptive) ─
    if (action === "write_frequency") {
      const base: Record<string, unknown> = {
        agency_id: String(body.agency_id || ""),
        client_id: String(body.client_id || ""),
        user_id: String(body.user_id || ""),
        behavior_name: String(body.behavior_name || ""),
        count: Number(body.count || 1),
        ...(body.target_id ? { target_id: String(body.target_id) } : {}),
        ...(body.notes ? { notes: String(body.notes) } : {}),
      };
      const loggedDate = String(body.logged_date || new Date().toISOString().slice(0, 10));

      // Try with logged_date first, then without (Core schema cache may not have it)
      let res = await core.from("teacher_frequency_entries").insert({ ...base, logged_date: loggedDate }).select("id").single();
      if (res.error && String(res.error.message).includes("logged_date")) {
        res = await core.from("teacher_frequency_entries").insert(base).select("id").single();
      }

      if (res.error) return json({ error: res.error.message }, 400);
      return json({ ok: true, id: res.data?.id });
    }

    // ─── write_duration (bridged insert for iOS) ──────────────────
    if (action === "write_duration") {
      const payload = {
        agency_id: String(body.agency_id || ""),
        client_id: String(body.client_id || ""),
        user_id: String(body.user_id || ""),
        behavior_name: String(body.behavior_name || ""),
        duration_seconds: Number(body.duration_seconds || 0),
        logged_date: String(body.logged_date || new Date().toISOString().slice(0, 10)),
        ...(body.target_id ? { target_id: String(body.target_id) } : {}),
        ...(body.notes ? { notes: String(body.notes) } : {}),
      };

      const { data, error } = await core
        .from("teacher_duration_entries")
        .insert(payload)
        .select("id")
        .single();

      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── write_abc (bridged insert for iOS) ───────────────────────
    if (action === "write_abc") {
      const payload = {
        client_id: String(body.client_id || ""),
        user_id: String(body.user_id || ""),
        antecedent: String(body.antecedent || ""),
        behavior: String(body.behavior || ""),
        consequence: String(body.consequence || ""),
        ...(body.behavior_category ? { behavior_category: String(body.behavior_category) } : {}),
        ...(body.notes ? { notes: String(body.notes) } : {}),
        ...(body.intensity != null ? { intensity: Number(body.intensity) } : {}),
        ...(body.duration_seconds != null ? { duration_seconds: Number(body.duration_seconds) } : {}),
      };

      const { data, error } = await core
        .from("abc_logs")
        .insert(payload)
        .select("id")
        .single();

      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── write_event (bridged unified event insert) ───────────────
    if (action === "write_event") {
      const payload: Record<string, unknown> = {
        student_id: String(body.student_id || ""),
        staff_id: String(body.staff_id || ""),
        event_type: String(body.event_type || ""),
        ...(body.agency_id ? { agency_id: String(body.agency_id) } : {}),
        ...(body.event_subtype ? { event_subtype: String(body.event_subtype) } : {}),
        ...(body.event_value ? { event_value: body.event_value } : {}),
        ...(body.source_module ? { source_module: String(body.source_module) } : {}),
        ...(body.metadata ? { metadata: body.metadata } : {}),
      };

      const { data, error } = await core
        .from("teacher_data_events")
        .insert(payload)
        .select("event_id")
        .single();

      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, event_id: data?.event_id });
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

    // ─── seed_teacher_events (schema-adaptive + PostgREST note) ───
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
      const steps: { step: string; ok: boolean; error?: string; variant?: string }[] = [];

      // Step 1: teacher_frequency_entries
      const freqPayloads = [
        { v: "client_id+user_id", p: { agency_id: agencyId, client_id: studentId, user_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate } },
        { v: "student_id+user_id", p: { agency_id: agencyId, student_id: studentId, user_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate } },
        { v: "client_id+staff_id", p: { agency_id: agencyId, client_id: studentId, staff_id: userId, behavior_name: behavior, count: 1, logged_date: loggedDate } },
      ];

      let freqOk = false;
      for (const { v, p } of freqPayloads) {
        const { error } = await core.from("teacher_frequency_entries").insert(p);
        if (!error) {
          steps.push({ step: "teacher_frequency_entries", ok: true, variant: v });
          freqOk = true;
          break;
        }
        if (String(error.message).includes("column") || String(error.code) === "42703") continue;
        steps.push({ step: "teacher_frequency_entries", ok: false, error: error.message, variant: v });
        break;
      }
      if (!freqOk && steps.filter(s => s.step === "teacher_frequency_entries").length === 0) {
        steps.push({ step: "teacher_frequency_entries", ok: false, error: "All column variants rejected. Run NOTIFY pgrst, 'reload schema'; on Core if tables were recently created." });
      }

      // Step 2: abc_logs
      const abcPayloads = [
        { v: "client_id+user_id", p: { client_id: studentId, user_id: userId, antecedent: "Transition", behavior, consequence: "Redirected", behavior_category: behavior, notes: "Seeded", logged_at: abcAt } },
        { v: "student_id+user_id", p: { student_id: studentId, user_id: userId, antecedent: "Transition", behavior, consequence: "Redirected", behavior_category: behavior, notes: "Seeded", logged_at: abcAt } },
        { v: "client_id+staff_id", p: { client_id: studentId, staff_id: userId, antecedent: "Transition", behavior, consequence: "Redirected", behavior_category: behavior, notes: "Seeded", logged_at: abcAt } },
      ];

      let abcOk = false;
      for (const { v, p } of abcPayloads) {
        const { error } = await core.from("abc_logs").insert(p);
        if (!error) {
          steps.push({ step: "abc_logs", ok: true, variant: v });
          abcOk = true;
          break;
        }
        if (String(error.message).includes("column") || String(error.code) === "42703") continue;
        steps.push({ step: "abc_logs", ok: false, error: error.message, variant: v });
        break;
      }
      if (!abcOk && steps.filter(s => s.step === "abc_logs").length === 0) {
        steps.push({ step: "abc_logs", ok: false, error: "All variants rejected — check RLS allows service_role inserts, or run NOTIFY pgrst, 'reload schema';" });
      }

      // Step 3: teacher_data_events
      const baseEvent = {
        student_id: studentId,
        staff_id: userId,
        agency_id: agencyId,
        event_type: "behavior_event",
        event_value: { behavior, count: 1, seeded: true },
        source_module: "core_bridge_seed",
        metadata: { seeded: true },
        recorded_at: behaviorAt,
      };

      const eventVariants = [
        { v: "with_event_subtype", rows: [{ ...baseEvent, event_subtype: "frequency" }] },
        { v: "without_event_subtype", rows: [baseEvent] },
      ];

      let eventsOk = false;
      for (const { v, rows } of eventVariants) {
        const { error } = await core.from("teacher_data_events").insert(rows);
        if (!error) {
          steps.push({ step: "teacher_data_events", ok: true, variant: v });
          eventsOk = true;
          break;
        }
        if (String(error.message).includes("column") || String(error.message).includes("schema cache")) continue;
        steps.push({ step: "teacher_data_events", ok: false, error: error.message, variant: v });
        break;
      }
      if (!eventsOk && steps.filter(s => s.step === "teacher_data_events").length === 0) {
        steps.push({ step: "teacher_data_events", ok: false, error: "All variants rejected" });
      }

      const allOk = steps.every(s => s.ok);

      return json({
        ok: allOk,
        steps,
        seeded: { student_id: studentId, user_id: userId, agency_id: agencyId, behavior_timestamp: behaviorAt, abc_timestamp: abcAt },
        postgrest_hint: allOk ? null : "If Core tables were recently created or altered, run on the Core database: SELECT pg_notify('pgrst', 'reload schema'); — This forces PostgREST to refresh its schema cache.",
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
