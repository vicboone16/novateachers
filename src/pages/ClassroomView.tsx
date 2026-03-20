/**
 * "Today in My Classroom" — default teacher landing page.
 * Comprehensive classroom dashboard with student cards, summary bar,
 * quick actions, and floating Mayday button.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName, displayInitials } from '@/lib/student-utils';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { writeWithRetry } from '@/lib/sync-queue';
import { logEvent, trackBehaviorForEscalation, createSignal, trackBehaviorForReinforcementGap } from '@/lib/supervisorSignals';
import { getStudentBalances, writePointEntry } from '@/lib/beacon-points';
import { BeaconPointsControls } from '@/components/BeaconPointsControls';
import { useUndoAction } from '@/hooks/useUndoAction';
import { UndoToast } from '@/components/UndoToast';
import { StudentStatusBadge, type StudentStatus } from '@/components/StudentStatusBadge';
import { StaffPresencePanel } from '@/components/StaffPresencePanel';
import { StudentQuickActionModal } from '@/components/StudentQuickActionModal';
import { MaydayButton } from '@/components/MaydayButton';
import { listRecentClassroomEvents, seedTeacherEvents, type CoreBridgeEvent } from '@/lib/core-bridge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Hand, DoorOpen, Bomb, Megaphone, ShieldX,
  Check, X, Play, ExternalLink, Clock, Bell,
  BarChart3, AlertTriangle, Users, Star, Sparkles,
  Target, BookOpen, MessageSquare, Zap, ChevronDown,
  Gamepad2, Gift, KeyRound, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';

const BEHAVIORS = [
  { name: 'Aggression', icon: Hand, abbr: 'AGG' },
  { name: 'Elopement', icon: DoorOpen, abbr: 'ELP' },
  { name: 'Property Destruction', icon: Bomb, abbr: 'PD' },
  { name: 'Major Disruption', icon: Megaphone, abbr: 'DIS' },
  { name: 'Noncompliance', icon: ShieldX, abbr: 'NC' },
];

interface TodayCounts { [clientId: string]: number }
interface LastEvent { [clientId: string]: string }
interface PointBalances { [clientId: string]: number }
interface StudentStatuses { [clientId: string]: StudentStatus }
interface TokenProgress { [clientId: string]: { current: number; target: number } }
interface EngagementData { total: number; engaged: number }

const ClassroomView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayCounts, setTodayCounts] = useState<TodayCounts>({});
  const [lastEvents, setLastEvents] = useState<LastEvent>({});
  const [totalToday, setTotalToday] = useState(0);
  const [pointBalances, setPointBalances] = useState<PointBalances>({});
  const [studentStatuses, setStudentStatuses] = useState<StudentStatuses>({});
  const [tokenProgress, setTokenProgress] = useState<TokenProgress>({});
  const [engagement, setEngagement] = useState<EngagementData>({ total: 0, engaged: 0 });
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [allGroups, setAllGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [flashCard, setFlashCard] = useState<string | null>(null);
  const [quickActionStudent, setQuickActionStudent] = useState<Client | null>(null);
  const [missionText, setMissionText] = useState('Be Kind, Be Safe, Be Respectful');
  const [wordOfWeek, setWordOfWeek] = useState('Perseverance');
  const [classGoal, setClassGoal] = useState({ current: 0, target: 100, label: 'Class Goal' });
  const [staffCount, setStaffCount] = useState(0);
  const { pendingAction, pushAction, undoAction, dismissAction } = useUndoAction();

  const handleUndoComplete = async () => {
    const ok = await undoAction();
    if (ok && pendingAction) {
      handlePointChange(pendingAction.studentId, -pendingAction.points);
      toast({ title: '↩ Undone' });
    }
    return ok;
  };
  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';
  const today = new Date().toISOString().slice(0, 10);
  const activeGroup = allGroups.find(g => g.group_id === activeGroupId);

  useEffect(() => {
    if (currentWorkspace) loadClients();
  }, [currentWorkspace]);

  useEffect(() => {
    if (!user || !effectiveAgencyId) return;
    cloudSupabase
      .from('classroom_groups')
      .select('group_id, name')
      .eq('agency_id', effectiveAgencyId)
      .order('name')
      .then(({ data }) => {
        const groups = data || [];
        setAllGroups(groups);
        if (groups.length > 0 && !activeGroupId) setActiveGroupId(groups[0].group_id);
      });
  }, [user, effectiveAgencyId]);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setClients(normalizeClients(data));
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || clients.length === 0) return;
    loadTodayCounts();
    loadPointBalances();
    loadAttendance();
    loadTokenProgress();
    loadBoardSettings();
    loadEngagementData();
    loadStaffCount();
  }, [clients, user, activeGroupId]);

  const loadPointBalances = async () => {
    if (!user) return;
    const clientIds = clients.map(c => c.id);
    const balances = await getStudentBalances(user.id, clientIds);
    setPointBalances(balances);
    setTotalPoints(Object.values(balances).reduce((s, v) => s + v, 0));
  };

  const loadAttendance = async () => {
    if (!user || !activeGroupId) return;
    try {
      const { data } = await supabase
        .from('student_attendance_status' as any)
        .select('student_id, status')
        .eq('classroom_id', activeGroupId)
        .eq('recorded_date', today);
      const statuses: StudentStatuses = {};
      for (const row of (data || []) as any[]) {
        statuses[row.student_id] = row.status as StudentStatus;
      }
      setStudentStatuses(statuses);
    } catch { /* silent */ }
  };

  const loadTokenProgress = async () => {
    if (!activeGroupId) return;
    try {
      const { data } = await supabase
        .from('token_boards' as any)
        .select('student_id, current_tokens, target_tokens')
        .eq('classroom_id', activeGroupId)
        .eq('is_active', true);
      const progress: TokenProgress = {};
      for (const row of (data || []) as any[]) {
        progress[row.student_id] = { current: row.current_tokens || 0, target: row.target_tokens || 10 };
      }
      setTokenProgress(progress);
    } catch { /* silent */ }
  };

  const loadBoardSettings = async () => {
    if (!activeGroupId) return;
    try {
      const { data } = await supabase
        .from('classroom_board_settings' as any)
        .select('mission_text, word_of_week, class_goal_label, class_goal_target, class_goal_current')
        .eq('classroom_id', activeGroupId)
        .maybeSingle();
      if (data) {
        const d = data as any;
        if (d.mission_text) setMissionText(d.mission_text);
        if (d.word_of_week) setWordOfWeek(d.word_of_week);
        setClassGoal({
          current: d.class_goal_current || 0,
          target: d.class_goal_target || 100,
          label: d.class_goal_label || 'Class Goal',
        });
      }
    } catch { /* silent */ }
  };

  const loadEngagementData = async () => {
    if (!user) return;
    try {
      const clientIds = clients.map(c => c.id);
      const { data } = await supabase
        .from('teacher_data_events' as any)
        .select('event_subtype')
        .eq('staff_id', user.id)
        .eq('event_type', 'engagement_sample')
        .gte('recorded_at', today + 'T00:00:00')
        .in('student_id', clientIds);
      const samples = (data || []) as any[];
      setEngagement({
        total: samples.length,
        engaged: samples.filter(s => s.event_subtype === 'engaged').length,
      });
    } catch { /* silent */ }
  };

  const loadStaffCount = async () => {
    if (!activeGroupId) return;
    try {
      const { data } = await supabase
        .from('staff_presence_status' as any)
        .select('id')
        .eq('classroom_id', activeGroupId)
        .eq('status', 'in_classroom');
      setStaffCount((data || []).length);
    } catch { setStaffCount(0); }
  };

  const handleStudentStatusChange = (studentId: string, status: StudentStatus) => {
    setStudentStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handlePointChange = (studentId: string, delta: number) => {
    setPointBalances(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || 0) + delta,
    }));
    setTotalPoints(prev => prev + delta);
  };

  const loadTodayCounts = async () => {
    if (!user) return;
    try {
      const clientIds = clients.map(c => c.id);
      const [freqRes, eventsRes] = await Promise.all([
        supabase
          .from('teacher_frequency_entries')
          .select('client_id, count')
          .eq('user_id', user.id)
          .eq('logged_date', today)
          .in('client_id', clientIds),
        listRecentClassroomEvents({
          userId: user.id,
          agencyId: effectiveAgencyId || undefined,
          studentIds: clientIds,
          limit: 12,
        }),
      ]);

      const counts: TodayCounts = {};
      let total = 0;
      for (const row of (freqRes.data || []) as any[]) {
        counts[row.client_id] = (counts[row.client_id] || 0) + (row.count || 1);
        total += row.count || 1;
      }
      setTodayCounts(counts);
      setTotalToday(total);

      const recent = eventsRes.data?.events || [];
      const last: LastEvent = {};
      for (const e of recent) {
        if (!last[e.student_id]) last[e.student_id] = e.recorded_at;
      }
      setLastEvents(last);
    } catch { /* silent */ }
  };

  const logBehavior = async (clientId: string, behaviorName: string) => {
    if (!user) return;
    if ('vibrate' in navigator) navigator.vibrate(15);
    setFlashCard(clientId);
    setTimeout(() => setFlashCard(null), 300);
    setTodayCounts(prev => ({ ...prev, [clientId]: (prev[clientId] || 0) + 1 }));
    setTotalToday(prev => prev + 1);
    const now = new Date().toISOString();
    setLastEvents(prev => ({ ...prev, [clientId]: now }));

    try {
      await writeWithRetry('teacher_frequency_entries', {
        agency_id: effectiveAgencyId,
        client_id: clientId,
        user_id: user.id,
        behavior_name: behaviorName,
        count: 1,
        logged_date: today,
      });
      writeUnifiedEvent({
        studentId: clientId, staffId: user.id, agencyId: effectiveAgencyId,
        eventType: 'behavior_event', eventSubtype: 'frequency',
        eventValue: { behavior: behaviorName, count: 1 },
        sourceModule: 'classroom_view',
      });
      try {
        await logEvent({ clientId, agencyId: effectiveAgencyId, eventType: 'behavior', eventName: behaviorName, value: 1, metadata: { source: 'classroom_view' } });
      } catch {}
      const esc = trackBehaviorForEscalation(behaviorName);
      if (esc?.escalated) {
        try {
          await createSignal({ clientId, agencyId: effectiveAgencyId, signalType: 'escalation', severity: 'action', title: 'Escalation detected', message: `${esc.count} ${esc.behavior} events within 10 minutes`, drivers: { behavior: esc.behavior, count: esc.count, window_minutes: 10 }, source: { app: 'beacon', trigger: 'escalation_rule' } });
          toast({ title: '🚨 Escalation alert sent' });
        } catch {}
      }
      trackBehaviorForReinforcementGap(clientId);
    } catch {
      toast({ title: 'Error logging behavior', variant: 'destructive' });
    }
  };

  const logEngagement = async (clientId: string, engaged: boolean) => {
    if (!user) return;
    if ('vibrate' in navigator) navigator.vibrate(10);
    setFlashCard(clientId);
    setTimeout(() => setFlashCard(null), 300);
    toast({ title: `${engaged ? '✓ Engaged +1⭐' : '✗ Not engaged'}` });

    setEngagement(prev => ({
      total: prev.total + 1,
      engaged: prev.engaged + (engaged ? 1 : 0),
    }));

    if (engaged) {
      handlePointChange(clientId, 1);
      writePointEntry({
        studentId: clientId, staffId: user.id, agencyId: effectiveAgencyId,
        points: 1, reason: 'Engagement sample — engaged', source: 'engagement_sample',
      });
    }
    writeUnifiedEvent({
      studentId: clientId, staffId: user.id, agencyId: effectiveAgencyId,
      eventType: 'engagement_sample', eventSubtype: engaged ? 'engaged' : 'not_engaged',
      eventValue: { engaged, response_time: new Date().toISOString() },
      sourceModule: 'classroom_view',
    });
    try {
      await logEvent({ clientId, agencyId: effectiveAgencyId, eventType: 'context', eventName: 'engagement_check', value: engaged ? 1 : 0, metadata: { engaged, source: 'classroom_view' } });
    } catch {}
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const engagementPct = engagement.total > 0 ? Math.round((engagement.engaged / engagement.total) * 100) : 0;
  const classGoalPct = classGoal.target > 0 ? Math.round((classGoal.current / classGoal.target) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {allGroups.length > 1 ? (
                <Select value={activeGroupId || ''} onValueChange={setActiveGroupId}>
                  <SelectTrigger className="h-8 text-base font-bold font-heading border-none shadow-none px-0 gap-1 max-w-[200px]">
                    <SelectValue placeholder="Select classroom…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGroups.map(g => (
                      <SelectItem key={g.group_id} value={g.group_id} className="text-sm">{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <h2 className="text-lg font-bold tracking-tight font-heading">
                  {activeGroup?.name || 'My Classroom'}
                </h2>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {' · '}{clients.length} students
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs px-2.5" onClick={() => navigate('/game-board')}>
            <Gamepad2 className="h-3.5 w-3.5" /> Game
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs px-2.5" onClick={() => navigate('/rewards')}>
            <Gift className="h-3.5 w-3.5" /> Rewards
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/threads')} title="Threads">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </Button>
          {activeGroupId && (
            <MaydayButton agencyId={effectiveAgencyId} classroomId={activeGroupId} />
          )}
        </div>
      </div>

      {/* ─── SUMMARY BAR (horizontally scrollable) ─── */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          <SummaryChip icon={Star} label="Points Today" value={String(totalPoints)} color="text-amber-500" />
          <SummaryChip icon={Target} label="Engagement" value={engagement.total > 0 ? `${engagementPct}%` : '—'} color="text-accent" />
          <SummaryChip icon={BarChart3} label="Events" value={String(totalToday)} color="text-primary" />
          <SummaryChip icon={Users} label="Staff" value={String(staffCount)} color="text-muted-foreground" />
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2 shrink-0 min-w-[140px]">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{classGoal.label}</p>
              <Progress value={classGoalPct} className="h-1.5 mt-1" />
            </div>
            <span className="text-xs font-bold">{classGoalPct}%</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2 shrink-0 max-w-[160px]">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Mission</p>
              <p className="text-[10px] font-medium truncate">{missionText}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2 shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Word</p>
              <p className="text-xs font-bold">{wordOfWeek}</p>
            </div>
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ─── STUDENT GRID ─── */}
      {clients.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No students in this workspace yet.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/students')}>
              Manage Students
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => {
            const tp = tokenProgress[client.id];
            const tokenPct = tp ? Math.min(100, Math.round((tp.current / tp.target) * 100)) : 0;
            const status = studentStatuses[client.id] || 'present';
            const isAbsent = status === 'absent' || status === 'picked_up';

            return (
              <Card
                key={client.id}
                className={cn(
                  'border-border/50 transition-all duration-300 overflow-hidden relative',
                  flashCard === client.id && 'ring-2 ring-amber-400/60 scale-[1.02] shadow-lg shadow-amber-200/30 dark:shadow-amber-900/20',
                  isAbsent && 'opacity-50',
                )}
              >
                {/* Celebration flash overlay */}
                {flashCard === client.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 via-amber-200/20 to-amber-400/10 animate-pulse pointer-events-none z-10 rounded-lg" />
                )}
                <CardContent className="p-0">
                  {/* Top row: name + status */}
                  <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                    <button onClick={() => setQuickActionStudent(client)} className="flex items-center gap-2 group text-left min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {displayInitials(client)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {displayName(client)}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {client.grade && <span>Gr {client.grade}</span>}
                          {lastEvents[client.id] && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{formatTime(lastEvents[client.id])}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                    {activeGroupId && (
                      <StudentStatusBadge
                        studentId={client.id}
                        groupId={activeGroupId}
                        agencyId={effectiveAgencyId}
                        userId={user?.id || ''}
                        currentStatus={status}
                        onStatusChange={handleStudentStatusChange}
                      />
                    )}
                  </div>

                  {/* Middle: Points + Race progress hint */}
                  <div className="px-3 pb-1.5">
                    <div className="flex items-center gap-2">
                      <BeaconPointsControls
                        studentId={client.id}
                        staffId={user?.id || ''}
                        agencyId={effectiveAgencyId}
                        balance={pointBalances[client.id] || 0}
                        onPointChange={handlePointChange}
                        responseCostEnabled
                      />
                      {todayCounts[client.id] > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {todayCounts[client.id]}
                        </Badge>
                      )}
                    </div>
                    {/* Race progress mini-bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={Math.min(100, ((pointBalances[client.id] || 0) / 100) * 100)} className="h-1.5 flex-1" />
                      <span className="text-[9px] text-muted-foreground shrink-0 tabular-nums">
                        {Math.floor(Math.min(pointBalances[client.id] || 0, 100) / 20)}cp
                      </span>
                    </div>
                  </div>

                  {/* Point award row */}
                  <div className="border-t border-border/30 px-2 py-1.5 flex items-center gap-1">
                    {[1, 5, 10].map(n => (
                      <button
                        key={n}
                        onClick={async () => {
                          handlePointChange(client.id, n);
                          setFlashCard(client.id);
                          setTimeout(() => setFlashCard(null), 800);
                          if ('vibrate' in navigator) navigator.vibrate(10);
                          if (user) {
                            const { data } = await cloudSupabase.from('beacon_points_ledger').insert({
                              student_id: client.id, staff_id: user.id, agency_id: effectiveAgencyId,
                              points: n, reason: `Quick +${n}`, source: 'quick_action', entry_kind: 'manual',
                            } as any).select('id').single();
                            pushAction({
                              id: data?.id || crypto.randomUUID(),
                              label: `Quick +${n}`,
                              studentId: client.id,
                              studentName: displayName(client),
                              ledgerRowId: data?.id,
                              points: n,
                              agencyId: effectiveAgencyId,
                              staffId: user.id,
                            });
                          }
                          toast({ title: `+${n} ⭐ ${displayName(client)}` });
                        }}
                        className="flex items-center gap-0.5 rounded border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 px-2 py-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 active:scale-95 transition-all"
                      >
                        <Star className="h-2.5 w-2.5" />+{n}
                      </button>
                    ))}
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => navigate('/rewards')} title="Rewards"
                        className="rounded border border-border/50 bg-muted/20 p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <Gift className="h-3 w-3" />
                      </button>
                      <button onClick={() => navigate('/game-board')} title="Game Board"
                        className="rounded border border-border/50 bg-muted/20 p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <Gamepad2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setQuickActionStudent(client)} title="Student code & more"
                        className="rounded border border-border/50 bg-muted/20 p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <KeyRound className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Behavior + engagement row */}
                  <div className="border-t border-border/30 px-2 py-1 flex items-center gap-1">
                    {BEHAVIORS.slice(0, 3).map(({ name, abbr, icon: Icon }) => (
                      <button
                        key={name}
                        onClick={() => logBehavior(client.id, name)}
                        title={name}
                        className="flex items-center gap-0.5 rounded border border-border/50 bg-muted/20 px-1.5 py-1 text-[9px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-colors"
                      >
                        <Icon className="h-2.5 w-2.5" />{abbr}
                      </button>
                    ))}
                    <button
                      onClick={() => navigate(`/collect?student=${client.id}`)}
                      className="flex items-center gap-0.5 rounded border border-primary/30 bg-primary/5 px-1.5 py-1 text-[9px] font-medium text-primary hover:bg-primary/10 active:scale-95 transition-colors"
                    >
                      <Target className="h-2.5 w-2.5" />Probe
                    </button>
                    <div className="ml-auto flex gap-0.5">
                      <button onClick={() => logEngagement(client.id, true)} title="Engaged"
                        className="rounded border border-accent/30 bg-accent/10 p-1 text-accent hover:bg-accent/20 active:scale-90 transition-colors">
                        <Check className="h-2.5 w-2.5" />
                      </button>
                      <button onClick={() => logEngagement(client.id, false)} title="Not engaged"
                        className="rounded border border-destructive/20 bg-destructive/5 p-1 text-destructive hover:bg-destructive/10 active:scale-90 transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Action Modal */}
      {quickActionStudent && (
        <StudentQuickActionModal
          open={!!quickActionStudent}
          onOpenChange={(open) => { if (!open) setQuickActionStudent(null); }}
          studentId={quickActionStudent.id}
          studentName={displayName(quickActionStudent)}
          pointBalance={pointBalances[quickActionStudent.id] || 0}
          agencyId={effectiveAgencyId}
          responseCostEnabled
          onBehavior={(name) => logBehavior(quickActionStudent.id, name)}
          onEngagement={(engaged) => logEngagement(quickActionStudent.id, engaged)}
          onPointChange={handlePointChange}
        />
      )}
    </div>
  );
};

/* ── Summary chip for the horizontal bar ── */
function SummaryChip({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card px-3 py-2 shrink-0">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <div>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold leading-none">{value}</p>
      </div>
    </div>
  );
}

export default ClassroomView;
