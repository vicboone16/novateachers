/**
 * BehaviorRulesPanel — Per-behavior reinforcement rules for a student.
 *
 * Implements Level 3 of the 3-tier reinforcement architecture:
 *   - Active / Teacher-visible toggles per behavior
 *   - Points enabled / Point value per behavior
 *   - Response cost enabled / Response cost amount per behavior
 *   - Response class and replacement behavior label
 *
 * Critical logic:
 *   - Points can only be added if points_enabled = true
 *   - Response cost only applied if enabled (and never in RED state)
 *   - Token balance can never go below zero
 *   - Behavior toggles override all other settings
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
import {
  Loader2, Check, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Eye, EyeOff,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

export interface BehaviorRule {
  id?: string;
  student_id: string;
  agency_id: string;
  behavior_name: string;
  response_class: string | null;
  behavior_category: string | null;
  active: boolean;
  teacher_visible: boolean;
  points_enabled: boolean;
  point_value: number;
  response_cost_enabled: boolean;
  response_cost_value: number;
  replacement_behavior_label: string | null;
  notes: string | null;
}

// ─── Constants ───────────────────────────────────────────────

const RESPONSE_CLASS_OPTIONS = [
  { value: 'escape',        label: 'Escape-maintained' },
  { value: 'attention',     label: 'Attention-maintained' },
  { value: 'tangible',      label: 'Tangible / access' },
  { value: 'sensory',       label: 'Automatic / sensory' },
  { value: 'replacement',   label: 'Replacement behavior' },
  { value: 'academic',      label: 'Academic skill' },
  { value: 'social',        label: 'Social skill' },
  { value: 'other',         label: 'Other' },
];

const BEHAVIOR_CATEGORY_OPTIONS = [
  { value: 'challenging',   label: 'Challenging behavior' },
  { value: 'replacement',   label: 'Replacement behavior' },
  { value: 'academic',      label: 'Academic / skill' },
  { value: 'social',        label: 'Social behavior' },
  { value: 'regulation',    label: 'Self-regulation' },
  { value: 'other',         label: 'Other' },
];

// ─── Empty rule factory ───────────────────────────────────────

function emptyRule(studentId: string, agencyId: string): Omit<BehaviorRule, 'id'> {
  return {
    student_id: studentId,
    agency_id: agencyId,
    behavior_name: '',
    response_class: null,
    behavior_category: 'challenging',
    active: true,
    teacher_visible: true,
    points_enabled: false,
    point_value: 1,
    response_cost_enabled: false,
    response_cost_value: 1,
    replacement_behavior_label: null,
    notes: null,
  };
}

// ─── Sub-component: BehaviorRuleCard ─────────────────────────

function BehaviorRuleCard({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: BehaviorRule;
  onUpdate: (updated: BehaviorRule) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const update = (patch: Partial<BehaviorRule>) => onUpdate({ ...rule, ...patch });

  const rcLabel = RESPONSE_CLASS_OPTIONS.find(o => o.value === rule.response_class)?.label;
  const catLabel = BEHAVIOR_CATEGORY_OPTIONS.find(o => o.value === rule.behavior_category)?.label;

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      rule.active ? 'border-border/60 bg-card' : 'border-border/30 bg-muted/20 opacity-60',
    )}>
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Active toggle */}
        <Switch
          checked={rule.active}
          onCheckedChange={v => update({ active: v })}
          className="shrink-0 scale-75"
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={cn('text-xs font-medium truncate', !rule.active && 'line-through text-muted-foreground')}>
              {rule.behavior_name}
            </p>
            {rcLabel && <Badge variant="outline" className="text-[8px] h-4 px-1">{rcLabel}</Badge>}
            {rule.replacement_behavior_label && (
              <Badge variant="secondary" className="text-[8px] h-4 px-1">
                → {rule.replacement_behavior_label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {rule.points_enabled ? (
              <span className="text-[9px] text-green-600 dark:text-green-400 font-semibold">
                +{rule.point_value} pts
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground">No points</span>
            )}
            {rule.response_cost_enabled && (
              <span className="text-[9px] text-destructive font-semibold">
                −{rule.response_cost_value} cost
              </span>
            )}
            {!rule.teacher_visible && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                <EyeOff className="h-2.5 w-2.5" /> hidden
              </span>
            )}
          </div>
        </div>

        {/* Expand / delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
          {rule.id && (
            <button
              onClick={() => onDelete(rule.id!)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-3">
          {/* Behavior name */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Behavior / Skill Name</Label>
            <Input
              value={rule.behavior_name}
              onChange={e => update({ behavior_name: e.target.value })}
              placeholder="e.g. Following directions"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Category + Response class */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Category</Label>
              <Select
                value={rule.behavior_category ?? 'other'}
                onValueChange={v => update({ behavior_category: v })}
              >
                <SelectTrigger className="h-8 text-[10px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEHAVIOR_CATEGORY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-[10px]">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Response Class</Label>
              <Select
                value={rule.response_class ?? 'other'}
                onValueChange={v => update({ response_class: v === 'other' ? null : v })}
              >
                <SelectTrigger className="h-8 text-[10px] mt-1">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_CLASS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-[10px]">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-medium">Teacher visible</p>
              <p className="text-[9px] text-muted-foreground">Show in Beacon teacher view</p>
            </div>
            <Switch checked={rule.teacher_visible} onCheckedChange={v => update({ teacher_visible: v })} />
          </div>

          {/* Points */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-green-700 dark:text-green-400">Earn Points</p>
              <Switch checked={rule.points_enabled} onCheckedChange={v => update({ points_enabled: v })} />
            </div>
            {rule.points_enabled && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-20 shrink-0">Point value</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={rule.point_value}
                  onChange={e => update({ point_value: parseInt(e.target.value) || 1 })}
                  className="h-7 text-xs w-20"
                />
                <p className="text-[9px] text-muted-foreground">per occurrence</p>
              </div>
            )}
          </div>

          {/* Response cost */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-destructive">Response Cost</p>
                <p className="text-[9px] text-muted-foreground">Deduct points (never during RED state)</p>
              </div>
              <Switch checked={rule.response_cost_enabled} onCheckedChange={v => update({ response_cost_enabled: v })} />
            </div>
            {rule.response_cost_enabled && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground w-20 shrink-0">Points deducted</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={rule.response_cost_value}
                  onChange={e => update({ response_cost_value: parseInt(e.target.value) || 1 })}
                  className="h-7 text-xs w-20"
                />
                <p className="text-[9px] text-muted-foreground">per occurrence</p>
              </div>
            )}
          </div>

          {/* Replacement behavior */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Replacement Behavior</Label>
            <Input
              value={rule.replacement_behavior_label ?? ''}
              onChange={e => update({ replacement_behavior_label: e.target.value || null })}
              placeholder="e.g. Request break, Ask for help"
              className="h-8 text-xs mt-1"
            />
          </div>

          {/* Notes */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Staff Notes</Label>
            <Input
              value={rule.notes ?? ''}
              onChange={e => update({ notes: e.target.value || null })}
              placeholder="Optional clinical notes"
              className="h-8 text-xs mt-1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

interface BehaviorRulesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
}

export function BehaviorRulesPanel({
  open, onOpenChange, studentId, studentName, agencyId,
}: BehaviorRulesPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<BehaviorRule[]>([]);
  const [pendingNew, setPendingNew] = useState<Omit<BehaviorRule, 'id'> | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await cloudSupabase
        .from('beacon_student_behavior_rules')
        .select('*')
        .eq('student_id', studentId)
        .order('behavior_name');
      setRules((data || []) as BehaviorRule[]);
    } catch {/* silent */}
    setLoading(false);
  }, [studentId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const updateRule = (updated: BehaviorRule) => {
    setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    setDirty(true);
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Upsert all existing rules
      for (const rule of rules) {
        if (rule.id) {
          await cloudSupabase
            .from('beacon_student_behavior_rules')
            .update({
              behavior_name: rule.behavior_name,
              response_class: rule.response_class,
              behavior_category: rule.behavior_category,
              active: rule.active,
              teacher_visible: rule.teacher_visible,
              points_enabled: rule.points_enabled,
              point_value: rule.point_value,
              response_cost_enabled: rule.response_cost_enabled,
              response_cost_value: rule.response_cost_value,
              replacement_behavior_label: rule.replacement_behavior_label,
              notes: rule.notes,
            })
            .eq('id', rule.id);
        }
      }

      // Insert pending new rule
      if (pendingNew && pendingNew.behavior_name.trim()) {
        await cloudSupabase
          .from('beacon_student_behavior_rules')
          .insert({ ...pendingNew, behavior_name: pendingNew.behavior_name.trim() });
        setPendingNew(null);
      }

      toast({ title: '✓ Behavior rules saved' });
      setDirty(false);
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteRule = async (ruleId: string) => {
    await cloudSupabase
      .from('beacon_student_behavior_rules')
      .delete()
      .eq('id', ruleId);
    setRules(prev => prev.filter(r => r.id !== ruleId));
    toast({ title: '✓ Rule removed' });
  };

  const addNew = () => {
    setPendingNew(emptyRule(studentId, agencyId));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-4 pb-10">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            Behavior Rules — {studentName}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Points on</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Response cost</span>
              <span className="flex items-center gap-1"><EyeOff className="h-2.5 w-2.5" />Hidden</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted" />Inactive</span>
            </div>

            {/* Existing rules */}
            {rules.length === 0 && !pendingNew && (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">No behavior rules yet.</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Add rules to control how each behavior earns or costs points.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {rules.map(rule => (
                <BehaviorRuleCard
                  key={rule.id}
                  rule={rule}
                  onUpdate={updateRule}
                  onDelete={deleteRule}
                />
              ))}
            </div>

            {/* Pending new rule form */}
            {pendingNew && (
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                <p className="text-[10px] text-primary font-semibold">New Behavior Rule</p>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Behavior / Skill Name *</Label>
                  <Input
                    value={pendingNew.behavior_name}
                    onChange={e => setPendingNew(prev => prev ? { ...prev, behavior_name: e.target.value } : null)}
                    placeholder="e.g. Following directions, Raise hand, Aggression"
                    className="h-8 text-xs mt-1"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Category</Label>
                    <Select
                      value={pendingNew.behavior_category ?? 'challenging'}
                      onValueChange={v => setPendingNew(prev => prev ? { ...prev, behavior_category: v } : null)}
                    >
                      <SelectTrigger className="h-8 text-[10px] mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BEHAVIOR_CATEGORY_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-[10px]">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Response Class</Label>
                    <Select
                      value={pendingNew.response_class ?? 'other'}
                      onValueChange={v => setPendingNew(prev => prev ? { ...prev, response_class: v === 'other' ? null : v } : null)}
                    >
                      <SelectTrigger className="h-8 text-[10px] mt-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {RESPONSE_CLASS_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-[10px]">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={pendingNew.points_enabled}
                      onCheckedChange={v => setPendingNew(prev => prev ? { ...prev, points_enabled: v } : null)}
                      className="scale-75"
                    />
                    <span className="text-[10px]">Earns points</span>
                    {pendingNew.points_enabled && (
                      <Input
                        type="number"
                        min={1}
                        value={pendingNew.point_value}
                        onChange={e => setPendingNew(prev => prev ? { ...prev, point_value: parseInt(e.target.value) || 1 } : null)}
                        className="h-7 text-xs w-14"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={pendingNew.response_cost_enabled}
                      onCheckedChange={v => setPendingNew(prev => prev ? { ...prev, response_cost_enabled: v } : null)}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-destructive">Response cost</span>
                    {pendingNew.response_cost_enabled && (
                      <Input
                        type="number"
                        min={1}
                        value={pendingNew.response_cost_value}
                        onChange={e => setPendingNew(prev => prev ? { ...prev, response_cost_value: parseInt(e.target.value) || 1 } : null)}
                        className="h-7 text-xs w-14"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Replacement behavior (optional)</Label>
                  <Input
                    value={pendingNew.replacement_behavior_label ?? ''}
                    onChange={e => setPendingNew(prev => prev ? { ...prev, replacement_behavior_label: e.target.value || null } : null)}
                    placeholder="e.g. Request break"
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveAll}
                    disabled={saving || !pendingNew.behavior_name.trim()}
                    className="flex-1 gap-1"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add Rule
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingNew(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={addNew}
                disabled={!!pendingNew}
                className="flex-1 gap-1.5 border-dashed"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Behavior Rule
              </Button>
              {(dirty || rules.length > 0) && !pendingNew && (
                <Button
                  onClick={saveAll}
                  disabled={saving}
                  className="flex-1 gap-1.5"
                  size="sm"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save All
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
