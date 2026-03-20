/**
 * Point Rules Manager — lets teachers link behaviors and skills to star/point values.
 * Manages teacher_targets, teacher_point_rules, and teacher_point_actions.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppAccess } from '@/contexts/AppAccessContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Star, Target, Zap, Settings2, Pencil } from 'lucide-react';
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

interface PointAction {
  id: string;
  action_label: string;
  action_icon: string | null;
  source_table: string;
  mapped_rule_id: string | null;
  manual_points: number | null;
  active: boolean;
  sort_order: number;
  target_id: string | null;
  action_group: string | null;
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
  const { toast } = useToast();

  const effectiveAgencyId = agencyId || currentWorkspace?.agency_id || '';

  const [rules, setRules] = useState<PointRule[]>([]);
  const [targets, setTargets] = useState<TeacherTarget[]>([]);
  const [actions, setActions] = useState<PointAction[]>([]);
  const [loading, setLoading] = useState(true);

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

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (effectiveAgencyId) loadAll();
  }, [effectiveAgencyId]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: r }, { data: t }, { data: a }] = await Promise.all([
      cloudSupabase.from('teacher_point_rules').select('*').eq('agency_id', effectiveAgencyId).order('rule_name'),
      cloudSupabase.from('teacher_targets').select('*').eq('agency_id', effectiveAgencyId).order('name'),
      cloudSupabase.from('teacher_point_actions').select('*').eq('agency_id', effectiveAgencyId).order('sort_order'),
    ]);
    setRules((r || []) as any[]);
    setTargets((t || []) as any[]);
    setActions((a || []) as any[]);
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
      toast({ title: '✓ Point rule created' });
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

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

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

      {/* ═══ TARGETS SECTION ═══ */}
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
                <div className="flex gap-1 mt-0.5">
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

      {/* ═══ POINT RULES SECTION ═══ */}
      <Card className="border-border/40">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Point Rules
          </CardTitle>
          <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7"><Plus className="h-3 w-3" /> Add Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Point Rule</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Rule Name *</Label>
                  <Input value={newRuleName} onChange={e => setNewRuleName(e.target.value)} placeholder="e.g. On Task +2 stars" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Points</Label>
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
                  {saving ? 'Creating…' : 'Create Rule'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {rules.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No point rules defined yet. Add rules to link behaviors to star values.</p>
          )}
          {rules.map(r => {
            const linkedTarget = targets.find(t => t.id === r.target_id);
            return (
              <div key={r.id} className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                r.active ? "bg-muted/30" : "bg-muted/10 opacity-60"
              )}>
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                  r.rule_type === 'reward' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
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
                  </div>
                </div>
                <Switch checked={r.active} onCheckedChange={v => handleToggleRule(r.id, v)} />
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleDeleteRule(r.id)}>
                  <Trash2 className="h-3 w-3 text-destructive/60" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Actions summary */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent" /> Quick Actions ({actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Quick action buttons appear on student cards in the Classroom view. They are automatically generated from your targets and rules.
          </p>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {actions.filter(a => a.active).map(a => (
                <Badge key={a.id} variant="outline" className="text-xs gap-1">
                  {a.action_icon || '⚡'} {a.action_label}
                  {a.manual_points && <span className="text-muted-foreground">({a.manual_points > 0 ? '+' : ''}{a.manual_points})</span>}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PointRulesManager;
