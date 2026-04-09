/**
 * ReinforcementAssignPanel — Full per-student reinforcement configuration.
 *
 * Three tabs:
 *   1. Profile — legacy template selection + response cost + bonus points toggles
 *   2. Schedule — day-state schedule overrides (RED/YELLOW/GREEN/BLUE → FR1/VR3/etc.)
 *   3. Behaviors — per-behavior rules (active, points, response cost per behavior)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StudentReinforcementScheduleSheet } from '@/components/StudentReinforcementScheduleSheet';
import { BehaviorRulesPanel } from '@/components/BehaviorRulesPanel';
import {
  Settings2, Loader2, Check, Plus, Trash2, Calendar, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface Profile {
  id: string;
  student_id: string;
  reinforcement_template_id: string | null;
  response_cost_enabled: boolean;
  bonus_points_enabled: boolean;
  reinforcement_mode: string;
  is_active: boolean;
}

interface Rule {
  id: string;
  student_id: string;
  student_reinforcement_profile_id: string;
  behavior_name: string | null;
  rule_scope: string;
  points: number;
  rule_type: string;
  is_active: boolean;
}

interface StudentScheduleSummary {
  use_classroom_defaults: boolean;
  red_schedule_override: string | null;
  yellow_schedule_override: string | null;
  green_schedule_override: string | null;
  blue_schedule_override: string | null;
  token_goal_override: number | null;
  earn_only_mode: boolean;
}

interface ReinforcementAssignPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
  classroomId?: string;
}

// ─── Tab type ────────────────────────────────────────────────

type Tab = 'profile' | 'schedule' | 'behaviors';

// ─── Main Component ───────────────────────────────────────────

export function ReinforcementAssignPanel({
  open, onOpenChange, studentId, studentName, agencyId, classroomId,
}: ReinforcementAssignPanelProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [scheduleSummary, setScheduleSummary] = useState<StudentScheduleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Sub-panel state
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showBehaviorRules, setShowBehaviorRules] = useState(false);

  // Profile form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__none__');
  const [responseCost, setResponseCost] = useState(false);
  const [bonusPoints, setBonusPoints] = useState(true);

  // New rule form
  const [newBehavior, setNewBehavior] = useState('');
  const [newPoints, setNewPoints] = useState('1');
  const [newType, setNewType] = useState<'reward' | 'response_cost'>('reward');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, pRes, rRes, sRes] = await Promise.all([
        cloudSupabase.from('beacon_reinforcement_templates').select('id, name, category, description').order('name'),
        cloudSupabase.from('student_reinforcement_profiles').select('*').eq('student_id', studentId).eq('agency_id', agencyId).eq('is_active', true).maybeSingle(),
        cloudSupabase.from('student_reinforcement_rules').select('*').eq('student_id', studentId).eq('is_active', true),
        cloudSupabase.from('beacon_student_reinforcement_schedules')
          .select('use_classroom_defaults, red_schedule_override, yellow_schedule_override, green_schedule_override, blue_schedule_override, token_goal_override, earn_only_mode')
          .eq('student_id', studentId)
          .maybeSingle(),
      ]);
      setTemplates((tRes.data || []) as Template[]);
      const p = pRes.data as Profile | null;
      setProfile(p);
      setSelectedTemplateId(p?.reinforcement_template_id || '__none__');
      setResponseCost(p?.response_cost_enabled ?? false);
      setBonusPoints(p?.bonus_points_enabled ?? true);
      setRules((rRes.data || []) as Rule[]);
      setScheduleSummary(sRes.data as StudentScheduleSummary | null);
    } catch { /* silent */ }
    setLoading(false);
  }, [studentId, agencyId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        student_id: studentId,
        agency_id: agencyId,
        reinforcement_template_id: selectedTemplateId === '__none__' ? null : selectedTemplateId,
        response_cost_enabled: responseCost,
        bonus_points_enabled: bonusPoints,
        reinforcement_mode: selectedTemplateId === '__none__' ? 'custom' : 'template',
        is_active: true,
      };

      if (profile?.id) {
        await cloudSupabase.from('student_reinforcement_profiles').update(payload).eq('id', profile.id);
      } else {
        await cloudSupabase.from('student_reinforcement_profiles').insert(payload);
      }

      await cloudSupabase.from('student_response_cost_settings').upsert({
        student_id: studentId,
        agency_id: agencyId,
        response_cost_enabled: responseCost,
      }, { onConflict: 'student_id,agency_id' });

      toast({ title: '✓ Reinforcement profile saved' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const addRule = async () => {
    if (!newBehavior.trim() || !profile?.id) return;
    setSaving(true);
    try {
      await cloudSupabase.from('student_reinforcement_rules').insert({
        student_id: studentId,
        student_reinforcement_profile_id: profile.id,
        behavior_name: newBehavior.trim(),
        points: parseInt(newPoints) || 1,
        rule_type: newType,
        rule_scope: 'student',
        is_active: true,
      });
      setNewBehavior('');
      setNewPoints('1');
      toast({ title: '✓ Rule added' });
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteRule = async (ruleId: string) => {
    await cloudSupabase.from('student_reinforcement_rules').update({ is_active: false }).eq('id', ruleId);
    setRules(prev => prev.filter(r => r.id !== ruleId));
    toast({ title: '✓ Rule removed' });
  };

  // ─── Schedule summary labels ───────────────────────────────
  const scheduleHasOverride = scheduleSummary && !scheduleSummary.use_classroom_defaults;
  const scheduleBadge = scheduleHasOverride
    ? 'Custom'
    : scheduleSummary?.use_classroom_defaults
      ? 'Classroom default'
      : 'Not set';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-heading text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Reinforcement — {studentName}
            </SheetTitle>
          </SheetHeader>

          {/* Tab bar */}
          <div className="flex gap-1 mb-4 rounded-lg border border-border/60 bg-muted/30 p-1">
            {([
              { id: 'profile',   label: 'Profile',    icon: Settings2 },
              { id: 'schedule',  label: 'Schedule',   icon: Calendar },
              { id: 'behaviors', label: 'Behaviors',  icon: ListChecks },
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[10px] font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── TAB: Profile ── */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  {/* Template selection */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Reinforcement Template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="No template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" className="text-xs">No template (custom)</SelectItem>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name} — {t.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Response Cost</p>
                        <p className="text-[10px] text-muted-foreground">Allow point deductions for behaviors</p>
                      </div>
                      <Switch checked={responseCost} onCheckedChange={setResponseCost} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Bonus Points</p>
                        <p className="text-[10px] text-muted-foreground">Allow extra points for exceptional behavior</p>
                      </div>
                      <Switch checked={bonusPoints} onCheckedChange={setBonusPoints} />
                    </div>
                  </div>

                  <Button onClick={saveProfile} disabled={saving} className="w-full gap-1.5">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save Profile
                  </Button>

                  {/* Per-student point rules */}
                  <div className="space-y-2 pt-3 border-t border-border/40">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Individual Point Rules
                    </Label>

                    {rules.length > 0 ? (
                      <div className="space-y-1">
                        {rules.map(rule => (
                          <div key={rule.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                            <Badge variant={rule.rule_type === 'response_cost' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1.5">
                              {rule.rule_type === 'response_cost' ? 'Cost' : 'Reward'}
                            </Badge>
                            <span className="text-xs font-medium text-foreground flex-1">{rule.behavior_name}</span>
                            <span className={cn('text-xs font-bold', rule.rule_type === 'response_cost' ? 'text-destructive' : 'text-green-600')}>
                              {rule.rule_type === 'response_cost' ? '-' : '+'}{Math.abs(rule.points)}
                            </span>
                            <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No individual rules yet.</p>
                    )}

                    {profile?.id && (
                      <div className="flex gap-2 items-end pt-1">
                        <div className="flex-1">
                          <Label className="text-[10px] text-muted-foreground">Behavior/Skill</Label>
                          <Input value={newBehavior} onChange={e => setNewBehavior(e.target.value)} placeholder="e.g. Raise hand" className="h-8 text-xs" />
                        </div>
                        <div className="w-16">
                          <Label className="text-[10px] text-muted-foreground">Points</Label>
                          <Input type="number" value={newPoints} onChange={e => setNewPoints(e.target.value)} className="h-8 text-xs" />
                        </div>
                        <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                          <SelectTrigger className="h-8 text-[10px] w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reward" className="text-xs">Reward</SelectItem>
                            <SelectItem value="response_cost" className="text-xs">Cost</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={addRule} disabled={saving || !newBehavior.trim()} className="h-8 gap-1">
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      </div>
                    )}
                    {!profile?.id && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Save the profile first to add individual rules.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB: Schedule ── */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Day-State Schedule
                      </Label>
                      <Badge variant={scheduleHasOverride ? 'secondary' : 'outline'} className="text-[9px]">
                        {scheduleBadge}
                      </Badge>
                    </div>

                    {scheduleSummary ? (
                      <div className="space-y-1.5">
                        {scheduleSummary.earn_only_mode && (
                          <Badge variant="secondary" className="text-[9px]">Earn-only mode — no response cost</Badge>
                        )}
                        {scheduleHasOverride ? (
                          <div className="space-y-1">
                            {([ ['red','🔴'], ['yellow','🟡'], ['green','🟢'], ['blue','🔵'] ] as [string,string][]).map(([state, emoji]) => {
                              const key = `${state}_schedule_override` as keyof StudentScheduleSummary;
                              const override = scheduleSummary[key] as string | null;
                              return override ? (
                                <div key={state} className="flex items-center gap-2 text-[10px]">
                                  <span>{emoji}</span>
                                  <span className="uppercase font-semibold w-14">{state}</span>
                                  <Badge variant="outline" className="text-[9px] font-mono">{override}</Badge>
                                </div>
                              ) : null;
                            })}
                            {scheduleSummary.token_goal_override && (
                              <p className="text-[10px] text-muted-foreground">
                                Token goal: {scheduleSummary.token_goal_override} tokens
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Using classroom SDC template defaults.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">
                        No schedule configured — uses classroom defaults.
                      </p>
                    )}
                  </div>

                  {/* Explanation of day-state model */}
                  <div className="space-y-1.5 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Day-State Rules
                    </Label>
                    {[
                      { emoji: '🔴', state: 'RED',    rule: 'Stabilize, not teach. Dense reinforcement, FR1.' },
                      { emoji: '🟡', state: 'YELLOW', rule: 'Rebuild tolerance. Reinforce attempts, FR1–FR2.' },
                      { emoji: '🟢', state: 'GREEN',  rule: 'Skill acquisition zone. FR2–FR5 schedule.' },
                      { emoji: '🔵', state: 'BLUE',   rule: 'Generalization. Intermittent VR reinforcement.' },
                    ].map(item => (
                      <div key={item.state} className="flex items-start gap-2 text-[10px]">
                        <span>{item.emoji}</span>
                        <div>
                          <span className="font-semibold">{item.state}</span>
                          <span className="text-muted-foreground ml-1">{item.rule}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => setShowScheduleSheet(true)}
                    className="w-full gap-1.5"
                  >
                    <Calendar className="h-4 w-4" />
                    Configure Day-State Schedule
                  </Button>
                </div>
              )}

              {/* ── TAB: Behaviors ── */}
              {activeTab === 'behaviors' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Behavior-Level Rules
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Control each behavior individually — active/visible toggle, points per
                      occurrence, response cost, and replacement behavior link.
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Critical:</strong> Behavior toggles override all other settings.
                      Response cost in RED state is always suppressed unless explicitly enabled.
                    </p>
                  </div>

                  <Button
                    onClick={() => setShowBehaviorRules(true)}
                    className="w-full gap-1.5"
                  >
                    <ListChecks className="h-4 w-4" />
                    Open Behavior Rules Editor
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Day-state schedule sub-panel */}
      <StudentReinforcementScheduleSheet
        open={showScheduleSheet}
        onOpenChange={(o) => { setShowScheduleSheet(o); if (!o) load(); }}
        studentId={studentId}
        studentName={studentName}
        agencyId={agencyId}
        classroomId={classroomId}
      />

      {/* Behavior rules sub-panel */}
      <BehaviorRulesPanel
        open={showBehaviorRules}
        onOpenChange={(o) => { setShowBehaviorRules(o); if (!o) load(); }}
        studentId={studentId}
        studentName={studentName}
        agencyId={agencyId}
      />
    </>
  );
}
