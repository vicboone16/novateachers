/**
 * ClassroomMomentum — Live momentum score based on positive vs negative events.
 * Subscribes to beacon_points_ledger in real time and computes a rolling score.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  agencyId: string;
  classroomId: string | null;
  studentIds: string[];
}

type MomentumLevel = 'low' | 'medium' | 'high' | 'fire';

const LEVEL_CONFIG: Record<MomentumLevel, { label: string; color: string; bg: string; icon: any }> = {
  low: { label: 'Low', color: 'text-destructive', bg: 'bg-destructive/10', icon: TrendingDown },
  medium: { label: 'Steady', color: 'text-muted-foreground', bg: 'bg-muted', icon: Minus },
  high: { label: 'Strong', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: TrendingUp },
  fire: { label: 'On Fire!', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Flame },
};

export function ClassroomMomentum({ agencyId, classroomId, studentIds }: Props) {
  const [positiveCount, setPositiveCount] = useState(0);
  const [negativeCount, setNegativeCount] = useState(0);
  const [recentBurst, setRecentBurst] = useState(0); // positives in last 60s
  const burstRef = useRef<number[]>([]); // timestamps of recent positives

  const addBurst = useCallback(() => {
    const now = Date.now();
    burstRef.current.push(now);
    burstRef.current = burstRef.current.filter(t => now - t < 60000);
    setRecentBurst(burstRef.current.length);
  }, []);

  // Load today's counts
  useEffect(() => {
    if (!agencyId || studentIds.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    cloudSupabase
      .from('beacon_points_ledger')
      .select('points')
      .eq('agency_id', agencyId)
      .in('student_id', studentIds)
      .gte('created_at', today + 'T00:00:00')
      .then(({ data }) => {
        let pos = 0, neg = 0;
        for (const row of (data || []) as any[]) {
          if (row.points > 0) pos++;
          else if (row.points < 0) neg++;
        }
        setPositiveCount(pos);
        setNegativeCount(neg);
      });
  }, [agencyId, studentIds]);

  // Realtime subscription
  useEffect(() => {
    if (!agencyId) return;
    const channel = cloudSupabase
      .channel('momentum-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'beacon_points_ledger',
        filter: `agency_id=eq.${agencyId}`,
      }, (payload: any) => {
        const pts = payload.new?.points || 0;
        if (pts > 0) {
          setPositiveCount(p => p + 1);
          addBurst();
        } else if (pts < 0) {
          setNegativeCount(p => p + 1);
        }
      })
      .subscribe();
    return () => { cloudSupabase.removeChannel(channel); };
  }, [agencyId, addBurst]);

  // Decay burst counter
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      burstRef.current = burstRef.current.filter(t => now - t < 60000);
      setRecentBurst(burstRef.current.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const total = positiveCount + negativeCount;
  const ratio = total > 0 ? positiveCount / total : 0.5;
  const level: MomentumLevel =
    recentBurst >= 5 ? 'fire' :
    ratio >= 0.75 ? 'high' :
    ratio >= 0.5 ? 'medium' : 'low';

  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;
  const pct = Math.round(ratio * 100);

  return (
    <div className={cn(
      'flex items-center gap-2.5 rounded-2xl border border-border/60 shadow-sm px-3.5 py-2.5 shrink-0 transition-all',
      config.bg,
    )}>
      <Icon className={cn('h-4 w-4', config.color)} />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Momentum</p>
        <p className={cn('text-sm font-bold leading-none', config.color)}>
          {config.label} · {pct}%
        </p>
      </div>
      {level === 'fire' && (
        <span className="text-base animate-pulse">🔥</span>
      )}
    </div>
  );
}
