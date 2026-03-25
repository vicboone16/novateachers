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
    // Auth validation — accept either Cloud JWT or external Core JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const cloudUrl = Deno.env.get("SUPABASE_URL")!;
    const cloudAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const coreAuthUrl = Deno.env.get("VITE_CORE_SUPABASE_URL") || "https://yboqqmkghwhlhhnsegje.supabase.co";
    const coreAnonKey = Deno.env.get("VITE_CORE_SUPABASE_ANON_KEY");

    let userId: string | null = null;

    const cloudAuthClient = createClient(cloudUrl, cloudAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: cloudClaims } = await cloudAuthClient.auth.getClaims(token);
    if (cloudClaims?.claims?.sub) {
      userId = String(cloudClaims.claims.sub);
    }

    if (!userId && coreAnonKey) {
      const coreAuthClient = createClient(coreAuthUrl, coreAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: coreClaims } = await coreAuthClient.auth.getClaims(token);
      if (coreClaims?.claims?.sub) {
        userId = String(coreClaims.claims.sub);
      }
    }

    // Final fallback: ask the auth server directly to validate the token
    if (!userId && coreAnonKey) {
      try {
        const authRes = await fetch(`${coreAuthUrl}/auth/v1/user`, {
          headers: {
            Authorization: authHeader,
            apikey: coreAnonKey,
          },
        });
        if (authRes.ok) {
          const authUser = await authRes.json();
          if (authUser?.id) {
            userId = String(authUser.id);
          }
        }
      } catch {
        // fall through
      }
    }

    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    // ─── health_check: detect stale PostgREST cache & connectivity ─
    if (action === "health_check") {
      const checks: { name: string; status: "ok" | "warn" | "error"; detail: string }[] = [];

      // 1. Core connectivity
      const { error: pingErr } = await core.from("teacher_data_events").select("event_id").limit(0);
      if (pingErr) {
        checks.push({ name: "core_connectivity", status: "error", detail: `Cannot reach Core PostgREST: ${pingErr.message}` });
      } else {
        checks.push({ name: "core_connectivity", status: "ok", detail: "Core PostgREST reachable" });
      }

      // 2. PostgREST schema cache freshness — probe known tables for column mismatches
      const probeTests: { table: string; column: string }[] = [
        { table: "teacher_frequency_entries", column: "behavior_name" },
        { table: "teacher_duration_entries", column: "behavior_name" },
        { table: "teacher_quick_notes", column: "note" },
        { table: "abc_logs", column: "antecedent" },
        { table: "teacher_data_events", column: "event_type" },
      ];

      let staleCount = 0;
      const staleDetails: string[] = [];

      for (const probe of probeTests) {
        const { error } = await core.from(probe.table).select(probe.column).limit(0);
        if (error) {
          const msg = String(error.message || "");
          if (msg.includes("does not exist") && error.code === "42P01") {
            // Table genuinely missing — not a cache issue
            continue;
          }
          if (msg.includes("column") || msg.includes("schema cache") || error.code === "42703") {
            staleCount++;
            staleDetails.push(`${probe.table}.${probe.column}: ${msg}`);
          }
        }
      }

      if (staleCount > 0) {
        checks.push({
          name: "postgrest_schema_cache",
          status: "warn",
          detail: `${staleCount} table(s) returning column errors — likely stale PostgREST cache: ${staleDetails.join("; ")}`,
        });
      } else {
        checks.push({ name: "postgrest_schema_cache", status: "ok", detail: "All probed tables have expected columns" });
      }

      // 3. Service role key validity — try information_schema
      const { error: isErr } = await core
        .from("information_schema.columns" as any)
        .select("column_name")
        .eq("table_schema", "public")
        .limit(1);
      if (isErr) {
        checks.push({ name: "service_role_permissions", status: "warn", detail: `information_schema query failed: ${isErr.message}` });
      } else {
        checks.push({ name: "service_role_permissions", status: "ok", detail: "Service role can query information_schema" });
      }

      // 4. Key write tables accessible
      const writeTables = ["teacher_frequency_entries", "teacher_duration_entries", "teacher_quick_notes", "abc_logs"];
      const missingWrite: string[] = [];
      for (const t of writeTables) {
        const { error } = await core.from(t).select("*").limit(0);
        if (error && (error.code === "42P01" || String(error.message).includes("does not exist"))) {
          missingWrite.push(t);
        }
      }
      if (missingWrite.length > 0) {
        checks.push({ name: "write_tables", status: "error", detail: `Missing tables on Core: ${missingWrite.join(", ")}` });
      } else {
        checks.push({ name: "write_tables", status: "ok", detail: "All write target tables exist" });
      }

      const overallStatus = checks.some(c => c.status === "error") ? "error" : checks.some(c => c.status === "warn") ? "warn" : "ok";

      const remediation: string[] = [];
      if (staleCount > 0) {
        remediation.push("Run on the Nova Core database: SELECT pg_notify('pgrst', 'reload schema');");
        remediation.push("Or call core-bridge with action: 'reload_schema' to attempt an automatic refresh.");
      }
      if (missingWrite.length > 0) {
        remediation.push(`Create missing tables on Core: ${missingWrite.join(", ")}. Check sql/ folder for migration scripts.`);
      }
      if (checks.some(c => c.name === "service_role_permissions" && c.status === "warn")) {
        remediation.push("Verify CORE_SERVICE_ROLE_KEY has service_role privileges on the Core instance.");
      }

      return json({
        status: overallStatus,
        checks,
        remediation: remediation.length > 0 ? remediation : ["No issues detected — all systems operational."],
        core_url: coreUrl,
        timestamp: new Date().toISOString(),
      });
    }

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

    // ─── Adaptive insert helper ─────────────────────────────────
    async function adaptiveInsert(table: string, variants: Record<string, unknown>[], selectCol = "id") {
      for (const payload of variants) {
        const res = await core.from(table).insert(payload).select(selectCol).single();
        if (!res.error) return { data: res.data, error: null };
        const msg = String(res.error.message || "");
        if (msg.includes("column") || msg.includes("schema cache") || res.error.code === "42703") continue;
        return { data: null, error: res.error };
      }
      return { data: null, error: { message: `All ${variants.length} column variants failed for ${table}. Run: SELECT pg_notify('pgrst', 'reload schema'); on Core.` } };
    }

    // ─── write_frequency (bridged, schema-adaptive) ───────────────
    if (action === "write_frequency") {
      const uid = String(body.user_id || "");
      const cid = String(body.client_id || "");
      const aid = String(body.agency_id || "");
      const bn = String(body.behavior_name || "");
      const cnt = Number(body.count || 1);
      const ld = String(body.logged_date || new Date().toISOString().slice(0, 10));
      const ex: Record<string, unknown> = {};
      if (body.target_id) ex.target_id = String(body.target_id);
      if (body.notes) ex.notes = String(body.notes);

      const variants = [
        { agency_id: aid, client_id: cid, user_id: uid, behavior_name: bn, count: cnt, logged_date: ld, ...ex },
        { agency_id: aid, client_id: cid, staff_id: uid, behavior_name: bn, count: cnt, logged_date: ld, ...ex },
        { agency_id: aid, client_id: cid, user_id: uid, behavior_name: bn, count: cnt, ...ex },
        { agency_id: aid, client_id: cid, staff_id: uid, behavior_name: bn, count: cnt, ...ex },
        { agency_id: aid, student_id: cid, staff_id: uid, behavior_name: bn, count: cnt, ...ex },
      ];

      const { data, error } = await adaptiveInsert("teacher_frequency_entries", variants);
      if (error) return json({ error: (error as any).message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── write_duration (bridged, schema-adaptive) ────────────────
    if (action === "write_duration") {
      const uid = String(body.user_id || "");
      const cid = String(body.client_id || "");
      const aid = String(body.agency_id || "");
      const bn = String(body.behavior_name || "");
      const ds = Number(body.duration_seconds || 0);
      const ld = String(body.logged_date || new Date().toISOString().slice(0, 10));
      const ex: Record<string, unknown> = {};
      if (body.target_id) ex.target_id = String(body.target_id);
      if (body.notes) ex.notes = String(body.notes);

      const variants = [
        { agency_id: aid, client_id: cid, user_id: uid, behavior_name: bn, duration_seconds: ds, logged_date: ld, ...ex },
        { agency_id: aid, client_id: cid, staff_id: uid, behavior_name: bn, duration_seconds: ds, logged_date: ld, ...ex },
        { agency_id: aid, client_id: cid, user_id: uid, behavior_name: bn, duration_seconds: ds, ...ex },
        { agency_id: aid, client_id: cid, staff_id: uid, behavior_name: bn, duration_seconds: ds, ...ex },
        { agency_id: aid, student_id: cid, staff_id: uid, behavior_name: bn, duration_seconds: ds, ...ex },
      ];

      const { data, error } = await adaptiveInsert("teacher_duration_entries", variants);
      if (error) return json({ error: (error as any).message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── write_abc (bridged, schema-adaptive) ─────────────────────
    if (action === "write_abc") {
      const ex: Record<string, unknown> = {};
      if (body.behavior_category) ex.behavior_category = String(body.behavior_category);
      if (body.notes) ex.notes = String(body.notes);
      if (body.intensity != null) ex.intensity = Number(body.intensity);
      if (body.duration_seconds != null) ex.duration_seconds = Number(body.duration_seconds);
      const ant = String(body.antecedent || "");
      const beh = String(body.behavior || "");
      const con = String(body.consequence || "");

      const variants = [
        { client_id: String(body.client_id || ""), user_id: String(body.user_id || ""), antecedent: ant, behavior: beh, consequence: con, ...ex },
        { client_id: String(body.client_id || ""), staff_id: String(body.user_id || ""), antecedent: ant, behavior: beh, consequence: con, ...ex },
        { student_id: String(body.client_id || ""), staff_id: String(body.user_id || ""), antecedent: ant, behavior: beh, consequence: con, ...ex },
      ];

      const { data, error } = await adaptiveInsert("abc_logs", variants);
      if (error) return json({ error: (error as any).message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── write_event (bridged, schema-adaptive) ───────────────────
    if (action === "write_event") {
      const base: Record<string, unknown> = {
        student_id: String(body.student_id || ""),
        staff_id: String(body.staff_id || ""),
        event_type: String(body.event_type || ""),
      };
      if (body.agency_id) base.agency_id = String(body.agency_id);
      if (body.event_value) base.event_value = body.event_value;
      if (body.source_module) base.source_module = String(body.source_module);
      if (body.metadata) base.metadata = body.metadata;

      const variants = [
        { ...base, ...(body.event_subtype ? { event_subtype: String(body.event_subtype) } : {}) },
        base,
      ];

      const { data, error } = await adaptiveInsert("teacher_data_events", variants, "event_id");
      if (error) return json({ error: (error as any).message }, 400);
      return json({ ok: true, event_id: data?.event_id });
    }

    // ─── write_quick_note (bridged, schema-adaptive) ────────────────
    if (action === "write_quick_note") {
      const uid = String(body.user_id || "");
      const cid = String(body.client_id || "");
      const aid = String(body.agency_id || "");
      const note = String(body.note || "");
      const bn = body.behavior_name ? String(body.behavior_name) : null;
      const ex: Record<string, unknown> = {};
      if (body.target_id) ex.target_id = String(body.target_id);

      const variants = [
        { agency_id: aid, client_id: cid, user_id: uid, note, behavior_name: bn, ...ex },
        { agency_id: aid, client_id: cid, staff_id: uid, note, behavior_name: bn, ...ex },
        { agency_id: aid, student_id: cid, staff_id: uid, note, behavior_name: bn, ...ex },
      ];

      const { data, error } = await adaptiveInsert("teacher_quick_notes", variants);
      if (error) return json({ error: (error as any).message }, 400);
      return json({ ok: true, id: data?.id });
    }

    // ─── list_recent_classroom_events ──────────────────────────────
    if (action === "list_recent_classroom_events") {
      const userId = String(body.user_id || "");
      const agencyId = body.agency_id ? String(body.agency_id) : null;
      const studentIds = Array.isArray(body.student_ids) ? body.student_ids.map(String) : [];
      const limit = Math.min(Number(body.limit || 20), 50);
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      // Try with student_id first, fallback to client_id
      let data: any[] | null = null;
      let queryError: any = null;

      for (const studentCol of ["student_id", "client_id"]) {
        let query = core
          .from("teacher_data_events")
          .select("event_id, " + studentCol + ", event_type, event_value, recorded_at, source_module")
          .eq("staff_id", userId)
          .gte("recorded_at", startOfDay.toISOString())
          .order("recorded_at", { ascending: false })
          .limit(limit);

        if (agencyId) query = query.eq("agency_id", agencyId);
        if (studentIds.length > 0) query = query.in(studentCol, studentIds);

        const result = await query;
        if (!result.error) {
          data = (result.data || []).map((r: any) => ({
            ...r,
            student_id: r.student_id || r.client_id,
          }));
          queryError = null;
          break;
        }
        queryError = result.error;
      }

      if (queryError) return json({ error: queryError.message }, 400);
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
      const buildQuery = () => {
        const q = core.from("teacher_messages").select("*");
        return tab === "sent" ? q.eq("sender_id", userId) : q.eq("recipient_id", userId);
      };
      let result = await buildQuery().is("parent_id", null).order("created_at", { ascending: false });
      if (result.error && String(result.error.message || "").includes("parent_id")) {
        result = await buildQuery().order("created_at", { ascending: false });
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

    // ─── reward CRUD (bypasses Core RLS via service role) ──────────
    if (action === "list_rewards") {
      const scopeType = String(body.scope_type || "agency");
      const scopeId = String(body.scope_id || "");
      const includeInactive = !!body.include_inactive;
      let q = core.from("beacon_rewards").select("*").eq("scope_type", scopeType).eq("scope_id", scopeId).order("cost", { ascending: true });
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ rewards: data || [] });
    }

    if (action === "create_reward") {
      const payload: Record<string, unknown> = {
        scope_type: String(body.scope_type || "agency"),
        scope_id: String(body.scope_id || ""),
        name: String(body.name || ""),
        description: body.description ? String(body.description) : null,
        cost: Number(body.cost || 10),
        active: true,
      };
      if (body.image_url) payload.image_url = String(body.image_url);
      if (body.stock_count != null) payload.stock_count = Number(body.stock_count);
      const { data, error } = await core.from("beacon_rewards").insert(payload).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data?.id });
    }

    if (action === "update_reward") {
      const rewardId = String(body.reward_id || "");
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = String(body.name);
      if (body.description !== undefined) patch.description = body.description ? String(body.description) : null;
      if (body.cost !== undefined) patch.cost = Number(body.cost);
      if (body.active !== undefined) patch.active = !!body.active;
      if (body.stock_count !== undefined) patch.stock_count = body.stock_count != null ? Number(body.stock_count) : null;
      const { error } = await core.from("beacon_rewards").update(patch).eq("id", rewardId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "create_redemption") {
      const payload = {
        student_id: String(body.student_id || ""),
        reward_id: String(body.reward_id || ""),
        agency_id: String(body.agency_id || ""),
        staff_id: String(body.staff_id || ""),
        points_spent: Number(body.points_spent || 0),
        status: "completed",
      };
      const { data, error } = await core.from("beacon_reward_redemptions").insert(payload).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, id: data?.id });
    }

    if (action === "list_redemptions") {
      const agencyId = String(body.agency_id || "");
      const { data, error } = await core.from("beacon_reward_redemptions").select("*").eq("agency_id", agencyId).order("redeemed_at", { ascending: false }).limit(30);
      if (error) return json({ error: error.message }, 400);
      return json({ redemptions: data || [] });
    }

    // ─── reload_schema: trigger PostgREST schema cache reload on Core ─
    if (action === "reload_schema") {
      const { error } = await core.rpc("pg_notify" as any, { channel: "pgrst", payload: "reload schema" }).maybeSingle();
      // If RPC doesn't exist, try raw SQL via a custom function — just report status
      if (error) {
        return json({ 
          warning: "pg_notify RPC not available. Run SELECT pg_notify('pgrst', 'reload schema'); manually on Core.",
          error: error.message 
        });
      }
      return json({ ok: true, message: "PostgREST schema cache reload triggered on Core" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
