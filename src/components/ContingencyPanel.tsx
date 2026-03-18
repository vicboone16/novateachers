/**
 * ContingencyPanel — Manage class and schoolwide contingencies + culture prompts.
 * Reads/writes to Core-owned tables.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Target, Trophy, Plus, Sparkles, BookOpen, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contingency {
  id: string;
  name: string;
  description: string | null;
  target_value: number;
  current_value: number;
  reward_name: string;
  is_active: boolean;
}

interface CulturePrompt {
  id: string;
  prompt_type: string;
  content: string;
  is_active: boolean;
}

interface Props {
  classroomId: string;
  agencyId: string;
}

const PROMPT_TYPES = [
  { value: 'mission', label: 'Mission of the Day', icon: Sparkles },
  { value: 'word_of_week', label: 'Word of the Week', icon: BookOpen },
  { value: 'affirmation', label: 'Affirmation', icon: Star },
];

export function ContingencyPanel({ classroomId, agencyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contingencies, setContingencies] = useState<Contingency[]>([]);
  const [prompts, setPrompts] = useState<CulturePrompt[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [targetValue, setTargetValue] = useState('100');
  const [rewardName, setRewardName] = useState('');
  const [promptType, setPromptType] = useState('mission');
  const [promptContent, setPromptContent] = useState('');

  const loadData = useCallback(async () => {
    // Class contingencies
    try {
      const { data } = await supabase
        .from('class_contingencies' as any)
        .select('id, name, description, target_value, current_value, reward_name, is_active')
        .eq('classroom_id', classroomId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setContingencies((data || []) as any as Contingency[]);
    } catch { /* silent */ }

    // Culture prompts
    try {
      const { data } = await supabase
        .from('school_culture_prompts' as any)
        .select('id, prompt_type, content, is_active')
        .or(`classroom_id.eq.${classroomId},classroom_id.is.null`)
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setPrompts((data || []) as any as CulturePrompt[]);
    } catch { /* silent */ }
  }, [classroomId, agencyId]);

  useEffect(() => { loadData(); }, [loadData]);

  const createContingency = async () => {
    if (!name.trim() || !rewardName.trim() || !user) return;
    try {
      const { error } = await supabase
        .from('class_contingencies' as any)
        .insert({
          classroom_id: classroomId,
          agency_id: agencyId,
          name: name.trim(),
          target_value: parseInt(targetValue) || 100,
          reward_name: rewardName.trim(),
          created_by: user.id,
        });
      if (error) throw error;
      setCreateOpen(false);
      setName('');
      setTargetValue('100');
      setRewardName('');
      loadData();
      toast({ title: 'Contingency created' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const createPrompt = async () => {
    if (!promptContent.trim() || !user) return;
    try {
      const { error } = await supabase
        .from('school_culture_prompts' as any)
        .insert({
          agency_id: agencyId,
          classroom_id: classroomId,
          prompt_type: promptType,
          content: promptContent.trim(),
          created_by: user.id,
        });
      if (error) throw error;
      setPromptOpen(false);
      setPromptContent('');
      loadData();
      toast({ title: 'Culture prompt added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const incrementContingency = async (c: Contingency, amount: number) => {
    try {
      const newVal = Math.max(0, c.current_value + amount);
      await supabase
        .from('class_contingencies' as any)
        .update({
          current_value: newVal,
          earned_at: newVal >= c.target_value ? new Date().toISOString() : null,
        })
        .eq('id', c.id);
      loadData();
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-4">
      {/* Contingencies */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Class Goals
        </h3>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Goal
        </Button>
      </div>

      {contingencies.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No active class goals</p>
      ) : (
        <div className="space-y-2">
          {contingencies.map(c => {
            const pct = c.target_value > 0 ? Math.min(100, Math.round((c.current_value / c.target_value) * 100)) : 0;
            return (
              <Card key={c.id} className={cn('border-border/40', pct >= 100 && 'border-accent/50 bg-accent/5')}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={() => incrementContingency(c, -1)}>−</Button>
                      <span className="text-sm font-bold min-w-[3rem] text-center">{c.current_value}/{c.target_value}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={() => incrementContingency(c, 1)}>+</Button>
                    </div>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                    <Trophy className="h-3 w-3 text-amber-500" />
                    Reward: {c.reward_name}
                    {pct >= 100 && <Badge className="ml-auto text-[9px] bg-accent/20 text-accent-foreground">Earned!</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Culture Prompts */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-base font-bold font-heading flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Culture Prompts
        </h3>
        <Button size="sm" variant="outline" onClick={() => setPromptOpen(true)} className="gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Prompt
        </Button>
      </div>

      {prompts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No active culture prompts</p>
      ) : (
        <div className="space-y-1.5">
          {prompts.map(p => {
            const cfg = PROMPT_TYPES.find(t => t.value === p.prompt_type);
            const PIcon = cfg?.icon || Sparkles;
            return (
              <div key={p.id} className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                <PIcon className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{cfg?.label}</p>
                  <p className="text-sm">{p.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Contingency Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">New Class Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Goal Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 100 class points" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target</Label>
              <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reward</Label>
              <Input value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="e.g. Extra recess" />
            </div>
            <div className="flex justify-end">
              <Button onClick={createContingency} disabled={!name.trim() || !rewardName.trim()}>Create Goal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Prompt Dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add Culture Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {PROMPT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setPromptType(t.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                    promptType === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Textarea
              value={promptContent}
              onChange={e => setPromptContent(e.target.value)}
              placeholder="Enter your prompt…"
              rows={2}
            />
            <div className="flex justify-end">
              <Button onClick={createPrompt} disabled={!promptContent.trim()}>Add Prompt</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
