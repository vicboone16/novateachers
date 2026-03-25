/**
 * TeacherWinsFeed — Shows encouraging micro-messages based on real classroom data.
 * Computes wins from today's ledger data and displays them as a scrollable feed.
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Trophy, TrendingDown, Flame, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Win {
  id: string;
  icon: string;
  message: string;
  type: 'streak' | 'reduction' | 'milestone' | 'engagement';
}

interface Props {
  agencyId: string;
  studentIds: string[];
  studentNames: Record<string, string>;
}

export function TeacherWinsFeed({ agencyId, studentIds, studentNames }: Props) {
  const [wins, setWins] = useState<Win[]>([]);

  useEffect(() => {
    if (!agencyId || studentIds.length === 0) return;
    computeWins();
  }, [agencyId, studentIds]);

  const computeWins = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const computed: Win[] = [];

    try {
      // Get today's points per student
      const { data: todayData } = await cloudSupabase
        .from('beacon_points_ledger')
        .select('student_id, points, source')
        .eq('agency_id', agencyId)
        .in('student_id', studentIds)
        .gte('created_at', today + 'T00:00:00');

      const rows = (todayData || []) as any[];

      // Count positives per student
      const studentPositives: Record<string, number> = {};
      const studentNegatives: Record<string, number> = {};
      let totalPositive = 0;
      let totalNegative = 0;

      for (const r of rows) {
        const sid = r.student_id;
        if (r.points > 0) {
          studentPositives[sid] = (studentPositives[sid] || 0) + 1;
          totalPositive++;
        } else if (r.points < 0) {
          studentNegatives[sid] = (studentNegatives[sid] || 0) + 1;
          totalNegative++;
        }
      }

      // Win: students on streaks (3+ consecutive positives)
      const streakStudents = Object.entries(studentPositives)
        .filter(([, count]) => count >= 3)
        .map(([sid]) => studentNames[sid] || 'Student');

      if (streakStudents.length > 0) {
        computed.push({
          id: 'streaks',
          icon: '🔥',
          message: `${streakStudents.length} student${streakStudents.length > 1 ? 's' : ''} on a streak today!`,
          type: 'streak',
        });
      }

      // Win: more positives than negatives
      if (totalPositive > 0 && totalNegative === 0) {
        computed.push({
          id: 'all-positive',
          icon: '🌟',
          message: 'All events today are positive — amazing classroom!',
          type: 'milestone',
        });
      } else if (totalPositive > totalNegative * 3 && totalPositive >= 5) {
        computed.push({
          id: 'ratio',
          icon: '💪',
          message: `Your positive-to-negative ratio is ${Math.round(totalPositive / Math.max(totalNegative, 1))}:1 today!`,
          type: 'milestone',
        });
      }

      // Win: total points milestone
      const totalPts = rows.reduce((s, r) => s + Math.max(0, r.points), 0);
      if (totalPts >= 50) {
        computed.push({
          id: 'points-milestone',
          icon: '⭐',
          message: `${totalPts} points awarded today — keep it up!`,
          type: 'milestone',
        });
      }

      // Win: low behavior events
      if (totalNegative === 0 && totalPositive >= 3) {
        computed.push({
          id: 'zero-negative',
          icon: '🎉',
          message: 'Zero behavior deductions today!',
          type: 'reduction',
        });
      }

      // Compare with yesterday for behavior reduction
      const { data: yesterdayData } = await cloudSupabase
        .from('beacon_points_ledger')
        .select('points')
        .eq('agency_id', agencyId)
        .in('student_id', studentIds)
        .gte('created_at', yesterday + 'T00:00:00')
        .lt('created_at', today + 'T00:00:00')
        .lt('points', 0);

      const yesterdayNeg = (yesterdayData || []).length;
      if (yesterdayNeg > 0 && totalNegative < yesterdayNeg) {
        const reduction = Math.round(((yesterdayNeg - totalNegative) / yesterdayNeg) * 100);
        if (reduction >= 20) {
          computed.push({
            id: 'reduction',
            icon: '📉',
            message: `Behavior events down ${reduction}% from yesterday!`,
            type: 'reduction',
          });
        }
      }
    } catch { /* silent */ }

    // Always show at least one encouraging message
    if (computed.length === 0) {
      computed.push({
        id: 'default',
        icon: '✨',
        message: 'You\'re making a difference — every interaction matters.',
        type: 'engagement',
      });
    }

    setWins(computed);
  };

  if (wins.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Trophy className="h-4 w-4 text-amber-500" />
        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Teacher Wins</p>
      </div>
      <div className="px-4 pb-3 space-y-1.5">
        {wins.map(win => (
          <div key={win.id} className="flex items-start gap-2 rounded-xl bg-secondary/50 px-3 py-2">
            <span className="text-sm shrink-0">{win.icon}</span>
            <p className="text-[11px] text-foreground/90 leading-snug font-medium">{win.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
