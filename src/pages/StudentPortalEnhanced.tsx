/**
 * StudentPortalEnhanced — Read-only student view (Hybrid v1).
 * Shows: avatar, points, race progress, rewards with "X points away", mission/word, streaks.
 * Checkpoint celebrations + reward availability highlights.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { validateStudentPortalAccess, getStudentGameProfile, getStudentUnlocks, getStudentStreaks } from '@/lib/game-data';
import type { StudentUnlock, StudentStreak } from '@/lib/game-types';
import { getLevelThreshold, getLevelColor } from '@/lib/level-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Lock, Flame, Gift, Flag, Sparkles, Trophy, CheckCircle, PartyPopper, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;
const CHECKPOINTS = Array.from({ length: TRACK_LENGTH / CHECKPOINT_INTERVAL }, (_, i) => (i + 1) * CHECKPOINT_INTERVAL);

interface RewardItem { id: string; name: string; emoji: string; point_cost: number; }

export default function StudentPortalEnhanced() {
  const { token } = useParams<{ token: string }>();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [balance, setBalance] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentXp, setCurrentXp] = useState(0);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [missionOfDay, setMissionOfDay] = useState('');
  const [wordOfWeek, setWordOfWeek] = useState('');
  const [streakCount, setStreakCount] = useState(0);
  const [unlocks, setUnlocks] = useState<Array<{ name: string; emoji: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [needsCode, setNeedsCode] = useState(false);

  useEffect(() => {
    if (token) loadPortalByToken(token);
    else { setNeedsCode(true); setLoading(false); }
  }, [token]);

  const loadPortalByToken = async (t: string) => {
    setLoading(true);
    try {
      const { data: tokenData } = await supabase.from('student_portal_tokens' as any).select('account_id, expires_at, is_active').eq('token', t).maybeSingle();
      if (tokenData) {
        const td = tokenData as any;
        if (!td.is_active || new Date(td.expires_at) < new Date()) { setError('This link has expired'); setLoading(false); return; }
        const { data: acct } = await supabase.from('student_portal_accounts' as any).select('id, student_id, display_name, avatar_emoji').eq('id', td.account_id).maybeSingle();
        if (acct) {
          const a = acct as any;
          setStudentId(a.student_id); setDisplayName(a.display_name || 'Player'); setAvatarEmoji(a.avatar_emoji || '👤');
          await loadStudentData(a.student_id); setLoading(false); return;
        }
      }
      const result = await validateStudentPortalAccess(t);
      if (result.valid && result.studentId) { setStudentId(result.studentId); await loadStudentData(result.studentId); }
      else { setError('Invalid or expired link'); }
    } catch { setError('Something went wrong'); }
    setLoading(false);
  };

  const handleCodeSubmit = async () => {
    if (!codeInput.trim()) return;
    setLoading(true); setError('');
    const result = await validateStudentPortalAccess(codeInput.trim());
    if (result.valid && result.studentId) { setStudentId(result.studentId); setNeedsCode(false); await loadStudentData(result.studentId); }
    else { setError('Invalid code. Please try again.'); }
    setLoading(false);
  };

  const loadStudentData = async (sid: string) => {
    try {
      const [profileData] = await Promise.all([getStudentGameProfile(sid)]);
      if (profileData) setAvatarEmoji(profileData.avatar_emoji || '👤');

      const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', sid);
      const total = (ledger || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      setBalance(total);

      const { data: rewardData } = await supabase.from('beacon_rewards' as any).select('id, name, image_url, cost').eq('active', true).order('cost');
      setRewards((rewardData || []).map((r: any) => ({ ...r, emoji: r.image_url || '🎁', point_cost: r.cost })) as any[]);

      const { data: streakData } = await supabase.from('student_streaks' as any).select('current_count').eq('student_id', sid).order('current_count', { ascending: false }).limit(1);
      if (streakData?.length) setStreakCount((streakData[0] as any).current_count || 0);

      const { data: gameSettings } = await supabase.from('classroom_game_settings' as any).select('mission_of_the_day, word_of_the_week').limit(1).maybeSingle();
      if (gameSettings) { setMissionOfDay((gameSettings as any).mission_of_the_day || ''); setWordOfWeek((gameSettings as any).word_of_the_week || ''); }

      const { data: client } = await supabase.from('clients' as any).select('first_name').eq('id', sid).maybeSingle();
      if (client) setDisplayName((client as any).first_name || 'Player');
    } catch (e) { console.warn('[Portal] load error:', e); }
  };

  if (needsCode && !studentId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background">
        <div className="text-center space-y-5 px-6 max-w-sm">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"><span className="text-4xl">🎮</span></div>
          <h1 className="text-2xl font-bold font-heading">Student Portal</h1>
          <p className="text-sm text-muted-foreground">Enter your access code to see your progress</p>
          <Input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="Enter 4-digit code" className="text-center text-2xl tracking-[0.5em] font-bold h-14" maxLength={6} onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()} autoFocus />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleCodeSubmit} className="w-full h-11" disabled={loading}>{loading ? 'Checking…' : 'Enter Portal'}</Button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (error && !studentId) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-center space-y-3 px-4"><Lock className="h-12 w-12 mx-auto text-muted-foreground" /><p className="text-lg font-bold">{error}</p><p className="text-sm text-muted-foreground">Ask your teacher for a new portal link.</p></div></div>;

  const racePosition = Math.min(balance, TRACK_LENGTH);
  const racePct = (racePosition / TRACK_LENGTH) * 100;
  const checkpointsReached = Math.floor(racePosition / CHECKPOINT_INTERVAL);
  const nextCheckpoint = (checkpointsReached + 1) * CHECKPOINT_INTERVAL;
  const toNextCheckpoint = Math.max(0, nextCheckpoint - racePosition);
  const isFinished = racePosition >= TRACK_LENGTH;
  const affordableRewards = rewards.filter(r => balance >= r.point_cost);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-accent/5">
      <div className="mx-auto max-w-md px-4 py-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className={cn(
            "mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-lg transition-all",
            isFinished && "ring-4 ring-accent/40 shadow-accent/20"
          )}>
            <span className="text-6xl">{avatarEmoji}</span>
          </div>
          <h1 className="text-2xl font-bold font-heading">{displayName}</h1>
          <div className="flex items-center justify-center gap-2">
            {streakCount > 0 && (
              <Badge variant="outline" className="text-xs gap-1 border-orange-300 dark:border-orange-700">
                <Flame className="h-3 w-3 text-orange-500" /> {streakCount} day streak
              </Badge>
            )}
            {isFinished && (
              <Badge className="text-xs gap-1 bg-accent/20 text-accent-foreground border-accent/30">
                <PartyPopper className="h-3 w-3" /> Race Complete!
              </Badge>
            )}
          </div>
        </div>

        {/* Balance */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <CardContent className="p-6 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="flex items-center justify-center gap-3 mb-1">
              <Star className="h-8 w-8 fill-amber-400 text-amber-400" />
              <span className="text-5xl font-bold tabular-nums">{balance}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Beacon Points</p>
            {affordableRewards.length > 0 && (
              <p className="text-xs text-accent font-semibold mt-2">✨ You can afford {affordableRewards.length} reward{affordableRewards.length > 1 ? 's' : ''}!</p>
            )}
          </CardContent>
        </Card>

        {/* Mission & Word */}
        {(missionOfDay || wordOfWeek) && (
          <div className="flex gap-3">
            {missionOfDay && <Card className="flex-1 border-border/40"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mission</p><p className="text-xs font-semibold mt-1">🎯 {missionOfDay}</p></CardContent></Card>}
            {wordOfWeek && <Card className="flex-1 border-border/40"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Word</p><p className="text-xs font-semibold mt-1">📖 {wordOfWeek}</p></CardContent></Card>}
          </div>
        )}

        {/* Race Progress */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-accent" />
                <p className="text-sm font-bold">Race Progress</p>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1"><Trophy className="h-2.5 w-2.5" /> {checkpointsReached}/{CHECKPOINTS.length} checkpoints</Badge>
            </div>

            {/* Track visualization */}
            <div className="relative">
              <Progress value={racePct} className="h-5 rounded-full" />
              {CHECKPOINTS.map(cp => (
                <div key={cp} className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all",
                  racePosition >= cp ? "bg-accent border-accent scale-110" : "bg-background border-muted-foreground/30"
                )} style={{ left: `${(cp / TRACK_LENGTH) * 100}%`, transform: 'translate(-50%, -50%)' }}>
                  {racePosition >= cp && <CheckCircle className="h-3 w-3 text-accent-foreground absolute -top-0.5 -left-0.5" />}
                </div>
              ))}
              {/* Avatar on track */}
              <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `calc(${Math.max(2, Math.min(95, racePct))}% - 10px)` }}>
                <span className="text-lg drop-shadow-sm">{avatarEmoji}</span>
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="font-semibold">{racePosition} / {TRACK_LENGTH}</span>
              {toNextCheckpoint > 0 && !isFinished && <span className="text-primary font-bold">{toNextCheckpoint} pts to next checkpoint</span>}
              {isFinished && <span className="text-accent font-bold">🏁 Finished!</span>}
            </div>
          </CardContent>
        </Card>

        {/* Rewards */}
        {rewards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Rewards</h2>
            {rewards.map(r => {
              const pointsAway = Math.max(0, r.point_cost - balance);
              const canAfford = pointsAway === 0;
              const pct = Math.min(100, Math.round((balance / r.point_cost) * 100));
              return (
                <Card key={r.id} className={cn(
                  'border-border/40 transition-all',
                  canAfford && 'border-accent/50 bg-accent/5 shadow-sm ring-1 ring-accent/20'
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn("text-2xl w-10 h-10 rounded-lg flex items-center justify-center", canAfford ? "bg-accent/10" : "bg-muted/50")}>{r.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{r.name}</p>
                        <div className="flex items-center gap-1">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                          <span className="text-[10px] text-muted-foreground">{r.point_cost} pts</span>
                        </div>
                      </div>
                      {canAfford ? (
                        <Badge className="bg-accent/20 text-accent-foreground text-[10px] gap-0.5 border-accent/30 animate-pulse"><Sparkles className="h-2.5 w-2.5" /> Available!</Badge>
                      ) : (
                        <span className="text-xs font-bold text-primary tabular-nums">{pointsAway} away</span>
                      )}
                    </div>
                    <Progress value={pct} className="h-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-[10px] text-muted-foreground pt-4 pb-8">
          <Sparkles className="h-3 w-3 inline mr-1" /> Powered by Beacon Points™
        </p>
      </div>
    </div>
  );
}
