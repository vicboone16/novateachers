/**
 * ClassroomLive — Public read-only classroom game board.
 * Accessed via /class/:slug/live — no auth required.
 * Reads from Cloud tables (classroom_public_links, classroom_game_settings, classroom_group_students, beacon_points_ledger).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { POINT_SKINS } from '@/lib/game-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Flag, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;

interface LiveStudent {
  student_id: string;
  first_name: string;
  last_name: string;
  avatar_emoji: string;
  points_balance: number;
  track_position: number;
}

interface TeamScore {
  team_id: string;
  team_name: string;
  team_color: string;
  team_icon: string;
  total_points: number;
}

export default function ClassroomLive() {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<any>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slug) loadLive(slug);
  }, [slug]);

  const loadLive = async (s: string) => {
    setLoading(true);
    try {
      // Resolve slug → group_id via Cloud
      const { data: link } = await cloudSupabase
        .from('classroom_public_links' as any)
        .select('group_id')
        .eq('slug', s)
        .eq('is_active', true)
        .maybeSingle();

      if (!link) { setError('Invalid or expired link'); setLoading(false); return; }
      const gid = (link as any).group_id;

      // Load game settings from Cloud
      const { data: settingsData } = await cloudSupabase
        .from('classroom_game_settings')
        .select('*')
        .eq('group_id', gid)
        .maybeSingle();
      setSettings(settingsData);

      // Load students with names from Cloud
      const { data: groupStudents } = await cloudSupabase
        .from('classroom_group_students')
        .select('client_id, first_name, last_name')
        .eq('group_id', gid);
      const studentRows = (groupStudents || []) as any[];
      const studentIds = studentRows.map((r: any) => r.client_id);

      if (studentIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Load balances from Cloud ledger
      const { data: ledger } = await cloudSupabase
        .from('beacon_points_ledger')
        .select('student_id, points')
        .in('student_id', studentIds);
      const balMap = new Map<string, number>();
      for (const row of (ledger || [])) {
        balMap.set(row.student_id, (balMap.get(row.student_id) || 0) + row.points);
      }

      // Load avatars from Cloud game profiles
      let avatarMap = new Map<string, string>();
      try {
        const { data: profiles } = await cloudSupabase
          .from('student_game_profiles')
          .select('student_id, avatar_emoji')
          .in('student_id', studentIds);
        for (const p of (profiles || []) as any[]) {
          avatarMap.set(p.student_id, p.avatar_emoji || '');
        }
      } catch { /* silent */ }

      const totalSteps = (settingsData as any)?.total_steps || TRACK_LENGTH;

      const liveStudents: LiveStudent[] = studentRows.map((r: any) => {
        const bal = balMap.get(r.client_id) || 0;
        return {
          student_id: r.client_id,
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          avatar_emoji: avatarMap.get(r.client_id) || '👤',
          points_balance: bal,
          track_position: Math.min(bal, totalSteps),
        };
      });

      setStudents(liveStudents.sort((a, b) => b.points_balance - a.points_balance));

      // Load teams if enabled
      if ((settingsData as any)?.allow_team_mode) {
        try {
          const { data: teamData } = await cloudSupabase
            .from('classroom_teams')
            .select('id, team_name, team_color, team_icon')
            .eq('group_id', gid);
          
          // Calculate team points from members
          const { data: members } = await cloudSupabase
            .from('classroom_team_members')
            .select('team_id, student_id')
            .eq('group_id', gid);
          
          const teamPoints = new Map<string, number>();
          for (const m of (members || []) as any[]) {
            const pts = balMap.get(m.student_id) || 0;
            teamPoints.set(m.team_id, (teamPoints.get(m.team_id) || 0) + pts);
          }

          setTeams(((teamData || []) as any[]).map(t => ({
            team_id: t.id,
            team_name: t.team_name,
            team_color: t.team_color,
            team_icon: t.team_icon,
            total_points: teamPoints.get(t.id) || 0,
          })).sort((a, b) => b.total_points - a.total_points));
        } catch { /* silent */ }
      }
    } catch (err) {
      console.error('[ClassroomLive] Error:', err);
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

  const skin = POINT_SKINS[settings?.point_display_type || 'stars'] || POINT_SKINS.stars;
  const totalPoints = students.reduce((sum, s) => sum + s.points_balance, 0);

  const getDisplayName = (s: LiveStudent) => {
    const mode = settings?.privacy_mode || 'first_names';
    if (mode === 'avatars_only') return '';
    if (mode === 'initials') return `${(s.first_name || '')[0] || ''}${(s.last_name || '')[0] || ''}`;
    if (mode === 'first_names') return s.first_name || s.student_id.slice(0, 6);
    return `${s.first_name} ${s.last_name}`.trim() || s.student_id.slice(0, 6);
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
              {settings?.mission_text && (
                <Badge variant="outline">🎯 {settings.mission_text}</Badge>
              )}
              {settings?.word_of_week && (
                <Badge variant="outline">📖 {settings.word_of_week}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        {settings?.allow_team_mode && teams.length > 0 && (
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
        {(settings?.show_leaderboard !== false) && (
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
