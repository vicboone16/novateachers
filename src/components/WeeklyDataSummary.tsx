import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Send, BarChart3, Clock, StickyNote, CalendarDays, Users } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import type { Client } from '@/lib/types';

interface FreqEntry { behavior_name: string; count: number; logged_date: string; }
interface DurEntry { behavior_name: string; duration_seconds: number; logged_date: string; }
interface QuickNote { behavior_name: string | null; note: string; logged_at: string; }
interface ABCEntry { antecedent: string; behavior: string; consequence: string; logged_at: string; }

export const WeeklyDataSummary = () => {
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId, resolvedUser } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current, 1 = last week, etc.
  const [freqEntries, setFreqEntries] = useState<FreqEntry[]>([]);
  const [durEntries, setDurEntries] = useState<DurEntry[]>([]);
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [abcLogs, setAbcLogs] = useState<ABCEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [assignedStaff, setAssignedStaff] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

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
    }
  }, [selectedClientId, weekOffset]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* silent */ }
  };

  const loadWeekData = async () => {
    setLoading(true);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(weekEnd, 'yyyy-MM-dd');
    const startTs = weekStart.toISOString();
    const endTs = weekEnd.toISOString();

    const [freqRes, durRes, notesRes, abcRes] = await Promise.all([
      supabase.from('teacher_frequency_entries').select('behavior_name,count,logged_date')
        .eq('client_id', selectedClientId).eq('user_id', user?.id)
        .gte('logged_date', startStr).lte('logged_date', endStr),
      supabase.from('teacher_duration_entries').select('behavior_name,duration_seconds,logged_date')
        .eq('client_id', selectedClientId).eq('user_id', user?.id)
        .gte('logged_date', startStr).lte('logged_date', endStr),
      supabase.from('teacher_quick_notes').select('behavior_name,note,logged_at')
        .eq('client_id', selectedClientId).eq('user_id', user?.id)
        .gte('logged_at', startTs).lte('logged_at', endTs),
      supabase.from('abc_logs').select('antecedent,behavior,consequence,logged_at')
        .eq('client_id', selectedClientId).eq('user_id', user?.id)
        .gte('logged_at', startTs).lte('logged_at', endTs),
    ]);

    setFreqEntries((freqRes.data || []) as FreqEntry[]);
    setDurEntries((durRes.data || []) as DurEntry[]);
    setNotes((notesRes.data || []) as QuickNote[]);
    setAbcLogs((abcRes.data || []) as ABCEntry[]);
    setLoading(false);
  };

  // Aggregate frequency by behavior
  const freqByBehavior = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const e of freqEntries) {
      if (!map[e.behavior_name]) map[e.behavior_name] = {};
      map[e.behavior_name][e.logged_date] = (map[e.behavior_name][e.logged_date] || 0) + e.count;
    }
    return map;
  }, [freqEntries]);

  // Aggregate duration by behavior
  const durByBehavior = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of durEntries) {
      map[e.behavior_name] = (map[e.behavior_name] || 0) + e.duration_seconds;
    }
    return map;
  }, [durEntries]);

  // ABC patterns
  const abcPatterns = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of abcLogs) {
      const key = `${e.antecedent} → ${e.behavior} → ${e.consequence}`;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [abcLogs]);

  const hasData = freqEntries.length > 0 || durEntries.length > 0 || notes.length > 0 || abcLogs.length > 0;

  const buildSummaryBody = () => {
    const student = clients.find(c => c.id === selectedClientId);
    const name = student ? displayName(student) : 'Student';
    const lines: string[] = [`📊 Weekly Data Summary for ${name}`, `📅 ${weekLabel}`, ''];

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

    if (abcPatterns.length > 0) {
      lines.push('── ABC Patterns ──');
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

    // Find BCBA recipient from resolvedUser's agencies
    // For now, we'll prompt user to specify or use first admin
    const body = buildSummaryBody();
    const student = clients.find(c => c.id === selectedClientId);
    const studentName = student ? displayName(student) : 'Student';

    setSending(true);
    try {
      const { error } = await supabase.from('teacher_messages').insert({
        agency_id: agencyId || currentWorkspace?.agency_id,
        sender_id: user?.id,
        recipient_id: user?.id, // Self-copy for now; user can forward
        client_id: selectedClientId,
        subject: `Weekly Data Summary: ${studentName} (${weekLabel})`,
        body,
        message_type: 'data_summary',
        metadata: { app_source: 'teacher_hub', week_start: weekStart.toISOString(), week_end: weekEnd.toISOString() },
      });
      if (error) throw error;
      toast({ title: '✓ Summary sent', description: 'Available in your Inbox to forward to your supervisor' });
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
        <p className="text-sm text-muted-foreground">Weekly aggregation of Quick Add data</p>
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !selectedClientId ? (
        <p className="text-sm text-muted-foreground">Select a student to view weekly data.</p>
      ) : !hasData ? (
        <p className="text-sm text-muted-foreground">No Quick Add data for this week.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
                  <BarChart3 className="h-4 w-4 text-orange-500" /> ABC Patterns
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

      {hasData && (
        <Button onClick={sendSummaryToBCBA} disabled={sending} className="gap-1.5">
          <Send className="h-4 w-4" />
          Send Summary to Inbox
        </Button>
      )}
    </div>
  );
};
