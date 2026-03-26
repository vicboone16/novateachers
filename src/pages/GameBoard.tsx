/**
 * GameBoard — Dynamic Game Engine with curved track, zones, checkpoints,
 * momentum streaks, comeback mechanics, floating feedback, and track selector.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useStudentGameProfiles } from '@/hooks/useStudentGameProfiles';
import { useGameTrack } from '@/hooks/useGameTrack';
import { useGameEvents } from '@/hooks/useGameEvents';
import { useGameEngine } from '@/hooks/useGameEngine';
import { CurvedTrackBoard } from '@/components/CurvedTrackBoard';
import { TrackSelector } from '@/components/TrackSelector';
import { TeamManager } from '@/components/TeamManager';
import { DailyQuestPanel } from '@/components/DailyQuestPanel';
import { useAvatarAnimations } from '@/hooks/useAvatarAnimations';
import { StudentLevelBadge } from '@/components/StudentLevelBadge';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { getClassroomGameSettings, getClassroomGameProgress, getTeamScores } from '@/lib/game-data';
import { getStudentBalances } from '@/lib/beacon-points';
import { POINT_SKINS, type ClassroomGameSettings, type StudentGameProgress, type TeamScore } from '@/lib/game-types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Trophy, Users, Flag, Zap, PartyPopper, CheckCircle, RotateCcw, Settings, AlertTriangle, Map, Flame, Scroll, Gamepad2 } from 'lucide-react';
import { GameModeSelector } from '@/components/GameModeSelector';
import { cn } from '@/lib/utils';
import { displayInitials, displayName as getStudentDisplayName } from '@/lib/student-utils';

const CHECKPOINT_INTERVAL = 10;

const getPosition = (balance: number, trackLength: number) => {
  const effective = balance % trackLength;
  return effective === 0 && balance > 0 ? trackLength : effective;
};
const getLaps = (balance: number, trackLength: number) => Math.floor(balance / trackLength);
const getCheckpointsReached = (pos: number) => Math.floor(pos / CHECKPOINT_INTERVAL);

const GameBoard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { groupId: sharedGroupId, loading: classroomLoading, error: classroomError, errorReason, setGroupId: setSharedGroupId } = useActiveClassroom();
  const { toast } = useToast();
  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const [settings, setSettings] = useState<ClassroomGameSettings | null>(null);
  const [students, setStudents] = useState<StudentGameProgress[]>([]);
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [liveBalances, setLiveBalances] = useState<Record<string, number>>({});
  const [recentCheckpoint, setRecentCheckpoint] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [allGroups, setAllGroups] = useState<{ group_id: string; name: string }[]>([]);
  const [trackSelectorOpen, setTrackSelectorOpen] = useState(false);
  const [teamManagerOpen, setTeamManagerOpen] = useState(false);
  const [gameMode, setGameMode] = useState<string>('race');
  const [modeSelectorOpen, setModeSelectorOpen] = useState(false);

  const studentIds = students.map(s => s.student_id);
  const { profiles: gameProfiles } = useStudentGameProfiles(studentIds);
  const { track, allTracks, movementStyle, refetch: refetchTrack } = useGameTrack(activeGroupId);
  const { getEffect } = useGameEvents({ classroomId: activeGroupId, agencyId: effectiveAgencyId, enabled: !!activeGroupId });
  const { triggerFromEvent, getAnimState } = useAvatarAnimations();

  const TRACK_LENGTH = track?.total_steps || 100;

  const getEffectiveBalance = (s: StudentGameProgress) => liveBalances[s.student_id] ?? s.points_balance ?? 0;

  // Build engine students for momentum calculations
  const sortedStudents = useMemo(() =>
    [...students].sort((a, b) => getEffectiveBalance(b) - getEffectiveBalance(a)),
    [students, liveBalances]
  );

  const engineStudents = useMemo(() =>
    sortedStudents.map((s, i) => {
      const bal = getEffectiveBalance(s);
      const pos = getPosition(bal, TRACK_LENGTH);
      return {
        student_id: s.student_id,
        balance: bal,
        rank: i + 1,
        progress: Math.min(pos / TRACK_LENGTH, 1),
      };
    }),
    [sortedStudents, liveBalances, TRACK_LENGTH]
  );

  const { feedbacks, studentStatuses, recordCheckpoint } = useGameEngine({
    classroomId: activeGroupId,
    agencyId: effectiveAgencyId,
    modeSlug: (settings as any)?.game_mode || 'race',
    students: engineStudents,
    zones: track?.zones || [],
    enabled: !!activeGroupId,
  });

  // Load all groups
  useEffect(() => {
    if (!user || !effectiveAgencyId) return;
    cloudSupabase
      .from('classroom_groups')
      .select('group_id, name')
      .eq('agency_id', effectiveAgencyId)
      .order('name')
      .then(({ data }) => setAllGroups(data || []));
  }, [user, effectiveAgencyId]);

  useEffect(() => {
    if (sharedGroupId) setActiveGroupId(sharedGroupId);
    else if (!classroomLoading && !sharedGroupId) setLoading(false);
  }, [sharedGroupId, classroomLoading]);

  useEffect(() => { if (activeGroupId) loadBoard(); }, [activeGroupId]);

  const handleGroupChange = (gid: string) => {
    setActiveGroupId(gid);
    setSharedGroupId(gid);
  };

  const handleTrackSelect = async (trackId: string) => {
    if (!activeGroupId) return;
    try {
      const { data: existing } = await cloudSupabase
        .from('classroom_game_settings')
        .select('id')
        .eq('group_id', activeGroupId)
        .maybeSingle();
      if (existing) {
        await cloudSupabase.from('classroom_game_settings').update({ track_id: trackId }).eq('group_id', activeGroupId);
      } else {
        await cloudSupabase.from('classroom_game_settings').insert({
          group_id: activeGroupId,
          agency_id: effectiveAgencyId,
          track_id: trackId,
        });
      }
      refetchTrack();
      toast({ title: '🗺️ Track updated!' });
    } catch (e: any) {
      toast({ title: 'Failed to update track', description: e.message, variant: 'destructive' });
    }
  };

  const loadBoard = async () => {
    if (!activeGroupId || !user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [s, prog, t] = await Promise.all([
        getClassroomGameSettings(activeGroupId),
        getClassroomGameProgress(activeGroupId),
        getTeamScores(activeGroupId),
      ]);
      if (prog && prog.length > 0) {
        setSettings(s); setStudents(prog); setTeams(t);
        const bals = await getStudentBalances(user.id, prog.map(p => p.student_id));
        setLiveBalances(bals);
      } else {
        await loadBoardFallback();
      }
    } catch (e) {
      console.warn('[GameBoard] Core load error, using fallback:', e);
      await loadBoardFallback();
    }
    setLoading(false);
  };

  const loadBoardFallback = async () => {
    if (!activeGroupId || !user) return;
    try {
      const { data: groupStudents } = await cloudSupabase.from('classroom_group_students').select('client_id').eq('group_id', activeGroupId);
      const sids = (groupStudents || []).map((s: any) => s.client_id);
      if (sids.length === 0) { setStudents([]); return; }

      const bals = await getStudentBalances(user.id, sids);
      setLiveBalances(bals);

      const nameMap: Record<string, { first_name: string; last_name: string }> = {};
      try {
        const { data: grpData } = await cloudSupabase.from('classroom_groups').select('agency_id').eq('group_id', activeGroupId).maybeSingle();
        const aid = (grpData as any)?.agency_id;
        if (aid) {
          const { data: allClients } = await supabase.from('clients' as any).select('client_id, id, first_name, last_name').eq('agency_id', aid);
          for (const c of (allClients || []) as any[]) {
            const cid = c.client_id || c.id;
            if (sids.includes(cid)) {
              nameMap[cid] = { first_name: c.first_name || '', last_name: c.last_name || '' };
              // Write back to Cloud for public board access
              if (c.first_name || c.last_name) {
                cloudSupabase.from('classroom_group_students')
                  .update({ first_name: c.first_name || null, last_name: c.last_name || null } as any)
                  .eq('group_id', activeGroupId).eq('client_id', cid).then(() => {});
              }
            }
          }
        }
      } catch { /* silent */ }

      const avatarMap: Record<string, string> = {};
      try {
        const { data: profiles } = await supabase.from('student_game_profiles' as any).select('student_id, avatar_emoji').in('student_id', sids);
        for (const p of (profiles || []) as any[]) avatarMap[p.student_id] = p.avatar_emoji || '';
      } catch { /* silent */ }

      const fallbackStudents: StudentGameProgress[] = sids.map(sid => {
        const names = nameMap[sid];
        return {
          student_id: sid,
          first_name: names?.first_name || '',
          last_name: names?.last_name || '',
          avatar_emoji: avatarMap[sid] || '👤',
          points_balance: bals[sid] || 0,
          track_position: getPosition(bals[sid] || 0, TRACK_LENGTH),
        } as any;
      });
      setStudents(fallbackStudents);
    } catch (err: any) {
      console.error('[GameBoard] Fallback load failed:', err);
      setLoadError('Could not load game data. Please try again.');
    }
  };

  // Realtime subscription for points
  useEffect(() => {
    if (!user) return;
    const channel = cloudSupabase.channel('game-board-live').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'beacon_points_ledger',
    }, async (payload: any) => {
      const sid = payload.new?.student_id;
      if (sid && students.some(s => s.student_id === sid)) {
        const sids = students.map(s => s.student_id);
        const bals = await getStudentBalances(user.id, sids);
        setLiveBalances(prev => {
          const prevBal = prev[sid] || 0;
          const newBal = bals[sid] || 0;
          const prevCp = getCheckpointsReached(getPosition(prevBal, TRACK_LENGTH));
          const newCp = getCheckpointsReached(getPosition(newBal, TRACK_LENGTH));
          if (newCp > prevCp || getLaps(newBal, TRACK_LENGTH) > getLaps(prevBal, TRACK_LENGTH)) {
            setRecentCheckpoint(sid);
            setTimeout(() => setRecentCheckpoint(null), 3000);
          }
          // Check checkpoint crossings from track data
          if (track?.checkpoints) {
            const prevProg = getPosition(prevBal, TRACK_LENGTH) / TRACK_LENGTH;
            const newProg = getPosition(newBal, TRACK_LENGTH) / TRACK_LENGTH;
            for (const cp of track.checkpoints) {
              if (prevProg < cp.progress_pct && newProg >= cp.progress_pct) {
                recordCheckpoint(sid, cp.label, cp.reward_points);
              }
            }
          }
          return bals;
        });
        // Trigger avatar animation on point change
        const pts = payload.new?.points || 0;
        triggerFromEvent(sid, pts > 0 ? 'points_awarded' : 'points_deducted');
        setFlash(sid);
        setTimeout(() => setFlash(null), 1500);
      }
    }).subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [user, students, TRACK_LENGTH, track?.checkpoints, recordCheckpoint]);

  const handleReset = async () => {
    if (!user || !activeGroupId) return;
    setResetting(true);
    try {
      const sids = students.map(s => s.student_id);
      for (const sid of sids) {
        await cloudSupabase.from('beacon_points_ledger').delete().eq('staff_id', user.id).eq('student_id', sid);
      }
      setLiveBalances({});
      toast({ title: '🔄 Race reset!', description: 'All positions reset to start.' });
      setResetOpen(false);
      loadBoard();
    } catch (err: any) { toast({ title: 'Reset failed', description: err.message, variant: 'destructive' }); }
    finally { setResetting(false); }
  };

  const skin = POINT_SKINS[(settings as any)?.point_display_type || 'stars'];
  const totalClassPoints = students.reduce((sum, s) => sum + getEffectiveBalance(s), 0);
  const finishedCount = students.filter(s => getEffectiveBalance(s) >= TRACK_LENGTH).length;

  const getDisplayName = (s: StudentGameProgress) => {
    const mode = (settings as any)?.privacy_mode || 'first_names';
    if (mode === 'avatars_only') return '';
    const safeDisplayName = getStudentDisplayName({
      id: s.student_id,
      client_id: s.student_id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
    });
    const first = s.first_name || '';
    if (mode === 'initials') return displayInitials({ first_name: s.first_name, last_name: s.last_name, id: s.student_id });
    if (mode === 'first_names') return first || safeDisplayName;
    return safeDisplayName;
  };

  // Build track students with engine data
  const trackStudents = useMemo(() => {
    return students.map(s => {
      const bal = getEffectiveBalance(s);
      const pos = getPosition(bal, TRACK_LENGTH);
      const progress = Math.min(pos / TRACK_LENGTH, 1);
      const status = studentStatuses[s.student_id];
      // Find active zone for this student
      const activeZone = (track?.zones || []).find(z => progress >= z.start_pct && progress <= z.end_pct) || null;
      return {
        student_id: s.student_id,
        avatar_emoji: s.avatar_emoji || '👤',
        name: getDisplayName(s),
        progress,
        balance: bal,
        laps: getLaps(bal, TRACK_LENGTH),
        isFlashing: flash === s.student_id,
        teamColor: s.team_color,
        activeEffect: getEffect(s.student_id)?.effect ?? null,
        avatarAnimState: getAnimState(s.student_id),
        hasComeback: status?.hasComeback || false,
        streakEmoji: status?.emoji || null,
        activeZone: activeZone ? { type: activeZone.type, color: activeZone.color, label: activeZone.label, multiplier: activeZone.multiplier } : null,
      };
    });
  }, [students, liveBalances, flash, TRACK_LENGTH, (settings as any)?.privacy_mode, getEffect, getAnimState, studentStatuses, track?.zones]);

  const activeGroup = allGroups.find(g => g.group_id === activeGroupId);

  if (classroomLoading || (loading && activeGroupId)) return (
    <div className="flex min-h-[60vh] items-center justify-center flex-col gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-xs text-muted-foreground">Loading race board…</p>
    </div>
  );

  if (loadError) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60" />
        <p className="text-sm font-medium text-destructive">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => loadBoard()}>Retry</Button>
      </div>
    </div>
  );

  if (!activeGroupId) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <Flag className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {classroomError || 'No classroom found. Create a classroom group first.'}
        </p>
        {errorReason === 'no_teacher_assignment' && <p className="text-xs text-muted-foreground">You are not assigned to any classroom as staff.</p>}
        {errorReason === 'no_classrooms_at_all' && <p className="text-xs text-muted-foreground">No classroom groups exist yet.</p>}
        <Button variant="outline" size="sm" onClick={() => navigate('/classrooms')}>Classroom Manager</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')} className="gap-1"><ArrowLeft className="h-4 w-4" /> Classroom</Button>
        <h1 className="text-lg font-bold font-heading flex items-center gap-2"><Flag className="h-5 w-5 text-accent" /> Race Board</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModeSelectorOpen(true)} title="Game Mode"><Gamepad2 className="h-4 w-4 text-muted-foreground" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTeamManagerOpen(true)} title="Teams"><Users className="h-4 w-4 text-muted-foreground" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTrackSelectorOpen(true)} title="Change Track"><Map className="h-4 w-4 text-muted-foreground" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/game-settings')} title="Game Settings"><Settings className="h-4 w-4 text-muted-foreground" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetOpen(true)} title="Reset race"><RotateCcw className="h-4 w-4 text-muted-foreground" /></Button>
        </div>
      </div>

      {/* Classroom selector */}
      {allGroups.length > 1 && (
        <Select value={activeGroupId || ''} onValueChange={handleGroupChange}>
          <SelectTrigger className="h-9 text-sm font-medium border-border/60 rounded-xl">
            <SelectValue placeholder="Select classroom…" />
          </SelectTrigger>
          <SelectContent>
            {allGroups.map(g => (
              <SelectItem key={g.group_id} value={g.group_id} className="text-sm">{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Class banner */}
      <Card className="overflow-hidden border-0 shadow-md">
        <CardContent className="p-4 bg-gradient-to-r from-primary/8 via-accent/5 to-primary/8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {activeGroup?.name || 'Class'} · Race Total
              </p>
              <p className="text-3xl font-bold tabular-nums font-heading">{skin.icon} {totalClassPoints.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {finishedCount > 0 && (
                <Badge className="bg-accent/15 text-accent border-accent/20 gap-1 font-semibold"><PartyPopper className="h-3 w-3" /> {finishedCount} lapped!</Badge>
              )}
              {track?.zones && track.zones.length > 0 && (
                <div className="flex gap-1">
                  {track.zones.map((z, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] py-0.5 font-medium" style={{ borderColor: z.color, color: z.color }}>
                      {z.type === 'boost' ? '⚡' : z.type === 'slow' ? '❄️' : z.type === 'reward' ? '🎁' : '✨'} {z.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team scores */}
      {settings?.allow_team_mode && teams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {teams.map(t => (
            <Card key={t.team_id} className="shrink-0 min-w-[120px] border-border/40">
              <CardContent className="p-3 text-center">
                <span className="text-xl">{t.team_icon}</span>
                <p className="text-xs font-bold mt-1" style={{ color: t.team_color }}>{t.team_name}</p>
                <p className="text-lg font-bold tabular-nums">{t.total_points}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Curved Race Track */}
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              <p className="text-sm font-bold">{track?.name || 'Race Track'}</p>
              {track?.theme && <Badge variant="outline" className="text-[9px]">{track.theme.name}</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground">{TRACK_LENGTH}pt lap · {track?.zones.length || 0} zones · {track?.checkpoints.length || 0} checkpoints</p>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No students in this classroom group yet.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/classrooms')}>Add Students</Button>
            </div>
          ) : track ? (
            <CurvedTrackBoard
              nodes={track.nodes}
              totalSteps={TRACK_LENGTH}
              students={trackStudents}
              zones={track.zones}
              checkpoints={track.checkpoints}
              theme={track.theme}
              feedbacks={feedbacks}
              className="border border-border/30"
              trackType={(track.track_type || 'curved') as any}
              movementStyle={(movementStyle || 'glide') as any}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Standings with momentum indicators */}
      {settings?.show_leaderboard !== false && students.length > 0 && (
        <Card className="border-border/40 hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4"><Trophy className="h-4 w-4 text-amber-500" /><p className="text-sm font-bold font-heading">Standings</p><Badge variant="outline" className="text-[9px] ml-auto">{students.length} racers</Badge></div>
            <div className="space-y-0.5">
              {sortedStudents.slice(0, 10).map((s, i) => {
                const bal = getEffectiveBalance(s);
                const pos = getPosition(bal, TRACK_LENGTH);
                const laps = getLaps(bal, TRACK_LENGTH);
                const isFlashing = flash === s.student_id;
                const name = getDisplayName(s);
                const distToFinish = Math.max(0, TRACK_LENGTH - pos);
                const status = studentStatuses[s.student_id];

                return (
                  <div key={s.student_id} className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500",
                    isFlashing && "bg-accent/10 ring-1 ring-accent/30",
                    laps > 0 && "bg-accent/5"
                  )}>
                    <span className={cn("text-sm font-bold w-5 text-center tabular-nums",
                      i === 0 && "rank-gold", i === 1 && "rank-silver", i === 2 && "rank-bronze",
                      i > 2 && "text-muted-foreground"
                    )}>{i + 1}</span>
                    <span className="text-lg">{s.avatar_emoji || '👤'}</span>
                    <span className="flex-1 text-sm font-medium truncate text-foreground">{name || 'Student'}</span>

                    {/* Momentum indicators */}
                    {status?.status === 'on_fire' && (
                      <Badge className="text-[9px] bg-orange-100 text-orange-700 border-orange-200 gap-0.5 dark:bg-orange-900/20 dark:text-orange-400">
                        <Flame className="h-2.5 w-2.5" /> {status.streak}🔥
                      </Badge>
                    )}
                    {status?.status === 'heating_up' && (
                      <Badge variant="outline" className="text-[9px] gap-0.5 text-orange-500 border-orange-200">
                        🔥 Heating up
                      </Badge>
                    )}
                    {status?.status === 'close_to_reward' && (
                      <Badge variant="outline" className="text-[9px] gap-0.5 text-accent border-accent/30">
                        🎯 Close!
                      </Badge>
                    )}
                    {status?.hasComeback && (
                      <Badge variant="outline" className="text-[9px] text-blue-500 border-blue-200">💪</Badge>
                    )}

                    <StudentLevelBadge level={gameProfiles[s.student_id]?.current_level || 1} xp={gameProfiles[s.student_id]?.current_xp || 0} compact />
                    {laps > 0 && <Badge className="text-[9px] bg-accent/20 text-accent-foreground border-accent/30 gap-0.5"><CheckCircle className="h-2 w-2" />Lap {laps}</Badge>}
                    <Badge variant="outline" className="text-[10px] tabular-nums gap-0.5 shrink-0">{skin.icon} {bal}</Badge>
                    {distToFinish > 0 && <span className="text-[9px] text-muted-foreground shrink-0 whitespace-nowrap">{distToFinish}pts left</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Quests */}
      {activeGroupId && (
        <DailyQuestPanel
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          showCreateButton
          compact
        />
      )}

      {/* Track Selector */}
      <TrackSelector
        tracks={allTracks}
        activeTrackId={track?.id || null}
        onSelect={handleTrackSelect}
        open={trackSelectorOpen}
        onOpenChange={setTrackSelectorOpen}
      />

      {/* Team Manager */}
      {activeGroupId && (
        <TeamManager
          open={teamManagerOpen}
          onOpenChange={setTeamManagerOpen}
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          students={students.map(s => ({
            student_id: s.student_id,
            name: getDisplayName(s),
            avatar_emoji: s.avatar_emoji || '👤',
          }))}
          onTeamsChanged={loadBoard}
        />
      )}

      {/* Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2 text-destructive"><RotateCcw className="h-5 w-5" /> Reset Race</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">This will delete all point entries and reset all students to the starting position. This cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1" onClick={handleReset} disabled={resetting}>
                {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Reset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Mode Selector */}
      {activeGroupId && (
        <GameModeSelector
          groupId={activeGroupId}
          agencyId={effectiveAgencyId}
          currentModeSlug={gameMode}
          open={modeSelectorOpen}
          onOpenChange={setModeSelectorOpen}
          onModeChange={(mode) => { setGameMode(mode.slug); loadBoard(); }}
        />
      )}
    </div>
  );
};

export default GameBoard;
