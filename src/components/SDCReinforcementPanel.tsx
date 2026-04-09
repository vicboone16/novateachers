/**
 * SDCReinforcementPanel — Classroom-level SDC reinforcement template selection.
 *
 * Implements the 3-tier reinforcement architecture:
 *   Level 1: SDC classroom template (High Support / Moderate / Behavior Intensive / Sensory-Autism)
 *   Level 2: Per-student schedule overrides (handled in StudentReinforcementScheduleSheet)
 *   Level 3: Per-behavior rules (handled in BehaviorRulesPanel)
 *
 * Day-state schedule logic:
 *   🔴 RED    → FR1 (dense, immediate, survival mode)
 *   🟡 YELLOW → FR1–FR2 (frequent, rebuilding tolerance)
 *   🟢 GREEN  → FR2–FR3 (structured, skill acquisition)
 *   🔵 BLUE   → VR3+ (intermittent, generalization)
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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  Loader2, Check, ChevronRight, Info, Target, Zap, Shield, Brain,
  AlertTriangle, Settings2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

export interface SDCTemplate {
  id: string;
  template_name: string;
  support_level: string;
  description: string | null;
  use_case_notes: string | null;
  red_schedule: string;
  yellow_schedule: string;
  green_schedule: string;
  blue_schedule: string;
  min_token_goal: number;
  standard_token_goal: number;
  stretch_token_goal: number;
  response_cost_default_enabled: boolean;
  response_cost_default_value: number;
  is_preset: boolean;
  sort_order: number;
}

export interface ClassroomReinforcementSettings {
  id?: string;
  classroom_id: string;
  agency_id: string;
  sdc_template_id: string | null;
  red_schedule_override: string | null;
  yellow_schedule_override: string | null;
  green_schedule_override: string | null;
  blue_schedule_override: string | null;
  min_token_goal_override: number | null;
  standard_token_goal_override: number | null;
  stretch_token_goal_override: number | null;
  response_cost_enabled_override: boolean | null;
  response_cost_value_override: number | null;
  token_economy_enabled: boolean;
  teacher_store_enabled: boolean;
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
  red:    { label: 'RED',    emoji: '🔴', color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950/40',    border: 'border-red-200 dark:border-red-800',    desc: 'Dysregulated — Survival mode' },
  yellow: { label: 'YELLOW', emoji: '🟡', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800', desc: 'Strained — Rebuilding tolerance' },
  green:  { label: 'GREEN',  emoji: '🟢', color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-950/40',  border: 'border-green-200 dark:border-green-800',  desc: 'Stable — Skill acquisition' },
  blue:   { label: 'BLUE',   emoji: '🔵', color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40',   border: 'border-blue-200 dark:border-blue-800',   desc: 'Generalization — Independence' },
} as const;

const SUPPORT_LEVEL_ICONS: Record<string, React.ElementType> = {
  high_support:         Zap,
  moderate_support:     Target,
  behavior_intensive:   AlertTriangle,
  sensory_autism:       Brain,
  custom:               Settings2,
};

// ─── Helper: schedule label ───────────────────────────────────

function scheduleLabel(val: string): string {
  return SCHEDULE_OPTIONS.find(o => o.value === val)?.label ?? val;
}

// ─── Sub-component: DayStateScheduleRow ──────────────────────

function DayStateScheduleRow({
  state, schedule,
}: {
  state: keyof typeof STATE_CONFIG;
  schedule: string;
}) {
  const cfg = STATE_CONFIG[state];
  return (
    <div className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 border', cfg.bg, cfg.border)}>
      <span className="text-base leading-none">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.color)}>
          {cfg.label}
        </span>
        <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
      </div>
      <Badge variant="outline" className="text-[9px] font-mono shrink-0 bg-background/80">
        {scheduleLabel(schedule)}
      </Badge>
    </div>
  );
}

// ─── Sub-component: SDCTemplateCard ──────────────────────────

function SDCTemplateCard({
  template, selected, onSelect,
}: {
  template: SDCTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = SUPPORT_LEVEL_ICONS[template.support_level] ?? Target;
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98]',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          selected ? 'bg-primary/15' : 'bg-muted',
        )}>
          <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-foreground truncate">{template.template_name}</p>
            {selected && <Check className="h-3 w-3 text-primary shrink-0" />}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
            {template.description}
          </p>
          {/* Quick schedule badges */}
          <div className="flex flex-wrap gap-1 mt-2">
            {(['red', 'yellow', 'green', 'blue'] as const).map(state => (
              <span key={state} className={cn(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-mono border',
                STATE_CONFIG[state].bg, STATE_CONFIG[state].border, STATE_CONFIG[state].color,
              )}>
                {STATE_CONFIG[state].emoji} {template[`${state}_schedule`]}
              </span>
            ))}
          </div>
          {/* Token goals */}
          <p className="text-[9px] text-muted-foreground mt-1.5">
            Token goals: {template.min_token_goal} / {template.standard_token_goal} / {template.stretch_token_goal}
            {template.response_cost_default_enabled ? '  •  Response cost: ON' : '  •  Response cost: OFF'}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface SDCReinforcementPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  agencyId: string;
  classroomName?: string;
}

