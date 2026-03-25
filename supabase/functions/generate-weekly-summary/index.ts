import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Nova Core is the authoritative source for clinical data
    const coreUrl = Deno.env.get('VITE_CORE_SUPABASE_URL')!;
    const coreServiceKey = Deno.env.get('CORE_SERVICE_ROLE_KEY')!;
    const core = createClient(coreUrl, coreServiceKey);

    // Lovable Cloud for writing summaries
    const cloudUrl = Deno.env.get('SUPABASE_URL')!;
    const cloudKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloud = createClient(cloudUrl, cloudKey);

    // Calculate current week boundaries (Mon–Fri)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const weekStartTs = weekStart.toISOString();
    const weekEndTs = weekEnd.toISOString();

    // Read clinical data from Nova Core
    const { data: eventPairs } = await core
      .from('teacher_data_events')
      .select('student_id, staff_id, agency_id')
      .gte('recorded_at', weekStartTs)
      .lte('recorded_at', weekEndTs);

    const { data: freqPairs } = await core
      .from('teacher_frequency_entries')
      .select('client_id, user_id, agency_id')
      .gte('logged_date', weekStartStr)
      .lte('logged_date', weekEndStr);

    // Build unique staff+student+agency combos
    const comboMap = new Map<string, { student_id: string; staff_id: string; agency_id: string }>();

    for (const row of (eventPairs || [])) {
      if (row.student_id && row.staff_id && row.agency_id) {
        const key = `${row.staff_id}:${row.student_id}`;
        if (!comboMap.has(key)) {
          comboMap.set(key, { student_id: row.student_id, staff_id: row.staff_id, agency_id: row.agency_id });
        }
      }
    }

    for (const row of (freqPairs || [])) {
      if (row.client_id && row.user_id && row.agency_id) {
        const key = `${row.user_id}:${row.client_id}`;
        if (!comboMap.has(key)) {
          comboMap.set(key, { student_id: row.client_id, staff_id: row.user_id, agency_id: row.agency_id });
        }
      }
    }

    const combos = Array.from(comboMap.values());
    let draftsCreated = 0;
    let draftsSkipped = 0;

    for (const combo of combos) {
      // Check if draft already exists (summaries live on Cloud)
      const { data: existing } = await cloud
        .from('teacher_weekly_summaries')
        .select('summary_id')
        .eq('student_id', combo.student_id)
        .eq('staff_id', combo.staff_id)
        .eq('week_start', weekStartStr)
        .maybeSingle();

      if (existing) {
        draftsSkipped++;
        continue;
      }

      // Aggregate frequency data from Core
      const { data: freqData } = await core
        .from('teacher_frequency_entries')
        .select('behavior_name, count')
        .eq('client_id', combo.student_id)
        .eq('user_id', combo.staff_id)
        .gte('logged_date', weekStartStr)
        .lte('logged_date', weekEndStr);

      const behaviorTotals: Record<string, number> = {};
      for (const f of (freqData || [])) {
        behaviorTotals[f.behavior_name] = (behaviorTotals[f.behavior_name] || 0) + f.count;
      }

      // Aggregate duration data from Core
      const { data: durData } = await core
        .from('teacher_duration_entries')
        .select('behavior_name, duration_seconds')
        .eq('client_id', combo.student_id)
        .eq('user_id', combo.staff_id)
        .gte('logged_date', weekStartStr)
        .lte('logged_date', weekEndStr);

      const durationTotals: Record<string, number> = {};
      for (const d of (durData || [])) {
        durationTotals[d.behavior_name] = (durationTotals[d.behavior_name] || 0) + d.duration_seconds;
      }

      // Aggregate unified events from Core
      const { data: events } = await core
        .from('teacher_data_events')
        .select('event_type, event_subtype, event_value')
        .eq('student_id', combo.student_id)
        .eq('staff_id', combo.staff_id)
        .gte('recorded_at', weekStartTs)
        .lte('recorded_at', weekEndTs);

      // Engagement
      const engagementSamples = (events || []).filter(e => e.event_type === 'engagement_sample');
      const engagedYes = engagementSamples.filter(e => e.event_subtype === 'engaged').length;
      const engagedNo = engagementSamples.filter(e => e.event_subtype === 'not_engaged').length;
      const engagementTotal = engagedYes + engagedNo;

      // Snooze
      const snoozeEvents = (events || []).filter(e => e.event_type === 'snooze_event');

      // ABC patterns
      const abcEvents = (events || []).filter(e => e.event_type === 'abc_event');
      const antecedentFreq: Record<string, number> = {};
      const consequenceFreq: Record<string, number> = {};
      for (const e of abcEvents) {
        const v = e.event_value || {};
        if (v.antecedent) antecedentFreq[v.antecedent] = (antecedentFreq[v.antecedent] || 0) + 1;
        if (v.consequence) consequenceFreq[v.consequence] = (consequenceFreq[v.consequence] || 0) + 1;
      }
      const topAntecedents = Object.entries(antecedentFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
      const topConsequences = Object.entries(consequenceFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);

      // Trigger events
      const triggerEvents = (events || []).filter(e => e.event_type === 'trigger_event');

      // Skill probes
      const probeSummaries = (events || []).filter(e => e.event_type === 'skill_probe' && e.event_subtype === 'session_summary');
      const probeBySkill: Record<string, { trials: number; correct: number; sessions: number }> = {};
      for (const p of probeSummaries) {
        const v = p.event_value || {};
        const name = v.skill_name || 'Unknown';
        if (!probeBySkill[name]) probeBySkill[name] = { trials: 0, correct: 0, sessions: 0 };
        probeBySkill[name].trials += v.trials || 0;
        probeBySkill[name].correct += v.correct || 0;
        probeBySkill[name].sessions += 1;
      }
      const probeResults: Record<string, number> = {};
      for (const [skill, stats] of Object.entries(probeBySkill)) {
        probeResults[skill + '_success'] = stats.trials > 0 ? Math.round((stats.correct / stats.trials) * 100) : 0;
      }

      // Data reliability
      const allDates = new Set<string>();
      for (const f of (freqData || [])) allDates.add(f.logged_date || '');
      for (const d of (durData || [])) allDates.add(d.logged_date || '');
      for (const e of (events || [])) {
        if (e.event_value?.recorded_at) allDates.add(e.event_value.recorded_at.slice(0, 10));
      }
      allDates.delete('');
      const schoolDays = 5;
      const daysWithData = allDates.size;

      // Interval settings from Core
      const { data: intervalSettings } = await core
        .from('teacher_interval_settings')
        .select('interval_minutes')
        .eq('student_id', combo.student_id)
        .eq('user_id', combo.staff_id)
        .maybeSingle();

      const intervalMins = intervalSettings?.interval_minutes || 10;
      const hoursPerDay = 6;
      const expectedPromptsPerDay = Math.floor((hoursPerDay * 60) / intervalMins);
      const expectedPrompts = expectedPromptsPerDay * daysWithData;
      const completedPrompts = engagementTotal;
      const snoozedPrompts = snoozeEvents.length;

      // ── Points / Stars summary from Cloud beacon_points_ledger ──
      const { data: pointsData } = await cloud
        .from('beacon_points_ledger')
        .select('points, source, entry_kind, reason, created_at')
        .eq('student_id', combo.student_id)
        .eq('staff_id', combo.staff_id)
        .gte('created_at', weekStartTs)
        .lte('created_at', weekEndTs);

      const pointsEntries = pointsData || [];
      const totalEarned = pointsEntries.filter((p: any) => p.points > 0).reduce((s: number, p: any) => s + p.points, 0);
      const totalSpent = pointsEntries.filter((p: any) => p.points < 0).reduce((s: number, p: any) => s + Math.abs(p.points), 0);
      const netPoints = pointsEntries.reduce((s: number, p: any) => s + p.points, 0);
      const pointsBySource: Record<string, number> = {};
      for (const p of pointsEntries as any[]) {
        const src = p.source || 'unknown';
        pointsBySource[src] = (pointsBySource[src] || 0) + p.points;
      }

      const pointsSummary = {
        total_earned: totalEarned,
        total_spent: totalSpent,
        net_points: netPoints,
        total_entries: pointsEntries.length,
        by_source: pointsBySource,
      };

      const behaviorSummary = {
        ...behaviorTotals,
        total_events: Object.values(behaviorTotals).reduce((a, b) => a + b, 0),
        days_with_data: daysWithData,
      };

      const engagementSummaryJson = {
        samples_total: engagementTotal,
        engaged_yes: engagedYes,
        engaged_no: engagedNo,
        engagement_percent: engagementTotal > 0 ? Math.round((engagedYes / engagementTotal) * 100 * 10) / 10 : null,
      };

      const abcSummaryJson = {
        total_abc_events: abcEvents.length,
        top_antecedents: topAntecedents,
        top_consequences: topConsequences,
      };

      const triggerSummaryJson = {
        total_trigger_events: triggerEvents.length,
      };

      const durationSummaryJson: Record<string, any> = {};
      for (const [beh, secs] of Object.entries(durationTotals)) {
        durationSummaryJson[beh] = { total_seconds: secs, average_seconds: secs };
      }

      const reliabilitySummaryJson = {
        expected_prompts: expectedPrompts,
        completed_prompts: completedPrompts,
        snoozed_prompts: snoozedPrompts,
        reliability_percent: expectedPrompts > 0 ? Math.round((completedPrompts / expectedPrompts) * 100) : null,
        days_with_data: daysWithData,
        school_days: schoolDays,
      };

      // Write summary to Lovable Cloud (includes points_summary in behavior_summary)
      const { error: insertErr } = await cloud
        .from('teacher_weekly_summaries')
        .insert({
          student_id: combo.student_id,
          staff_id: combo.staff_id,
          agency_id: combo.agency_id,
          week_start: weekStartStr,
          week_end: weekEndStr,
          behavior_summary: { ...behaviorSummary, points_summary: pointsSummary },
          engagement_summary: engagementSummaryJson,
          abc_summary: abcSummaryJson,
          trigger_summary: triggerSummaryJson,
          probe_summary: probeResults,
          duration_summary: durationSummaryJson,
          reliability_summary: reliabilitySummaryJson,
          status: 'draft',
        });

      if (insertErr) {
        console.error(`Failed to create draft for ${combo.staff_id}/${combo.student_id}:`, insertErr.message);
      } else {
        draftsCreated++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        combos_found: combos.length,
        drafts_created: draftsCreated,
        drafts_skipped: draftsSkipped,
        week: `${weekStartStr} to ${weekEndStr}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('generate-weekly-summary error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
