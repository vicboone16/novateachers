/**
 * TeacherTranslationCard — Plain-language teacher support translation.
 * Reads from v_beacon_teacher_translation (Core view).
 * Falls back to beacon_teacher_plans.teacher_summary if view unavailable.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb, AlertTriangle, Target, Shield, Loader2,
} from 'lucide-react';

interface TranslationData {
  student_id: string;
  support_level?: string;
  teacher_summary?: string;
  what_to_do?: string[];
  what_to_avoid?: string[];
  daily_goal?: string;
}

interface Props {
  studentId: string;
  studentName: string;
  dayState?: string;
}

const SUPPORT_COLORS: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  moderate: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

export function TeacherTranslationCard({ studentId, studentName, dayState }: Props) {
  const [data, setData] = useState<TranslationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Try the translation view first
        const { data: row, error } = await supabase
          .from('v_beacon_teacher_translation' as any)
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle();

        if (!cancelled && row && !error) {
          setData(row as any);
        } else if (!cancelled) {
          // Fallback: build from beacon_teacher_plans + day state
          const today = new Date().toISOString().slice(0, 10);
          const { data: plan } = await supabase
            .from('beacon_teacher_plans' as any)
            .select('teacher_summary, targets, antecedents, reactives')
            .eq('student_id', studentId)
            .eq('plan_date', today)
            .maybeSingle();

          if (plan && !cancelled) {
            const p = plan as any;
            setData({
              student_id: studentId,
              support_level: dayState === 'red' ? 'high' : dayState === 'yellow' ? 'moderate' : 'low',
              teacher_summary: p.teacher_summary || undefined,
              what_to_do: Array.isArray(p.antecedents) ? p.antecedents.map((a: any) =>
                typeof a === 'string' ? a : a.name || JSON.stringify(a)
              ) : undefined,
              what_to_avoid: Array.isArray(p.reactives) ? p.reactives.map((r: any) =>
                typeof r === 'string' ? r : r.name || JSON.stringify(r)
              ) : undefined,
              daily_goal: Array.isArray(p.targets) && p.targets.length > 0
                ? (typeof p.targets[0] === 'string' ? p.targets[0] : p.targets[0].name)
                : undefined,
            });
          }
        }
      } catch {
        // silent — view may not exist
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [studentId, dayState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const level = data.support_level?.toLowerCase() || 'low';
  const colorClass = SUPPORT_COLORS[level] || SUPPORT_COLORS.low;

  return (
    <div className="space-y-3">
      {/* Support Badge */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Teacher Support Guide
        </span>
        {data.support_level && (
          <Badge className={`text-[10px] border ${colorClass}`}>
            {data.support_level} support
          </Badge>
        )}
      </div>

      {/* Teacher Summary Card */}
      {data.teacher_summary && (
        <Card className="border-border/40">
          <CardContent className="p-3">
            <p className="text-xs text-foreground leading-relaxed">
              {data.teacher_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Two-Column Do / Avoid */}
      {((data.what_to_do && data.what_to_do.length > 0) ||
        (data.what_to_avoid && data.what_to_avoid.length > 0)) && (
        <div className="grid grid-cols-2 gap-2">
          {/* What to Do */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> What to Do
            </p>
            <ul className="text-xs text-emerald-900 space-y-1">
              {(data.what_to_do || []).map((item, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
              {(!data.what_to_do || data.what_to_do.length === 0) && (
                <li className="text-emerald-600 italic">No specific tips yet</li>
              )}
            </ul>
          </div>

          {/* What to Avoid */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> What to Avoid
            </p>
            <ul className="text-xs text-red-900 space-y-1">
              {(data.what_to_avoid || []).map((item, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-red-500 mt-0.5">✗</span>
                  <span>{item}</span>
                </li>
              ))}
              {(!data.what_to_avoid || data.what_to_avoid.length === 0) && (
                <li className="text-red-600 italic">No specific notes yet</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Daily Goal Card */}
      {data.daily_goal && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-start gap-2">
            <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                Today's Focus
              </p>
              <p className="text-xs text-foreground font-medium">
                {data.daily_goal}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
