/**
 * StudentPortalEnhanced — Read-only student view with game layer.
 * Supports both token-based and code-based access.
 * Shows: avatar, points, race progress, rewards, streaks, unlocks.
 * Does NOT show: staff notes, ABC logs, behavior detail, teacher comms.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validateStudentPortalAccess, getStudentGameProfile, getStudentStreaks, getStudentUnlocks, getUnlockCatalog } from '@/lib/game-data';
import { POINT_SKINS, type StudentGameProfile, type StudentStreak, type StudentUnlock, type UnlockCatalogItem } from '@/lib/game-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Trophy, Target, Sparkles, Lock, Flame, Gift, Flag, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RewardGoal {
  id: string;
  reward_name: string;
  reward_emoji: string;
  target_points: number;
  current_points: number;
  progress_pct: number;
}

export default function StudentPortalEnhanced() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();

  const [studentId, setStudentId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState<StudentGameProfile | null>(null);
  const [goals, setGoals] = useState<RewardGoal[]>([]);
  const [streaks, setStreaks] = useState<StudentStreak[]>([]);
  const [recentUnlocks, setRecentUnlocks] = useState<(StudentUnlock & { item?: UnlockCatalogItem })[]>([]);
  const [trackPosition, setTrackPosition] = useState(0);
  const [missionOfDay, setMissionOfDay] = useState('');
  const [wordOfWeek, setWordOfWeek] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    if (token) loadPortalByToken(token);
    else setNeedsCode(true);
    setLoading(false);
  }, [token]);

  const loadPortalByToken = async (t: string) => {
    setLoading(true);
    try {
      // Try old portal token flow first
      const { data: tokenData } = await supabase
        .from('student_portal_tokens' as any)
        .select('account_id, expires_at, is_active')
        .eq('token', t)
        .maybeSingle();

      if (tokenData) {
        const td = tokenData as any;
        if (!td.is_active || new Date(td.expires_at) < new Date()) {
          setError('This link has expired');
          setLoading(false);
          return;
        }
        const { data: acct } = await supabase
          .from('student_portal_accounts' as any)
          .select('id, student_id, display_name, avatar_emoji')
          .eq('id', td.account_id)
          .maybeSingle();
        if (acct) {
          const a = acct as any;
          setStudentId(a.student_id);
          setDisplayName(a.display_name);
          setAvatarEmoji(a.avatar_emoji || '👤');
          await loadStudentData(a.student_id);
          setLoading(false);
          return;
        }
      }

      // Try as login code
      const result = await validateStudentPortalAccess(t);
      if (result.valid && result.studentId) {
        setStudentId(result.studentId);
        await loadStudentData(result.studentId);
      } else {
        setError('Invalid or expired link');
      }
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  const handleCodeSubmit = async () => {
    if (!codeInput.trim()) return;
    setLoading(true);
    setError('');
    const result = await validateStudentPortalAccess(codeInput.trim());
    if (result.valid && result.studentId) {
      setStudentId(result.studentId);
      setNeedsCode(false);
      await loadStudentData(result.studentId);
    } else {
      setError('Invalid code. Please try again.');
    }
    setLoading(false);
  };

  const loadStudentData = async (sid: string) => {
    try {
      const [profileData, streakData, unlockData, catalogData] = await Promise.all([
        getStudentGameProfile(sid),
        getStudentStreaks(sid),
        getStudentUnlocks(sid),
        getUnlockCatalog(),
      ]);

      if (profileData) {
        setProfile(profileData);
        setAvatarEmoji(profileData.avatar_emoji || '👤');
        if (!displayName) setDisplayName('Player');
      }

      setStreaks(streakData);

      // Map unlocks to catalog items
      const catalogMap = new Map(catalogData.map(c => [c.id, c]));
      setRecentUnlocks(unlockData.slice(0, 5).map(u => ({ ...u, item: catalogMap.get(u.unlock_id) })));

      // Load balance
      const { data: ledger } = await supabase
        .from('beacon_points_ledger' as any)
        .select('points')
        .eq('student_id', sid);
      const total = (ledger || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      setBalance(total);

      // Load game state
      const { data: gameState } = await supabase
        .from('student_game_state' as any)
        .select('track_position')
        .eq('student_id', sid)
        .maybeSingle();
      if (gameState) setTrackPosition((gameState as any).track_position || 0);

      // Load reward goals
      const { data: goalData } = await supabase
        .from('v_student_reward_progress' as any)
        .select('*')
        .eq('student_id', sid);
      setGoals((goalData || []) as any[]);

      // Load classroom settings for mission/word
      const { data: gameSettings } = await supabase
        .from('classroom_game_settings' as any)
        .select('mission_of_the_day, word_of_the_week')
        .limit(1)
        .maybeSingle();
      if (gameSettings) {
        setMissionOfDay((gameSettings as any).mission_of_the_day || '');
        setWordOfWeek((gameSettings as any).word_of_the_week || '');
      }

      // Load student name from clients table
      const { data: client } = await supabase
        .from('clients' as any)
        .select('first_name')
        .eq('id', sid)
        .maybeSingle();
      if (client) setDisplayName((client as any).first_name || 'Player');
    } catch (e) {
      console.warn('[Portal] load error:', e);
    }
  };

  // Code entry screen
  if (needsCode && !studentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background">
        <div className="text-center space-y-4 px-6 max-w-sm">
          <span className="text-6xl">🎮</span>
          <h1 className="text-2xl font-bold font-heading">Student Portal</h1>
          <p className="text-sm text-muted-foreground">Enter your access code</p>
          <Input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder="Enter 4-digit code"
            className="text-center text-2xl tracking-[0.5em] font-bold"
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleCodeSubmit} className="w-full" disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !studentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 px-4">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-bold">{error}</p>
          <p className="text-sm text-muted-foreground">Ask your teacher for a new portal link.</p>
        </div>
      </div>
    );
  }

  const level = profile?.current_level || 1;
  const xp = profile?.current_xp || 0;
  const xpToNext = 100 - (xp % 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-accent/5">
      <div className="mx-auto max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-7xl">{avatarEmoji}</span>
          <h1 className="text-2xl font-bold font-heading">{displayName}</h1>
          <div className="flex items-center justify-center gap-3">
            <Badge variant="outline" className="text-xs">Level {level}</Badge>
            <Badge variant="outline" className="text-xs">{xp} XP</Badge>
          </div>
          <Progress value={xp % 100} className="h-2 max-w-[200px] mx-auto" />
          <p className="text-[10px] text-muted-foreground">{xpToNext} XP to Level {level + 1}</p>
        </div>

        {/* Balance */}
        <Card className="overflow-hidden">
          <CardContent className="p-5 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              <span className="text-4xl font-bold tabular-nums">{balance}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Beacon Points</p>
          </CardContent>
        </Card>

        {/* Mission & Word */}
        {(missionOfDay || wordOfWeek) && (
          <div className="flex gap-3">
            {missionOfDay && (
              <Card className="flex-1">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mission</p>
                  <p className="text-xs font-semibold mt-1">🎯 {missionOfDay}</p>
                </CardContent>
              </Card>
            )}
            {wordOfWeek && (
              <Card className="flex-1">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Word</p>
                  <p className="text-xs font-semibold mt-1">📖 {wordOfWeek}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Race Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flag className="h-4 w-4 text-accent" />
              <p className="text-sm font-bold">Race Progress</p>
            </div>
            <Progress value={trackPosition} className="h-3" />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{trackPosition}% complete</p>
          </CardContent>
        </Card>

        {/* Streaks */}
        {streaks.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <p className="text-sm font-bold">Streaks</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {streaks.map(s => (
                  <Badge key={s.id} variant="outline" className="text-xs gap-1">
                    🔥 {s.current_count} {s.streak_type.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reward Goals */}
        {goals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" /> My Rewards
            </h2>
            {goals.map(g => {
              const pct = Math.min(100, g.progress_pct || 0);
              const achieved = pct >= 100;
              const pointsAway = Math.max(0, g.target_points - (g.current_points || balance));
              return (
                <Card key={g.id} className={cn('border-border/40', achieved && 'border-accent/50 bg-accent/5')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{g.reward_emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{g.reward_name}</p>
                        {!achieved && (
                          <p className="text-[10px] text-primary font-medium">
                            {pointsAway} points away!
                          </p>
                        )}
                      </div>
                      {achieved && (
                        <Badge className="bg-accent/20 text-accent-foreground text-[10px] gap-0.5">
                          <Trophy className="h-3 w-3" /> Ready!
                        </Badge>
                      )}
                    </div>
                    <Progress value={pct} className="h-2.5" />
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">{g.current_points || balance}/{g.target_points}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recent Unlocks */}
        {recentUnlocks.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Unlock className="h-4 w-4 text-accent" />
                <p className="text-sm font-bold">Recent Unlocks</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentUnlocks.map(u => (
                  <div key={u.id} className="text-center shrink-0">
                    <span className="text-2xl">{u.item?.icon_emoji || '🎁'}</span>
                    <p className="text-[9px] font-medium mt-0.5">{u.item?.name || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground pt-4">
          <Sparkles className="h-3 w-3 inline mr-1" />
          Powered by Beacon Points™
        </p>
      </div>
    </div>
  );
}
