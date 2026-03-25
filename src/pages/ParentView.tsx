/**
 * ParentView — Token-based parent access (no login required).
 * Route: /parent-view?token=xxx
 * Shows: student progress, parent insights, reward progress, parent actions.
 * Funnel CTA to authenticated parent app.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { supabase } from '@/lib/supabase';
import { ParentInsightCards } from '@/components/ParentInsightCards';
import { ParentActionButtons } from '@/components/ParentActionButtons';
import { StudentNarrativeCard } from '@/components/StudentNarrativeCard';
import { StudentQuestCards } from '@/components/StudentQuestCards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Star, Gift, Sparkles, Heart, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';

interface StudentData {
  studentId: string;
  agencyId: string;
  studentName: string;
  avatarEmoji: string;
  pointsBalance: number;
  rewards: { name: string; emoji: string; cost: number }[];
}

export default function ParentView() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('No access token provided.'); setLoading(false); return; }
    loadParentView(token);
  }, [token]);

  const loadParentView = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      // Validate token
      const { data: linkData } = await cloudSupabase
        .from('parent_access_links')
        .select('*')
        .eq('token', t)
        .eq('is_active', true)
        .maybeSingle();

      if (!linkData) { setError('This link is no longer active or has expired.'); setLoading(false); return; }
      const link = linkData as any;
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError('This link has expired. Ask the teacher for a new one.'); setLoading(false); return;
      }

      const studentId = link.student_id;
      const agencyId = link.agency_id;

      // Update last_used_at
      cloudSupabase.from('parent_access_links').update({ last_used_at: new Date().toISOString() }).eq('id', link.id);

      // Load student info
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

      // Points
      let pointsBalance = 0;
      try {
        const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', studentId);
        pointsBalance = (ledger || []).reduce((s, r) => s + r.points, 0);
      } catch {}

      // Rewards
      let rewards: StudentData['rewards'] = [];
      try {
        const { data: rws } = await cloudSupabase.from('beacon_rewards').select('name, emoji, cost').eq('active', true).order('cost').limit(4);
        rewards = (rws || []).map((r: any) => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.cost }));
      } catch {}

      setData({ studentId, agencyId, studentName, avatarEmoji, pointsBalance, rewards });
    } catch (err: any) {
      setError(err.message || 'Could not load.');
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950">
      <div className="text-center space-y-3"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground">Loading…</p></div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950 px-4">
      <div className="text-center space-y-3 max-w-xs">
        <AlertTriangle className="h-10 w-10 text-destructive/60 mx-auto" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={() => token && loadParentView(token)}>Retry</Button>
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
          <p className="text-xs text-muted-foreground">Parent View · Updated live</p>
        </div>

        {/* Points */}
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="p-4 text-center">
            <Star className="h-6 w-6 text-amber-500 mx-auto mb-1" />
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{data.pointsBalance}</p>
            <p className="text-xs text-muted-foreground">Points Balance</p>
          </CardContent>
        </Card>

        {/* Parent Insights */}
        <ParentInsightCards studentId={data.studentId} agencyId={data.agencyId} />

        {/* Rewards Progress */}
        {data.rewards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Gift className="h-3 w-3" /> Rewards Progress
            </p>
            {data.rewards.map((r, i) => {
              const pct = Math.min(100, Math.round((data.pointsBalance / r.cost) * 100));
              const ready = data.pointsBalance >= r.cost;
              return (
                <Card key={i} className="border-border/40">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-xl">{r.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{r.name}</p>
                      <Progress value={pct} className="h-1.5 mt-1" />
                    </div>
                    <div className="text-right shrink-0">
                      {ready ? (
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
        )}

        {/* Quests */}
        <StudentQuestCards studentId={data.studentId} agencyId={data.agencyId} />

        {/* Parent Actions */}
        <ParentActionButtons
          studentId={data.studentId}
          agencyId={data.agencyId}
          parentName="Parent"
        />

        {/* Funnel CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center space-y-2">
            <Sparkles className="h-5 w-5 text-primary mx-auto" />
            <p className="text-sm font-semibold">Want more updates?</p>
            <p className="text-xs text-muted-foreground">Get full access to insights, messaging, and your child's progress.</p>
            <Button size="sm" className="gap-1.5" onClick={() => window.location.href = '/'}>
              Continue in Parent App <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground pt-4">
          Powered by Beacon · Updated live
        </p>
      </div>
    </div>
  );
}
