/**
 * GameBoard — Race Track with deterministic engine, realtime updates, and reset flow.
 * Formula: position = min(balance, TRACK_LENGTH). Checkpoints every CHECKPOINT_INTERVAL.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
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
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Trophy, Sparkles, Users, Flag, Star, Zap, PartyPopper, CheckCircle, RotateCcw, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;
const CHECKPOINTS = Array.from({ length: TRACK_LENGTH / CHECKPOINT_INTERVAL }, (_, i) => (i + 1) * CHECKPOINT_INTERVAL);

const getPosition = (balance: number) => Math.min(Math.max(0, balance), TRACK_LENGTH);
const getCheckpointsReached = (pos: number) => Math.floor(pos / CHECKPOINT_INTERVAL);

const GameBoard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { toast } = useToast();

  const [settings, setSettings] = useState<ClassroomGameSettings | null>(null);
  const [students, setStudents] = useState<StudentGameProgress[]>([]);
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [liveBalances, setLiveBalances] = useState<Record<string, number>>({});
  const [recentCheckpoint, setRecentCheckpoint] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  useEffect(() => {
    if (!effectiveAgencyId) return;
    cloudSupabase.from('classroom_groups').select('group_id').eq('agency_id', effectiveAgencyId).limit(1).then(({ data }) => { if (data?.length) setActiveGroupId(data[0].group_id); });
  }, [effectiveAgencyId]);

  useEffect(() => { if (activeGroupId) loadBoard(); }, [activeGroupId]);

  const loadBoard = async () => {
    if (!activeGroupId || !user) return;
    setLoading(true);
    try {
      const [s, prog, t] = await Promise.all([getClassroomGameSettings(activeGroupId), getClassroomGameProgress(activeGroupId), getTeamScores(activeGroupId)]);
      setSettings(s); setStudents(prog); setTeams(t);
      if (prog.length > 0) {
        const bals = await getStudentBalances(user.id, prog.map(p => p.student_id));
        setLiveBalances(bals);
      }
    } catch (e) { console.warn('[GameBoard] load error:', e); }
    setLoading(false);
  };

  // Realtime subscription using a ref-stable callback
  useEffect(() => {
    if (!user) return;
    const channel = cloudSupabase.channel('game-board-live').on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'beacon_points_ledger', filter: `staff_id=eq.${user.id}`,
    }, (payload: any) => {
      const sid = payload.new?.student_id;
      const pts = payload.new?.points || 0;
      if (sid) {
        setLiveBalances(prev => {
          const prevBal = prev[sid] || 0;
          const newBal = prevBal + pts;
          const prevCp = getCheckpointsReached(getPosition(prevBal));
          const newCp = getCheckpointsReached(getPosition(newBal));
          if (newCp > prevCp) { setRecentCheckpoint(sid); setTimeout(() => setRecentCheckpoint(null), 3000); }
          return { ...prev, [sid]: newBal };
        });
        setFlash(sid);
        setTimeout(() => setFlash(null), 1500);
      }
    }).subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [user]);

  const handleReset = async () => {
    if (!user || !activeGroupId) return;
    setResetting(true);
    try {
      // Delete all point entries for this staff's students in this agency
      const studentIds = students.map(s => s.student_id);
      for (const sid of studentIds) {
        await cloudSupabase.from('beacon_points_ledger').delete().eq('staff_id', user.id).eq('student_id', sid);
      }
      setLiveBalances({});
      toast({ title: '🔄 Race reset!', description: 'All positions reset to start.' });
      setResetOpen(false);
      loadBoard();
    } catch (err: any) { toast({ title: 'Reset failed', description: err.message, variant: 'destructive' }); }
    finally { setResetting(false); }
  };

  const skin = POINT_SKINS[settings?.point_display_type || 'stars'];
  const getEffectiveBalance = (s: StudentGameProgress) => liveBalances[s.student_id] ?? s.points_balance ?? 0;
  const totalClassPoints = students.reduce((sum, s) => sum + getEffectiveBalance(s), 0);
  const sortedStudents = [...students].sort((a, b) => getEffectiveBalance(b) - getEffectiveBalance(a));
  const finishedCount = students.filter(s => getPosition(getEffectiveBalance(s)) >= TRACK_LENGTH).length;

  const getDisplayName = (s: StudentGameProgress) => {
    const mode = settings?.privacy_mode || 'first_names';
    if (mode === 'avatars_only') return '';
    if (mode === 'initials') return `${(s.first_name || '')[0] || ''}${(s.last_name || '')[0] || ''}`;
    return s.first_name || '';
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')} className="gap-1"><ArrowLeft className="h-4 w-4" /> Classroom</Button>
        <h1 className="text-lg font-bold font-heading flex items-center gap-2"><Flag className="h-5 w-5 text-accent" /> Race Board</h1>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetOpen(true)} title="Reset race"><RotateCcw className="h-4 w-4 text-muted-foreground" /></Button>
      </div>

      {/* Class banner */}
      <Card className="overflow-hidden border-0 shadow-md">
        <CardContent className="p-4 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Class Total</p>
              <p className="text-2xl font-bold tabular-nums">{skin.icon} {totalClassPoints.toLocaleString()}</p>
            </div>
            {finishedCount > 0 && (
              <Badge className="bg-accent/20 text-accent-foreground border-accent/30 gap-1"><PartyPopper className="h-3 w-3" /> {finishedCount} finished!</Badge>
            )}
            {settings?.mission_of_the_day && <div className="text-right"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mission</p><p className="text-sm font-semibold">{settings.mission_of_the_day}</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Team scores */}
      {settings?.teams_enabled && teams.length > 0 && (
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

      {/* Race Track */}
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-accent" /><p className="text-sm font-bold">Race Track</p></div>
            <p className="text-[10px] text-muted-foreground">{TRACK_LENGTH} point finish · {CHECKPOINT_INTERVAL}pt checkpoints</p>
          </div>

          <div className="relative bg-muted/30 rounded-2xl p-4 min-h-[180px] overflow-hidden border border-border/30">
            {/* Track line */}
            <div className="absolute left-8 right-8 top-1/2 h-3 bg-border/60 rounded-full -translate-y-1/2">
              {CHECKPOINTS.map(cp => (
                <div key={cp} className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 transition-all duration-500",
                  totalClassPoints > 0 && students.some(s => getPosition(getEffectiveBalance(s)) >= cp)
                    ? "bg-accent border-accent shadow-md shadow-accent/30 scale-110" : "bg-background border-muted-foreground/30"
                )} style={{ left: `${(cp / TRACK_LENGTH) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                  <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[9px] font-bold text-muted-foreground whitespace-nowrap">{cp}</span>
                </div>
              ))}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 text-lg">🏁</div>
            </div>

            {/* Student avatars */}
            <div className="relative" style={{ minHeight: students.length > 6 ? '180px' : '100px' }}>
              {students.map((s, idx) => {
                const bal = getEffectiveBalance(s);
                const pos = getPosition(bal);
                const pct = (pos / TRACK_LENGTH) * 100;
                const isFlashing = flash === s.student_id;
                const isCheckpoint = recentCheckpoint === s.student_id;
                const isFinished = pos >= TRACK_LENGTH;
                const yOffset = (idx % 3) * 36 + 8;

                return (
                  <div key={s.student_id} className={cn(
                    "absolute flex flex-col items-center transition-all duration-700 ease-out",
                    isFlashing && "scale-125 z-20",
                    isCheckpoint && "scale-150 z-30",
                  )} style={{ left: `calc(${Math.max(3, Math.min(93, pct))}% - 16px)`, top: `${yOffset}px` }}>
                    {isFlashing && <div className="absolute inset-0 -m-3 rounded-full bg-amber-400/30 animate-ping" />}
                    {isCheckpoint && <div className="absolute -top-6 text-sm animate-bounce">⭐</div>}
                    {isFinished && <div className="absolute -top-5 text-xs animate-bounce">🏆</div>}
                    <div className={cn(
                      "relative z-10 flex items-center justify-center w-9 h-9 rounded-full transition-all duration-500",
                      isFlashing ? "shadow-lg shadow-amber-400/40 ring-2 ring-amber-400" : "shadow-sm",
                      isFinished && "ring-2 ring-accent shadow-accent/30",
                    )} style={s.team_color ? { borderColor: s.team_color } : {}}>
                      <span className="text-xl">{s.avatar_emoji || '👤'}</span>
                    </div>
                    <span className="text-[9px] font-bold mt-0.5 whitespace-nowrap">{getDisplayName(s)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Standings */}
      {settings?.leaderboard_enabled !== false && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-amber-500" /><p className="text-sm font-bold">Standings</p></div>
            <div className="space-y-1">
              {sortedStudents.slice(0, 10).map((s, i) => {
                const bal = getEffectiveBalance(s);
                const pos = getPosition(bal);
                const isFlashing = flash === s.student_id;
                const isFinished = pos >= TRACK_LENGTH;
                const cp = getCheckpointsReached(pos);

                return (
                  <div key={s.student_id} className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-500",
                    isFlashing && "bg-amber-50 dark:bg-amber-900/10 ring-1 ring-amber-300/50",
                    isFinished && "bg-accent/5"
                  )}>
                    <span className={cn("text-sm font-bold w-5 text-center tabular-nums", i === 0 && "text-amber-500", i === 1 && "text-gray-400", i === 2 && "text-orange-400")}>{i + 1}</span>
                    <span className="text-lg">{s.avatar_emoji || '👤'}</span>
                    <span className="flex-1 text-sm font-medium truncate">{getDisplayName(s)}</span>
                    {isFinished && <Badge className="text-[9px] bg-accent/20 text-accent-foreground border-accent/30 gap-0.5"><CheckCircle className="h-2 w-2" />Done</Badge>}
                    <Badge variant="outline" className="text-[10px] tabular-nums gap-0.5 shrink-0">{skin.icon} {bal}</Badge>
                    <div className="w-16 shrink-0"><Progress value={(pos / TRACK_LENGTH) * 100} className="h-2" /></div>
                    {cp > 0 && <span className="text-[9px] text-muted-foreground shrink-0">{cp}cp</span>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
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
    </div>
  );
};

export default GameBoard;
