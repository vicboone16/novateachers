/**
 * StudentReinforcementScheduleSheet — Per-student day-state schedule overrides.
 *
 * Implements Level 2 of the 3-tier reinforcement architecture:
 *   - "Use classroom defaults" toggle (inherits from SDC classroom template)
 *   - Override each state's reinforcement schedule independently
 *   - Token goal override
 *   - Response cost enabled/disabled
 *   - Earn-only mode (no response cost ever, regardless of classroom setting)
 *
 * Day-state rule enforcement:
 *   🔴 RED    → Never expect GREEN performance. Reinforce regulation, not task completion.
 *   🟡 YELLOW → Reinforce tolerance and recovery attempts.
 *   🟢 GREEN  → Reinforce skill performance and independence.
 *   🔵 BLUE   → Reinforce generalization and sustained success.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Loader2, Check, Info, RotateCcw } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface StudentSchedule {
  id?: string;
  student_id: string;
  agency_id: string;
  classroom_id: string | null;
  use_classroom_defaults: boolean;
  red_schedule_override: string | null;
  yellow_schedule_override: string | null;
  green_schedule_override: string | null;
  blue_schedule_override: string | null;
  token_goal_override: number | null;
  response_cost_enabled_override: boolean | null;
  response_cost_value_override: number | null;
  earn_only_mode: boolean;
}

interface EffectiveSchedule {
  effective_red_schedule: string;
  effective_yellow_schedule: string;
  effective_green_schedule: string;
  effective_blue_schedule: string;
  effective_token_goal: number;
  effective_min_token_goal: number;
  effective_stretch_token_goal: number;
  effective_response_cost_enabled: boolean;
  effective_response_cost_value: number;
  sdc_template_name: string | null;
  sdc_support_level: string | null;
}

// ─── Constants ───────────────────────────────────────────────

const SCHEDULE_OPTIONS = [
  { value: 'FR1',     label: 'FR1 — Every response' },
  { value: 'FR1_FR2', label: 'FR1→FR2 — Every 1–2 responses' },
  { value: 'FR2',     label: 'FR2 — Every 2 responses' },
  { value: 'FR2_FR3', label: 'FR2→FR3 — Every 2–3 responses' },
  { value: 'FR3',     label: 'FR3 — Every 3 responses' },
  { value: 'FR5',     label: 'FR5 — Every 5 responses' },
  { value: 'FR2_VR3', label: 'FR2→VR3 — Ratio to variable' },
  { value: 'VR3',     label: 'VR3 — Variable ~3 responses' },
  { value: 'VR5',     label: 'VR5 — Variable ~5 responses' },
];

const STATE_CONFIG = {
  red:    { label: 'RED',    emoji: '🔴', goal: 'Stabilize, not teach', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800', color: 'text-red-600 dark:text-red-400' },
  yellow: { label: 'YELLOW', emoji: '🟡', goal: 'Rebuild tolerance',   bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800', color: 'text-yellow-600 dark:text-yellow-400' },
  green:  { label: 'GREEN',  emoji: '🟢', goal: 'Skill acquisition',   bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-200 dark:border-green-800', color: 'text-green-600 dark:text-green-400' },
  blue:   { label: 'BLUE',   emoji: '🔵', goal: 'Independence',        bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800', color: 'text-blue-600 dark:text-blue-400' },
} as const;

// ─── Sub-component: ScheduleStateRow ─────────────────────────

function ScheduleStateRow({
  state,
  overrideValue,
  effectiveValue,
  useDefaults,
  onChange,
}: {
  state: keyof typeof STATE_CONFIG;
  overrideValue: string | null;
  effectiveValue: string;
  useDefaults: boolean;
  onChange: (val: string | null) => void;
}) {
  const cfg = STATE_CONFIG[state];
  const hasOverride = overrideValue !== null;

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{cfg.emoji}</span>
          <div>
            <p className={cn('text-[11px] font-bold uppercase tracking-wider', cfg.color)}>
              {cfg.label}
            </p>
            <p className="text-[9px] text-muted-foreground">{cfg.goal}</p>
          </div>
        </div>
        {hasOverride && !useDefaults && (
          <button
            onClick={() => onChange(null)}
            className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset
          </button>
        )}
      </div>

      {useDefaults ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[9px] font-mono">
            {effectiveValue}
          </Badge>
          <p className="text-[9px] text-muted-foreground">Inherited from classroom template</p>
        </div>
      ) : (
        <Select
          value={overrideValue ?? effectiveValue}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger className="h-8 text-[10px] bg-background/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={effectiveValue} className="text-[10px] italic text-muted-foreground">
              Default: {effectiveValue}
            </SelectItem>
            {SCHEDULE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-[10px]">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface StudentReinforcementScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
  classroomId?: string;
}

export function StudentReinforcementScheduleSheet({
  open, onOpenChange, studentId, studentName, agencyId, classroomId,
}: StudentReinforcementScheduleSheetProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schedule, setSchedule] = useState<StudentSchedule | null>(null);
  const [effective, setEffective] = useState<EffectiveSchedule | null>(null);

  // Form state
  const [useDefaults, setUseDefaults] = useState(true);
  const [redOverride, setRedOverride] = useState<string | null>(null);
  const [yellowOverride, setYellowOverride] = useState<string | null>(null);
  const [greenOverride, setGreenOverride] = useState<string | null>(null);
  const [blueOverride, setBlueOverride] = useState<string | null>(null);
  const [tokenGoal, setTokenGoal] = useState<string>('');
  const [responseCostOverride, setResponseCostOverride] = useState<boolean | null>(null);
  const [earnOnly, setEarnOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        cloudSupabase
          .from('beacon_student_reinforcement_schedules')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle(),
        cloudSupabase
          .from('v_beacon_effective_reinforcement')
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle(),
      ]);

      const s = sRes.data as StudentSchedule | null;
      setSchedule(s);
      setEffective(eRes.data as EffectiveSchedule | null);

      // Populate form
      setUseDefaults(s?.use_classroom_defaults ?? true);
      setRedOverride(s?.red_schedule_override ?? null);
      setYellowOverride(s?.yellow_schedule_override ?? null);
      setGreenOverride(s?.green_schedule_override ?? null);
      setBlueOverride(s?.blue_schedule_override ?? null);
      setTokenGoal(s?.token_goal_override?.toString() ?? '');
      setResponseCostOverride(s?.response_cost_enabled_override ?? null);
      setEarnOnly(s?.earn_only_mode ?? false);
    } catch {/* silent */}
    setLoading(false);
  }, [studentId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Omit<StudentSchedule, 'id'> = {
        student_id: studentId,
        agency_id: agencyId,
        classroom_id: classroomId ?? null,
        use_classroom_defaults: useDefaults,
        red_schedule_override: useDefaults ? null : redOverride,
        yellow_schedule_override: useDefaults ? null : yellowOverride,
        green_schedule_override: useDefaults ? null : greenOverride,
        blue_schedule_override: useDefaults ? null : blueOverride,
        token_goal_override: tokenGoal ? parseInt(tokenGoal) : null,
        response_cost_enabled_override: earnOnly ? false : responseCostOverride,
        response_cost_value_override: null,
        earn_only_mode: earnOnly,
      };

      if (schedule?.id) {
        await cloudSupabase
          .from('beacon_student_reinforcement_schedules')
          .update(payload)
          .eq('id', schedule.id);
      } else {
        await cloudSupabase
          .from('beacon_student_reinforcement_schedules')
          .insert(payload);
      }

      toast({ title: '✓ Student schedule saved' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  // Fallback effective values when no view row yet
  const eff = effective ?? {
    effective_red_schedule: 'FR1',
    effective_yellow_schedule: 'FR1_FR2',
    effective_green_schedule: 'FR2_FR3',
    effective_blue_schedule: 'VR3',
    effective_token_goal: 5,
    effective_min_token_goal: 3,
    effective_stretch_token_goal: 8,
    effective_response_cost_enabled: false,
    effective_response_cost_value: 1,
    sdc_template_name: null,
    sdc_support_level: null,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-10">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            Reinforcement Schedule — {studentName}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">

            {/* Effective template badge */}
            {eff.sdc_template_name && (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <p className="text-[10px] text-muted-foreground">Classroom template:</p>
                <Badge variant="secondary" className="text-[9px]">{eff.sdc_template_name}</Badge>
              </div>
            )}

            {/* Use defaults toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
              <div>
                <p className="text-xs font-semibold">Use classroom defaults</p>
                <p className="text-[10px] text-muted-foreground">
                  Inherit schedule from classroom SDC template
                </p>
              </div>
              <Switch
                checked={useDefaults}
                onCheckedChange={(v) => {
                  setUseDefaults(v);
                  if (v) {
                    setRedOverride(null);
                    setYellowOverride(null);
                    setGreenOverride(null);
                    setBlueOverride(null);
                  }
                }}
              />
            </div>

            {/* Day-state schedules */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Day-State Reinforcement Schedule
              </Label>
              <ScheduleStateRow
                state="red"
                overrideValue={redOverride}
                effectiveValue={eff.effective_red_schedule}
                useDefaults={useDefaults}
                onChange={setRedOverride}
              />
              <ScheduleStateRow
                state="yellow"
                overrideValue={yellowOverride}
                effectiveValue={eff.effective_yellow_schedule}
                useDefaults={useDefaults}
                onChange={setYellowOverride}
              />
              <ScheduleStateRow
                state="green"
                overrideValue={greenOverride}
                effectiveValue={eff.effective_green_schedule}
                useDefaults={useDefaults}
                onChange={setGreenOverride}
              />
              <ScheduleStateRow
                state="blue"
                overrideValue={blueOverride}
                effectiveValue={eff.effective_blue_schedule}
                useDefaults={useDefaults}
                onChange={setBlueOverride}
              />
            </div>

            {/* Token goal override */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Token Goal Override
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder={`Default: ${eff.effective_token_goal} tokens`}
                    value={tokenGoal}
                    onChange={e => setTokenGoal(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="text-[10px] text-muted-foreground text-center">
                  <p>Min: {eff.effective_min_token_goal}</p>
                  <p>Max: {eff.effective_stretch_token_goal}</p>
                </div>
              </div>
            </div>

            {/* Earn-only mode */}
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Response Cost
              </Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Earn-Only Mode</p>
                  <p className="text-[10px] text-muted-foreground">
                    No response cost ever — overrides all other settings
                  </p>
                </div>
                <Switch checked={earnOnly} onCheckedChange={setEarnOnly} />
              </div>

              {!earnOnly && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Response cost override</p>
                  <div className="flex gap-2">
                    {([
                      { label: 'Classroom default', val: null },
                      { label: 'Enabled', val: true },
                      { label: 'Disabled', val: false },
                    ] as { label: string; val: boolean | null }[]).map(opt => (
                      <button
                        key={opt.label}
                        onClick={() => setResponseCostOverride(opt.val)}
                        className={cn(
                          'flex-1 rounded-lg border text-[9px] py-1.5 px-1 transition-all leading-tight',
                          responseCostOverride === opt.val
                            ? 'border-primary bg-primary text-primary-foreground font-semibold'
                            : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RED state warning */}
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2.5">
              <Info className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-700 dark:text-red-300 leading-relaxed">
                Response cost is automatically suppressed during <strong>RED</strong> state
                unless explicitly enabled for this student.
              </p>
            </div>

            <Button onClick={save} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Schedule
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
