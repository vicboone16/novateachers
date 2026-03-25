/**
 * ClassroomLive — Public read-only classroom game board.
 * Accessed via /class/:slug/live — no auth required.
 * Reads from Core Phase 5 tables.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { POINT_SKINS, type ClassroomGameSettings, type StudentGameProgress, type TeamScore } from '@/lib/game-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Flag, Star, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;

export default function ClassroomLive() {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<ClassroomGameSettings | null>(null);
  const [students, setStudents] = useState<StudentGameProgress[]>([]);
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slug) loadLive(slug);
  }, [slug]);

  const loadLive = async (s: string) => {
    setLoading(true);
    try {
      // Resolve slug to group_id
      const { data: link } = await supabase
        .from('classroom_public_links' as any)
        .select('group_id')
        .eq('slug', s)
        .eq('is_active', true)
        .maybeSingle();

      if (!link) { setError('Invalid or expired link'); setLoading(false); return; }
      const gid = (link as any).group_id;
      setGroupId(gid);

      // Load data
      const [settingsData, progressData, teamData] = await Promise.all([
        supabase.from('classroom_game_settings' as any).select('*').eq('group_id', gid).maybeSingle(),
        supabase.from('v_classroom_student_game_progress' as any).select('*').eq('group_id', gid).order('track_position', { ascending: false }),
        supabase.from('v_student_team_scores' as any).select('*').eq('group_id', gid).order('total_points', { ascending: false }),
      ]);

      setSettings(settingsData.data as any);
      setStudents((progressData.data || []) as any[]);
      setTeams((teamData.data || []) as any[]);
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!slug) return;
    const interval = setInterval(() => loadLive(slug), 10000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 px-4">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-bold">{error}</p>
        </div>
      </div>
    );
  }

  const skin = POINT_SKINS[(settings as any)?.point_display_type || 'stars'];
  const totalPoints = students.reduce((sum, s) => sum + (s.points_balance || 0), 0);

  const getDisplayName = (s: StudentGameProgress) => {
    const mode = (settings as any)?.privacy_mode || 'first_names';
    if (mode === 'avatars_only') return '';
    if (mode === 'initials') return `${(s.first_name || '')[0] || ''}${(s.last_name || '')[0] || ''}`;
    return s.first_name || '';
  };

  const checkpoints = Array.from({ length: TRACK_LENGTH / CHECKPOINT_INTERVAL }, (_, i) => (i + 1) * CHECKPOINT_INTERVAL);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Banner */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 text-center bg-gradient-to-r from-primary/15 to-accent/15">
            <p className="text-3xl font-bold tabular-nums">{skin.icon} {totalPoints.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">Class Total {skin.plural}</p>
            <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
              {settings?.mission_of_the_day && (
                <Badge variant="outline">🎯 {settings.mission_of_the_day}</Badge>
              )}
              {settings?.word_of_the_week && (
                <Badge variant="outline">📖 {settings.word_of_the_week}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        {settings?.teams_enabled && teams.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {teams.map(t => (
              <Card key={t.team_id}>
                <CardContent className="p-4 text-center">
                  <span className="text-2xl">{t.team_icon}</span>
                  <p className="text-sm font-bold mt-1" style={{ color: t.team_color }}>{t.team_name}</p>
                  <p className="text-xl font-bold tabular-nums">{t.total_points}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Race Track */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Flag className="h-5 w-5 text-accent" />
              <p className="font-bold">Race Track</p>
            </div>
            <div className="relative bg-muted/50 rounded-xl p-6 min-h-[250px] overflow-hidden">
              <div className="absolute left-8 right-8 top-1/2 h-3 bg-border rounded-full -translate-y-1/2">
                {checkpoints.map(cp => (
                  <div
                    key={cp}
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary/30 border-2 border-primary"
                    style={{ left: `${(cp / TRACK_LENGTH) * 100}%`, transform: 'translate(-50%, -50%)' }}
                  />
                ))}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                  <Flag className="h-6 w-6 text-accent" />
                </div>
              </div>
              <div className="relative" style={{ minHeight: '200px' }}>
                {students.map((s, idx) => {
                  const pct = Math.min(((s.track_position || 0) / TRACK_LENGTH) * 100, 100);
                  const yOffset = (idx % 4) * 50 + 10;
                  return (
                    <div
                      key={s.student_id}
                      className="absolute flex flex-col items-center transition-all duration-1000"
                      style={{ left: `calc(${Math.max(2, Math.min(95, pct))}% - 20px)`, top: `${yOffset}px` }}
                    >
                      <span className="text-3xl">{s.avatar_emoji || '👤'}</span>
                      <span className="text-[10px] font-bold mt-0.5">{getDisplayName(s)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        {settings?.leaderboard_enabled && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                <p className="font-bold">Top Progress</p>
              </div>
              {students.slice(0, 10).map((s, i) => (
                <div key={s.student_id} className="flex items-center gap-3 py-2 border-b last:border-0 border-border/30">
                  <span className={cn("text-sm font-bold w-6 text-center",
                    i === 0 && "text-amber-500", i === 1 && "text-gray-400", i === 2 && "text-orange-400"
                  )}>{i + 1}</span>
                  <span className="text-xl">{s.avatar_emoji || '👤'}</span>
                  <span className="flex-1 text-sm font-medium">{getDisplayName(s)}</span>
                  <span className="text-sm font-bold tabular-nums">{skin.icon} {s.points_balance}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-[10px] text-muted-foreground pt-4">
          <Sparkles className="h-3 w-3 inline mr-1" />
          Powered by Beacon Points™
        </p>
      </div>
    </div>
  );
}
