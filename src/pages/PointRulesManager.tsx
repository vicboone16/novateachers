/**
 * Point Rules Manager — "Rule Bank" system.
 * Agency-level rules act as a central bank. Rules can be assigned to
 * specific students with per-student point overrides.
 * Separated into clear sections: Behaviors/Skills (targets), Rule Bank, Student Assignments.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useActiveClassroom } from '@/contexts/ActiveClassroomContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ArrowLeft, Plus, Trash2, Star, Target, Zap, Settings2, Pencil, Users, UserPlus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointRule {
  id: string;
  rule_name: string;
  points: number;
  source_table: string;
  event_type: string | null;
  event_subtype: string | null;
  behavior_name: string | null;
  behavior_category: string | null;
  rule_type: string;
  auto_apply: boolean;
  active: boolean;
  target_id: string | null;
  agency_id: string;
}

interface TeacherTarget {
  id: string;
  name: string;
  description: string | null;
  target_type: string;
  icon: string | null;
  active: boolean;
  source_table: string;
  default_behavior_name: string | null;
  default_behavior_category: string | null;
  default_event_type: string | null;
  action_group: string | null;
}

interface StudentRuleAssignment {
  id: string;
  student_id: string;
  student_reinforcement_profile_id: string;
  behavior_name: string | null;
  rule_scope: string;
  points: number;
  rule_type: string;
  is_active: boolean;
  linked_target_id: string | null;
}

interface StudentInfo {
  client_id: string;
  display_name: string;
}

const SOURCE_TABLE_OPTIONS = [
  { value: 'manual', label: 'Manual Award' },
  { value: 'teacher_frequency_entries', label: 'Frequency Count' },
  { value: 'teacher_duration_entries', label: 'Duration Timer' },
  { value: 'teacher_data_events', label: 'Data Event' },
  { value: 'abc_logs', label: 'ABC Log' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'reward', label: '🟢 Reward (+points)' },
  { value: 'cost', label: '🔴 Response Cost (-points)' },
];

const TARGET_TYPE_OPTIONS = [
  { value: 'replacement_behavior', label: '🟢 Replacement Behavior' },
  { value: 'positive_behavior', label: '⭐ Positive Behavior' },
  { value: 'skill_acquisition', label: '📘 Skill Acquisition' },
  { value: 'reduction_target', label: '🔴 Reduction Target' },
  { value: 'custom', label: '🎯 Custom' },
];

const PointRulesManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { agencyId } = useAppAccess();
  const { groupId } = useActiveClassroom();
  const { toast } = useToast();

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const [rules, setRules] = useState<PointRule[]>([]);
  const [targets, setTargets] = useState<TeacherTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<StudentRuleAssignment[]>([]);

  // New rule form
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePoints, setNewRulePoints] = useState(1);
  const [newRuleType, setNewRuleType] = useState('reward');
  const [newRuleSource, setNewRuleSource] = useState('manual');
  const [newRuleBehavior, setNewRuleBehavior] = useState('');
  const [newRuleTargetId, setNewRuleTargetId] = useState<string>('');
  const [newRuleAutoApply, setNewRuleAutoApply] = useState(true);

  // New target form
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetType, setNewTargetType] = useState('positive_behavior');
  const [newTargetIcon, setNewTargetIcon] = useState('⭐');
  const [newTargetDesc, setNewTargetDesc] = useState('');
  const [newTargetBehavior, setNewTargetBehavior] = useState('');

  // Assign rule to student
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRule, setAssignRule] = useState<PointRule | null>(null);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignPoints, setAssignPoints] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');

  useEffect(() => {
    if (effectiveAgencyId) loadAll();
  }, [effectiveAgencyId]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: r }, { data: t }] = await Promise.all([
      cloudSupabase.from('teacher_point_rules').select('*').eq('agency_id', effectiveAgencyId).order('rule_name'),
      cloudSupabase.from('teacher_targets').select('*').eq('agency_id', effectiveAgencyId).order('name'),
    ]);
    setRules((r || []) as any[]);
    setTargets((t || []) as any[]);

    // Load students for assignment
    if (groupId) {
      const { data: gs } = await cloudSupabase.from('classroom_group_students').select('client_id').eq('group_id', groupId);
      const ids = (gs || []).map((s: any) => s.client_id);
      setStudents(ids.map(id => ({ client_id: id, display_name: id.slice(0, 8) })));

      // Load existing student rule assignments
      if (ids.length > 0) {
        const { data: sa } = await cloudSupabase.from('student_reinforcement_rules').select('*').in('student_id', ids).eq('is_active', true);
        setStudentAssignments((sa || []) as any[]);
      }
    }

    setLoading(false);
  };

  const handleAddTarget = async () => {
    if (!newTargetName.trim() || !user) return;
    setSaving(true);
    const { error } = await cloudSupabase.from('teacher_targets').insert({
      agency_id: effectiveAgencyId,
      name: newTargetName.trim(),
      target_type: newTargetType,
      icon: newTargetIcon || '⭐',
      description: newTargetDesc || null,
      default_behavior_name: newTargetBehavior || null,
      source_table: 'manual',
      created_by: user.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: '✓ Target created' });
      setShowAddTarget(false);
      setNewTargetName(''); setNewTargetDesc(''); setNewTargetBehavior(''); setNewTargetIcon('⭐');
      loadAll();
    }
    setSaving(false);
  };

  const handleAddRule = async () => {
    if (!newRuleName.trim() || !user) return;
    setSaving(true);
    const pts = newRuleType === 'cost' ? -Math.abs(newRulePoints) : Math.abs(newRulePoints);
    const { error } = await cloudSupabase.from('teacher_point_rules').insert({
      agency_id: effectiveAgencyId,
      rule_name: newRuleName.trim(),
      points: pts,
      source_table: newRuleSource,
      rule_type: newRuleType,
      auto_apply: newRuleAutoApply,
      behavior_name: newRuleBehavior || null,
      target_id: newRuleTargetId || null,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: '✓ Rule added to bank' });
      setShowAddRule(false);
      setNewRuleName(''); setNewRulePoints(1); setNewRuleBehavior(''); setNewRuleTargetId('');
      loadAll();
    }
    setSaving(false);
  };

  const handleDeleteRule = async (id: string) => {
    await cloudSupabase.from('teacher_point_rules').delete().eq('id', id);
    loadAll();
  };

  const handleDeleteTarget = async (id: string) => {
    await cloudSupabase.from('teacher_targets').delete().eq('id', id);
    loadAll();
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    await cloudSupabase.from('teacher_point_rules').update({ active } as any).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, active } : r));
  };

  const openAssign = (rule: PointRule) => {
    setAssignRule(rule);
    setAssignPoints(String(Math.abs(rule.points)));
    setAssignStudentId('');
    setAssignOpen(true);
  };

  const handleAssignToStudent = async () => {
    if (!assignRule || !assignStudentId) return;
    setAssigning(true);
    try {
      // Ensure student has a reinforcement profile
      let { data: profile } = await cloudSupabase
        .from('student_reinforcement_profiles')
        .select('id')
        .eq('student_id', assignStudentId)
        .eq('agency_id', effectiveAgencyId)
        .eq('is_active', true)
        .maybeSingle();

      if (!profile) {
        const { data: created } = await cloudSupabase
          .from('student_reinforcement_profiles')
          .insert({ student_id: assignStudentId, agency_id: effectiveAgencyId, is_active: true })
          .select('id')
          .single();
        profile = created;
      }

      if (!profile) throw new Error('Could not create reinforcement profile');

      const pts = assignRule.rule_type === 'cost'
        ? -Math.abs(parseInt(assignPoints) || 1)
        : Math.abs(parseInt(assignPoints) || 1);

      await cloudSupabase.from('student_reinforcement_rules').insert({
        student_id: assignStudentId,
        student_reinforcement_profile_id: profile.id,
        behavior_name: assignRule.behavior_name || assignRule.rule_name,
        points: pts,
        rule_type: assignRule.rule_type,
        rule_scope: 'student',
        linked_target_id: assignRule.target_id,
        is_active: true,
      });

      toast({ title: '✓ Rule assigned to student', description: `${assignRule.rule_name} → ${pts > 0 ? '+' : ''}${pts} pts` });
      setAssignOpen(false);
      loadAll();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setAssigning(false);
  };

  const handleRemoveAssignment = async (id: string) => {
    await cloudSupabase.from('student_reinforcement_rules').update({ is_active: false }).eq('id', id);
    setStudentAssignments(prev => prev.filter(a => a.id !== id));
    toast({ title: '✓ Assignment removed' });
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  // Group student assignments by student
  const assignmentsByStudent = new Map<string, StudentRuleAssignment[]>();
  studentAssignments.forEach(a => {
    const list = assignmentsByStudent.get(a.student_id) || [];
    list.push(a);
    assignmentsByStudent.set(a.student_id, list);
  });

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/classroom')} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-lg font-bold font-heading flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" /> Point Rules
        </h1>
        <div className="w-16" />
      </div>

      {/* Tabs: Targets | Rule Bank | Student Assignments */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="targets" className="text-xs gap-1">
            <Target className="h-3 w-3" /> Targets
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1">
            <Star className="h-3 w-3" /> Rule Bank
          </TabsTrigger>
          <TabsTrigger value="students" className="text-xs gap-1">
            <Users className="h-3 w-3" /> Per Student
          </TabsTrigger>
        </TabsList>

        {/* ═══ TARGETS TAB ═══ */}
        <TabsContent value="targets">
          <Card className="border-border/40">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Behaviors & Skills
              </CardTitle>
              <Dialog open={showAddTarget} onOpenChange={setShowAddTarget}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Add</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Behavior / Skill Target</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-[3rem_1fr] gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Icon</Label>
                        <Input value={newTargetIcon} onChange={e => setNewTargetIcon(e.target.value)} className="text-center text-xl p-1" maxLength={2} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Name *</Label>
                        <Input value={newTargetName} onChange={e => setNewTargetName(e.target.value)} placeholder="e.g. Hand Raising" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Type</Label>
                      <Select value={newTargetType} onValueChange={setNewTargetType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TARGET_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Linked Behavior Name (optional)</Label>
                      <Input value={newTargetBehavior} onChange={e => setNewTargetBehavior(e.target.value)} placeholder="e.g. aggression, on-task" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Description</Label>
                      <Input value={newTargetDesc} onChange={e => setNewTargetDesc(e.target.value)} placeholder="Brief description" />
                    </div>
                    <Button onClick={handleAddTarget} disabled={saving || !newTargetName.trim()} className="w-full">
                      {saving ? 'Creating…' : 'Create Target'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {targets.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No targets defined yet. Add behaviors and skills above.</p>
              )}
              {targets.map(t => (
                <div key={t.id} className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                  t.active ? "bg-muted/30" : "bg-muted/10 opacity-60"
                )}>
                  <span className="text-lg">{t.icon || '🎯'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{t.target_type.replace(/_/g, ' ')}</Badge>
                      {t.default_behavior_name && <Badge variant="secondary" className="text-[9px]">{t.default_behavior_name}</Badge>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteTarget(t.id)}>
                    <Trash2 className="h-3 w-3 text-destructive/60" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RULE BANK TAB ═══ */}
        <TabsContent value="rules">
          <Card className="border-border/40">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" /> Rule Bank
              </CardTitle>
              <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Add Rule</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Point Rule to Bank</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Rule Name *</Label>
                      <Input value={newRuleName} onChange={e => setNewRuleName(e.target.value)} placeholder="e.g. On Task +2 stars" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Default Points</Label>
                        <Input type="number" value={newRulePoints} onChange={e => setNewRulePoints(Number(e.target.value))} min={1} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Type</Label>
                        <Select value={newRuleType} onValueChange={setNewRuleType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RULE_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Link to Target (optional)</Label>
                      <Select value={newRuleTargetId} onValueChange={setNewRuleTargetId}>
                        <SelectTrigger><SelectValue placeholder="None — manual rule" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {targets.map(t => <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Trigger Source</Label>
                      <Select value={newRuleSource} onValueChange={setNewRuleSource}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOURCE_TABLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Behavior Name Filter (optional)</Label>
                      <Input value={newRuleBehavior} onChange={e => setNewRuleBehavior(e.target.value)} placeholder="e.g. on-task" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Auto-apply when matched</Label>
                      <Switch checked={newRuleAutoApply} onCheckedChange={setNewRuleAutoApply} />
                    </div>
                    <Button onClick={handleAddRule} disabled={saving || !newRuleName.trim()} className="w-full">
                      {saving ? 'Creating…' : 'Add to Rule Bank'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {rules.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No rules in bank yet. Add rules to link behaviors to star values.</p>
              )}
              {rules.map(r => {
                const linkedTarget = targets.find(t => t.id === r.target_id);
                const assignedCount = studentAssignments.filter(a =>
                  a.behavior_name === (r.behavior_name || r.rule_name)
                ).length;
                return (
                  <div key={r.id} className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors",
                    r.active ? "bg-muted/30" : "bg-muted/10 opacity-60"
                  )}>
                    <div className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0",
                      r.rule_type === 'reward'
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    )}>
                      {r.points > 0 ? '+' : ''}{r.points}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.rule_name}</p>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {linkedTarget && <Badge className="text-[9px] gap-0.5">{linkedTarget.icon} {linkedTarget.name}</Badge>}
                        {r.behavior_name && <Badge variant="secondary" className="text-[9px]">{r.behavior_name}</Badge>}
                        <Badge variant="outline" className="text-[9px]">{r.source_table.replace('teacher_', '').replace('_entries', '')}</Badge>
                        {r.auto_apply && <Badge variant="outline" className="text-[9px] bg-primary/5">auto</Badge>}
                        {assignedCount > 0 && (
                          <Badge variant="secondary" className="text-[9px] gap-0.5">
                            <Users className="h-2 w-2" /> {assignedCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 shrink-0" onClick={() => openAssign(r)}>
                      <UserPlus className="h-3 w-3" /> Assign
                    </Button>
                    <Switch checked={r.active} onCheckedChange={v => handleToggleRule(r.id, v)} />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteRule(r.id)}>
                      <Trash2 className="h-3 w-3 text-destructive/60" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PER STUDENT TAB ═══ */}
        <TabsContent value="students">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Student Rule Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No students in current classroom. Select a classroom first.
                </p>
              ) : (
                <div className="space-y-3">
                  {students.map(student => {
                    const assignments = assignmentsByStudent.get(student.client_id) || [];
                    return (
                      <div key={student.client_id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/20">
                          <span className="text-lg">👤</span>
                          <p className="text-xs font-bold flex-1">{student.display_name}</p>
                          <Badge variant="outline" className="text-[9px]">{assignments.length} rules</Badge>
                        </div>
                        {assignments.length > 0 ? (
                          <div className="p-2 space-y-1">
                            {assignments.map(a => (
                              <div key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-muted/20">
                                <Badge
                                  variant={a.rule_type === 'response_cost' ? 'destructive' : 'secondary'}
                                  className="text-[9px] h-5 px-1.5 shrink-0"
                                >
                                  {a.rule_type === 'response_cost' ? '-' : '+'}{Math.abs(a.points)}
                                </Badge>
                                <span className="text-xs font-medium text-foreground flex-1 truncate">{a.behavior_name}</span>
                                <button
                                  onClick={() => handleRemoveAssignment(a.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground px-3 py-2">
                            No individual rules. Using agency defaults.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Rule to Student Sheet */}
      <Sheet open={assignOpen} onOpenChange={setAssignOpen}>
        <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl px-4 pb-8">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-heading text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Assign: {assignRule?.rule_name}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Student</Label>
              <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select student…" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.client_id} value={s.client_id} className="text-xs">
                      {s.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Points for this student
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Default: {assignRule?.points ?? 0}. Override below for this student's individual goal.
              </p>
              <Input
                type="number"
                value={assignPoints}
                onChange={e => setAssignPoints(e.target.value)}
                className="h-9 text-sm"
                placeholder={String(Math.abs(assignRule?.points ?? 1))}
              />
            </div>
            <Button
              onClick={handleAssignToStudent}
              disabled={assigning || !assignStudentId}
              className="w-full gap-1.5"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Assign Rule
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PointRulesManager;
