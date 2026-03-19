/**
 * GameBoard — Race Track game board for classroom display.
 * Shows student avatars moving along a track based on points.
 * Reads from Core Phase 5 tables.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import {
  getClassroomGameSettings,
  getClassroomGameProgress,
  getTeamScores,
} from '@/lib/game-data';
import { POINT_SKINS, type ClassroomGameSettings, type StudentGameProgress, type TeamScore } from '@/lib/game-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Trophy, Target, Sparkles, Users, Flag, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRACK_LENGTH = 100; // total units on the race track
const CHECKPOINT_INTERVAL = 20;

const GameBoard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();

  const [settings, setSettings] = useState<ClassroomGameSettings | null>(null);
  const [students, setStudents] = useState<StudentGameProgress[]>([]);
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null); // student_id that just moved

  const groupId = currentWorkspace?.id || '';

  useEffect(() => {
    if (groupId) loadBoard();
  }, [groupId]);

  const loadBoard = async () => {
    setLoading(true);
    try {
      const [s, prog, t] = await Promise.all([
        getClassroomGameSettings(groupId),
        getClassroomGameProgress(groupId),
        getTeamScores(groupId),
      ]);
      setSettings(s);
      setStudents(prog);
      setTeams(t);
    } catch (e) {
      console.warn('[GameBoard] load error:', e);
    }
    setLoading(false);
  };

  // Listen for realtime point events to trigger animation
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`game-board-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'beacon_points_ledger' }, (payload: any) => {
        const sid = payload.new?.student_id;
        if (sid) {
          setFlash(sid);
          setTimeout(() => setFlash(null), 1200);
          loadBoard(); // refresh positions
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const skin = POINT_SKINS[settings?.point_display_type || 'stars'];
  const totalClassPoints = students.reduce((sum, s) => sum + (s.points_balance || 0), 0);

  const getDisplayName = (s: StudentGameProgress) => {
    const mode = settings?.privacy_mode || 'first_names';
    if (mode === 'avatars_only') return '';
    if (mode === 'initials') return `${(s.first_name || '')[0] || ''}${(s.last_name || '')[0] || ''}`;
    return s.first_name || '';
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const checkpoints = Array.from({ length: TRACK_LENGTH / CHECKPOINT_INTERVAL }, (_, i) => (i + 1) * CHECKPOINT_INTERVAL);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-lg font-bold font-heading">🏁 Race Board</h1>
        <div />
      </div>

      {/* Class banner */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 bg-gradient-to-r from-primary/10 to-accent/10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Class Total</p>
              <p className="text-2xl font-bold tabular-nums">{skin.icon} {totalClassPoints.toLocaleString()}</p>
            </div>
            {settings?.mission_of_the_day && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mission</p>
                <p className="text-sm font-semibold">{settings.mission_of_the_day}</p>
              </div>
            )}
            {settings?.word_of_the_week && (
              <Badge variant="outline" className="text-xs">
                📖 {settings.word_of_the_week}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team scores */}
      {settings?.teams_enabled && teams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {teams.map(t => (
            <Card key={t.team_id} className="shrink-0 min-w-[120px]">
              <CardContent className="p-3 text-center">
                <span className="text-xl">{t.team_icon}</span>
                <p className="text-xs font-bold mt-1" style={{ color: t.team_color }}>{t.team_name}</p>
                <p className="text-lg font-bold tabular-nums">{t.total_points}</p>
                <p className="text-[10px] text-muted-foreground">{t.member_count} members</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Race Track */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="h-4 w-4 text-accent" />
            <p className="text-sm font-bold">Race Track</p>
          </div>

          {/* Track visualization */}
          <div className="relative bg-muted/50 rounded-xl p-4 min-h-[200px] overflow-hidden">
            {/* Track line */}
            <div className="absolute left-8 right-8 top-1/2 h-2 bg-border rounded-full -translate-y-1/2">
              {/* Checkpoints */}
              {checkpoints.map(cp => (
                <div
                  key={cp}
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary/30 border-2 border-primary"
                  style={{ left: `${(cp / TRACK_LENGTH) * 100}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-muted-foreground">
                    {cp}
                  </span>
                </div>
              ))}
              {/* Finish flag */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                <Flag className="h-5 w-5 text-accent" />
              </div>
            </div>

            {/* Student avatars on track */}
            <div className="relative" style={{ minHeight: students.length > 6 ? '200px' : '120px' }}>
              {students.map((s, idx) => {
                const pos = Math.min(s.track_position || 0, TRACK_LENGTH);
                const pct = (pos / TRACK_LENGTH) * 100;
                const isFlashing = flash === s.student_id;
                // Stagger vertically to avoid overlap
                const yOffset = (idx % 3) * 40 + 10;

                return (
                  <div
                    key={s.student_id}
                    className={cn(
                      "absolute flex flex-col items-center transition-all duration-700 ease-out",
                      isFlashing && "animate-bounce scale-110"
                    )}
                    style={{
                      left: `calc(${Math.max(2, Math.min(95, pct))}% - 16px)`,
                      top: `${yOffset}px`,
                    }}
                  >
                    {/* Glow effect */}
                    {isFlashing && (
                      <div className="absolute inset-0 -m-2 rounded-full bg-accent/30 animate-ping" />
                    )}
                    <span className="text-2xl relative z-10">{s.avatar_emoji || '👤'}</span>
                    <span className="text-[9px] font-bold mt-0.5 whitespace-nowrap">{getDisplayName(s)}</span>
                    {s.team_color && (
                      <div className="w-2 h-2 rounded-full mt-0.5" style={{ backgroundColor: s.team_color }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Standings */}
      {settings?.leaderboard_enabled && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-bold">Standings</p>
            </div>
            <div className="space-y-2">
              {students.slice(0, 10).map((s, i) => (
                <div key={s.student_id} className="flex items-center gap-3">
                  <span className={cn(
                    "text-sm font-bold w-6 text-center",
                    i === 0 && "text-amber-500",
                    i === 1 && "text-gray-400",
                    i === 2 && "text-orange-400",
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-lg">{s.avatar_emoji || '👤'}</span>
                  <span className="flex-1 text-sm font-medium">{getDisplayName(s)}</span>
                  <Badge variant="outline" className="text-xs tabular-nums gap-1">
                    {skin.icon} {s.points_balance}
                  </Badge>
                  <div className="w-20">
                    <Progress value={(s.track_position / TRACK_LENGTH) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GameBoard;
