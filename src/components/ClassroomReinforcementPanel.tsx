/**
 * ClassroomReinforcementPanel — Classroom-level reinforcement setup.
 *
 * Combines:
 *   1. SDC Template selection — pick High Support / Moderate / Behavior Intensive / Sensory-Autism
 *   2. Legacy template assignment — assign from beacon_reinforcement_templates
 *   3. Per-student overrides — individual template / schedule / behavior rules
 *
 * Opens SDCReinforcementPanel for full day-state schedule configuration.
 * Opens StudentReinforcementScheduleSheet for per-student schedule overrides.
 * Opens ReinforcementAssignPanel for legacy per-student template + rule edits.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReinforcementAssignPanel } from '@/components/ReinforcementAssignPanel';
import { SDCReinforcementPanel } from '@/components/SDCReinforcementPanel';
import { StudentReinforcementScheduleSheet } from '@/components/StudentReinforcementScheduleSheet';
import {
  Settings2, Loader2, Check, Users, Pencil, Calendar, Target, ChevronRight,
  Zap, Brain, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface SDCTemplateSummary {
  id: string;
  template_name: string;
  support_level: string;
  red_schedule: string;
  yellow_schedule: string;
  green_schedule: string;
  blue_schedule: string;
  standard_token_goal: number;
}

interface ClassroomSDCSetting {
  sdc_template_id: string | null;
  standard_token_goal_override: number | null;
  response_cost_enabled_override: boolean | null;
  token_economy_enabled: boolean;
}

interface StudentProfile {
  student_id: string;
  student_name: string;
  template_id: string | null;
  template_name: string | null;
  response_cost: boolean;
  bonus_points: boolean;
  has_custom_rules: boolean;
  has_schedule_override: boolean;
}

interface ClassroomReinforcementPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  agencyId: string;
  classroomName?: string;
  students: Array<{ id: string; name: string }>;
}

// ─── Constants ───────────────────────────────────────────────

const SDC_LEVEL_ICONS: Record<string, React.ElementType> = {
  high_support:       Zap,
  moderate_support:   Target,
  behavior_intensive: AlertTriangle,
  sensory_autism:     Brain,
};

const SDC_LEVEL_LABELS: Record<string, string> = {
  high_support:       'High Support',
  moderate_support:   'Moderate Support',
  behavior_intensive: 'Behavior Intensive',
  sensory_autism:     'Sensory & Autism',
};

const STATE_BADGE_CLASSES: Record<string, string> = {
  red:    'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  yellow: 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300',
  green:  'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  blue:   'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
};

// ─── Main Component ───────────────────────────────────────────

export function ClassroomReinforcementPanel({
  open, onOpenChange, groupId, agencyId, classroomName, students,
}: ClassroomReinforcementPanelProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [classTemplateId, setClassTemplateId] = useState<string>('__none__');
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // SDC template data
  const [sdcSettings, setSdcSettings] = useState<ClassroomSDCSetting | null>(null);
  const [sdcTemplateSummary, setSdcTemplateSummary] = useState<SDCTemplateSummary | null>(null);

  // Sub-panel state
  const [showSDCPanel, setShowSDCPanel] = useState(false);
  const [editStudent, setEditStudent] = useState<{ id: string; name: string } | null>(null);
  const [scheduleStudent, setScheduleStudent] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, bctRes, sdcSettingsRes] = await Promise.all([
        cloudSupabase.from('beacon_reinforcement_templates').select('id, name, category, description').order('name'),
        cloudSupabase.from('beacon_classroom_templates').select('template_id').eq('group_id', groupId).maybeSingle(),
        cloudSupabase
          .from('beacon_classroom_reinforcement_settings')
          .select('sdc_template_id, standard_token_goal_override, response_cost_enabled_override, token_economy_enabled')
          .eq('classroom_id', groupId)
          .maybeSingle(),
      ]);

      setTemplates((tRes.data || []) as Template[]);
      setClassTemplateId(bctRes.data?.template_id || '__none__');

      const sdcSetting = sdcSettingsRes.data as ClassroomSDCSetting | null;
      setSdcSettings(sdcSetting);

      // Load SDC template summary if assigned
      if (sdcSetting?.sdc_template_id) {
        const { data: sdcTmpl } = await cloudSupabase
          .from('beacon_sdc_reinforcement_templates')
          .select('id, template_name, support_level, red_schedule, yellow_schedule, green_schedule, blue_schedule, standard_token_goal')
          .eq('id', sdcSetting.sdc_template_id)
          .maybeSingle();
        setSdcTemplateSummary(sdcTmpl as SDCTemplateSummary | null);
      } else {
        setSdcTemplateSummary(null);
      }

      // Load per-student profiles
      const studentIds = students.map(s => s.id);
      if (studentIds.length > 0) {
        const { data: profiles } = await cloudSupabase
          .from('student_reinforcement_profiles')
          .select('student_id, reinforcement_template_id, response_cost_enabled, bonus_points_enabled')
          .in('student_id', studentIds)
          .eq('agency_id', agencyId)
          .eq('is_active', true);

        const { data: rules } = await cloudSupabase
          .from('student_reinforcement_rules')
          .select('student_id')
          .in('student_id', studentIds)
          .eq('is_active', true);

        const { data: schedules } = await cloudSupabase
          .from('beacon_student_reinforcement_schedules')
          .select('student_id, use_classroom_defaults')
          .in('student_id', studentIds);

        const profileMap = new Map((profiles || []).map(p => [p.student_id, p]));
        const ruleStudents = new Set((rules || []).map(r => r.student_id));
        const templateMap = new Map((tRes.data || []).map((t: any) => [t.id, t.name]));
        const scheduleOverrides = new Set(
          (schedules || []).filter(s => !s.use_classroom_defaults).map(s => s.student_id)
        );

        const merged: StudentProfile[] = students.map(s => {
          const p = profileMap.get(s.id);
          return {
            student_id: s.id,
            student_name: s.name,
            template_id: p?.reinforcement_template_id || null,
            template_name: p?.reinforcement_template_id ? (templateMap.get(p.reinforcement_template_id) || 'Unknown') : null,
            response_cost: p?.response_cost_enabled ?? false,
            bonus_points: p?.bonus_points_enabled ?? true,
            has_custom_rules: ruleStudents.has(s.id),
            has_schedule_override: scheduleOverrides.has(s.id),
          };
        });
        setStudentProfiles(merged);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [groupId, agencyId, students]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const applyToClass = async () => {
    if (classTemplateId === '__none__') return;
    setApplying(true);
    try {
      await cloudSupabase.from('beacon_classroom_templates').upsert({
        group_id: groupId,
        template_id: classTemplateId,
        applied_by: 'system',
      }, { onConflict: 'group_id' });

      const studentIds = students.map(s => s.id);
      for (const sid of studentIds) {
        const existing = studentProfiles.find(p => p.student_id === sid);
        if (!existing?.template_id || existing.template_id === classTemplateId) {
          await cloudSupabase.from('student_reinforcement_profiles').upsert({
            student_id: sid,
            agency_id: agencyId,
            reinforcement_template_id: classTemplateId,
            reinforcement_mode: 'template',
            is_active: true,
          }, { onConflict: 'student_id,agency_id' } as any);
        }
      }

      toast({ title: '✓ Template applied to classroom' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setApplying(false);
  };

  const classTemplateName = templates.find(t => t.id === classTemplateId)?.name;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-heading text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Classroom Reinforcement
              {classroomName && <span className="text-muted-foreground font-normal">— {classroomName}</span>}
            </SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">

              {/* ── SDC Reinforcement Template Section ── */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-bold text-foreground">SDC Reinforcement Schedule</p>
                      <p className="text-[10px] text-muted-foreground">
                        Day-state aware: RED → FR1 · YELLOW → FR2 · GREEN → FR3 · BLUE → VR
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSDCPanel(true)}
                    className="gap-1.5 h-8 text-xs shrink-0"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configure
                  </Button>
                </div>

                {/* Current SDC template summary */}
                {sdcTemplateSummary ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = SDC_LEVEL_ICONS[sdcTemplateSummary.support_level] ?? Target;
                        return <Icon className="h-3.5 w-3.5 text-primary" />;
                      })()}
                      <p className="text-[11px] font-semibold">{sdcTemplateSummary.template_name}</p>
                      <Badge variant="secondary" className="text-[9px] h-4">
                        {SDC_LEVEL_LABELS[sdcTemplateSummary.support_level] ?? sdcTemplateSummary.support_level}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(['red', 'yellow', 'green', 'blue'] as const).map(state => (
                        <div key={state} className={cn('rounded-lg border px-2 py-1 text-center', STATE_BADGE_CLASSES[state])}>
                          <p className="text-[9px] font-mono font-bold">
                            {sdcTemplateSummary[`${state}_schedule`]}
                          </p>
                          <p className="text-[8px] uppercase tracking-wide opacity-70">{state}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      Standard token goal: {sdcSettings?.standard_token_goal_override ?? sdcTemplateSummary.standard_token_goal} tokens
                      {sdcSettings?.token_economy_enabled === false && ' · Token economy: OFF'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <p className="text-[10px] text-muted-foreground">
                      No SDC template assigned. Configure to set day-state reinforcement schedules.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Legacy Template (beacon_reinforcement_templates) ── */}
              <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="text-xs font-bold">Points & Rewards Template</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Controls default points, currency display, and engagement scoring.
                </p>
                <Select value={classTemplateId} onValueChange={setClassTemplateId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="No template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">No template</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name} — {t.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={applyToClass}
                  disabled={applying || classTemplateId === '__none__'}
                  className="w-full gap-1.5"
                  size="sm"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Apply to All Students
                </Button>
              </div>

              {/* ── Per-student list ── */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Per-Student Overrides
                </Label>
                <div className="space-y-1">
                  {studentProfiles.map(sp => (
                    <div
                      key={sp.student_id}
                      className="rounded-lg border border-border/60 bg-card px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{sp.student_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {sp.template_name ? (
                              <Badge variant="secondary" className="text-[8px] h-4 px-1.5">
                                {sp.template_name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] h-4 px-1.5 text-muted-foreground">
                                {classTemplateName ? `Using: ${classTemplateName}` : 'No template'}
                              </Badge>
                            )}
                            {sp.has_schedule_override && (
                              <Badge variant="secondary" className="text-[8px] h-4 px-1.5">
                                <Calendar className="h-2 w-2 mr-0.5" />
                                Custom schedule
                              </Badge>
                            )}
                            {sp.response_cost && (
                              <Badge variant="destructive" className="text-[8px] h-4 px-1.5">RC</Badge>
                            )}
                            {sp.has_custom_rules && (
                              <Badge variant="secondary" className="text-[8px] h-4 px-1.5">Custom rules</Badge>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setScheduleStudent({ id: sp.student_id, name: sp.student_name })}
                            className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[9px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                            title="Day-state schedule"
                          >
                            <Calendar className="h-2.5 w-2.5" />
                            Schedule
                          </button>
                          <button
                            onClick={() => setEditStudent({ id: sp.student_id, name: sp.student_name })}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                            title="Edit reinforcement template & rules"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* SDC template configuration panel */}
      <SDCReinforcementPanel
        open={showSDCPanel}
        onOpenChange={(o) => { setShowSDCPanel(o); if (!o) load(); }}
        classroomId={groupId}
        agencyId={agencyId}
        classroomName={classroomName}
      />

      {/* Per-student day-state schedule override */}
      {scheduleStudent && (
        <StudentReinforcementScheduleSheet
          open={!!scheduleStudent}
          onOpenChange={(o) => { if (!o) { setScheduleStudent(null); load(); } }}
          studentId={scheduleStudent.id}
          studentName={scheduleStudent.name}
          agencyId={agencyId}
          classroomId={groupId}
        />
      )}

      {/* Per-student legacy template + rules editor */}
      {editStudent && (
        <ReinforcementAssignPanel
          open={!!editStudent}
          onOpenChange={(o) => { if (!o) { setEditStudent(null); load(); } }}
          studentId={editStudent.id}
          studentName={editStudent.name}
          agencyId={agencyId}
        />
      )}
    </>
  );
}
