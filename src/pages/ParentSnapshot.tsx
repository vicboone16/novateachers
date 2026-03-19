/**
 * ParentSnapshot — Public parent-facing page for daily student snapshot.
 * Accessed via /snapshot/:token (secure, token-authenticated, no login required).
 * Warm, reassuring, celebratory tone for parents.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Star, Flag, Gift, Lock, Sparkles, Heart, CheckCircle, Trophy } from 'lucide-react';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;

interface SnapshotData {
  student_name: string;
  snapshot_date: string;
  points_earned: number;
  attendance_status: string;
  highlights: string[];
  teacher_note: string | null;
}

export default function ParentSnapshot() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) loadSnapshot(token);
    else setError('No snapshot link provided');
  }, [token]);

  const loadSnapshot = async (t: string) => {
    setLoading(true);
    try {
      const { data: tokenRow } = await supabase.from('snapshot_tokens' as any).select('snapshot_id, expires_at').eq('token', t).maybeSingle();
      if (!tokenRow) { setError('This link is invalid or has expired.'); setLoading(false); return; }
      const tr = tokenRow as any;
      if (new Date(tr.expires_at) < new Date()) { setError('This snapshot link has expired.'); setLoading(false); return; }
      const { data: snap } = await supabase.from('daily_student_snapshots' as any).select('*').eq('id', tr.snapshot_id).maybeSingle();
      if (!snap) { setError('Snapshot not found.'); setLoading(false); return; }
      const s = snap as any;
      let studentName = 'Your child';
      const { data: client } = await supabase.from('clients' as any).select('first_name').eq('id', s.student_id).maybeSingle();
      if (client) studentName = (client as any).first_name || studentName;
      const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', s.student_id);
      const total = (ledger || []).reduce((sum: number, r: any) => sum + (r.points || 0), 0);
      setBalance(total);
      setData({ student_name: studentName, snapshot_date: s.snapshot_date, points_earned: s.points_earned || 0, attendance_status: s.attendance_status || 'present', highlights: s.highlights || [], teacher_note: s.teacher_note || null });
    } catch { setError('Something went wrong loading this snapshot.'); }
    setLoading(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (error || !data) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3 px-6"><Lock className="h-12 w-12 mx-auto text-muted-foreground" /><p className="text-lg font-bold">{error || 'Unable to load snapshot'}</p><p className="text-sm text-muted-foreground">Contact the teacher for a new link.</p></div>
    </div>
  );

  const racePct = Math.min(100, (balance / TRACK_LENGTH) * 100);
  const checkpointsReached = Math.floor(Math.min(balance, TRACK_LENGTH) / CHECKPOINT_INTERVAL);
  const formattedDate = new Date(data.snapshot_date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-accent/5">
      <div className="mx-auto max-w-md px-4 py-8 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-md">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold font-heading">{data.student_name}'s Day</h1>
          <p className="text-sm text-muted-foreground">{formattedDate}</p>
        </div>

        {/* Encouraging banner */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <CardContent className="p-5 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="h-7 w-7 fill-amber-400 text-amber-400" />
              <span className="text-4xl font-bold tabular-nums">{data.points_earned}</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Points Earned Today</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.points_earned > 0 ? `Great job! ${data.student_name} is doing amazing! 🌟` : `Every day is a fresh start! 💪`}
            </p>
            <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Balance</p>
              <p className="text-lg font-bold">{balance} points</p>
            </div>
          </CardContent>
        </Card>

        {/* Race progress */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Flag className="h-4 w-4 text-accent" /><p className="text-sm font-bold">Race Progress</p></div>
              <Badge variant="outline" className="text-[10px] gap-1"><Trophy className="h-2.5 w-2.5" /> {checkpointsReached} checkpoints</Badge>
            </div>
            <Progress value={racePct} className="h-3" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{Math.round(racePct)}% complete</span>
              {racePct >= 100 ? <span className="text-accent font-bold">🏁 Finished!</span> : <span>{TRACK_LENGTH - Math.min(balance, TRACK_LENGTH)} to go</span>}
            </div>
          </CardContent>
        </Card>

        {/* Highlights */}
        {data.highlights.length > 0 && (
          <Card className="border-border/40">
            <CardContent className="p-4">
              <p className="text-sm font-bold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Today's Highlights</p>
              <ul className="space-y-2">
                {data.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Teacher note */}
        {data.teacher_note && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-sm font-bold mb-1 flex items-center gap-2">📝 A Note from the Teacher</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{data.teacher_note}</p>
            </CardContent>
          </Card>
        )}

        {/* Supportive footer */}
        <div className="text-center space-y-2 pt-4 pb-8">
          <p className="text-xs text-muted-foreground">
            Thank you for being part of {data.student_name}'s journey! 💜
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3" /> Powered by Beacon
          </p>
        </div>
      </div>
    </div>
  );
}
