/**
 * ExternalStudentPortal — Public student-facing page via /external/student/:token.
 * Shows: race/game board, points, avatar, rewards preview.
 * No clinical or negative content.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Star, Trophy, Flag, Gift, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

const TRACK_LENGTH = 100;
const CHECKPOINT_INTERVAL = 20;

export default function ExternalStudentPortal() {
  const { token } = useParams<{ token: string }>();
  const [studentName, setStudentName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<{ name: string; emoji: string; cost: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError('No access token.'); setLoading(false); return; }
    loadPortal(token);
  }, [token]);

  const loadPortal = async (t: string) => {
    setLoading(true); setError(null);
    try {
      const { data: linkData } = await supabase
        .from('external_access_links' as any)
        .select('*').eq('token', t).eq('link_type', 'student').eq('is_active', true).maybeSingle();
      if (!linkData) { setError('This link is no longer active.'); setLoading(false); return; }
      const link = linkData as any;
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        setError('This link has expired.'); setLoading(false); return;
      }
      const sid = link.student_id;

      // Update last used
      supabase.from('external_access_links' as any).update({ last_used_at: new Date().toISOString() }).eq('id', link.id).then(() => {});

      // Name + avatar
      try {
        const { data: c } = await supabase.from('clients' as any).select('first_name').eq('id', sid).maybeSingle();
        if (c) setStudentName((c as any).first_name || '');
      } catch {}
      try {
        const { data: p } = await supabase.from('student_game_profiles' as any).select('avatar_emoji').eq('student_id', sid).maybeSingle();
        if (p) setAvatarEmoji((p as any).avatar_emoji || '👤');
      } catch {}

      // Balance
      try {
        const { data: ledger } = await cloudSupabase.from('beacon_points_ledger').select('points').eq('student_id', sid);
        setBalance((ledger || []).reduce((s, r) => s + r.points, 0));
      } catch {}

      // Rewards
      try {
        const { data: rws } = await supabase.from('beacon_rewards' as any).select('name, emoji, point_cost').eq('is_active', true).order('point_cost', { ascending: true }).limit(4);
        setRewards((rws || []).map((r: any) => ({ name: r.name, emoji: r.emoji || '🎁', cost: r.point_cost })));
      } catch {}
    } catch (err: any) {
      setError(err.message || 'Could not load.');
    }
    setLoading(false);
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f23] text-white">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400 mx-auto" />
        <p className="text-sm text-white/60">Loading your board…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f23] text-white px-4">
      <div className="text-center space-y-3 max-w-xs">
        <AlertTriangle className="h-10 w-10 text-red-400/60 mx-auto" />
        <p className="text-sm font-medium text-red-400">{error}</p>
        <Button variant="outline" size="sm" onClick={() => token && loadPortal(token)} className="bg-white/10 border-white/20 text-white hover:bg-white/20">Retry</Button>
      </div>
    </div>
  );

  const position = Math.min(balance, TRACK_LENGTH);
  const pct = (position / TRACK_LENGTH) * 100;
  const checkpoints = Math.floor(position / CHECKPOINT_INTERVAL);
  const finished = position >= TRACK_LENGTH;

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white px-4 py-6 safe-top safe-bottom" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Avatar + Name */}
        <div className="text-center space-y-2">
          <div className="text-6xl">{avatarEmoji}</div>
          <h1 className="text-2xl font-black">{studentName || 'Student'}</h1>
        </div>

        {/* Points */}
        <div className="rounded-2xl bg-white/5 border border-amber-500/30 p-5 text-center">
          <Star className="h-8 w-8 text-amber-400 mx-auto mb-2" />
          <p className="text-4xl font-black text-amber-400 tabular-nums">{balance}</p>
          <p className="text-xs text-white/50 mt-1">Points</p>
        </div>

        {/* Race Track */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="h-4 w-4 text-violet-400" />
            <p className="text-sm font-bold">Your Race</p>
            {finished && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">🏆 Finished!</Badge>}
          </div>
          <div className="relative bg-white/10 rounded-full h-6 overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-1000"
              style={{ width: `${pct}%` }} />
            {/* Checkpoints */}
            {Array.from({ length: TRACK_LENGTH / CHECKPOINT_INTERVAL }, (_, i) => (i + 1) * CHECKPOINT_INTERVAL).map(cp => (
              <div key={cp} className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/30"
                style={{ left: `${(cp / TRACK_LENGTH) * 100}%` }} />
            ))}
            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">🏁</div>
          </div>
          <p className="text-xs text-white/50 mt-2 text-center">{checkpoints} checkpoints reached · {TRACK_LENGTH - position} to go</p>
        </div>

        {/* Rewards Preview */}
        {rewards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <Gift className="h-3 w-3" /> Rewards
            </p>
            {rewards.map((r, i) => {
              const rewardPct = Math.min(100, Math.round((balance / r.cost) * 100));
              const canGet = balance >= r.cost;
              return (
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
                  <span className="text-xl">{r.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <Progress value={rewardPct} className="h-1.5 mt-1 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-amber-500" />
                  </div>
                  <div className="text-right shrink-0">
                    {canGet ? (
                      <Badge className="bg-accent/20 text-accent-foreground text-[10px]">⭐ Ready!</Badge>
                    ) : (
                      <p className="text-[10px] text-white/40 tabular-nums">{r.cost - balance} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[10px] text-white/30 pt-4">Powered by Beacon</p>
      </div>
    </div>
  );
}
