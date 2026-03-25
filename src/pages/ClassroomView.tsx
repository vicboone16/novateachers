/**
 * "Today in My Classroom" — default teacher landing page.
 * Comprehensive classroom dashboard with student cards, summary bar,
 * quick actions, and floating Mayday button.
 * Now loads teacher_point_actions from DB and uses RPC linking functions.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingHomeBanner } from '@/components/onboarding/OnboardingHomeBanner';
import { useStaffOnboarding } from '@/hooks/useStaffOnboarding';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { fetchAccessibleClients } from '@/lib/client-access';
import { normalizeClients, displayName, displayInitials } from '@/lib/student-utils';
import { invokeCloudFunction } from '@/lib/cloud-functions';
import { writeUnifiedEvent } from '@/lib/unified-events';
import { writeWithRetry } from '@/lib/sync-queue';
import { logEvent, trackBehaviorForEscalation, createSignal, trackBehaviorForReinforcementGap } from '@/lib/supervisorSignals';
import { getStudentBalances, writePointEntry, loadTeacherPointActions, executeTeacherAction, type TeacherPointAction } from '@/lib/beacon-points';
import { BeaconPointsControls } from '@/components/BeaconPointsControls';
import { useUndoAction } from '@/hooks/useUndoAction';
import { useStudentGameProfiles } from '@/hooks/useStudentGameProfiles';
import { StudentLevelBadge } from '@/components/StudentLevelBadge';
import { AvatarPicker } from '@/components/AvatarPicker';
import { AnimatedAvatar } from '@/components/AnimatedAvatar';
import { ClassroomMomentum } from '@/components/ClassroomMomentum';
import { StudentIdentityBadge } from '@/components/StudentIdentityBadge';
import { TeacherWinsFeed } from '@/components/TeacherWinsFeed';
import { SessionSummaryPopup } from '@/components/SessionSummaryPopup';
import { QuickStartSetup } from '@/components/QuickStartSetup';
import { useGameEvents } from '@/hooks/useGameEvents';
import { eventTypeToAnimState } from '@/lib/avatar-animations';
import { UndoToast } from '@/components/UndoToast';
import { StudentStatusBadge, type StudentStatus } from '@/components/StudentStatusBadge';
import { StaffPresencePanel } from '@/components/StaffPresencePanel';
import { StudentQuickActionModal } from '@/components/StudentQuickActionModal';
import { BulkAwardPanel } from '@/components/BulkAwardPanel';
import { ReinforcementAssignPanel } from '@/components/ReinforcementAssignPanel';
import { ClassroomReinforcementPanel } from '@/components/ClassroomReinforcementPanel';
import { StudentPresenceChip, type StudentPresenceData } from '@/components/StudentPresenceChip';
import { StudentPresenceSheet } from '@/components/StudentPresenceSheet';
import { MaydayButton } from '@/components/MaydayButton';
import { listRecentClassroomEvents, seedTeacherEvents, type CoreBridgeEvent } from '@/lib/core-bridge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Hand, DoorOpen, Bomb, Megaphone, ShieldX,
  Check, X, Play, ExternalLink, Clock, Bell,
  BarChart3, AlertTriangle, Users, Star, Sparkles,
  Target, BookOpen, MessageSquare, Zap, ChevronDown,
  Gamepad2, Gift, KeyRound, Copy, MoreHorizontal,
  Pencil, GripVertical, Settings2, Brain,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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
interface StudentPresenceMap { [studentId: string]: StudentPresenceData }
interface ResponseCostMap { [studentId: string]: boolean }
interface StudentTargetMap { [studentId: string]: { id: string; name: string; icon: string | null; points: number; target_type: string }[] }
interface StudentBehaviorRule { behavior_name: string; points: number; rule_type: string }
interface StudentBehaviorMap { [studentId: string]: StudentBehaviorRule[] }

const ClassroomView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace, isSoloMode } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();
  const { onboardingDay } = useStaffOnboarding();

  // clients is now derived from allClients + group filter (see below)
  const [loading, setLoading] = useState(true);
  const [todayCounts, setTodayCounts] = useState<TodayCounts>({});
  const [lastEvents, setLastEvents] = useState<LastEvent>({});
  const [totalToday, setTotalToday] = useState(0);
  const [pointBalances, setPointBalances] = useState<PointBalances>({});
  const [studentStatuses, setStudentStatuses] = useState<StudentStatuses>({});
  const [tokenProgress, setTokenProgress] = useState<TokenProgress>({});
  const [engagement, setEngagement] = useState<EngagementData>({ total: 0, engaged: 0 });
  const { groupId: sharedGroupId, groupName: sharedGroupName, agencyId: sharedAgencyId, setGroupId: setSharedGroupId, loading: classroomLoading } = useActiveClassroom();
  const [activeGroupId, setActiveGroupIdLocal] = useState<string | null>(sharedGroupId);
  const setActiveGroupId = useCallback((id: string | null) => {
    setActiveGroupIdLocal(id);
    if (id) setSharedGroupId(id);
  }, [setSharedGroupId]);
  // Sync from shared context
  useEffect(() => {
    if (sharedGroupId) setActiveGroupIdLocal(sharedGroupId);
  }, [sharedGroupId]);
  const [allGroups, setAllGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [flashCard, setFlashCard] = useState<string | null>(null);
  const [quickActionStudent, setQuickActionStudent] = useState<Client | null>(null);
  const [bulkAwardOpen, setBulkAwardOpen] = useState(false);
  const [classReinforcementOpen, setClassReinforcementOpen] = useState(false);
  const [reinforceStudent, setReinforceStudent] = useState<Client | null>(null);
  const [presenceSheetStudent, setPresenceSheetStudent] = useState<Client | null>(null);
  const [studentPresence, setStudentPresence] = useState<StudentPresenceMap>({});
  const [responseCostMap, setResponseCostMap] = useState<ResponseCostMap>({});
  const [missionText, setMissionText] = useState('Be Kind, Be Safe, Be Respectful');
  const [wordOfWeek, setWordOfWeek] = useState('Perseverance');
  const [classGoal, setClassGoal] = useState({ current: 0, target: 100, label: 'Class Goal' });
  const [staffCount, setStaffCount] = useState(0);
  const [teacherActions, setTeacherActions] = useState<TeacherPointAction[]>([]);
  const [studentTargets, setStudentTargets] = useState<StudentTargetMap>({});
  const [studentBehaviors, setStudentBehaviors] = useState<StudentBehaviorMap>({});
  const [editingWord, setEditingWord] = useState(false);
  const [editingMission, setEditingMission] = useState(false);
  const [wordDraft, setWordDraft] = useState('');
  const [missionDraft, setMissionDraft] = useState('');
  const [summaryChipOrder, setSummaryChipOrder] = useState<string[]>(['momentum', 'points', 'engagement', 'events', 'staff', 'goal', 'mission', 'word']);
  const [dragChip, setDragChip] = useState<string | null>(null);
  const [sessionSummaryOpen, setSessionSummaryOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());
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
  const { getEffect } = useGameEvents({ classroomId: activeGroupId, agencyId: effectiveAgencyId, enabled: !!activeGroupId });
  const today = new Date().toISOString().slice(0, 10);
  const activeGroup = allGroups.find(g => g.group_id === activeGroupId);

  const [allClients, setAllClients] = useState<Client[]>([]);
  const [groupStudentIds, setGroupStudentIds] = useState<Set<string> | null>(null); // null = "All"
  const [showAll, setShowAll] = useState(false);

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
    // Load teacher point actions
    loadTeacherPointActions(effectiveAgencyId).then(setTeacherActions);
  }, [user, effectiveAgencyId]);

  // Load group student IDs when activeGroupId changes
  useEffect(() => {
    if (!activeGroupId || showAll) {
      setGroupStudentIds(null);
      return;
    }
    cloudSupabase
      .from('classroom_group_students')
      .select('client_id')
      .eq('group_id', activeGroupId)
      .then(({ data }) => {
        const ids = new Set((data || []).map((r: any) => r.client_id));
        setGroupStudentIds(ids);
      });
  }, [activeGroupId, showAll]);

  // Backfill student names on Cloud for public board display
  useEffect(() => {
    if (!activeGroupId || !allClients.length || !groupStudentIds) return;
    const grouped = allClients.filter(c => groupStudentIds.has(c.id));
    if (grouped.length === 0) return;
    // Fire-and-forget update for each student
    for (const c of grouped) {
      if (c.first_name || c.last_name) {
        cloudSupabase
          .from('classroom_group_students')
          .update({ first_name: c.first_name || null, last_name: c.last_name || null } as any)
          .eq('group_id', activeGroupId)
          .eq('client_id', c.id)
          .then(() => {});
      }
    }
  }, [activeGroupId, allClients, groupStudentIds]);

  // Filter clients by group
  const clients = showAll || !groupStudentIds
    ? allClients
    : allClients.filter(c => groupStudentIds.has(c.id));

  // Game profiles (level, xp, avatar)
  const { profiles: gameProfiles } = useStudentGameProfiles(clients.map(c => c.id));
  const [avatarPickerStudent, setAvatarPickerStudent] = useState<Client | null>(null);

  const loadClients = async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    try {
      const data = await fetchAccessibleClients({ currentWorkspace, isSoloMode, userId: user?.id });
      setAllClients(normalizeClients(data));
    } catch { /* silent */ }
    setLoading(false);
  };

  // Load data once when clients/group settle (not on every render)
  const [dataLoaded, setDataLoaded] = useState(false);
  useEffect(() => {
    if (!user || clients.length === 0) return;
    if (!dataLoaded) {
      loadTodayCounts();
      loadPointBalances();
      loadAttendance();
      loadTokenProgress();
      loadBoardSettings();
      loadEngagementData();
      loadStaffCount();
      loadResponseCostSettings();
      loadStudentTargets();
      setDataLoaded(true);
    }
  }, [clients, user, activeGroupId]);

  // Reset dataLoaded when group changes so we reload
  useEffect(() => { setDataLoaded(false); }, [activeGroupId]);

  // Realtime balance sync — refetch on ledger changes (prevents glitch)
  useEffect(() => {
    if (!user || clients.length === 0) return;
    const channel = cloudSupabase.channel('classroom-balance-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'beacon_points_ledger' }, async () => {
        const clientIds = clients.map(c => c.id);
        const bals = await getStudentBalances(user.id, clientIds);
        setPointBalances(bals);
        setTotalPoints(Object.values(bals).reduce((s, v) => s + v, 0));
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [user, clients]);

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
      const { data } = await cloudSupabase
        .from('student_attendance_status')
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
      const { data } = await cloudSupabase
        .from('token_boards')
        .select('student_id, current_tokens, token_target')
        .eq('classroom_id', activeGroupId);
      const progress: TokenProgress = {};
      for (const row of (data || []) as any[]) {
        progress[row.student_id] = { current: row.current_tokens || 0, target: row.token_target || 10 };
      }
      setTokenProgress(progress);
    } catch { /* silent */ }
  };

  const loadBoardSettings = async () => {
    if (!activeGroupId) return;
    try {
      // Try classroom_settings on Lovable Cloud first
      const { data: settings } = await cloudSupabase
        .from('classroom_settings')
        .select('point_goal, point_goal_label, mission_text, word_of_week')
        .eq('group_id', activeGroupId)
        .maybeSingle();
      if (settings) {
        const s = settings as any;
        if (s.mission_text) setMissionText(s.mission_text);
        if (s.word_of_week) setWordOfWeek(s.word_of_week);
        setClassGoal({
          current: totalPoints,
          target: s.point_goal || 500,
          label: s.point_goal_label || 'Class Goal',
        });
        return;
      }
      // Fallback to Cloud board settings
      const { data } = await cloudSupabase
        .from('classroom_board_settings')
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
        .from('v_classroom_staff_presence' as any)
        .select('id')
        .eq('classroom_group_id', activeGroupId)
        .eq('status', 'in_room');
      setStaffCount((data || []).length);
    } catch { setStaffCount(0); }
  };

  const loadResponseCostSettings = async () => {
    if (!effectiveAgencyId) return;
    try {
      const { data } = await cloudSupabase
        .from('student_response_cost_settings')
        .select('student_id, response_cost_enabled')
        .eq('agency_id', effectiveAgencyId);
      const map: ResponseCostMap = {};
      for (const row of (data || []) as any[]) {
        map[row.student_id] = row.response_cost_enabled;
      }
      setResponseCostMap(map);
    } catch { /* silent */ }
  };

  const loadStudentTargets = async () => {
    if (!effectiveAgencyId) return;
    try {
      // Load student-specific targets (skill acquisition goals)
      const { data: targets } = await cloudSupabase
        .from('teacher_targets')
        .select('id, client_id, name, icon, target_type')
        .eq('agency_id', effectiveAgencyId)
        .eq('active', true)
        .not('client_id', 'is', null);

      // Load student-specific reinforcement rules for point amounts
      const { data: rules } = await cloudSupabase
        .from('student_reinforcement_rules')
        .select('student_id, linked_target_id, points, behavior_name, rule_scope, is_active')
        .eq('is_active', true);

      // Build per-student target map with points
      const map: StudentTargetMap = {};
      for (const t of (targets || []) as any[]) {
        if (!t.client_id) continue;
        if (!map[t.client_id]) map[t.client_id] = [];
        // Find matching rule for points
        const rule = (rules || []).find((r: any) => r.linked_target_id === t.id && r.student_id === t.client_id);
        map[t.client_id].push({
          id: t.id,
          name: t.name,
          icon: t.icon,
          points: rule?.points ?? 1,
          target_type: t.target_type,
        });
      }
      setStudentTargets(map);

      // Also build per-student behavior map from reinforcement rules
      const behaviorMap: StudentBehaviorMap = {};
      for (const r of (rules || []) as any[]) {
        if (!r.student_id || !r.behavior_name || !r.is_active) continue;
        if (r.linked_target_id) continue; // skip target-linked rules, those are skill goals
        if (!behaviorMap[r.student_id]) behaviorMap[r.student_id] = [];
        behaviorMap[r.student_id].push({
          behavior_name: r.behavior_name,
          points: r.points,
          rule_type: r.rule_type,
        });
      }
      setStudentBehaviors(behaviorMap);
    } catch { /* silent */ }
  };

  const handleStudentStatusChange = (studentId: string, status: StudentStatus) => {
    setStudentStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handleStudentPresenceUpdate = (studentId: string, presence: StudentPresenceData) => {
    setStudentPresence(prev => ({ ...prev, [studentId]: presence }));
  };

  // Load student presence from Core
  const loadStudentPresence = useCallback(async () => {
    if (!activeGroupId) return;
    try {
      const { data } = await cloudSupabase
        .from('v_classroom_student_presence')
        .select('student_id, location_type, location_label, status, assigned_staff_id, updated_at')
        .eq('classroom_group_id', activeGroupId);
      const map: StudentPresenceMap = {};
      for (const row of (data || []) as any[]) {
        map[row.student_id] = row as StudentPresenceData;
      }
      setStudentPresence(map);
    } catch { /* Core view may not exist yet */ }
  }, [activeGroupId]);

  // Subscribe to student_presence realtime
  useEffect(() => {
    if (!activeGroupId) return;
    loadStudentPresence();
    const channel = cloudSupabase
      .channel(`student_presence_${activeGroupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_presence' }, () => {
        loadStudentPresence();
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [activeGroupId, loadStudentPresence]);

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
          .eq('staff_id', user.id)
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
        staff_id: user.id,
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
        entryKind: 'teacher_data_event',
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

  /** Execute a teacher_point_action for a student */
  const handleTeacherAction = async (action: TeacherPointAction, client: Client) => {
    if (!user) return;
    const estimatedPts = action.manual_points || (action.action_group === 'behavior' ? -2 : 1);
    handlePointChange(client.id, estimatedPts);
    setFlashCard(client.id);
    setTimeout(() => setFlashCard(null), 800);
    if ('vibrate' in navigator) navigator.vibrate(estimatedPts > 0 ? 10 : [10, 30, 10]);

    const result = await executeTeacherAction(action, {
      agencyId: effectiveAgencyId,
      studentId: client.id,
      staffId: user.id,
      classroomId: activeGroupId || undefined,
    });

    if (result.ok) {
      // Reconcile if actual points differ from estimate
      if (result.points !== estimatedPts) {
        handlePointChange(client.id, result.points - estimatedPts);
      }
      pushAction({
        id: result.ledgerRowId || crypto.randomUUID(),
        label: action.action_label,
        studentId: client.id,
        studentName: displayName(client),
        ledgerRowId: result.ledgerRowId,
        points: result.points || estimatedPts,
        agencyId: effectiveAgencyId,
        staffId: user.id,
      });
      toast({ title: `${action.action_icon || '⭐'} ${action.action_label} · ${displayName(client)}` });
    } else {
      // Rollback optimistic
      handlePointChange(client.id, -estimatedPts);
      toast({ title: 'Action failed', description: result.error, variant: 'destructive' });
    }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const engagementPct = engagement.total > 0 ? Math.round((engagement.engaged / engagement.total) * 100) : 0;
  const classGoalPct = classGoal.target > 0 ? Math.round((classGoal.current / classGoal.target) * 100) : 0;

  const saveWord = async () => {
    const val = wordDraft.trim() || wordOfWeek;
    setWordOfWeek(val);
    setEditingWord(false);
    if (activeGroupId) {
      try {
        await cloudSupabase.from('classroom_settings').upsert({
          group_id: activeGroupId, agency_id: effectiveAgencyId, word_of_week: val,
        }, { onConflict: 'group_id' });
      } catch {
        try { await cloudSupabase.from('classroom_board_settings').upsert({ classroom_id: activeGroupId, word_of_week: val } as any, { onConflict: 'classroom_id' }); } catch {}
      }
    }
  };

  const saveMission = async () => {
    const val = missionDraft.trim() || missionText;
    setMissionText(val);
    setEditingMission(false);
    if (activeGroupId) {
      try {
        await cloudSupabase.from('classroom_settings').upsert({
          group_id: activeGroupId, agency_id: effectiveAgencyId, mission_text: val,
        }, { onConflict: 'group_id' });
      } catch {
        try { await cloudSupabase.from('classroom_board_settings').upsert({ classroom_id: activeGroupId, mission_text: val } as any, { onConflict: 'classroom_id' }); } catch {}
      }
    }
  };

  const handleChipDrop = (targetKey: string) => {
    if (!dragChip || dragChip === targetKey) return;
    setSummaryChipOrder(prev => {
      const arr = [...prev];
      const from = arr.indexOf(dragChip);
      const to = arr.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      arr.splice(from, 1);
      arr.splice(to, 0, dragChip);
      return arr;
    });
    setDragChip(null);
  };

  // Group teacher actions by category
  const positiveActions = teacherActions.filter(a => a.action_group === 'positive');
  const behaviorActions = teacherActions.filter(a => a.action_group === 'behavior');
  const manualActions = teacherActions.filter(a => a.action_group === 'manual');

  // Student name map for wins/summary
  const studentNameMap = Object.fromEntries(clients.map(c => [c.id, displayName(c)]));

  // Session duration check (30+ minutes → allow end session)
  const sessionMinutes = Math.floor((Date.now() - sessionStartTime) / 60000);

  if (loading || classroomLoading) {
    return (
      <div className="flex items-center justify-center py-16 flex-col gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Loading classroom…</p>
      </div>
    );
  }

  if (!activeGroupId && !loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3 max-w-xs mx-auto">
          <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium">No classroom found</p>
          <p className="text-xs text-muted-foreground">
            You're not assigned to a classroom yet, or no classrooms exist. Create one to get started.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={loadClients}>Retry</Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/classrooms')}>Classroom Manager</Button>
            <Button size="sm" className="gap-1.5" onClick={() => setQuickStartOpen(true)}>
              <Zap className="h-3.5 w-3.5" /> Quick Start
            </Button>
          </div>
        </div>
        <QuickStartSetup
          open={quickStartOpen}
          onOpenChange={setQuickStartOpen}
          agencyId={effectiveAgencyId}
          onComplete={(groupId) => { setActiveGroupId(groupId); loadClients(); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* ─── ONBOARDING BANNER ─── */}
      <OnboardingHomeBanner
        onboardingDay={onboardingDay}
        onLogBehavior={() => {
          // Open the first student's quick action modal, or scroll to student cards
          const firstStudent = clients[0];
          if (firstStudent) setQuickActionStudent(firstStudent);
        }}
        onSendUpdate={() => navigate('/threads')}
        onWhosHere={() => {
          // Scroll down to reveal the student cards section
          window.scrollTo({ top: 400, behavior: 'smooth' });
        }}
      />
      {/* ─── HEADER BAND ─── */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            {allGroups.length > 0 ? (
              <Select value={showAll ? '__all__' : (activeGroupId || '')} onValueChange={(v) => {
                if (v === '__all__') { setShowAll(true); } else { setShowAll(false); setActiveGroupId(v); }
              }}>
                <SelectTrigger className="h-auto text-lg font-bold font-heading border-none shadow-none px-0 gap-1.5 max-w-[220px] text-foreground">
                  <SelectValue placeholder="Select classroom…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-sm font-medium">All Students</SelectItem>
                  {allGroups.map(g => (
                    <SelectItem key={g.group_id} value={g.group_id} className="text-sm">{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h1 className="text-lg font-bold tracking-tight font-heading text-foreground">
                {activeGroup?.name || 'My Classroom'}
              </h1>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              {' · '}{clients.length} student{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
          {activeGroupId && (
            <MaydayButton agencyId={effectiveAgencyId} classroomId={activeGroupId} />
          )}
        </div>
        <ScrollArea className="w-full">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => navigate('/game-board')}>
              <Gamepad2 className="h-3.5 w-3.5" /> Game
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => navigate('/rewards')}>
              <Gift className="h-3.5 w-3.5" /> Rewards
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => navigate('/threads')}>
              <MessageSquare className="h-3.5 w-3.5" /> Threads
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => setBulkAwardOpen(true)}>
              <Users className="h-3.5 w-3.5" /> Award All
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => setClassReinforcementOpen(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Reinforcement
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 rounded-xl font-medium text-foreground shrink-0" onClick={() => navigate('/classroom-insights')}>
              <Brain className="h-3.5 w-3.5" /> Insights
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground shrink-0" onClick={() => window.open(`/board${activeGroupId ? `?classroom=${activeGroupId}` : ''}`, '_blank')} title="Display Board">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* ─── SUMMARY BAR (horizontally scrollable, drag-to-reorder) ─── */}
      <ScrollArea className="w-full">
        <div className="flex gap-2.5 pb-2">
          {summaryChipOrder.map(chipKey => {
            if (chipKey === 'momentum') return activeGroupId ? <ClassroomMomentum key={chipKey} agencyId={effectiveAgencyId} classroomId={activeGroupId} studentIds={clients.map(c => c.id)} /> : null;
            if (chipKey === 'points') return <SummaryChip key={chipKey} icon={Star} label="Points Today" value={String(totalPoints)} color="text-amber-600 dark:text-amber-400" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)} />;
            if (chipKey === 'engagement') return <SummaryChip key={chipKey} icon={Target} label="Engagement" value={engagement.total > 0 ? `${engagementPct}%` : '—'} color="text-accent" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)} />;
            if (chipKey === 'events') return <SummaryChip key={chipKey} icon={BarChart3} label="Events" value={String(totalToday)} color="text-primary" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)} />;
            if (chipKey === 'staff') return <SummaryChip key={chipKey} icon={Users} label="Staff" value={String(staffCount)} color="text-muted-foreground" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)} />;
            if (chipKey === 'goal') return (
              <div key={chipKey} className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card shadow-sm px-3.5 py-2.5 shrink-0 min-w-[150px] cursor-grab" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)}>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{classGoal.label}</p>
                  <Progress value={classGoalPct} className="h-1.5 mt-1.5" />
                </div>
                <span className="text-sm font-bold text-foreground">{classGoalPct}%</span>
              </div>
            );
            if (chipKey === 'mission') return (
              <div key={chipKey} className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card shadow-sm px-3.5 py-2.5 shrink-0 max-w-[220px] group cursor-grab" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)}>
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Mission</p>
                  {editingMission ? (
                    <Input value={missionDraft} onChange={e => setMissionDraft(e.target.value)} onBlur={() => saveMission()} onKeyDown={e => e.key === 'Enter' && saveMission()} className="h-5 text-[11px] px-1 py-0 border-0 bg-transparent focus-visible:ring-1" autoFocus />
                  ) : (
                    <p className="text-[11px] font-medium text-foreground truncate cursor-pointer" onClick={() => { setMissionDraft(missionText); setEditingMission(true); }}>{missionText}</p>
                  )}
                </div>
                {!editingMission && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer" onClick={() => { setMissionDraft(missionText); setEditingMission(true); }} />}
              </div>
            );
            if (chipKey === 'word') return (
              <div key={chipKey} className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card shadow-sm px-3.5 py-2.5 shrink-0 group cursor-grab" draggable onDragStart={() => setDragChip(chipKey)} onDragOver={(e: React.DragEvent) => e.preventDefault()} onDrop={() => handleChipDrop(chipKey)}>
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Word</p>
                  {editingWord ? (
                    <Input value={wordDraft} onChange={e => setWordDraft(e.target.value)} onBlur={() => saveWord()} onKeyDown={e => e.key === 'Enter' && saveWord()} className="h-5 text-xs font-bold px-1 py-0 border-0 bg-transparent focus-visible:ring-1" autoFocus />
                  ) : (
                    <p className="text-xs font-bold text-foreground cursor-pointer" onClick={() => { setWordDraft(wordOfWeek); setEditingWord(true); }}>{wordOfWeek}</p>
                  )}
                </div>
                {!editingWord && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer" onClick={() => { setWordDraft(wordOfWeek); setEditingWord(true); }} />}
              </div>
            );
            return null;
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ─── STAFF PRESENCE: Who's Here ─── */}
      {activeGroupId && (
        <StaffPresencePanel
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          studentMap={Object.fromEntries(clients.map(c => [c.id, displayName(c)]))}
          compact
        />
      )}

      {/* ─── STUDENT GRID ─── */}
      {clients.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50 bg-card/50">
          <CardContent className="py-14 text-center">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No students yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[240px] mx-auto">Add students to start tracking behavior, awarding points, and running the game board.</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => navigate('/students')}>Manage Students</Button>
              <Button size="sm" className="gap-1.5" onClick={() => setQuickStartOpen(true)}><Zap className="h-3.5 w-3.5" /> Quick Start</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => {
            const tp = tokenProgress[client.id];
            const tokenPct = tp ? Math.min(100, Math.round((tp.current / tp.target) * 100)) : 0;
            const status = studentStatuses[client.id] || 'present';
            const isAbsent = status === 'absent' || status === 'picked_up';
            const gp = gameProfiles[client.id];
            const avatarEmoji = gp?.avatar_emoji || '👤';
            const level = gp?.current_level || 1;
            const xp = gp?.current_xp || 0;
            const balance = pointBalances[client.id] || 0;
            const isRewardReady = tp && tp.current >= tp.target;
            const hasNegativeEvents = (todayCounts[client.id] || 0) >= 3;

            return (
              <Card
                key={client.id}
                className={cn(
                  'rounded-2xl border-border/60 shadow-sm card-press overflow-hidden relative',
                  'transition-all duration-300',
                  flashCard === client.id && 'ring-2 ring-amber-400/60 scale-[1.01] shadow-md',
                  isAbsent && 'opacity-50',
                  isRewardReady && 'reward-ready-glow',
                  hasNegativeEvents && !flashCard && 'attention-needed',
                )}
              >
                {/* Celebration flash overlay */}
                {flashCard === client.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/5 via-amber-200/10 to-amber-400/5 animate-pulse pointer-events-none z-10 rounded-2xl" />
                )}
                {/* Reward-ready shimmer overlay */}
                {isRewardReady && (
                  <div className="absolute inset-0 reward-ready-shimmer pointer-events-none z-10 rounded-2xl" />
                )}
                <CardContent className="p-0">
                  {/* Top row: avatar + name + level + status */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <button onClick={() => setQuickActionStudent(client)} className="flex items-center gap-2.5 group text-left min-w-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setAvatarPickerStudent(client); }}
                        className="shrink-0 hover:scale-110 transition-transform active:scale-95"
                        title="Change avatar"
                      >
                        <AnimatedAvatar
                          emoji={avatarEmoji}
                          state={(() => {
                            const eff = getEffect(client.id);
                            return eff ? eventTypeToAnimState(eff.eventType) : 'idle';
                          })()}
                          size="sm"
                          className="bg-primary/10"
                        />
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {displayName(client)}
                          </p>
                          {/* Level badge hidden for hybrid v1 — uncomment when ready */}
                          {/* <StudentLevelBadge level={level} xp={xp} compact /> */}
                        </div>
                        <StudentIdentityBadge
                          identityTitle={gp?.identity_title}
                          identityEmoji={gp?.identity_emoji}
                          momentumState={(gp?.momentum_state as any) || null}
                          comebackActive={gp?.comeback_active}
                          compact
                        />
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
                      <div className="flex items-center gap-1.5">
                        <StudentPresenceChip
                          presence={studentPresence[client.id] || null}
                          compact
                          onClick={() => setPresenceSheetStudent(client)}
                        />
                        <StudentStatusBadge
                          studentId={client.id}
                          groupId={activeGroupId}
                          agencyId={effectiveAgencyId}
                          userId={user?.id || ''}
                          currentStatus={status}
                          onStatusChange={handleStudentStatusChange}
                        />
                      </div>
                    )}
                  </div>

                  {/* Middle: Points + Race progress */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center gap-2">
                      <BeaconPointsControls
                        studentId={client.id}
                        staffId={user?.id || ''}
                        agencyId={effectiveAgencyId}
                        balance={pointBalances[client.id] || 0}
                        onPointChange={handlePointChange}
                        onPointAction={(info) => {
                          pushAction({
                            id: info.ledgerRowId || crypto.randomUUID(),
                            label: info.label,
                            studentId: client.id,
                            studentName: displayName(client),
                            ledgerRowId: info.ledgerRowId,
                            points: info.points,
                            agencyId: effectiveAgencyId,
                            staffId: user?.id || '',
                          });
                        }}
                        responseCostEnabled={responseCostMap[client.id] === true}
                      />
                      {todayCounts[client.id] > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0 font-medium text-foreground">
                          {todayCounts[client.id]}
                        </Badge>
                      )}
                    </div>
                    {/* Token board progress — hybrid v1 shows token progress, not XP */}
                    {tp && (
                      <div className="relative mt-1">
                        <Progress value={tokenPct} className="h-2" />
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{tp.current}/{tp.target}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick award row */}
                  <div className="border-t border-border/40 px-3 py-1.5 flex items-center gap-1 flex-wrap">
                    {positiveActions.length > 0 ? (
                      <>
                        {positiveActions.filter(a => !/break\s*card/i.test(a.action_label)).slice(0, 3).map(action => (
                          <button
                            key={action.id}
                            onClick={() => handleTeacherAction(action, client)}
                            title={action.action_label}
                            className="flex items-center gap-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-1.5 py-1 text-[9px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all"
                          >
                            <span className="text-[10px]">{action.action_icon}</span>
                            {action.action_label.replace(/\s*[+-]\d+$/, '')}
                          </button>
                        ))}
                        {positiveActions.filter(a => !/break\s*card/i.test(a.action_label)).length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="rounded-lg border border-border/60 bg-secondary p-1 text-muted-foreground hover:bg-secondary/80 active:scale-90 transition-colors">
                                <MoreHorizontal className="h-3 w-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2 space-y-1" align="start" side="top">
                              {positiveActions.filter(a => !/break\s*card/i.test(a.action_label)).slice(3).map(action => (
                                <button
                                  key={action.id}
                                  onClick={() => handleTeacherAction(action, client)}
                                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
                                >
                                  <span>{action.action_icon}</span>
                                  <span>{action.action_label}</span>
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        )}
                      </>
                    ) : (
                      /* Fallback +1/+5/+10 */
                      [1, 5, 10].map(n => (
                        <button
                          key={n}
                          onClick={async () => {
                            handlePointChange(client.id, n);
                            setFlashCard(client.id);
                            setTimeout(() => setFlashCard(null), 800);
                            if ('vibrate' in navigator) navigator.vibrate(10);
                            if (user) {
                              const result = await writePointEntry({
                                studentId: client.id, staffId: user.id, agencyId: effectiveAgencyId,
                                points: n, reason: `Quick +${n}`, source: 'quick_action', entryKind: 'manual',
                              });
                              pushAction({
                                id: result.id || crypto.randomUUID(),
                                label: `Quick +${n}`,
                                studentId: client.id,
                                studentName: displayName(client),
                                ledgerRowId: result.id,
                                points: n,
                                agencyId: effectiveAgencyId,
                                staffId: user.id,
                              });
                            }
                            toast({ title: `+${n} ⭐ ${displayName(client)}` });
                          }}
                          className="flex items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-95 transition-all"
                        >
                          <Star className="h-3 w-3" />+{n}
                        </button>
                      ))
                    )}
                    <div className="ml-auto flex gap-1">
                      {/* + button: student goals, replacement behaviors, manual, quick +1 */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button title="Award points" className="rounded-lg border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                            <Zap className="h-3 w-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2 space-y-1 max-h-72 overflow-y-auto" align="end" side="top">
                          {/* Quick +1 */}
                          <button
                            onClick={async () => {
                              handlePointChange(client.id, 1);
                              setFlashCard(client.id);
                              setTimeout(() => setFlashCard(null), 800);
                              if ('vibrate' in navigator) navigator.vibrate(10);
                              if (user) {
                                const result = await writePointEntry({
                                  studentId: client.id, staffId: user.id, agencyId: effectiveAgencyId,
                                  points: 1, reason: 'Quick +1', source: 'quick_action', entryKind: 'manual',
                                });
                                pushAction({
                                  id: result.id || crypto.randomUUID(), label: 'Quick +1',
                                  studentId: client.id, studentName: displayName(client),
                                  ledgerRowId: result.id, points: 1, agencyId: effectiveAgencyId, staffId: user.id,
                                });
                              }
                              toast({ title: `+1 ⭐ ${displayName(client)}` });
                            }}
                            className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
                          >
                            <span>⭐</span><span>Quick +1</span>
                          </button>

                          {/* Manual actions */}
                          {manualActions.map(action => (
                            <button
                              key={action.id}
                              onClick={() => handleTeacherAction(action, client)}
                              className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
                            >
                              <span>{action.action_icon}</span>
                              <span>{action.action_label}</span>
                            </button>
                          ))}

                          {/* Student-specific skill acquisition goals */}
                          {(studentTargets[client.id] || []).length > 0 && (
                            <>
                              <div className="border-t border-border/30 pt-1 mt-1">
                                <p className="text-[9px] font-semibold text-muted-foreground px-2 pb-1 uppercase tracking-wide">Skill Goals</p>
                              </div>
                              {studentTargets[client.id].map(target => (
                                <button
                                  key={target.id}
                                  onClick={async () => {
                                    handlePointChange(client.id, target.points);
                                    setFlashCard(client.id);
                                    setTimeout(() => setFlashCard(null), 800);
                                    if ('vibrate' in navigator) navigator.vibrate(10);
                                    if (user) {
                                      const result = await writePointEntry({
                                        studentId: client.id, staffId: user.id, agencyId: effectiveAgencyId,
                                        points: target.points, reason: target.name, source: 'goal_success',
                                        entryKind: 'teacher_data_event',
                                      });
                                      pushAction({
                                        id: result.id || crypto.randomUUID(), label: target.name,
                                        studentId: client.id, studentName: displayName(client),
                                        ledgerRowId: result.id, points: target.points, agencyId: effectiveAgencyId, staffId: user.id,
                                      });
                                      // Also log the event
                                      writeUnifiedEvent({
                                        studentId: client.id, staffId: user.id, agencyId: effectiveAgencyId,
                                        eventType: 'skill_probe', eventSubtype: target.name,
                                        eventValue: { points: target.points, target_id: target.id },
                                        sourceModule: 'classroom_view',
                                      });
                                    }
                                    toast({ title: `${target.icon || '🎯'} +${target.points} ${target.name} · ${displayName(client)}` });
                                  }}
                                  className="flex items-center justify-between w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
                                >
                                  <span className="flex items-center gap-2">
                                    <span>{target.icon || '🎯'}</span>
                                    <span className="truncate max-w-[120px]">{target.name}</span>
                                  </span>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">+{target.points}</Badge>
                                </button>
                              ))}
                            </>
                          )}
                        </PopoverContent>
                      </Popover>
                      <button onClick={() => navigate('/rewards')} title="Rewards"
                        className="rounded-lg border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <Gift className="h-3 w-3" />
                      </button>
                      <button onClick={() => navigate('/game-board')} title="Game Board"
                        className="rounded-lg border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <Gamepad2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setReinforceStudent(client)} title="Reinforcement settings"
                        className="rounded-lg border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <Settings2 className="h-3 w-3" />
                      </button>
                      <button onClick={() => setQuickActionStudent(client)} title="Student code & more"
                        className="rounded-lg border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-90 transition-colors">
                        <KeyRound className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Behavior + engagement row */}
                  <div className="border-t border-border/40 px-3 py-1.5 flex items-center gap-1 flex-wrap">
                    {/* Per-student custom behaviors take priority */}
                    {(studentBehaviors[client.id] || []).length > 0 ? (
                      <>
                        {studentBehaviors[client.id].slice(0, 3).map((rule, idx) => (
                          <button
                            key={`${rule.behavior_name}-${idx}`}
                            onClick={() => logBehavior(client.id, rule.behavior_name)}
                            title={`${rule.behavior_name} (${rule.rule_type === 'response_cost' ? `-${rule.points}` : `+${rule.points}`})`}
                            className={cn(
                              "flex items-center gap-0.5 rounded-lg border px-1.5 py-1 text-[9px] font-medium active:scale-95 transition-colors",
                              rule.rule_type === 'response_cost'
                                ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                                : "border-border/60 bg-secondary text-foreground hover:bg-destructive/10 hover:text-destructive"
                            )}
                          >
                            {rule.behavior_name.slice(0, 5)}
                          </button>
                        ))}
                        {studentBehaviors[client.id].length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="rounded-xl border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-secondary/80 active:scale-90 transition-colors">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2 space-y-1" align="start" side="top">
                              {studentBehaviors[client.id].slice(3).map((rule, idx) => (
                                <button
                                  key={`${rule.behavior_name}-overflow-${idx}`}
                                  onClick={() => logBehavior(client.id, rule.behavior_name)}
                                  className="flex items-center justify-between w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-destructive/10 transition-colors text-left"
                                >
                                  <span>{rule.behavior_name}</span>
                                  <Badge variant={rule.rule_type === 'response_cost' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1.5">
                                    {rule.rule_type === 'response_cost' ? `-${rule.points}` : `+${rule.points}`}
                                  </Badge>
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        )}
                      </>
                    ) : behaviorActions.length > 0 ? (
                      <>
                        {behaviorActions.slice(0, 3).map(action => (
                          <button
                            key={action.id}
                            onClick={() => handleTeacherAction(action, client)}
                            title={action.action_label}
                            className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-secondary px-1.5 py-1 text-[9px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-colors"
                          >
                            <span className="text-[10px]">{action.action_icon}</span>
                            {(action.default_behavior_name || action.action_label).slice(0, 4)}
                          </button>
                        ))}
                        {behaviorActions.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="rounded-xl border border-border/60 bg-secondary p-1.5 text-muted-foreground hover:bg-secondary/80 active:scale-90 transition-colors">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-2 space-y-1" align="start" side="top">
                              {behaviorActions.slice(3).map(action => (
                                <button
                                  key={action.id}
                                  onClick={() => handleTeacherAction(action, client)}
                                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-destructive/10 transition-colors text-left"
                                >
                                  <span>{action.action_icon}</span>
                                  <span>{action.action_label}</span>
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        )}
                      </>
                    ) : (
                      /* Fallback hardcoded behaviors */
                      BEHAVIORS.slice(0, 3).map(({ name, abbr, icon: Icon }) => (
                        <button
                          key={name}
                          onClick={() => logBehavior(client.id, name)}
                          title={name}
                          className="flex items-center gap-1 rounded-xl border border-border/60 bg-secondary px-2 py-1.5 text-[10px] font-medium text-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-colors"
                        >
                          <Icon className="h-3 w-3" />{abbr}
                        </button>
                      ))
                    )}
                    <button
                      onClick={() => navigate(`/collect?student=${client.id}`)}
                      className="flex items-center gap-0.5 rounded-lg border border-primary/30 bg-primary/5 px-1.5 py-1 text-[9px] font-medium text-primary hover:bg-primary/10 active:scale-95 transition-colors"
                    >
                      <Target className="h-2.5 w-2.5" />Data
                    </button>
                    <div className="ml-auto flex gap-1">
                      <button onClick={() => logEngagement(client.id, true)} title="Engaged"
                        className="rounded-xl border border-accent/30 bg-accent/10 p-1.5 text-accent hover:bg-accent/20 active:scale-90 transition-colors">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={() => logEngagement(client.id, false)} title="Not engaged"
                        className="rounded-xl border border-destructive/20 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10 active:scale-90 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── TEACHER WINS FEED ─── */}
      {clients.length > 0 && (
        <TeacherWinsFeed
          agencyId={effectiveAgencyId}
          studentIds={clients.map(c => c.id)}
          studentNames={studentNameMap}
        />
      )}

      {/* ─── BOTTOM BAND: Reward Preview + Celebration Feed ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Reward preview strip */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-4 w-4 text-pink-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rewards</span>
              <button onClick={() => navigate('/rewards')} className="ml-auto text-xs text-primary font-medium hover:underline">View All</button>
            </div>
            <RewardPreviewStrip agencyId={effectiveAgencyId} classroomId={activeGroupId} />
          </CardContent>
        </Card>

        {/* Celebration / kid-safe feed */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Celebrations</span>
              <button onClick={() => navigate('/classroom-feed')} className="ml-auto text-xs text-primary font-medium hover:underline">Feed</button>
            </div>
            <CelebrationFeedStrip groupId={activeGroupId} />
          </CardContent>
        </Card>
      </div>

      {/* ─── END SESSION BUTTON ─── */}
      {sessionMinutes >= 10 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs rounded-xl"
            onClick={() => setSessionSummaryOpen(true)}
          >
            <BarChart3 className="h-3.5 w-3.5" /> End Session · View Summary
          </Button>
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
          responseCostEnabled={responseCostMap[quickActionStudent.id] === true}
          onBehavior={(name) => logBehavior(quickActionStudent.id, name)}
          onEngagement={(engaged) => logEngagement(quickActionStudent.id, engaged)}
          onPointChange={handlePointChange}
        />
      )}

      {/* Student Presence Sheet */}
      {presenceSheetStudent && activeGroupId && (
        <StudentPresenceSheet
          open={!!presenceSheetStudent}
          onOpenChange={(open) => { if (!open) setPresenceSheetStudent(null); }}
          studentId={presenceSheetStudent.id}
          studentName={displayName(presenceSheetStudent)}
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          currentPresence={studentPresence[presenceSheetStudent.id] || null}
          onPresenceUpdate={handleStudentPresenceUpdate}
        />
      )}

      {/* Undo Toast */}
      <UndoToast action={pendingAction} onUndo={handleUndoComplete} onDismiss={dismissAction} />

      {/* Bulk Award Panel */}
      {activeGroupId && (
        <BulkAwardPanel
          open={bulkAwardOpen}
          onOpenChange={setBulkAwardOpen}
          agencyId={effectiveAgencyId}
          groupId={activeGroupId}
          staffId={user?.id || ''}
          studentIds={clients.map(c => c.id)}
          classGoal={{ target: classGoal.target, label: classGoal.label }}
          onClassGoalChange={(g) => setClassGoal(prev => ({ ...prev, ...g }))}
          onPointsAwarded={(pts) => {
            clients.forEach(c => handlePointChange(c.id, pts));
          }}
        />
      )}

      {/* Reinforcement Assign Panel */}
      {reinforceStudent && (
        <ReinforcementAssignPanel
          open={!!reinforceStudent}
          onOpenChange={(open) => { if (!open) setReinforceStudent(null); }}
          studentId={reinforceStudent.id}
          studentName={displayName(reinforceStudent)}
          agencyId={effectiveAgencyId}
        />
      )}

      {/* Classroom Reinforcement Panel */}
      {activeGroupId && (
        <ClassroomReinforcementPanel
          open={classReinforcementOpen}
          onOpenChange={setClassReinforcementOpen}
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          students={clients.map(c => ({ id: c.id, name: displayName(c) }))}
        />
      )}

      {/* Avatar Picker */}
      {avatarPickerStudent && (
        <AvatarPicker
          open={!!avatarPickerStudent}
          onOpenChange={(open) => { if (!open) setAvatarPickerStudent(null); }}
          studentId={avatarPickerStudent.id}
          agencyId={effectiveAgencyId}
          currentEmoji={gameProfiles[avatarPickerStudent.id]?.avatar_emoji || '👤'}
        />
      )}

      {/* Session Summary Popup */}
      <SessionSummaryPopup
        open={sessionSummaryOpen}
        onOpenChange={setSessionSummaryOpen}
        agencyId={effectiveAgencyId}
        studentIds={clients.map(c => c.id)}
        studentNames={studentNameMap}
      />

      {/* Quick Start Setup */}
      <QuickStartSetup
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
        agencyId={effectiveAgencyId}
        onComplete={(groupId) => { setActiveGroupId(groupId); loadClients(); }}
      />
    </div>
  );
};

/* ── Summary chip for the horizontal bar ── */
function SummaryChip({ icon: Icon, label, value, color, draggable, onDragStart, onDragOver, onDrop }: {
  icon: any; label: string; value: string; color: string;
  draggable?: boolean; onDragStart?: () => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card shadow-sm px-3.5 py-2.5 shrink-0", draggable && "cursor-grab")}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <Icon className={cn('h-4 w-4', color)} />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm font-bold leading-none text-foreground">{value}</p>
      </div>
    </div>
  );
}

/* ── Reward preview strip (bottom band left) ── */
function RewardPreviewStrip({ agencyId, classroomId }: { agencyId: string; classroomId?: string | null }) {
  const [rewards, setRewards] = useState<{ name: string; emoji: string; cost: number }[]>([]);
  useEffect(() => {
    if (!agencyId) return;
    // Try classroom-scoped first, then agency-scoped
    const scopeType = classroomId ? 'classroom' : 'agency';
    const scopeId = classroomId || agencyId;
    // Use core-bridge to load rewards (avoids Core column mismatch)
    invokeCloudFunction<{ rewards: any[] }>('core-bridge', {
      action: 'list_rewards', scope_type: scopeType, scope_id: scopeId, include_inactive: false,
    }).then(result => {
      const items = (result?.data?.rewards || []).map((r: any) => ({ name: r.name, emoji: r.image_url || '🎁', cost: r.cost }));
      if (items.length > 0) {
        setRewards(items);
      } else if (classroomId) {
        invokeCloudFunction<{ rewards: any[] }>('core-bridge', {
          action: 'list_rewards', scope_type: 'agency', scope_id: agencyId, include_inactive: false,
        }).then(fallback => {
          setRewards((fallback?.data?.rewards || []).map((r: any) => ({ name: r.name, emoji: r.image_url || '🎁', cost: r.cost })));
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [agencyId, classroomId]);

  if (rewards.length === 0) return <p className="text-xs text-muted-foreground">No rewards configured yet.</p>;
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1">
      {rewards.map((r, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-3 py-2 shrink-0">
          <span className="text-lg">{r.emoji}</span>
          <div>
            <p className="text-[11px] font-semibold leading-tight text-foreground">{r.name}</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tabular-nums">⭐ {r.cost}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Celebration feed strip (bottom band right) ── */
function CelebrationFeedStrip({ groupId }: { groupId: string | null }) {
  const [posts, setPosts] = useState<{ id: string; body: string; title: string | null; post_type: string }[]>([]);
  useEffect(() => {
    if (!groupId) return;
    cloudSupabase.from('classroom_feed_posts')
      .select('id, body, title, post_type')
      .eq('group_id', groupId)
      .in('post_type', ['celebration', 'announcement', 'positive'])
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }: any) => setPosts((data || []) as any[]));
  }, [groupId]);

  if (posts.length === 0) return <p className="text-xs text-muted-foreground">No celebrations yet today. 🎉</p>;
  return (
    <div className="space-y-2">
      {posts.map(p => (
        <div key={p.id} className="rounded-xl bg-secondary/50 px-3 py-2">
          {p.title && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{p.title}</p>}
          <p className="text-[11px] text-foreground/80 leading-snug">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

export default ClassroomView;
