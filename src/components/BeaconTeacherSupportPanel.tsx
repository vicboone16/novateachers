/**
 * BeaconTeacherSupportPanel — Student-specific support snapshot.
 * Shows clinical support labels, day state selector, and today's plan.
 * Reads: v_beacon_teacher_dashboard, v_beacon_current_day_state, v_beacon_current_teacher_plan
 * Writes: generate_beacon_teacher_plan RPC
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Loader2, RefreshCw, StickyNote, Shield, Target,
  Lightbulb, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeacherTranslationCard } from '@/components/TeacherTranslationCard';

interface DashboardData {
  student_id: string;
  support_label?: string;
  primary_drivers?: string[];
  what_helps?: string[];
  what_to_avoid?: string[];
  top_targets?: { name: string; description?: string }[];
}

interface DayState {
  day_state: string;
  selected_by?: string;
  notes?: string;
}

interface TeacherPlan {
  targets: { name: string; description?: string }[];
  antecedents: string[];
  reactives: string[];
  reinforcement?: string;
  teacher_summary?: string;
}

const DAY_STATES = [
  { value: 'green', label: 'Green', emoji: '🟢', color: 'bg-emerald-500', desc: 'Great day — following plan' },
  { value: 'yellow', label: 'Yellow', emoji: '🟡', color: 'bg-amber-400', desc: 'Some challenges — extra support' },
  { value: 'red', label: 'Red', emoji: '🔴', color: 'bg-red-500', desc: 'Tough day — maximum support' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
  classroomId?: string;
}

export function BeaconTeacherSupportPanel({
  open, onOpenChange, studentId, studentName, agencyId, classroomId,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [currentState, setCurrentState] = useState<DayState | null>(null);
  const [plan, setPlan] = useState<TeacherPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNote, setShowNote] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load dashboard view
      const [dashRes, stateRes, planRes] = await Promise.all([
        supabase.from('v_beacon_teacher_dashboard' as any)
          .select('*').eq('student_id', studentId).maybeSingle(),
        supabase.from('beacon_student_day_state' as any)
          .select('day_state, selected_by, notes')
          .eq('student_id', studentId).eq('state_date', today).maybeSingle(),
        supabase.from('beacon_teacher_plans' as any)
          .select('targets, antecedents, reactives, reinforcement, teacher_summary')
          .eq('student_id', studentId).eq('plan_date', today).maybeSingle(),
      ]);

      if (dashRes.data) setDashboard(dashRes.data as any);
      if (stateRes.data) setCurrentState(stateRes.data as any);
      if (planRes.data) setPlan(planRes.data as any);
    } catch (err) {
      console.warn('[SupportPanel] Load error:', err);
    }
    setLoading(false);
  }, [studentId, today]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const selectDayState = async (state: string) => {
    if (!user) return;
    setGenerating(true);
    try {
      // Upsert day state
      const { error: stateErr } = await supabase.from('beacon_student_day_state' as any).upsert({
        student_id: studentId,
        state_date: today,
        day_state: state,
        selected_by: 'teacher',
        selected_by_user_id: user.id,
        classroom_id: classroomId || null,
        notes: noteText || null,
      }, { onConflict: 'student_id,state_date' });
      if (stateErr) console.warn('[SupportPanel] Day state upsert error:', stateErr);

      setCurrentState({ day_state: state, selected_by: 'teacher', notes: noteText || undefined });

      // Generate plan via RPC
      try {
        const { data: planData, error: planErr } = await supabase.rpc('generate_beacon_teacher_plan' as any, {
          p_student_id: studentId,
          p_plan_date: today,
          p_day_state: state,
        });
        if (planErr) throw planErr;
        if (planData) setPlan(planData as any);
      } catch (rpcErr) {
        console.warn('[SupportPanel] Plan RPC failed, loading from table:', rpcErr);
        // Fallback: reload plan from table
        const { data: fallback } = await supabase.from('beacon_teacher_plans' as any)
          .select('targets, antecedents, reactives, reinforcement, teacher_summary')
          .eq('student_id', studentId).eq('plan_date', today).maybeSingle();
        if (fallback) setPlan(fallback as any);
      }

      toast({ title: `${DAY_STATES.find(s => s.value === state)?.emoji} Day state set to ${state}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setGenerating(false);
  };

  const regeneratePlan = async () => {
    if (!currentState?.day_state) {
      toast({ title: 'Select a day state first' });
      return;
    }
    await selectDayState(currentState.day_state);
  };

  const selectedState = DAY_STATES.find(s => s.value === currentState?.day_state);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl pb-safe">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-base font-heading flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Support Plan
          </SheetTitle>
          <SheetDescription className="text-xs">
            {studentName} · {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* ── STUDENT SNAPSHOT ── */}
            {dashboard && (
              <div className="space-y-2">
                {dashboard.support_label && (
                  <Badge variant="outline" className="text-xs">{dashboard.support_label}</Badge>
                )}
                {dashboard.what_helps && dashboard.what_helps.length > 0 && (
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <p className="text-[10px] font-semibold text-accent-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> What Helps
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {dashboard.what_helps.map((h, i) => <li key={i}>• {h}</li>)}
                    </ul>
                  </div>
                )}
                {dashboard.what_to_avoid && dashboard.what_to_avoid.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Avoid
                    </p>
                    <ul className="text-xs space-y-0.5">
                      {dashboard.what_to_avoid.map((a, i) => <li key={i}>• {a}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── DAY STATE SELECTOR ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                How is today going?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DAY_STATES.map(ds => (
                  <button
                    key={ds.value}
                    onClick={() => selectDayState(ds.value)}
                    disabled={generating}
                    className={cn(
                      'rounded-xl border-2 p-3 text-center transition-all active:scale-95',
                      currentState?.day_state === ds.value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/40 hover:border-border',
                    )}
                  >
                    <span className="text-2xl">{ds.emoji}</span>
                    <p className="text-xs font-bold mt-1">{ds.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{ds.desc}</p>
                  </button>
                ))}
              </div>
              {generating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generating plan…
                </div>
              )}
            </div>

            {/* ── NOTE ── */}
            <div className="space-y-1.5">
              <button
                onClick={() => setShowNote(!showNote)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <StickyNote className="h-3 w-3" /> {showNote ? 'Hide note' : 'Add note'}
              </button>
              {showNote && (
                <Textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Optional note about today…"
                  rows={2}
                  className="text-xs"
                />
              )}
            </div>

            {/* ── TODAY'S PLAN ── */}
            {plan && (
              <Card className="border-border/40">
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      <Target className="h-3 w-3 text-primary" /> Today's Plan
                    </p>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={regeneratePlan} disabled={generating}>
                      <RefreshCw className={cn('h-3 w-3', generating && 'animate-spin')} /> Refresh
                    </Button>
                  </div>

                  {plan.teacher_summary && (
                    <p className="text-xs text-foreground/80 italic">{plan.teacher_summary}</p>
                  )}

                  {Array.isArray(plan.targets) && plan.targets.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Targets</p>
                      <ul className="text-xs space-y-0.5">
                        {plan.targets.map((t: any, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                            <span>{typeof t === 'string' ? t : t.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(plan.antecedents) && plan.antecedents.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Antecedent Supports</p>
                      <ul className="text-xs space-y-0.5">
                        {plan.antecedents.map((a: any, i) => (
                          <li key={i}>• {typeof a === 'string' ? a : (a as any).name || JSON.stringify(a)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(plan.reactives) && plan.reactives.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">If Things Escalate</p>
                      <ul className="text-xs space-y-0.5">
                        {plan.reactives.map((r: any, i) => (
                          <li key={i}>• {typeof r === 'string' ? r : (r as any).name || JSON.stringify(r)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {plan.reinforcement && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Reinforcement</p>
                      <p className="text-xs">{plan.reinforcement}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!plan && !generating && selectedState && (
              <Card className="border-dashed border-2">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No plan generated yet. Tap a day state to create one.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