export function SDCReinforcementPanel({
  open, onOpenChange, classroomId, agencyId, classroomName,
}: SDCReinforcementPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<SDCTemplate[]>([]);
  const [settings, setSettings] = useState<ClassroomReinforcementSettings | null>(null);

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tokenEconomy, setTokenEconomy] = useState(true);
  const [teacherStore, setTeacherStore] = useState(true);
  const [tokenGoalOverride, setTokenGoalOverride] = useState<string>('');
  const [responseCostOverride, setResponseCostOverride] = useState<boolean | null>(null);

  // Which tab is shown
  const [view, setView] = useState<'select' | 'detail'>('select');

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        cloudSupabase
          .from('beacon_sdc_reinforcement_templates')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        cloudSupabase
          .from('beacon_classroom_reinforcement_settings')
          .select('*')
          .eq('classroom_id', classroomId)
          .maybeSingle(),
      ]);

      const tmplData = (tRes.data || []) as SDCTemplate[];
      setTemplates(tmplData);

      const s = sRes.data as ClassroomReinforcementSettings | null;
      setSettings(s);
      setSelectedTemplateId(s?.sdc_template_id ?? null);
      setTokenEconomy(s?.token_economy_enabled ?? true);
      setTeacherStore(s?.teacher_store_enabled ?? true);
      setTokenGoalOverride(s?.standard_token_goal_override?.toString() ?? '');
      setResponseCostOverride(s?.response_cost_enabled_override ?? null);
    } catch {/* silent */}
    setLoading(false);
  }, [classroomId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Omit<ClassroomReinforcementSettings, 'id'> = {
        classroom_id: classroomId,
        agency_id: agencyId,
        sdc_template_id: selectedTemplateId,
        red_schedule_override: null,
        yellow_schedule_override: null,
        green_schedule_override: null,
        blue_schedule_override: null,
        min_token_goal_override: null,
        standard_token_goal_override: tokenGoalOverride ? parseInt(tokenGoalOverride) : null,
        stretch_token_goal_override: null,
        response_cost_enabled_override: responseCostOverride,
        response_cost_value_override: null,
        token_economy_enabled: tokenEconomy,
        teacher_store_enabled: teacherStore,
      };

      if (settings?.id) {
        await cloudSupabase
          .from('beacon_classroom_reinforcement_settings')
          .update(payload)
          .eq('id', settings.id);
      } else {
        await cloudSupabase
          .from('beacon_classroom_reinforcement_settings')
          .insert(payload);
      }

      toast({ title: '✓ Classroom reinforcement settings saved' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-10">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            SDC Reinforcement Schedule
          </SheetTitle>
          {classroomName && (
            <SheetDescription className="text-[11px]">
              {classroomName}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">

            {/* ── Critical Rule Banner ── */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>Critical rule:</strong> A student should never be expected to perform at GREEN expectations during RED.
                Reinforcement schedules must match the student's current regulation state.
              </p>
            </div>

            {/* ── Token Economy Toggles ── */}
            <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Classroom Economy
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Token Economy</p>
                  <Switch checked={tokenEconomy} onCheckedChange={setTokenEconomy} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Teacher Reward Store</p>
                  <Switch checked={teacherStore} onCheckedChange={setTeacherStore} />
                </div>
              </div>
            </div>

            {/* ── Template Selection ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  SDC Template
                </Label>
                {selectedTemplate && (
                  <button
                    onClick={() => setView(view === 'detail' ? 'select' : 'detail')}
                    className="text-[10px] text-primary flex items-center gap-0.5"
                  >
                    {view === 'detail' ? 'Back to templates' : 'View schedules'}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {view === 'select' || !selectedTemplate ? (
                <div className="space-y-2">
                  {templates.map(t => (
                    <SDCTemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedTemplateId === t.id}
                      onSelect={() => {
                        setSelectedTemplateId(t.id);
                        setView('detail');
                      }}
                    />
                  ))}
                  {templates.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      No SDC templates found. Run the SQL migration to seed presets.
                    </p>
                  )}
                </div>
              ) : (
                /* ── Detail View: schedules for selected template ── */
                <div className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const Icon = SUPPORT_LEVEL_ICONS[selectedTemplate.support_level] ?? Target;
                        return <Icon className="h-4 w-4 text-primary" />;
                      })()}
                      <p className="text-xs font-bold">{selectedTemplate.template_name}</p>
                    </div>

                    {/* Day-state schedules */}
                    <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Reinforcement Schedule by Day State
                    </Label>
                    <div className="space-y-1.5 mt-1">
                      <DayStateScheduleRow state="red"    schedule={selectedTemplate.red_schedule} />
                      <DayStateScheduleRow state="yellow" schedule={selectedTemplate.yellow_schedule} />
                      <DayStateScheduleRow state="green"  schedule={selectedTemplate.green_schedule} />
                      <DayStateScheduleRow state="blue"   schedule={selectedTemplate.blue_schedule} />
                    </div>

                    {/* Token goals */}
                    <div className="mt-3 pt-2 border-t border-border/40">
                      <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Token Goals
                      </Label>
                      <div className="flex gap-3 mt-1.5">
                        {[
                          { label: 'Quick Win', value: selectedTemplate.min_token_goal },
                          { label: 'Standard', value: selectedTemplate.standard_token_goal },
                          { label: 'Stretch', value: selectedTemplate.stretch_token_goal },
                        ].map(g => (
                          <div key={g.label} className="text-center flex-1">
                            <p className="text-lg font-bold text-primary">{g.value}</p>
                            <p className="text-[9px] text-muted-foreground">{g.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Response cost default */}
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">Response cost default</p>
                      <Badge variant={selectedTemplate.response_cost_default_enabled ? 'destructive' : 'secondary'} className="text-[9px]">
                        {selectedTemplate.response_cost_default_enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </div>

                    {/* Use case */}
                    {selectedTemplate.use_case_notes && (
                      <div className="mt-2 pt-2 border-t border-border/40">
                        <p className="text-[9px] text-muted-foreground leading-relaxed">
                          <strong>Use when:</strong> {selectedTemplate.use_case_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Classroom Override: Standard Token Goal ── */}
            {selectedTemplate && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Classroom Overrides (optional)
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground">Standard token goal override</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      placeholder={selectedTemplate.standard_token_goal.toString()}
                      value={tokenGoalOverride}
                      onChange={e => setTokenGoalOverride(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground">Response cost override</Label>
                    <div className="flex gap-2 mt-1">
                      {([
                        { label: 'Template', val: null },
                        { label: 'ON', val: true },
                        { label: 'OFF', val: false },
                      ] as { label: string; val: boolean | null }[]).map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setResponseCostOverride(opt.val)}
                          className={cn(
                            'flex-1 rounded-lg border text-[10px] py-1.5 transition-all',
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
                </div>
              </div>
            )}

            {/* ── Save ── */}
            <Button
              onClick={save}
              disabled={saving || !selectedTemplateId}
              className="w-full gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Classroom Reinforcement Settings
            </Button>

            {/* ── Schedule Reference ── */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
              <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                Schedule Reference
              </Label>
              <div className="space-y-1">
                {SCHEDULE_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-baseline gap-2">
                    <Badge variant="outline" className="text-[9px] font-mono w-16 shrink-0 justify-center">
                      {opt.value}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground">{opt.label.split(' — ')[1]}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
