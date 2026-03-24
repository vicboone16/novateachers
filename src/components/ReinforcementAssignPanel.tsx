/**
 * ReinforcementAssignPanel — Assign & modify reinforcement profiles per student.
 * Shows template selection, response cost toggle, bonus points toggle,
 * and per-student rule overrides.
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
import { Settings2, Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ReinforcementAssignPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  agencyId: string;
}

export function ReinforcementAssignPanel({
  open, onOpenChange, studentId, studentName, agencyId,
}: ReinforcementAssignPanelProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const [tRes, pRes, rRes] = await Promise.all([
        cloudSupabase.from('beacon_reinforcement_templates').select('id, name, category, description').order('name'),
        cloudSupabase.from('student_reinforcement_profiles').select('*').eq('student_id', studentId).eq('agency_id', agencyId).eq('is_active', true).maybeSingle(),
        cloudSupabase.from('student_reinforcement_rules').select('*').eq('student_id', studentId).eq('is_active', true),
      ]);
      setTemplates((tRes.data || []) as Template[]);
      const p = pRes.data as Profile | null;
      setProfile(p);
      setSelectedTemplateId(p?.reinforcement_template_id || '__none__');
      setResponseCost(p?.response_cost_enabled ?? false);
      setBonusPoints(p?.bonus_points_enabled ?? true);
      setRules((rRes.data || []) as Rule[]);
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

      // Also sync response cost settings
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="pb-3">
          <SheetTitle className="font-heading text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Reinforcement — {studentName}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
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

            {/* Save profile button */}
            <Button onClick={saveProfile} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save Profile
            </Button>

            {/* Per-student rules */}
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
                <p className="text-[10px] text-muted-foreground">No individual rules yet. Add one below.</p>
              )}

              {/* Add rule form */}
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
      </SheetContent>
    </Sheet>
  );
}
