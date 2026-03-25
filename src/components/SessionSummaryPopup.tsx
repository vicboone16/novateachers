/**
 * SessionSummaryPopup — Auto-popup at end of session showing what improved and what needs attention.
 * Triggered when teacher has been active 30+ min and navigates away or clicks "End Session".
 */
import { useEffect, useState } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryItem {
  label: string;
  type: 'improved' | 'attention';
  detail: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  studentIds: string[];
  studentNames: Record<string, string>;
}

export function SessionSummaryPopup({ open, onOpenChange, agencyId, studentIds, studentNames }: Props) {
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && agencyId && studentIds.length > 0) {
      computeSummary();
    }
  }, [open, agencyId, studentIds]);

  const computeSummary = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const computed: SummaryItem[] = [];

    try {
      const { data } = await cloudSupabase
        .from('beacon_points_ledger')
        .select('student_id, points, source, reason')
        .eq('agency_id', agencyId)
        .in('student_id', studentIds)
        .gte('created_at', today + 'T00:00:00');

      const rows = (data || []) as any[];
      let total = 0;
      const perStudent: Record<string, { pos: number; neg: number }> = {};

      for (const r of rows) {
        const sid = r.student_id;
        if (!perStudent[sid]) perStudent[sid] = { pos: 0, neg: 0 };
        if (r.points > 0) {
          perStudent[sid].pos += r.points;
          total += r.points;
        } else {
          perStudent[sid].neg += Math.abs(r.points);
        }
      }
      setTotalPoints(total);

      // Improved: students with high positive ratio
      for (const [sid, counts] of Object.entries(perStudent)) {
        const name = studentNames[sid] || 'Student';
        if (counts.pos > 0 && counts.neg === 0) {
          computed.push({
            label: name,
            type: 'improved',
            detail: `${counts.pos} points earned, zero deductions`,
          });
        } else if (counts.neg > counts.pos) {
          computed.push({
            label: name,
            type: 'attention',
            detail: `${counts.neg} deducted vs ${counts.pos} earned — may need reinforcement adjustment`,
          });
        }
      }

      // Students with no activity
      for (const sid of studentIds) {
        if (!perStudent[sid]) {
          computed.push({
            label: studentNames[sid] || 'Student',
            type: 'attention',
            detail: 'No point activity today — check engagement',
          });
        }
      }
    } catch { /* silent */ }

    // Sort: improved first
    computed.sort((a, b) => (a.type === 'improved' ? -1 : 1) - (b.type === 'improved' ? -1 : 1));
    setItems(computed);
    setLoading(false);
  };

  const improved = items.filter(i => i.type === 'improved');
  const attention = items.filter(i => i.type === 'attention');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Session Summary
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total banner */}
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
              <Star className="h-6 w-6 text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">{totalPoints} points awarded</p>
                <p className="text-xs text-muted-foreground">across {studentIds.length} students today</p>
              </div>
            </div>

            {/* Improved */}
            {improved.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">What Improved</p>
                </div>
                <div className="space-y-1.5">
                  {improved.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Needs Attention */}
            {attention.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Needs Attention</p>
                </div>
                <div className="space-y-1.5">
                  {attention.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                      <TrendingDown className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done — Great Work! 🎉
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
