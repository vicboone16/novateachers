/**
 * ExternalParentPortal — Token-based parent link page.
 * Mobile-first, warm, no-login-required view of child's progress + messaging.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { ParentHeaderCard } from '@/components/parent-link/ParentHeaderCard';
import { ProgressSnapshotCard } from '@/components/parent-link/ProgressSnapshotCard';
import { TeacherUpdateCard } from '@/components/parent-link/TeacherUpdateCard';
import { QuickReplyButtons } from '@/components/parent-link/QuickReplyButtons';
import { ParentMessageThread } from '@/components/parent-link/ParentMessageThread';
import { MessageComposer } from '@/components/parent-link/MessageComposer';
import { ParentInsightCards } from '@/components/ParentInsightCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Loader2, ArrowRight, Sparkles } from 'lucide-react';

interface PortalData {
  studentId: string;
  agencyId: string;
  studentName: string;
  avatarEmoji: string;
  pointsBalance: number;
  rewards: { name: string; emoji: string; cost: number }[];
  feedPosts: { id: string; body: string; title: string | null; created_at: string }[];
}

export default function ExternalParentPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadKey, setThreadKey] = useState(0);

  const loadPortal = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: linkData, error: linkErr } = await cloudSupabase
        .from('parent_access_links' as any)
        .select('*')
        .eq('token', t)
        .eq('is_active', true)
        .maybeSingle();
      if (linkErr) throw linkErr;
      if (!linkData) { setError('This link is no longer active or has expired.'); setLoading(false); return; }

      const link = linkData as any;
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError('This link has expired. Ask your teacher for a new one.');
        setLoading(false);
        return;
      }

      const studentId = link.student_id;

      // Update last_used_at (fire-and-forget)
      cloudSupabase.from('parent_access_links' as any).update({ last_used_at: new Date().toISOString() }).eq('id', link.id).then(() => {});

      // Parallel data loading
      const [nameRes, profileRes, ledgerRes, rewardsRes, feedRes] = await Promise.allSettled([
        cloudSupabase.from('classroom_group_students').select('first_name, last_name').eq('client_id', studentId).limit(1),
        cloudSupabase.from('student_game_profiles' as any).select('avatar_emoji').eq('student_id', studentId).maybeSingle(),
        cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', studentId),
        cloudSupabase.from('beacon_rewards' as any).select('name, image_url, cost, emoji').eq('active', true).eq('hidden', false).eq('archived', false).is('deleted_at', null).order('cost', { ascending: true }).limit(6),
        (async () => {
          const { data: groupData } = await cloudSupabase.from('classroom_group_students').select('group_id').eq('client_id', studentId).limit(1);
          const groupId = groupData?.[0]?.group_id;
          if (!groupId) return { data: [] };
          return cloudSupabase.from('classroom_feed_posts')
            .select('id, body, title, created_at')
            .eq('group_id', groupId)
            .in('post_type', ['celebration', 'announcement', 'positive'])
            .order('created_at', { ascending: false })
            .limit(5);
        })(),
      ]);

      // Resolve student name
      let studentName = 'Your Child';
      if (nameRes.status === 'fulfilled' && nameRes.value.data?.[0]) {
        const c = nameRes.value.data[0] as any;
        studentName = `${c.first_name || ''} ${(c.last_name || '')[0] || ''}`.trim() || 'Your Child';
      }

      let avatarEmoji = '👤';
      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        avatarEmoji = (profileRes.value.data as any).avatar_emoji || '👤';
      }

      const pointsBalance = ledgerRes.status === 'fulfilled'
        ? (ledgerRes.value.data || []).reduce((s: number, r: any) => s + r.points, 0)
        : 0;

      const rewards = rewardsRes.status === 'fulfilled'
        ? (rewardsRes.value.data || []).map((r: any) => ({ name: r.name, emoji: r.emoji || r.image_url || '🎁', cost: r.cost }))
        : [];

      const feedPosts = feedRes.status === 'fulfilled'
        ? ((feedRes.value as any).data || [])
        : [];

      setData({ studentId, agencyId: link.agency_id || '', studentName, avatarEmoji, pointsBalance, rewards, feedPosts });
    } catch (err: any) {
      setError(err.message || 'Could not load portal.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) { setError('No access token provided.'); setLoading(false); return; }
    loadPortal(token);
  }, [token, loadPortal]);

  // Loading state
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading your child's updates…</p>
      </div>
    </div>
  );

  // Error state
  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50/60 to-white dark:from-slate-900/80 dark:to-slate-950 px-4">
      <div className="text-center space-y-4 max-w-xs">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-destructive/10 mx-auto">
          <AlertTriangle className="h-7 w-7 text-destructive/60" />
        </div>
        <p className="text-sm font-medium text-foreground">{error}</p>
        <p className="text-xs text-muted-foreground">If this keeps happening, ask your child's teacher for a new link.</p>
        <Button variant="outline" size="sm" onClick={() => token && loadPortal(token)}>Try Again</Button>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/60 via-white to-slate-50/50 dark:from-slate-900/80 dark:via-slate-950 dark:to-slate-900/60 px-4 py-6 safe-top safe-bottom">
      <div className="max-w-[520px] mx-auto space-y-5">

        {/* 1. Header */}
        <ParentHeaderCard studentName={data.studentName} avatarEmoji={data.avatarEmoji} />

        {/* 2. Progress Snapshot */}
        <ProgressSnapshotCard pointsBalance={data.pointsBalance} rewards={data.rewards} />

        {/* 3. Teacher Updates */}
        <TeacherUpdateCard posts={data.feedPosts} />

        {/* 4. Quick Reply Buttons */}
        <QuickReplyButtons studentId={data.studentId} agencyId={data.agencyId} parentName="Parent" />

        {/* Parent Insights */}
        <ParentInsightCards studentId={data.studentId} agencyId={data.agencyId} />

        {/* 5. Message Thread */}
        <ParentMessageThread key={threadKey} studentId={data.studentId} />

        {/* 6. Message Input */}
        <MessageComposer
          studentId={data.studentId}
          agencyId={data.agencyId}
          parentName="Parent"
          onSent={() => setThreadKey(k => k + 1)}
        />

        {/* 7. Footer CTA */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-accent/[0.04]">
          <CardContent className="p-5 text-center space-y-3">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mx-auto">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-bold">Want full access and ongoing updates?</p>
            <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
              Get insights, messaging, and your child's complete progress in one place.
            </p>
            <Button size="sm" className="gap-1.5 rounded-2xl" onClick={() => window.location.href = '/'}>
              Open Parent App <ArrowRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground/60 pt-2 pb-4">
          Powered by Beacon · Updated live
        </p>
      </div>
    </div>
  );
}
