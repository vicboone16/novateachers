/**
 * ExternalParentPortal — Public parent-facing page accessed via /external/parent/:token.
 * Shows: child name, points, safe feed, rewards progress, recent redemptions.
 * No clinical or negative content.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, Gift, Sparkles, Heart, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PortalData {
  studentName: string;
  avatarEmoji: string;
  pointsBalance: number;
  rewardsProgress: { name: string; emoji: string; cost: number }[];
  feedPosts: { id: string; body: string; title: string | null; created_at: string }[];
  redemptions: { reward_name: string; reward_emoji: string; points_spent: number; created_at: string }[];
}

export default function ExternalParentPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('No access token provided.'); setLoading(false); return; }
    loadPortal(token);
  }, [token]);

  const loadPortal = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      // Resolve token to student
      const { data: linkData, error: linkErr } = await supabase
        .from('external_access_links' as any)
        .select('*')
        .eq('token', t)
        .eq('link_type', 'parent')
        .eq('is_active', true)
        .maybeSingle();
      if (linkErr) throw linkErr;
      if (!linkData) { setError('This link is no longer active or has expired.'); setLoading(false); return; }

      const link = linkData as any;
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError('This link has expired. Ask your teacher for a new one.'); setLoading(false); return;
      }

      const studentId = link.student_id;

      // Update last_used_at
      supabase.from('external_access_links' as any).update({ last_used_at: new Date().toISOString() }).eq('id', link.id).then(() => {});

      // Load student name
      let studentName = 'Your Child';
      let avatarEmoji = '👤';
      try {
        const { data: client } = await supabase.from('clients' as any).select('first_name, last_name').eq('id', studentId).maybeSingle();
        if (client) studentName = `${(client as any).first_name || ''} ${((client as any).last_name || '')[0] || ''}`.trim();
      } catch {}
      try {
        const { data: profile } = await supabase.from('student_game_profiles' as any).select('avatar_emoji').eq('student_id', studentId).maybeSingle();
        if (profile) avatarEmoji = (profile as any).avatar_emoji || '👤';
      } catch {}

      // Load points balance
      let pointsBalance = 0;
      try {
        const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', studentId);
        pointsBalance = (ledger || []).reduce((s, r) => s + r.points, 0);
      } catch {}

      // Load rewards
      let rewardsProgress: PortalData['rewardsProgress'] = [];
      try {
        const { data: rws } = await supabase.from('beacon_rewards' as any).select('name, emoji, cost').eq('active', true).order('cost', { ascending: true }).limit(4);
        rewardsProgress = (rws || []).map((r: any) => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.cost }));
      } catch {}

      // Load safe feed posts
      let feedPosts: PortalData['feedPosts'] = [];
      try {
        // Find group for student
        const { data: groupData } = await cloudSupabase.from('classroom_group_students').select('group_id').eq('client_id', studentId).limit(1);
        const groupId = groupData?.[0]?.group_id;
        if (groupId) {
          const { data: posts } = await cloudSupabase.from('classroom_feed_posts')
            .select('id, body, title, created_at')
            .eq('group_id', groupId)
            .in('post_type', ['celebration', 'announcement', 'positive'])
            .order('created_at', { ascending: false })
            .limit(5);
          feedPosts = (posts || []) as any[];
        }
      } catch {}

      // Load recent redemptions
      let redemptions: PortalData['redemptions'] = [];
      try {
        const { data: rd } = await supabase.from('beacon_reward_redemptions' as any).select('reward_id, points_spent, redeemed_at').eq('student_id', studentId).order('redeemed_at', { ascending: false }).limit(5);
        if (rd && (rd as any[]).length > 0) {
          const rewardIds = [...new Set((rd as any[]).map(r => r.reward_id))];
          const { data: rwds } = await supabase.from('beacon_rewards' as any).select('id, name, emoji').in('id', rewardIds);
          const rwMap = new Map((rwds || []).map((r: any) => [r.id, r]));
          redemptions = (rd as any[]).map(r => {
            const rw = rwMap.get(r.reward_id) as any;
            return { reward_name: rw?.name || 'Reward', reward_emoji: rw?.emoji || '🎁', points_spent: r.points_spent, created_at: r.created_at };
          });
        }
      } catch {}

      setData({ studentName, avatarEmoji, pointsBalance, rewardsProgress, feedPosts, redemptions });
    } catch (err: any) {
      setError(err.message || 'Could not load portal.');
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950 px-4">
      <div className="text-center space-y-3 max-w-xs">
        <AlertTriangle className="h-10 w-10 text-destructive/60 mx-auto" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => token && loadPortal(token)}>Retry</Button>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950 px-4 py-6 safe-top safe-bottom">
      <div className="max-w-md mx-auto space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">{data.avatarEmoji}</div>
          <h1 className="text-xl font-bold">{data.studentName}</h1>
          <p className="text-xs text-muted-foreground">Parent View</p>
        </div>

        {/* Points */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{data.pointsBalance}</p>
            <p className="text-xs text-muted-foreground">Points Balance</p>
          </CardContent>
        </Card>

        {/* Rewards Progress */}
        {data.rewardsProgress.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Gift className="h-3 w-3" /> Rewards Progress
            </p>
            <div className="space-y-2">
              {data.rewardsProgress.map((r, i) => {
                const pct = Math.min(100, Math.round((data.pointsBalance / r.cost) * 100));
                const canRedeem = data.pointsBalance >= r.cost;
                return (
                  <Card key={i} className="border-border/40">
                    <CardContent className="p-3 flex items-center gap-3">
                      <span className="text-xl">{r.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.name}</p>
                        <Progress value={pct} className="h-1.5 mt-1" />
                      </div>
                      <div className="text-right shrink-0">
                        {canRedeem ? (
                          <Badge className="bg-accent/20 text-accent-foreground text-[10px]">Ready!</Badge>
                        ) : (
                          <p className="text-[10px] text-muted-foreground tabular-nums">{r.cost - data.pointsBalance} away</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Feed */}
        {data.feedPosts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Class Updates
            </p>
            {data.feedPosts.map(p => (
              <Card key={p.id} className="border-border/40">
                <CardContent className="p-3">
                  {p.title && <p className="text-xs font-semibold text-primary mb-0.5">{p.title}</p>}
                  <p className="text-sm text-foreground/80">{p.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Redemptions */}
        {data.redemptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="h-3 w-3" /> Recent Rewards
            </p>
            {data.redemptions.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-2">
                <span className="text-lg">{r.reward_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.reward_name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">−{r.points_spent}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground pt-4">
          Powered by Beacon · Updated live
        </p>
      </div>
    </div>
  );
}
