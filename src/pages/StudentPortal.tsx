/**
 * StudentPortal — Read-only student view showing points balance, reward goals, and progress.
 * Accessed via token-based auth: /portal/:token
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, Trophy, Target, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortalAccount {
  id: string;
  student_id: string;
  display_name: string;
  avatar_emoji: string;
}

interface RewardGoal {
  id: string;
  reward_name: string;
  reward_emoji: string;
  target_points: number;
  current_points: number;
  progress_pct: number;
}

export default function StudentPortal() {
  const { token } = useParams<{ token: string }>();
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [balance, setBalance] = useState(0);
  const [goals, setGoals] = useState<RewardGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('No token provided'); setLoading(false); return; }
    loadPortal(token);
  }, [token]);

  const loadPortal = async (t: string) => {
    setLoading(true);
    try {
      // 1) Validate token
      const { data: tokenData, error: tokenErr } = await supabase
        .from('student_portal_tokens' as any)
        .select('account_id, expires_at, is_active')
        .eq('token', t)
        .maybeSingle();

      if (tokenErr || !tokenData) { setError('Invalid or expired link'); setLoading(false); return; }
      const td = tokenData as any;
      if (!td.is_active || new Date(td.expires_at) < new Date()) {
        setError('This link has expired'); setLoading(false); return;
      }

      // 2) Load account
      const { data: acct } = await supabase
        .from('student_portal_accounts' as any)
        .select('id, student_id, display_name, avatar_emoji')
        .eq('id', td.account_id)
        .maybeSingle();
      if (!acct) { setError('Account not found'); setLoading(false); return; }
      setAccount(acct as any);

      const studentId = (acct as any).student_id;

      // 3) Load balance
      const { data: ledger } = await supabase
        .from('beacon_points_ledger' as any)
        .select('points')
        .eq('student_id', studentId);
      const total = (ledger || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      setBalance(total);

      // 4) Load reward goals
      const { data: goalData } = await supabase
        .from('v_student_reward_progress' as any)
        .select('*')
        .eq('student_id', studentId);
      setGoals((goalData || []) as any[]);
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 px-4">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-bold">{error || 'Access Denied'}</p>
          <p className="text-sm text-muted-foreground">Ask your teacher for a new portal link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <div className="mx-auto max-w-md px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-6xl">{account.avatar_emoji}</span>
          <h1 className="text-2xl font-bold font-heading">{account.display_name}</h1>
          <p className="text-sm text-muted-foreground">My Rewards Portal</p>
        </div>

        {/* Balance Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              <span className="text-4xl font-bold tabular-nums">{balance}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Beacon Points</p>
          </CardContent>
        </Card>

        {/* Reward Goals */}
        {goals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold font-heading flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              My Goals
            </h2>
            {goals.map(goal => {
              const pct = Math.min(100, goal.progress_pct || 0);
              const achieved = pct >= 100;
              return (
                <Card key={goal.id} className={cn('border-border/40', achieved && 'border-accent/50 bg-accent/5')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{goal.reward_emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{goal.reward_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {goal.current_points || balance}/{goal.target_points} points
                        </p>
                      </div>
                      {achieved && (
                        <Badge className="bg-accent/20 text-accent-foreground gap-0.5">
                          <Trophy className="h-3 w-3" /> Ready!
                        </Badge>
                      )}
                    </div>
                    <div className="relative">
                      <Progress value={pct} className="h-3" />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{pct}%</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
