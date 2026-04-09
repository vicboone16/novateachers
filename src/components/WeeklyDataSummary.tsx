import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName } from '@/lib/student-utils';
import { resolveDisplayNames } from '@/lib/resolve-names';
import { Send, BarChart3, Clock, StickyNote, CalendarDays, Users, Target, Bell, ShieldCheck, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import type { Client } from '@/lib/types';
import { WeeklyTrendCharts } from '@/components/WeeklyTrendCharts';

interface WeeklySummaryDraft {
  summary_id: string;
  student_id: string;
  week_start: string;
  week_end: string;
  behavior_summary: any;
  engagement_summary: any;
  abc_summary: any;
  trigger_summary: any;
  probe_summary: any;
  duration_summary: any;
  reliability_summary: any;
  status: string;
  generated_at: string;
  sent_at: string | null;
}

interface FreqEntry { behavior_name: string; count: number; logged_date: string; }
interface DurEntry { behavior_name: string; duration_seconds: number; logged_date: string; }
interface QuickNote { behavior_name: string | null; note: string; logged_at: string; }
interface ABCEntry { antecedent: string; behavior: string; consequence: string; logged_at: string; }
interface UnifiedEvent { event_type: string; event_subtype?: string | null; event_value: any; recorded_at: string; }

export const WeeklyDataSummary = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId, resolvedUser } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [freqEntries, setFreqEntries] = useState<FreqEntry[]>([]);
  const [durEntries, setDurEntries] = useState<DurEntry[]>([]);
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [abcLogs, setAbcLogs] = useState<ABCEntry[]>([]);
  const [unifiedEvents, setUnifiedEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [assignedStaff, setAssignedStaff] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [draft, setDraft] = useState<WeeklySummaryDraft | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const weekStart = useMemo(() => {
    const ref = subWeeks(new Date(), weekOffset);
    return startOfWeek(ref, { weekStartsOn: 1 });
  }, [weekOffset]);
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedClientId) {
      loadWeekData();
      loadAssignedStaff();
      loadDraft();
    }
  }, [selectedClientId, weekOffset]);

  const loadDraft = async () => {
    if (!selectedClientId || !user) return;
    setLoadingDraft(true);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('teacher_weekly_summaries')
      .select('*')
      .eq('student_id', selectedClientId)
      .eq('week_start', weekStartStr)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setDraft(data as WeeklySummaryDraft | null);
    setLoadingDraft(false);
  };

  const regenerateDraft = async () => {
    setRegenerating(true);
    try {
      await invokeCloudFunction('generate-weekly-summary', { time: new Date().toISOString() });
      await loadDraft();
      toast({ title: '✓ Summary regenerated' });
    } catch (err: any) {
      toast({ title: 'Error regenerating', description: err.message, variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* silent */ }
  };

  const loadAssignedStaff = async () => {
    if (!selectedClientId) return;
    setLoadingStaff(true);
    setAssignedStaff([]);
    setSelectedRecipients([]);

    try {
      let staffIds: string[] = [];

      // Try student_id column first, then client_id fallback
      const { data: accessRows, error: accessErr } = await supabase
        .from('user_student_access')
        .select('user_id')
        .eq('student_id', selectedClientId)
        .neq('user_id', user?.id || '');

      if (!accessErr && accessRows && accessRows.length > 0) {
        staffIds = accessRows.map((r: any) => r.user_id);
      } else {
        // Fallback: try client_id column
        const { data: fallback1 } = await supabase
          .from('user_student_access')
          .select('user_id')
          .eq('client_id', selectedClientId)
          .neq('user_id', user?.id || '');
        if (fallback1 && fallback1.length > 0) {
          staffIds = fallback1.map((r: any) => r.user_id);
        } else {
          // Last resort: classroom group teachers
          const { data: groupRow } = await cloudSupabase
            .from('classroom_group_students')
            .select('group_id')
            .eq('client_id', selectedClientId)
            .limit(1)
            .maybeSingle();
          if (groupRow?.group_id) {
            const { data: teachers } = await cloudSupabase
              .from('classroom_group_teachers')
              .select('user_id')
              .eq('group_id', groupRow.group_id)
              .neq('user_id', user?.id || '');
            staffIds = (teachers || []).map((r: any) => r.user_id);
          }
        }
      }

      if (staffIds.length === 0) {
        setLoadingStaff(false);
        return;
      }

      const nameMap = await resolveDisplayNames(staffIds);
      const staff = staffIds.map(id => ({
        id,
        name: nameMap.get(id) || 'Staff Member',
      }));

      setAssignedStaff(staff);
      setSelectedRecipients(staffIds);
    } catch {
      /* silent */
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadWeekData = async () => {
    setLoading(true);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    const startTs = weekStart.toISOString();
    const endTs = weekEnd.toISOString();

    // Load ALL staff data for this student (not just current user)
    const [freqRes, durRes, notesRes, abcRes, unifiedRes] = await Promise.all([
      supabase.from('teacher_frequency_entries').select('behavior_name,count,logged_date')
        .eq('client_id', selectedClientId)
        .gte('logged_date', startStr).lte('logged_date', endStr),
      supabase.from('teacher_duration_entries').select('behavior_name,duration_seconds,logged_date')
        .eq('client_id', selectedClientId)
        .gte('logged_date', startStr).lte('logged_date', endStr),
      supabase.from('teacher_quick_notes').select('behavior_name,note,logged_at')
        .eq('client_id', selectedClientId)
        .gte('logged_at', startTs).lte('logged_at', endTs),
      supabase.from('abc_logs').select('antecedent,behavior,consequence,logged_at')
        .eq('client_id', selectedClientId)
        .gte('logged_at', startTs).lte('logged_at', endTs),
      cloudSupabase.from('teacher_data_events').select('event_type,event_subtype,event_value,recorded_at')
        .eq('student_id', selectedClientId)
        .gte('recorded_at', startTs).lte('recorded_at', endTs),
    ]);

    setFreqEntries((freqRes.data || []) as FreqEntry[]);
    setDurEntries((durRes.data || []) as DurEntry[]);
    setNotes((notesRes.data || []) as QuickNote[]);
    setAbcLogs((abcRes.data || []) as ABCEntry[]);
    setUnifiedEvents((unifiedRes.data || []) as UnifiedEvent[]);
    setLoading(false);
  };

  // ── Aggregations ──

  const freqByBehavior = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of freqEntries) {
      if (!map[e.behavior_name]) map[e.behavior_name] = {};
      map[e.behavior_name][e.logged_date] = (map[e.behavior_name][e.logged_date] || 0) + e.count;
    }
    return map;
  }, [freqEntries]);

  const durByBehavior = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of durEntries) {
      map[e.behavior_name] = (map[e.behavior_name] || 0) + e.duration_seconds;
    }
    return map;
  }, [durEntries]);

  const abcPatterns = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of abcLogs) {
      const key = `${e.antecedent} → ${e.behavior} → ${e.consequence}`;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [abcLogs]);

  // Engagement stats from unified events
  const engagementStats = useMemo(() => {
    const samples = unifiedEvents.filter(e => e.event_type === 'engagement_sample');
    const engaged = samples.filter(e => e.event_subtype === 'engaged' || e.event_value?.subtype === 'engaged' || e.event_value?.engaged === true).length;
    const total = samples.length;
    return { total, engaged, percentage: total > 0 ? Math.round((engaged / total) * 100) : null };
  }, [unifiedEvents]);

  // Skill probe stats from unified events
  const skillProbeStats = useMemo(() => {
    const summaries = unifiedEvents.filter(
      e => e.event_type === 'skill_probe' && (e.event_subtype === 'session_summary' || e.event_value?.subtype === 'session_summary')
    );
    const bySkill: Record<string, { trials: number; correct: number; sessions: number }> = {};
    for (const s of summaries) {
      const v = s.event_value || {};
      const name = v.skill_name || 'Unknown';
      if (!bySkill[name]) bySkill[name] = { trials: 0, correct: 0, sessions: 0 };
      bySkill[name].trials += v.trials || 0;
      bySkill[name].correct += v.correct || 0;
      bySkill[name].sessions += 1;
    }
    return bySkill;
  }, [unifiedEvents]);

  // Behavior event hourly rates from unified events
  const behaviorHourlyRates = useMemo(() => {
    const behaviorEvents = unifiedEvents.filter(e => e.event_type === 'behavior_event' || e.event_type === 'trigger_event');
    if (behaviorEvents.length === 0) return null;

    // Group by day, count events, estimate observation hours (8am-3pm = 7hrs)
    const byDay: Record<string, number> = {};
    for (const e of behaviorEvents) {
      const day = format(new Date(e.recorded_at), 'yyyy-MM-dd');
      byDay[day] = (byDay[day] || 0) + 1;
    }
    const totalDays = Object.keys(byDay).length;
    const totalEvents = Object.values(byDay).reduce((a, b) => a + b, 0);
    const estimatedHours = totalDays * 7; // ~7 instructional hours per day
    return {
      totalEvents,
      totalDays,
      hourlyRate: estimatedHours > 0 ? (totalEvents / estimatedHours).toFixed(1) : '—',
    };
  }, [unifiedEvents]);

  // Data reliability score (based on collection consistency)
  const reliabilityScore = useMemo(() => {
    // Simple heuristic: % of school days with at least one data point
    const allDates = new Set<string>();
    freqEntries.forEach(e => allDates.add(e.logged_date));
    durEntries.forEach(e => allDates.add(e.logged_date));
    abcLogs.forEach(e => allDates.add(format(new Date(e.logged_at), 'yyyy-MM-dd')));
    unifiedEvents.forEach(e => allDates.add(format(new Date(e.recorded_at), 'yyyy-MM-dd')));

    const daysWithData = allDates.size;
    const schoolDays = 5; // Mon–Fri
    const pct = Math.min(100, Math.round((daysWithData / schoolDays) * 100));
    return { daysWithData, schoolDays, percentage: pct };
  }, [freqEntries, durEntries, abcLogs, unifiedEvents]);

  const hasData = freqEntries.length > 0 || durEntries.length > 0 || notes.length > 0 || abcLogs.length > 0 || unifiedEvents.length > 0;

  const buildSummaryBody = () => {
    const student = clients.find(c => c.id === selectedClientId);
    const name = student ? displayName(student) : 'Student';
    const lines: string[] = [`📊 Weekly Data Summary for ${name}`, `📅 ${weekLabel}`, ''];

    // Data reliability
    lines.push(`── Data Reliability Score ──`);
    lines.push(`• ${reliabilityScore.percentage}% — Data collected on ${reliabilityScore.daysWithData}/${reliabilityScore.schoolDays} school days`);
    lines.push('');

    // Behavior totals & hourly rates
    if (behaviorHourlyRates) {
      lines.push('── Behavior Event Summary ──');
      lines.push(`• Total events: ${behaviorHourlyRates.totalEvents}`);
      lines.push(`• Days with data: ${behaviorHourlyRates.totalDays}`);
      lines.push(`• Estimated hourly rate: ${behaviorHourlyRates.hourlyRate}/hr`);
      lines.push('');
    }

    if (Object.keys(freqByBehavior).length > 0) {
      lines.push('── Frequency Counts ──');
      for (const [beh, days] of Object.entries(freqByBehavior)) {
        const total = Object.values(days).reduce((a, b) => a + b, 0);
        lines.push(`• ${beh}: ${total} total`);
        for (const [day, count] of Object.entries(days)) {
          lines.push(`   ${format(new Date(day + 'T12:00:00'), 'EEE MMM d')}: ${count}`);
        }
      }
      lines.push('');
    }

    if (Object.keys(durByBehavior).length > 0) {
      lines.push('── Duration Totals ──');
      for (const [beh, secs] of Object.entries(durByBehavior)) {
        const mins = Math.floor(secs / 60);
        const s = secs % 60;
        lines.push(`• ${beh}: ${mins}m ${s}s total`);
      }
      lines.push('');
    }

    // Engagement
    if (engagementStats.total > 0) {
      lines.push('── Engagement Sampling ──');
      lines.push(`• ${engagementStats.percentage}% engaged (${engagementStats.engaged}/${engagementStats.total} samples)`);
      lines.push('');
    }

    // Skill probes
    const skillEntries = Object.entries(skillProbeStats);
    if (skillEntries.length > 0) {
      lines.push('── Skill Probe Results ──');
      for (const [skill, stats] of skillEntries) {
        const pct = stats.trials > 0 ? Math.round((stats.correct / stats.trials) * 100) : 0;
        lines.push(`• ${skill}: ${pct}% (${stats.correct}/${stats.trials} trials across ${stats.sessions} sessions)`);
      }
      lines.push('');
    }

    // Trigger tracker / ABC patterns
    if (abcPatterns.length > 0) {
      lines.push('── ABC Pattern Summaries ──');
      for (const [pattern, count] of abcPatterns) {
        lines.push(`• ${pattern} (×${count})`);
      }
      lines.push('');
    }

    if (notes.length > 0) {
      lines.push('── Teacher Notes ──');
      for (const n of notes) {
        const ts = format(new Date(n.logged_at), 'EEE h:mm a');
        lines.push(`• [${ts}] ${n.note}${n.behavior_name ? ` (re: ${n.behavior_name})` : ''}`);
      }
    }

    return lines.join('\n');
  };

  const sendSummaryToBCBA = async () => {
    if (!hasData) return;

    const recipients = selectedRecipients.length > 0 ? selectedRecipients : [user?.id!];
    const body = buildSummaryBody();
    const student = clients.find(c => c.id === selectedClientId);
    const studentName = student ? displayName(student) : 'Student';
    const subject = `Weekly Data Summary: ${studentName} (${weekLabel})`;
    const metadata = { app_source: 'teacher_hub', week_start: weekStart.toISOString(), week_end: weekEnd.toISOString() };

    setSending(true);
    try {
      const inserts = recipients.map(recipientId => ({
        agency_id: agencyId || currentWorkspace?.agency_id,
        sender_id: user?.id,
        recipient_id: recipientId,
        client_id: selectedClientId,
        subject,
        body,
        message_type: 'data_summary',
        metadata,
      }));

      const { error } = await supabase.from('teacher_messages').insert(inserts);
      if (error) throw error;

      // Mark draft as sent if it exists
      if (draft) {
        await supabase
          .from('teacher_weekly_summaries')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_to: recipients,
          } as any)
          .eq('summary_id', draft.summary_id);
        await loadDraft();
      }

      const recipientNames = recipients
        .map(id => assignedStaff.find(s => s.id === id)?.name || 'your Inbox')
        .join(', ');
      toast({ title: '✓ Summary sent', description: `Sent to ${recipientNames}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight font-heading">Data Summary</h2>
        <p className="text-sm text-muted-foreground">Weekly aggregation of Student Data</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select student…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>{displayName(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setWeekOffset(w => w + 1)} className="text-xs">
            ← Prev
          </Button>
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="h-3 w-3" />
            {weekLabel}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="text-xs">
            Next →
          </Button>
        </div>
      </div>

      {/* Auto-Draft Review Card */}
      {selectedClientId && draft && (
        <Card className={`border-2 ${draft.status === 'sent' ? 'border-accent/30 bg-accent/5' : 'border-primary/30 bg-primary/5'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {draft.status === 'sent' ? 'Weekly Summary — Sent' : 'Auto-Draft Ready for Review'}
              </CardTitle>
              <div className="flex items-center gap-2">
                {draft.status === 'sent' ? (
                  <Badge variant="default" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Sent {draft.sent_at ? format(new Date(draft.sent_at), 'MMM d h:mm a') : ''}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <FileText className="h-3 w-3" /> Draft
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={regenerateDraft}
                  disabled={regenerating}
                >
                  <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
                  {regenerating ? 'Regenerating…' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Generated {format(new Date(draft.generated_at), 'EEE MMM d, h:mm a')} · Week of {draft.week_start} – {draft.week_end}
            </p>

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {/* Behavior totals */}
              {draft.behavior_summary?.total_events != null && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Behaviors</p>
                  <p className="text-lg font-bold text-foreground">{draft.behavior_summary.total_events}</p>
                  <p className="text-[10px] text-muted-foreground">{draft.behavior_summary.days_with_data || 0} days</p>
                </div>
              )}

              {/* Engagement */}
              {draft.engagement_summary?.engagement_percent != null && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Engagement</p>
                  <p className="text-lg font-bold text-foreground">{draft.engagement_summary.engagement_percent}%</p>
                  <p className="text-[10px] text-muted-foreground">{draft.engagement_summary.samples_total} samples</p>
                </div>
              )}

              {/* Reliability */}
              {draft.reliability_summary?.reliability_percent != null && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reliability</p>
                  <p className="text-lg font-bold text-foreground">{draft.reliability_summary.reliability_percent}%</p>
                  <p className="text-[10px] text-muted-foreground">{draft.reliability_summary.snoozed_prompts || 0} snoozed</p>
                </div>
              )}

              {/* ABC */}
              {draft.abc_summary?.total_abc_events > 0 && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">ABC Events</p>
                  <p className="text-lg font-bold text-foreground">{draft.abc_summary.total_abc_events}</p>
                  {draft.abc_summary.top_antecedents?.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">Top: {draft.abc_summary.top_antecedents[0]}</p>
                  )}
                </div>
              )}

              {/* Probes */}
              {Object.keys(draft.probe_summary || {}).length > 0 && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Skill Probes</p>
                  {Object.entries(draft.probe_summary).slice(0, 2).map(([skill, pct]) => (
                    <p key={skill} className="text-xs text-foreground">
                      {skill.replace('_success', '')}: <span className="font-semibold">{String(pct)}%</span>
                    </p>
                  ))}
                </div>
              )}

              {/* Trigger */}
              {draft.trigger_summary?.total_trigger_events > 0 && (
                <div className="rounded-lg border border-border/50 p-2.5 bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Triggers</p>
                  <p className="text-lg font-bold text-foreground">{draft.trigger_summary.total_trigger_events}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !selectedClientId ? (
        <p className="text-sm text-muted-foreground">Select a student to view weekly data.</p>
      ) : !hasData && !draft ? (
        <p className="text-sm text-muted-foreground">No data for this week.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Data Reliability Score */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Data Reliability Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className={`text-3xl font-bold ${reliabilityScore.percentage >= 80 ? 'text-accent' : reliabilityScore.percentage >= 60 ? 'text-primary' : 'text-destructive'}`}>
                  {reliabilityScore.percentage}%
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Data collected on {reliabilityScore.daysWithData} of {reliabilityScore.schoolDays} school days
                  </p>
                  {behaviorHourlyRates && (
                    <p className="text-xs text-muted-foreground">
                      {behaviorHourlyRates.totalEvents} behavior events · ~{behaviorHourlyRates.hourlyRate}/hr
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Sampling */}
          {engagementStats.total > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-primary" /> Engagement Sampling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${(engagementStats.percentage || 0) >= 70 ? 'text-accent' : 'text-primary'}`}>
                    {engagementStats.percentage}%
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {engagementStats.engaged}/{engagementStats.total} samples engaged
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill Probes */}
          {Object.keys(skillProbeStats).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-primary" /> Skill Probe Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(skillProbeStats).map(([skill, stats]) => {
                  const pct = stats.trials > 0 ? Math.round((stats.correct / stats.trials) * 100) : 0;
                  return (
                    <div key={skill}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{skill}</span>
                        <Badge variant={pct >= 80 ? 'default' : 'outline'}>{pct}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.correct}/{stats.trials} trials · {stats.sessions} session{stats.sessions !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Frequency */}
          {Object.keys(freqByBehavior).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" /> Frequency Counts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(freqByBehavior).map(([beh, days]) => {
                  const total = Object.values(days).reduce((a, b) => a + b, 0);
                  return (
                    <div key={beh}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{beh}</span>
                        <Badge variant="outline">{total} total</Badge>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {Object.entries(days).map(([day, count]) => (
                          <Badge key={day} variant="secondary" className="text-[10px]">
                            {format(new Date(day + 'T12:00:00'), 'EEE')}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Duration */}
          {Object.keys(durByBehavior).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> Duration Totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(durByBehavior).map(([beh, secs]) => (
                  <div key={beh} className="flex justify-between text-sm">
                    <span>{beh}</span>
                    <Badge variant="outline">{Math.floor(secs / 60)}m {secs % 60}s</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ABC Patterns */}
          {abcPatterns.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-destructive" /> ABC Patterns
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {abcPatterns.map(([pattern, count]) => (
                  <div key={pattern} className="flex justify-between text-sm gap-2">
                    <span className="text-xs text-muted-foreground truncate">{pattern}</span>
                    <Badge variant="secondary">×{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-primary" /> Notes ({notes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notes.slice(0, 5).map((n, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-xs text-muted-foreground">{format(new Date(n.logged_at), 'EEE h:mm a')}</span>
                    <p>{n.note}</p>
                  </div>
                ))}
                {notes.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{notes.length - 5} more</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Multi-Week Trend Charts */}
      {selectedClientId && (
        <WeeklyTrendCharts studentId={selectedClientId} />
      )}

      {hasData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Send To
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingStaff ? (
              <p className="text-sm text-muted-foreground">Loading assigned staff…</p>
            ) : assignedStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other staff assigned to this student. Summaries will be saved to your Inbox.
              </p>
            ) : (
              <div className="space-y-2">
                {assignedStaff.map(staff => (
                  <div key={staff.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`staff-${staff.id}`}
                      checked={selectedRecipients.includes(staff.id)}
                      onCheckedChange={(checked) => {
                        setSelectedRecipients(prev =>
                          checked
                            ? [...prev, staff.id]
                            : prev.filter(id => id !== staff.id)
                        );
                      }}
                    />
                    <Label htmlFor={`staff-${staff.id}`} className="text-sm cursor-pointer">
                      {staff.name}
                    </Label>
                  </div>
                ))}
                {assignedStaff.length > 1 && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedRecipients(assignedStaff.map(s => s.id))}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedRecipients([])}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={sendSummaryToBCBA}
              disabled={sending || (assignedStaff.length > 0 && selectedRecipients.length === 0)}
              className="gap-1.5 w-full"
            >
              <Send className="h-4 w-4" />
              {assignedStaff.length === 0
                ? 'Save Summary to Inbox'
                : `Send to ${selectedRecipients.length} recipient${selectedRecipients.length !== 1 ? 's' : ''}`
              }
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
